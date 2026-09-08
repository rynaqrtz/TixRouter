import { db } from "./db.js";

export interface ModelOutcomeStats {
    model: string;
    total: number;
    successes: number;
    retries: number;
    failures: number;
    score: number;
}

export interface CacheAffinityRow {
    providerId: string;
    model: string;
    cacheHits: number;
    totalRequests: number;
    cachedTokens: number;
}

const SCORE_MIN_TRIALS = 5;
const SCORE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const AFFINITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SCORE_WILSON_Z = 1.96;
const SCORE_FAIL_PENALTY = 0.25;
const SCORE_RETRY_PENALTY = 0.35;
const SCORE_SWAP_MARGIN = 0.1;

export function ModelOutcomeStatsDB(): ModelOutcomeStats[] {
    const rows = db
        .prepare(
            `
        SELECT model,
               COUNT(*) AS total,
               SUM(CASE WHEN status_code BETWEEN 200 AND 399 THEN 1 ELSE 0 END) AS successes,
               SUM(retried) AS retries,
               SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS failures
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY model
    `
        )
        .all(Date.now() - SCORE_WINDOW_MS) as unknown as Array<{
        model: string;
        total: number;
        successes: number | null;
        retries: number | null;
        failures: number | null;
    }>;

    return rows.map((row) => {
        const total = row.total;
        const successes = row.successes ?? 0;
        const retries = row.retries ?? 0;
        const failures = row.failures ?? 0;
        let score: number;
        if (total < SCORE_MIN_TRIALS) {
            score = 0.5;
        } else {
            const p = successes / total;
            const denominator = 1 + (SCORE_WILSON_Z * SCORE_WILSON_Z) / total;
            const centre = p + (SCORE_WILSON_Z * SCORE_WILSON_Z) / (2 * total);
            const margin =
                SCORE_WILSON_Z *
                Math.sqrt((p * (1 - p)) / total + (SCORE_WILSON_Z * SCORE_WILSON_Z) / (4 * total * total));
            score = (centre - margin) / denominator;
        }
        score -= (retries * SCORE_RETRY_PENALTY + failures * SCORE_FAIL_PENALTY) / total;
        return {
            model: row.model,
            total,
            successes,
            retries,
            failures,
            score: Math.max(0, Math.min(1, score))
        };
    });
}

export function ModelCacheAffinityDB(model?: string): CacheAffinityRow[] {
    return db
        .prepare(
            `
        SELECT provider_id AS providerId,
               model,
               SUM(CASE WHEN cached_tokens > 0 THEN 1 ELSE 0 END) AS cacheHits,
               COUNT(*) AS totalRequests,
               SUM(cached_tokens) AS cachedTokens
        FROM request_logs
        WHERE created_at >= ? AND (? IS NULL OR model = ?)
        GROUP BY provider_id, model
        ORDER BY cacheHits DESC, cachedTokens DESC
    `
        )
        .all(Date.now() - AFFINITY_WINDOW_MS, model ?? null, model ?? null) as unknown as CacheAffinityRow[];
}

export function GetOutcomeFeedbackEnabled(): boolean {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'outcome_routing_enabled'").get() as
        | { value: string }
        | undefined;
    return row?.value !== "false";
}

export function GetCacheAffinityEnabled(): boolean {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'cache_affinity_enabled'").get() as
        | { value: string }
        | undefined;
    return row?.value !== "false";
}

export function ReorderCandidatesByOutcome<T extends { model: string }>(
    candidates: T[],
    stats: ModelOutcomeStats[]
): T[] {
    if (candidates.length < 2) return candidates;
    const byModel = new Map(stats.map((s) => [s.model, s]));
    const scoreOf = (model: string): number => byModel.get(model)?.score ?? 0.5;
    const best = [...candidates].sort((a, b) => scoreOf(b.model) - scoreOf(a.model))[0]!;
    if (best.model === candidates[0]!.model) return candidates;
    if (scoreOf(best.model) - scoreOf(candidates[0]!.model) < SCORE_SWAP_MARGIN) return candidates;
    return [best, ...candidates.filter((c) => c.model !== best.model)];
}

export function ReorderProvidersByAffinity<T extends { id: string }>(
    providers: T[],
    model: string
): T[] {
    if (providers.length < 2) return providers;
    const affinity = new Map(
        ModelCacheAffinityDB(model)
            .filter((row) => row.cacheHits > 0)
            .map((row) => [row.providerId, row.cacheHits])
    );
    if (affinity.size === 0) return providers;
    return [...providers].sort((a, b) => (affinity.get(b.id) ?? 0) - (affinity.get(a.id) ?? 0));
}

export function FindRecentFailureDB(apiKeyId: string, promptHash: string, windowMs: number): string | null {
    const row = db
        .prepare(
            `
        SELECT id FROM request_logs
        WHERE api_key_id = ? AND prompt_hash = ? AND status_code >= 400 AND created_at >= ?
        LIMIT 1
    `
        )
        .get(apiKeyId, promptHash, Date.now() - windowMs) as unknown as { id: string } | undefined;
    return row?.id ?? null;
}

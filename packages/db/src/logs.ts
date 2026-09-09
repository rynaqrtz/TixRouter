import type {
    ModelUsageSummaryRow,
    RequestLogEntry,
    UsageByModelRow,
    UsageSummary
} from "@tixrouter/types";
import { db } from "./db.js";
import { generateId, num, optStr, str } from "./row-utils.js";

interface RequestLogRow {
    id: string;
    api_key_id: string | null;
    provider_id: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    status_code: number;
    latency_ms: number;
    cached_tokens: number;
    cache_creation_tokens: number;
    reasoning_tokens: number;
    estimated_cost: number;
    fallback_occurred: number;
    fallback_path: string | null;
    fallback_reason: string | null;
    resolved_model: string | null;
    prompt_hash: string | null;
    retried: number;
    explicit_feedback: string | null;
    created_at: number;
}

interface UsageSummaryRow {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCacheCreationTokens: number;
    totalReasoningTokens: number;
    totalEstimatedCost: number;
}

interface ModelUsageDBShape {
    model: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCost: number;
    lastUsedAt: number | null;
}

interface UsageByModelDBShape {
    model: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    estCost: number;
}

export function logRequestDB(entry: Omit<RequestLogEntry, "id" | "createdAt">): RequestLogEntry {
    const Id = generateId("log");
    const CreatedAt = Date.now();

    const Query = db.prepare(`
        INSERT INTO request_logs (id, api_key_id, provider_id, model, prompt_tokens, completion_tokens, total_tokens, status_code, latency_ms, cached_tokens, cache_creation_tokens, reasoning_tokens, estimated_cost, fallback_occurred, fallback_path, fallback_reason, resolved_model, prompt_hash, retried, explicit_feedback, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    Query.run(
        Id,
        entry.apiKeyId ?? null,
        entry.providerId,
        entry.model,
        entry.promptTokens,
        entry.completionTokens,
        entry.totalTokens,
        entry.statusCode,
        entry.latencyMs,
        entry.cachedTokens ?? 0,
        entry.cacheCreationTokens ?? 0,
        entry.reasoningTokens ?? 0,
        entry.estimatedCost ?? 0,
        entry.fallbackOccurred ? 1 : 0,
        entry.fallbackPath ?? null,
        entry.fallbackReason ?? null,
        entry.resolvedModel ?? null,
        entry.promptHash ?? null,
        entry.retried ? 1 : 0,
        entry.explicitFeedback ?? null,
        CreatedAt
    );

    const result: RequestLogEntry = {
        id: Id,
        ...entry,
        createdAt: CreatedAt
    };
    emitLogEvent(result);
    return result;
}

export interface LogEvent {
    type: "request.completed";
    log: RequestLogEntry;
}

type LogEventSink = (event: LogEvent) => void;

const logSubscribers = new Set<LogEventSink>();

export function SubscribeLogEvents(sink: LogEventSink): () => void {
    logSubscribers.add(sink);
    return () => {
        logSubscribers.delete(sink);
    };
}

function emitLogEvent(entry: RequestLogEntry): void {
    for (const sink of logSubscribers) {
        try {
            sink({ type: "request.completed", log: entry });
        } catch {
            logSubscribers.delete(sink);
        }
    }
}

export function getRecentLogsDB(limit = 50): RequestLogEntry[] {
    const Query = db.prepare("SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?");
    const Rows = Query.all(limit) as unknown as RequestLogRow[];

    return Rows.map(mapLogRow);
}

function mapUsageSummaryRow(Result: UsageSummaryRow | undefined): UsageSummary {
    return {
        totalRequests: num(Result?.totalRequests),
        totalTokens: num(Result?.totalTokens),
        totalPromptTokens: num(Result?.totalPromptTokens),
        totalCompletionTokens: num(Result?.totalCompletionTokens),
        totalCachedTokens: num(Result?.totalCachedTokens),
        totalCacheCreationTokens: num(Result?.totalCacheCreationTokens),
        totalReasoningTokens: num(Result?.totalReasoningTokens),
        totalEstimatedCost: num(Result?.totalEstimatedCost),
        totalInputTokens: num(Result?.totalPromptTokens),
        totalOutputTokens: num(Result?.totalCompletionTokens)
    };
}

export function getUsageSummaryDB(): UsageSummary {
    const Query = db.prepare(`
        SELECT
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
            COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(cache_creation_tokens), 0) as totalCacheCreationTokens,
            COALESCE(SUM(reasoning_tokens), 0) as totalReasoningTokens,
            COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
        FROM request_logs
    `);

    return mapUsageSummaryRow(Query.get() as unknown as UsageSummaryRow | undefined);
}

export function getProviderUsageSummaryDB(providerId: string): UsageSummary {
    const Query = db.prepare(`
        SELECT
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
            COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(cache_creation_tokens), 0) as totalCacheCreationTokens,
            COALESCE(SUM(reasoning_tokens), 0) as totalReasoningTokens,
            COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
        FROM request_logs
        WHERE provider_id = ?
    `);

    return mapUsageSummaryRow(Query.get(providerId) as unknown as UsageSummaryRow | undefined);
}

export function getProviderModelUsageDB(providerId: string): ModelUsageSummaryRow[] {
    const Query = db.prepare(`
        SELECT
            model,
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as promptTokens,
            COALESCE(SUM(completion_tokens), 0) as completionTokens,
            COALESCE(SUM(cached_tokens), 0) as cachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estimatedCost,
            MAX(created_at) as lastUsedAt
        FROM request_logs
        WHERE provider_id = ?
        GROUP BY model
        ORDER BY lastUsedAt DESC
    `);

    const Rows = Query.all(providerId) as unknown as ModelUsageDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalTokens: row.totalTokens,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        cachedTokens: row.cachedTokens,
        estimatedCost: row.estimatedCost,
        lastUsedAt: row.lastUsedAt
    }));
}

export function getSavingsSummaryDB(freeProviders: string[]): { freeRequests: number; freeTokens: number; savedCost: number } {
    if (!freeProviders.length) return { freeRequests: 0, freeTokens: 0, savedCost: 0 };
    const placeholders = freeProviders.map(() => "?").join(", ");
    const Query = db.prepare(`
        SELECT
            COUNT(*) as freeRequests,
            COALESCE(SUM(total_tokens), 0) as freeTokens,
            COALESCE(SUM(estimated_cost), 0) as savedCost
        FROM request_logs
        WHERE status_code = 200 AND provider_id IN (${placeholders})
    `);
    const Result = Query.get(...freeProviders) as unknown as
        | { freeRequests: number; freeTokens: number; savedCost: number }
        | undefined;
    return {
        freeRequests: num(Result?.freeRequests),
        freeTokens: num(Result?.freeTokens),
        savedCost: num(Result?.savedCost)
    };
}

export function getUsageByModelDB(): UsageByModelRow[] {
    const Query = db.prepare(`
        SELECT
            model,
            COUNT(*) as totalRequests,
            COALESCE(SUM(prompt_tokens), 0) as totalInputTokens,
            COALESCE(SUM(completion_tokens), 0) as totalOutputTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estCost
        FROM request_logs
        GROUP BY model
        ORDER BY totalRequests DESC
    `);

    const Rows = Query.all() as unknown as UsageByModelDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalInputTokens: row.totalInputTokens,
        totalOutputTokens: row.totalOutputTokens,
        totalCachedTokens: row.totalCachedTokens,
        estCost: row.estCost
    }));
}

export function deleteLogsByModelDB(model: string): void {
    const Query = db.prepare("DELETE FROM request_logs WHERE model = ?");
    Query.run(model);
}

export function deleteLogsByProviderDB(providerId: string): void {
    const Query = db.prepare("DELETE FROM request_logs WHERE provider_id = ?");
    Query.run(providerId);
}

function mapLogRow(row: RequestLogRow): RequestLogEntry {
    return {
        id: str(row.id),
        apiKeyId: optStr(row.api_key_id),
        providerId: str(row.provider_id),
        model: str(row.model),
        promptTokens: num(row.prompt_tokens),
        completionTokens: num(row.completion_tokens),
        totalTokens: num(row.total_tokens),
        statusCode: num(row.status_code),
        latencyMs: num(row.latency_ms),
        cachedTokens: num(row.cached_tokens),
        cacheCreationTokens: num(row.cache_creation_tokens),
        reasoningTokens: num(row.reasoning_tokens),
        estimatedCost: num(row.estimated_cost),
        fallbackOccurred: Boolean(row.fallback_occurred),
        fallbackPath: optStr(row.fallback_path),
        fallbackReason: optStr(row.fallback_reason),
        resolvedModel: optStr(row.resolved_model),
        promptHash: optStr(row.prompt_hash),
        retried: Boolean(row.retried),
        explicitFeedback: optStr(row.explicit_feedback),
        createdAt: num(row.created_at)
    };
}

export interface AnalyticsPoint {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    cachedTokens: number;
}

export function getAnalyticsTimeseriesDB(days = 14): AnalyticsPoint[] {
    const rows = db
        .prepare(
            `
        SELECT date(created_at / 1000, 'unixepoch') AS date,
               COUNT(*) AS requests,
               COALESCE(SUM(total_tokens), 0) AS tokens,
               COALESCE(SUM(estimated_cost), 0) AS cost,
               COALESCE(SUM(cached_tokens), 0) AS cachedTokens
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY date
        ORDER BY date ASC
    `
        )
        .all(Date.now() - days * 24 * 60 * 60 * 1000) as unknown as Array<{
        date: string;
        requests: number;
        tokens: number;
        cost: number;
        cachedTokens: number;
    }>;

    return rows.map((row) => ({
        date: row.date,
        requests: num(row.requests),
        tokens: num(row.tokens),
        cost: num(row.cost),
        cachedTokens: num(row.cachedTokens)
    }));
}

export interface TopClientRow {
    apiKeyId: string;
    name: string | null;
    requests: number;
    tokens: number;
    cost: number;
}

export function getTopClientsDB(limit = 5): TopClientRow[] {
    const rows = db
        .prepare(
            `
        SELECT l.api_key_id AS apiKeyId,
               k.name AS name,
               COUNT(*) AS requests,
               COALESCE(SUM(l.total_tokens), 0) AS tokens,
               COALESCE(SUM(l.estimated_cost), 0) AS cost
        FROM request_logs l
        LEFT JOIN api_keys k ON k.id = l.api_key_id
        WHERE l.api_key_id IS NOT NULL
        GROUP BY l.api_key_id
        ORDER BY requests DESC
        LIMIT ?
    `
        )
        .all(limit) as unknown as Array<{
        apiKeyId: string;
        name: string | null;
        requests: number;
        tokens: number;
        cost: number;
    }>;

    return rows.map((row) => ({
        apiKeyId: row.apiKeyId,
        name: row.name ?? null,
        requests: num(row.requests),
        tokens: num(row.tokens),
        cost: num(row.cost)
    }));
}

export function getErrorRateTodayDB(): { requests: number; errors: number; errorRate: number } {
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const row = db
        .prepare(
            `
        SELECT COUNT(*) AS requests,
               COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0) AS errors
        FROM request_logs
        WHERE created_at >= ?
    `
        )
        .get(startOfDay) as unknown as { requests: number; errors: number } | undefined;
    const requests = num(row?.requests);
    const errors = num(row?.errors);
    return { requests, errors, errorRate: requests > 0 ? errors / requests : 0 };
}

export function markLogRetriedDB(logId: string): void {
    db.prepare("UPDATE request_logs SET retried = 1 WHERE id = ?").run(logId);
}

export function setLogFeedbackDB(logId: string, feedback: string): void {
    db.prepare("UPDATE request_logs SET explicit_feedback = ? WHERE id = ?").run(feedback, logId);
}

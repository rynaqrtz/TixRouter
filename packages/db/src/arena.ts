import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export interface ArenaTrialInput {
    sourceModel: string;
    candidateModel: string;
    judgeModel: string;
    promptHash: string;
    verdict: "pass" | "fail" | "unknown" | "error";
    latencyMs: number;
    candidateCost?: number;
}

export function recordArenaTrialDB(Input: ArenaTrialInput): void {
    db.prepare(
        `INSERT INTO arena_trials
            (id, created_at, source_model, candidate_model, judge_model, prompt_hash, verdict, latency_ms, candidate_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        randomUUID(),
        Date.now(),
        Input.sourceModel,
        Input.candidateModel,
        Input.judgeModel,
        Input.promptHash,
        Input.verdict,
        Input.latencyMs,
        Input.candidateCost ?? null
    );
}

export interface ArenaStatsRow {
    candidate_model: string;
    trials: number;
    wins: number;
    win_rate: number;
    avg_latency_ms: number;
    total_cost: number;
}

export function getArenaStatsDB(): ArenaStatsRow[] {
    return db
        .prepare(
            `SELECT candidate_model,
                    COUNT(*) AS trials,
                    SUM(CASE WHEN verdict = 'pass' THEN 1 ELSE 0 END) AS wins,
                    ROUND(AVG(CASE WHEN verdict = 'pass' THEN 1.0 ELSE 0.0 END) * 100, 1) AS win_rate,
                    ROUND(AVG(latency_ms), 0) AS avg_latency_ms,
                    ROUND(COALESCE(SUM(candidate_cost), 0), 6) AS total_cost
             FROM arena_trials
             GROUP BY candidate_model
             ORDER BY win_rate DESC, trials DESC`
        )
        .all() as unknown as ArenaStatsRow[];
}

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    db,
    FindRecentFailureDB,
    GetCacheAffinityEnabled,
    GetOutcomeFeedbackEnabled,
    getSettingDB,
    logRequestDB,
    markLogRetriedDB,
    ModelCacheAffinityDB,
    ModelOutcomeStatsDB,
    ReorderCandidatesByOutcome,
    ReorderProvidersByAffinity,
    setLogFeedbackDB,
    setSettingDB
} from "@tixrouter/db";

function SeedLog(model: string, statusCode: number, opts?: { apiKeyId?: string; promptHash?: string; cachedTokens?: number; providerId?: string }): void {
    logRequestDB({
        providerId: opts?.providerId ?? "p1",
        model,
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        statusCode,
        latencyMs: 100,
        cachedTokens: opts?.cachedTokens,
        apiKeyId: opts?.apiKeyId,
        promptHash: opts?.promptHash
    });
}

afterEach(() => {
    db.exec("DELETE FROM request_logs");
    setSettingDB("outcome_routing_enabled", "true");
    setSettingDB("cache_affinity_enabled", "true");
});

test("ModelOutcomeStatsDB scores a perfect model above a failing one", () => {
    for (let i = 0; i < 10; i++) SeedLog("good/model", 200);
    for (let i = 0; i < 10; i++) SeedLog("bad/model", 500);

    const stats = ModelOutcomeStatsDB();
    const good = stats.find((s) => s.model === "good/model")!;
    const bad = stats.find((s) => s.model === "bad/model")!;
    assert.ok(good.score > 0.7);
    assert.ok(bad.score < 0.1);
});

test("ReorderCandidatesByOutcome promotes the proven model", () => {
    for (let i = 0; i < 10; i++) SeedLog("fallback/model", 200);
    for (let i = 0; i < 10; i++) SeedLog("primary/model", 500);

    const reordered = ReorderCandidatesByOutcome(
        [{ model: "primary/model" }, { model: "fallback/model" }],
        ModelOutcomeStatsDB()
    );
    assert.equal(reordered[0]!.model, "fallback/model");
});

test("ReorderCandidatesByOutcome keeps order for unknown models", () => {
    const candidates = [{ model: "a/x" }, { model: "b/y" }];
    const reordered = ReorderCandidatesByOutcome(candidates, []);
    assert.deepEqual(reordered, candidates);
});

test("Outcome and affinity toggles default on and respect kill-switch", () => {
    assert.equal(GetOutcomeFeedbackEnabled(), true);
    assert.equal(GetCacheAffinityEnabled(), true);
    setSettingDB("outcome_routing_enabled", "false");
    setSettingDB("cache_affinity_enabled", "false");
    assert.equal(GetOutcomeFeedbackEnabled(), false);
    assert.equal(GetCacheAffinityEnabled(), false);
});

test("ReorderProvidersByAffinity puts cache-hit provider first", () => {
    SeedLog("aff/model", 200, { providerId: "prov-b", cachedTokens: 500 });
    SeedLog("aff/model", 200, { providerId: "prov-b", cachedTokens: 300 });

    const reordered = ReorderProvidersByAffinity(
        [{ id: "prov-a" }, { id: "prov-b" }],
        "aff/model"
    );
    assert.equal(reordered[0]!.id, "prov-b");
});

test("ModelCacheAffinityDB aggregates cache hits per provider", () => {
    SeedLog("aff2/model", 200, { providerId: "prov-a", cachedTokens: 0 });
    SeedLog("aff2/model", 200, { providerId: "prov-b", cachedTokens: 100 });

    const rows = ModelCacheAffinityDB("aff2/model");
    assert.equal(rows.length, 2);
    const b = rows.find((r) => r.providerId === "prov-b")!;
    assert.equal(b.cacheHits, 1);
    assert.equal(b.cachedTokens, 100);
});

test("retry detection marks the failed log and FindRecentFailureDB finds it", () => {
    SeedLog("r/model", 500, { apiKeyId: "key-1", promptHash: "hash-x" });
    const failureId = FindRecentFailureDB("key-1", "hash-x", 10 * 60_000);
    assert.ok(failureId);
    markLogRetriedDB(failureId!);
    setLogFeedbackDB(failureId!, "bad");
    const logs = db.prepare("SELECT retried, explicit_feedback FROM request_logs WHERE id = ?").get(failureId) as { retried: number; explicit_feedback: string };
    assert.equal(logs.retried, 1);
    assert.equal(logs.explicit_feedback, "bad");
});

test("FindRecentFailureDB ignores other keys and stale failures", () => {
    SeedLog("r/model", 500, { apiKeyId: "key-1", promptHash: "hash-y" });
    assert.equal(FindRecentFailureDB("key-2", "hash-y", 10 * 60_000), null);
    assert.equal(FindRecentFailureDB("key-1", "hash-z", 10 * 60_000), null);
    assert.equal(FindRecentFailureDB("key-1", "hash-y", -1), null);
});

test("analytics and top clients aggregate from logs", async () => {
    const { getAnalyticsTimeseriesDB, getTopClientsDB, getErrorRateTodayDB } = await import("@tixrouter/db");
    SeedLog("m1", 200, { apiKeyId: "key-9" });
    SeedLog("m1", 500, { apiKeyId: "key-9" });

    const series = getAnalyticsTimeseriesDB(1);
    assert.equal(series.length, 1);
    assert.equal(series[0]!.requests, 2);
    assert.equal(series[0]!.tokens, 30);

    const clients = getTopClientsDB();
    assert.equal(clients.length, 1);
    assert.equal(clients[0]!.requests, 2);

    const err = getErrorRateTodayDB();
    assert.equal(err.requests, 2);
    assert.equal(err.errors, 1);
    assert.ok(Math.abs(err.errorRate - 0.5) < 1e-9);
});

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    ConsumeAPIKeyRPMDB,
    ResetAPIKeyAlertStateDB,
    NotifyBudgetThresholds,
    SubscribeLogEvents,
    createAPIKeyDB,
    db,
    getAPIKeyAlertStateDB,
    getCacheTtlMsDB,
    GetCacheModeDB,
    incrementAPIKeyUsageDB,
    logRequestDB,
    setAPIKeyAlertStateDB,
    setBudgetAlertSink,
    setSettingDB
} from "@tixrouter/db";
import { getModelPricingForList } from "@tixrouter/pricing";

const createdKeyIds: string[] = [];

function CreateKey(name: string, opts?: { rateLimit?: number; creditLimit?: number; quotaLimit?: number }) {
    const key = createAPIKeyDB({
        name,
        rate_limit: opts?.rateLimit ?? 0,
        credit_limit: opts?.creditLimit ?? 0,
        quota_limit: opts?.quotaLimit ?? 0
    });
    createdKeyIds.push(key.id);
    return key;
}

afterEach(() => {
    for (const id of createdKeyIds) {
        db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
    }
    createdKeyIds.length = 0;
    db.exec("DELETE FROM request_logs");
    setSettingDB("cache_mode", "");
    setSettingDB("cache_ttl_seconds", "");
    setBudgetAlertSink(() => undefined);
});

test("cache mode setting parses exact/fuzzy with safe default", () => {
    setSettingDB("cache_mode", "");
    assert.equal(GetCacheModeDB(), "exact");
    setSettingDB("cache_mode", "fuzzy");
    assert.equal(GetCacheModeDB(), "fuzzy");
    setSettingDB("cache_mode", "banana");
    assert.equal(GetCacheModeDB(), "exact");
});

test("cache ttl setting converts seconds to ms with default fallback", () => {
    assert.equal(getCacheTtlMsDB(60_000), 60_000);
    setSettingDB("cache_ttl_seconds", "120");
    assert.equal(getCacheTtlMsDB(60_000), 120_000);
    setSettingDB("cache_ttl_seconds", "-5");
    assert.equal(getCacheTtlMsDB(60_000), 60_000);
});

test("RPM sliding window blocks keys over limit and resets next minute", () => {
    const key = CreateKey("rpm-test", { rateLimit: 2 });

    const first = ConsumeAPIKeyRPMDB(key.id, 2);
    assert.equal(first.allowed, true);
    const second = ConsumeAPIKeyRPMDB(key.id, 2);
    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 0);

    const third = ConsumeAPIKeyRPMDB(key.id, 2);
    assert.equal(third.allowed, false);
    assert.ok(third.retryAfterSec > 0 && third.retryAfterSec <= 60);

    const nextWindow = ConsumeAPIKeyRPMDB(key.id, 2, Date.now() + 61_000);
    assert.equal(nextWindow.allowed, true);
});

test("budget alert state latches and resets per kind", () => {
    const key = CreateKey("alert-state-test");
    assert.deepEqual(getAPIKeyAlertStateDB(key.id), { credit: false, quota: false });

    setAPIKeyAlertStateDB(key.id, "credit", true);
    assert.equal(getAPIKeyAlertStateDB(key.id).credit, true);
    assert.equal(getAPIKeyAlertStateDB(key.id).quota, false);

    ResetAPIKeyAlertStateDB(key.id);
    assert.deepEqual(getAPIKeyAlertStateDB(key.id), { credit: false, quota: false });
});

test("NotifyBudgetThresholds fires the sink once per cooldown when over credit", () => {
    const key = CreateKey("budget-test", { creditLimit: 1 });
    incrementAPIKeyUsageDB(key.id, 10, 5);

    let calls = 0;
    let seenKind = "";
    setBudgetAlertSink((_id, kind) => {
        calls++;
        seenKind = kind;
    });

    NotifyBudgetThresholds(key.id);
    NotifyBudgetThresholds(key.id);
    assert.equal(calls, 1);
    assert.equal(seenKind, "credit");

    const poor = CreateKey("budget-untouched", { creditLimit: 100 });
    NotifyBudgetThresholds(poor.id);
    assert.equal(calls, 1);
});

test("log event subscribers receive completed requests until unsubscribed", () => {
    const events: string[] = [];
    const unsubscribe = SubscribeLogEvents((event) => events.push(event.log.id));

    const entry = logRequestDB({
        providerId: "p-test",
        model: "m-test",
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        statusCode: 200,
        latencyMs: 5
    });

    unsubscribe();
    logRequestDB({
        providerId: "p-test",
        model: "m-test",
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        statusCode: 200,
        latencyMs: 5
    });

    assert.deepEqual(events, [entry.id]);
});

test("model pricing enrichment returns free-zero for free models and undefined for unknown", () => {
    const free = getModelPricingForList("openrouter/some-model:free");
    assert.ok(free);
    assert.equal(free.input, 0);
    assert.equal(free.output, 0);

    const unknown = getModelPricingForList("definitely/not-a-real-model-xyz");
    assert.equal(unknown, undefined);
});

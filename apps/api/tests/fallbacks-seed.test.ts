import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
    deleteFallbackRuleDB,
    findMatchingFallbackRulesDB,
    getFallbackRuleByIdDB,
    getSettingDB,
    setSettingDB
} from "@tixrouter/db";
import { seedDefaultFallbacks } from "../src/services/registry.js";

const SEED_IDS = [
    "fb-seed-dsfree-mfree",
    "fb-seed-dsfree-zen",
    "fb-seed-mfree-dsfree",
    "fb-seed-mfree-zen",
    "fb-seed-zen-dsfree",
    "fb-seed-zen-mfree"
];

test("seedDefaultFallbacks creates the free-tier chain once and is idempotent", () => {
    seedDefaultFallbacks();
    for (const id of SEED_IDS) {
        assert.ok(getFallbackRuleByIdDB(id), `seed rule ${id} should exist`);
    }
    seedDefaultFallbacks();
    const dsfreeRules = findMatchingFallbackRulesDB("dsfree/deepseek-v3").filter((r) =>
        SEED_IDS.includes(r.id)
    );
    assert.equal(dsfreeRules.length, 2, "seeding twice must not duplicate rules");
});

test("seeded rules order mfree before zen for dsfree sources", () => {
    seedDefaultFallbacks();
    const targets = findMatchingFallbackRulesDB("dsfree/deepseek-v3").map((r) => r.targetModel);
    assert.ok(targets.includes("mfree/mistral-large"));
    assert.ok(targets.includes("zen/big-pickle"));
    assert.ok(targets.indexOf("mfree/mistral-large") < targets.indexOf("zen/big-pickle"));
});

test("seeded rules trigger on free-tier failure statuses", () => {
    seedDefaultFallbacks();
    const rule = getFallbackRuleByIdDB("fb-seed-dsfree-mfree");
    assert.ok(rule);
    assert.deepEqual(rule.triggerOnStatus, [429, 401, 403, 500, 502, 503, 504]);
});

test("free_tier_failover_enabled toggle drives seed rules on boot", () => {
    const original = getSettingDB("free_tier_failover_enabled", "true");
    try {
        setSettingDB("free_tier_failover_enabled", "false");
        seedDefaultFallbacks();
        assert.equal(getFallbackRuleByIdDB("fb-seed-zen-mfree")?.enabled, false);

        setSettingDB("free_tier_failover_enabled", "true");
        seedDefaultFallbacks();
        assert.equal(getFallbackRuleByIdDB("fb-seed-zen-mfree")?.enabled, true);
    } finally {
        setSettingDB("free_tier_failover_enabled", original);
    }
});

after(() => {
    for (const id of SEED_IDS) {
        deleteFallbackRuleDB(id);
    }
});

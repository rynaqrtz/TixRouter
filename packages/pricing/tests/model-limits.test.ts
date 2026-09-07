import assert from "node:assert/strict";
import test from "node:test";
import { getModelLimits } from "../src/index.js";

test("getModelLimits returns context/output limits from models.dev data", () => {
    const limits = getModelLimits("tencent/hy3");
    assert.equal(limits.context_window, 256000);
    assert.equal(limits.max_output_tokens, 64000);
});

test("getModelLimits falls back to bare model id and returns empty for unknown models", () => {
    assert.deepEqual(getModelLimits("definitely/not-a-real-model-xyz"), {});
    assert.deepEqual(getModelLimits(""), {});
});

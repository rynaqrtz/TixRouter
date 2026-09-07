import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatCompletionRequest, ChatCompletionResponse } from "@tixrouter/types";
import { setSettingDB, getSettingDB } from "@tixrouter/db";
import { getCachedResponse, setCachedResponse } from "../src/services/responseCache.js";

function req(content: string): ChatCompletionRequest {
    return { model: "dsfree/deepseek-v3", messages: [{ role: "user", content }] };
}

function res(content: string): ChatCompletionResponse {
    return {
        id: `chatcmpl-${content}`,
        object: "chat.completion",
        created: 0,
        model: "dsfree/deepseek-v3",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    };
}

test("cache stores and hits identical requests when enabled", () => {
    const original = getSettingDB("cache_enabled", "false");
    try {
        setSettingDB("cache_enabled", "true");
        setCachedResponse(req("hello"), res("hello"));
        const hit = getCachedResponse(req("hello"));
        assert.ok(hit);
        assert.equal(hit.choices[0]?.message.content, "hello");
        assert.equal(getCachedResponse(req("different")), undefined);
    } finally {
        setSettingDB("cache_enabled", original);
    }
});

test("cache is bypassed when disabled and respects different models/tools", () => {
    const original = getSettingDB("cache_enabled", "false");
    try {
        setSettingDB("cache_enabled", "false");
        setCachedResponse(req("hello"), res("hello"));
        assert.equal(getCachedResponse(req("hello")), undefined);

        setSettingDB("cache_enabled", "true");
        const withTools: ChatCompletionRequest = {
            ...req("hello"),
            tools: [{ type: "function", function: { name: "f", parameters: {} } }]
        };
        setCachedResponse(withTools, res("toolreply"));
        assert.equal(getCachedResponse(req("hello"))?.choices[0]?.message.content, "hello");
        assert.equal(getCachedResponse(withTools)?.choices[0]?.message.content, "toolreply");
    } finally {
        setSettingDB("cache_enabled", original);
    }
});

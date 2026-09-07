import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatCompletionChunk, ProviderConfig } from "@tixrouter/types";
import { MistralFreeExecutor, applyMistralPatch } from "@tixrouter/executors";
import { upsertProviderDB } from "@tixrouter/db";
import { loadSavedProvidersFromDB, registry } from "../src/services/registry.js";

class FixtureExecutor extends MistralFreeExecutor {
    private lines: string[];
    constructor(lines: string[]) {
        super();
        this.lines = lines;
    }
    protected override async *startStream(): AsyncGenerator<string, void, void> {
        for (const line of this.lines) yield line;
    }
}

function patchFrame(text: string): string {
    return `15:${JSON.stringify({
        json: {
            type: "message",
            messageId: "m1",
            messageVersion: 0,
            patches: [{ op: "replace", path: "/contentChunks", value: [{ type: "text", text, _context: null }] }]
        }
    })}`;
}

test("applyMistralPatch handles full-array contentChunks replace", () => {
    assert.equal(applyMistralPatch({ op: "replace", path: "/contentChunks", value: [{ text: "OK" }] }), "OK");
    assert.equal(applyMistralPatch({ op: "replace", path: "/contentChunks", value: [{ text: "a" }, { text: "b" }] }), "ab");
});

test("applyMistralPatch handles legacy indexed chunk replace", () => {
    assert.equal(applyMistralPatch({ op: "replace", path: "/contentChunks/0/text", value: "OK!" }), "OK!");
});

test("applyMistralPatch ignores non-content patches", () => {
    assert.equal(applyMistralPatch({ op: "append", path: "/contentChunks/0/text", value: "x" }), null);
    assert.equal(applyMistralPatch({ op: "replace", path: "/generationStatus", value: "success" }), null);
    assert.equal(applyMistralPatch({ op: "replace", path: "/", value: {} }), null);
    assert.equal(applyMistralPatch({ op: "replace", path: "/contentChunks", value: [] }), null);
});

test("stream emits role, content chunks, stop with usage", async () => {
    const exec = new FixtureExecutor([patchFrame("Hello"), patchFrame(" world")]);
    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of exec.chatCompletionStream({
        model: "mfree/mistral-large",
        messages: [{ role: "user", content: "hi" }]
    })) {
        chunks.push(chunk);
    }
    assert.equal(chunks[0]?.choices[0]?.delta.role, "assistant");
    const content = chunks
        .map((c) => c.choices[0]?.delta.content)
        .filter((v): v is string => typeof v === "string")
        .join("");
    assert.equal(content, "Hello world");
    const last = chunks[chunks.length - 1]!;
    assert.equal(last.choices[0]?.finish_reason, "stop");
    assert.ok((last.usage?.total_tokens ?? 0) > 0);
});

test("non-stream aggregates patch stream into one message", async () => {
    const exec = new FixtureExecutor([patchFrame("4")]);
    const res = await exec.chatCompletion({
        model: "mfree/mistral-large",
        messages: [{ role: "user", content: "2+2" }]
    });
    assert.equal(res.choices[0]?.message.content, "4");
});

test("registry wires mistral-free connections without credentials", () => {
    const id = `mistral-free_test_${Date.now()}`;
    const config: ProviderConfig = {
        id,
        providerId: "mistral-free",
        name: "Mistral Free Test",
        category: "free_tier",
        protocol: "openai",
        enabled: true,
        createdAt: Date.now()
    };
    upsertProviderDB(config);
    loadSavedProvidersFromDB();
    const provider = registry.getProvider(id);
    assert.ok(provider, "executor should be registered for mistral-free connection");
    assert.equal(provider.name, "Mistral Free Test");
});

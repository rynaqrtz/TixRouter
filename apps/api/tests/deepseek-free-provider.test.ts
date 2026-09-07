import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import type { ProviderConfig } from "@tixrouter/types";
import { DeepSeekFreeExecutor, DeepSeekFreePoolExecutor, imageDataUrls, normalizeModel, parseAccounts, parseDataUrl } from "@tixrouter/executors";
import { deleteProviderDB, upsertProviderDB } from "@tixrouter/db";
import { loadSavedProvidersFromDB, registry } from "../src/services/registry.js";

const createdIds: string[] = [];

class FixtureExecutor extends DeepSeekFreeExecutor {
    lastBody: Record<string, unknown> | null = null;
    constructor(lines: string[]) {
        super({ email: "user@test.local", password: "secret" });
        this.lines = lines;
    }
    private lines: string[];
    protected async startChat(): Promise<import("node:http").IncomingMessage> {
        const stream = new PassThrough();
        stream.end(this.lines.join("\n") + "\n");
        return stream as unknown as import("node:http").IncomingMessage;
    }
}

function sseFrame(v: unknown): string {
    return `data: ${JSON.stringify(v)}`;
}

test("parseDataUrl accepts base64 and rejects remote urls", () => {
    const ok = parseDataUrl("data:image/png;base64,aGVsbG8=");
    assert.ok(ok);
    assert.equal(ok.mime, "image/png");
    assert.equal(ok.buffer.toString("utf8"), "hello");
    assert.equal(parseDataUrl("https://example.com/a.png"), null);
    assert.equal(parseDataUrl("data:image/svg+xml,%3Csvg%3E"), null);
});

test("imageDataUrls extracts only image_url parts", () => {
    const urls = imageDataUrls({
        model: "dsfree/deepseek-v3",
        messages: [
            { role: "user", content: [{ type: "text", text: "what is this" }, { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } }] },
            { role: "assistant", content: "a cat" }
        ]
    });
    assert.deepEqual(urls, ["data:image/png;base64,aGVsbG8="]);
});

test("normalizeModel routes v3, r1, and v4 variants", () => {
    assert.equal(normalizeModel("dsfree/deepseek-v3"), "deepseek-v3");
    assert.equal(normalizeModel("dsfree/deepseek-r1"), "deepseek-r1");
    assert.equal(normalizeModel("deepseek-reasoner"), "deepseek-r1");
    assert.equal(normalizeModel("deepseek-chat"), "deepseek-v3");
    assert.equal(normalizeModel("dsfree/deepseek-v4-flash"), "deepseek-v4-flash");
    assert.equal(normalizeModel("dsfree/deepseek-v4-pro"), "deepseek-v4-pro");
    assert.equal(normalizeModel("deepseek-v4"), "deepseek-v4-flash");
});

test("listModels exposes all four dsfree models", async () => {
    const exec = new FixtureExecutor([]);
    const models = await exec.listModels();
    assert.deepEqual(
        models.map((m) => m.id),
        ["dsfree/deepseek-v3", "dsfree/deepseek-r1", "dsfree/deepseek-v4-flash", "dsfree/deepseek-v4-pro"]
    );
});

test("registry wires deepseek-free connections from email:password api key", () => {
    const id = `deepseek-free_test_${Date.now()}`;
    createdIds.push(id);
    const config: ProviderConfig = {
        id,
        providerId: "deepseek-free",
        name: "TixRouter Free Test",
        category: "free_tier",
        protocol: "openai",
        apiKey: "user@test.local:secret",
        enabled: true,
        createdAt: Date.now()
    };
    upsertProviderDB(config);
    loadSavedProvidersFromDB();
    const provider = registry.getProvider(id);
    assert.ok(provider, "executor should be registered for deepseek-free connection");
    assert.equal(provider.name, "TixRouter Free Test");
});

test("stream yields reasoning_content then content for r1", async () => {
    const exec = new FixtureExecutor([
        sseFrame({ p: "/message/content/thinking", v: "think step" }),
        sseFrame({ p: "/message/content/thinking", v: " more" }),
        sseFrame({ p: "/message/content/parts/0", v: "final answer" }),
        "data: [DONE]"
    ]);
    const chunks = [];
    for await (const chunk of exec.chatCompletionStream({
        model: "dsfree/deepseek-r1",
        messages: [{ role: "user", content: "q" }]
    })) {
        chunks.push(chunk);
    }
    const reasoning = chunks
        .map((c) => c.choices[0]?.delta.reasoning_content)
        .filter((v): v is string => typeof v === "string");
    const content = chunks
        .map((c) => c.choices[0]?.delta.content)
        .filter((v): v is string => typeof v === "string");
    assert.deepEqual(reasoning.join(""), "think step more");
    assert.equal(content.join(""), "final answer");
    const last = chunks[chunks.length - 1]!;
    assert.equal(last.choices[0]?.finish_reason, "stop");
    assert.ok((last.usage?.total_tokens ?? 0) > 0);
});

test("non-stream returns reasoning_content for r1 thinking frames", async () => {
    const exec = new FixtureExecutor([
        sseFrame({ p: "/message/content/thinking", v: "step" }),
        sseFrame({ p: "/message/content/parts/0", v: "answer" })
    ]);
    const res = await exec.chatCompletion({
        model: "dsfree/deepseek-r1",
        messages: [{ role: "user", content: "q" }]
    });
    assert.equal(res.choices[0]?.message.reasoning_content, "step");
    assert.equal(res.choices[0]?.message.content, "answer");
});

test("non-stream aggregates fragments into one message", async () => {
    const exec = new FixtureExecutor([
        sseFrame({ v: { response: { fragments: [{ type: "RESPONSE", content: "hello " }] } } }),
        sseFrame({ v: { response: { fragments: [{ type: "RESPONSE", content: "world" }] } } })
    ]);
    const res = await exec.chatCompletion({
        model: "dsfree/deepseek-v3",
        messages: [{ role: "user", content: "q" }]
    });
    assert.equal(res.choices[0]?.message.content, "hello world");
    assert.equal(res.choices[0]?.message.reasoning_content, undefined);
});

test("parseAccounts splits entries and preserves colons in passwords", () => {
    const accounts = parseAccounts("a@x.com:pw1 ; b@x.com:pw:2\nc@x.com:pw3");
    assert.deepEqual(accounts, [
        { email: "a@x.com", password: "pw1" },
        { email: "b@x.com", password: "pw:2" },
        { email: "c@x.com", password: "pw3" }
    ]);
    assert.deepEqual(parseAccounts(""), []);
    assert.deepEqual(parseAccounts("noseparator"), []);
});

function poolResponse(content: string): ChatCompletionResponse {
    return {
        id: `chatcmpl-${content}`,
        object: "chat.completion",
        created: 0,
        model: "dsfree/deepseek-v3",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    };
}

class ScriptedExecutor extends DeepSeekFreeExecutor {
    constructor(private behavior: () => Promise<ChatCompletionResponse>) {
        super({ email: "x@y.z", password: "p" });
    }
    override async chatCompletion(): Promise<ChatCompletionResponse> {
        return this.behavior();
    }
}

test("pool rotates to next account on rate limit and sticks while cooled", async () => {
    let calls = 0;
    const pool = new DeepSeekFreePoolExecutor({
        accounts: [
            { email: "a@x.com", password: "p1" },
            { email: "b@x.com", password: "p2" }
        ],
        executorFactory: ({ email }) =>
            new ScriptedExecutor(async () => {
                if (email === "a@x.com") throw new Error("HTTP 429: rate limited");
                calls += 1;
                return poolResponse(`ok${calls}`);
            })
    });
    const first = await pool.chatCompletion({ model: "dsfree/deepseek-v3", messages: [{ role: "user", content: "q" }] });
    assert.equal(first.choices[0]?.message.content, "ok1");
    const second = await pool.chatCompletion({ model: "dsfree/deepseek-v3", messages: [{ role: "user", content: "q" }] });
    assert.equal(second.choices[0]?.message.content, "ok2");
});

test("pool throws with retry hint when all accounts are cooling down", async () => {
    const pool = new DeepSeekFreePoolExecutor({
        accounts: [{ email: "a@x.com", password: "p1" }],
        executorFactory: () =>
            new ScriptedExecutor(async () => {
                throw new Error("HTTP 429: rate limited");
            })
    });
    await assert.rejects(
        pool.chatCompletion({ model: "dsfree/deepseek-v3", messages: [{ role: "user", content: "q" }] }),
        /HTTP 429/
    );
    await assert.rejects(
        pool.chatCompletion({ model: "dsfree/deepseek-v3", messages: [{ role: "user", content: "q" }] }),
        /cooling down/
    );
});

test("pool stream rotates on start failure then delegates the rest", async () => {
    let started = 0;
    function* failingStream(): AsyncGenerator<ChatCompletionChunk, void, void> {
        started += 1;
        throw new Error("HTTP 401: unauthorized");
    }
    function* workingStream(): AsyncGenerator<ChatCompletionChunk, void, void> {
        started += 1;
        yield { id: "c", object: "chat.completion.chunk", created: 0, model: "dsfree/deepseek-v3", choices: [{ index: 0, delta: { content: "hi" }, finish_reason: null }] };
        yield { id: "c", object: "chat.completion.chunk", created: 0, model: "dsfree/deepseek-v3", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
    }
    class StreamScript extends DeepSeekFreeExecutor {
        constructor(private gen: () => AsyncGenerator<ChatCompletionChunk, void, void>) {
            super({ email: "x@y.z", password: "p" });
        }
        override async *chatCompletionStream(): AsyncGenerator<ChatCompletionChunk, void, void> {
            yield* this.gen();
        }
    }
    const pool = new DeepSeekFreePoolExecutor({
        accounts: [
            { email: "a@x.com", password: "p1" },
            { email: "b@x.com", password: "p2" }
        ],
        executorFactory: ({ email }) => new StreamScript(email === "a@x.com" ? failingStream : workingStream)
    });
    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of pool.chatCompletionStream({ model: "dsfree/deepseek-v3", messages: [{ role: "user", content: "q" }] })) {
        chunks.push(chunk);
    }
    assert.equal(started, 2);
    assert.equal(chunks[0]?.choices[0]?.delta.content, "hi");
    assert.equal(chunks[chunks.length - 1]?.choices[0]?.finish_reason, "stop");
});

test("registry wires multi-account key into a pool executor", () => {
    const id = `deepseek-free_pool_${Date.now()}`;
    createdIds.push(id);
    const config: ProviderConfig = {
        id,
        providerId: "deepseek-free",
        name: "TixRouter Free Pool",
        category: "free_tier",
        protocol: "openai",
        apiKey: "a@x.com:pw1;b@x.com:pw2",
        enabled: true,
        createdAt: Date.now()
    };
    upsertProviderDB(config);
    loadSavedProvidersFromDB();
    const provider = registry.getProvider(id);
    assert.ok(provider instanceof DeepSeekFreePoolExecutor, "multi-account key should register a pool");
});

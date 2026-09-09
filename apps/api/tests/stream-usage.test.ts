import assert from "node:assert/strict";
import { after, test } from "node:test";
import { OpenAIExecutor } from "@tixrouter/executors";
import { DEFAULT_TOKEN_SAVER_SETTINGS } from "@tixrouter/db";
import type { ChatCompletionRequest } from "@tixrouter/types";

const originalFetch = globalThis.fetch;
after(() => {
    globalThis.fetch = originalFetch;
});

function mockFetch(handler: (body: Record<string, unknown>) => Response): {
    bodies: Record<string, unknown>[];
} {
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        bodies.push(body);
        return Promise.resolve(handler(body));
    }) as typeof fetch;
    return { bodies };
}

const SSE_OK =
    'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\ndata: {"id":"1","object":"chat.completion.chunk","created":1,"model":"m","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\ndata: [DONE]\n\n';

function makeExecutor(): OpenAIExecutor {
    return new OpenAIExecutor({
        id: "test",
        name: "Test",
        baseUrl: "https://upstream.test/v1",
        apiKey: "sk-test"
    });
}

function makeRequest(): ChatCompletionRequest {
    return {
        model: "test/m",
        messages: [{ role: "user", content: "hi" }],
        stream: true
    } as unknown as ChatCompletionRequest;
}

test("streaming injects stream_options.include_usage and upstream usage reaches chunks", async () => {
    const executor = makeExecutor();
    const { bodies } = mockFetch(() => new Response(SSE_OK, { status: 200, headers: { "Content-Type": "text/event-stream" } }));

    const chunks: Array<{ usage?: { total_tokens?: number } }> = [];
    for await (const chunk of executor.chatCompletionStream(makeRequest())) {
        chunks.push(chunk as { usage?: { total_tokens?: number } });
    }

    assert.equal(bodies.length, 1);
    assert.deepEqual(bodies[0]!.stream_options, { include_usage: true });
    const usage = chunks.find((c) => c.usage)?.usage;
    assert.equal(usage?.total_tokens, 3);
});

test("streaming falls back without stream_options when upstream rejects it", async () => {
    const executor = makeExecutor();
    let call = 0;
    const { bodies } = mockFetch(() => {
        call++;
        if (call === 1) {
            return new Response(JSON.stringify({ error: { message: "stream_options is not supported" } }), { status: 400 });
        }
        return new Response(SSE_OK, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    });

    const chunks: unknown[] = [];
    for await (const chunk of executor.chatCompletionStream(makeRequest())) {
        chunks.push(chunk);
    }

    assert.equal(bodies.length, 2);
    assert.ok("stream_options" in bodies[0]!);
    assert.ok(!("stream_options" in bodies[1]!));
    assert.ok(chunks.length > 0);
});

test("token saver defaults keep tool compression on and prompt injection off", () => {
    assert.equal(DEFAULT_TOKEN_SAVER_SETTINGS.enabled, true);
    assert.equal(DEFAULT_TOKEN_SAVER_SETTINGS.compressToolOutput.enabled, true);
    assert.equal(DEFAULT_TOKEN_SAVER_SETTINGS.lazySeniorDev.enabled, false);
    assert.equal(DEFAULT_TOKEN_SAVER_SETTINGS.compressLlmOutput.enabled, false);
});

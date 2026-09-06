import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ChatCompletionRequest } from "@rynarouter/types";
import { BluesMindsExecutor } from "../src/bluesminds.js";

const originalFetch = globalThis.fetch;
const fixtureKey = "fixture-key-not-a-secret";

function executor(): BluesMindsExecutor {
    return new BluesMindsExecutor({
        id: "bluesminds",
        name: "BluesMinds",
        baseUrl: "https://api.bluesminds.com/v1",
        accessToken: fixtureKey
    });
}

function request(model: string): ChatCompletionRequest {
    return { model, messages: [{ role: "user", content: "hello" }] };
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("BluesMinds lists namespaced live models with bearer auth", async () => {
    let url = "";
    let authorized = false;
    globalThis.fetch = async (input, init) => {
        url = String(input);
        const auth = new Headers(init?.headers).get("authorization") ?? "";
        authorized = auth.startsWith("Bearer ") && auth.endsWith(fixtureKey);
        return Response.json({
            data: [{ id: "meta/llama-3.1-8b-instruct", object: "model", owned_by: "bluesminds" }]
        });
    };

    const models = await executor().listModels();
    assert.equal(url, "https://api.bluesminds.com/v1/models");
    assert.equal(authorized, true);
    assert.deepEqual(models, [
        { id: "bluesminds/meta/llama-3.1-8b-instruct", object: "model", owned_by: "bluesminds" }
    ]);
});

test("BluesMinds chat sends bare model and preserves nested upstream IDs", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json({
            id: "chat",
            object: "chat.completion",
            created: 1,
            model: "test",
            choices: []
        });
    };

    await executor().chatCompletion(request("bluesminds/meta/llama-3.1-8b-instruct"));

    assert.equal(bodies[0]?.model, "meta/llama-3.1-8b-instruct");
    assert.equal(bodies[0]?.stream, false);
});

test("BluesMinds streaming preserves tools and yields tool-call deltas", async () => {
    let body: Record<string, unknown> | undefined;
    const chunk = {
        id: "chunk",
        object: "chat.completion.chunk",
        created: 1,
        model: "meta/llama-3.1-8b-instruct",
        choices: [
            {
                index: 0,
                delta: {
                    content: "Hello world"
                },
                finish_reason: null
            }
        ]
    };
    globalThis.fetch = async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`)
                );
                controller.close();
            }
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    };

    const output = [];
    for await (const item of executor().chatCompletionStream(
        request("bluesminds/meta/llama-3.1-8b-instruct")
    )) {
        output.push(item);
    }

    assert.equal(body?.stream, true);
    assert.deepEqual(output, [chunk]);
});

test("BluesMinds upstream errors do not expose credentials", async () => {
    globalThis.fetch = async () => new Response("upstream unavailable", { status: 503 });
    await assert.rejects(
        executor().chatCompletion(request("bluesminds/meta/llama-3.1-8b-instruct")),
        (error: Error) =>
            error.message.includes("503") &&
            error.message.includes("upstream unavailable") &&
            !error.message.includes(fixtureKey)
    );
});

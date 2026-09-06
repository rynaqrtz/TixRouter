import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ChatCompletionRequest } from "@rynarouter/types";
import { SeekAIExecutor } from "../src/seekai.js";

const originalFetch = globalThis.fetch;
const fixtureKey = "fixture-key-not-a-secret";

function executor(): SeekAIExecutor {
    return new SeekAIExecutor({
        id: "seekai",
        name: "SeekAI",
        baseUrl: "https://seekai.cc/v1",
        accessToken: fixtureKey
    });
}

function request(model: string): ChatCompletionRequest {
    return { model, messages: [{ role: "user", content: "hello" }] };
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("SeekAI lists namespaced live models with bearer auth", async () => {
    let url = "";
    let authorized = false;
    globalThis.fetch = async (input, init) => {
        url = String(input);
        const auth = new Headers(init?.headers).get("authorization") ?? "";
        authorized = auth.startsWith("Bearer ") && auth.endsWith(fixtureKey);
        return Response.json({
            data: [{ id: "gpt-5-5", object: "model", owned_by: "seekai" }]
        });
    };

    const models = await executor().listModels();
    assert.equal(url, "https://seekai.cc/v1/models");
    assert.equal(authorized, true);
    assert.deepEqual(models, [{ id: "seekai/gpt-5-5", object: "model", owned_by: "seekai" }]);
});

test("SeekAI chat sends bare model and preserves nested upstream IDs", async () => {
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

    await executor().chatCompletion(request("seekai/gpt-5-5"));

    assert.equal(bodies[0]?.model, "gpt-5-5");
    assert.equal(bodies[0]?.stream, false);
});

test("SeekAI streaming preserves tools and yields tool-call deltas", async () => {
    let body: Record<string, unknown> | undefined;
    const chunk = {
        id: "chunk",
        object: "chat.completion.chunk",
        created: 1,
        model: "gpt-5-5",
        choices: [
            {
                index: 0,
                delta: {
                    content: "Hello world from SeekAI"
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
    for await (const item of executor().chatCompletionStream(request("seekai/gpt-5-5"))) {
        output.push(item);
    }

    assert.equal(body?.stream, true);
    assert.deepEqual(output, [chunk]);
});

test("SeekAI upstream errors do not expose credentials", async () => {
    globalThis.fetch = async () => new Response("upstream unavailable", { status: 503 });
    await assert.rejects(
        executor().chatCompletion(request("seekai/gpt-5-5")),
        (error: Error) =>
            error.message.includes("503") &&
            error.message.includes("upstream unavailable") &&
            !error.message.includes(fixtureKey)
    );
});

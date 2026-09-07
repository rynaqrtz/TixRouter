import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ChatCompletionRequest } from "@tixrouter/types";
import { CommandCodeExecutor } from "../src/commandcode.js";

const originalFetch = globalThis.fetch;
const fixtureKey = "user_fixture_token_12345";

function executor(options = {}): CommandCodeExecutor {
    return new CommandCodeExecutor({
        id: "commandcode",
        name: "Command Code",
        apiKey: fixtureKey,
        ...options
    });
}

function request(model: string): ChatCompletionRequest {
    return { model, messages: [{ role: "user", content: "hello" }] };
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("CommandCode lists namespaced live models directly from upstream without hardcoded models", async () => {
    let url = "";
    let authHeader = "";
    let versionHeader = "";
    let envHeader = "";

    globalThis.fetch = async (input, init) => {
        url = String(input);
        const headers = new Headers(init?.headers);
        authHeader = headers.get("authorization") ?? "";
        versionHeader = headers.get("x-command-code-version") ?? "";
        envHeader = headers.get("x-cli-environment") ?? "";
        return Response.json({
            object: "list",
            data: [
                { id: "deepseek/deepseek-v4-pro", object: "model" },
                { id: "claude-sonnet-5", object: "model" },
                { id: "moonshotai/Kimi-K3", object: "model" }
            ]
        });
    };

    const models = await executor().listModels();
    assert.equal(url, "https://api.commandcode.ai/provider/v1/models");
    assert.equal(authHeader, `Bearer ${fixtureKey}`);
    assert.equal(versionHeader, "0.25.7");
    assert.equal(envHeader, "cli");
    assert.deepEqual(models, [
        { id: "commandcode/deepseek/deepseek-v4-pro", object: "model", owned_by: "commandcode" },
        { id: "commandcode/claude-sonnet-5", object: "model", owned_by: "commandcode" },
        { id: "commandcode/moonshotai/Kimi-K3", object: "model", owned_by: "commandcode" }
    ]);
});

test("CommandCode returns empty array when upstream fails (no hardcoded fallback)", async () => {
    globalThis.fetch = async () => new Response("Internal Server Error", { status: 500 });
    const models = await executor().listModels();
    assert.deepEqual(models, []);
});

test("CommandCode returns empty array when network throws (no hardcoded fallback)", async () => {
    globalThis.fetch = async () => {
        throw new Error("Network connection reset");
    };
    const models = await executor().listModels();
    assert.deepEqual(models, []);
});

test("CommandCode adapts models URL when custom baseUrl ending in /alpha/generate is supplied", async () => {
    let url = "";
    globalThis.fetch = async (input) => {
        url = String(input);
        return Response.json({
            data: [{ id: "custom-model", object: "model" }]
        });
    };

    const customExec = executor({ baseUrl: "https://myproxy.example.com/alpha/generate" });
    const models = await customExec.listModels();
    assert.equal(url, "https://myproxy.example.com/provider/v1/models");
    assert.deepEqual(models, [
        { id: "commandcode/custom-model", object: "model", owned_by: "commandcode" }
    ]);
});

test("CommandCode chat completion streams NDJSON and aggregates response", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> | undefined;

    globalThis.fetch = async (input, init) => {
        requestUrl = String(input);
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

        const ndjsonEvents = [
            JSON.stringify({ type: "text-delta", text: "Hello from " }),
            JSON.stringify({ type: "text-delta", text: "CommandCode!" }),
            JSON.stringify({ type: "finish", finishReason: "stop" })
        ].join("\n");

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(ndjsonEvents));
                controller.close();
            }
        });

        return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "application/x-ndjson" }
        });
    };

    const res = await executor().chatCompletion(request("commandcode/deepseek/deepseek-v4-pro"));
    assert.equal(requestUrl, "https://api.commandcode.ai/alpha/generate");
    assert.equal(
        (requestBody?.params as { model: string } | undefined)?.model,
        "deepseek/deepseek-v4-pro"
    );
    assert.equal(res.choices[0]?.message.content, "Hello from CommandCode!");
    assert.equal(res.choices[0]?.finish_reason, "stop");
});

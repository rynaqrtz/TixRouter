import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { db, getArenaStatsDB, setSettingDB } from "@tixrouter/db";
import { ChatLogic, PreviewCandidateModels, type ChatRouteMeta } from "@/logic/chat.logic.js";
import { registry } from "@/services/registry.js";

function ResetArena(): void {
    setSettingDB("arena_enabled", "false");
    setSettingDB("arena_sample_pct", "5");
    setSettingDB("arena_candidate_model", "");
    setSettingDB("arena_judge_model", "");
    db.exec("DELETE FROM arena_trials");
}

afterEach(() => {
    ResetArena();
});

interface MockReq {
    model: string;
}

function MockRegistry(judgeReply: string): { original: unknown } {
    const original = registry.chatCompletion;
    registry.chatCompletion = (async (req: MockReq) => {
        if (req.model === "judge/model") {
            return {
                id: "chatcmpl-judge",
                object: "chat.completion",
                created: Date.now(),
                model: "judge/model",
                choices: [
                    { index: 0, message: { role: "assistant", content: judgeReply }, finish_reason: "stop" }
                ]
            };
        }
        if (req.model === "free/candidate") {
            return {
                id: "chatcmpl-candidate",
                object: "chat.completion",
                created: Date.now(),
                model: "free/candidate",
                choices: [
                    { index: 0, message: { role: "assistant", content: "Paris is the capital." }, finish_reason: "stop" }
                ]
            };
        }
        return {
            id: "chatcmpl-primary",
            object: "chat.completion",
            created: Date.now(),
            model: "openai_codex/gpt-4o",
            choices: [
                { index: 0, message: { role: "assistant", content: "The capital is Paris." }, finish_reason: "stop" }
            ]
        };
    }) as typeof registry.chatCompletion;
    return { original };
}

test("Shadow Arena records no trial when disabled", async () => {
    setSettingDB("arena_enabled", "false");
    setSettingDB("arena_candidate_model", "free/candidate");
    const { original } = MockRegistry("PASS");

    try {
        await ChatLogic.ProcessNonStreamingCompletion(
            { model: "openai_codex/gpt-4o", messages: [{ role: "user", content: "What is the capital of France?" }] },
            Date.now()
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(getArenaStatsDB().length, 0);
    } finally {
        registry.chatCompletion = original as typeof registry.chatCompletion;
    }
});

test("Shadow Arena samples traffic, judges candidate, and aggregates stats", async () => {
    setSettingDB("arena_enabled", "true");
    setSettingDB("arena_sample_pct", "100");
    setSettingDB("arena_candidate_model", "free/candidate");
    setSettingDB("arena_judge_model", "judge/model");
    const { original } = MockRegistry("PASS");

    try {
        const response = await ChatLogic.ProcessNonStreamingCompletion(
            { model: "openai_codex/gpt-4o", messages: [{ role: "user", content: "What is the capital of France?" }] },
            Date.now()
        );
        assert.equal(response.choices[0]?.message?.content, "The capital is Paris.");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const stats = getArenaStatsDB();
        assert.equal(stats.length, 1);
        assert.equal(stats[0]?.candidate_model, "free/candidate");
        assert.equal(stats[0]?.trials, 1);
        assert.equal(stats[0]?.wins, 1);
        assert.equal(stats[0]?.win_rate, 100);
    } finally {
        registry.chatCompletion = original as typeof registry.chatCompletion;
    }
});

test("Shadow Arena judge FAIL lowers win rate", async () => {
    setSettingDB("arena_enabled", "true");
    setSettingDB("arena_sample_pct", "100");
    setSettingDB("arena_candidate_model", "free/candidate");
    setSettingDB("arena_judge_model", "judge/model");
    const { original } = MockRegistry("FAIL");

    try {
        await ChatLogic.ProcessNonStreamingCompletion(
            { model: "openai_codex/gpt-4o", messages: [{ role: "user", content: "What is the capital of France?" }] },
            Date.now()
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        const stats = getArenaStatsDB();
        assert.equal(stats.length, 1);
        assert.equal(stats[0]?.wins, 0);
        assert.equal(stats[0]?.win_rate, 0);
    } finally {
        registry.chatCompletion = original as typeof registry.chatCompletion;
    }
});

test("ProcessNonStreamingCompletion fills ChatRouteMeta and PreviewCandidateModels exposes the chain", async () => {
    const { original } = MockRegistry("PASS");

    try {
        const meta: ChatRouteMeta = {};
        await ChatLogic.ProcessNonStreamingCompletion(
            { model: "openai_codex/gpt-4o", messages: [{ role: "user", content: "Hi" }] },
            Date.now(),
            0,
            undefined,
            meta
        );
        assert.equal(meta.requestedModel, "openai_codex/gpt-4o");
        assert.equal(meta.model, "openai_codex/gpt-4o");
        assert.equal(meta.provider, "openai_codex");
        assert.equal(meta.cached, false);
        assert.equal(meta.attempts, 1);
        assert.deepEqual(PreviewCandidateModels("openai_codex/gpt-4o"), ["openai_codex/gpt-4o"]);
    } finally {
        registry.chatCompletion = original as typeof registry.chatCompletion;
    }
});

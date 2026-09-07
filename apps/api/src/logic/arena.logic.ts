import { createHash } from "node:crypto";
import { getSettingDB, recordArenaTrialDB } from "@tixrouter/db";
import type { ChatCompletionRequest } from "@tixrouter/types";
import { registry } from "@/services/registry.js";

const PROMPT_SNIPPET_CHARS = 16000;
const ANSWER_SNIPPET_CHARS = 8000;

export interface ArenaSettings {
    enabled: boolean;
    samplePct: number;
    candidate: string;
    judge: string;
}

export function ReadArenaSettings(): ArenaSettings {
    const Raw = getSettingDB("arena_sample_pct", "5");
    const Pct = parseInt(Raw, 10);
    return {
        enabled: getSettingDB("arena_enabled", "false") === "true",
        samplePct: Number.isFinite(Pct) && Pct >= 0 ? Math.min(Pct, 100) : 5,
        candidate: getSettingDB("arena_candidate_model", "").trim(),
        judge: getSettingDB("arena_judge_model", "").trim()
    };
}

function Clip(Text: string, Max: number): string {
    return Text.length > Max ? `${Text.slice(0, Max)}…[truncated]` : Text;
}

export async function RunShadowTrial(
    Body: ChatCompletionRequest,
    SourceModel: string,
    SourceAnswer: string
): Promise<void> {
    const Settings = ReadArenaSettings();
    if (!Settings.enabled || !Settings.candidate) return;
    if (Body.model === Settings.candidate) return;
    if (Math.random() * 100 >= Settings.samplePct) return;

    const started = Date.now();
    const judgeModel = Settings.judge || SourceModel;
    let verdict: "pass" | "fail" | "unknown" | "error" = "error";

    try {
        const candidateRes = await registry.chatCompletion({
            ...Body,
            model: Settings.candidate,
            stream: false
        });
        const candidateAnswer = candidateRes.choices?.[0]?.message?.content ?? "";

        const judgeRes = await registry.chatCompletion({
            model: judgeModel,
            stream: false,
            messages: [
                {
                    role: "system",
                    content:
                        "You compare two AI answers to the same prompt. Reply with exactly PASS if the candidate answer is substantively as correct and complete as the reference answer, otherwise reply with exactly FAIL."
                },
                {
                    role: "user",
                    content: Clip(
                        `Prompt:\n${JSON.stringify(Body.messages)}\n\nReference answer (from ${SourceModel}):\n${SourceAnswer}\n\nCandidate answer (from ${Settings.candidate}):\n${candidateAnswer}`,
                        PROMPT_SNIPPET_CHARS
                    )
                }
            ]
        });
        const Reply = (judgeRes.choices?.[0]?.message?.content ?? "").toUpperCase();
        verdict = Reply.includes("PASS") ? "pass" : Reply.includes("FAIL") ? "fail" : "unknown";
    } catch {
        verdict = "error";
    }

    recordArenaTrialDB({
        sourceModel: SourceModel,
        candidateModel: Settings.candidate,
        judgeModel,
        promptHash: createHash("sha256").update(JSON.stringify(Body.messages)).digest("hex").slice(0, 16),
        verdict,
        latencyMs: Date.now() - started
    });
}

export function MaybeRunShadowTrial(
    Body: ChatCompletionRequest,
    SourceModel: string,
    SourceAnswer: string
): void {
    void RunShadowTrial(Body, SourceModel, SourceAnswer).catch(() => undefined);
}

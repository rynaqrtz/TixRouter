import { getSettingDB } from "@tixrouter/db";
import type { ChatCompletionRequest, ChatCompletionResponse } from "@tixrouter/types";
import { registry } from "@/services/registry.js";
import { ChatLogic, type ChatRouteMeta } from "@/logic/chat.logic.js";

const VERIFIER_MAX_CHARS = 12000;
const VERIFY_PROMPT = [
    "You are a strict output verifier. Decide whether the ANSWER correctly and completely responds to the REQUEST.",
    "Reply with exactly PASS or FAIL.",
    "",
    "REQUEST:",
    "{{request}}",
    "",
    "ANSWER:",
    "{{answer}}"
].join("\n");

export interface CascadeSettings {
    enabled: boolean;
    verifierModel: string;
    threshold: number;
}

export function ReadCascadeSettings(): CascadeSettings {
    return {
        enabled: getSettingDB("cascade_enabled", "false") === "true",
        verifierModel: getSettingDB("cascade_verifier_model", ""),
        threshold: Math.min(1, Math.max(0, Number(getSettingDB("cascade_min_score", "0.7")) || 0.7))
    };
}

function Clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

function BuildVerifyRequest(
    body: ChatCompletionRequest,
    answer: string,
    verifierModel: string
): ChatCompletionRequest {
    const request = Clip(JSON.stringify({ model: body.model, messages: body.messages }), VERIFIER_MAX_CHARS);
    return {
        model: verifierModel,
        messages: [
            {
                role: "user",
                content: VERIFY_PROMPT.replace("{{request}}", request).replace("{{answer}}", Clip(answer, VERIFIER_MAX_CHARS))
            }
        ]
    };
}

export async function MaybeVerifyCompletion(
    body: ChatCompletionRequest,
    response: ChatCompletionResponse,
    startTime: number,
    apiKeyId: string | undefined,
    meta?: ChatRouteMeta
): Promise<ChatCompletionResponse> {
    const settings = ReadCascadeSettings();
    if (!settings.enabled || !settings.verifierModel) return response;

    const answer = response.choices[0]?.message?.content;
    if (!answer) return response;

    try {
        const verdict = await registry.chatCompletion(BuildVerifyRequest(body, answer, settings.verifierModel));
        const text = (verdict.choices[0]?.message?.content ?? "").toUpperCase();
        const score = text.includes("PASS") ? 1 : text.includes("FAIL") ? 0 : 0.5;
        if (score >= settings.threshold) return response;

        const escalated = await ChatLogic.ProcessNonStreamingCompletion(
            { ...body, model: settings.verifierModel },
            startTime,
            1,
            apiKeyId,
            undefined
        );
        if (meta) {
            meta.escalated = true;
            meta.attempts = (meta.attempts ?? 1) + 1;
        }
        return escalated;
    } catch {
        return response;
    }
}

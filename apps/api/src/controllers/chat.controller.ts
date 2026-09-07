import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { ChatCompletionRequest, APIKeyZod } from "@tixrouter/types";
import { ChatLogic, ExtractStatusCode, PreviewCandidateModels, type ChatRouteMeta } from "@/logic/chat.logic.js";
import { Err, FormatErrorPayload, Ok } from "@/utils/response.js";

function NormalizeDeveloperRole(Body: ChatCompletionRequest): ChatCompletionRequest {
    for (const msg of Body.messages) {
        if (msg.role === "developer") msg.role = "system";
    }
    return Body;
}

function SetRouteHeaders(c: Context, Meta: ChatRouteMeta): void {
    if (Meta.model) c.header("x-tixrouter-model", Meta.model);
    if (Meta.provider) c.header("x-tixrouter-provider", Meta.provider);
    if (Meta.cached !== undefined) c.header("x-tixrouter-cache", Meta.cached ? "hit" : "miss");
    if (Meta.attempts !== undefined) c.header("x-tixrouter-attempts", String(Meta.attempts));
    if (Meta.fallbackPath?.length) c.header("x-tixrouter-fallback-path", Meta.fallbackPath.join(" -> "));
}

export class ChatController {
    public static async CreateCompletion(c: Context): Promise<Response> {
        const StartTime = Date.now();
        const Body = NormalizeDeveloperRole(
            c.req.valid("json" as never) as ChatCompletionRequest
        );
        const ApiKeyRow = c.get("apiKeyRow") as APIKeyZod | undefined;
        const ApiKeyId = ApiKeyRow?.id;

        if (Body.stream) {
            c.header("x-tixrouter-requested-model", Body.model);
            c.header("x-tixrouter-candidates", PreviewCandidateModels(Body.model).join(","));
            return streamSSE(c, async (stream) => {
                try {
                    const Generator = ChatLogic.ProcessStreamingCompletion(
                        Body,
                        StartTime,
                        0,
                        ApiKeyId
                    );
                    for await (const Chunk of Generator) {
                        await stream.writeSSE({
                            data: JSON.stringify(Chunk)
                        });
                    }
                    await stream.writeSSE({
                        data: "[DONE]"
                    });
                } catch (error) {
                    const ErrorMessage =
                        error instanceof Error ? error.message : "Error occurred during streaming";
                    await stream.writeSSE({
                        data: JSON.stringify(FormatErrorPayload(ErrorMessage, 500))
                    });
                }
            });
        }

        const Meta: ChatRouteMeta = { requestedModel: Body.model };

        try {
            const ResponseData = await ChatLogic.ProcessNonStreamingCompletion(
                Body,
                StartTime,
                0,
                ApiKeyId,
                Meta
            );
            SetRouteHeaders(c, Meta);
            return Ok(c, ResponseData);
        } catch (error) {
            const ErrorMessage = error instanceof Error ? error.message : "Internal server error";
            const Status = ExtractStatusCode(error) ?? 500;
            return Err(c, ErrorMessage, Status);
        }
    }
}

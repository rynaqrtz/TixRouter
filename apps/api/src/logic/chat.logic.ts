import {
    findMatchingFallbackRulesDB,
    getTokenSaverSettingsDB,
    logRequestDB,
    incrementAPIKeyUsageDB
} from "@tixrouter/db";
import { applyTokenSaver, estimateCostForUsage, extractUsageBreakdown } from "@tixrouter/translator";
import { getCachedResponse, setCachedResponse } from "../services/responseCache.js";
import { notifyProviderFailure } from "../services/notify.js";
import { modelSupportsToolCalling } from "@tixrouter/pricing";
import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
    FallbackRule,
    ToolCall,
    UsageInfo
} from "@tixrouter/types";
import { registry } from "@/services/registry.js";
import { ensureFreshToken } from "@/services/tokenRefresh.js";
import { executeInterceptedSearch, shouldInterceptToolCall } from "@/services/toolInterceptor.js";
import { MaybeRunShadowTrial } from "@/logic/arena.logic.js";

const MAX_INTERCEPT_DEPTH = 3;

export interface ChatRouteMeta {
    requestedModel?: string;
    model?: string;
    provider?: string;
    fallbackOccurred?: boolean;
    fallbackPath?: string[];
    cached?: boolean;
    attempts?: number;
}

interface AssembledStreamingToolCall {
    id: string;
    name: string;
    arguments: string;
}

interface CandidateModel {
    model: string;
    rule?: FallbackRule;
}

interface ErrorWithStatus {
    status?: number;
    statusCode?: number;
    message?: string;
}

function stripToolsFromBody(body: ChatCompletionRequest): ChatCompletionRequest {
    const stripped = { ...body };
    delete stripped.tools;
    delete stripped.tool_choice;
    return stripped;
}

export function ExtractStatusCode(
    err: Error | ErrorWithStatus | string | null | undefined
): number | undefined {
    if (!err) return undefined;
    if (typeof err === "object") {
        if ("status" in err && typeof err.status === "number") {
            return err.status;
        }
        if ("statusCode" in err && typeof err.statusCode === "number") {
            return err.statusCode;
        }
    }
    const msg = typeof err === "string" ? err : err.message || String(err);
    const match = msg.match(/\b(429|403|500|502|503|504|400|401|402|422)\b/);
    if (match) return parseInt(match[1]!, 10);
    return undefined;
}

function ShouldTriggerFallback(
    rule: FallbackRule,
    err: Error | ErrorWithStatus | string | null | undefined
): boolean {
    if (!rule.enabled) return false;
    if (!rule.triggerOnStatus || rule.triggerOnStatus.length === 0) return true;
    const status = ExtractStatusCode(err);
    if (status && rule.triggerOnStatus.includes(status)) return true;
    const msg = typeof err === "string" ? err : err ? err.message || String(err) : "";
    if (
        /rate\s*limit|too\s+many\s+requests|quota|exhausted|capacity|high\s+traffic|overloaded|no active provider connection|not found|unknown model|invalid model|no provider found|insufficient tokens|insufficient_quota|billing_error|tool.?calling.*not supported|not support.*tool|tools.*not.*supported/i.test(
            msg
        )
    ) {
        return true;
    }
    return status === undefined;
}

function ResolveCandidates(originalModel: string): CandidateModel[] {
    const matchingRules = findMatchingFallbackRulesDB(originalModel);
    const candidates: CandidateModel[] = [{ model: originalModel }];
    const visitedModels = new Set<string>([originalModel]);

    for (const rule of matchingRules) {
        if (!visitedModels.has(rule.targetModel)) {
            visitedModels.add(rule.targetModel);
            candidates.push({ model: rule.targetModel, rule });
        }
    }
    return candidates;
}

export function PreviewCandidateModels(originalModel: string): string[] {
    return ResolveCandidates(originalModel).map((Candidate) => Candidate.model);
}

function LogCompletion(
    providerId: string,
    model: string,
    startTime: number,
    options: {
        statusCode: number;
        usage?: UsageInfo;
        fallbackOccurred?: boolean;
        fallbackPath?: string[];
        fallbackReason?: string;
        apiKeyId?: string;
    }
): void {
    const breakdown = extractUsageBreakdown(providerId, options.usage);
    const effectiveModel = model;
    const effectiveProvider = effectiveModel.includes("/")
        ? effectiveModel.split("/")[0]!
        : providerId;
    const estimatedCost =
        options.statusCode === 200
            ? estimateCostForUsage(effectiveProvider, effectiveModel, breakdown)
            : undefined;

    if (options.statusCode === 200 && options.apiKeyId && breakdown.total_tokens > 0) {
        incrementAPIKeyUsageDB(options.apiKeyId, breakdown.total_tokens, estimatedCost ?? 0);
    }

    logRequestDB({
        apiKeyId: options.apiKeyId,
        providerId,
        model,
        promptTokens: options.statusCode === 200 ? breakdown.prompt_tokens : 0,
        completionTokens: options.statusCode === 200 ? breakdown.completion_tokens : 0,
        totalTokens: options.statusCode === 200 ? breakdown.total_tokens : 0,
        cachedTokens: options.statusCode === 200 ? breakdown.cached_tokens : undefined,
        cacheCreationTokens:
            options.statusCode === 200 ? breakdown.cache_creation_tokens : undefined,
        reasoningTokens: options.statusCode === 200 ? breakdown.reasoning_tokens : undefined,
        estimatedCost,
        fallbackOccurred: options.fallbackOccurred,
        fallbackPath: options.fallbackOccurred ? options.fallbackPath?.join(" -> ") : undefined,
        fallbackReason: options.fallbackReason,
        statusCode: options.statusCode,
        latencyMs: Date.now() - startTime
    });
}

function BuildCandidateRequest(
    effectiveBody: ChatCompletionRequest,
    currentModel: string
): ChatCompletionRequest {
    let currentReq: ChatCompletionRequest = { ...effectiveBody, model: currentModel };
    if (
        currentReq.tools &&
        currentReq.tools.length > 0 &&
        !modelSupportsToolCalling(currentModel)
    ) {
        currentReq = stripToolsFromBody(currentReq);
    }
    return currentReq;
}

function* CachedResponseToChunks(
    cached: ChatCompletionResponse
): Generator<ChatCompletionChunk, void, void> {
    const choice = cached.choices[0];
    yield {
        id: cached.id,
        object: "chat.completion.chunk",
        created: cached.created,
        model: cached.model,
        choices: [
            {
                index: 0,
                delta: { role: "assistant", content: choice?.message.content ?? "" },
                finish_reason: null
            }
        ]
    };
    yield {
        id: cached.id,
        object: "chat.completion.chunk",
        created: cached.created,
        model: cached.model,
        choices: [{ index: 0, delta: {}, finish_reason: choice?.finish_reason ?? "stop" }],
        usage: cached.usage
    };
}

export class ChatLogic {
    public static async ProcessNonStreamingCompletion(
        body: ChatCompletionRequest,
        startTime: number,
        depth = 0,
        apiKeyId?: string,
        meta?: ChatRouteMeta
    ): Promise<ChatCompletionResponse> {
        const maxInputTokens = body.max_tokens ?? 4096;
        const effectiveBody =
            depth === 0 ? applyTokenSaver(body, getTokenSaverSettingsDB(), maxInputTokens).request : body;
        const originalModel = effectiveBody.model;
        if (depth === 0 && meta) meta.requestedModel = originalModel;
        const candidates = ResolveCandidates(originalModel);

        let lastError: Error | ErrorWithStatus | string | null = null;
        const fallbackPath: string[] = [originalModel];
        let fallbackOccurred = false;
        let fallbackReason: string | undefined;

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i]!;
            const isFallbackAttempt = i > 0;

            if (isFallbackAttempt && candidate.rule && lastError) {
                if (!ShouldTriggerFallback(candidate.rule, lastError)) {
                    continue;
                }
            }

            const currentModel = candidate.model;
            const providerId = currentModel.split("/")[0] || "default";
            const currentReq = BuildCandidateRequest(effectiveBody, currentModel);

            const cached = getCachedResponse(currentReq);
            if (cached) {
                if (isFallbackAttempt) {
                    fallbackOccurred = true;
                    fallbackPath.push(currentModel);
                }
                LogCompletion(providerId, currentModel, startTime, {
                    statusCode: 200,
                    usage: cached.usage,
                    fallbackOccurred,
                    fallbackPath,
                    fallbackReason,
                    apiKeyId
                });
                if (meta) {
                    meta.model = currentModel;
                    meta.provider = providerId;
                    meta.fallbackOccurred = fallbackOccurred;
                    meta.fallbackPath = [...fallbackPath];
                    meta.attempts = i + 1;
                    meta.cached = true;
                }
                return cached;
            }

            try {
                await ensureFreshToken(providerId);
                const response = await registry.chatCompletion(currentReq);

                if (isFallbackAttempt) {
                    fallbackOccurred = true;
                    fallbackPath.push(currentModel);
                }

                setCachedResponse(currentReq, response);

                const choice = response.choices?.[0];
                const toolCalls = choice?.message?.tool_calls;

                if (
                    depth < MAX_INTERCEPT_DEPTH &&
                    Array.isArray(toolCalls) &&
                    toolCalls.length > 0 &&
                    toolCalls.some((tc) =>
                        shouldInterceptToolCall(tc.function.name, effectiveBody.tools)
                    )
                ) {
                    const updatedMessages: ChatMessage[] = [
                        ...effectiveBody.messages,
                        choice.message
                    ];

                    for (const tc of toolCalls) {
                        if (shouldInterceptToolCall(tc.function.name, effectiveBody.tools)) {
                            const { toolCallId, result } = await executeInterceptedSearch(tc);
                            updatedMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                content: JSON.stringify(result)
                            });
                        }
                    }

                    const followUpRequest: ChatCompletionRequest = {
                        ...currentReq,
                        messages: updatedMessages
                    };
                    return await this.ProcessNonStreamingCompletion(
                        followUpRequest,
                        startTime,
                        depth + 1,
                        apiKeyId,
                        meta
                    );
                }

                LogCompletion(providerId, currentModel, startTime, {
                    statusCode: 200,
                    usage: response.usage,
                    fallbackOccurred,
                    fallbackPath,
                    fallbackReason,
                    apiKeyId
                });

                if (meta) {
                    meta.model = currentModel;
                    meta.provider = providerId;
                    meta.fallbackOccurred = fallbackOccurred;
                    meta.fallbackPath = [...fallbackPath];
                    meta.attempts = i + 1;
                    meta.cached = false;
                }
                MaybeRunShadowTrial(
                    effectiveBody,
                    currentModel,
                    choice?.message?.content ?? JSON.stringify(choice?.message?.tool_calls ?? "")
                );

                return response;
            } catch (err) {
                lastError = err instanceof Error ? err : (err as ErrorWithStatus);
                if (!fallbackReason) {
                    fallbackReason = err instanceof Error ? err.message : String(err);
                }

                if (i < candidates.length - 1) {
                    continue;
                }
            }
        }

        const provider = originalModel.split("/")[0] || "default";
        LogCompletion(provider, originalModel, startTime, {
            statusCode: 500,
            fallbackOccurred,
            fallbackPath,
            fallbackReason,
            apiKeyId
        });

        void notifyProviderFailure(originalModel, lastError);
        throw lastError;
    }

    public static async *ProcessStreamingCompletion(
        body: ChatCompletionRequest,
        startTime: number,
        depth = 0,
        apiKeyId?: string
    ): AsyncGenerator<ChatCompletionChunk, void, void> {
        const maxInputTokens = body.max_tokens ?? 4096;
        const effectiveBody =
            depth === 0 ? applyTokenSaver(body, getTokenSaverSettingsDB(), maxInputTokens).request : body;
        const originalModel = effectiveBody.model;
        const candidates = ResolveCandidates(originalModel);

        let lastError: Error | ErrorWithStatus | string | null = null;
        const fallbackPath: string[] = [originalModel];
        let fallbackOccurred = false;
        let fallbackReason: string | undefined;

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i]!;
            const isFallbackAttempt = i > 0;

            if (isFallbackAttempt && candidate.rule && lastError) {
                if (!ShouldTriggerFallback(candidate.rule, lastError)) {
                    continue;
                }
            }

            const currentModel = candidate.model;
            const providerId = currentModel.split("/")[0] || "default";
            const currentReq = BuildCandidateRequest(effectiveBody, currentModel);

            const cached = getCachedResponse(currentReq);
            if (cached) {
                if (isFallbackAttempt) {
                    fallbackOccurred = true;
                    fallbackPath.push(currentModel);
                }
                LogCompletion(providerId, currentModel, startTime, {
                    statusCode: 200,
                    usage: cached.usage,
                    fallbackOccurred,
                    fallbackPath,
                    fallbackReason,
                    apiKeyId
                });
                yield* CachedResponseToChunks(cached);
                return;
            }

            let yieldedAny = false;
            let usage: UsageInfo | undefined = undefined;

            try {
                await ensureFreshToken(providerId);
                const generator = registry.chatCompletionStream(currentReq);

                const bufferedChunks: ChatCompletionChunk[] = [];
                const toolCallsMap = new Map<number, AssembledStreamingToolCall>();
                let hasToolCalls = false;
                let assistantContent = "";

                for await (const chunk of generator) {
                    if (!yieldedAny) {
                        yieldedAny = true;
                        if (isFallbackAttempt) {
                            fallbackOccurred = true;
                            fallbackPath.push(currentModel);
                        }
                    }

                    if (chunk.usage) {
                        usage = chunk.usage;
                    }

                    const choice = chunk.choices?.[0];
                    const delta = choice?.delta;

                    if (delta?.content) {
                        assistantContent += delta.content;
                    }

                    if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
                        hasToolCalls = true;
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? toolCallsMap.size;
                            const existing = toolCallsMap.get(idx) || {
                                id: tc.id || `call_${Date.now()}_${idx}`,
                                name: tc.function?.name || "",
                                arguments: ""
                            };
                            if (tc.id) existing.id = tc.id;
                            if (tc.function?.name) existing.name = tc.function.name;
                            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                            toolCallsMap.set(idx, existing);
                        }
                    }

                    if (hasToolCalls) {
                        bufferedChunks.push(chunk);
                    } else {
                        yield chunk;
                    }
                }

                const assembledToolCalls = Array.from(toolCallsMap.values());
                const hasInterceptableCall =
                    depth < MAX_INTERCEPT_DEPTH &&
                    assembledToolCalls.some((tc) =>
                        shouldInterceptToolCall(tc.name, effectiveBody.tools)
                    );

                if (hasInterceptableCall) {
                    const assistantToolCalls: ToolCall[] = assembledToolCalls.map((tc) => ({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.name,
                            arguments: tc.arguments
                        }
                    }));

                    const assistantMessage: ChatMessage = {
                        role: "assistant",
                        content: assistantContent || null,
                        tool_calls: assistantToolCalls
                    };

                    const updatedMessages: ChatMessage[] = [
                        ...effectiveBody.messages,
                        assistantMessage
                    ];

                    for (const tc of assembledToolCalls) {
                        if (shouldInterceptToolCall(tc.name, effectiveBody.tools)) {
                            const { toolCallId, result } = await executeInterceptedSearch({
                                id: tc.id,
                                function: { name: tc.name, arguments: tc.arguments }
                            });
                            updatedMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                content: JSON.stringify(result)
                            });
                        }
                    }

                    const followUpRequest: ChatCompletionRequest = {
                        ...currentReq,
                        messages: updatedMessages
                    };
                    yield* this.ProcessStreamingCompletion(
                        followUpRequest,
                        startTime,
                        depth + 1,
                        apiKeyId
                    );
                    return;
                }

                for (const chunk of bufferedChunks) {
                    yield chunk;
                }

                LogCompletion(providerId, currentModel, startTime, {
                    statusCode: 200,
                    usage,
                    fallbackOccurred,
                    fallbackPath,
                    fallbackReason,
                    apiKeyId
                });

                MaybeRunShadowTrial(
                    effectiveBody,
                    currentModel,
                    assistantContent || JSON.stringify(assembledToolCalls)
                );

                return;
            } catch (err) {
                lastError = err instanceof Error ? err : (err as ErrorWithStatus);
                if (!fallbackReason) {
                    fallbackReason = err instanceof Error ? err.message : String(err);
                }

                if (!yieldedAny && i < candidates.length - 1) {
                    continue;
                }

                const provider = currentModel.split("/")[0] || "default";
                LogCompletion(provider, currentModel, startTime, {
                    statusCode: 500,
                    fallbackOccurred,
                    fallbackPath,
                    fallbackReason,
                    apiKeyId
                });
                void notifyProviderFailure(originalModel, err);
                throw err;
            }
        }

        if (lastError) throw lastError;
    }
}

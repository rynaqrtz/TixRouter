import type {
    ChatMessage,
    ChatCompletionRequest,
    TokenSaverSettings,
    TokenSaverPreviewResponse,
    TrimMessagesSettings
} from "@rynarouter/types";

const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function StripAnsiCodes(text: string): string {
    return text.replace(ANSI_REGEX, "");
}

export function CleanWhitespace(text: string): string {
    return text
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function CompressGitDiff(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        if (
            line.startsWith("index ") ||
            line.startsWith("new file mode ") ||
            line.startsWith("deleted file mode ") ||
            line.startsWith("similarity index ") ||
            line.startsWith("old mode ") ||
            line.startsWith("new mode ")
        ) {
            continue;
        }

        if (line.startsWith("diff --git a/") && line.includes(" b/")) {
            const parts = line.split(" b/");
            const file = parts[1] || line.replace("diff --git a/", "");
            result.push(`--- ${file}`);
            continue;
        }

        if (line.startsWith("--- a/") || line.startsWith("+++ b/")) {
            continue;
        }

        if (line.startsWith("@@ -")) {
            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
            if (match) {
                const start_line = match[2];
                const context = (match[3] || "").trim();
                result.push(`@@ L${start_line}${context ? " " + context : ""} @@`);
                continue;
            }
        }

        result.push(line);
    }

    return result.join("\n");
}

export function CompressGitStatusOrLog(text: string): string {
    if (text.includes("commit ") && text.includes("Author:")) {
        const commit_blocks = text.split(/\n(?=commit [0-9a-f]{7,40})/);
        const compressed_commits = commit_blocks.map((block) => {
            const hash_match = block.match(/commit ([0-9a-f]{7,40})/);
            const msg_match = block.match(/\n\n\s*([^\n]+)/);
            const author_match = block.match(/Author:\s*([^<\n]+)/);
            if (hash_match) {
                const short_hash = hash_match[1]!.slice(0, 7);
                const msg = msg_match ? msg_match[1]!.trim() : "";
                const author = author_match ? ` (${author_match[1]!.trim()})` : "";
                return `[${short_hash}] ${msg}${author}`;
            }
            return block;
        });
        return compressed_commits.join("\n");
    }

    if (text.includes("Changes not staged for commit:") || text.includes("Untracked files:")) {
        const lines = text.split("\n");
        const status_lines: string[] = [];
        let branch = "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("On branch ")) {
                branch = trimmed;
            } else if (trimmed.startsWith("modified:") || trimmed.startsWith("both modified:")) {
                status_lines.push(`M ${trimmed.replace(/^(both\s+)?modified:\s*/, "")}`);
            } else if (trimmed.startsWith("deleted:")) {
                status_lines.push(`D ${trimmed.replace(/^deleted:\s*/, "")}`);
            } else if (trimmed.startsWith("new file:")) {
                status_lines.push(`A ${trimmed.replace(/^new file:\s*/, "")}`);
            } else if (trimmed.startsWith("renamed:")) {
                status_lines.push(`R ${trimmed.replace(/^renamed:\s*/, "")}`);
            } else if (
                trimmed.length > 0 &&
                !trimmed.startsWith("(") &&
                !trimmed.startsWith("no changes") &&
                !trimmed.startsWith("Changes") &&
                !trimmed.startsWith("Untracked") &&
                !trimmed.startsWith("Your branch")
            ) {
                status_lines.push(`? ${trimmed}`);
            }
        }

        return [branch, ...status_lines].filter(Boolean).join("\n");
    }

    return text;
}

export function CompressGrepOutput(text: string): string {
    const lines = text.split("\n");
    const file_groups = new Map<string, string[]>();
    const unparsed: string[] = [];

    for (const line of lines) {
        const match = line.match(/^(\.?\/?[^:\n]+):(\d+)[:-](.*)$/);
        if (match) {
            const file = match[1]!.replace(/^\.\//, "");
            const line_num = match[2]!;
            const content = match[3]!.trim();
            const group = file_groups.get(file) || [];
            group.push(`L${line_num}: ${content}`);
            file_groups.set(file, group);
        } else if (line.trim()) {
            unparsed.push(line);
        }
    }

    if (file_groups.size === 0) {
        return text;
    }

    const compressed: string[] = [];
    for (const [file, entries] of file_groups) {
        compressed.push(`${file}:\n  ` + entries.join("\n  "));
    }

    if (unparsed.length > 0) {
        compressed.push(...unparsed);
    }

    return compressed.join("\n");
}

export function CompressFileListings(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("total ")) continue;

        const ls_match = trimmed.match(
            /^([drwxlsStT\-]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+[A-Za-z]{3}\s+\d+\s+[\d:]+\s+(.+)$/
        );
        if (ls_match) {
            const is_dir = ls_match[1]!.startsWith("d");
            const name = ls_match[3]!;
            result.push(is_dir ? `${name}/` : name);
            continue;
        }

        if (trimmed.includes("── ") || trimmed.includes("─── ")) {
            const name = trimmed.replace(/^[\s│├└─┬|`-]+/, "").trim();
            if (name) result.push(name);
            continue;
        }

        result.push(trimmed);
    }

    return result.join("\n");
}

export function CompressGenericLogs(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];
    let last_line = "";
    let duplicate_count = 0;

    for (const line of lines) {
        const stripped_timestamp = line
            .replace(/^\[?\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]?\s*/, "")
            .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");

        if (stripped_timestamp === last_line && stripped_timestamp.length > 0) {
            duplicate_count++;
            continue;
        }

        if (duplicate_count > 0) {
            result.push(
                `  ↳ [repeated ${duplicate_count} more time${duplicate_count > 1 ? "s" : ""}]`
            );
            duplicate_count = 0;
        }

        result.push(stripped_timestamp);
        last_line = stripped_timestamp;
    }

    if (duplicate_count > 0) {
        result.push(`  ↳ [repeated ${duplicate_count} more time${duplicate_count > 1 ? "s" : ""}]`);
    }

    return result.join("\n");
}

export function CompressSingleToolOutput(
    text: string,
    settings: TokenSaverSettings["compressToolOutput"]
): string {
    if (!settings.enabled || text.length < settings.minCharacterThreshold) {
        return text;
    }

    let processed = text;

    if (settings.stripAnsiAndWhitespace) {
        processed = StripAnsiCodes(processed);
    }

    if (
        settings.compressGit &&
        (processed.includes("diff --git") ||
            (processed.includes("--- ") && processed.includes("+++ ")))
    ) {
        processed = CompressGitDiff(processed);
    } else if (
        settings.compressGit &&
        (processed.includes("commit ") ||
            processed.includes("Changes not staged for commit:") ||
            processed.includes("On branch "))
    ) {
        processed = CompressGitStatusOrLog(processed);
    } else if (
        settings.compressGrep &&
        /^[^\n:]+:\d+[:-]/m.test(processed) &&
        processed.split("\n").filter((l) => /^[^\n:]+:\d+[:-]/.test(l)).length >= 2
    ) {
        processed = CompressGrepOutput(processed);
    } else if (
        settings.compressFileLists &&
        (processed.includes("drwx") ||
            processed.includes("-rw-") ||
            processed.includes("├── ") ||
            processed.includes("└── "))
    ) {
        processed = CompressFileListings(processed);
    } else if (settings.compressLogs) {
        processed = CompressGenericLogs(processed);
    }

    if (settings.stripAnsiAndWhitespace) {
        processed = CleanWhitespace(processed);
    }

    return processed;
}

export function BuildSystemPromptEnhancements(settings: TokenSaverSettings): string {
    if (!settings.enabled) return "";

    const parts: string[] = [];

    if (settings.lazySeniorDev.enabled) {
        if (settings.lazySeniorDev.mode === "strict") {
            parts.push(
                `[SYSTEM INSTRUCTION: STRICT MINIMALIST SENIOR DEV]\n` +
                    `- Strictly adhere to YAGNI (You Aren't Gonna Need It): Reject all premature abstractions, helper functions, and unnecessary layers.\n` +
                    `- Reuse stdlib & existing utilities: Use only built-in language standard libraries and code already present in the workspace. Never add new dependencies.\n` +
                    `- Surgical edits: Make minimal in-place edits. Delete dead code over adding wrappers. Never rewrite untouched functions or files.\n` +
                    (settings.lazySeniorDev.customInstructions
                        ? `- ${settings.lazySeniorDev.customInstructions}\n`
                        : "")
            );
        } else {
            parts.push(
                `[SYSTEM INSTRUCTION: LAZY SENIOR DEV]\n` +
                    `- YAGNI principle: Keep code minimal, direct, and free of speculative extensibility.\n` +
                    `- Reuse existing stdlib and project utilities rather than importing new packages.\n` +
                    `- Favor deletion/simplification over addition. Output only targeted, necessary code changes.\n` +
                    (settings.lazySeniorDev.customInstructions
                        ? `- ${settings.lazySeniorDev.customInstructions}\n`
                        : "")
            );
        }
    }

    if (settings.compressLlmOutput.enabled) {
        if (settings.compressLlmOutput.mode === "ultra_terse") {
            parts.push(
                `[SYSTEM INSTRUCTION: ULTRA TERSE / CAVEMAN OUTPUT]\n` +
                    `- Zero conversational pleasantries, preambles, summaries, or pleasant sign-offs.\n` +
                    `- Telegraphic style: direct, concise, high information density.\n` +
                    `- Provide code and direct answers immediately with minimal prose (~80% fewer output tokens).\n` +
                    (settings.compressLlmOutput.customPrompt
                        ? `- ${settings.compressLlmOutput.customPrompt}\n`
                        : "")
            );
        } else {
            parts.push(
                `[SYSTEM INSTRUCTION: TERSE OUTPUT MODE]\n` +
                    `- Eliminate conversational fluff, redundant greetings, and conclusion summaries.\n` +
                    `- Go directly to the solution, explanation, and code changes with maximum clarity and density.\n` +
                    (settings.compressLlmOutput.customPrompt
                        ? `- ${settings.compressLlmOutput.customPrompt}\n`
                        : "")
            );
        }
    }

    return parts.join("\n\n");
}

export function EstimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
}

export interface AppliedTokenSaverResult {
    request: ChatCompletionRequest;
    originalInputTokens: number;
    optimizedInputTokens: number;
    tokensSaved: number;
    percentageSaved: number;
    maxInputTokens: number;
}

const TRIMMED_PLACEHOLDER = "[trimmed: tool output omitted to fit context window]";

function MessageContentLength(msg: ChatMessage): number {
    if (typeof msg.content === "string") return msg.content.length;
    if (Array.isArray(msg.content)) {
        let total = 0;
        for (const part of msg.content) {
            if (typeof part.text === "string") {
                total += part.text.length;
            }
        }
        return total;
    }
    return 0;
}

export interface TrimResult {
    messages: ChatMessage[];
    originalTokens: number;
    trimmedTokens: number;
    trimmedCount: number;
}

/**
 * Drop oldest `tool` messages until total estimated tokens fit under `maxInputTokens`.
 * Preserves the system message (index 0 when present) and the last `preserveTailMessages`
 * non-system messages. Replaced tool messages become a short placeholder so tool_call_id
 * pairing in OpenAI format stays intact.
 */
export function TrimMessages(messages: ChatMessage[], settings: TrimMessagesSettings): TrimResult {
    if (!settings.enabled || messages.length === 0) {
        const tokens = messages.reduce((acc, m) => acc + EstimateTokens(MessageContentText(m)), 0);
        return { messages, originalTokens: tokens, trimmedTokens: tokens, trimmedCount: 0 };
    }

    const totalChars = messages.reduce((acc, m) => acc + MessageContentLength(m), 0);
    const originalTokens = Math.max(1, Math.ceil(totalChars / 4));

    if (originalTokens <= settings.maxInputTokens) {
        return {
            messages,
            originalTokens,
            trimmedTokens: originalTokens,
            trimmedCount: 0
        };
    }

    const preserveTail = Math.max(1, settings.preserveTailMessages);
    const tailStart = Math.max(0, messages.length - preserveTail);

    const indices = messages.map((_, i) => i);
    const toolIndices = indices
        .filter((i) => i < tailStart && messages[i]?.role === "tool")
        .sort((a, b) => a - b);

    const trimmed = messages.map((m) => ({ ...m }));
    let trimmedCount = 0;

    for (const i of toolIndices) {
        const currentChars = trimmed.reduce((acc, m) => acc + MessageContentLength(m), 0);
        const currentTokens = Math.max(1, Math.ceil(currentChars / 4));
        if (currentTokens <= settings.maxInputTokens) break;

        const original = messages[i];
        if (!original) continue;
        trimmed[i] = {
            ...original,
            content: TRIMMED_PLACEHOLDER
        };
        trimmedCount++;
    }

    const trimmedChars = trimmed.reduce((acc, m) => acc + MessageContentLength(m), 0);
    const trimmedTokens = Math.max(1, Math.ceil(trimmedChars / 4));

    return { messages: trimmed, originalTokens, trimmedTokens, trimmedCount };
}

function MessageContentText(msg: ChatMessage): string {
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
        const parts: string[] = [];
        for (const part of msg.content) {
            if (typeof part.text === "string") {
                parts.push(part.text);
            }
        }
        return parts.join("");
    }
    return "";
}

function TrimTextContent(text: string, maxTokens: number): string {
    if (EstimateTokens(text) <= maxTokens) {
        return text;
    }

    let trimmedText = text;
    while (EstimateTokens(trimmedText) > maxTokens && trimmedText.length > 0) {
        trimmedText = trimmedText.slice(0, -1);
    }
    return trimmedText;
}

export function ApplyTokenSaver(
    request: ChatCompletionRequest,
    settings: TokenSaverSettings,
    maxInputTokens: number
): AppliedTokenSaverResult {
    if (!settings.enabled) {
        const tokens = request.messages.reduce((acc, m) => {
            const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            return acc + EstimateTokens(content);
        }, 0);
        return {
            request,
            originalInputTokens: tokens,
            optimizedInputTokens: tokens,
            tokensSaved: 0,
            percentageSaved: 0,
            maxInputTokens
        };
    }

    let original_total_length = 0;
    let optimized_total_length = 0;

    const optimized_messages: ChatMessage[] = request.messages.map((msg) => {
        const raw_content = typeof msg.content === "string" ? msg.content : "";
        original_total_length += raw_content.length;

        if (
            settings.compressToolOutput.enabled &&
            raw_content.length >= settings.compressToolOutput.minCharacterThreshold &&
            (msg.role === "tool" ||
                msg.role === "user" ||
                (msg.role === "assistant" && raw_content.includes("```")))
        ) {
            const compressed = CompressSingleToolOutput(raw_content, settings.compressToolOutput);
            optimized_total_length += compressed.length;
            return {
                ...msg,
                content: compressed
            };
        }

        optimized_total_length += raw_content.length;
        return msg;
    });

    const prompt_enhancement = BuildSystemPromptEnhancements(settings);
    let system_msg_was_added_by_tokensaver = false;
    if (prompt_enhancement) {
        const system_msg_index = optimized_messages.findIndex((m) => m.role === "system");
        if (system_msg_index >= 0) {
            const existing = optimized_messages[system_msg_index]!;
            const existing_content = typeof existing.content === "string" ? existing.content : "";
            optimized_messages[system_msg_index] = {
                ...existing,
                content: `${existing_content}\n\n${prompt_enhancement}`.trim()
            };
        } else {
            optimized_messages.unshift({
                role: "system",
                content: prompt_enhancement
            });
            system_msg_was_added_by_tokensaver = true; // Set flag jika system message baru ditambahkan
        }
    }

    let currentTotalTokens = optimized_messages.reduce(
        (acc, m) => acc + EstimateTokens(MessageContentText(m)),
        0
    );

    // Truncate user and existing system messages if total tokens exceed maxInputTokens
    if (currentTotalTokens > maxInputTokens) {
        for (let i = 0; i < optimized_messages.length; i++) {
            const message = optimized_messages[i]!;

            // Skip if it's a system message added by TokenSaver or a tool message
            if (
                (message.role === "system" && system_msg_was_added_by_tokensaver && i === 0) ||
                message.role === "tool"
            ) {
                continue;
            }

            if (typeof message.content === "string") {
                const remainingTokens = maxInputTokens - (currentTotalTokens - EstimateTokens(message.content));
                if (remainingTokens <= 0) { // If we still need to reduce more, just clear the content
                    message.content = TRIMMED_PLACEHOLDER;
                } else {
                    const trimmedContent = TrimTextContent(message.content, remainingTokens);
                    message.content = trimmedContent;
                }
                currentTotalTokens = optimized_messages.reduce(
                    (acc, m) => acc + EstimateTokens(MessageContentText(m)),
                    0
                );
                if (currentTotalTokens <= maxInputTokens) break;
            }
        }
    }

    if (settings.trimMessages.enabled) {
        const trimResult = TrimMessages(optimized_messages, settings.trimMessages);
        optimized_messages.splice(0, optimized_messages.length, ...trimResult.messages);
        if (trimResult.trimmedCount > 0) {
            optimized_total_length = trimResult.trimmedTokens * 4;
        }
    }

    const original_input_tokens = Math.max(1, Math.ceil(original_total_length / 4));
    const optimized_input_tokens = Math.max(1, Math.ceil(optimized_total_length / 4));
    const tokens_saved = Math.max(0, original_input_tokens - optimized_input_tokens);
    const percentage_saved =
        original_input_tokens > 0
            ? Math.min(99, Math.round((tokens_saved / original_input_tokens) * 100))
            : 0;

    return {
        request: {
            ...request,
            messages: optimized_messages
        },
        originalInputTokens: original_input_tokens,
        optimizedInputTokens: optimized_input_tokens,
        tokensSaved: tokens_saved,
        percentageSaved: percentage_saved,
        maxInputTokens
    };
}

export function PreviewTokenSaver(
    type: "tool_output" | "prompt",
    text: string,
    settings: TokenSaverSettings
): TokenSaverPreviewResponse {
    const original_tokens_estimate = EstimateTokens(text);
    let transformed_text = text;

    if (type === "tool_output") {
        transformed_text = CompressSingleToolOutput(text, settings.compressToolOutput);
    } else {
        const enhancements = BuildSystemPromptEnhancements(settings);
        transformed_text = enhancements ? `${text}\n\n${enhancements}`.trim() : text;
    }

    const transformed_tokens_estimate = EstimateTokens(transformed_text);
    const tokens_saved_estimate = Math.max(
        0,
        original_tokens_estimate - transformed_tokens_estimate
    );
    const percentage_saved =
        original_tokens_estimate > 0
            ? Math.round((tokens_saved_estimate / original_tokens_estimate) * 100)
            : 0;

    return {
        originalText: text,
        transformedText: transformed_text,
        originalTokensEstimate: original_tokens_estimate,
        transformedTokensEstimate: transformed_tokens_estimate,
        tokensSavedEstimate: tokens_saved_estimate,
        percentageSaved: percentage_saved
    };
}

// Canonical PascalCase Exports
export const stripAnsiCodes = StripAnsiCodes;
export const cleanWhitespace = CleanWhitespace;
export const compressGitDiff = CompressGitDiff;
export const compressGitStatusOrLog = CompressGitStatusOrLog;
export const compressGrepOutput = CompressGrepOutput;
export const compressFileListings = CompressFileListings;
export const compressGenericLogs = CompressGenericLogs;
export const compressSingleToolOutput = CompressSingleToolOutput;
export const buildSystemPromptEnhancements = BuildSystemPromptEnhancements;
export const estimateTokens = EstimateTokens;
export const trimMessages = TrimMessages;
export const applyTokenSaver = ApplyTokenSaver;

import { performWebSearch, type WebSearchResponse } from "@rynarouter/executors";
import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatMessage,
    ToolCall
} from "@rynarouter/types";

export const INTERCEPTED_SEARCH_TOOLS = new Set([
    "web_search",
    "web_search_preview",
    "search",
    "google_search",
    "duckduckgo_search",
    "brave_search",
    "bing_search"
]);

/**
 * Check if the client explicitly provided a tool in their request `tools` array.
 */
export function isToolProvidedByClient(tools: unknown, toolName: string): boolean {
    if (!Array.isArray(tools) || tools.length === 0) return false;
    return tools.some((t) => {
        if (t && typeof t === "object") {
            const fnName = (t as { function?: { name?: string } }).function?.name;
            const name = (t as { name?: string }).name;
            return fnName === toolName || name === toolName;
        }
        return false;
    });
}

/**
 * Check if a tool call should be intercepted server-side.
 * It is intercepted if:
 * 1. The tool name is a known search tool (e.g. web_search, google_search).
 * 2. The client did NOT define this tool in their request `tools` parameter.
 */
export function shouldInterceptToolCall(toolName: string, clientTools?: unknown): boolean {
    const normalized = toolName.toLowerCase().trim();
    if (!INTERCEPTED_SEARCH_TOOLS.has(normalized)) return false;
    return !isToolProvidedByClient(clientTools, toolName);
}

/**
 * Safely parse query string from tool call arguments (JSON or raw text).
 */
export function extractSearchQuery(argsString?: string): string {
    if (!argsString) return "";
    try {
        const parsed = JSON.parse(argsString);
        if (typeof parsed === "string") return parsed;
        if (parsed && typeof parsed === "object") {
            const val =
                parsed.query ??
                parsed.q ??
                parsed.search_query ??
                parsed.searchTerm ??
                parsed.search ??
                parsed.keyword ??
                parsed.text;
            if (typeof val === "string") return val;
            return JSON.stringify(parsed);
        }
    } catch {
        return argsString.trim();
    }
    return String(argsString).trim();
}

/**
 * Execute web search for a given tool call and format the response payload.
 */
export async function executeInterceptedSearch(
    toolCall: ToolCall | { id?: string; function: { name: string; arguments?: string } }
): Promise<{ toolCallId: string; result: WebSearchResponse }> {
    const toolCallId = toolCall.id || `call_search_${Date.now()}`;
    const query = extractSearchQuery(toolCall.function.arguments);
    const searchResponse = await performWebSearch(query);
    return {
        toolCallId,
        result: searchResponse
    };
}

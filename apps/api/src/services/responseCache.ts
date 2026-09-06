import { createHash } from "node:crypto";
import type { ChatCompletionRequest, ChatCompletionResponse } from "@rynarouter/types";
import { getSettingDB } from "@rynarouter/db";

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const entries = new Map<string, { expiresAt: number; response: ChatCompletionResponse }>();

export function cacheEnabled(): boolean {
    return getSettingDB("cache_enabled", "false") === "true";
}

function cacheKeyFor(req: ChatCompletionRequest): string {
    return createHash("sha256")
        .update(
            JSON.stringify({
                model: req.model,
                messages: req.messages,
                tools: req.tools ?? null,
                temperature: req.temperature ?? null
            })
        )
        .digest("hex");
}

export function getCachedResponse(req: ChatCompletionRequest): ChatCompletionResponse | undefined {
    if (!cacheEnabled()) return undefined;
    const key = cacheKeyFor(req);
    const hit = entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
        entries.delete(key);
        return undefined;
    }
    return hit.response;
}

export function setCachedResponse(req: ChatCompletionRequest, response: ChatCompletionResponse): void {
    if (!cacheEnabled()) return;
    const key = cacheKeyFor(req);
    if (entries.size >= CACHE_MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of entries) {
            if (v.expiresAt < now) entries.delete(k);
        }
        while (entries.size >= CACHE_MAX_ENTRIES) {
            const oldest = entries.keys().next().value;
            if (oldest === undefined) break;
            entries.delete(oldest);
        }
    }
    entries.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, response });
}

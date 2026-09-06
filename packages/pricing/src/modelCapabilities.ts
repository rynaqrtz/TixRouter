import { loadModelsDevData } from "./parser.js";
import type { ModelsDevModel } from "./types.js";

let modelsDevCache: Record<string, ModelsDevModel> | null = null;

function getModelsDevData(): Record<string, ModelsDevModel> {
    if (modelsDevCache === null) {
        try {
            modelsDevCache = loadModelsDevData();
        } catch {
            modelsDevCache = {};
        }
    }
    return modelsDevCache!;
}

/**
 * Strip provider prefix from model id: "openai/gpt-4o" -> "gpt-4o"
 */
function stripProviderPrefix(model: string): string {
    const slash = model.indexOf("/");
    return slash >= 0 ? model.slice(slash + 1) : model;
}

/**
 * Check if a model supports tool calling based on models.dev data.
 * Returns true (supports tools) by default when data is unavailable.
 */
export function modelSupportsToolCalling(model: string): boolean {
    if (!model) return true;

    const data = getModelsDevData();
    const keys = [model, stripProviderPrefix(model), model.toLowerCase(), stripProviderPrefix(model).toLowerCase()];

    for (const key of keys) {
        if (key in data) {
            const entry = data[key];
            if (entry && entry.tool_call === false) return false;
            if (entry && entry.tool_call === true) return true;
        }
    }

    // Heuristic: embedding/ reranking / image-gen / tts / stt models rarely support tools
    const lower = stripProviderPrefix(model).toLowerCase();
    if (/embed|rerank|image[-_]?gen|tts|stt|whisper|audio/.test(lower)) return false;

    // Default to true — most chat models support tools
    return true;
}

/**
 * Detect if an error message indicates the model doesn't support tool calling.
 */
export function isToolCallingNotSupportedError(err: Error | string | null | undefined): boolean {
    if (!err) return false;
    const msg = typeof err === "string" ? err : err.message || "";
    return /tool.?calling.*not supported|not support.*tool|tools.*not.*supported|function.?calling.*not supported/i.test(msg);
}

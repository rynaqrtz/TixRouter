// Shared SSE error-extraction helpers for executors.

export const MODEL_CAPACITY_MESSAGE =
    "Selected model is at capacity. Please try a different model.";

function findNestedMessage(value: unknown, depth = 0): string | null {
    if (!value || depth > 6 || typeof value === "string") return null;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findNestedMessage(item, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
    if (
        typeof (obj.error as { message?: unknown })?.message === "string" &&
        (obj.error as { message: string }).message.trim()
    ) {
        return (obj.error as { message: string }).message;
    }
    if (
        typeof (obj.response as { error?: { message?: unknown } })?.error?.message === "string" &&
        (obj.response as { error: { message: string } }).error.message.trim()
    ) {
        return (obj.response as { error: { message: string } }).error.message;
    }
    for (const child of Object.values(obj)) {
        const found = findNestedMessage(child, depth + 1);
        if (found) return found;
    }
    return null;
}

/**
 * Extract a human-readable error message from an SSE body that returned 200-OK
 * but carries an upstream error. Falls back to the capacity message.
 */
export function extractSseErrorMessage(text: string, fallback: string): string {
    const exact = text?.match(
        /Selected model is at capacity\. Please try a different model\./i
    )?.[0];
    if (exact) return exact;

    for (const line of String(text || "").split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
            const message = findNestedMessage(JSON.parse(data));
            if (message) return message;
        } catch {
            // ignore
        }
    }

    return fallback || MODEL_CAPACITY_MESSAGE;
}

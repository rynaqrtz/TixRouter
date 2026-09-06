// Shared streaming helpers for executors.

// Async iterator over the non-empty trimmed lines of a fetch Response body.
// Handles both OpenAI-style "data: ..." framing and raw NDJSON lines.
export async function* streamLines(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) yield trimmed;
        }
    }
}

// Strips the SSE "data:" prefix from a line, returning null for comments/[DONE].
export function parseDataLine(line: string): string | null {
    if (!line.startsWith("data:")) return line;
    const rest = line.slice(5).trim();
    if (!rest || rest === "[DONE]") return null;
    return rest;
}

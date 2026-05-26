import type { SSEEvent } from "./types";

/**
 * Parse an SSE `ReadableStream` into a typed `AsyncGenerator<SSEEvent>`.
 * Matches the format emitted by S-LAB's `/api/generate-questions` route.
 */
export async function* parseSSE(
    body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() ?? "";

            for (const chunk of chunks) {
                const parsed = parseChunk(chunk);
                if (parsed) yield parsed;
            }
        }
        const tail = buffer.trim();
        if (tail) {
            const parsed = parseChunk(tail);
            if (parsed) yield parsed;
        }
    } finally {
        reader.releaseLock();
    }
}

function parseChunk(chunk: string): SSEEvent | null {
    const lines = chunk.split("\n");
    let event = "";
    let data = "";

    for (const line of lines) {
        if (line.startsWith("event:")) {
            event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            data += line.slice(5).trim();
        }
    }

    if (!event || !data) return null;
    try {
        return { event, data: JSON.parse(data) } as SSEEvent;
    } catch {
        return null;
    }
}

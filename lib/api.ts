import { parseSSE } from "./sse";
import type {
    GenerateQuestionsRequest,
    NumberVariation,
    SSEEvent,
    WrongProblemInput,
} from "./types";
import { mockNumberVariations } from "@/mocks/math-variations";
import { mockSseStream } from "@/mocks/career-questions";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 수학: 숫자 변형 (단발 응답).
 * Real backend: POST /api/exam-builder { action: "generate-wrong-variations", wrongProblems }
 */
export async function generateNumberVariations(
    wrongProblems: WrongProblemInput[],
    variationCount = 3,
): Promise<NumberVariation[]> {
    if (USE_MOCK) {
        await delay(800);
        return mockNumberVariations(wrongProblems, variationCount);
    }

    const res = await fetch(`${API_BASE}/api/exam-builder`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            action: "generate-wrong-variations",
            wrongProblems,
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
        success: boolean;
        result?: NumberVariation[];
        error?: string;
    };
    if (!json.success || !json.result) {
        throw new Error(json.error ?? "Unknown API error");
    }
    return json.result;
}

/**
 * 성직: 일반 변형문제 (SSE 스트림).
 * Real backend: POST /api/generate-questions → SSE { event, data }
 */
export async function* streamGenerateQuestions(
    req: GenerateQuestionsRequest,
): AsyncGenerator<SSEEvent> {
    if (USE_MOCK) {
        yield* mockSseStream(req);
        return;
    }

    const res = await fetch(`${API_BASE}/api/generate-questions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(req),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    yield* parseSSE(res.body);
}

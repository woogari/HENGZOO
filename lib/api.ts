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
 * 성직: 교과서 PDF + 옵션을 실제 Gemini 라우트로 보내 SSE 로 문제를 받는다.
 * 교과서 파일이 있으면 항상 이 실제 경로를 쓴다 (mock 우회).
 */
export async function* streamGenerateCareerQuestions(
    file: File,
    req: GenerateQuestionsRequest,
): AsyncGenerator<SSEEvent> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append(
        "payload",
        JSON.stringify({
            questionCount: req.questionCount,
            questionFormat: req.questionFormat,
            difficulty: req.difficulty,
            customTopic: req.customTopic ?? "",
        }),
    );

    const res = await fetch(`${API_BASE}/api/career/generate`, {
        method: "POST",
        body: fd,
    });
    if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = (await res.json()) as { error?: string };
            if (j.error) msg = j.error;
        } catch {
            /* not json */
        }
        throw new Error(msg);
    }
    yield* parseSSE(res.body);
}

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

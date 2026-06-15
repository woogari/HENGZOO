import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";
import type {
    Difficulty,
    GeneratedQuestion,
    QuestionFormat,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 100 * 1024 * 1024; // 100MB (교과서는 보통 큼)

interface CareerReq {
    questionCount: number;
    questionFormat: QuestionFormat;
    difficulty: Difficulty;
    customTopic?: string;
}

const FORMAT_GUIDE: Record<QuestionFormat, string> = {
    multiple_choice:
        "5지선다 객관식. choices 배열에 보기 5개를 넣고, answer 에는 정답 보기 기호(①②③④⑤ 중 하나)를 넣는다.",
    short_answer:
        "단답형. choices 는 빈 배열로 두고, answer 에는 핵심 정답 단어/구절을 넣는다.",
    csat_style:
        "수능형. 지문·자료(<보기> 등)를 활용한 5지선다로 출제한다. choices 5개와 정답 기호(①~⑤)를 넣는다.",
};

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
    easy: "교과서에 직접 서술된 사실을 확인하는 쉬운 수준.",
    medium: "개념을 이해하고 적용해야 풀리는 보통 수준.",
    hard: "여러 개념을 연결하거나 사례에 적용해야 하는 어려운 수준.",
    killer: "함정 보기와 복합 추론이 필요한 최고 난도 수준.",
};

const SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            content: { type: Type.STRING },
            choices: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            points: { type: Type.INTEGER },
        },
        required: ["content", "answer", "explanation"],
    },
} as const;

interface RawQuestion {
    content?: string;
    choices?: string[];
    answer?: string;
    explanation?: string;
    points?: number;
}

function buildPrompt(req: CareerReq): string {
    const count = Math.max(1, Math.min(req.questionCount, 30));
    const topic = req.customTopic?.trim();

    return `너는 한국 고등학교 "성공적인 직업생활" 과목의 시험 문제를 출제하는 전문 교사다.
첨부된 PDF는 학생들이 실제로 배우는 **교과서**다. 이 교과서가 유일한 출제 근거다.

[가장 중요한 규칙]
- 반드시 첨부된 교과서 PDF의 **실제 내용**에서만 문제를 출제한다. 교과서에 없는 내용을 지어내지 마라.
- 아래 "선생님 지시사항"에 페이지 번호나 단원이 적혀 있으면(예: "70쪽 암기하기", "3단원 위주"), 그 부분의 교과서 내용을 우선적으로 다뤄 문제를 낸다.
- 선생님이 강조한 주제·키워드가 있으면 그 비중을 높여 출제한다.
- 지시사항이 특정 주제(예: 면접)를 콕 집지 않았다면, 교과서에서 실제로 강조된 핵심 개념들을 골고루 다룬다. 임의로 면접/이력서 같은 한 주제만 반복하지 마라.

[출제 사양]
- 문항 수: 정확히 ${count}개.
- 유형: ${FORMAT_GUIDE[req.questionFormat]}
- 난이도: ${DIFFICULTY_GUIDE[req.difficulty]}
- explanation(해설)에는 정답 근거를 교과서 내용에 기반해 1~3문장으로 적는다. 가능하면 교과서의 어느 부분에서 나온 내용인지 언급한다.
- points 는 5로 통일한다.

[선생님 지시사항 / 수업 강조 내용]
${topic ? topic : "(특별한 지시 없음 — 교과서 전체에서 핵심 개념을 균형 있게 출제)"}

위 규칙을 지켜 JSON 배열로만 응답하라.`;
}

function sse(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return Response.json(
            { success: false, error: "요청 형식이 올바르지 않아요." },
            { status: 400 },
        );
    }

    const file = form.get("file");
    const payloadRaw = form.get("payload");

    if (!(file instanceof File)) {
        return Response.json(
            { success: false, error: "교과서 PDF가 전송되지 않았어요." },
            { status: 400 },
        );
    }
    const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
        return Response.json(
            { success: false, error: "PDF 파일만 업로드할 수 있어요." },
            { status: 400 },
        );
    }
    if (file.size > MAX_BYTES) {
        return Response.json(
            { success: false, error: "교과서 PDF가 너무 커요 (최대 100MB)." },
            { status: 400 },
        );
    }

    let parsed: CareerReq;
    try {
        parsed = JSON.parse(
            typeof payloadRaw === "string" ? payloadRaw : "{}",
        ) as CareerReq;
    } catch {
        return Response.json(
            { success: false, error: "생성 옵션을 읽지 못했어요." },
            { status: 400 },
        );
    }

    const total = Math.max(1, Math.min(parsed.questionCount || 10, 30));
    const title = "성공적인 직업생활 변형문제집";
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: string, data: unknown) =>
                controller.enqueue(encoder.encode(sse(event, data)));

            try {
                const ai = getGemini();

                send("init", {
                    title,
                    totalQuestions: total,
                    totalBatches: 1,
                    batchSize: total,
                });
                send("progress", {
                    batch: 1,
                    totalBatches: 1,
                    generatedSoFar: 0,
                    totalQuestions: total,
                    message: "교과서를 업로드하고 있어요...",
                });

                // 큰 교과서도 처리할 수 있게 Files API 로 업로드.
                const uploaded = await ai.files.upload({
                    file,
                    config: { mimeType: "application/pdf" },
                });

                // 파일이 ACTIVE 가 될 때까지 대기 (PDF 는 보통 빠름).
                let info = uploaded;
                let waited = 0;
                while (info.state === "PROCESSING" && waited < 60_000) {
                    await new Promise((r) => setTimeout(r, 1500));
                    waited += 1500;
                    info = await ai.files.get({ name: uploaded.name as string });
                }
                if (info.state === "FAILED" || !info.uri) {
                    throw new Error(
                        "교과서 PDF 처리에 실패했어요. 다른 PDF로 다시 시도해 주세요.",
                    );
                }

                send("progress", {
                    batch: 1,
                    totalBatches: 1,
                    generatedSoFar: 0,
                    totalQuestions: total,
                    message: "교과서를 읽고 문제를 만들고 있어요...",
                });

                const res = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    fileData: {
                                        fileUri: info.uri,
                                        mimeType: "application/pdf",
                                    },
                                },
                                { text: buildPrompt(parsed) },
                            ],
                        },
                    ],
                    config: {
                        temperature: 0.7,
                        responseMimeType: "application/json",
                        responseSchema: SCHEMA,
                    },
                });

                const text = res.text;
                if (!text) throw new Error("Gemini가 빈 응답을 반환했어요.");

                const raw = JSON.parse(text) as RawQuestion[];
                const questions: GeneratedQuestion[] = raw
                    .filter((q) => q.content?.trim() && q.answer?.trim())
                    .slice(0, total)
                    .map((q, i) => ({
                        order: i + 1,
                        content: q.content!.trim(),
                        choices: Array.isArray(q.choices) ? q.choices : [],
                        answer: q.answer!.trim(),
                        explanation: q.explanation?.trim() ?? "",
                        points: q.points ?? 5,
                        type:
                            parsed.questionFormat === "short_answer"
                                ? "short_answer"
                                : "multiple_choice",
                    }));

                if (questions.length === 0) {
                    throw new Error(
                        "교과서에서 문제를 만들지 못했어요. 텍스트가 또렷한 PDF인지 확인해 주세요.",
                    );
                }

                send("questions", {
                    batch: 1,
                    questions,
                    generatedSoFar: questions.length,
                    totalQuestions: questions.length,
                });
                send("done", {
                    title,
                    totalGenerated: questions.length,
                    totalRequested: total,
                    questions,
                });

                // 업로드한 파일 정리 (실패해도 무시).
                try {
                    await ai.files.delete({ name: uploaded.name as string });
                } catch {
                    /* noop */
                }
            } catch (e) {
                const error =
                    e instanceof Error
                        ? e.message
                        : "문제 생성 중 오류가 발생했어요.";
                send("batch_error", { batch: 1, error, generatedSoFar: 0 });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}

import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

const EXTRACT_PROMPT = `너는 한국 고등학교 수학 시험지·문제집 PDF에서 "문제"만 정확히 뽑아내는 도구다.

규칙:
- PDF 전체 페이지를 읽고, 학생이 풀어야 할 개별 문제를 빠짐없이 추출한다.
- 각 문제의 본문 텍스트를 사람이 읽기 좋은 형태로 옮긴다. 지수는 x², 분수는 a/b, 루트는 √ 처럼 유니코드 기호를 쓴다.
- 숫자·식은 원본 그대로 정확히 유지한다. 절대 값을 바꾸지 마라.
- 정답, 해설, 채점 기준, 페이지 머리말/꼬리말, 출처 표기는 문제 본문에서 제외한다.
- 보기(①②③④⑤)가 있으면 문제 본문에 함께 포함한다.
- questionNumber 는 시험지에 인쇄된 문제 번호를 쓰고, 번호가 없으면 등장 순서대로 1부터 매긴다.
- 문제가 하나도 없으면 빈 배열을 반환한다.`;

interface RawProblem {
    questionNumber?: number;
    questionText: string;
}

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return Response.json(
                { success: false, error: "PDF 파일이 전송되지 않았어요." },
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
                {
                    success: false,
                    error: "PDF가 너무 커요 (최대 15MB). 페이지를 나눠서 올려 주세요.",
                },
                { status: 400 },
            );
        }

        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        const ai = getGemini();

        const res = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "application/pdf",
                                data: base64,
                            },
                        },
                        { text: EXTRACT_PROMPT },
                    ],
                },
            ],
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionNumber: { type: Type.INTEGER },
                            questionText: { type: Type.STRING },
                        },
                        required: ["questionText"],
                    },
                },
            },
        });

        const text = res.text;
        if (!text) {
            return Response.json(
                {
                    success: false,
                    error: "Gemini가 빈 응답을 반환했어요. 다시 시도해 주세요.",
                },
                { status: 502 },
            );
        }

        const raw = JSON.parse(text) as RawProblem[];
        const problems = raw
            .filter((p) => p.questionText?.trim())
            .map((p, i) => ({
                id: `p${i + 1}`,
                questionNumber: p.questionNumber ?? i + 1,
                questionText: p.questionText.trim(),
                variationType: "number" as const,
            }));

        return Response.json({ success: true, problems });
    } catch (e) {
        const error =
            e instanceof Error ? e.message : "문제 추출 중 오류가 발생했어요.";
        return Response.json({ success: false, error }, { status: 500 });
    }
}

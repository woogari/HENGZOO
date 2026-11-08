import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
    getAnthropic,
    CLAUDE_MODEL,
    CLAUDE_EFFORT,
    PDF_MAX_BYTES,
    uploadPdfFile,
    pdfErrorMessage,
} from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACT_PROMPT = `너는 한국 고등학교 수학 시험지·문제집 PDF에서 "문제"만 정확히 뽑아내는 도구다.

규칙:
- PDF 전체 페이지를 읽고, 학생이 풀어야 할 개별 문제를 빠짐없이 추출한다.
- 각 문제의 본문 텍스트를 사람이 읽기 좋은 형태로 옮긴다. 지수는 x², 분수는 a/b, 루트는 √ 처럼 유니코드 기호를 쓴다.
- 숫자·식은 원본 그대로 정확히 유지한다. 절대 값을 바꾸지 마라.
- 정답, 해설, 채점 기준, 페이지 머리말/꼬리말, 출처 표기는 문제 본문에서 제외한다.
- 보기(①②③④⑤)가 있으면 문제 본문에 함께 포함한다.
- questionNumber 는 시험지에 인쇄된 문제 번호를 쓰고, 번호가 없으면 등장 순서대로 1부터 매긴다.
- 문제가 하나도 없으면 problems 를 빈 배열로 반환한다.`;

const ExtractSchema = z.object({
    problems: z.array(
        z.object({
            questionNumber: z.number().int().nullable(),
            questionText: z.string(),
        }),
    ),
});

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
        if (file.size > PDF_MAX_BYTES) {
            return Response.json(
                {
                    success: false,
                    error: "PDF 한 개 용량은 500MB까지만 올릴 수 있어요.",
                },
                { status: 400 },
            );
        }

        // Files API 로 업로드 → file_id 참조(요청 바디 32MB 제한 우회).
        const fileId = await uploadPdfFile(file);
        const ai = getAnthropic();

        const res = await ai.messages.parse({
            model: CLAUDE_MODEL,
            max_tokens: 16000,
            output_config: {
                effort: CLAUDE_EFFORT,
                format: zodOutputFormat(ExtractSchema),
            },
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: { type: "file", file_id: fileId },
                        },
                        { type: "text", text: EXTRACT_PROMPT },
                    ],
                },
            ],
        });

        const parsed = res.parsed_output;
        if (!parsed) {
            return Response.json(
                {
                    success: false,
                    error: "문제를 읽어오지 못했어요. 다시 시도해 주세요.",
                },
                { status: 502 },
            );
        }

        const problems = parsed.problems
            .filter((p) => p.questionText?.trim())
            .map((p, i) => ({
                id: `p${i + 1}`,
                questionNumber: p.questionNumber ?? i + 1,
                questionText: p.questionText.trim(),
                variationType: "number" as const,
            }));

        return Response.json({ success: true, problems });
    } catch (e) {
        return Response.json(
            { success: false, error: pdfErrorMessage(e) },
            { status: 500 },
        );
    }
}

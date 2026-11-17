import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
    getAnthropic,
    CLAUDE_MODEL,
    PDF_MAX_BYTES,
    uploadPdfFile,
    pdfErrorMessage,
} from "@/lib/anthropic";
import { DEFAULT_SUBJECT } from "@/lib/subjects";

export const runtime = "nodejs";
export const maxDuration = 120;

const outlinePrompt = (subject: string) => `너는 한국 고등학교 "${subject}" 교과서 PDF에서 **목차(단원 구조)** 를 추출하는 도구다.

규칙:
- 교과서에 목차 페이지가 있으면 그 목차를, 없으면 본문에 보이는 단원·소제목 구조를 바탕으로 추출한다.
- title 에는 교과서에 적힌 단원명(예: "Ⅲ. 진로 의사 결정과 직업 윤리", "2. 스택과 큐")을 그대로 넣는다.
- subtopics 에는 그 단원에 속한 중·소단원이나 핵심 주제(예: "의사 결정 유형", "원형 큐")를 배열로 넣는다. 없으면 빈 배열.
- 첨부된 PDF에 **실제로 있는** 단원·주제만 넣는다. 지어내지 마라.
- 등장 순서대로, 너무 잘게 쪼개지 말고 단원 단위로 묶는다 (보통 3~8개).`;

const OutlineSchema = z.object({
    units: z.array(
        z.object({
            title: z.string(),
            subtopics: z.array(z.string()),
        }),
    ),
});

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get("file");
        const subjectRaw = form.get("subject");
        const subject =
            (typeof subjectRaw === "string" && subjectRaw.trim().slice(0, 40)) ||
            DEFAULT_SUBJECT;

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
            max_tokens: 8000,
            // 목차 추출은 단순 구조 파악이라 빠르게 low 로.
            output_config: { effort: "low", format: zodOutputFormat(OutlineSchema) },
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: { type: "file", file_id: fileId },
                        },
                        { type: "text", text: outlinePrompt(subject) },
                    ],
                },
            ],
        });

        const parsed = res.parsed_output;
        if (!parsed) {
            return Response.json(
                {
                    success: false,
                    error: "목차를 읽어오지 못했어요. 다시 시도해 주세요.",
                },
                { status: 502 },
            );
        }

        const units = parsed.units
            .filter((u) => u.title?.trim())
            .map((u) => ({
                title: u.title.trim(),
                subtopics: Array.isArray(u.subtopics)
                    ? u.subtopics.filter((s) => s?.trim()).map((s) => s.trim())
                    : [],
            }));

        return Response.json({ success: true, units });
    } catch (e) {
        return Response.json(
            { success: false, error: pdfErrorMessage(e) },
            { status: 500 },
        );
    }
}

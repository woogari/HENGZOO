import Anthropic, { toFile } from "@anthropic-ai/sdk";

/**
 * 서버 전용 Anthropic(Claude) 클라이언트. ANTHROPIC_API_KEY 는 절대 클라이언트로
 * 노출되면 안 되므로 이 파일은 API 라우트(서버) 안에서만 import 해야 한다.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error(
            "ANTHROPIC_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 dev 서버를 재시작해 주세요.",
        );
    }
    if (!client) client = new Anthropic({ apiKey });
    return client;
}

export const CLAUDE_MODEL = "claude-opus-5-5";
export const CLAUDE_EFFORT = "medium" as const;

/**
 * Files API 의 파일 1개 최대 용량(500MB). 사실상 업로드 용량 제한을 없애기 위한
 * 최후의 안전장치로만 둔다. 실제로 걸리는 한계는 용량이 아니라 Claude 의
 * PDF 페이지 수(1M 컨텍스트가 아니면 약 100쪽)다.
 */
export const PDF_MAX_BYTES = 500 * 1024 * 1024;

/**
 * PDF 를 Files API 로 업로드하고 file_id 를 돌려준다.
 * 메시지 요청 바디에 PDF 본문(base64)을 넣지 않으므로 "요청당 32MB" 제한을
 * 우회한다. 덕분에 인라인 방식(원본 ~20MB)보다 훨씬 큰 교과서도 올릴 수 있다.
 */
export async function uploadPdfFile(file: File): Promise<string> {
    const ai = getAnthropic();
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await ai.files.upload({
        file: await toFile(buffer, file.name || "textbook.pdf", {
            type: "application/pdf",
        }),
    });
    return uploaded.id;
}

/**
 * PDF 처리 실패 에러를 사용자용 한국어 메시지로 바꾼다.
 * 쪽수 초과·용량 초과처럼 자주 나오는 경우를 친절하게 안내한다.
 */
export function pdfErrorMessage(e: unknown): string {
    const raw = e instanceof Error ? e.message : String(e);
    const lower = raw.toLowerCase();
    if (lower.includes("page")) {
        return "교과서 쪽수가 너무 많아요. Claude는 한 번에 약 100쪽까지만 읽을 수 있어서, 시연할 단원만 잘라서 올려 주세요.";
    }
    if (
        lower.includes("too large") ||
        lower.includes("request_too_large") ||
        lower.includes("413") ||
        lower.includes("size")
    ) {
        return "PDF 용량이 너무 커서 처리하지 못했어요. 이미지가 많은 교과서는 쪽수를 줄이거나 해상도를 낮춰 다시 올려 주세요.";
    }
    return raw;
}

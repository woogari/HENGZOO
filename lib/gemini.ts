import { GoogleGenAI } from "@google/genai";

/**
 * 서버 전용 Gemini 클라이언트. GEMINI_API_KEY 는 절대 클라이언트로 노출되면 안 되므로
 * 이 파일은 API 라우트(서버) 안에서만 import 해야 한다.
 */
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 dev 서버를 재시작해 주세요.",
        );
    }
    if (!client) client = new GoogleGenAI({ apiKey });
    return client;
}

export const GEMINI_MODEL = "gemini-2.5-flash";

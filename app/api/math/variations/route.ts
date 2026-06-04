import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";
import type { VariationType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ReqProblem {
    questionText: string;
    variationType: VariationType;
}

const TYPE_GUIDE: Record<VariationType, string> = {
    number: "숫자·계수만 바꾸고 풀이 구조와 유형은 그대로 유지한다.",
    situation:
        "문제의 상황·소재·맥락(예: 사과 → 자동차)을 바꾸되 묻는 수학 개념과 난이도는 동일하게 유지한다.",
    logic: "조건이나 묻는 방향을 바꿔(예: 역으로 묻기, 조건 추가) 같은 단원의 새 문제로 재구성한다.",
    auto: "문제 특성에 맞는 가장 자연스러운 변형 방식을 스스로 선택한다.",
};

const SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            originalQuestion: { type: Type.STRING },
            variationQuestion: { type: Type.STRING },
            variationAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            difficulty: {
                type: Type.STRING,
                enum: ["easy", "medium", "hard"],
            },
            changedElement: { type: Type.STRING },
        },
        required: [
            "originalQuestion",
            "variationQuestion",
            "variationAnswer",
            "explanation",
            "difficulty",
        ],
    },
} as const;

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as { problems?: ReqProblem[] };
        const problems = body.problems;

        if (!Array.isArray(problems) || problems.length === 0) {
            return Response.json(
                { success: false, error: "변형할 문제가 없어요." },
                { status: 400 },
            );
        }

        const list = problems
            .map(
                (p, i) =>
                    `${i + 1}. [변형방식: ${
                        TYPE_GUIDE[p.variationType] ?? TYPE_GUIDE.auto
                    }]\n원본 문제: ${p.questionText}`,
            )
            .join("\n\n");

        const prompt = `너는 한국 고등학교 수학 출제 전문가다. 아래 ${problems.length}개의 원본 문제 각각에 대해 변형 문제를 1개씩 만든다.

요청 목록:
${list}

규칙:
- 입력 순서 그대로, 같은 개수(${problems.length}개)의 변형 문제를 배열로 반환한다.
- 각 문제의 지정된 변형방식을 따른다.
- 같은 단원·개념·유형을 유지하고, 난이도는 원본과 비슷하게 한다.
- variationAnswer 는 반드시 정확하게 계산한 정답을 넣는다. 계산을 틀리지 마라.
- explanation 에는 학생이 이해할 수 있는 단계별 풀이를 한국어로 적는다.
- 지수는 x², 분수는 a/b, 루트는 √ 같은 유니코드 기호로 표기한다.
- changedElement 에는 무엇을 바꿨는지 짧게(예: "계수 변경", "상황 변경") 적는다.
- difficulty 는 easy / medium / hard 중 하나.`;

        const ai = getGemini();
        const res = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: SCHEMA,
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

        const variations = JSON.parse(text);
        return Response.json({ success: true, variations });
    } catch (e) {
        const error =
            e instanceof Error ? e.message : "변형 생성 중 오류가 발생했어요.";
        return Response.json({ success: false, error }, { status: 500 });
    }
}

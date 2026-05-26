/**
 * Mock data for the S-LAB-style 4-step math variation wizard.
 * Used in /math page. Real backend will replace these with the
 * pdf-variations API responses.
 */

export type VariationType = "auto" | "situation" | "number" | "logic";

export interface ExtractedProblem {
    id: string;
    questionNumber: number;
    questionText: string;
    variationType: VariationType;
}

export interface MathVariation {
    originalQuestion: string;
    variationQuestion: string;
    variationAnswer: string;
    explanation: string;
    difficulty: "easy" | "medium" | "hard";
    changedElement?: string;
}

export const MOCK_TOTAL_PAGES = 8;

/** Pre-canned extracted problems shown after "extract" step. */
export const MOCK_EXTRACTED: Omit<ExtractedProblem, "variationType">[] = [
    {
        id: "p1",
        questionNumber: 1,
        questionText:
            "이차방정식 x² − 5x + 6 = 0의 두 근의 합을 구하시오.",
    },
    {
        id: "p2",
        questionNumber: 2,
        questionText:
            "함수 f(x) = 3x² + 2x − 1 의 x = 2에서의 미분계수를 구하시오.",
    },
    {
        id: "p3",
        questionNumber: 3,
        questionText:
            "등차수열 {aₙ}에서 a₁ = 3, 공차 d = 4일 때, a₁₀의 값을 구하시오.",
    },
    {
        id: "p4",
        questionNumber: 4,
        questionText:
            "두 점 A(1, 2), B(4, 6) 사이의 거리를 구하시오.",
    },
    {
        id: "p5",
        questionNumber: 5,
        questionText:
            "log₂ 16 + log₃ 27 의 값을 구하시오.",
    },
    {
        id: "p6",
        questionNumber: 6,
        questionText:
            "함수 y = 2 sin x 의 최댓값과 주기를 구하시오.",
    },
];

/** Variation generator — shifts integers in the problem text by 1..N. */
export function generateMockVariations(
    selected: ExtractedProblem[],
): MathVariation[] {
    const difficulties: Array<MathVariation["difficulty"]> = [
        "easy",
        "medium",
        "hard",
    ];

    return selected.map((p, i) => {
        const shift = (i % 4) + 1;
        const variationText = p.questionText.replace(/-?\d+/g, (m) => {
            const n = parseInt(m, 10);
            return Number.isNaN(n) ? m : String(n + shift);
        });
        const changedLabel =
            p.variationType === "number"
                ? "숫자 변경"
                : p.variationType === "situation"
                ? "상황 변경"
                : p.variationType === "logic"
                ? "논리 변경"
                : "자동 선택";

        return {
            originalQuestion: p.questionText,
            variationQuestion: variationText,
            variationAnswer: estimateAnswer(p.questionText, shift),
            explanation: `원본 문제(${p.questionText.slice(0, 18)}...)의 핵심 ${
                p.variationType === "number"
                    ? "숫자 값"
                    : p.variationType === "situation"
                    ? "상황 설정"
                    : p.variationType === "logic"
                    ? "논리 흐름"
                    : "유형 요소"
            }를 변형해 같은 단원의 새 문제로 재구성했습니다. AI가 단원 핵심 개념을 유지한 채 풀이 과정을 자동 생성했어요.`,
            difficulty: difficulties[(i + shift) % difficulties.length],
            changedElement: changedLabel,
        };
    });
}

function estimateAnswer(text: string, shift: number): string {
    // Heuristic: pick the largest number from the text, add shift, return as string.
    const matches = text.match(/-?\d+/g);
    if (!matches) return "자동 계산";
    const max = Math.max(...matches.map((m) => parseInt(m, 10) || 0));
    return String(max + shift);
}

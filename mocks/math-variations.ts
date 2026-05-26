import type { NumberVariation, WrongProblemInput } from "@/lib/types";

/**
 * Mock 숫자 변형 — 입력 문제 텍스트의 모든 정수를 ±2 범위에서 치환해
 * "원본과 같은 유형, 다른 숫자"의 변형을 생성한다. 발표 시연용.
 */
export function mockNumberVariations(
    wrongProblems: WrongProblemInput[],
    count: number,
): NumberVariation[] {
    const sourceText = wrongProblems[0]?.problemText ?? "";
    const sourceAnswer = wrongProblems[0]?.correctAnswer ?? "";

    if (!sourceText.trim()) {
        return sampleVariations.slice(0, count);
    }

    return Array.from({ length: count }, (_, i) => {
        const shift = i + 1;
        const variationText = sourceText.replace(/-?\d+/g, (m) => {
            const n = parseInt(m, 10);
            if (Number.isNaN(n)) return m;
            return String(n + shift);
        });
        const variationAnswer = sourceAnswer.replace(/-?\d+/g, (m) => {
            const n = parseInt(m, 10);
            return Number.isNaN(n) ? m : String(n + shift);
        });
        return {
            originalText: sourceText,
            variationText,
            variationAnswer: variationAnswer || "정답 자동 계산 예정",
            explanation: `원본 문제의 숫자를 ${shift}씩 증가시켜 동일 유형의 새 문제를 생성했습니다.`,
        };
    });
}

const sampleVariations: NumberVariation[] = [
    {
        originalText: "이차방정식 x² − 5x + 6 = 0의 두 근의 합을 구하시오.",
        variationText: "이차방정식 x² − 7x + 12 = 0의 두 근의 합을 구하시오.",
        variationAnswer: "7",
        explanation:
            "근과 계수의 관계에 의해 두 근의 합은 −(−7)/1 = 7. 숫자만 변경된 동일 유형 문제입니다.",
    },
    {
        originalText: "이차방정식 x² − 5x + 6 = 0의 두 근의 합을 구하시오.",
        variationText: "이차방정식 x² − 9x + 20 = 0의 두 근의 합을 구하시오.",
        variationAnswer: "9",
        explanation:
            "두 근 4, 5의 합 = 9. 숫자만 변경된 동일 유형 문제입니다.",
    },
    {
        originalText: "이차방정식 x² − 5x + 6 = 0의 두 근의 합을 구하시오.",
        variationText: "이차방정식 x² − 11x + 30 = 0의 두 근의 합을 구하시오.",
        variationAnswer: "11",
        explanation:
            "두 근 5, 6의 합 = 11. 숫자만 변경된 동일 유형 문제입니다.",
    },
    {
        originalText: "이차방정식 x² − 5x + 6 = 0의 두 근의 합을 구하시오.",
        variationText: "이차방정식 x² − 13x + 42 = 0의 두 근의 합을 구하시오.",
        variationAnswer: "13",
        explanation:
            "두 근 6, 7의 합 = 13. 숫자만 변경된 동일 유형 문제입니다.",
    },
];

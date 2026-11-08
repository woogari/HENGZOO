/**
 * 검증 연구소(/lab) 공용 타입 — 서버(API)와 클라이언트(UI)가 함께 쓴다.
 *
 * 파이프라인: 출제 AI → 독립 풀이 AI(정답을 모른 채 풂) → 대조 → 판정
 *   - 통과: 출제 정답과 독립 풀이 정답이 일치하고 결함이 없음
 *   - 수정 통과: 1차 탈락 → 탈락 사유를 주고 다시 출제 → 재검증 통과
 *   - 폐기: 재검증도 실패
 */

export type LabSubject = "math" | "career";
export type GeneratorEffort = "low" | "medium";

export interface LabQuestion {
    content: string;
    /** 5지선다 보기(번호 기호 없이 내용만). 수학 주관식이면 빈 배열 */
    choices: string[];
    answer: string;
    explanation: string;
}

export interface ChoiceVerdict {
    index: number; // 0-based
    correct: boolean;
    reason: string;
}

export interface CheckResult {
    pass: boolean;
    /** 독립 풀이 AI가 낸 정답 */
    solverAnswer: string;
    /** 탈락 사유(통과면 빈 배열) */
    issues: string[];
    /** 수학: 풀이 AI가 실제로 실행한 Python 코드와 출력 */
    code?: { source: string; output: string }[];
    /** 성직: 보기별 O/X 판정 */
    choiceVerdicts?: ChoiceVerdict[];
    /** 성직: 교과서 근거 문장과 쪽수 */
    evidence?: { quote: string; page: number | null };
}

export type Verdict = "pass" | "fixed" | "discarded";

export type LabEvent =
    | {
          event: "stage";
          data: { message: string };
      }
    | {
          event: "generated";
          data: { id: number; question: LabQuestion; attempt: number };
      }
    | {
          event: "checking";
          data: { id: number; attempt: number; step: "solve" | "judge" | "repair" };
      }
    | {
          event: "checked";
          data: { id: number; attempt: number; result: CheckResult };
      }
    | {
          event: "verdict";
          data: { id: number; verdict: Verdict; finalQuestion: LabQuestion | null };
      }
    | {
          event: "summary";
          data: RunSummary;
      }
    | {
          event: "error";
          data: { message: string };
      };

export interface RunSummary {
    runId: string;
    subject: LabSubject;
    generatorEffort: GeneratorEffort;
    total: number;
    /** 1차 검증에서 바로 통과 */
    passedFirst: number;
    /** 1차 탈락 → 수정 후 통과 */
    fixed: number;
    discarded: number;
    /** 시연용으로 정답을 일부러 망가뜨린 문제 번호(없으면 null) */
    injectedId: number | null;
    /** 그 문제를 검증 엔진이 1차에서 잡아냈는가 */
    injectedCaught: boolean | null;
    elapsedMs: number;
}

/** 누적 실험 통계 (/api/lab/stats) */
export interface LabStats {
    runs: number;
    /** 심은 오류 제외, AI가 원래 만든 문제 수 */
    naturalTotal: number;
    /** 그중 1차 검증에서 탈락한 수 = 검증 없이 썼다면 나갔을 오류 후보 */
    naturalFailed: number;
    fixed: number;
    discarded: number;
    injectedRuns: number;
    injectedCaught: number;
    bySubject: Record<LabSubject, { total: number; failed: number }>;
    byEffort: Record<GeneratorEffort, { total: number; failed: number }>;
}

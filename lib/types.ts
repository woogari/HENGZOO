/**
 * 행ZOO API types — mirrors S-LAB API contracts so the mock and the
 * real backend can be swapped behind `lib/api.ts` without touching the UI.
 */

// ── Math: 숫자 변형 (S-LAB `/api/exam-builder` action: generate-wrong-variations) ──

export interface WrongProblemInput {
    problemText: string;
    correctAnswer: string;
    subject: string;
    topic?: string;
}

export interface NumberVariation {
    originalText: string;
    variationText: string;
    variationAnswer: string;
    explanation: string;
}

// ── Career: 일반 변형문제 (S-LAB `/api/generate-questions`, SSE 스트림) ──

export type QuestionFormat = "multiple_choice" | "short_answer" | "csat_style";
export type Difficulty = "easy" | "medium" | "hard" | "killer";

export interface GenerateQuestionsRequest {
    category: string;
    selectedSubjects: string[];
    selectedUnits: string[];
    selectedSubUnits?: string[];
    questionFormat: QuestionFormat;
    difficulty: Difficulty;
    questionCount: number;
    customTopic?: string;
}

export interface GeneratedQuestion {
    order: number;
    content: string;
    choices: string[];
    answer: string;
    explanation: string;
    points: number;
    type: string;
}

export type SSEEvent =
    | {
          event: "init";
          data: {
              title: string;
              totalQuestions: number;
              totalBatches: number;
              batchSize: number;
          };
      }
    | {
          event: "progress";
          data: {
              batch: number;
              totalBatches: number;
              generatedSoFar: number;
              totalQuestions: number;
              message: string;
          };
      }
    | {
          event: "questions";
          data: {
              batch: number;
              questions: GeneratedQuestion[];
              generatedSoFar: number;
              totalQuestions: number;
          };
      }
    | {
          event: "done";
          data: {
              title: string;
              totalGenerated: number;
              totalRequested: number;
              questions: GeneratedQuestion[];
          };
      }
    | {
          event: "batch_error";
          data: { batch: number; error: string; generatedSoFar: number };
      };

// ── Session payloads (sessionStorage) ───────────────────────

export interface MathSessionPayload {
    mode: "math";
    wrongProblems: WrongProblemInput[];
    variationCount: number;
    difficulty: Difficulty;
}

export interface CareerSessionPayload {
    mode: "career";
    request: GenerateQuestionsRequest;
    textbookFileName: string | null;
    textbookFileSize: number | null;
    emphasis: string;
    pastExam: string;
}

export type SessionPayload = MathSessionPayload | CareerSessionPayload;

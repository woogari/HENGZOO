import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
    getAnthropic,
    CLAUDE_MODEL,
    PDF_MAX_BYTES,
    uploadPdfFile,
    pdfErrorMessage,
} from "@/lib/anthropic";
import { appendRun } from "@/lib/labStore";
import type {
    CheckResult,
    GeneratorEffort,
    LabEvent,
    LabQuestion,
    LabSubject,
    RunSummary,
    Verdict,
} from "@/lib/lab";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * 교차검증 출제 엔진.
 *
 *  1) 출제 AI      : 문제 + 정답 + 해설 생성
 *  2) 독립 풀이 AI : 정답·해설을 "보지 않고" 문제만 받아 직접 푼다
 *                    - 수학: 서버 샌드박스에서 Python 코드를 실제로 실행해 계산
 *                    - 성직: 교과서 PDF에서 근거 문장·쪽수를 찾고 보기 5개를 하나씩 O/X 판정
 *  3) 대조         : 출제 정답 == 독립 풀이 정답? 정답이 하나뿐인가? 문제에 결함은 없는가?
 *  4) 자동 수정    : 탈락하면 탈락 사유를 출제 AI에게 돌려줘 다시 만들고 한 번 더 검증
 */

const SOLVER_EFFORT = "medium" as const;
const MAX_COUNT = 10;
const CONCURRENCY = 3;
const CHOICE_SYMBOLS = ["①", "②", "③", "④", "⑤"];

// ── 스키마 ──────────────────────────────────────────────

const QuestionSetSchema = z.object({
    questions: z.array(
        z.object({
            content: z.string(),
            choices: z.array(z.string()),
            answer: z.string(),
            explanation: z.string(),
        }),
    ),
});

const SingleQuestionSchema = z.object({
    content: z.string(),
    choices: z.array(z.string()),
    answer: z.string(),
    explanation: z.string(),
});

const MathJudgeSchema = z.object({
    solverAnswer: z.string(),
    equivalent: z.boolean(),
    defect: z.string().nullable(),
    reason: z.string(),
});

const CareerSolveSchema = z.object({
    choiceVerdicts: z.array(
        z.object({
            number: z.number().int(),
            correct: z.boolean(),
            reason: z.string(),
        }),
    ),
    selected: z.number().int(),
    evidenceQuote: z.string(),
    evidencePage: z.number().int().nullable(),
    defect: z.string().nullable(),
});

// ── 요청 ────────────────────────────────────────────────

interface RunOptions {
    subject: LabSubject;
    count: number;
    generatorEffort: GeneratorEffort;
    inject: boolean;
    /** 수학: 원본 문제 / 성직: 출제 범위·강조 내용 */
    source: string;
}

// 교과서 file_id 캐시 — 같은 PDF를 매번 다시 올리지 않는다(HMR에도 유지).
const g = globalThis as unknown as { __labFileIds?: Map<string, string> };
const fileIds = (g.__labFileIds ??= new Map<string, string>());

const DEMO_PDF = "시연용_교과서_발췌.pdf";

async function resolveTextbook(file: File | null): Promise<string> {
    if (file) {
        const key = `${file.name}:${file.size}`;
        const hit = fileIds.get(key);
        if (hit) return hit;
        const id = await uploadPdfFile(file);
        fileIds.set(key, id);
        return id;
    }
    const hit = fileIds.get("demo");
    if (hit) return hit;
    const buf = await fs.readFile(path.join(process.cwd(), DEMO_PDF));
    const demo = new File([new Uint8Array(buf)], DEMO_PDF, { type: "application/pdf" });
    const id = await uploadPdfFile(demo);
    fileIds.set("demo", id);
    return id;
}

/** 교과서 PDF 블록. cache_control 로 여러 번의 풀이 호출이 PDF를 다시 읽지 않게 한다. */
function textbookBlock(fileId: string): Anthropic.DocumentBlockParam {
    return {
        type: "document",
        source: { type: "file", file_id: fileId },
        cache_control: { type: "ephemeral" },
    };
}

// ── 1) 출제 ─────────────────────────────────────────────

function mathGenPrompt(source: string, count: number): string {
    return `너는 한국 고등학교 수학 출제 교사다. 아래 원본 문제를 바탕으로 같은 단원·유형의 변형 문제를 정확히 ${count}개 만든다.

[원본 문제]
${source}

규칙:
- 숫자·조건·상황을 바꾸되 묻는 개념과 난이도는 원본과 비슷하게 유지한다.
- 주관식(답이 수 또는 식)으로 출제한다. choices 는 빈 배열로 둔다.
- answer 에는 최종 답만 간결하게 적는다(예: "12", "x = 3 또는 x = -1", "7/2").
- explanation 에는 단계별 풀이를 적는다.
- 지수는 x², 분수는 a/b, 루트는 √ 같은 유니코드 기호로 쓴다.`;
}

function careerGenPrompt(source: string, count: number): string {
    return `너는 한국 고등학교 "성공적인 직업생활" 시험 출제 교사다. 첨부된 교과서 PDF가 유일한 출제 근거다.
교과서 내용으로 5지선다 문제를 정확히 ${count}개 만든다.

[출제 범위 / 강조 내용]
${source.trim() || "(지정 없음 — 교과서 핵심 개념을 골고루)"}

규칙:
- 교과서에 실제로 있는 내용만 출제한다.
- choices 에는 보기 5개의 내용만 넣는다(①② 같은 번호를 붙이지 마라).
- answer 에는 정답 기호 하나만 넣는다(①②③④⑤ 중 하나).
- explanation 에는 정답 근거를 교과서 내용에 기반해 1~2문장으로 적는다.`;
}

async function generateSet(
    opts: RunOptions,
    fileId: string | null,
): Promise<LabQuestion[]> {
    const ai = getAnthropic();
    const prompt =
        opts.subject === "math"
            ? mathGenPrompt(opts.source, opts.count)
            : careerGenPrompt(opts.source, opts.count);
    const content: Anthropic.ContentBlockParam[] = fileId
        ? [textbookBlock(fileId), { type: "text", text: prompt }]
        : [{ type: "text", text: prompt }];

    const res = await ai.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        output_config: {
            effort: opts.generatorEffort,
            format: zodOutputFormat(QuestionSetSchema),
        },
        messages: [{ role: "user", content }],
    });
    const out = res.parsed_output;
    if (!out || out.questions.length === 0) {
        throw new Error("출제 AI가 문제를 만들지 못했어요. 다시 시도해 주세요.");
    }
    return out.questions.slice(0, opts.count).map(clean(opts.subject));
}

async function repairQuestion(
    opts: RunOptions,
    fileId: string | null,
    q: LabQuestion,
    check: CheckResult,
): Promise<LabQuestion> {
    const ai = getAnthropic();
    const prompt = `너는 출제 교사다. 네가 낸 아래 문제가 독립 검증에서 탈락했다.

[탈락한 문제]
${formatQuestion(q)}
출제 정답: ${q.answer}

[검증 결과]
- 검증 AI가 직접 푼 답: ${check.solverAnswer || "(답을 확정하지 못함)"}
- 탈락 사유: ${check.issues.join(" / ")}

탈락 사유를 해결해 같은 개념을 묻는 문제 1개를 다시 출제하라.
${
    opts.subject === "math"
        ? "- 주관식으로, choices 는 빈 배열. answer 는 최종 답만. 계산을 처음부터 다시 확인하라."
        : "- 교과서에 근거한 5지선다. 정답이 정확히 하나만 되도록 보기를 다듬어라. choices 는 내용만, answer 는 ①~⑤ 기호 하나."
}`;
    const content: Anthropic.ContentBlockParam[] = fileId
        ? [textbookBlock(fileId), { type: "text", text: prompt }]
        : [{ type: "text", text: prompt }];

    const res = await ai.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        output_config: {
            effort: "medium",
            format: zodOutputFormat(SingleQuestionSchema),
        },
        messages: [{ role: "user", content }],
    });
    if (!res.parsed_output) throw new Error("수정 출제 실패");
    return clean(opts.subject)(res.parsed_output);
}

const clean =
    (subject: LabSubject) =>
    (q: LabQuestion): LabQuestion => ({
        content: q.content.trim(),
        choices:
            subject === "career"
                ? q.choices.map((c) => c.replace(/^\s*[①②③④⑤]\s*/, "").trim())
                : [],
        answer: q.answer.trim(),
        explanation: q.explanation.trim(),
    });

function formatQuestion(q: LabQuestion): string {
    if (q.choices.length === 0) return q.content;
    return `${q.content}\n${q.choices
        .map((c, i) => `${CHOICE_SYMBOLS[i] ?? `(${i + 1})`} ${c}`)
        .join("\n")}`;
}

/** "③", "3", "③ 내용..." → 3. 못 읽으면 null */
function choiceNumber(answer: string): number | null {
    const s = answer.trim();
    const sym = CHOICE_SYMBOLS.findIndex((c) => s.startsWith(c));
    if (sym >= 0) return sym + 1;
    const m = s.match(/^[(\s]*([1-5])/);
    return m ? Number(m[1]) : null;
}

// ── 시연용 오류 주입 ───────────────────────────────────

/** 정답을 그럴듯하게 틀리게 바꾼다. 해설은 그대로 둔다(검증 AI는 해설을 못 본다). */
function corruptAnswer(q: LabQuestion, subject: LabSubject): LabQuestion {
    if (subject === "career") {
        const n = choiceNumber(q.answer) ?? 1;
        const wrong = (n % 5) + 1;
        return { ...q, answer: CHOICE_SYMBOLS[wrong - 1] };
    }
    let replaced = false;
    const answer = q.answer.replace(/-?\d+(\.\d+)?/, (m) => {
        replaced = true;
        const v = Number(m);
        return String(Number.isInteger(v) ? v + 1 : Math.round((v + 0.5) * 100) / 100);
    });
    return { ...q, answer: replaced ? answer : `${q.answer} + 1` };
}

// ── 2)·3) 독립 풀이 + 대조 ─────────────────────────────

async function checkMath(q: LabQuestion): Promise<CheckResult> {
    const ai = getAnthropic();
    const solvePrompt = `다음 고등학교 수학 문제를 처음부터 직접 풀어라.

[문제]
${q.content}

규칙:
- 반드시 code_execution 도구로 Python(sympy 등)을 실행해 답을 계산·검산하라. 암산만으로 답하지 마라.
- 문제 조건이 모순되거나, 답이 정해지지 않거나, 정보가 부족하면 그 사실을 분명히 적어라.
- 마지막 줄에 "최종 답: ..." 형식으로 답만 적어라.`;

    const tools = [{ type: "code_execution_20260521" as const, name: "code_execution" as const }];
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: solvePrompt }];
    const blocks: Anthropic.ContentBlock[] = [];
    let res: Anthropic.Message | null = null;

    // 서버 도구 루프가 길어지면 pause_turn 으로 멈추므로 이어서 요청한다.
    for (let i = 0; i < 4; i++) {
        res = await ai.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 16000,
            output_config: { effort: SOLVER_EFFORT },
            tools,
            messages,
        });
        blocks.push(...res.content);
        if (res.stop_reason !== "pause_turn") break;
        messages = [
            ...messages,
            { role: "assistant", content: res.content as unknown as Anthropic.ContentBlockParam[] },
        ];
    }

    const code = extractCode(blocks);
    const finalText = (res?.content ?? [])
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

    const judgePrompt = `두 답이 수학적으로 같은지 판정하라.

[문제]
${q.content}

[출제자 정답]
${q.answer}

[검증자의 독립 풀이 결과]
${finalText.slice(-3000) || "(풀이 텍스트 없음)"}

[검증자가 실행한 코드의 출력]
${code.map((c) => c.output).join("\n---\n").slice(-2000) || "(없음)"}

- solverAnswer: 검증자가 최종적으로 낸 답(짧게).
- equivalent: 표기만 다르고 값이 같으면 true(예: 0.5 와 1/2, x=1 또는 x=2 와 x=2, 1). 값이 다르거나 일부만 맞으면 false.
- defect: 검증자가 문제 자체의 결함(조건 모순, 답이 여러 개로 정해지지 않음, 정보 부족)을 지적했다면 그 내용을 한 문장으로. 없으면 null.
- reason: 판정 이유 한 문장.`;

    const judge = await ai.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        output_config: { effort: "low", format: zodOutputFormat(MathJudgeSchema) },
        messages: [{ role: "user", content: judgePrompt }],
    });
    const j = judge.parsed_output;
    if (!j) throw new Error("대조 단계 실패");

    const issues: string[] = [];
    if (!j.equivalent) {
        issues.push(`출제 정답(${q.answer})과 독립 풀이 답(${j.solverAnswer})이 다름 — ${j.reason}`);
    }
    if (j.defect) issues.push(`문제 결함: ${j.defect}`);
    if (code.length === 0) issues.push("검증 AI가 코드로 검산하지 않음");

    return {
        pass: issues.length === 0,
        solverAnswer: j.solverAnswer,
        issues,
        code,
    };
}

function extractCode(blocks: Anthropic.ContentBlock[]): { source: string; output: string }[] {
    const commands = new Map<string, string>();
    const files = new Map<string, string>();
    const out: { source: string; output: string }[] = [];
    for (const b of blocks) {
        if (b.type === "server_tool_use") {
            const input = (b.input ?? {}) as Record<string, unknown>;
            if (b.name === "text_editor_code_execution") {
                // 파이썬 파일을 만든 뒤 bash 로 실행하는 경우 — 파일 내용을 기억해 둔다.
                if (typeof input.path === "string" && typeof input.file_text === "string") {
                    files.set(input.path, input.file_text);
                }
            } else {
                const cmd =
                    typeof input.command === "string"
                        ? input.command
                        : typeof input.code === "string"
                          ? input.code
                          : "";
                commands.set(b.id, cmd);
            }
        } else if (b.type === "bash_code_execution_tool_result") {
            const c = b.content;
            const output =
                c.type === "bash_code_execution_result"
                    ? [c.stdout, c.stderr].filter(Boolean).join("\n").trim()
                    : `실행 오류: ${c.error_code}`;
            let source = commands.get(b.tool_use_id) ?? "";
            const py = source.match(/([\w./-]+\.py)\b/)?.[1];
            if (py) {
                const name = py.split("/").pop() as string;
                const hit = [...files.entries()].find(([p]) => p.endsWith(name));
                if (hit) source = `# ${source}\n${hit[1]}`;
            }
            out.push({ source, output });
        }
    }
    return out.filter((c) => c.source.trim() || c.output.trim()).slice(-6);
}

async function checkCareer(q: LabQuestion, fileId: string): Promise<CheckResult> {
    const ai = getAnthropic();
    const prompt = `너는 시험 문제 검토 교사다. 첨부된 교과서만을 근거로 아래 5지선다 문제를 직접 풀고 검토하라.
(출제자의 정답은 알려주지 않는다. 스스로 판단하라.)

[문제]
${formatQuestion(q)}

- choiceVerdicts: 보기 1~5 각각에 대해 "이 문제의 정답으로 맞는 보기인가"를 교과서 근거로 판정(number 는 1~5).
- selected: 네가 고른 정답 번호(1~5).
- evidenceQuote: 정답의 근거가 되는 교과서 문장을 그대로 짧게 인용. 찾지 못하면 빈 문자열.
- evidencePage: 근거가 있는 교과서 쪽수(PDF에 인쇄된 쪽 번호). 모르면 null.
- defect: 정답이 여러 개이거나, 정답이 없거나, 교과서에 없는 내용이거나, 문제 문장이 모호하면 그 내용을 한 문장으로. 문제없으면 null.`;

    const res = await ai.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 6000,
        output_config: { effort: SOLVER_EFFORT, format: zodOutputFormat(CareerSolveSchema) },
        messages: [
            {
                role: "user",
                content: [textbookBlock(fileId), { type: "text", text: prompt }],
            },
        ],
    });
    const s = res.parsed_output;
    if (!s) throw new Error("독립 풀이 단계 실패");

    const genNum = choiceNumber(q.answer);
    const correctCount = s.choiceVerdicts.filter((v) => v.correct).length;
    const issues: string[] = [];
    if (genNum === null) issues.push(`출제 정답 형식이 잘못됨: "${q.answer}"`);
    else if (genNum !== s.selected) {
        issues.push(
            `출제 정답(${CHOICE_SYMBOLS[genNum - 1]})과 독립 풀이 답(${CHOICE_SYMBOLS[s.selected - 1] ?? s.selected})이 다름`,
        );
    }
    if (correctCount !== 1) {
        issues.push(correctCount === 0 ? "맞는 보기가 하나도 없음" : `맞는 보기가 ${correctCount}개 — 복수 정답`);
    }
    if (!s.evidenceQuote.trim()) issues.push("교과서에서 근거 문장을 찾지 못함");
    if (s.defect) issues.push(`문제 결함: ${s.defect}`);

    return {
        pass: issues.length === 0,
        solverAnswer: CHOICE_SYMBOLS[s.selected - 1] ?? String(s.selected),
        issues,
        choiceVerdicts: s.choiceVerdicts
            .filter((v) => v.number >= 1 && v.number <= 5)
            .map((v) => ({ index: v.number - 1, correct: v.correct, reason: v.reason })),
        evidence: { quote: s.evidenceQuote.trim(), page: s.evidencePage },
    };
}

// ── 실행 ────────────────────────────────────────────────

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
    const queue = [...items];
    await Promise.all(
        Array.from({ length: Math.min(limit, queue.length) }, async () => {
            while (queue.length) await fn(queue.shift() as T);
        }),
    );
}

function sseLine(e: LabEvent): string {
    return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

export async function POST(req: Request) {
    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return Response.json({ success: false, error: "요청 형식이 올바르지 않아요." }, { status: 400 });
    }

    let opts: RunOptions;
    try {
        const raw = JSON.parse(String(form.get("payload") ?? "{}")) as Partial<RunOptions>;
        opts = {
            subject: raw.subject === "career" ? "career" : "math",
            count: Math.max(1, Math.min(Number(raw.count) || 5, MAX_COUNT)),
            generatorEffort: raw.generatorEffort === "medium" ? "medium" : "low",
            inject: !!raw.inject,
            source: String(raw.source ?? ""),
        };
    } catch {
        return Response.json({ success: false, error: "옵션을 읽지 못했어요." }, { status: 400 });
    }

    if (opts.subject === "math" && !opts.source.trim()) {
        return Response.json({ success: false, error: "원본 수학 문제를 입력해 주세요." }, { status: 400 });
    }
    const upload = form.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (file && file.size > PDF_MAX_BYTES) {
        return Response.json({ success: false, error: "PDF 용량이 너무 커요." }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: LabEvent) => {
                try {
                    controller.enqueue(encoder.encode(sseLine(e)));
                } catch {
                    // 클라이언트가 연결을 끊음 — 무시
                }
            };
            const started = Date.now();

            try {
                let fileId: string | null = null;
                if (opts.subject === "career") {
                    send({ event: "stage", data: { message: "교과서를 불러오는 중..." } });
                    fileId = await resolveTextbook(file);
                }

                send({ event: "stage", data: { message: "출제 AI가 문제를 만드는 중..." } });
                const questions = await generateSet(opts, fileId);

                let injectedId: number | null = null;
                if (opts.inject && questions.length > 0) {
                    injectedId = Math.floor(Math.random() * questions.length);
                    questions[injectedId] = corruptAnswer(questions[injectedId], opts.subject);
                }

                questions.forEach((q, id) =>
                    send({ event: "generated", data: { id, question: q, attempt: 1 } }),
                );
                send({ event: "stage", data: { message: "독립 풀이 AI가 정답을 모른 채 직접 푸는 중..." } });

                const verdicts = new Map<number, Verdict>();
                let injectedCaught: boolean | null = injectedId === null ? null : false;

                const check = (q: LabQuestion) =>
                    opts.subject === "math" ? checkMath(q) : checkCareer(q, fileId as string);

                const runOne = async (id: number) => {
                    let q = questions[id];
                    for (let attempt = 1; attempt <= 2; attempt++) {
                        send({ event: "checking", data: { id, attempt, step: "solve" } });
                        let result: CheckResult;
                        try {
                            result = await check(q);
                        } catch (e) {
                            result = {
                                pass: false,
                                solverAnswer: "",
                                issues: [`검증 중 오류: ${e instanceof Error ? e.message : String(e)}`],
                            };
                        }
                        send({ event: "checked", data: { id, attempt, result } });
                        if (attempt === 1 && id === injectedId) injectedCaught = !result.pass;

                        if (result.pass) {
                            const v: Verdict = attempt === 1 ? "pass" : "fixed";
                            verdicts.set(id, v);
                            send({ event: "verdict", data: { id, verdict: v, finalQuestion: q } });
                            return;
                        }
                        if (attempt === 2) break;

                        send({ event: "checking", data: { id, attempt, step: "repair" } });
                        try {
                            q = await repairQuestion(opts, fileId, q, result);
                        } catch {
                            break;
                        }
                        send({ event: "generated", data: { id, question: q, attempt: 2 } });
                    }
                    verdicts.set(id, "discarded");
                    send({ event: "verdict", data: { id, verdict: "discarded", finalQuestion: null } });
                };

                const ids = questions.map((_, i) => i);
                if (opts.subject === "career" && ids.length > 1) {
                    // 첫 풀이가 교과서 PDF를 캐시에 올린 뒤 나머지를 병렬로 — 비용·시간 절감
                    await runOne(ids[0]);
                    await pool(ids.slice(1), CONCURRENCY, runOne);
                } else {
                    await pool(ids, CONCURRENCY, runOne);
                }

                const count = (v: Verdict) => [...verdicts.values()].filter((x) => x === v).length;
                const summary: RunSummary = {
                    runId: crypto.randomUUID(),
                    subject: opts.subject,
                    generatorEffort: opts.generatorEffort,
                    total: questions.length,
                    passedFirst: count("pass"),
                    fixed: count("fixed"),
                    discarded: count("discarded"),
                    injectedId,
                    injectedCaught,
                    elapsedMs: Date.now() - started,
                };
                await appendRun(summary).catch(() => {});
                send({ event: "summary", data: summary });
            } catch (e) {
                send({ event: "error", data: { message: pdfErrorMessage(e) } });
            } finally {
                try {
                    controller.close();
                } catch {
                    // 이미 닫힘
                }
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}

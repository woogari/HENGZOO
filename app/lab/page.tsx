"use client";

import { useEffect, useRef, useState } from "react";
import {
    AppBadge,
    AppButton,
    AppCard,
    NumberInput,
    PageHeader,
    TextArea,
} from "@/components/design-system";
import { cn } from "@/lib/cn";
import type {
    CheckResult,
    GeneratorEffort,
    LabEvent,
    LabQuestion,
    LabStats,
    LabSubject,
    RunSummary,
    Verdict,
} from "@/lib/lab";

const SAMPLE_MATH = `1. 이차방정식 x² - 5x + 6 = 0 의 두 근을 α, β 라 할 때, α² + β² 의 값을 구하시오.

2. 등차수열 {aₙ} 에서 a₃ = 7, a₇ = 19 일 때, a₁₀ 의 값을 구하시오.

3. 함수 f(x) = x³ - 3x² - 9x + 5 의 극댓값을 구하시오.`;

const SYMBOLS = ["①", "②", "③", "④", "⑤"];

interface Attempt {
    question: LabQuestion;
    result?: CheckResult;
}

interface QState {
    id: number;
    attempts: Attempt[];
    step: "queued" | "solve" | "repair" | "done";
    verdict?: Verdict;
}

type RunStatus = "idle" | "running" | "done" | "error";

// ── SSE 파서 ────────────────────────────────────────────
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LabEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
            let event = "";
            let data = "";
            for (const line of chunk.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            if (!event || !data) continue;
            try {
                yield { event, data: JSON.parse(data) } as LabEvent;
            } catch {
                // 깨진 청크 무시
            }
        }
    }
}

export default function LabPage() {
    const [subject, setSubject] = useState<LabSubject>("math");
    const [mathSource, setMathSource] = useState(SAMPLE_MATH);
    const [careerScope, setCareerScope] = useState("");
    const [textbook, setTextbook] = useState<File | null>(null);
    const [count, setCount] = useState(5);
    const [effort, setEffort] = useState<GeneratorEffort>("low");
    const [inject, setInject] = useState(true);

    const [status, setStatus] = useState<RunStatus>("idle");
    const [stage, setStage] = useState("");
    const [error, setError] = useState("");
    const [qs, setQs] = useState<QState[]>([]);
    const [summary, setSummary] = useState<RunSummary | null>(null);
    const [stats, setStats] = useState<LabStats | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const fileRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const loadStats = async () => {
        try {
            const res = await fetch("/api/lab/stats", { cache: "no-store" });
            const json = (await res.json()) as { stats?: LabStats };
            if (json.stats) setStats(json.stats);
        } catch {
            // 통계는 없어도 시연에는 지장 없음
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        if (status !== "running") return;
        const t0 = Date.now();
        const timer = setInterval(() => setElapsed(Date.now() - t0), 200);
        return () => clearInterval(timer);
    }, [status]);

    const update = (id: number, fn: (q: QState) => QState) =>
        setQs((prev) => prev.map((q) => (q.id === id ? fn(q) : q)));

    const run = async () => {
        if (status === "running") return;
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        setStatus("running");
        setError("");
        setQs([]);
        setSummary(null);
        setElapsed(0);
        setStage("시작하는 중...");

        const fd = new FormData();
        fd.append(
            "payload",
            JSON.stringify({
                subject,
                count,
                generatorEffort: effort,
                inject,
                source: subject === "math" ? mathSource : careerScope,
            }),
        );
        if (subject === "career" && textbook) fd.append("file", textbook);

        try {
            const res = await fetch("/api/lab/run", { method: "POST", body: fd, signal: ac.signal });
            if (!res.ok || !res.body) {
                const json = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            let finished = false;
            for await (const e of readEvents(res.body)) {
                switch (e.event) {
                    case "stage":
                        setStage(e.data.message);
                        break;
                    case "generated": {
                        const { id, question, attempt } = e.data;
                        if (attempt === 1) {
                            setQs((prev) =>
                                [...prev.filter((q) => q.id !== id), { id, attempts: [{ question }], step: "queued" as const }].sort(
                                    (a, b) => a.id - b.id,
                                ),
                            );
                        } else {
                            update(id, (q) => ({ ...q, step: "solve", attempts: [...q.attempts, { question }] }));
                        }
                        break;
                    }
                    case "checking":
                        update(e.data.id, (q) => ({ ...q, step: e.data.step === "repair" ? "repair" : "solve" }));
                        break;
                    case "checked":
                        update(e.data.id, (q) => {
                            const attempts = [...q.attempts];
                            const i = e.data.attempt - 1;
                            if (attempts[i]) attempts[i] = { ...attempts[i], result: e.data.result };
                            return { ...q, attempts };
                        });
                        break;
                    case "verdict":
                        update(e.data.id, (q) => ({ ...q, step: "done", verdict: e.data.verdict }));
                        break;
                    case "summary":
                        finished = true;
                        setSummary(e.data);
                        setStatus("done");
                        setStage("");
                        loadStats();
                        break;
                    case "error":
                        throw new Error(e.data.message);
                }
            }
            if (!finished) throw new Error("연결이 중간에 끊겼어요. 다시 시도해 주세요.");
        } catch (e) {
            if (ac.signal.aborted) return;
            setStatus("error");
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const doneCount = qs.filter((q) => q.step === "done").length;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
            <PageHeader
                title="AI 출제 검증 연구소"
                description="AI가 낸 문제, 믿어도 될까요? 다른 AI가 정답을 모른 채 직접 풀어 보고, 답이 다르면 걸러냅니다."
                backHref="/"
            />

            <Pipeline active={status === "running"} />

            {/* ── 설정 ── */}
            <AppCard className="mt-8">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    <Segment
                        value={subject}
                        onChange={(v) => setSubject(v as LabSubject)}
                        options={[
                            { value: "math", label: "📐 수학" },
                            { value: "career", label: "🧭 성공적인 직업생활" },
                        ]}
                        disabled={status === "running"}
                    />
                </div>

                {subject === "math" ? (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-fg-2">원본 문제</span>
                            <button
                                type="button"
                                className="text-xs text-fg-3 hover:text-fg-1 underline underline-offset-2"
                                onClick={() => setMathSource(SAMPLE_MATH)}
                            >
                                시연용 예시로 되돌리기
                            </button>
                        </div>
                        <TextArea
                            value={mathSource}
                            onChange={(e) => setMathSource(e.target.value)}
                            rows={7}
                            disabled={status === "running"}
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <AppButton
                                variant="secondary"
                                size="sm"
                                onClick={() => fileRef.current?.click()}
                                disabled={status === "running"}
                            >
                                {textbook ? "다른 교과서 PDF 선택" : "교과서 PDF 선택 (선택사항)"}
                            </AppButton>
                            <span className="text-sm text-fg-3">
                                {textbook ? `📄 ${textbook.name}` : "선택하지 않으면 시연용 교과서 발췌본을 써요"}
                            </span>
                            {textbook && (
                                <button
                                    type="button"
                                    className="text-xs text-fg-3 hover:text-fg-1 underline"
                                    onClick={() => setTextbook(null)}
                                >
                                    시연용으로 되돌리기
                                </button>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setTextbook(f);
                                    e.target.value = "";
                                }}
                            />
                        </div>
                        <TextArea
                            label="출제 범위 / 강조 내용 (선택)"
                            placeholder="예: 직업윤리, 갈등 관리 위주로"
                            value={careerScope}
                            onChange={(e) => setCareerScope(e.target.value)}
                            rows={2}
                            disabled={status === "running"}
                        />
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-end gap-6">
                    <NumberInput label="문항 수" value={count} min={1} max={10} onChange={setCount} />
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-fg-2">출제 AI 모드</span>
                        <Segment
                            value={effort}
                            onChange={(v) => setEffort(v as GeneratorEffort)}
                            options={[
                                { value: "low", label: "빠른 출제" },
                                { value: "medium", label: "신중한 출제" },
                            ]}
                            disabled={status === "running"}
                        />
                    </div>
                    <label className="flex items-center gap-2 h-10 text-sm text-fg-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={inject}
                            onChange={(e) => setInject(e.target.checked)}
                            disabled={status === "running"}
                            className="w-4 h-4 accent-[var(--color-primary)]"
                        />
                        🎯 정답이 틀린 함정 문제 1개 몰래 섞기
                    </label>
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <AppButton
                        size="lg"
                        onClick={run}
                        disabled={status === "running" || (subject === "math" && !mathSource.trim())}
                    >
                        {status === "running" ? "검증 진행 중..." : "출제하고 검증하기 →"}
                    </AppButton>
                    {status === "running" && (
                        <span className="text-sm text-fg-3 tabular-nums">
                            {stage} · {(elapsed / 1000).toFixed(0)}초
                            {qs.length > 0 && ` · ${doneCount}/${qs.length} 판정`}
                        </span>
                    )}
                </div>
                {error && (
                    <p className="mt-4 text-sm text-danger-fg bg-danger-bg rounded-md px-3 py-2">{error}</p>
                )}
            </AppCard>

            {/* ── 결과 요약 ── */}
            {summary && <SummaryPanel summary={summary} />}

            {/* ── 문항별 진행 ── */}
            {qs.length > 0 && (
                <section className="mt-8 space-y-4">
                    {qs.map((q) => (
                        <QuestionLane
                            key={q.id}
                            q={q}
                            subject={subject}
                            revealInjected={summary?.injectedId === q.id}
                        />
                    ))}
                </section>
            )}

            {status === "idle" && qs.length === 0 && (
                <p className="mt-8 text-center text-sm text-fg-4">
                    설정을 확인하고 “출제하고 검증하기”를 눌러 보세요. 보통 30초~1분 걸려요.
                </p>
            )}

            {/* ── 누적 실험 기록 ── */}
            {stats && stats.runs > 0 && <StatsPanel stats={stats} />}
        </div>
    );
}

// ── 파이프라인 도식 ─────────────────────────────────────
function Pipeline({ active }: { active: boolean }) {
    const steps = [
        { icon: "✍️", title: "출제 AI", desc: "문제·정답·해설 생성" },
        { icon: "🙈", title: "독립 풀이 AI", desc: "정답을 모른 채 직접 풂" },
        { icon: "⚖️", title: "대조", desc: "정답 일치·복수정답·근거 확인" },
        { icon: "🔧", title: "자동 수정", desc: "탈락 사유를 주고 재출제" },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((s, i) => (
                <div
                    key={s.title}
                    className={cn(
                        "relative rounded-lg border border-border-1 bg-bg-1 p-4",
                        active && "lab-pulse",
                    )}
                    style={active ? { animationDelay: `${i * 0.35}s` } : undefined}
                >
                    <div className="text-xl">{s.icon}</div>
                    <div className="mt-2 text-sm font-bold text-fg-1">
                        <span className="text-fg-4 mr-1">{i + 1}</span>
                        {s.title}
                    </div>
                    <div className="mt-1 text-xs text-fg-3">{s.desc}</div>
                </div>
            ))}
        </div>
    );
}

// ── 문항 한 줄 ─────────────────────────────────────────
function QuestionLane({
    q,
    subject,
    revealInjected,
}: {
    q: QState;
    subject: LabSubject;
    revealInjected: boolean;
}) {
    const [open, setOpen] = useState(false);
    const first = q.attempts[0];
    const last = q.attempts[q.attempts.length - 1];
    const shown = last.question;

    return (
        <AppCard
            padding="none"
            className={cn(
                "overflow-hidden transition-colors",
                q.verdict === "discarded" && "border-danger-fg/30",
                q.verdict === "fixed" && "border-warning-fg/30",
            )}
        >
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border-1 bg-bg-2">
                <span className="font-bold text-fg-1">{q.id + 1}번</span>
                <StepChips q={q} />
                <div className="ml-auto flex items-center gap-2">
                    {revealInjected && <AppBadge tone="warning">🎯 심어둔 함정 문제</AppBadge>}
                    <VerdictBadge q={q} />
                </div>
            </div>

            <div className="px-5 py-4">
                <QuestionBody question={shown} />

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AnswerBox label="출제 AI의 정답" value={shown.answer} />
                    <AnswerBox
                        label="독립 풀이 AI의 답"
                        value={last.result?.solverAnswer}
                        pending={!last.result}
                        tone={last.result ? (last.result.pass ? "success" : "danger") : undefined}
                    />
                </div>

                {q.attempts.length > 1 && first.result && (
                    <div className="mt-4 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning-fg">
                        <b>1차 탈락 사유</b>
                        <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            {first.result.issues.map((s, i) => (
                                <li key={i}>{s}</li>
                            ))}
                        </ul>
                        <p className="mt-1 text-xs opacity-80">→ 이 사유를 출제 AI에게 돌려줘 다시 만들었어요.</p>
                    </div>
                )}
                {last.result && !last.result.pass && (
                    <div className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                        <b>{q.attempts.length > 1 ? "재검증 탈락 사유" : "탈락 사유"}</b>
                        <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            {last.result.issues.map((s, i) => (
                                <li key={i}>{s}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {last.result && (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="mt-4 text-sm font-medium text-fg-2 hover:text-fg-1"
                    >
                        {open ? "▾ 검증 과정 접기" : "▸ 검증 과정 자세히 보기"}
                    </button>
                )}
                {open && (
                    <div className="mt-3 space-y-4">
                        {q.attempts.map(
                            (a, i) =>
                                a.result && (
                                    <div key={i}>
                                        {q.attempts.length > 1 && (
                                            <div className="text-xs font-bold text-fg-3 mb-2">
                                                {i === 0 ? "1차 검증 (수정 전 문제)" : "2차 검증 (수정 후 문제)"}
                                            </div>
                                        )}
                                        {i === 0 && q.attempts.length > 1 && (
                                            <div className="mb-3 rounded-md border border-border-1 p-3 text-sm text-fg-3">
                                                <QuestionBody question={a.question} small />
                                                <div className="mt-2 text-xs">출제 정답: {a.question.answer}</div>
                                            </div>
                                        )}
                                        <CheckDetail result={a.result} subject={subject} />
                                    </div>
                                ),
                        )}
                        <div className="rounded-md bg-bg-2 p-3 text-sm text-fg-2">
                            <div className="text-xs font-bold text-fg-3 mb-1">출제 AI의 해설</div>
                            {shown.explanation}
                        </div>
                    </div>
                )}
            </div>
        </AppCard>
    );
}

function QuestionBody({ question, small }: { question: LabQuestion; small?: boolean }) {
    return (
        <div className={small ? "text-sm" : ""}>
            <p className={cn("whitespace-pre-wrap text-fg-1 leading-relaxed", small ? "text-sm" : "text-md")}>
                {question.content}
            </p>
            {question.choices.length > 0 && (
                <ol className="mt-2 space-y-1">
                    {question.choices.map((c, i) => (
                        <li key={i} className="text-sm text-fg-2">
                            {SYMBOLS[i]} {c}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

function StepChips({ q }: { q: QState }) {
    const solving = q.step === "solve";
    const repairing = q.step === "repair";
    const firstFailed = q.attempts[0]?.result && !q.attempts[0].result.pass;
    const chips: { label: string; state: "done" | "active" | "fail" | "wait" }[] = [
        { label: "출제", state: "done" },
        {
            label: "독립 풀이",
            state: q.attempts[0]?.result ? (firstFailed ? "fail" : "done") : solving || q.step === "queued" ? "active" : "wait",
        },
    ];
    if (firstFailed) {
        chips.push({ label: "수정", state: repairing ? "active" : q.attempts.length > 1 ? "done" : "wait" });
        chips.push({
            label: "재검증",
            state: q.attempts[1]?.result ? (q.attempts[1].result.pass ? "done" : "fail") : q.attempts.length > 1 ? "active" : "wait",
        });
    }
    return (
        <div className="flex items-center gap-1 text-xs">
            {chips.map((c, i) => (
                <span key={c.label} className="flex items-center gap-1">
                    {i > 0 && <span className="text-fg-4">→</span>}
                    <span
                        className={cn(
                            "px-2 py-0.5 rounded-pill border",
                            c.state === "done" && "bg-success-bg text-success-fg border-success-bg",
                            c.state === "fail" && "bg-danger-bg text-danger-fg border-danger-bg",
                            c.state === "active" && "bg-bg-1 text-fg-1 border-border-3 lab-blink",
                            c.state === "wait" && "bg-bg-1 text-fg-4 border-border-1",
                        )}
                    >
                        {c.label}
                    </span>
                </span>
            ))}
        </div>
    );
}

function VerdictBadge({ q }: { q: QState }) {
    if (!q.verdict) return <AppBadge>검증 중</AppBadge>;
    if (q.verdict === "pass") return <AppBadge tone="success">✓ 1차 통과</AppBadge>;
    if (q.verdict === "fixed") return <AppBadge tone="warning">🔧 수정 후 통과</AppBadge>;
    return <AppBadge tone="danger">✕ 폐기</AppBadge>;
}

function AnswerBox({
    label,
    value,
    pending,
    tone,
}: {
    label: string;
    value?: string;
    pending?: boolean;
    tone?: "success" | "danger";
}) {
    return (
        <div
            className={cn(
                "rounded-md border px-3 py-2",
                tone === "success" && "border-success-fg/30 bg-success-bg",
                tone === "danger" && "border-danger-fg/30 bg-danger-bg",
                !tone && "border-border-1 bg-bg-2",
            )}
        >
            <div className="text-xs text-fg-3">{label}</div>
            <div className="mt-0.5 font-bold text-fg-1 break-words">
                {pending ? <span className="text-fg-4 font-normal lab-blink">푸는 중...</span> : value || "—"}
            </div>
        </div>
    );
}

function CheckDetail({ result, subject }: { result: CheckResult; subject: LabSubject }) {
    if (subject === "math") {
        return (
            <div className="space-y-2">
                <div className="text-xs font-bold text-fg-3">독립 풀이 AI가 실제로 실행한 Python 코드</div>
                {(result.code ?? []).length === 0 && <p className="text-sm text-fg-4">실행한 코드가 없어요.</p>}
                {(result.code ?? []).map((c, i) => (
                    <div key={i} className="rounded-md overflow-hidden border border-border-2">
                        <pre className="bg-[#0f172a] text-[#e2e8f0] text-xs p-3 overflow-x-auto max-h-64">{c.source}</pre>
                        <pre className="bg-bg-2 text-fg-2 text-xs p-3 overflow-x-auto max-h-40 border-t border-border-1">
                            {c.output || "(출력 없음)"}
                        </pre>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="space-y-3">
            {result.evidence && (
                <div className="rounded-md border-l-4 border-primary bg-bg-2 px-3 py-2">
                    <div className="text-xs font-bold text-fg-3">
                        교과서 근거{result.evidence.page ? ` · ${result.evidence.page}쪽` : ""}
                    </div>
                    <p className="mt-1 text-sm text-fg-1">
                        {result.evidence.quote ? `“${result.evidence.quote}”` : "근거를 찾지 못했어요."}
                    </p>
                </div>
            )}
            {result.choiceVerdicts && (
                <div>
                    <div className="text-xs font-bold text-fg-3 mb-1">보기별 판정</div>
                    <ul className="space-y-1">
                        {result.choiceVerdicts.map((v) => (
                            <li key={v.index} className="flex gap-2 text-sm">
                                <span className={cn("font-bold w-5 shrink-0", v.correct ? "text-success-fg" : "text-fg-4")}>
                                    {v.correct ? "O" : "X"}
                                </span>
                                <span className="text-fg-2">
                                    {SYMBOLS[v.index]} {v.reason}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ── 이번 실행 요약 ─────────────────────────────────────
function SummaryPanel({ summary: s }: { summary: RunSummary }) {
    const failedFirst = s.fixed + s.discarded;
    return (
        <AppCard className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-fg-1">이번 검증 결과</h2>
                <span className="text-sm text-fg-3">{(s.elapsedMs / 1000).toFixed(0)}초 소요</span>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="출제" value={s.total} />
                <Stat label="1차 통과" value={s.passedFirst} tone="success" />
                <Stat label="수정 후 통과" value={s.fixed} tone="warning" />
                <Stat label="폐기" value={s.discarded} tone="danger" />
            </div>
            <p className="mt-4 text-sm text-fg-2">
                검증 없이 그대로 썼다면 <b>{s.total}문제 중 {failedFirst}문제</b>가 문제 있는 채로 학생에게 나갔을 거예요.
            </p>
            {s.injectedId !== null && (
                <div
                    className={cn(
                        "mt-3 rounded-md px-3 py-2 text-sm font-medium",
                        s.injectedCaught ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg",
                    )}
                >
                    🎯 몰래 정답을 틀리게 바꿔 둔 문제는 <b>{s.injectedId + 1}번</b>이었어요 →{" "}
                    {s.injectedCaught ? "검증 엔진이 잡아냈어요!" : "검증 엔진이 놓쳤어요."}
                </div>
            )}
        </AppCard>
    );
}

// ── 누적 실험 기록 ─────────────────────────────────────
function StatsPanel({ stats: s }: { stats: LabStats }) {
    const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
    return (
        <AppCard className="mt-10">
            <h2 className="text-lg font-bold text-fg-1">누적 실험 기록</h2>
            <p className="mt-1 text-sm text-fg-3">
                지금까지 {s.runs}번 실행, AI가 직접 낸 문제 {s.naturalTotal}개(함정 문제 제외)를 검증했어요.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat
                    label="AI 출제 오류율 (검증 전)"
                    value={pct(s.naturalFailed, s.naturalTotal)}
                    sub={`${s.naturalFailed} / ${s.naturalTotal}문제`}
                    tone="danger"
                />
                <Stat
                    label="함정 문제 검출률"
                    value={pct(s.injectedCaught, s.injectedRuns)}
                    sub={`${s.injectedCaught} / ${s.injectedRuns}회`}
                    tone="success"
                />
                <Stat
                    label="자동 수정 성공"
                    value={pct(s.fixed, s.fixed + s.discarded)}
                    sub={`수정 ${s.fixed} · 폐기 ${s.discarded}`}
                    tone="warning"
                />
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Breakdown
                    title="과목별 오류율"
                    rows={[
                        { label: "수학", ...s.bySubject.math },
                        { label: "성공적인 직업생활", ...s.bySubject.career },
                    ]}
                />
                <Breakdown
                    title="출제 모드별 오류율"
                    rows={[
                        { label: "빠른 출제", ...s.byEffort.low },
                        { label: "신중한 출제", ...s.byEffort.medium },
                    ]}
                />
            </div>
        </AppCard>
    );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; total: number; failed: number }[] }) {
    return (
        <div>
            <div className="text-xs font-bold text-fg-3 mb-2">{title}</div>
            <div className="space-y-2">
                {rows.map((r) => {
                    const rate = r.total > 0 ? r.failed / r.total : 0;
                    return (
                        <div key={r.label}>
                            <div className="flex justify-between text-fg-2">
                                <span>{r.label}</span>
                                <span className="tabular-nums text-fg-3">
                                    {r.total > 0 ? `${(rate * 100).toFixed(1)}% (${r.failed}/${r.total})` : "기록 없음"}
                                </span>
                            </div>
                            <div className="mt-1 h-2 rounded-pill bg-bg-3 overflow-hidden">
                                <div className="h-full bg-danger-fg/70" style={{ width: `${rate * 100}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: number | string;
    sub?: string;
    tone?: "success" | "warning" | "danger";
}) {
    return (
        <div className="rounded-lg border border-border-1 bg-bg-2 px-4 py-3">
            <div className="text-xs text-fg-3">{label}</div>
            <div
                className={cn(
                    "mt-1 text-2xl font-bold tabular-nums",
                    tone === "success" && "text-success-fg",
                    tone === "warning" && "text-warning-fg",
                    tone === "danger" && "text-danger-fg",
                    !tone && "text-fg-1",
                )}
            >
                {value}
            </div>
            {sub && <div className="text-xs text-fg-4 mt-0.5">{sub}</div>}
        </div>
    );
}

function Segment({
    value,
    onChange,
    options,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
}) {
    return (
        <div className="inline-flex rounded-md border border-border-2 bg-bg-2 p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        "h-9 px-3 rounded-[10px] text-sm font-medium transition-colors disabled:cursor-not-allowed",
                        value === o.value ? "bg-bg-1 text-fg-1 shadow-xs" : "text-fg-3 hover:text-fg-1",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

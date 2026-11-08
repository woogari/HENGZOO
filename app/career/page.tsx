"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
    AppButton,
    NumberInput,
    PageHeader,
    Select,
    TextArea,
} from "@/components/design-system";
import { newSessionId, saveSession } from "@/lib/session";
import { stashCareerFile } from "@/lib/careerHandoff";
import type { Difficulty, QuestionFormat } from "@/lib/types";

interface OutlineUnit {
    title: string;
    subtopics: string[];
}

type Step = "upload" | "config" | "result";
const STEPS: Step[] = ["upload", "config", "result"];
const STEP_LABEL: Record<Step, string> = {
    upload: "교과서 업로드",
    config: "목차·범위 선택",
    result: "변형문제",
};

const formatOptions: Array<{ value: QuestionFormat; label: string }> = [
    { value: "multiple_choice", label: "5지선다" },
    { value: "short_answer", label: "단답형" },
    { value: "csat_style", label: "수능형" },
];

const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: "easy", label: "쉬움" },
    { value: "medium", label: "보통" },
    { value: "hard", label: "어려움" },
];

export default function CareerPage() {
    const router = useRouter();

    const [step, setStep] = useState<Step>("upload");
    const [textbook, setTextbook] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [outline, setOutline] = useState<OutlineUnit[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [emphasis, setEmphasis] = useState("");
    const [count, setCount] = useState(10);
    const [format, setFormat] = useState<QuestionFormat>("multiple_choice");
    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setError("PDF 파일만 업로드할 수 있어요.");
            return;
        }
        await extractOutline(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const extractOutline = async (file: File) => {
        setExtracting(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/career/outline", {
                method: "POST",
                body: fd,
            });
            const json = (await res.json()) as {
                success: boolean;
                units?: OutlineUnit[];
                error?: string;
            };
            if (!res.ok || !json.success || !json.units) {
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            setTextbook(file);
            setOutline(json.units);
            setSelected(new Set());
            setStep("config");
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "목차 추출 중 오류가 발생했어요.",
            );
        } finally {
            setExtracting(false);
        }
    };

    const toggleUnit = (title: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === outline.length) setSelected(new Set());
        else setSelected(new Set(outline.map((u) => u.title)));
    };

    const reset = () => {
        setStep("upload");
        setTextbook(null);
        setOutline([]);
        setSelected(new Set());
        setError("");
    };

    const canSubmit =
        !!textbook && (selected.size > 0 || emphasis.trim().length > 0);

    const onSubmit = () => {
        if (!canSubmit || submitting) return;
        setSubmitting(true);
        const id = newSessionId();
        if (textbook) stashCareerFile(id, textbook);

        const scopeBlock =
            selected.size > 0
                ? `[출제 범위 — 아래 단원에서만 출제]\n${[...selected]
                      .map((t) => `- ${t}`)
                      .join("\n")}`
                : null;
        const emphasisBlock = emphasis.trim()
            ? `[수업 강조 내용 / 강의 녹음]\n${emphasis.trim()}`
            : null;

        saveSession(id, {
            mode: "career",
            textbookFileName: textbook?.name ?? null,
            textbookFileSize: textbook?.size ?? null,
            emphasis: emphasis.trim(),
            pastExam: "",
            request: {
                category: "career",
                selectedSubjects: ["career-textbook"],
                selectedUnits: selected.size > 0 ? [...selected] : ["전체"],
                questionFormat: format,
                difficulty,
                questionCount: count,
                customTopic: [scopeBlock, emphasisBlock]
                    .filter(Boolean)
                    .join("\n\n"),
            },
        });
        router.push(`/results?session=${id}&mode=career`);
    };

    const stepIdx = STEPS.indexOf(step);

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <PageHeader
                title="성공적인 직업생활 변형문제"
                description="교과서를 올리면 목차를 뽑아드려요. 강조 단원만 골라 변형 문제를 만듭니다."
                backHref="/"
            />

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
                {STEPS.map((s, i) => {
                    const done = stepIdx > i;
                    const active = step === s;
                    return (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    active
                                        ? "bg-primary text-primary-on"
                                        : done
                                        ? "bg-success-fg text-white"
                                        : "bg-bg-3 text-fg-4"
                                }`}
                            >
                                {done ? "✓" : i + 1}
                            </div>
                            <span
                                className={`text-sm font-bold whitespace-nowrap ${
                                    active
                                        ? "text-fg-1"
                                        : done
                                        ? "text-fg-2"
                                        : "text-fg-4"
                                }`}
                            >
                                {STEP_LABEL[s]}
                            </span>
                            {i < STEPS.length - 1 && (
                                <span className="text-fg-4 mx-1">›</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && (
                <div
                    className="mb-6 px-4 py-3 bg-danger-bg text-danger-fg border border-danger-bg rounded-md text-sm font-bold"
                    role="alert"
                >
                    ⚠ {error}
                </div>
            )}

            {/* ── Step 1: Upload + 목차 추출 ─────────────────── */}
            {step === "upload" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-8">
                    <div
                        className="border-2 border-dashed border-border-3 rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-bg-2 transition-colors"
                        onClick={() =>
                            !extracting && fileInputRef.current?.click()
                        }
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={handleFileSelect}
                        />
                        {extracting ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
                                <p className="text-fg-1 font-bold">
                                    교과서 목차를 분석하는 중...
                                </p>
                                <p className="text-xs text-fg-4">
                                    PDF를 읽고 단원 구조를 뽑고 있어요 (수십 초).
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mx-auto mb-4 w-12 h-12 text-fg-3 flex items-center justify-center">
                                    <svg
                                        width="48"
                                        height="48"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                    </svg>
                                </div>
                                <p className="text-lg font-bold text-fg-1 mb-2">
                                    교과서 PDF를 업로드하세요
                                </p>
                                <p className="text-sm text-fg-3">
                                    올리면 목차(단원)를 자동으로 뽑아드려요 · 용량
                                    제한 없음
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-fg-3">
                        <Tip emoji="📖" title="목차 자동 추출">
                            교과서를 읽어 대단원·소단원 구조를 뽑아냅니다.
                        </Tip>
                        <Tip emoji="🎯" title="강조 단원만 선택">
                            선생님이 강조하신 단원만 골라 출제 범위를 좁혀요.
                        </Tip>
                        <Tip emoji="🎙" title="강의 녹음 반영">
                            수업 강조·녹음 내용을 붙여넣으면 출제에 반영됩니다.
                        </Tip>
                    </div>
                </section>
            )}

            {/* ── Step 2: 목차·범위·강조·문제수 ─────────────── */}
            {step === "config" && (
                <div className="space-y-8">
                    {/* 업로드된 파일 */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-bg-1 border border-border-2 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-10 h-10 rounded-md bg-primary text-primary-on flex items-center justify-center text-xs font-bold">
                                PDF
                            </div>
                            <div className="min-w-0">
                                <div className="text-base font-medium text-fg-1 truncate">
                                    {textbook?.name}
                                </div>
                                <div className="text-xs text-fg-4 mt-0.5">
                                    목차 {outline.length}개 단원 추출됨
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={reset}
                            className="shrink-0 px-3 py-1.5 bg-bg-3 hover:bg-bg-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            🗑 다시 업로드
                        </button>
                    </div>

                    {/* 목차 선택 */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-fg-1">
                                    출제 범위 단원 선택
                                </h3>
                                <p className="text-sm text-fg-3 mt-0.5">
                                    강조하신 단원만 고르세요. 선택하지 않으면
                                    교과서 전체에서 균형 있게 출제돼요.
                                </p>
                            </div>
                            {outline.length > 0 && (
                                <button
                                    type="button"
                                    onClick={selectAll}
                                    className="shrink-0 px-3 py-1.5 bg-bg-3 hover:bg-bg-2 rounded-lg text-sm font-bold transition-colors"
                                >
                                    {selected.size === outline.length
                                        ? "전체 해제"
                                        : "전체 선택"}
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {outline.map((u) => {
                                const checked = selected.has(u.title);
                                return (
                                    <div
                                        key={u.title}
                                        onClick={() => toggleUnit(u.title)}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                                            checked
                                                ? "border-primary bg-primary-soft/50"
                                                : "border-border-1 hover:border-border-3"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                    checked
                                                        ? "bg-primary border-primary"
                                                        : "border-border-3"
                                                }`}
                                            >
                                                {checked && (
                                                    <svg
                                                        width="12"
                                                        height="12"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="white"
                                                        strokeWidth="3"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M20 6L9 17l-5-5" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-fg-1">
                                                    {u.title}
                                                </div>
                                                {u.subtopics.length > 0 && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {u.subtopics.map(
                                                            (s, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="text-xs bg-bg-3 text-fg-3 px-2 py-0.5 rounded-pill"
                                                                >
                                                                    {s}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 강조 / 강의 녹음 */}
                    <TextArea
                        label="수업 강조 내용 / 강의 녹음"
                        optional
                        placeholder={`예) 오늘 '합리적인 진로 의사 결정 과정 5단계'가 시험에 꼭 나옵니다. 하렌의 의사 결정 유형도 반드시 외우세요...`}
                        value={emphasis}
                        onChange={(e) => setEmphasis(e.target.value)}
                        rows={6}
                        showCount
                        hint="강조하신 내용이나 수업 녹음을 텍스트로 붙여넣으면 출제 비중에 반영됩니다."
                    />

                    {/* 문제 수 / 유형 / 난이도 */}
                    <div className="flex flex-wrap items-end gap-6">
                        <NumberInput
                            label="문제 수"
                            value={count}
                            min={1}
                            max={15}
                            onChange={setCount}
                        />
                        <Select
                            label="유형"
                            value={format}
                            onChange={(e) =>
                                setFormat(e.target.value as QuestionFormat)
                            }
                            options={formatOptions}
                        />
                        <Select
                            label="난이도"
                            value={difficulty}
                            onChange={(e) =>
                                setDifficulty(e.target.value as Difficulty)
                            }
                            options={difficultyOptions}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border-1">
                        <span className="text-sm text-fg-3">
                            {selected.size > 0
                                ? `${selected.size}개 단원에서 ${count}문제`
                                : `교과서 전체에서 ${count}문제`}
                        </span>
                        <AppButton
                            size="lg"
                            onClick={onSubmit}
                            disabled={!canSubmit || submitting}
                        >
                            {submitting
                                ? "이동 중..."
                                : "변형 문제 생성하기 →"}
                        </AppButton>
                    </div>
                </div>
            )}
        </div>
    );
}

function Tip({
    emoji,
    title,
    children,
}: {
    emoji: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-bg-2 border border-border-1 rounded-xl p-4">
            <div className="text-base mb-1">{emoji}</div>
            <div className="text-sm font-bold text-fg-1">{title}</div>
            <p className="mt-1 text-xs text-fg-3 leading-relaxed">{children}</p>
        </div>
    );
}

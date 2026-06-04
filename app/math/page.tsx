"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/design-system";
import type {
    ExtractedProblem,
    MathVariation,
    VariationType,
} from "@/lib/types";

type Step = "upload" | "select" | "result";
const STEPS: Step[] = ["upload", "select", "result"];
const STEP_LABEL: Record<Step, { full: string; short?: string }> = {
    upload: { full: "PDF 업로드", short: "업로드" },
    select: { full: "문제 선택", short: "문제" },
    result: { full: "변형문제", short: "변형" },
};

const VARIATION_TYPE_OPTIONS: Array<{
    value: VariationType;
    label: string;
    color: string;
}> = [
    {
        value: "auto",
        label: "🤖 자동 선택",
        color: "bg-purple-100 text-purple-600",
    },
    {
        value: "situation",
        label: "상황 변형",
        color: "bg-blue-100 text-blue-600",
    },
    {
        value: "number",
        label: "숫자 변형",
        color: "bg-orange-100 text-orange-600",
    },
    {
        value: "logic",
        label: "논리 변형",
        color: "bg-green-100 text-green-600",
    },
];

export default function MathPage() {
    const [step, setStep] = useState<Step>("upload");
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    const [extracting, setExtracting] = useState(false);
    const [extractMessage, setExtractMessage] = useState("");

    const [problems, setProblems] = useState<ExtractedProblem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [generating, setGenerating] = useState(false);
    const [variations, setVariations] = useState<MathVariation[]>([]);
    const [error, setError] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── handlers ─────────────────────────────────────── */

    const handleFileSelect = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setError("PDF 파일만 업로드할 수 있어요.");
            return;
        }
        setError("");
        setPdfFile(file);
        await extractProblems(file);
        // 같은 파일 다시 선택할 수 있도록 input 초기화
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const extractProblems = async (file: File) => {
        setExtracting(true);
        setExtractMessage("PDF에서 문제를 추출하는 중...");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/math/extract", {
                method: "POST",
                body: fd,
            });
            const json = (await res.json()) as {
                success: boolean;
                problems?: ExtractedProblem[];
                error?: string;
            };
            if (!res.ok || !json.success || !json.problems) {
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            if (json.problems.length === 0) {
                throw new Error(
                    "PDF에서 문제를 찾지 못했어요. 문제가 또렷하게 보이는 PDF인지 확인해 주세요.",
                );
            }
            setProblems(json.problems);
            setSelectedIds(new Set(json.problems.map((p) => p.id)));
            setStep("select");
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "문제 추출 중 오류가 발생했어요.",
            );
        } finally {
            setExtracting(false);
            setExtractMessage("");
        }
    };

    const toggleProblem = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const changeVariationType = (id: string, type: VariationType) => {
        setProblems((prev) =>
            prev.map((p) => (p.id === id ? { ...p, variationType: type } : p)),
        );
    };

    const selectAll = () => {
        if (selectedIds.size === problems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(problems.map((p) => p.id)));
        }
    };

    const setAllVariationType = (type: VariationType) => {
        setProblems((prev) => prev.map((p) => ({ ...p, variationType: type })));
    };

    const generateVariations = async () => {
        if (selectedIds.size === 0) return;
        const selected = problems.filter((p) => selectedIds.has(p.id));
        setGenerating(true);
        setError("");
        try {
            const res = await fetch("/api/math/variations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problems: selected.map((p) => ({
                        questionText: p.questionText,
                        variationType: p.variationType,
                    })),
                }),
            });
            const json = (await res.json()) as {
                success: boolean;
                variations?: MathVariation[];
                error?: string;
            };
            if (!res.ok || !json.success || !json.variations) {
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            setVariations(json.variations);
            setStep("result");
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "변형 생성 중 오류가 발생했어요.",
            );
        } finally {
            setGenerating(false);
        }
    };

    const reset = () => {
        setStep("upload");
        setPdfFile(null);
        setProblems([]);
        setSelectedIds(new Set());
        setVariations([]);
        setError("");
    };

    const stepIdx = STEPS.indexOf(step);

    /* ── render ──────────────────────────────────────── */

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            <PageHeader
                title="📐 수학 변형문제 (PDF)"
                description="시험지·문제집 PDF에서 문제를 추출하고, AI로 같은 유형의 변형 문제를 만들어드려요."
                backHref="/"
            />

            {/* Step Indicator */}
            <div
                className="flex flex-nowrap items-center justify-center gap-1 sm:gap-4 mb-8 w-full px-2 sm:px-0"
                data-print-hide
            >
                {STEPS.map((s, i) => {
                    const done = stepIdx > i;
                    const active = step === s;
                    return (
                        <div key={s} className="flex items-center gap-1 sm:gap-2">
                            <div
                                className={`flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
                                    active
                                        ? "bg-purple-500 text-white"
                                        : done
                                        ? "bg-green-500 text-white"
                                        : "bg-bg-3 text-fg-4"
                                }`}
                            >
                                {done ? "✓" : i + 1}
                            </div>
                            <span
                                className={`text-xs sm:text-sm font-bold whitespace-nowrap tracking-tight ${
                                    active
                                        ? "text-purple-600"
                                        : done
                                        ? "text-fg-2"
                                        : "text-fg-4"
                                }`}
                            >
                                <span className="hidden sm:inline">
                                    {STEP_LABEL[s].full}
                                </span>
                                <span className="sm:hidden">
                                    {STEP_LABEL[s].short ?? STEP_LABEL[s].full}
                                </span>
                            </span>
                            {i < STEPS.length - 1 && (
                                <svg
                                    className="text-fg-4 shrink-0"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && (
                <div
                    className="bg-danger-bg border border-danger-bg/40 rounded-xl p-4 mb-6 flex items-center gap-3"
                    role="alert"
                >
                    <span className="text-danger-fg font-bold">⚠ {error}</span>
                </div>
            )}

            {/* Generating banner */}
            {generating && (
                <div className="mb-6 bg-bg-1 rounded-xl p-4 shadow-xs border border-border-1 flex items-center gap-3">
                    <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <div>
                        <p className="font-bold text-blue-600 text-sm">
                            🔄 AI가 변형문제를 생성하고 있어요...
                        </p>
                        <p className="text-xs text-fg-4 mt-0.5">
                            문제 수에 따라 10~30초 정도 걸릴 수 있어요.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Step 1: Upload ─────────────────────────────────── */}
            {step === "upload" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-8">
                    <div
                        className="border-2 border-dashed border-purple-300 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/40 transition-colors"
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
                                <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full" />
                                <p className="text-purple-600 font-bold">
                                    {extractMessage || "파일 분석 중..."}
                                </p>
                                <p className="text-xs text-fg-4">
                                    PDF 페이지 수에 따라 시간이 걸릴 수 있어요.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mx-auto mb-4 w-12 h-12 text-purple-400 flex items-center justify-center">
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
                                    PDF 파일을 업로드하세요
                                </p>
                                <p className="text-sm text-fg-3">
                                    시험지, 문제집 등에서 문제를 자동 추출하여
                                    변형합니다 (최대 15MB)
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-fg-3">
                        <Tip emoji="🔎" title="자동 문제 추출">
                            PDF 전체를 AI가 읽어 문제만 골라냅니다.
                        </Tip>
                        <Tip emoji="🎯" title="변형 유형 지정">
                            문제마다 숫자/상황/논리/자동 변형을 선택할 수
                            있어요.
                        </Tip>
                        <Tip emoji="📥" title="PDF · HWPX 다운로드">
                            완성된 변형 문제집을 시험지 양식으로 받아갈 수
                            있어요.
                        </Tip>
                    </div>
                </section>
            )}

            {/* ── Step 2: Select Problems ────────────────────────── */}
            {step === "select" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
                        <div>
                            <h3 className="font-bold text-fg-1 flex items-center gap-2">
                                <PdfIcon />
                                {pdfFile?.name ?? "업로드된 PDF"}
                            </h3>
                            <p className="text-sm text-fg-3 mt-0.5">
                                {problems.length}개 문제 추출됨
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <select
                                value="all"
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v !== "all")
                                        setAllVariationType(
                                            v as VariationType,
                                        );
                                }}
                                className="px-3 py-1.5 bg-bg-3 rounded-lg text-sm font-bold border-0 cursor-pointer"
                            >
                                <option value="all">변형유형 일괄</option>
                                <option value="situation">
                                    전체 → 상황
                                </option>
                                <option value="number">전체 → 숫자</option>
                                <option value="logic">전체 → 논리</option>
                            </select>
                            <button
                                type="button"
                                onClick={selectAll}
                                className="px-3 py-1.5 bg-bg-3 hover:bg-bg-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                {selectedIds.size === problems.length
                                    ? "선택 해제"
                                    : "전체 선택"}
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="px-3 py-1.5 bg-bg-3 hover:bg-bg-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
                            >
                                🗑 다시 업로드
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto mb-5 pr-1">
                        {problems.map((problem) => {
                            const checked = selectedIds.has(problem.id);
                            const typeOpt =
                                VARIATION_TYPE_OPTIONS.find(
                                    (o) => o.value === problem.variationType,
                                ) ?? VARIATION_TYPE_OPTIONS[0];
                            return (
                                <div
                                    key={problem.id}
                                    className={`p-4 rounded-xl border-2 transition-colors ${
                                        checked
                                            ? "border-purple-500 bg-purple-50/60"
                                            : "border-border-1 hover:border-border-3"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            onClick={() =>
                                                toggleProblem(problem.id)
                                            }
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer ${
                                                checked
                                                    ? "bg-purple-500 border-purple-500"
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
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-pill font-bold">
                                                    문제 {problem.questionNumber}
                                                </span>
                                                <select
                                                    value={problem.variationType}
                                                    onChange={(e) =>
                                                        changeVariationType(
                                                            problem.id,
                                                            e.target.value as VariationType,
                                                        )
                                                    }
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className={`text-xs px-2 py-0.5 rounded-pill font-bold border-0 cursor-pointer ${typeOpt.color}`}
                                                >
                                                    {VARIATION_TYPE_OPTIONS.map(
                                                        (o) => (
                                                            <option
                                                                key={o.value}
                                                                value={o.value}
                                                            >
                                                                {o.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </div>
                                            <p
                                                className="mt-2 text-sm text-fg-2 leading-relaxed cursor-pointer whitespace-pre-wrap"
                                                onClick={() =>
                                                    toggleProblem(problem.id)
                                                }
                                            >
                                                {problem.questionText}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={generateVariations}
                        disabled={generating || selectedIds.size === 0}
                        className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <>
                                <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                처리 중...
                            </>
                        ) : (
                            <>
                                ✨ 선택한 {selectedIds.size}개 문제 변형하기
                            </>
                        )}
                    </button>
                </section>
            )}

            {/* ── Step 3: Result ─────────────────────────────────── */}
            {step === "result" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-6">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                        <h3 className="font-bold text-fg-1 text-lg">
                            📝 변형문제 {variations.length}개 생성 완료!
                        </h3>
                        <div className="flex flex-wrap gap-2" data-print-hide>
                            <button
                                type="button"
                                onClick={() =>
                                    alert(
                                        "PDF 다운로드는 추후 지원됩니다.",
                                    )
                                }
                                className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-purple-600 transition-colors"
                            >
                                ⬇ PDF 다운로드
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    alert(
                                        "HWPX 다운로드는 추후 지원됩니다.",
                                    )
                                }
                                className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors"
                            >
                                📄 HWPX 다운로드
                            </button>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-bg-3 text-fg-2 rounded-xl font-bold text-sm hover:bg-bg-2 transition-colors"
                            >
                                인쇄
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="px-4 py-2 bg-bg-3 text-fg-2 rounded-xl font-bold text-sm hover:bg-bg-2 transition-colors"
                            >
                                새로 만들기
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {variations.map((v, i) => (
                            <article
                                key={i}
                                className="border-2 border-border-1 rounded-xl p-5 hover:border-purple-200 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <span className="bg-purple-500 text-white px-3 py-1 rounded-pill text-sm font-bold">
                                        문제 {i + 1}
                                    </span>
                                    <DifficultyBadge
                                        difficulty={v.difficulty}
                                    />
                                    {v.changedElement && (
                                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-pill font-medium">
                                            {v.changedElement}
                                        </span>
                                    )}
                                </div>

                                {/* 변형 문제 */}
                                <div className="bg-purple-50 rounded-lg p-4 mb-3 print:bg-transparent print:border print:border-border-2">
                                    <p className="font-medium text-fg-1 leading-relaxed whitespace-pre-wrap">
                                        {v.variationQuestion}
                                    </p>
                                </div>

                                {/* 정답 */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                                        정답
                                    </span>
                                    <span className="text-green-700 font-bold whitespace-pre-wrap">
                                        {v.variationAnswer}
                                    </span>
                                </div>

                                {/* 풀이 */}
                                <div className="bg-bg-2 rounded-lg p-4 print:bg-transparent print:border print:border-border-1">
                                    <div className="text-xs text-fg-3 mb-2 font-bold">
                                        📝 풀이
                                    </div>
                                    <p className="text-sm text-fg-2 leading-relaxed whitespace-pre-wrap">
                                        {v.explanation}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

/* ── Small helpers ───────────────────────────────────── */

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

function PdfIcon() {
    return (
        <span className="inline-flex items-center justify-center w-5 h-5 text-purple-500">
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
            >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
            </svg>
        </span>
    );
}

function DifficultyBadge({
    difficulty,
}: {
    difficulty: MathVariation["difficulty"];
}) {
    const map = {
        easy: { label: "기초", cls: "bg-green-100 text-green-700" },
        medium: { label: "보통", cls: "bg-yellow-100 text-yellow-700" },
        hard: { label: "심화", cls: "bg-red-100 text-red-700" },
    } as const;
    const { label, cls } = map[difficulty];
    return (
        <span
            className={`text-xs px-2 py-1 rounded-pill font-bold ${cls}`}
        >
            {label}
        </span>
    );
}

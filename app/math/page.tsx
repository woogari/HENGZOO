"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/design-system";
import {
    MOCK_EXTRACTED,
    MOCK_TOTAL_PAGES,
    generateMockVariations,
    type ExtractedProblem,
    type MathVariation,
    type VariationType,
} from "@/mocks/math-wizard";

type Step = "upload" | "page-select" | "select" | "result";
const STEPS: Step[] = ["upload", "page-select", "select", "result"];
const STEP_LABEL: Record<Step, { full: string; short?: string }> = {
    upload: { full: "PDF 업로드", short: "업로드" },
    "page-select": { full: "페이지 선택", short: "페이지" },
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MathPage() {
    const [step, setStep] = useState<Step>("upload");
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractProgress, setExtractProgress] = useState({
        current: 0,
        total: 0,
    });
    const [extractMessage, setExtractMessage] = useState("");

    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    const [includeSolution, setIncludeSolution] = useState(false);

    const [problems, setProblems] = useState<ExtractedProblem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [generating, setGenerating] = useState(false);
    const [variationProgress, setVariationProgress] = useState({
        current: 0,
        total: 0,
    });
    const [variations, setVariations] = useState<MathVariation[]>([]);
    const [error, setError] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── handlers ─────────────────────────────────────── */

    const handleFileSelect = async (
        e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } },
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setError("PDF 파일만 업로드할 수 있어요.");
            return;
        }
        setError("");
        setPdfFile(file);

        // Mock: 1.2초간 "썸네일 로드 중" 표시 후 page-select로 이동
        setExtracting(true);
        setExtractMessage("PDF 페이지 미리보기 로드 중...");
        await delay(1200);
        setExtracting(false);
        setExtractMessage("");
        setStep("page-select");
    };

    const togglePageSelection = (pageNum: number) => {
        setSelectedPages((prev) => {
            const next = new Set(prev);
            if (next.has(pageNum)) {
                next.delete(pageNum);
            } else if (next.size < 10) {
                next.add(pageNum);
            }
            return next;
        });
    };

    const extractFromSelectedPages = async () => {
        if (selectedPages.size === 0) return;
        setExtracting(true);
        const total = selectedPages.size;
        setExtractProgress({ current: 0, total });

        for (let i = 0; i < total; i++) {
            setExtractMessage(`${i + 1}/${total} 페이지 AI 분석 중...`);
            await delay(600);
            setExtractProgress({ current: i + 1, total });
        }

        // Mock: 선택한 페이지 수에 비례해서 문제 가져오기
        const take = Math.min(MOCK_EXTRACTED.length, selectedPages.size + 1);
        const extracted: ExtractedProblem[] = MOCK_EXTRACTED.slice(0, take).map(
            (p) => ({ ...p, variationType: "number" }),
        );
        setProblems(extracted);
        setSelectedIds(new Set(extracted.map((p) => p.id)));
        setExtractProgress({ current: 0, total: 0 });
        setExtractMessage("");
        setExtracting(false);
        setStep("select");
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
        const total = selected.length;
        setVariationProgress({ current: 0, total });

        const results: MathVariation[] = [];
        for (let i = 0; i < total; i++) {
            await delay(900);
            const generated = generateMockVariations([selected[i]]);
            results.push(...generated);
            setVariationProgress({ current: i + 1, total });
        }
        setVariations(results);
        setVariationProgress({ current: 0, total: 0 });
        setGenerating(false);
        setStep("result");
    };

    const reset = () => {
        setStep("upload");
        setPdfFile(null);
        setSelectedPages(new Set());
        setProblems([]);
        setSelectedIds(new Set());
        setVariations([]);
        setError("");
        setIncludeSolution(false);
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

            {/* Extract progress bar */}
            {extractProgress.total > 0 && (
                <div className="mb-6 bg-bg-1 rounded-xl p-4 shadow-xs border border-border-1">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-bold text-purple-600">
                            📄 {extractMessage || "페이지 분석 중"}
                        </span>
                        <span className="text-fg-3 tabular-nums">
                            {extractProgress.current}/{extractProgress.total}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-bg-3 rounded-pill overflow-hidden">
                        <div
                            className="h-full rounded-pill transition-all duration-700 ease-out"
                            style={{
                                width: `${
                                    (extractProgress.current /
                                        extractProgress.total) *
                                    100
                                }%`,
                                background:
                                    "linear-gradient(90deg,#c084fc,#a855f7,#ec4899)",
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Variation progress bar */}
            {variationProgress.total > 0 && (
                <div className="mb-6 bg-bg-1 rounded-xl p-4 shadow-xs border border-border-1">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-bold text-blue-600">
                            🔄 {variationProgress.current}/
                            {variationProgress.total}번째 문제 변형 생성 중...
                        </span>
                        <span className="text-fg-3 tabular-nums">
                            {variationProgress.current}/
                            {variationProgress.total}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-bg-3 rounded-pill overflow-hidden">
                        <div
                            className="h-full rounded-pill transition-all duration-700 ease-out"
                            style={{
                                width: `${
                                    (variationProgress.current /
                                        variationProgress.total) *
                                    100
                                }%`,
                                background:
                                    "linear-gradient(90deg,#60a5fa,#3b82f6,#6366f1)",
                            }}
                        />
                    </div>
                    <p className="text-xs text-fg-4 mt-1.5">
                        AI가 변형문제를 생성하고 있습니다. 문제당 평균 10~20초
                        소요됩니다.
                    </p>
                </div>
            )}

            {/* ── Step 1: Upload ─────────────────────────────────── */}
            {step === "upload" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-8">
                    <div
                        className="border-2 border-dashed border-purple-300 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/40 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
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
                                    시험지, 문제집 등에서 문제를 추출하여
                                    변형합니다
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-fg-3">
                        <Tip emoji="📄" title="페이지 단위 선택">
                            업로드 후 변형하고 싶은 페이지만 골라서 처리해요.
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

            {/* ── Step 2: Page Select ────────────────────────────── */}
            {step === "page-select" && (
                <section className="bg-bg-1 rounded-2xl shadow-xs border border-border-1 p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                        <div>
                            <h3 className="font-bold text-fg-1 flex items-center gap-2">
                                <PdfIcon />
                                {pdfFile?.name ?? "업로드된 PDF"}
                            </h3>
                            <p className="text-sm text-fg-3 mt-0.5">
                                {MOCK_TOTAL_PAGES}페이지 중 출제 페이지를
                                선택하세요 (최대 10페이지)
                            </p>
                        </div>
                        <div>
                            <span
                                className={`px-3 py-1 rounded-pill font-bold text-sm ${
                                    selectedPages.size > 0
                                        ? "bg-purple-100 text-purple-600"
                                        : "bg-bg-3 text-fg-3"
                                }`}
                            >
                                {selectedPages.size}/10 선택됨
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto p-1">
                        {Array.from({ length: MOCK_TOTAL_PAGES }).map((_, idx) => {
                            const pageNum = idx + 1;
                            const isSelected = selectedPages.has(pageNum);
                            return (
                                <div
                                    key={pageNum}
                                    onClick={() => togglePageSelection(pageNum)}
                                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-[3/4] ${
                                        isSelected
                                            ? "border-purple-500 ring-2 ring-purple-300"
                                            : "border-border-2 hover:border-purple-300"
                                    }`}
                                >
                                    <PagePlaceholder pageNum={pageNum} />
                                    <div
                                        className={`absolute bottom-0 left-0 right-0 text-center py-1 text-xs font-bold ${
                                            isSelected
                                                ? "bg-purple-500 text-white"
                                                : "bg-black/50 text-white"
                                        }`}
                                    >
                                        {pageNum}페이지
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow">
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Solution toggle */}
                    <div
                        className="mt-6 p-4 rounded-xl border"
                        style={{
                            background:
                                "linear-gradient(90deg,#fffbeb,#fff7ed)",
                            borderColor: "#fde68a",
                        }}
                    >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h4 className="font-bold text-amber-800 flex items-center gap-2">
                                    📚 해설포함 (선택사항)
                                </h4>
                                <p className="text-sm text-amber-600">
                                    원본 해설을 참고하여 풀이 품질을 높입니다
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIncludeSolution((v) => !v)}
                                className={`px-4 py-2 rounded-pill font-bold text-sm transition-all ${
                                    includeSolution
                                        ? "bg-amber-500 text-white shadow"
                                        : "bg-white text-amber-600 border-2 border-amber-300 hover:border-amber-400"
                                }`}
                            >
                                {includeSolution
                                    ? "✓ 해설포함 ON"
                                    : "해설포함 OFF"}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={reset}
                            className="px-6 py-3 bg-bg-3 text-fg-2 rounded-xl font-bold hover:bg-bg-2 transition-colors"
                        >
                            뒤로
                        </button>
                        <button
                            type="button"
                            onClick={extractFromSelectedPages}
                            disabled={selectedPages.size === 0 || extracting}
                            className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
                        >
                            {extracting ? (
                                <>
                                    <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                    문제 추출 중...
                                </>
                            ) : (
                                <>
                                    ✨ 선택한 {selectedPages.size}페이지에서
                                    문제 추출
                                </>
                            )}
                        </button>
                    </div>
                </section>
            )}

            {/* ── Step 3: Select Problems ────────────────────────── */}
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
                                🗑 다시 선택
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
                                                className="mt-2 text-sm text-fg-2 leading-relaxed cursor-pointer"
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

            {/* ── Step 4: Result ─────────────────────────────────── */}
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
                                        "PDF 다운로드는 백엔드 연동 후 지원됩니다.",
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
                                        "HWPX 다운로드는 백엔드 연동 후 지원됩니다.",
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
                                    <span className="text-green-700 font-bold">
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

function PagePlaceholder({ pageNum }: { pageNum: number }) {
    // SVG mock — looks like a faded scanned page with ruled lines.
    return (
        <svg
            viewBox="0 0 240 320"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full block"
            aria-hidden
        >
            <rect width="240" height="320" fill="#ffffff" />
            <rect width="240" height="320" fill="url(#pg-grad)" />
            <defs>
                <linearGradient
                    id="pg-grad"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                >
                    <stop offset="0" stopColor="#fafafa" />
                    <stop offset="1" stopColor="#f1f5f9" />
                </linearGradient>
            </defs>
            <text
                x="20"
                y="38"
                fontSize="14"
                fontWeight="700"
                fill="#9ca3af"
                fontFamily="Pretendard, sans-serif"
            >
                p.{pageNum}
            </text>
            {Array.from({ length: 14 }).map((_, i) => (
                <rect
                    key={i}
                    x="20"
                    y={60 + i * 16}
                    width={i % 3 === 0 ? 160 : 200}
                    height="6"
                    rx="3"
                    fill="#e5e7eb"
                />
            ))}
            <rect
                x="20"
                y={60 + 14 * 16}
                width="80"
                height="6"
                rx="3"
                fill="#e5e7eb"
            />
        </svg>
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

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    AppBadge,
    AppButton,
    PageHeader,
    ProgressBar,
    QuestionCard,
    QuestionSkeleton,
} from "@/components/design-system";
import {
    generateNumberVariations,
    streamGenerateCareerQuestions,
} from "@/lib/api";
import { loadSession } from "@/lib/session";
import { getCareerFile } from "@/lib/careerHandoff";
import type {
    CareerSessionPayload,
    GeneratedQuestion,
    MathSessionPayload,
    NumberVariation,
    SessionPayload,
} from "@/lib/types";

type Status = "idle" | "loading" | "streaming" | "done" | "error";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ResultsClient() {
    const sp = useSearchParams();
    const sessionId = sp.get("session");
    const mode = sp.get("mode") as "math" | "career" | null;

    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        message: "준비 중...",
    });
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

    const payload = useMemo<SessionPayload | null>(() => {
        if (!sessionId) return null;
        return loadSession<SessionPayload>(sessionId);
    }, [sessionId]);

    useEffect(() => {
        let cancelled = false;
        if (!payload || !mode) {
            setStatus("error");
            setError(
                "세션 정보를 찾을 수 없습니다. 처음으로 돌아가 다시 시도해 주세요.",
            );
            return;
        }

        (async () => {
            try {
                setStatus("loading");
                if (mode === "math") {
                    const m = payload as MathSessionPayload;
                    const total = m.variationCount;
                    setProgress({
                        current: 0,
                        total,
                        message: "기출을 분석하고 있어요...",
                    });
                    await delay(400);
                    const variations = await generateNumberVariations(
                        m.wrongProblems,
                        total,
                    );
                    setStatus("streaming");
                    for (let i = 0; i < variations.length; i++) {
                        if (cancelled) return;
                        const v = variations[i];
                        setQuestions((prev) => [
                            ...prev,
                            variationToQuestion(v, i + 1),
                        ]);
                        setProgress({
                            current: i + 1,
                            total: variations.length,
                            message: `변형 문제 생성 중... ${i + 1}/${
                                variations.length
                            }`,
                        });
                        await delay(360);
                    }
                    if (!cancelled) setStatus("done");
                } else {
                    const c = payload as CareerSessionPayload;
                    const file = sessionId
                        ? getCareerFile(sessionId)
                        : null;
                    if (!file) {
                        setStatus("error");
                        setError(
                            "교과서 파일을 찾을 수 없어요. 새로고침했거나 직접 주소로 들어오면 파일이 사라져요. /career 에서 교과서를 다시 올려 주세요.",
                        );
                        return;
                    }
                    setProgress({
                        current: 0,
                        total: c.request.questionCount,
                        message: "교과서를 읽고 있어요...",
                    });
                    setStatus("streaming");
                    let terminal: Status | null = null;
                    for await (const ev of streamGenerateCareerQuestions(
                        file,
                        c.request,
                    )) {
                        if (cancelled) return;
                        switch (ev.event) {
                            case "init":
                                setProgress({
                                    current: 0,
                                    total: ev.data.totalQuestions,
                                    message: `${ev.data.title} 생성 시작`,
                                });
                                break;
                            case "progress":
                                setProgress((p) => ({
                                    ...p,
                                    current: ev.data.generatedSoFar,
                                    message: ev.data.message,
                                }));
                                break;
                            case "questions":
                                setQuestions((prev) => [
                                    ...prev,
                                    ...ev.data.questions,
                                ]);
                                setProgress((p) => ({
                                    ...p,
                                    current: ev.data.generatedSoFar,
                                }));
                                break;
                            case "done":
                                setProgress((p) => ({
                                    ...p,
                                    current: ev.data.totalGenerated,
                                    message: "완료",
                                }));
                                terminal = "done";
                                setStatus("done");
                                break;
                            case "batch_error":
                                setError(ev.data.error);
                                terminal = "error";
                                setStatus("error");
                                break;
                        }
                    }
                    if (!cancelled && terminal === null) setStatus("done");
                }
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "알 수 없는 오류");
                setStatus("error");
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload, mode]);

    if (!sessionId || !mode) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-12">
                <EmptyState
                    title="세션이 비어 있어요"
                    message="처음으로 돌아가 입력부터 다시 시작해 주세요."
                />
            </div>
        );
    }

    const subject =
        mode === "math" ? "수학 (숫자 변형)" : "성공적인 직업생활";

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <PageHeader
                title="변형 문제집"
                description={`${subject} · ${questions.length}문항 생성`}
                backHref={mode === "math" ? "/math" : "/career"}
                actions={
                    <>
                        <AppButton
                            variant="secondary"
                            size="sm"
                            onClick={() => window.print()}
                            disabled={status !== "done"}
                        >
                            인쇄
                        </AppButton>
                        <AppButton
                            size="sm"
                            onClick={() =>
                                alert(
                                    "PDF 다운로드는 백엔드 연동 후 지원될 예정입니다.",
                                )
                            }
                            disabled={status !== "done"}
                        >
                            PDF 다운로드
                        </AppButton>
                    </>
                }
            />

            {error && (
                <div
                    className="mb-6 px-4 py-3 bg-danger-bg text-danger-fg border border-danger-bg rounded-md text-sm"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {status !== "done" && status !== "error" && (
                <div className="mb-8 p-5 bg-bg-1 border border-border-1 rounded-lg">
                    <ProgressBar
                        current={progress.current}
                        total={progress.total}
                        message={progress.message}
                    />
                </div>
            )}

            {status === "done" && (
                <div className="mb-8 flex items-center gap-2" data-print-hide>
                    <AppBadge tone="success">완료</AppBadge>
                    <span className="text-sm text-fg-3">
                        총 {questions.length}문항이 생성되었어요.
                    </span>
                </div>
            )}

            <div className="space-y-4">
                {questions.map((q) => (
                    <QuestionCard key={q.order} q={q} />
                ))}

                {status === "streaming" &&
                    questions.length < progress.total &&
                    Array.from({
                        length: Math.min(2, progress.total - questions.length),
                    }).map((_, i) => <QuestionSkeleton key={`s-${i}`} />)}
            </div>

            {status === "error" && questions.length === 0 && (
                <EmptyState
                    title="문제 생성에 실패했어요"
                    message="네트워크 또는 입력 데이터를 확인하고 다시 시도해 주세요."
                />
            )}
        </div>
    );
}

function EmptyState({ title, message }: { title: string; message: string }) {
    return (
        <div className="text-center py-16 bg-bg-1 border border-border-1 rounded-lg">
            <h3 className="text-lg font-semibold text-fg-1">{title}</h3>
            <p className="mt-2 text-sm text-fg-3">{message}</p>
            <div className="mt-6">
                <Link href="/">
                    <AppButton variant="secondary">홈으로 돌아가기</AppButton>
                </Link>
            </div>
        </div>
    );
}

function variationToQuestion(
    v: NumberVariation,
    order: number,
): GeneratedQuestion {
    return {
        order,
        content: v.variationText,
        choices: [],
        answer: v.variationAnswer,
        explanation: v.explanation,
        points: 5,
        type: "number_variation",
    };
}

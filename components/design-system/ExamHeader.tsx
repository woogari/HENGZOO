import type { AnswerMode } from "./AnswerModeToggle";

/**
 * 시험지 상단 제목 블록. 화면·인쇄 공통으로 보이며, 인쇄했을 때
 * 실제 시험지처럼 보이도록 이름·날짜·점수란을 포함한다.
 */
export function ExamHeader({
    title,
    count,
    mode,
}: {
    title: string;
    count: number;
    mode: AnswerMode;
}) {
    return (
        <header className="exam-avoid-break mb-6 border-b-2 border-fg-1 pb-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-fg-1 tracking-tight">
                    {title}
                    {mode === "teacher" && (
                        <span className="ml-2 align-middle text-sm font-bold text-danger-fg">
                            교사용 · 정답 포함
                        </span>
                    )}
                </h2>
                <span className="text-sm font-medium text-fg-3">
                    총 {count}문항
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-2 text-sm text-fg-2">
                <span className="inline-flex items-end gap-2">
                    이름
                    <span className="inline-block h-4 w-28 border-b border-fg-3" />
                </span>
                <span className="inline-flex items-end gap-2">
                    날짜
                    <span className="inline-block h-4 w-24 border-b border-fg-3" />
                </span>
                <span className="inline-flex items-end gap-2">
                    점수
                    <span className="inline-block h-4 w-16 border-b border-fg-3" />
                </span>
            </div>
        </header>
    );
}

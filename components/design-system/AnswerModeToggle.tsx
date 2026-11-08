"use client";

export type AnswerMode = "student" | "teacher";

/**
 * 학생용(문제만) / 교사용(정답·해설 포함) 전환 토글.
 * 인쇄 시에는 숨겨진다(data-print-hide) — 선택된 모드의 결과만 출력된다.
 */
export function AnswerModeToggle({
    value,
    onChange,
}: {
    value: AnswerMode;
    onChange: (v: AnswerMode) => void;
}) {
    const options: Array<{ v: AnswerMode; label: string; hint: string }> = [
        { v: "student", label: "학생용", hint: "문제만" },
        { v: "teacher", label: "교사용", hint: "정답·해설" },
    ];

    return (
        <div
            className="inline-flex rounded-pill bg-bg-3 p-0.5 text-sm font-bold"
            data-print-hide
            role="group"
            aria-label="정답 표시 모드"
        >
            {options.map(({ v, label, hint }) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    aria-pressed={value === v}
                    className={`px-3 py-1.5 rounded-pill transition-colors flex items-center gap-1.5 ${
                        value === v
                            ? "bg-bg-1 text-fg-1 shadow-xs"
                            : "text-fg-3 hover:text-fg-1"
                    }`}
                >
                    {label}
                    <span
                        className={`text-xs font-medium ${
                            value === v ? "text-fg-4" : "text-fg-4"
                        }`}
                    >
                        {hint}
                    </span>
                </button>
            ))}
        </div>
    );
}

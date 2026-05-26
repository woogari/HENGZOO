"use client";

import { useState } from "react";
import { AppBadge } from "./AppBadge";

interface QuestionCardData {
    order: number;
    content: string;
    choices?: string[];
    answer?: string;
    explanation?: string;
}

export function QuestionCard({ q }: { q: QuestionCardData }) {
    const [open, setOpen] = useState(false);

    return (
        <article className="bg-bg-1 border border-border-1 rounded-lg p-6 shadow-xs print:shadow-none print:border-border-2">
            <div className="flex items-baseline gap-3 mb-3">
                <span className="text-sm font-bold text-primary tabular-nums">
                    {String(q.order).padStart(2, "0")}
                </span>
                <span className="text-xs text-fg-4">문항</span>
            </div>

            <div className="text-md leading-relaxed text-fg-1 whitespace-pre-wrap">
                {q.content}
            </div>

            {q.choices && q.choices.length > 0 && (
                <ol className="mt-4 space-y-2 list-none">
                    {q.choices.map((c, i) => (
                        <li
                            key={i}
                            className="flex gap-3 text-base text-fg-2 leading-relaxed"
                        >
                            <span className="shrink-0 text-fg-3 tabular-nums">
                                {numberCircle(i + 1)}
                            </span>
                            <span>{c}</span>
                        </li>
                    ))}
                </ol>
            )}

            {(q.answer || q.explanation) && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="mt-5 inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg-1 transition-colors"
                        data-print-hide
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                            style={{
                                transform: open ? "rotate(90deg)" : "none",
                                transition: "transform 150ms",
                            }}
                        >
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                        {open ? "정답 숨기기" : "정답 보기"}
                    </button>

                    {open && (
                        <div className="mt-3 p-4 bg-bg-2 border border-border-1 rounded-md space-y-2 print:bg-transparent">
                            {q.answer && (
                                <div className="flex items-baseline gap-2">
                                    <AppBadge tone="success">정답</AppBadge>
                                    <span className="text-base font-medium text-fg-1">
                                        {q.answer}
                                    </span>
                                </div>
                            )}
                            {q.explanation && (
                                <p className="text-sm text-fg-2 leading-relaxed">
                                    {q.explanation}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Always visible in print */}
                    <div className="hidden print:block mt-3">
                        {q.answer && (
                            <div className="text-sm text-fg-2">
                                <strong>정답:</strong> {q.answer}
                            </div>
                        )}
                        {q.explanation && (
                            <div className="text-sm text-fg-2 mt-1">
                                <strong>해설:</strong> {q.explanation}
                            </div>
                        )}
                    </div>
                </>
            )}
        </article>
    );
}

function numberCircle(n: number): string {
    const circles = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
    return circles[n - 1] ?? `${n}.`;
}

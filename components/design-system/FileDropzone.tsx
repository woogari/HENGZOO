"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";

interface Props {
    accept?: string;
    file: File | null;
    onChange: (file: File | null) => void;
    label?: string;
    hint?: string;
}

export function FileDropzone({
    accept = "application/pdf",
    file,
    onChange,
    label = "교과서 업로드 (PDF)",
    hint = "PDF 파일을 끌어 놓거나 클릭해서 선택하세요 (최대 20MB)",
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
    };

    return (
        <div>
            <span className="block text-sm font-medium text-fg-2 mb-2">
                {label}
            </span>

            {!file ? (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                        "flex flex-col items-center justify-center gap-3 px-6 py-10 bg-bg-1 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-150",
                        dragOver
                            ? "border-primary bg-primary-soft/40"
                            : "border-border-2 hover:border-border-3 hover:bg-bg-2",
                    )}
                >
                    <div className="w-12 h-12 rounded-full bg-bg-3 flex items-center justify-center text-fg-3">
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <div className="text-base font-medium text-fg-1">
                            PDF를 끌어 놓거나 클릭해서 선택
                        </div>
                        <div className="mt-1 text-xs text-fg-4">{hint}</div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-bg-1 border border-border-2 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-md bg-primary text-primary-on flex items-center justify-center text-xs font-bold">
                            PDF
                        </div>
                        <div className="min-w-0">
                            <div className="text-base font-medium text-fg-1 truncate">
                                {file.name}
                            </div>
                            <div className="text-xs text-fg-4 mt-0.5">
                                {formatBytes(file.size)} ·{" "}
                                {estimatePages(file.size)}페이지
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="shrink-0 h-8 w-8 rounded-md text-fg-3 hover:bg-bg-2 hover:text-danger-fg transition-colors"
                        aria-label="제거"
                    >
                        ×
                    </button>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={accept}
                hidden
                onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimatePages(bytes: number): number {
    return Math.max(1, Math.floor(bytes / 80_000));
}

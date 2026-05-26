"use client";

import { cn } from "@/lib/cn";

interface Props {
    label?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (next: number) => void;
    className?: string;
}

export function NumberInput({
    label,
    value,
    min = 1,
    max = 30,
    step = 1,
    onChange,
    className,
}: Props) {
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    return (
        <div className={cn("inline-flex flex-col gap-2", className)}>
            {label && (
                <span className="text-sm font-medium text-fg-2">{label}</span>
            )}
            <div className="inline-flex items-center bg-bg-1 border border-border-2 rounded-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => onChange(clamp(value - step))}
                    disabled={value <= min}
                    className="h-10 w-10 text-fg-2 hover:bg-bg-2 disabled:text-fg-4 disabled:cursor-not-allowed transition-colors"
                    aria-label="감소"
                >
                    −
                </button>
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))}
                    className="w-14 h-10 text-center bg-transparent text-fg-1 font-medium tabular-nums border-x border-border-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    type="button"
                    onClick={() => onChange(clamp(value + step))}
                    disabled={value >= max}
                    className="h-10 w-10 text-fg-2 hover:bg-bg-2 disabled:text-fg-4 disabled:cursor-not-allowed transition-colors"
                    aria-label="증가"
                >
                    +
                </button>
            </div>
        </div>
    );
}

import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    optional?: boolean;
    showCount?: boolean;
}

export function TextArea({
    label,
    hint,
    optional,
    showCount,
    className,
    value,
    rows = 6,
    ...rest
}: Props) {
    const length = typeof value === "string" ? value.length : 0;
    return (
        <label className="block">
            {label && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-fg-2">
                        {label}
                        {optional && (
                            <span className="ml-1 text-fg-4 font-normal">
                                (선택)
                            </span>
                        )}
                    </span>
                    {showCount && (
                        <span className="text-xs text-fg-4 tabular-nums">
                            {length.toLocaleString()}
                        </span>
                    )}
                </div>
            )}
            <textarea
                rows={rows}
                value={value}
                className={cn(
                    "w-full px-4 py-3 bg-bg-1 border border-border-2 rounded-md text-base text-fg-1 placeholder:text-fg-4",
                    "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
                    "transition-colors duration-150 resize-y",
                    className,
                )}
                {...rest}
            />
            {hint && <p className="mt-1.5 text-xs text-fg-4">{hint}</p>}
        </label>
    );
}

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: Array<{ value: string; label: string }>;
}

export function Select({ label, options, className, ...rest }: Props) {
    return (
        <label className="inline-flex flex-col gap-2">
            {label && (
                <span className="text-sm font-medium text-fg-2">{label}</span>
            )}
            <div className="relative">
                <select
                    className={cn(
                        "h-10 pl-4 pr-9 bg-bg-1 border border-border-2 rounded-md text-base text-fg-1",
                        "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
                        "appearance-none cursor-pointer transition-colors duration-150",
                        className,
                    )}
                    {...rest}
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-3"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </div>
        </label>
    );
}

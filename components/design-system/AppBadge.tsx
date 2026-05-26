import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
    neutral: "bg-bg-3 text-fg-2 border-border-1",
    primary: "bg-primary-soft text-primary border-border-1",
    success: "bg-success-bg text-success-fg border-success-bg",
    warning: "bg-warning-bg text-warning-fg border-warning-bg",
    danger: "bg-danger-bg text-danger-fg border-danger-bg",
};

export function AppBadge({
    tone = "neutral",
    children,
    className,
}: {
    tone?: Tone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border text-xs font-medium tracking-base",
                toneClass[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

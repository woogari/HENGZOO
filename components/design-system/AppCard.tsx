import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean;
    padding?: "none" | "sm" | "md" | "lg";
    children?: ReactNode;
}

const padClass = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
} as const;

export function AppCard({
    interactive,
    padding = "md",
    className,
    children,
    ...rest
}: Props) {
    return (
        <div
            className={cn(
                "bg-bg-1 border border-border-1 rounded-lg shadow-xs",
                padClass[padding],
                interactive &&
                    "transition-all duration-150 hover:border-border-3 hover:shadow-sm cursor-pointer",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}

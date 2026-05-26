import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
    primary:
        "bg-primary text-primary-on hover:bg-primary-dark disabled:bg-fg-4",
    secondary:
        "bg-bg-1 text-fg-1 border border-border-2 hover:border-border-3 hover:bg-bg-2",
    ghost: "bg-transparent text-fg-2 hover:bg-bg-3",
    danger: "bg-danger-bg text-danger-fg hover:bg-danger-bg/80",
};

const sizeClass: Record<Size, string> = {
    sm: "h-8 px-3 text-sm rounded-md",
    md: "h-10 px-4 text-base rounded-md",
    lg: "h-12 px-6 text-md rounded-lg",
};

export const AppButton = forwardRef<HTMLButtonElement, Props>(function AppButton(
    {
        variant = "primary",
        size = "md",
        leftIcon,
        rightIcon,
        fullWidth,
        className,
        children,
        ...rest
    },
    ref,
) {
    return (
        <button
            ref={ref}
            className={cn(
                "inline-flex items-center justify-center gap-2 font-medium tracking-base transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
                variantClass[variant],
                sizeClass[size],
                fullWidth && "w-full",
                className,
            )}
            {...rest}
        >
            {leftIcon && <span className="-ml-0.5">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="-mr-0.5">{rightIcon}</span>}
        </button>
    );
});

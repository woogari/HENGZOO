import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
    title: string;
    description?: string;
    backHref?: string;
    actions?: ReactNode;
}

export function PageHeader({ title, description, backHref, actions }: Props) {
    return (
        <header
            className="flex items-start justify-between gap-6 pb-6 mb-8 border-b border-border-1"
            data-print-hide
        >
            <div className="min-w-0">
                {backHref && (
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg-1 transition-colors mb-2"
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
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        뒤로
                    </Link>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-fg-1">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 text-base text-fg-3">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2 shrink-0">
                    {actions}
                </div>
            )}
        </header>
    );
}

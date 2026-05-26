import Link from "next/link";
import { AppBadge } from "@/components/design-system";

interface Props {
    href: string;
    icon: string;
    title: string;
    description: string;
    badge?: string;
    features: string[];
}

export function SubjectCard({
    href,
    icon,
    title,
    description,
    badge,
    features,
}: Props) {
    return (
        <Link
            href={href}
            className="group block bg-bg-1 border border-border-1 rounded-xl p-8 transition-all duration-150 hover:border-border-3 hover:shadow-md hover:-translate-y-0.5"
        >
            <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-lg bg-primary-soft flex items-center justify-center text-2xl">
                    {icon}
                </div>
                {badge && <AppBadge tone="primary">{badge}</AppBadge>}
            </div>

            <h3 className="text-xl font-bold text-fg-1 tracking-snug">
                {title}
            </h3>
            <p className="mt-2 text-base text-fg-3 leading-relaxed">
                {description}
            </p>

            <ul className="mt-5 space-y-2">
                {features.map((f, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-fg-2"
                    >
                        <svg
                            className="shrink-0 mt-0.5 text-fg-3"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span>{f}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-fg-2 group-hover:text-primary transition-colors">
                바로 시작하기
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
                    className="transition-transform group-hover:translate-x-0.5"
                >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

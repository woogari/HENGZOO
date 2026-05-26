interface Props {
    current: number;
    total: number;
    message?: string;
}

export function ProgressBar({ current, total, message }: Props) {
    const pct =
        total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    return (
        <div className="space-y-3" data-print-hide>
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-fg-2">
                    {message ?? "생성 중..."}
                </span>
                <span className="text-sm text-fg-3 tabular-nums">
                    {current} / {total}
                </span>
            </div>
            <div className="h-2 bg-bg-3 rounded-pill overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out rounded-pill"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

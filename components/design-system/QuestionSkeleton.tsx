export function QuestionSkeleton() {
    return (
        <div
            className="bg-bg-1 border border-border-1 rounded-lg p-6 shadow-xs animate-pulse"
            data-print-hide
        >
            <div className="h-4 w-12 bg-bg-3 rounded mb-4" />
            <div className="space-y-2">
                <div className="h-4 bg-bg-3 rounded w-full" />
                <div className="h-4 bg-bg-3 rounded w-11/12" />
                <div className="h-4 bg-bg-3 rounded w-3/4" />
            </div>
            <div className="mt-5 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-3 bg-bg-3 rounded w-2/3" />
                ))}
            </div>
        </div>
    );
}

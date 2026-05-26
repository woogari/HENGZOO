import { Suspense } from "react";
import ResultsClient from "./ResultsClient";

export default function ResultsPage() {
    return (
        <Suspense fallback={<ResultsFallback />}>
            <ResultsClient />
        </Suspense>
    );
}

function ResultsFallback() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="h-8 w-48 bg-bg-3 rounded animate-pulse" />
        </div>
    );
}

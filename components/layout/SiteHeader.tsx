import Link from "next/link";

export function SiteHeader() {
    return (
        <header
            className="sticky top-0 z-20 bg-bg-1/85 backdrop-blur border-b border-border-1"
            data-print-hide
        >
            <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 group"
                >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-on font-bold text-sm">
                        행
                    </span>
                    <span className="text-md font-bold text-fg-1 tracking-tight">
                        행ZOO
                    </span>
                </Link>

                <nav className="flex items-center gap-1">
                    <Link
                        href="/math"
                        className="px-3 h-9 inline-flex items-center text-sm text-fg-2 hover:text-fg-1 hover:bg-bg-2 rounded-md transition-colors"
                    >
                        수학
                    </Link>
                    <Link
                        href="/career"
                        className="px-3 h-9 inline-flex items-center text-sm text-fg-2 hover:text-fg-1 hover:bg-bg-2 rounded-md transition-colors"
                    >
                        성공적인 직업생활
                    </Link>
                </nav>
            </div>
        </header>
    );
}

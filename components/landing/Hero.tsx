import Link from "next/link";
import { AppButton } from "@/components/design-system";

export function Hero() {
    return (
        <section className="text-center py-20 sm:py-28">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-bg-1 border border-border-1 text-xs text-fg-3 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-success-fg" />
                AI 기반 변형문제 생성 · 베타 데모
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-fg-1 leading-tight">
                기출 한 문제로,
                <br />
                나만의 문제집 한 권.
            </h1>

            <p className="mt-6 max-w-xl mx-auto text-md text-fg-3 leading-relaxed">
                기출 문제와 수업 강조 내용을 입력하면, 같은 유형으로
                <br className="hidden sm:block" />
                새 문제를 자동으로 만들어드립니다.
            </p>

            <div className="mt-10 inline-flex flex-wrap gap-3 justify-center">
                <Link href="/math">
                    <AppButton size="lg">
                        수학 변형문제 →
                    </AppButton>
                </Link>
                <Link href="/career">
                    <AppButton size="lg" variant="secondary">
                        성공적인 직업생활 →
                    </AppButton>
                </Link>
            </div>
        </section>
    );
}

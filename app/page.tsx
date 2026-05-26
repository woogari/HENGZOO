import { Hero } from "@/components/landing/Hero";
import { SubjectCard } from "@/components/landing/SubjectCard";

export default function HomePage() {
    return (
        <div className="max-w-5xl mx-auto px-6">
            <Hero />

            <section className="pb-24">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-fg-1">
                        과목을 선택해 보세요
                    </h2>
                    <p className="mt-2 text-base text-fg-3">
                        두 가지 변형 엔진을 지원합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <SubjectCard
                        href="/math"
                        icon="📐"
                        title="수학"
                        badge="숫자 변형"
                        description="기출 문제를 붙여넣으면 동일 유형으로 숫자만 바꾼 변형 문제를 만들어드려요."
                        features={[
                            "원본의 유형과 난이도를 유지",
                            "정답·풀이 함께 생성",
                            "최대 30문제까지 한 번에",
                        ]}
                    />
                    <SubjectCard
                        href="/career"
                        icon="🧭"
                        title="성공적인 직업생활"
                        badge="강조 반영"
                        description="교과서 PDF와 수업 중 선생님이 강조하신 내용을 반영해 새 변형 문제를 만들어드려요."
                        features={[
                            "교과서 PDF 업로드 지원",
                            "수업 강조 내용 반영",
                            "5지선다·단답형 모두 가능",
                        ]}
                    />
                </div>
            </section>
        </div>
    );
}

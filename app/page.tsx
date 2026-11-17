import Link from "next/link";
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
                        두 가지 변형 엔진과, 만든 문제를 검증하는 연구소를 지원합니다.
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
                        icon="📚"
                        title="교과서 변형문제"
                        badge="선택과목"
                        description="과목을 고르고 교과서 PDF를 올리면, 필기 사진과 수업 강조 내용까지 반영해 새 변형 문제를 만들어드려요."
                        features={[
                            "성공적인 직업생활 · 인공지능 모델링 · 자료구조 · 컴퓨터네트워크 · 직접 입력",
                            "필기·판서 사진, 수업 강조 내용 반영 (선택)",
                            "5지선다·단답형·수능형 모두 가능",
                        ]}
                    />
                </div>

                <Link
                    href="/lab"
                    className="mt-5 group flex flex-col sm:flex-row sm:items-center gap-4 bg-primary text-primary-on rounded-xl p-8 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5"
                >
                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl shrink-0">
                        🔬
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold tracking-snug">
                            AI 출제 검증 연구소
                        </h3>
                        <p className="mt-1 text-base opacity-80 leading-relaxed">
                            AI가 낸 문제, 믿어도 될까요? 다른 AI가 정답을 모른 채
                            직접 풀어 보고(수학은 Python으로 계산), 답이 다르면
                            걸러내고 고칩니다.
                        </p>
                    </div>
                    <span className="text-sm font-medium opacity-90 group-hover:translate-x-0.5 transition-transform">
                        시연해 보기 →
                    </span>
                </Link>
            </section>
        </div>
    );
}

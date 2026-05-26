import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
    title: "행ZOO — 기출로 만드는 나만의 변형문제집",
    description:
        "기출 문제와 수업 강조 내용을 입력하면 같은 유형의 새 문제를 자동으로 만들어드립니다. 수학 숫자 변형과 성공적인 직업생활 과목을 지원합니다.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" data-scroll-behavior="smooth">
            <body className="min-h-screen flex flex-col">
                <SiteHeader />
                <main className="flex-1">{children}</main>
                <SiteFooter />
            </body>
        </html>
    );
}

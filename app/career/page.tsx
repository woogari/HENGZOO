"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    AppButton,
    FileDropzone,
    NumberInput,
    PageHeader,
    Select,
    TextArea,
} from "@/components/design-system";
import { newSessionId, saveSession } from "@/lib/session";
import type { Difficulty, QuestionFormat } from "@/lib/types";

const formatOptions: Array<{ value: QuestionFormat; label: string }> = [
    { value: "multiple_choice", label: "5지선다" },
    { value: "short_answer", label: "단답형" },
    { value: "csat_style", label: "수능형" },
];

const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: "easy", label: "쉬움" },
    { value: "medium", label: "보통" },
    { value: "hard", label: "어려움" },
];

export default function CareerPage() {
    const router = useRouter();
    const [textbook, setTextbook] = useState<File | null>(null);
    const [emphasis, setEmphasis] = useState("");
    const [pastExam, setPastExam] = useState("");
    const [count, setCount] = useState(10);
    const [format, setFormat] = useState<QuestionFormat>("multiple_choice");
    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = !!textbook && emphasis.trim().length > 0;

    const onSubmit = () => {
        if (!canSubmit || submitting) return;
        setSubmitting(true);
        const id = newSessionId();
        saveSession(id, {
            mode: "career",
            textbookFileName: textbook?.name ?? null,
            textbookFileSize: textbook?.size ?? null,
            emphasis: emphasis.trim(),
            pastExam: pastExam.trim(),
            request: {
                category: "career",
                selectedSubjects: ["career-textbook"],
                selectedUnits: ["uploaded-textbook"],
                questionFormat: format,
                difficulty,
                questionCount: count,
                customTopic: [
                    `[수업 강조 내용]\n${emphasis.trim()}`,
                    pastExam.trim()
                        ? `[기출 문제]\n${pastExam.trim()}`
                        : null,
                ]
                    .filter(Boolean)
                    .join("\n\n"),
            },
        });
        router.push(`/results?session=${id}&mode=career`);
    };

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <PageHeader
                title="성공적인 직업생활 변형문제"
                description="교과서와 수업 강조 내용을 반영해 새로운 변형 문제를 만들어드려요."
                backHref="/"
            />

            <div className="space-y-8">
                <FileDropzone
                    file={textbook}
                    onChange={setTextbook}
                    label="교과서 (PDF, 필수)"
                />

                <TextArea
                    label="수업 중 강조 내용 (필수)"
                    placeholder={`예) 오늘 면접 매너 부분이 시험에 꼭 나옵니다. 특히 첫인상 6초의 법칙과 자기소개 1분 구성은 반드시 외워야 합니다...`}
                    value={emphasis}
                    onChange={(e) => setEmphasis(e.target.value)}
                    rows={7}
                    showCount
                    hint="수업 녹음을 미리 텍스트로 변환해서 붙여넣어 주세요. 강조하신 부분이 변형문제 출제 비중에 반영됩니다."
                />

                <TextArea
                    label="기출 문제"
                    optional
                    placeholder={`예) 1. 다음 중 면접 시 좋은 인상을 주기 위한 행동으로 가장 적절한 것은? ...`}
                    value={pastExam}
                    onChange={(e) => setPastExam(e.target.value)}
                    rows={8}
                    hint="이전 시험 문제가 있으면 출제 스타일 참고용으로 활용됩니다."
                />

                <div className="flex flex-wrap items-end gap-6 pt-2">
                    <NumberInput
                        label="생성 개수"
                        value={count}
                        min={1}
                        max={30}
                        onChange={setCount}
                    />
                    <Select
                        label="유형"
                        value={format}
                        onChange={(e) =>
                            setFormat(e.target.value as QuestionFormat)
                        }
                        options={formatOptions}
                    />
                    <Select
                        label="난이도"
                        value={difficulty}
                        onChange={(e) =>
                            setDifficulty(e.target.value as Difficulty)
                        }
                        options={difficultyOptions}
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-border-1">
                    <AppButton
                        size="lg"
                        onClick={onSubmit}
                        disabled={!canSubmit || submitting}
                    >
                        {submitting ? "이동 중..." : "변형 문제 생성하기 →"}
                    </AppButton>
                </div>
            </div>
        </div>
    );
}

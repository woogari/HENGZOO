/**
 * 교과서 기반 변형문제가 지원하는 선택과목.
 * "custom" 을 고르면 과목명을 직접 입력한다.
 */
export interface SubjectOption {
    id: string;
    name: string;
}

export const SUBJECTS: SubjectOption[] = [
    { id: "career", name: "성공적인 직업생활" },
    { id: "ai-modeling", name: "인공지능 모델링" },
    { id: "data-structures", name: "자료구조" },
    { id: "computer-network", name: "컴퓨터네트워크" },
    { id: "programming", name: "프로그래밍" },
    { id: "database", name: "데이터베이스" },
];

export const CUSTOM_SUBJECT_ID = "custom";

export const DEFAULT_SUBJECT = SUBJECTS[0].name;

/** 필기 사진 제한 (Claude 이미지 블록 기준). */
export const NOTE_IMAGE_MAX_COUNT = 10;
export const NOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const NOTE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

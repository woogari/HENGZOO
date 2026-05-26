import type {
    GeneratedQuestion,
    GenerateQuestionsRequest,
    SSEEvent,
} from "@/lib/types";
import { delay } from "./delay";

/**
 * Mock SSE 스트림 — S-LAB `/api/generate-questions`가 보내는 이벤트
 * 시퀀스(init → progress → questions → progress → questions → done)를
 * setTimeout으로 시뮬레이션. 컨슈머 입장에서 real과 구분 안 됨.
 */
export async function* mockSseStream(
    req: GenerateQuestionsRequest,
): AsyncGenerator<SSEEvent> {
    const total = Math.max(1, Math.min(req.questionCount, 30));
    const batchSize = 5;
    const totalBatches = Math.ceil(total / batchSize);
    const title = "성공적인 직업생활 변형문제집";

    yield {
        event: "init",
        data: { title, totalQuestions: total, totalBatches, batchSize },
    };
    await delay(450);

    const all: GeneratedQuestion[] = [];
    for (let b = 1; b <= totalBatches; b++) {
        yield {
            event: "progress",
            data: {
                batch: b,
                totalBatches,
                generatedSoFar: all.length,
                totalQuestions: total,
                message: `배치 ${b}/${totalBatches} 처리 중...`,
            },
        };
        await delay(950);

        const size = Math.min(batchSize, total - all.length);
        const batchQs = makeFakeQuestions(all.length, size, req);
        all.push(...batchQs);
        yield {
            event: "questions",
            data: {
                batch: b,
                questions: batchQs,
                generatedSoFar: all.length,
                totalQuestions: total,
            },
        };
        await delay(300);
    }

    yield {
        event: "done",
        data: {
            title,
            totalGenerated: all.length,
            totalRequested: total,
            questions: all,
        },
    };
}

const seeds: Array<Omit<GeneratedQuestion, "order">> = [
    {
        content:
            "다음 중 면접 시 좋은 인상을 주기 위한 행동으로 가장 적절한 것은?",
        choices: [
            "면접 시작 1분 전에 도착해 바로 입실한다",
            "면접관과 눈을 마주치며 안정된 목소리로 인사한다",
            "묻지 않은 개인사를 먼저 적극적으로 밝힌다",
            "긴장을 풀기 위해 다리를 가볍게 꼬고 앉는다",
            "답변 중 모르는 내용은 추측해서라도 길게 답한다",
        ],
        answer: "②",
        explanation:
            "면접관과의 시선 처리와 안정된 목소리는 신뢰감 형성에 핵심입니다. 수업에서 강조하신 '첫인상은 6초 안에 결정된다'는 내용이 반영된 문항입니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content:
            "이력서 작성 시 가장 우선적으로 고려해야 할 사항으로 옳은 것은?",
        choices: [
            "지원 직무와 무관한 자격증도 모두 기재한다",
            "사실에 기반한 정확한 내용을 직무 적합성에 맞춰 작성한다",
            "글자 크기를 크게 하여 한눈에 잘 보이게 한다",
            "지원자의 가족관계를 상세히 기재한다",
            "사진은 보정을 많이 한 최신 사진을 사용한다",
        ],
        answer: "②",
        explanation:
            "이력서의 핵심은 사실성과 직무 적합성. 과장된 기재는 신뢰를 무너뜨립니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content:
            "직장 내 의사소통에서 능동적 경청(active listening)에 해당하지 않는 것은?",
        choices: [
            "상대방의 말을 끝까지 듣는다",
            "핵심 내용을 자신의 말로 다시 정리해 확인한다",
            "비언어적 신호(고개 끄덕임 등)로 호응한다",
            "상대가 말하는 중간에 자신의 결론을 단정해서 말한다",
            "감정을 공감하는 표현을 함께 사용한다",
        ],
        answer: "④",
        explanation:
            "중간에 단정짓는 것은 경청이 아닌 판단입니다. 능동적 경청의 핵심은 '판단 보류와 확인'입니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content: "다음 중 직장 예절로 가장 적절하지 않은 것은?",
        choices: [
            "상급자보다 먼저 인사를 건넨다",
            "공용 공간을 사용한 후 원래 상태로 정리한다",
            "동료의 호칭은 직급/이름으로 정확히 부른다",
            "개인 통화는 업무 공간에서 큰 목소리로 한다",
            "회의 시작 5분 전에 도착해 준비한다",
        ],
        answer: "④",
        explanation:
            "공용 공간에서의 사적 통화는 동료의 업무 집중을 방해합니다. 수업에서 강조하신 '공간 매너' 항목과 연결됩니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content: "다음 사례에서 가장 우선적으로 필요한 직업 태도는?",
        choices: [
            "신입 사원이 자신의 실수를 인정하고 즉시 보고했다",
            "정직성과 책임감",
            "효율성과 속도",
            "개인주의와 독립성",
            "경쟁심과 자기과시",
            "유머와 친화력",
        ],
        answer: "①",
        explanation:
            "실수를 숨기지 않고 즉시 공유하는 것은 정직성과 책임감의 발현이며, 조직 신뢰의 기반입니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content:
            "다음 중 비공식적 조직(informal organization)의 특징으로 옳은 것은?",
        choices: [
            "공식적 직무 분장에 따라 구성된다",
            "조직도에 명시되어 있다",
            "개인 간의 친분과 관심을 바탕으로 자연스럽게 형성된다",
            "성과 평가의 기준으로 사용된다",
            "법적 권한을 가진다",
        ],
        answer: "③",
        explanation:
            "비공식 조직은 친분·취미·동향 등 사적 관계로 형성되며, 정보 흐름과 사기 진작에 영향을 줍니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content:
            "직장 내 갈등 상황에서 가장 바람직한 1차적 대응 방식은?",
        choices: [
            "갈등을 회피하기 위해 무조건 양보한다",
            "상사에게 즉시 보고해 처리하게 한다",
            "당사자와 직접 대화하여 사실관계를 정리한다",
            "동료들에게 자신의 입장을 먼저 알린다",
            "익명으로 회사 게시판에 글을 올린다",
        ],
        answer: "③",
        explanation:
            "갈등의 1차 해결은 당사자 간 대화입니다. 사실관계를 먼저 정리한 뒤 필요시 상위 관리자에게 보고합니다.",
        points: 5,
        type: "multiple_choice",
    },
    {
        content: "다음 중 직업 윤리에 해당하지 않는 것은?",
        choices: [
            "정직성",
            "성실성",
            "책임감",
            "사익 우선",
            "근면",
        ],
        answer: "④",
        explanation:
            "사익을 우선시하는 태도는 직업 윤리에 반합니다. 직업 윤리는 공익과 책임 의식을 기반으로 합니다.",
        points: 5,
        type: "multiple_choice",
    },
];

function makeFakeQuestions(
    startOrder: number,
    size: number,
    _req: GenerateQuestionsRequest,
): GeneratedQuestion[] {
    return Array.from({ length: size }, (_, i) => {
        const seed = seeds[(startOrder + i) % seeds.length];
        return { order: startOrder + i + 1, ...seed };
    });
}

/**
 * 성직 모드 교과서 PDF 핸드오프.
 *
 * 교과서 PDF(수십 MB)는 sessionStorage 에 넣을 수 없어서, /career → /results
 * 클라이언트 네비게이션 동안 모듈 메모리에 잠깐 담아 전달한다.
 * (Next App Router 의 router.push 는 풀 리로드가 아니라 모듈 상태가 유지된다.)
 *
 * 새로고침 시에는 사라지므로, 받는 쪽에서 null 처리해 안내한다.
 * 읽어도 비우지 않는다 — React StrictMode 의 이펙트 2회 실행/재시도에도
 * 같은 파일을 다시 얻을 수 있어야 하기 때문. 다음 출제 시 새 파일로 덮어쓴다.
 */
let pending: { sessionId: string; file: File } | null = null;

export function stashCareerFile(sessionId: string, file: File) {
    pending = { sessionId, file };
}

export function getCareerFile(sessionId: string): File | null {
    return pending && pending.sessionId === sessionId ? pending.file : null;
}

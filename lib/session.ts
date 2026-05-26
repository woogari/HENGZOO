import type { SessionPayload } from "./types";

const KEY = (id: string) => `hangzoo:session:${id}`;

export function saveSession(id: string, data: SessionPayload) {
    try {
        sessionStorage.setItem(KEY(id), JSON.stringify(data));
    } catch {
        // sessionStorage 미지원/quota — 데모이므로 조용히 무시
    }
}

export function loadSession<T extends SessionPayload>(id: string): T | null {
    try {
        const raw = sessionStorage.getItem(KEY(id));
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function newSessionId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 11);
}

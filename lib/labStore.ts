import { promises as fs } from "fs";
import path from "path";
import type { LabStats, RunSummary } from "./lab";

/**
 * 검증 실험 기록 저장소 (서버 전용).
 * 실행 한 번마다 RunSummary 한 줄을 data/lab-runs.jsonl 에 덧붙인다.
 * 학술제 부스에서 쌓인 기록이 그대로 탐구 데이터가 된다.
 */
const FILE = path.join(process.cwd(), "data", "lab-runs.jsonl");

export async function appendRun(summary: RunSummary): Promise<void> {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.appendFile(FILE, JSON.stringify({ ...summary, at: new Date().toISOString() }) + "\n", "utf8");
}

export async function readRuns(): Promise<RunSummary[]> {
    try {
        const raw = await fs.readFile(FILE, "utf8");
        return raw
            .split("\n")
            .filter((l) => l.trim())
            .flatMap((l) => {
                try {
                    return [JSON.parse(l) as RunSummary];
                } catch {
                    return [];
                }
            });
    } catch {
        return [];
    }
}

export function aggregate(runs: RunSummary[]): LabStats {
    const stats: LabStats = {
        runs: runs.length,
        naturalTotal: 0,
        naturalFailed: 0,
        fixed: 0,
        discarded: 0,
        injectedRuns: 0,
        injectedCaught: 0,
        bySubject: { math: { total: 0, failed: 0 }, career: { total: 0, failed: 0 } },
        byEffort: { low: { total: 0, failed: 0 }, medium: { total: 0, failed: 0 } },
    };
    for (const r of runs) {
        const injected = r.injectedId !== null ? 1 : 0;
        // 심어둔 오류 문제는 "AI가 원래 낸 오류율" 계산에서 뺀다.
        const natTotal = r.total - injected;
        const natFailed =
            r.fixed + r.discarded - (injected && r.injectedCaught ? 1 : 0);
        stats.naturalTotal += natTotal;
        stats.naturalFailed += Math.max(0, natFailed);
        stats.fixed += r.fixed;
        stats.discarded += r.discarded;
        if (injected) {
            stats.injectedRuns += 1;
            if (r.injectedCaught) stats.injectedCaught += 1;
        }
        const s = stats.bySubject[r.subject];
        if (s) {
            s.total += natTotal;
            s.failed += Math.max(0, natFailed);
        }
        const e = stats.byEffort[r.generatorEffort];
        if (e) {
            e.total += natTotal;
            e.failed += Math.max(0, natFailed);
        }
    }
    return stats;
}

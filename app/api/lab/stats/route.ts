import { aggregate, readRuns } from "@/lib/labStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const runs = await readRuns();
    return Response.json({ success: true, stats: aggregate(runs) });
}

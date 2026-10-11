/**
 * API خروجی حافظه — دانلود فایل JSON
 */
import { NextResponse } from "next/server";
import { listMemories } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/memories/export — خروجی JSON از همهٔ حافظه‌ها */
export async function GET() {
  const memories = listMemories("all");
  const payload = {
    app: "dastiar",
    exportedAt: new Date().toISOString(),
    count: memories.length,
    memories
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dastiar-memories-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}

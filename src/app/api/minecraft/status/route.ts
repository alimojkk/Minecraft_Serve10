/**
 * API وضعیت ماینکرفت — پولینگ زنده وضعیت ربات و لاگ‌ها
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/minecraft/status?sinceLogId=0 — وضعیت + لاگ‌های جدید */
export async function GET(req: NextRequest) {
  const sinceRaw = req.nextUrl.searchParams.get("sinceLogId");
  const sinceLogId = Number(sinceRaw ?? 0) || 0;
  return NextResponse.json({
    status: botManager.getStatus(),
    logs: botManager.getLogs(sinceLogId)
  });
}

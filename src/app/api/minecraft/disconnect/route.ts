/**
 * API قطع اتصال ماینکرفت
 */
import { NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/minecraft/disconnect */
export async function POST() {
  botManager.disconnect();
  return NextResponse.json({ ok: true, message: "اتصال قطع شد." });
}

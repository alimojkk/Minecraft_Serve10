/**
 * API تست اتصال ارائه‌دهنده — درخواست زنده به /chat/completions
 */
import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/llm";
import { getSettings, maskApiKey } from "@/lib/store";
import type { AppSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/settings/test — تست اتصال با تنظیمات فعلی (یا موقت) */
export async function POST(req: NextRequest) {
  let body: {
    provider?: AppSettings["provider"];
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* از تنظیمات فعلی استفاده کن */
  }

  const current = getSettings();
  const apiKey =
    body.apiKey !== undefined && body.apiKey !== maskApiKey(current.apiKey)
      ? body.apiKey
      : current.apiKey;

  const result = await testConnection({
    provider: body.provider ?? current.provider,
    baseUrl: body.baseUrl?.trim() || current.baseUrl,
    apiKey,
    model: body.model?.trim() || current.model
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

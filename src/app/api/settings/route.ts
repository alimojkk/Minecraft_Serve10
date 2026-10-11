/**
 * API تنظیمات — دریافت و ذخیره (کلید API همیشه ماسک برمی‌گردد)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPublicSettings,
  getSettings,
  maskApiKey,
  saveSettings
} from "@/lib/store";
import type { AppSettings, ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ProviderId[] = [
  "builtin",
  "openai",
  "openrouter",
  "groq",
  "xai",
  "ollama",
  "lmstudio",
  "custom"
];

/** GET /api/settings — تنظیمات با کلید ماسک‌شده */
export async function GET() {
  return NextResponse.json({ settings: getPublicSettings() });
}

/** PUT /api/settings — ذخیرهٔ تنظیمات (ادغام جزئی) */
export async function PUT(req: NextRequest) {
  let body: Partial<AppSettings> & { apiKeyMasked?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const current = getSettings();
  const patch: Partial<AppSettings> = {};

  // فیلدهای رشته‌ای ساده
  for (const key of [
    "baseUrl",
    "model",
    "assistantName",
    "ttsVoiceURI",
    "microphoneId",
    "mcLastHost",
    "mcLastUsername",
    "mcProtectTarget"
  ] as const) {
    if (body[key] !== undefined) {
      patch[key] = (body[key] ?? null) as never;
    }
  }

  if (body.provider && VALID_PROVIDERS.includes(body.provider)) {
    patch.provider = body.provider;
  }
  if (body.tone && ["friendly", "formal", "playful"].includes(body.tone)) {
    patch.tone = body.tone;
  }
  if (body.verbosity && ["concise", "balanced", "detailed"].includes(body.verbosity)) {
    patch.verbosity = body.verbosity;
  }
  if (typeof body.autoMemory === "boolean") {
    patch.autoMemory = body.autoMemory;
  }
  if (typeof body.autoSpeak === "boolean") {
    patch.autoSpeak = body.autoSpeak;
  }
  if (typeof body.ttsRate === "number" && body.ttsRate >= 0.5 && body.ttsRate <= 2) {
    patch.ttsRate = body.ttsRate;
  }
  if (typeof body.ttsVolume === "number" && body.ttsVolume >= 0 && body.ttsVolume <= 1) {
    patch.ttsVolume = body.ttsVolume;
  }
  if (typeof body.mcLastPort === "number" && body.mcLastPort > 0) {
    patch.mcLastPort = body.mcLastPort;
  }
  if (typeof body.mcGuardRadius === "number" && body.mcGuardRadius >= 4 && body.mcGuardRadius <= 64) {
    patch.mcGuardRadius = body.mcGuardRadius;
  }

  // کلید API: اگر مقدار ماسک‌شده برگردونده شده باشه، همون قبلی حفظ می‌شه
  if (typeof body.apiKey === "string") {
    const incoming = body.apiKey.trim();
    if (incoming === "" || incoming === maskApiKey(current.apiKey)) {
      // بدون تغییر
    } else {
      patch.apiKey = incoming;
    }
  }

  const next = saveSettings(patch);
  return NextResponse.json({ settings: getPublicSettings() });
}

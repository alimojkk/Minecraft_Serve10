/**
 * API لیست مدل‌ها — مدل‌های داخلی رایگان + مدل‌های محلی (Ollama / LM Studio)
 * تا کاربر بدون تایپ دستی، از لیست انتخاب کند
 */
import { NextRequest, NextResponse } from "next/server";
import { BUILT_IN_MODELS } from "@/lib/builtin-models";
import { listRemoteModels } from "@/lib/llm";
import { getSettings } from "@/lib/store";
import type { ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings/models?provider=builtin|ollama|lmstudio */
export async function GET(req: NextRequest) {
  const provider = (req.nextUrl.searchParams.get("provider") ??
    "builtin") as ProviderId;
  const settings = getSettings();

  if (provider === "builtin") {
    return NextResponse.json({
      models: BUILT_IN_MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        builtin: true
      }))
    });
  }

  if (provider === "ollama" || provider === "lmstudio") {
    const baseUrl =
      provider === "ollama"
        ? "http://localhost:11434/v1"
        : "http://localhost:1234/v1";
    const ids = await listRemoteModels(baseUrl);
    return NextResponse.json({
      models: ids.map((id) => ({
        id,
        label: id,
        description: "مدل محلی روی کامپیوتر شما",
        builtin: false
      })),
      reachable: ids.length > 0
    });
  }

  // سایر ارائه‌دهنده‌ها — لیست مدل‌های رایج
  const common: Record<string, string[]> = {
    openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
    openrouter: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash",
      "meta-llama/llama-3.3-70b-instruct"
    ],
    groq: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768"
    ],
    xai: ["grok-2", "grok-2-mini"],
    custom: [settings.model]
  };
  return NextResponse.json({
    models: (common[provider] ?? []).map((id) => ({
      id,
      label: id,
      description: "",
      builtin: false
    }))
  });
}

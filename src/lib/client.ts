/**
 * ابزارهای سمت کلاینت — فراخوانی API و پخش صدا (TTS)
 */
import type { PublicSettings } from "@/lib/types";

/** فراخوانی GET و تبدیل به JSON */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `خطای ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** فراخوانی POST/PUT/PATCH/DELETE */
export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `خطای ${res.status}`);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* پخش صدا (TTS)                                                      */
/* ------------------------------------------------------------------ */

/** پیدا کردن بهترین صدای فارسی مرورگر */
export function pickFaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "fa-IR") ??
    voices.find((v) => v.lang.startsWith("fa")) ??
    null
  );
}

let cachedVoices: SpeechSynthesisVoice[] = [];

/** لیست صداهای در دسترس مرورگر */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

/** تبدیل متن به صدا با تنظیمات کاربر */
export function speak(text: string, settings?: Partial<PublicSettings> | null): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fa-IR";
  utter.rate = settings?.ttsRate ?? 1;
  utter.volume = settings?.ttsVolume ?? 1;
  const voices = listVoices();
  const chosen = settings?.ttsVoiceURI
    ? voices.find((v) => v.voiceURI === settings.ttsVoiceURI) ?? null
    : pickFaVoice();
  if (chosen) utter.voice = chosen;
  window.speechSynthesis.speak(utter);
}

/** قطع فوری صدا (برای Barge-in) */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** آیا الان صدایی در حال پخش است؟ */
export function isSpeaking(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.speechSynthesis &&
    window.speechSynthesis.speaking
  );
}

/** فرمت مدت زمان (ثانیه → «۱:۲۳») */
export function formatTime(dateIso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateIso));
  } catch {
    return "";
  }
}

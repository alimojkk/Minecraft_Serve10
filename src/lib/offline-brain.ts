/**
 * مغز آفلاین (Offline Brain)
 * وقتی کلید API تنظیم نشده یا اینترنت قطع است، پاسخ‌های محلی و سریع
 * ساعت، تاریخ، نام، حافظه، راهنما و دستورهای ماینکرفت — بدون هیچ خطا
 */
import type { AppSettings, MemoryDTO } from "@/lib/types";
import { jalaliDate, jalaliDateTime, jalaliTime, toPersianDigits } from "@/lib/persian";

export interface OfflineContext {
  settings: AppSettings;
  memories: MemoryDTO[];
}

/** آیا پیام دربارهٔ ساعت است؟ */
function isTimeQuestion(text: string): boolean {
  return /(ساعت|وقت)(\s*(چنده|چند است|الان|امروز))?|چند\s*دقیقه|time/i.test(text);
}

/** آیا پیام دربارهٔ تاریخ است؟ */
function isDateQuestion(text: string): boolean {
  return /(تاریخ|امروز\s*چندمه|چندمه|روز\s*چنده|date)/i.test(text);
}

/** آیا پیام دربارهٔ نام/هویت دستیار یا کاربر است؟ */
function isNameQuestion(text: string): boolean {
  return /((?:اسم|نام)(?:م|ت|من|تو)|تو\s*کی\s*هستی|خودت\s*رو\s*معرفی|who are you|کی\s*هستی)/i.test(
    text
  );
}

/** آیا پیام دربارهٔ حافظه است؟ */
function isMemoryQuestion(text: string): boolean {
  return /(حافظه|یادت\s*(هست|مونده|هستش)|چی\s*یادت\s*مونده|memory)/i.test(text);
}

/** آیا پیام درخواست راهنماست؟ */
function isHelpRequest(text: string): boolean {
  return /(راهنما|کمک|چیکار\s*می‌تونی|چه\s*کارهایی|قابلیت|دستورات|help)/i.test(text);
}

/** آیا احوال‌پرسی است؟ */
function isGreeting(text: string): boolean {
  return /^(سلام|درود|سلام\s*علیک|های|hi|hello|خوبی|حالت\s*چطوره|چطوری)/i.test(
    text.trim()
  );
}

/** آیا تشکر است؟ */
function isThanks(text: string): boolean {
  return /(ممنون|مرسی|سپاس|متشکرم|thanks|thank you)/i.test(text);
}

/**
 * تولید پاسخ آفلاین — همیشه موفق، همیشه سریع، همیشه فارسی طبیعی
 */
export function offlineReply(text: string, ctx: OfflineContext): string {
  const { settings, memories } = ctx;
  const name = settings.assistantName || "دستیار";
  const t = text.trim();

  // ساعت
  if (isTimeQuestion(t)) {
    return `الان ساعت ${toPersianDigits(jalaliTime())} هست (به وقت تهران). ⏰`;
  }

  // تاریخ
  if (isDateQuestion(t)) {
    return `امروز ${jalaliDate()} هست.`;
  }

  // تاریخ و ساعت با هم
  if (/(تاریخ\s*و\s*ساعت|ساعت\s*و\s*تاریخ)/.test(t)) {
    return `الان ${jalaliDateTime()} هست.`;
  }

  // نام و هویت
  if (isNameQuestion(t)) {
    const userName = memories.find((m) => m.category === "profile");
    const extra = userName
      ? `و طبق حافظه‌ام، تو ${userName.content.replace(/^نام کاربر /, "").replace(/ است\.?$/, "")} هستی.`
      : "";
    return `من «${name}» هستم؛ یک دستیار هوش مصنوعی شخصی که روی همین کامپیوتر خودت اجرا می‌شم. ${extra} الان در حالت آفلاین‌ام، ولی بازم می‌تونم کمکت کنم.`;
  }

  // حافظه
  if (isMemoryQuestion(t)) {
    if (memories.length === 0)
      return "هنوز هیچ حافظه‌ای ذخیره نشده. هر وقت خواستی بگو: «این رو یادت بمونه: ...» تا ثبت کنم.";
    const lines = memories
      .slice(0, 10)
      .map((m, i) => `${i + 1}. ${m.title}: ${m.content}`)
      .join("\n");
    return `اینا چیزاییه که ازت یادمه:\n${lines}`;
  }

  // راهنما
  if (isHelpRequest(t)) {
    return `کارایی که الان می‌تونم برات انجام بدم:
• ساعت و تاریخ دقیق به وقت تهران
• ذخیرهٔ حافظه: «این رو یادت بمونه: ...»
• فراموشی: «این رو فراموش کن: ...»
• دستورهای ماینکرفت: «بیا دنبالم»، «وایسا»، «برو به مختصات ۱۰ ۶۴ ۱۰»، «چوب جمع کن»، «محافظت کن»، «اتوکلیک روشن»، «گزارش وضعیت»
• مکالمهٔ صوتی در صفحهٔ Voice
برای پاسخ‌های هوشمندتر هم کافیه در تنظیمات یه کلید API وصل کنی.`;
  }

  // احوال‌پرسی
  if (isGreeting(t)) {
    return `سلام! خوش اومدی. 😊 من «${name}»‌ام. الان حالت آفلاینه، ولی در خدمتم. چیکار کنم؟`;
  }

  // تشکر
  if (isThanks(t)) {
    return "خواهش می‌کنم! هر وقت کاری داشتی در خدمتم.";
  }

  // پاسخ پیش‌فرض آفلاین
  return `الان حالت آفلاین‌ام (کلید API تنظیم نشده یا اینترنت قطعه)، ولی این کارا رو بدون مشکل انجام می‌دم: ساعت، تاریخ، حافظه، راهنما و همهٔ دستورهای ماینکرفت. برای جواب‌های کامل‌تر، از صفحهٔ تنظیمات یه ارائه‌دهنده وصل کن.`;
}

/** آیا ارائه‌دهنده آمادهٔ اتصال به LLM هست؟ */
export function isProviderReady(settings: AppSettings): boolean {
  // مدل‌های داخلی رایگان همیشه آماده‌اند (بدون کلید)
  if (settings.provider === "builtin") return true;
  const needsKey = !["ollama", "lmstudio"].includes(settings.provider);
  if (needsKey && !settings.apiKey.trim()) return false;
  if (!settings.baseUrl.trim() || !settings.model.trim()) return false;
  return true;
}

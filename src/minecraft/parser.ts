/**
 * پارسر دستورهای زبان طبیعی فارسی برای ربات ماینکرفت
 * پشتیبانی کامل از ارقام فارسی/انگلیسی و اعداد منفی
 */
import type { ParsedCommand } from "@/minecraft/types";
import { toEnglishDigits } from "@/lib/persian";

/** نگاشت نام‌های فارسی بلوک‌ها به شناسهٔ ماینکرفت */
export const BLOCK_MAP: Record<string, string> = {
  چوب: "oak_log",
  درخت: "oak_log",
  الوار: "oak_log",
  لاگ: "oak_log",
  سنگ: "stone",
  خاک: "dirt",
  شن: "sand",
  ماسه: "sand",
  شنی: "sand",
  گراول: "gravel",
  ریگ: "gravel",
  الماس: "diamond_ore",
  آهن: "iron_ore",
  طلا: "gold_ore",
  ذغال: "coal_ore",
  "ذغال‌سنگ": "coal_ore",
  زمرد: "emerald_ore",
  لاجورد: "lapis_ore",
  رداستون: "redstone_ore",
  مس: "copper_ore",
  گل: "clay",
  رس: "clay",
  گلی: "clay",
  آجر: "bricks",
  چمن: "grass_block",
  چمنی: "grass_block",
  برگ: "oak_leaves",
  شیشه: "glass",
  ماسه‌سنگ: "sandstone",
  سنگ‌آهک: "calcite",
  برف: "snow_block",
  یخ: "ice",
  نی: "bamboo",
  بامبو: "bamboo",
  صخره: "cobblestone",
  کپ: "cobblestone"
};

/** تبدیل نام فارسی بلوک به شناسه */
export function normalizeBlockName(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (BLOCK_MAP[key]) return BLOCK_MAP[key];
  // اگر ورودی مستقیماً شناسهٔ انگلیسی بود
  if (/^[a-z0-9_]+$/.test(key)) return key;
  return null;
}

/** تبدیل اعداد (فارسی/انگلیسی/منفی) داخل متن برای استخراج مختصات */
function normalizeNumbers(text: string): string {
  return toEnglishDigits(text)
    .replace(/منفی\s*/g, "-")
    .replace(/,/g, " ");
}

const ON_WORDS = "(?:روشن|فعال|شروع|بزن|start|on|enable)";
const OFF_WORDS = "(?:خاموش|غیرفعال|قطع|تمام|stop|off|disable)";

/**
 * تحلیل متن فارسی کاربر و تبدیل به دستور ساخت‌یافته
 * اگر متن دستور ماینکرفتی نباشد، null برمی‌گرداند
 */
export function parseCommand(rawText: string): ParsedCommand | null {
  const text = normalizeNumbers(rawText.trim());
  const t = text.toLowerCase();

  /* ---- توقف فوری ---- */
  if (/^(وایسا|وایستا|استوپ|توقف|صبر\s*کن|دست\s*نگه\s*دار|متوقف|stop)\b/.test(t)) {
    return { type: "stop" };
  }

  /* ---- دنبال‌کردن ---- */
  if (/(بیا\s*دنبالم|منو\s*دنبال\s*کن|دنبالم\s*بیا|دنبالم\s*کن|follow\s*me)/.test(t)) {
    return { type: "follow" };
  }

  /* ---- بیا پیش من ---- */
  if (/(بیا\s*پیش\s*من|بیا\s*طرف\s*من|بیا\s*سمت\s*من|come\s*to\s*me)/.test(t)) {
    return { type: "come" };
  }

  /* ---- رفتن به مختصات ---- */
  const gotoMatch = t.match(
    /(?:برو\s*به\s*(?:مختصات|مکان|موقعیت)?|برو\s*به|goto|go\s*to)\s*(-?\d+)\s*[,\s]\s*(-?\d+)\s*[,\s]\s*(-?\d+)/
  );
  if (gotoMatch) {
    return {
      type: "goto",
      x: Number(gotoMatch[1]),
      y: Number(gotoMatch[2]),
      z: Number(gotoMatch[3])
    };
  }

  /* ---- جمع‌آوری بلوک ---- */
  // «چوب جمع کن» / «سنگ جمع کن» / «از اون بلوکا جمع کن»
  const collectMatch = t.match(/([\u0600-\u06FFa-z_]{2,20})\s*(?:ها)?\s*(?:رو)?\s*جمع\s*کن/);
  if (collectMatch) {
    const block = normalizeBlockName(collectMatch[1]);
    if (block) return { type: "collect", block };
    return { type: "collect", block: "oak_log" };
  }
  if (/جمع\s*کن/.test(t) && /(بلوک|چیز|اینا)/.test(t)) {
    return { type: "collect", block: "oak_log" };
  }

  /* ---- حملهٔ خودکار / اتوکلیک ---- */
  if (/(اتو\s*کلیک|اتوکلیک|حمله\s*خودکار|اتک\s*خودکار|auto\s*click|auto\s*attack)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "autoAttack", on: !off };
  }

  /* ---- محافظت ---- */
  if (/(محافظت|نگهبانی|پلیس|guard|protect)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "guard", on: !off };
  }

  /* ---- حالت موشک ---- */
  if (/(موشک|rocket|سریع\s*حرکت|عین\s*موشک)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "rocket", on: !off };
  }

  /* ---- پرش ---- */
  if (/^(بپر|پرش|jump)\b/.test(t) || /یه\s*بار\s*بپر/.test(t)) {
    return { type: "jump" };
  }

  /* ---- نگاه کردن ---- */
  if (/(به\s*من\s*نگاه\s*کن|نگام\s*کن|look\s*at\s*me)/.test(t)) {
    return { type: "look" };
  }

  /* ---- گفتن در چت ---- */
  const sayMatch = t.match(/(?:تو|در)\s*چت\s*بگو\s+(.+)/);
  if (sayMatch?.[1]) {
    // متن اصلی (نه نرمال‌شده) را بگو تا اعداد فارسی حفظ شوند
    const orig = rawText.trim().match(/(?:تو|در)\s*چت\s*بگو\s+(.+)/i);
    return { type: "say", text: (orig?.[1] ?? sayMatch[1]).trim() };
  }

  /* ---- گزارش وضعیت ---- */
  if (/(گزارش\s*وضعیت|وضعیتت|وضعیت\s*چطوره|گزارش\s*بده|status\s*report|گزارش)/.test(t)) {
    return { type: "status" };
  }

  /* ---- راهنمای دستورها ---- */
  if (/(دستورات\s*ماینکرفت|راهنمای\s*ماینکرفت|چه\s*دستورایی)/.test(t)) {
    return { type: "help" };
  }

  return null;
}

/** متن راهنمای دستورهای ماینکرفت */
export const MC_HELP_TEXT = `دستورهای ماینکرفت من اینا هستن:
• «بیا دنبالم» / «منو دنبال کن»
• «بیا پیش من»
• «وایسا» / «توقف فوری»
• «برو به مختصات ۱۰۰ ۶۴ -۳۰»
• «چوب جمع کن» / «سنگ جمع کن» / «الماس جمع کن»
• «بپر» — «به من نگاه کن»
• «تو چت بگو سلام بچه‌ها»
• «محافظت کن» / «محافظت رو خاموش کن» (حالت پلیسی)
• «موشک روشن» / «موشک خاموش» (حرکت سریع)
• «اتوکلیک روشن» / «اتوکلیک خاموش» (حملهٔ خودکار)
• «گزارش وضعیت»`;

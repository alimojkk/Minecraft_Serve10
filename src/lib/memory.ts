/**
 * موتور حافظهٔ دائمی — قوانین پنج‌گانهٔ حافظه
 * ۱. دستور صریح یادآوری  ۲. دستور صریح فراموشی  ۳. استخراج خودکار
 * ۴. امنیت داده‌ها (رمز/توکن هرگز ذخیره نمی‌شود)  ۵. بارگذاری در پرامپت
 */
import {
  createMemory,
  deleteMemory,
  findMemories,
  listMemories
} from "@/lib/store";
import type { MemoryCategory, MemoryDTO, MemorySource } from "@/lib/types";
import { cleanText, toEnglishDigits } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/* قانون ۴ — امنیت داده‌ها                                             */
/* ------------------------------------------------------------------ */

/** الگوهای اطلاعات حساس — هرگز نباید وارد حافظه شوند */
const SENSITIVE_PATTERN =
  /(رمز\s*(عبور|عبور|کارت|بانکی)?|پسورد|password|passwd|api[\s_-]?key|کلید\s*api|توکن|token|secret|credential|authorization|bearer\s+\S+|private\s*key|کلید\s*خصوصی)/i;

/** بررسی اینکه متن حاوی اطلاعات حساس هست یا نه */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERN.test(text);
}

/* ------------------------------------------------------------------ */
/* قانون ۱ — دستور صریح یادآوری                                        */
/* ------------------------------------------------------------------ */

const REMEMBER_PATTERNS: RegExp[] = [
  /(?:این\s*رو\s*)?یادت?\s*(?:بمونه|بمانه|باشه|بماند)\s*[:：]?\s*(.+)/i,
  /به\s*خاطر\s*بسپار\s*[:：]?\s*(.+)/i,
  /یادداشت\s*کن\s*[:：]?\s*(.+)/i,
  /ثبت\s*کن\s*[:：]?\s*(.+)/i,
  /remember\s+(?:that\s+)?:?\s*(.+)/i
];

/** اگر پیام دستور «یادآوری صریح» باشد، متن یادآوری را برمی‌گرداند */
export function matchExplicitRemember(text: string): string | null {
  for (const p of REMEMBER_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) return cleanText(m[1]);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* قانون ۲ — دستور صریح فراموشی                                        */
/* ------------------------------------------------------------------ */

const FORGET_PATTERNS: RegExp[] = [
  /(?:این\s*رو\s*)?فراموش\s*کن\s*[:：]?\s*(.+)/i,
  /از\s*یادت\s*ببر\s*[:：]?\s*(.+)/i,
  /حذفش?\s*کن\s*از\s*حافظه\s*[:：]?\s*(.+)/i,
  /forget\s+(?:about\s+)?:?\s*(.+)/i
];

/** اگر پیام دستور «فراموشی» باشد، کلیدواژهٔ حذف را برمی‌گرداند */
export function matchExplicitForget(text: string): string | null {
  for (const p of FORGET_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) return cleanText(m[1]);
  }
  return null;
}

/** اجرای دستور فراموشی — حذف رکوردهای منطبق */
export function applyForget(keyword: string): number {
  const matches = findMemories(keyword);
  for (const m of matches) deleteMemory(m.id);
  return matches.length;
}

/* ------------------------------------------------------------------ */
/* قانون ۱ (اجرا) — ذخیرهٔ یادآوری صریح                                */
/* ------------------------------------------------------------------ */

/** تشخیص دسته‌بندی از روی متن یادآوری */
export function guessCategory(text: string): MemoryCategory {
  const t = toEnglishDigits(text).toLowerCase();
  if (/ماینکرفت|minecraft|سرور|ربات|بلوک|ماین/.test(t)) return "minecraft";
  if (/هدف|می‌خوام|برنامه|قصد|آرزو/.test(t)) return "goal";
  if (/(دوست\s*دارم|علاقه|ترجیح|مهمه|بهم\s*میاد|سلیقه)/.test(t))
    return "preference";
  if (/اسم|نام|شغل|سن|شهر|آدرس|خانواده|من\s+هستم/.test(t)) return "profile";
  return "note";
}

/** ذخیرهٔ یادآوری صریح در حافظه */
export function rememberExplicit(text: string): MemoryDTO {
  const category = guessCategory(text);
  return createMemory({
    category,
    title: text.slice(0, 60),
    content: text,
    source: "explicit"
  });
}

/* ------------------------------------------------------------------ */
/* قانون ۳ — استخراج خودکار (Auto Memory) با Regex                     */
/* ------------------------------------------------------------------ */

interface AutoExtractResult {
  title: string;
  content: string;
  category: MemoryCategory;
}

/**
 * حذف «ه» کپولای محاوره‌ای انتهای کلمه
 * مثال: «علیه» ← «علی» ولی «زهرا» دست‌نخورده می‌ماند
 */
function stripCopula(word: string): string {
  const w = word.trim();
  if (w.length > 2 && w.endsWith("ه")) {
    const stem = w.slice(0, -1);
    // اگر ریشه به حرف مصوت/میانی تمام شد، احتمالاً «ه» کپولا بوده
    if (/[یاوزژ]\s*$/.test(stem)) return stem;
  }
  return w;
}

/** الگوهای استخراج خودکار اطلاعات کاربر از جملات طبیعی */
const AUTO_PATTERNS: Array<{
  pattern: RegExp;
  build: (m: RegExpMatchArray) => AutoExtractResult | null;
}> = [
  // «اسم من علی است» / «نام من علیه»
  {
    pattern: /(?:اسم|نام)\s*من\s+([\u0600-\u06FFA-Za-z\s]{2,30}?)\s*(?:است|هست|اِس|می‌باشد)\s*[.!?،]?$/,
    build: (m) => ({
      title: "نام کاربر",
      content: `نام کاربر ${stripCopula(cleanText(m[1]))} است.`,
      category: "profile"
    })
  },
  // «اسم من علیه» (کپولای محاوره‌ای بدون «است/هست»)
  {
    pattern: /(?:اسم|نام)\s*من\s+([\u0600-\u06FFA-Za-z]{2,20})\s*[.!?،]?$/,
    build: (m) => ({
      title: "نام کاربر",
      content: `نام کاربر ${stripCopula(cleanText(m[1]))} است.`,
      category: "profile"
    })
  },
  // «من علی هستم»
  {
    pattern: /^من\s+([\u0600-\u06FF]{2,20})\s*هستم\s*[.!?،]?$/,
    build: (m) => ({
      title: "نام کاربر",
      content: `نام کاربر ${stripCopula(cleanText(m[1]))} است.`,
      category: "profile"
    })
  },
  // «من به ماینکرفت علاقه دارم»
  {
    pattern: /من\s*به\s*(.+?)\s*علاقه\s*(?:دارم|مندم)/,
    build: (m) => ({
      title: `علاقه: ${cleanText(m[1]).slice(0, 30)}`,
      content: `کاربر به ${cleanText(m[1])} علاقه دارد.`,
      category: /ماینکرفت|minecraft/i.test(m[1]) ? "minecraft" : "preference"
    })
  },
  // «من ماینکرفت رو دوست دارم»
  {
    pattern: /من\s*(.+?)\s*رو\s*دوست\s*دارم/,
    build: (m) => ({
      title: `علاقه: ${cleanText(m[1]).slice(0, 30)}`,
      content: `کاربر ${cleanText(m[1])} را دوست دارد.`,
      category: /ماینکرفت|minecraft/i.test(m[1]) ? "minecraft" : "preference"
    })
  },
  // «هدفم ... است» / «هدفم ...» (محاوره‌ای)
  {
    pattern: /هدفم\s*(?:این\s*(?:هست|است)\s*)?(?:که\s*)?(.+)\s*[.!?،]?$/,
    build: (m) => {
      const raw = cleanText(m[1]).replace(/\s*(?:است|هست)\s*$/, "");
      return {
        title: `هدف: ${stripCopula(raw).slice(0, 30)}`,
        content: `هدف کاربر: ${stripCopula(raw)}`,
        category: "goal"
      };
    }
  },
  // «شغل من ... است» / «شغل من ...» (محاوره‌ای)
  {
    pattern: /شغل\s*من\s+(.+)\s*[.!?،]?$/,
    build: (m) => {
      // حذف «است/هست» و «ه» کپولای محاوره‌ای («برنامه‌نویسه» ← «برنامه‌نویس»)
      const raw = cleanText(m[1])
        .replace(/\s*(?:است|هست)\s*$/, "")
        .replace(/ه$/, "");
      return {
        title: "شغل کاربر",
        content: `شغل کاربر ${raw} است.`,
        category: "profile"
      };
    }
  },
  // «من در ... زندگی می‌کنم»
  {
    pattern: /من\s*(?:در|توی|تو)\s*(.+?)\s*زندگی\s*می‌کنم/,
    build: (m) => ({
      title: "شهر محل سکونت",
      content: `کاربر در ${cleanText(m[1])} زندگی می‌کند.`,
      category: "profile"
    })
  }
];

/**
 * استخراج خودکار اطلاعات از پیام کاربر
 * فقط وقتی فراخوانی می‌شود که autoMemory فعال باشد
 */
export function extractAutoMemories(text: string): MemoryDTO[] {
  if (containsSensitiveData(text)) return [];
  const created: MemoryDTO[] = [];
  for (const { pattern, build } of AUTO_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const item = build(m);
      if (item) {
        // جلوگیری از ثبت تکراری
        const exists = findMemories(item.content.slice(0, 20)).some(
          (x) => x.content === item.content
        );
        if (!exists) {
          created.push(
            createMemory({
              category: item.category,
              title: item.title,
              content: item.content,
              source: "auto"
            })
          );
        }
      }
    }
  }
  return created;
}

/* ------------------------------------------------------------------ */
/* قانون ۵ — فرمت‌دهی حافظه‌ها برای System Prompt                      */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  profile: "مشخصات",
  preference: "ترجیح",
  goal: "هدف",
  minecraft: "ماینکرفت",
  note: "یادداشت",
  other: "سایر"
};

/** فرمت‌کردن حافظه‌ها برای تزریق در پرامپت (تا ۴۰ مورد) */
export function formatMemoriesForPrompt(list: MemoryDTO[]): string {
  if (list.length === 0) return "— هنوز حافظه‌ای ثبت نشده است.";
  return list
    .slice(0, 40)
    .map(
      (m) =>
        `• [${CATEGORY_LABELS[m.category]}] ${m.title}: ${m.content}`
    )
    .join("\n");
}

export { listMemories };

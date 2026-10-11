/**
 * ابزارهای فارسی: نرمال‌سازی ارقام، تاریخ و ساعت هجری شمسی، فرمت‌های نمایش
 */

/** تبدیل ارقام فارسی/عربی به انگلیسی برای پردازش عددی */
export function toEnglishDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fi = fa.indexOf(ch);
    if (fi >= 0) return String(fi);
    const ai = ar.indexOf(ch);
    if (ai >= 0) return String(ai);
    return ch;
  });
}

/** تبدیل ارقام انگلیسی به فارسی برای نمایش */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** قالب تاریخ و ساعت هجری شمسی با منطقهٔ زمانی تهران */
export function jalaliDateTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleString("fa-IR");
  }
}

/** فقط ساعت (تهران) */
export function jalaliTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleTimeString("fa-IR");
  }
}

/** فقط تاریخ شمسی (تهران) */
export function jalaliDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "full"
    }).format(date);
  } catch {
    return date.toLocaleDateString("fa-IR");
  }
}

/** کوتاه‌کردن متن برای عنوان گفتگو */
export function truncateTitle(text: string, max = 32): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + "…";
}

/** پاک‌سازی متن ورودی از فاصله‌های اضافه */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

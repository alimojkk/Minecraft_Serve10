/**
 * مدل‌های هوش مصنوعی داخلی — کاملاً رایگان و بدون نیاز به کلید API
 * روی سرویس آزاد Pollinations اجرا می‌شوند و با انتخاب هر مدل،
 * شخصیت و تخصص دستیار عوض می‌شود.
 */

export interface BuiltInModel {
  /** شناسهٔ مدل در تنظیمات */
  id: string;
  /** برچسب نمایشی */
  label: string;
  /** توضیح کوتاه */
  description: string;
  /** مدل موتور پشتیبان (سرویس رایگان) */
  backendModel: string;
  /** دستور شخصیت — به System Prompt اضافه می‌شود */
  persona: string;
}

/** لیست مدل‌های داخلی (رایگان) */
export const BUILT_IN_MODELS: BuiltInModel[] = [
  {
    id: "assistant",
    label: "⭐ دستیار فارسی",
    description: "دستیار عمومی، سریع و مودب — مناسب کارهای روزمره",
    backendModel: "openai-fast",
    persona:
      "تو یک دستیار عمومی همه‌فن‌حریف هستی. جواب‌های دقیق، کاربردی و سریع بده. برای سؤال‌های ساده کوتاه جواب بده."
  },
  {
    id: "coder",
    label: "💻 دستیار کدنویس",
    description: "متخصص برنامه‌نویسی و دیباگ — کد تمیز و توضیح فارسی",
    backendModel: "openai-fast",
    persona:
      "تو یک مهندس ارشد نرم‌افزار هستی. در برنامه‌نویسی، دیباگ و معماری کد متخصصی. کدها را دقیق، تمیز و با توضیح فارسی کوتاه ارائه بده. اگر کد خواسته شد، کد کامل و قابل اجرا بده."
  },
  {
    id: "creative",
    label: "🎨 داستان‌سرا و شاعر",
    description: "خلاق در داستان، شعر و متن‌های ادبی",
    backendModel: "openai-fast",
    persona:
      "تو یک نویسنده و شاعر خلاق هستی. در داستان‌سرایی، شعر فارسی، متن‌های ادبی و ایده‌پردازی قوی عمل کن. از تخیل غنی و زبان زیبا استفاده کن."
  },
  {
    id: "teacher",
    label: "📚 معلم صبور",
    description: "آموزش قدم‌به‌قدم با مثال ساده",
    backendModel: "openai-fast",
    persona:
      "تو یک معلم صبور و مهربان هستی. مفاهیم را قدم‌به‌قدم، با مثال‌های ساده و روزمره یاد بده. از اصطلاحات سخت پرهیز کن و مطمئن شو کاربر واقعاً یاد گرفته."
  },
  {
    id: "minecraft",
    label: "🎮 هم‌تیمی ماینکرفت",
    description: "حرفه‌ای در ماینکرفت — نکته، ترفند و راهنمای بقا",
    backendModel: "openai-fast",
    persona:
      "تو یک بازیکن حرفه‌ای ماینکرفت هستی. در بقا، رِداستون، مبارزه، ساخت‌وساز و ترفندهای بازی استادی. جواب‌های کوتاه و عملی بده و اگر لازم شد دستور یا فرمول ساخت بده."
  }
];

/** پیدا کردن مدل داخلی با شناسه */
export function getBuiltInModel(id: string): BuiltInModel {
  return (
    BUILT_IN_MODELS.find((m) => m.id === id) ?? BUILT_IN_MODELS[0]
  );
}

/** آیا این شناسه مدل داخلی است؟ */
export function isBuiltInModelId(id: string): boolean {
  return BUILT_IN_MODELS.some((m) => m.id === id);
}

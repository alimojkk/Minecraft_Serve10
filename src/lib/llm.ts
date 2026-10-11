/**
 * لایهٔ اتصال به ارائه‌دهنده‌های هوش مصنوعی
 *
 * ۱. مدل‌های داخلی رایگان (Pollinations) — بدون کلید API، پیش‌فرض برنامه
 * ۲. ارائه‌دهنده‌های OpenAI-Compatible: OpenAI، OpenRouter، Groq، xAI، Ollama، LM Studio
 *
 * کلید API فقط همین‌جا استفاده می‌شود و هرگز به کلاینت برنمی‌گردد
 */
import type { AppSettings, ConnectionTestResult } from "@/lib/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** آدرس سرویس رایگان داخلی (Pollinations — بدون کلید) */
export const BUILT_IN_API_URL = "https://text.pollinations.ai/";

/* ------------------------------------------------------------------ */
/* کمکی‌های مشترک                                                     */
/* ------------------------------------------------------------------ */

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  return headers;
}

/** پارس رویدادهای SSE (خط‌های data: ...) و استخراج تکه‌های متن */
async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        // فقط محتوای اصلی — بخش‌های reasoning نادیده گرفته می‌شوند
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // خطوط ناقص SSE را نادیده بگیر
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* مدل‌های داخلی رایگان (بدون کلید API)                                */
/* ------------------------------------------------------------------ */

/**
 * استریم از سرویس رایگان داخلی (Pollinations)
 * بدون هیچ کلیدی کار می‌کند؛ اگر استریم ناموفق بود، به GET ساده سقوط می‌کند
 */
export async function* streamBuiltInCompletion(opts: {
  backendModel: string;
  messages: ChatMessage[];
  temperature?: number;
}): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch(BUILT_IN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.backendModel,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        stream: true,
        private: true
      })
    });
  } catch {
    // اینترنت قطع است — سقوط به GET (که آن هم ممکن است موفق نشود)
    res = new Response(null, { status: 503 });
  }

  if (res.ok && res.body) {
    try {
      let got = false;
      for await (const chunk of parseSseStream(res.body)) {
        got = true;
        yield chunk;
      }
      if (got) return;
      // استریم خالی بود — سقوط به GET ساده
    } catch {
      /* سقوط به روش ساده */
    }
  }

  // روش دوم: GET ساده با آخرین پیام کاربر + خلاصهٔ پرامپت
  const lastUser = [...opts.messages]
    .reverse()
    .find((m) => m.role === "user")?.content ?? "سلام";
  const system = opts.messages.find((m) => m.role === "system")?.content ?? "";
  const promptText = system
    ? `${system}\n\n---\nکاربر: ${lastUser}\nدستیار:`
    : lastUser;

  const text = await builtInSimpleReply(promptText, opts.backendModel);
  yield text;
}

/** پاسخ ساده با GET — روش پشتیبان مدل‌های داخلی */
export async function builtInSimpleReply(
  prompt: string,
  model: string
): Promise<string> {
  const url = `${BUILT_IN_API_URL}${encodeURIComponent(prompt)}`;
  const res = await fetch(url, {
    headers: { Accept: "text/plain" }
  });
  if (!res.ok) throw new Error(`سرویس رایگان خطای ${res.status} داد.`);
  const text = (await res.text()).trim();
  if (!text || text === "{}") {
    throw new Error("سرویس رایگان پاسخی نداد.");
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* ارائه‌دهنده‌های OpenAI-Compatible                                   */
/* ------------------------------------------------------------------ */

/** آدرس endpoint مکالمه */
function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") + "/chat/completions";
}

/** استریم پاسخ مدل — در صورت خطا exception پرتاب می‌شود */
export async function* streamChatCompletion(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const res = await fetch(chatCompletionsUrl(opts.baseUrl), {
    method: "POST",
    headers: buildHeaders(opts.apiKey),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ارائه‌دهنده خطای ${res.status} داد: ${body.slice(0, 200)}`);
  }
  if (!res.body) throw new Error("بدنهٔ پاسخ خالی است.");

  yield* parseSseStream(res.body);
}

/* ------------------------------------------------------------------ */
/* تست اتصال                                                          */
/* ------------------------------------------------------------------ */

/** تست اتصال زنده — برای مدل‌های داخلی و ارائه‌دهنده‌های سفارشی */
export async function testConnection(
  settings: Pick<AppSettings, "baseUrl" | "apiKey" | "model" | "provider">
): Promise<ConnectionTestResult> {
  try {
    if (settings.provider === "builtin") {
      // تست سرویس رایگان داخلی با GET ساده (پایدارترین مسیر)
      try {
        const text = await builtInSimpleReply("سلام", "openai-fast");
        if (text.trim()) {
          return {
            ok: true,
            message: "مدل داخلی رایگان آماده‌ست! ✅ بدون کلید API کار می‌کنه.",
            model: "openai-fast"
          };
        }
      } catch {
        /* سقوط به تست POST */
      }
      // روش دوم: POST با استریم
      const res = await fetch(BUILT_IN_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai-fast",
          messages: [{ role: "user", content: "سلام" }],
          stream: true,
          private: true
        })
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `سرویس رایگان خطای ${res.status} داد. کمی بعد دوباره امتحان کن.`
        };
      }
      return {
        ok: true,
        message: "مدل داخلی رایگان آماده‌ست! ✅ بدون کلید API کار می‌کنه.",
        model: "openai-fast"
      };
    }

    const res = await fetch(chatCompletionsUrl(settings.baseUrl), {
      method: "POST",
      headers: buildHeaders(settings.apiKey),
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: "سلام" }],
        max_tokens: 8,
        temperature: 0
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `ارائه‌دهنده خطای ${res.status} برگرداند. ${body.slice(0, 160)}`
      };
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      ok: true,
      message: "اتصال موفق بود! ✅ ارائه‌دهنده آمادهٔ کاره.",
      model: data.model ?? settings.model
    };
  } catch (err) {
    return {
      ok: false,
      message: `اتصال برقرار نشد: ${err instanceof Error ? err.message : "خطای ناشناخته"}`
    };
  }
}

/** لیست مدل‌های یک ارائه‌دهندهٔ محلی (Ollama / LM Studio) */
export async function listRemoteModels(
  baseUrl: string,
  apiKey = ""
): Promise<string[]> {
  try {
    const res = await fetch(baseUrl.replace(/\/+$/, "") + "/models", {
      headers: buildHeaders(apiKey)
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

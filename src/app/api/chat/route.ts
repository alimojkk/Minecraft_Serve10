/**
 * API چت — قلب تپندهٔ «دستیار»
 * ترتیب کار: رهگیری حافظه ← رهگیری دستور ماینکرفت ← LLM (یا مغز آفلاین)
 * پاسخ به صورت استریم متنی برمی‌گردد
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import { getBuiltInModel } from "@/lib/builtin-models";
import {
  applyForget,
  containsSensitiveData,
  extractAutoMemories,
  matchExplicitForget,
  matchExplicitRemember,
  rememberExplicit
} from "@/lib/memory";
import { buildChatHistory, buildSystemPrompt } from "@/lib/prompt";
import { isProviderReady, offlineReply } from "@/lib/offline-brain";
import {
  streamBuiltInCompletion,
  streamChatCompletion,
  type ChatMessage
} from "@/lib/llm";
import {
  appendMessage,
  autoTitleConversation,
  createConversation,
  getConversation,
  getSettings,
  listMessages,
  recentMemories
} from "@/lib/store";
import type { MessageMeta, ReplyMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ساخت پاسخ استریم متنی با هدرهای گفتگو */
function textStream(
  text: string,
  conversationId: number,
  mode: ReplyMode
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": String(conversationId),
      "X-Reply-Mode": mode
    }
  });
}

export async function POST(req: NextRequest) {
  let body: { conversationId?: number; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "متن پیام خالی است." }, { status: 400 });
  }

  const settings = getSettings();

  /* ---------------- گفتگو ---------------- */
  let conversationId = body.conversationId ?? null;
  if (conversationId != null && !getConversation(conversationId)) {
    conversationId = null;
  }
  if (conversationId == null) {
    conversationId = createConversation().id;
  }
  const convId = conversationId;

  /* ---------------- قانون ۱ و ۲ حافظه: رهگیری قبل از LLM ---------------- */
  const rememberText = matchExplicitRemember(content);
  if (rememberText) {
    let reply: string;
    const meta: MessageMeta = { mode: "memory", memories: [] };
    if (containsSensitiveData(rememberText)) {
      reply =
        "⛔ این اطلاعات حساسه (رمز، توکن یا کلید API) و برای امنیتت توی حافظه ذخیره نمی‌کنم.";
      meta.blocked = true;
    } else {
      const mem = rememberExplicit(rememberText);
      meta.memories = [mem.title];
      reply = `✅ یاد گرفتم: «${mem.content}» — توی حافظه ذخیره شد.`;
    }
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, meta);
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "memory");
  }

  const forgetKeyword = matchExplicitForget(content);
  if (forgetKeyword) {
    const count = applyForget(forgetKeyword);
    const reply =
      count > 0
        ? `🗑️ باشه، ${count} مورد مرتبط با «${forgetKeyword}» رو از حافظه پاک کردم.`
        : `چیزی مرتبط با «${forgetKeyword}» توی حافظه پیدا نکردم.`;
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, { mode: "memory" });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "memory");
  }

  /* ---------------- رهگیری دستورهای ماینکرفت (محلی و سریع) ---------------- */
  const mcResult = await botManager.runCommand(content);
  if (mcResult.command !== "none") {
    const reply = mcResult.reply || "دستور اجرا شد.";
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, {
      mode: "minecraft",
      ok: mcResult.ok,
      command: mcResult.command
    });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "minecraft");
  }

  /* ---------------- قانون ۳ حافظه: استخراج خودکار ---------------- */
  const autoMems = settings.autoMemory ? extractAutoMemories(content) : [];
  const meta: MessageMeta = {
    mode: "llm",
    memories: autoMems.map((m) => m.title)
  };

  /* ---------------- آماده‌سازی تاریخچه ---------------- */
  const history = listMessages(convId).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content
  }));
  appendMessage(convId, "user", content);
  autoTitleConversation(convId, content);

  const memories = recentMemories(40);
  // مدل‌های داخلی، شخصیت تخصصی خودشان را دارند
  const persona =
    settings.provider === "builtin"
      ? getBuiltInModel(settings.model).persona
      : undefined;
  const systemPrompt = buildSystemPrompt(settings, memories, persona);
  const llmMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...buildChatHistory(history.concat([{ role: "user" as const, content }]))
  ];

  /* ---------------- حالت آفلاین ---------------- */
  if (!isProviderReady(settings)) {
    const reply = offlineReply(content, { settings, memories });
    appendMessage(convId, "assistant", reply, { mode: "offline" });
    return textStream(reply, convId, "offline");
  }

  /* ---------------- استریم از ارائه‌دهنده با سقوط امن به آفلاین ---------------- */
  const encoder = new TextEncoder();
  let fullText = "";
  let failed: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (settings.provider === "builtin") {
          // مدل داخلی رایگان — بدون کلید API
          const preset = getBuiltInModel(settings.model);
          for await (const chunk of streamBuiltInCompletion({
            backendModel: preset.backendModel,
            messages: llmMessages
          })) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } else {
          for await (const chunk of streamChatCompletion({
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            model: settings.model,
            messages: llmMessages
          })) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        meta.mode = "llm";
      } catch (err) {
        // سقوط به مغز آفلاین — بدون خطای قرمز برای کاربر
        failed = err instanceof Error ? err.message : "خطای ناشناخته";
        meta.error = failed;
        meta.mode = "offline";
        const fallback = offlineReply(content, { settings, memories });
        fullText = fallback;
        controller.enqueue(encoder.encode(fallback));
      } finally {
        appendMessage(convId, "assistant", fullText, meta);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": String(convId),
      "X-Reply-Mode": meta.mode
    }
  });
}

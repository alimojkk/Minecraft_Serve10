"use client";

/**
 * صفحهٔ اصلی چت — سایدبار گفتگوها، استریم زنده، تایپ‌رایتر، پخش صدا
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brain,
  Mic,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  X
} from "lucide-react";
import Link from "next/link";
import { Btn, Field } from "@/components/ui";
import { apiGet, apiSend, formatTime, speak, stopSpeaking } from "@/lib/client";
import type {
  ConversationDTO,
  MessageDTO,
  MessageMeta,
  PublicSettings
} from "@/lib/types";

const QUICK_SUGGESTIONS = [
  "ساعت چنده؟",
  "این رو یادت بمونه: اسم من علیه",
  "بیا دنبالم",
  "گزارش وضعیت",
  "محافظت کن",
  "چیکار می‌تونی برام بکنی؟"
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ---------------- بارگذاری ---------------- */

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiGet<{ conversations: ConversationDTO[] }>(
        "/api/conversations"
      );
      setConversations(data.conversations);
    } catch {
      /* بی‌صدا */
    }
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    try {
      const data = await apiGet<{ messages: MessageDTO[] }>(
        `/api/conversations/${id}`
      );
      setMessages(data.messages);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => setSettings(d.settings))
      .catch(() => undefined);
  }, [loadConversations]);

  useEffect(() => {
    if (activeId != null) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  /* ---------------- ارسال پیام ---------------- */

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;

    stopSpeaking();
    setError(null);
    setInput("");
    setBusy(true);

    const userMsg: MessageDTO = {
      id: Date.now(),
      conversationId: activeId ?? 0,
      role: "user",
      content,
      meta: null,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, content })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "خطای ناشناخته");
      }

      const convId = Number(res.headers.get("X-Conversation-Id"));
      const mode = (res.headers.get("X-Reply-Mode") ?? "llm") as MessageMeta["mode"];
      if (convId && convId !== activeId) setActiveId(convId);

      // خواندن استریم
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreamText(full);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          conversationId: convId,
          role: "assistant",
          content: full,
          meta: { mode },
          createdAt: new Date().toISOString()
        }
      ]);
      setStreamText("");
      // پخش خودکار صدای پاسخ — بدون نیاز به کلیک
      if (settings?.autoSpeak && full.trim()) {
        speak(full, settings);
      }
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ارسال پیام ناموفق بود.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  /* ---------------- مدیریت گفتگوها ---------------- */

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  const renameChat = async (conv: ConversationDTO) => {
    const title = window.prompt("عنوان جدید گفتگو:", conv.title);
    if (!title?.trim()) return;
    try {
      await apiSend(`/api/conversations/${conv.id}`, "PATCH", {
        title: title.trim()
      });
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر عنوان ناموفق بود.");
    }
  };

  const deleteChat = async (conv: ConversationDTO) => {
    if (!window.confirm(`گفتگوی «${conv.title}» حذف بشه؟`)) return;
    try {
      await apiSend(`/api/conversations/${conv.id}`, "DELETE");
      if (activeId === conv.id) newChat();
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حذف ناموفق بود.");
    }
  };

  /* ---------------- فیلتر سرچ ---------------- */

  const filtered = conversations.filter(
    (c) =>
      c.title.includes(search.trim()) ||
      (c.preview ?? "").includes(search.trim())
  );

  /* ---------------- رندر ---------------- */

  return (
    <div className="flex h-screen">
      {/* سایدبار گفتگوها */}
      <aside className="hidden w-72 shrink-0 flex-col gap-3 border-l border-white/10 bg-night-900/40 p-4 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold text-white">گفتگوها</h2>
          <Btn onClick={newChat} className="!px-3 !py-2" title="گفتگوی جدید">
            <Plus size={18} />
          </Btn>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو..."
            className="field !pr-9"
          />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pl-1">
          {filtered.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              هنوز گفتگویی نیست. یکی شروع کن!
            </p>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className={`group cursor-pointer rounded-xl border p-3 transition ${
                  activeId === c.id
                    ? "border-neon-cyan/50 bg-white/10"
                    : "border-white/5 bg-white/5 hover:bg-white/10"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 truncate text-sm font-medium text-slate-100">
                    {c.title}
                  </p>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        renameChat(c);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                      title="تغییر عنوان"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(c);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {c.preview ? (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {c.preview}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* بخش اصلی چت */}
      <section className="flex flex-1 flex-col">
        {/* هدر */}
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-violet font-bold text-night-950 shadow-glow">
            د
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-white">
              {settings?.assistantName ?? "دستیار"}
            </h1>
            <p className="text-xs text-slate-400">
              دستیار هوش مصنوعی شخصی — محلی و فارسی
            </p>
          </div>
          <Link
            href="/voice"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="مکالمهٔ صوتی"
          >
            <Mic size={18} />
          </Link>
          <button
            onClick={newChat}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            title="گفتگوی جدید"
          >
            <Plus size={18} />
          </button>
        </header>

        {/* پیام‌ها */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.length === 0 && !streamText ? (
            <div className="mx-auto mt-10 max-w-lg text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 shadow-glow">
                <Sparkles size={28} className="text-neon-cyan" />
              </div>
              <h2 className="text-xl font-bold text-white">
                سلام! من «{settings?.assistantName ?? "دستیار"}»‌ام 👋
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                هر چی خواستی بپرس؛ از ساعت و تاریخ بگیر تا کنترل ربات ماینکرفت.
                می‌تونی بهم بگی «این رو یادت بمونه» تا چیزای مهم رو همیشه به یاد
                داشته باشم.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:border-neon-cyan/40 hover:bg-white/10 hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex animate-fade-up ${
                m.role === "user" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[80%] px-5 py-3.5 text-sm leading-7 ${
                  m.role === "user" ? "bubble-user" : "bubble-assistant"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-300/70">
                  <span>{formatTime(m.createdAt)}</span>
                  {m.role === "assistant" ? (
                    <button
                      onClick={() => speak(m.content, settings)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-white/10 hover:text-neon-cyan"
                      title="پخش صدا"
                    >
                      <Volume2 size={12} /> پخش
                    </button>
                  ) : null}
                  {m.meta?.mode === "offline" ? (
                    <span className="rounded bg-white/10 px-1.5 py-0.5">آفلاین</span>
                  ) : null}
                  {m.meta?.mode === "memory" ? (
                    <span className="rounded bg-white/10 px-1.5 py-0.5">حافظه</span>
                  ) : null}
                  {m.meta?.mode === "minecraft" ? (
                    <span className="rounded bg-white/10 px-1.5 py-0.5">ماینکرفت</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {/* پیام در حال استریم */}
          {streamText ? (
            <div className="flex justify-end">
              <div className="bubble-assistant max-w-[80%] px-5 py-3.5 text-sm leading-7">
                <p className="whitespace-pre-wrap">
                  {streamText}
                  <span className="typing-caret" />
                </p>
              </div>
            </div>
          ) : null}

          {busy && !streamText ? (
            <div className="flex justify-end">
              <div className="bubble-assistant px-5 py-3.5 text-sm text-slate-400">
                در حال فکر کردن...
                <span className="typing-caret" />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-1">
                <X size={16} />
              </button>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {/* باکس ورودی */}
        <footer className="border-t border-white/10 px-6 py-4">
          {messages.length === 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-400 transition hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Link
              href="/memory"
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-400 transition hover:text-white"
              title="حافظه"
            >
              <Brain size={18} />
            </Link>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="پیامت رو بنویس... (Enter برای ارسال)"
              className="field max-h-32 min-h-[46px] flex-1 resize-none"
            />
            <Btn
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="!p-3"
              title="ارسال"
            >
              <Send size={18} className="-scale-x-100" />
            </Btn>
          </div>
        </footer>
      </section>
    </div>
  );
}

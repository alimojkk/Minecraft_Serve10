/**
 * لایهٔ دسترسی به داده‌ها (Data Access) — تمام خواندن‌ها و نوشتن‌های دیتابیس
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conversations,
  memories,
  messages,
  servers,
  settings
} from "@/db/schema";
import type {
  AppSettings,
  ConversationDTO,
  MemoryCategory,
  MemoryDTO,
  MemorySource,
  MessageDTO,
  MessageMeta,
  PublicSettings,
  Role,
  ServerDTO
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* تنظیمات پیش‌فرض                                                     */
/* ------------------------------------------------------------------ */

/** مقادیر پیش‌فرض تنظیمات برنامه — با مدل داخلی رایگان، بدون نیاز به کلید */
export const DEFAULT_SETTINGS: AppSettings = {
  provider: "builtin",
  baseUrl: "https://text.pollinations.ai/",
  model: "assistant",
  apiKey: "",
  assistantName: "دستیار",
  tone: "friendly",
  verbosity: "balanced",
  autoMemory: true,
  autoSpeak: true,
  ttsRate: 1,
  ttsVolume: 1,
  ttsVoiceURI: null,
  microphoneId: null,
  mcLastHost: null,
  mcLastPort: 25565,
  mcLastUsername: null,
  mcGuardRadius: 16,
  mcProtectTarget: null
};

/** نگاشت ارائه‌دهنده به آدرس پایه */
export const PROVIDER_BASE_URLS: Record<string, string> = {
  builtin: "https://text.pollinations.ai/",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  xai: "https://api.x.ai/v1",
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
  custom: ""
};

/* ------------------------------------------------------------------ */
/* کمکی‌های تبدیل                                                      */
/* ------------------------------------------------------------------ */

function iso(d: Date | number | null | undefined): string | null {
  if (d == null) return null;
  const date = typeof d === "number" ? new Date(d) : d;
  return date.toISOString();
}

function parseMeta(raw: string | null): MessageMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MessageMeta;
  } catch {
    return { mode: "llm" };
  }
}

/** ماسک کردن کلید API — فقط ۴ کاراکتر آخر نمایش داده می‌شود */
export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "....";
  return "..." + key.slice(-4);
}

/* ------------------------------------------------------------------ */
/* تنظیمات                                                             */
/* ------------------------------------------------------------------ */

/** خواندن تنظیمات (با اعمال مقادیر پیش‌فرض) */
export function getSettings(): AppSettings {
  const row = db.select().from(settings).where(eq(settings.key, "app")).get();
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** ذخیرهٔ تنظیمات (ادغام با مقادیر قبلی) */
export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next: AppSettings = { ...current, ...partial };
  const value = JSON.stringify(next);
  db.insert(settings)
    .values({ key: "app", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
  return next;
}

/** نسخهٔ عمومی تنظیمات با کلید API ماسک‌شده */
export function getPublicSettings(): PublicSettings {
  const s = getSettings();
  const { apiKey, ...rest } = s;
  return { ...rest, apiKeyMasked: maskApiKey(apiKey) };
}

/* ------------------------------------------------------------------ */
/* گفتگوها و پیام‌ها                                                   */
/* ------------------------------------------------------------------ */

/** لیست گفتگوها به همراه پیش‌نمایش آخرین پیام */
export function listConversations(): ConversationDTO[] {
  const rows = db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .all();
  return rows.map((c) => {
    const last = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, c.id))
      .orderBy(desc(messages.id))
      .limit(1)
      .get();
    return {
      id: c.id,
      title: c.title,
      createdAt: iso(c.createdAt)!,
      updatedAt: iso(c.updatedAt)!,
      preview: last ? last.content.slice(0, 80) : undefined
    };
  });
}

/** ساخت گفتگوی جدید */
export function createConversation(title = "گفتگوی جدید"): ConversationDTO {
  const now = new Date();
  const row = db
    .insert(conversations)
    .values({ title, createdAt: now, updatedAt: now })
    .returning()
    .get();
  return {
    id: row.id,
    title: row.title,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!
  };
}

/** دریافت یک گفتگو */
export function getConversation(id: number): ConversationDTO | null {
  const c = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    createdAt: iso(c.createdAt)!,
    updatedAt: iso(c.updatedAt)!
  };
}

/** تغییر عنوان گفتگو */
export function renameConversation(id: number, title: string): boolean {
  const result = db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
  return result.changes > 0;
}

/** حذف گفتگو (پیام‌ها با CASCADE حذف می‌شوند) */
export function deleteConversation(id: number): boolean {
  const result = db.delete(conversations).where(eq(conversations.id, id)).run();
  return result.changes > 0;
}

/** لیست پیام‌های یک گفتگو */
export function listMessages(conversationId: number): MessageDTO[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.id)
    .all()
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as Role,
      content: m.content,
      meta: parseMeta(m.meta),
      createdAt: iso(m.createdAt)!
    }));
}

/** افزودن پیام و به‌روزرسانی زمان گفتگو */
export function appendMessage(
  conversationId: number,
  role: Role,
  content: string,
  meta?: MessageMeta
): MessageDTO {
  const now = new Date();
  const row = db
    .insert(messages)
    .values({
      conversationId,
      role,
      content,
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: now
    })
    .returning()
    .get();
  db.update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, conversationId))
    .run();
  return {
    id: row.id,
    conversationId,
    role,
    content,
    meta: meta ?? null,
    createdAt: iso(now)!
  };
}

/** به‌روزرسانی عنوان گفتگو با اولین پیام کاربر */
export function autoTitleConversation(id: number, firstMessage: string): void {
  const c = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (c && c.title === "گفتگوی جدید") {
    const clean = firstMessage.replace(/\s+/g, " ").trim();
    renameConversation(id, clean.length <= 32 ? clean : clean.slice(0, 32) + "…");
  }
}

/* ------------------------------------------------------------------ */
/* حافظه                                                               */
/* ------------------------------------------------------------------ */

/** لیست حافظه‌ها (اختیاری: فیلتر دسته‌بندی) */
export function listMemories(category?: MemoryCategory | "all"): MemoryDTO[] {
  const rows =
    category && category !== "all"
      ? db
          .select()
          .from(memories)
          .where(eq(memories.category, category))
          .orderBy(desc(memories.updatedAt))
          .all()
      : db.select().from(memories).orderBy(desc(memories.updatedAt)).all();
  return rows.map(memoryToDTO);
}

/** تازه‌ترین حافظه‌ها برای تزریق به System Prompt (حداکثر ۴۰) */
export function recentMemories(limit = 40): MemoryDTO[] {
  return db
    .select()
    .from(memories)
    .orderBy(desc(memories.updatedAt))
    .limit(limit)
    .all()
    .map(memoryToDTO);
}

function memoryToDTO(m: typeof memories.$inferSelect): MemoryDTO {
  return {
    id: m.id,
    category: m.category as MemoryCategory,
    title: m.title,
    content: m.content,
    source: m.source as MemorySource,
    createdAt: iso(m.createdAt)!,
    updatedAt: iso(m.updatedAt)!
  };
}

/** افزودن حافظهٔ جدید */
export function createMemory(input: {
  category: MemoryCategory;
  title: string;
  content: string;
  source: MemorySource;
}): MemoryDTO {
  const now = new Date();
  const content = input.content.slice(0, 500);
  const row = db
    .insert(memories)
    .values({
      category: input.category,
      title: input.title.slice(0, 120),
      content,
      source: input.source,
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get();
  return memoryToDTO(row);
}

/** ویرایش حافظه */
export function updateMemory(
  id: number,
  patch: Partial<Pick<MemoryDTO, "category" | "title" | "content" | "source">>
): MemoryDTO | null {
  const existing = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!existing) return null;
  const row = db
    .update(memories)
    .set({
      ...(patch.category ? { category: patch.category } : {}),
      ...(patch.title ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.content ? { content: patch.content.slice(0, 500) } : {}),
      ...(patch.source ? { source: patch.source } : {}),
      updatedAt: new Date()
    })
    .where(eq(memories.id, id))
    .returning()
    .get();
  return memoryToDTO(row);
}

/** حذف حافظه */
export function deleteMemory(id: number): boolean {
  const result = db.delete(memories).where(eq(memories.id, id)).run();
  return result.changes > 0;
}

/** جست‌وجوی حافظه‌ها با کلیدواژه (برای دستور فراموشی) */
export function findMemories(keyword: string): MemoryDTO[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return db
    .select()
    .from(memories)
    .all()
    .filter(
      (m) =>
        m.title.toLowerCase().includes(kw) ||
        m.content.toLowerCase().includes(kw)
    )
    .map(memoryToDTO);
}

/* ------------------------------------------------------------------ */
/* سرورهای ماینکرفت                                                    */
/* ------------------------------------------------------------------ */

/** لیست سرورهای ذخیره‌شده */
export function listServers(): ServerDTO[] {
  return db
    .select()
    .from(servers)
    .orderBy(desc(servers.createdAt))
    .all()
    .map(serverToDTO);
}

function serverToDTO(s: typeof servers.$inferSelect): ServerDTO {
  return {
    id: s.id,
    name: s.name,
    host: s.host,
    port: s.port,
    version: s.version,
    auth: s.auth as "offline" | "microsoft",
    username: s.username,
    lastStatus: s.lastStatus as ServerDTO["lastStatus"],
    lastConnectedAt: iso(s.lastConnectedAt),
    createdAt: iso(s.createdAt)!
  };
}

/** افزودن سرور */
export function createServer(input: {
  name: string;
  host: string;
  port?: number;
  version?: string;
  auth?: "offline" | "microsoft";
  username?: string | null;
}): ServerDTO {
  const row = db
    .insert(servers)
    .values({
      name: input.name,
      host: input.host,
      port: input.port ?? 25565,
      version: input.version ?? "auto",
      auth: input.auth ?? "offline",
      username: input.username ?? null,
      createdAt: new Date()
    })
    .returning()
    .get();
  return serverToDTO(row);
}

/** به‌روزرسانی وضعیت اتصال سرور */
export function updateServerStatus(
  id: number,
  status: "connected" | "never" | "error"
): void {
  db.update(servers)
    .set({
      lastStatus: status,
      lastConnectedAt: status === "connected" ? new Date() : undefined
    })
    .where(eq(servers.id, id))
    .run();
}

/** حذف سرور */
export function deleteServer(id: number): boolean {
  const result = db.delete(servers).where(eq(servers.id, id)).run();
  return result.changes > 0;
}

/** پیدا کردن سرور بر اساس آدرس */
export function findServerByHost(host: string, port: number): ServerDTO | null {
  const row = db
    .select()
    .from(servers)
    .where(and(eq(servers.host, host), eq(servers.port, port)))
    .get();
  return row ? serverToDTO(row) : null;
}

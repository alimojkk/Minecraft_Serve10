/**
 * اسکیمای پایگاه‌داده محلی «دستیار» (SQLite + Drizzle ORM)
 * پنج جدول اصلی: گفتگوها، پیام‌ها، حافظه‌ها، سرورها و تنظیمات
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** جدول گفتگوها */
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("گفتگوی جدید"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
});

/** جدول پیام‌ها */
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  /** JSON شامل حالت offline/llm/memory/minecraft و لاگ خطاها */
  meta: text("meta"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
});

/** جدول حافظهٔ دائمی */
export const memories = sqliteTable("memories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", {
    enum: ["profile", "preference", "goal", "minecraft", "note", "other"]
  })
    .notNull()
    .default("other"),
  title: text("title").notNull(),
  /** حداکثر ۵۰۰ کاراکتر — در لایهٔ برنامه کنترل می‌شود */
  content: text("content").notNull(),
  source: text("source", { enum: ["manual", "auto", "explicit"] })
    .notNull()
    .default("manual"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
});

/** جدول سرورهای ماینکرفت ذخیره‌شده */
export const servers = sqliteTable("servers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(25565),
  version: text("version").notNull().default("auto"),
  auth: text("auth", { enum: ["offline", "microsoft"] })
    .notNull()
    .default("offline"),
  /** نام ربات در بازی */
  username: text("username"),
  lastStatus: text("last_status", { enum: ["connected", "never", "error"] })
    .notNull()
    .default("never"),
  lastConnectedAt: integer("last_connected_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
});

/** جدول تنظیمات — کلید 'app' مقدار JSON کامل تنظیمات را نگه می‌دارد */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});

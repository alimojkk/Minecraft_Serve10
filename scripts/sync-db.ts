/**
 * همگام‌سازی دیتابیس — ساخت جدول‌ها و تنظیمات پیش‌فرض
 * اجرا: npm run db:sync
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DASTIAR_DB_PATH ?? path.join(process.cwd(), "data", "app_db.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const raw = new Database(DB_PATH);
raw.pragma("foreign_keys = ON");
raw.pragma("journal_mode = WAL");

raw.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'گفتگوی جدید',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    meta TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 25565,
    version TEXT NOT NULL DEFAULT 'auto',
    auth TEXT NOT NULL DEFAULT 'offline',
    username TEXT,
    last_status TEXT NOT NULL DEFAULT 'never',
    last_connected_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// درج تنظیمات پیش‌فرض اگر وجود نداشته باشد
const now = Date.now();
const existing = raw
  .prepare("SELECT value FROM settings WHERE key = 'app'")
  .get();
if (!existing) {
  raw
    .prepare("INSERT INTO settings (key, value) VALUES ('app', ?)")
    .run(JSON.stringify({ autoMemory: true }));
}

raw.close();
console.log(`✅ دیتابیس آماده است: ${DB_PATH}`);

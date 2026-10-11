/**
 * اتصال پایگاه‌داده محلی SQLite
 * اتصال به صورت Singleton روی globalThis نگه داشته می‌شود تا در HMR مشکلی پیش نیاید
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

/** مسیر فایل دیتابیس — قابل تغییر با متغیر محیطی DASTIAR_DB_PATH */
const DB_PATH =
  process.env.DASTIAR_DB_PATH ?? path.join(process.cwd(), "data", "app_db.sqlite");

/** اجرای دستورهای ساخت جدول‌ها (همیشه ایمن با IF NOT EXISTS) */
function ensureSchema(raw: Database.Database): void {
  raw.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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
}

// نگه‌داشتن اتصال روی globalThis تا بین ری‌کامپایل‌های Next از بین نرود
const globalForDb = globalThis as unknown as {
  __dastiarRaw?: Database.Database;
  __dastiarDb?: AppDatabase;
};

function createConnection(): { raw: Database.Database; db: AppDatabase } {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const raw = new Database(DB_PATH);
  raw.pragma("foreign_keys = ON");
  ensureSchema(raw);
  const db = drizzle(raw, { schema });
  return { raw, db };
}

if (!globalForDb.__dastiarDb) {
  const { raw, db } = createConnection();
  globalForDb.__dastiarRaw = raw;
  globalForDb.__dastiarDb = db;
}

export const rawDb = globalForDb.__dastiarRaw!;
export const db = globalForDb.__dastiarDb!;
export { DB_PATH };

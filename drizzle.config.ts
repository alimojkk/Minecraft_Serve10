import { defineConfig } from "drizzle-kit";

/** پیکربندی Drizzle Kit — دیتابیس محلی SQLite */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DASTIAR_DB_PATH ?? "./data/app_db.sqlite"
  }
});

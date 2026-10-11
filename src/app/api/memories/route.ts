/**
 * API حافظه — لیست، فیلتر و افزودن دستی
 */
import { NextRequest, NextResponse } from "next/server";
import { containsSensitiveData } from "@/lib/memory";
import { createMemory, listMemories } from "@/lib/store";
import type { MemoryCategory, MemorySource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES: MemoryCategory[] = [
  "profile",
  "preference",
  "goal",
  "minecraft",
  "note",
  "other"
];

/** GET /api/memories?category=all — لیست حافظه‌ها */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") as MemoryCategory | "all" | null;
  return NextResponse.json({ memories: listMemories(category ?? "all") });
}

/** POST /api/memories — افزودن حافظهٔ دستی */
export async function POST(req: NextRequest) {
  let body: {
    category?: string;
    title?: string;
    content?: string;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!title || !content) {
    return NextResponse.json(
      { error: "عنوان و متن حافظه الزامی است." },
      { status: 400 }
    );
  }
  if (content.length > 500) {
    return NextResponse.json(
      { error: "متن حافظه حداکثر ۵۰۰ کاراکتر است." },
      { status: 400 }
    );
  }
  if (containsSensitiveData(title + " " + content)) {
    return NextResponse.json(
      { error: "⛔ اطلاعات حساس (رمز/توکن/کلید) در حافظه ذخیره نمی‌شود." },
      { status: 400 }
    );
  }

  const category = VALID_CATEGORIES.includes(body.category as MemoryCategory)
    ? (body.category as MemoryCategory)
    : "other";
  const source: MemorySource =
    body.source === "explicit" || body.source === "auto" ? body.source : "manual";

  const memory = createMemory({ category, title, content, source });
  return NextResponse.json({ memory }, { status: 201 });
}

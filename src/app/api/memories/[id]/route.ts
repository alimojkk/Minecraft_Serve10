/**
 * API حافظهٔ تکی — ویرایش و حذف
 */
import { NextRequest, NextResponse } from "next/server";
import { containsSensitiveData } from "@/lib/memory";
import { deleteMemory, updateMemory } from "@/lib/store";
import type { MemoryCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/memories/:id — ویرایش درون‌خطی */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: {
    category?: string;
    title?: string;
    content?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  if (body.content && containsSensitiveData(body.title + " " + body.content)) {
    return NextResponse.json(
      { error: "⛔ اطلاعات حساس در حافظه ذخیره نمی‌شود." },
      { status: 400 }
    );
  }
  if (body.content && body.content.length > 500) {
    return NextResponse.json(
      { error: "متن حافظه حداکثر ۵۰۰ کاراکتر است." },
      { status: 400 }
    );
  }

  const memory = updateMemory(Number(id), {
    ...(body.category ? { category: body.category as MemoryCategory } : {}),
    ...(body.title ? { title: body.title } : {}),
    ...(body.content ? { content: body.content } : {})
  });
  if (!memory) {
    return NextResponse.json({ error: "حافظه پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ memory });
}

/** DELETE /api/memories/:id — حذف حافظه */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = deleteMemory(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "حافظه پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * API گفتگوی تکی — دریافت، تغییر عنوان و حذف
 */
import { NextRequest, NextResponse } from "next/server";
import {
  deleteConversation,
  getConversation,
  listMessages,
  renameConversation
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/conversations/:id — گفتگو به همراه پیام‌ها */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const conversation = getConversation(Number(id));
  if (!conversation) {
    return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({
    conversation,
    messages: listMessages(conversation.id)
  });
}

/** PATCH /api/conversations/:id — تغییر عنوان */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "عنوان خالی است." }, { status: 400 });
  }
  const ok = renameConversation(Number(id), title.slice(0, 80));
  if (!ok) {
    return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/conversations/:id — حذف گفتگو */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = deleteConversation(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

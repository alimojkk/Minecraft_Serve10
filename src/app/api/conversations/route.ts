/**
 * API گفتگوها — لیست و ساخت گفتگو
 */
import { NextRequest, NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/conversations — لیست همهٔ گفتگوها */
export async function GET() {
  return NextResponse.json({ conversations: listConversations() });
}

/** POST /api/conversations — ساخت گفتگوی جدید */
export async function POST(req: NextRequest) {
  let title: string | undefined;
  try {
    const body = await req.json();
    title = typeof body.title === "string" ? body.title : undefined;
  } catch {
    /* بدنهٔ خالی اشکالی ندارد */
  }
  const conversation = createConversation(title);
  return NextResponse.json({ conversation }, { status: 201 });
}

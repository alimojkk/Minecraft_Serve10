/**
 * API سرور تکی — حذف
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteServer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/minecraft/servers/:id */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = deleteServer(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "سرور پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

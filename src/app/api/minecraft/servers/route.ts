/**
 * API سرورهای ماینکرفت — لیست و افزودن
 */
import { NextRequest, NextResponse } from "next/server";
import { createServer, listServers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/minecraft/servers */
export async function GET() {
  return NextResponse.json({ servers: listServers() });
}

/** POST /api/minecraft/servers — ذخیرهٔ سرور جدید */
export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    host?: string;
    port?: number;
    version?: string;
    auth?: string;
    username?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const host = (body.host ?? "").trim();
  const name = (body.name ?? "").trim() || host;
  if (!host) {
    return NextResponse.json({ error: "آدرس سرور الزامی است." }, { status: 400 });
  }

  const server = createServer({
    name,
    host,
    port: Number(body.port) || 25565,
    version: (body.version ?? "auto").trim() || "auto",
    auth: body.auth === "microsoft" ? "microsoft" : "offline",
    username: body.username?.trim() || null
  });
  return NextResponse.json({ server }, { status: 201 });
}

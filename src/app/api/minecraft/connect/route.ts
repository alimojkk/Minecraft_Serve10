/**
 * API اتصال ماینکرفت — اتصال به سرور (offline / microsoft)
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import {
  createServer,
  findServerByHost,
  getSettings,
  saveSettings,
  updateServerStatus
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/minecraft/connect */
export async function POST(req: NextRequest) {
  let body: {
    host?: string;
    port?: number;
    version?: string;
    auth?: string;
    username?: string;
    protectTarget?: string | null;
    save?: boolean;
    name?: string;
    serverId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const host = (body.host ?? "").trim();
  const username = (body.username ?? "").trim();
  if (!host || !username) {
    return NextResponse.json(
      { error: "آدرس سرور و نام ربات الزامی است." },
      { status: 400 }
    );
  }

  const port = Number(body.port) || 25565;
  const version = (body.version ?? "auto").trim() || "auto";
  const auth = body.auth === "microsoft" ? "microsoft" : "offline";

  // ذخیرهٔ آخرین اتصال در تنظیمات
  saveSettings({
    mcLastHost: host,
    mcLastPort: port,
    mcLastUsername: username,
    mcProtectTarget: body.protectTarget ?? null
  });

  // ذخیرهٔ سرور در لیست سرورها (درخواست صریح یا اگر قبلاً ثبت شده)
  const existing = findServerByHost(host, port);
  let serverId = body.serverId ?? existing?.id ?? null;
  if (body.save && !existing) {
    const created = createServer({
      name: body.name?.trim() || host,
      host,
      port,
      version,
      auth,
      username
    });
    serverId = created.id;
  }

  const result = await botManager.connect({
    host,
    port,
    version,
    auth,
    username,
    protectTarget: body.protectTarget ?? getSettings().mcProtectTarget,
    serverId
  });

  if (serverId != null) {
    updateServerStatus(serverId, result.ok ? "connected" : "error");
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

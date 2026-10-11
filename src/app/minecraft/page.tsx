"use client";

/**
 * صفحهٔ کنترل ماینکرفت — وضعیت زنده، اتصال، دستورهای سریع، لاگ کنسول
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Crosshair,
  Gamepad2,
  Heart,
  LogOut,
  RefreshCw,
  Rocket,
  Send,
  Server,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Zap
} from "lucide-react";
import { Btn, Card, Field, Label, PageTitle } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import type { BotLogEntry, BotStatus } from "@/minecraft/types";
import type { ServerDTO } from "@/lib/types";

const LOG_CLASS: Record<BotLogEntry["type"], string> = {
  info: "mc-log-info",
  success: "mc-log-success",
  warn: "mc-log-warn",
  error: "mc-log-error",
  event: "mc-log-event",
  chat: "mc-log-chat",
  system: "mc-log-system"
};

const LOG_PREFIX: Record<BotLogEntry["type"], string> = {
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌",
  event: "🎮",
  chat: "💬",
  system: "🔧"
};

const QUICK_COMMANDS: Array<{ label: string; text: string; icon: React.ReactNode }> = [
  { label: "بیا دنبالم", text: "بیا دنبالم", icon: <Zap size={15} /> },
  { label: "وایسا", text: "وایسا", icon: <Crosshair size={15} /> },
  { label: "بپر", text: "بپر", icon: <Sparkles size={15} /> },
  { label: "به من نگاه کن", text: "به من نگاه کن", icon: <Crosshair size={15} /> },
  { label: "گزارش وضعیت", text: "گزارش وضعیت", icon: <Activity size={15} /> },
  { label: "چوب جمع کن", text: "چوب جمع کن", icon: <Sparkles size={15} /> },
  { label: "سنگ جمع کن", text: "سنگ جمع کن", icon: <Sparkles size={15} /> },
  { label: "بیا پیش من", text: "بیا پیش من", icon: <Zap size={15} /> }
];

const EMPTY_STATUS: BotStatus = {
  connected: false,
  connecting: false,
  host: null,
  port: null,
  username: null,
  health: null,
  food: null,
  position: null,
  dimension: null,
  players: [],
  guardianMode: false,
  rocketMode: false,
  autoAttack: false,
  protectTarget: null,
  lastError: null,
  msDeviceCode: null
};

export default function MinecraftPage() {
  const [status, setStatus] = useState<BotStatus>(EMPTY_STATUS);
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const lastLogId = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // فرم اتصال
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(25565);
  const [version, setVersion] = useState("auto");
  const [auth, setAuth] = useState<"offline" | "microsoft">("offline");
  const [username, setUsername] = useState("DastiarBot");
  const [protectTarget, setProtectTarget] = useState("");
  const [saveServer, setSaveServer] = useState(true);
  const [serverName, setServerName] = useState("");

  // دستور دلخواه
  const [customCmd, setCustomCmd] = useState("");

  /* ---------------- پولینگ وضعیت ---------------- */

  const poll = useCallback(async () => {
    try {
      const data = await apiGet<{ status: BotStatus; logs: BotLogEntry[] }>(
        `/api/minecraft/status?sinceLogId=${lastLogId.current}`
      );
      setStatus(data.status);
      if (data.logs.length > 0) {
        setLogs((prev) => {
          const next = [...prev, ...data.logs];
          return next.length > 300 ? next.slice(next.length - 300) : next;
        });
        lastLogId.current = data.logs[data.logs.length - 1].id;
      }
    } catch {
      /* بی‌صدا */
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 2000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    apiGet<{ servers: ServerDTO[] }>("/api/minecraft/servers")
      .then((d) => setServers(d.servers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  /* ---------------- اتصال ---------------- */

  const connect = async () => {
    if (!host.trim() || !username.trim()) {
      setError("آدرس سرور و نام ربات الزامیه.");
      return;
    }
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const result = await apiSend<{ ok: boolean; reply: string }>(
        "/api/minecraft/connect",
        "POST",
        {
          host: host.trim(),
          port,
          version,
          auth,
          username: username.trim(),
          protectTarget: protectTarget.trim() || null,
          save: saveServer,
          name: serverName.trim() || host.trim()
        }
      );
      setReply(result.reply);
      void poll();
      const s = await apiGet<{ servers: ServerDTO[] }>("/api/minecraft/servers");
      setServers(s.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "اتصال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await apiSend("/api/minecraft/disconnect", "POST");
      void poll();
    } finally {
      setBusy(false);
    }
  };

  const deleteServer = async (s: ServerDTO) => {
    if (!window.confirm(`سرور «${s.name}» حذف بشه؟`)) return;
    await apiSend(`/api/minecraft/servers/${s.id}`, "DELETE");
    setServers((prev) => prev.filter((x) => x.id !== s.id));
  };

  /* ---------------- دستورها ---------------- */

  const runCommand = async (text: string) => {
    setError(null);
    setReply(null);
    try {
      const result = await apiSend<{ ok: boolean; reply: string }>(
        "/api/minecraft/command",
        "POST",
        { text }
      );
      setReply(result.reply);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "اجرای دستور ناموفق بود.";
      setError(msg);
    }
    void poll();
  };

  const emergencyStop = async () => {
    await runCommand("توقف فوری");
  };

  /* ---------------- رندر ---------------- */

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageTitle
        title="کنترل ماینکرفت"
        subtitle="ربات با دستورهای فارسی کنترل می‌شه — محافظت پلیسی، حرکت موشکی و حملهٔ خودکار."
      />

      {/* کارت وضعیت نئونی */}
      <div
        className={`glass-strong mb-6 p-6 transition ${
          status.connected
            ? "border-emerald-400/40 shadow-[0_0_30px_rgba(52,211,153,0.25)]"
            : status.connecting
              ? "border-amber-400/40"
              : "border-white/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              status.connected
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-700/40 text-slate-400"
            }`}
          >
            <Gamepad2 size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">
              {status.connected
                ? `متصل — ${status.username ?? "ربات"}`
                : status.connecting
                  ? "در حال اتصال..."
                  : "قطع"}
            </h2>
            <p className="text-xs text-slate-400">
              {status.host
                ? `${status.host}:${status.port}`
                : "به هیچ سروری وصل نیستم"}
            </p>
          </div>

          {/* آمار زنده */}
          {status.connected ? (
            <div className="flex flex-wrap gap-3">
              <div className="glass flex items-center gap-2 px-4 py-2.5">
                <Heart size={16} className="text-red-400" />
                <span className="text-sm text-white">
                  {status.health}/20 <span className="text-xs text-slate-400">جان</span>
                </span>
              </div>
              <div className="glass flex items-center gap-2 px-4 py-2.5">
                <Activity size={16} className="text-amber-300" />
                <span className="text-sm text-white">
                  {status.food}/20 <span className="text-xs text-slate-400">سیری</span>
                </span>
              </div>
              <div className="glass px-4 py-2.5">
                <p className="text-[10px] text-slate-400">مختصات</p>
                <p className="text-sm text-white" dir="ltr">
                  {status.position
                    ? `${status.position.x}, ${status.position.y}, ${status.position.z}`
                    : "—"}
                </p>
              </div>
              <div className="glass px-4 py-2.5">
                <p className="text-[10px] text-slate-400">بعد</p>
                <p className="text-sm text-white">{status.dimension ?? "—"}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* وضعیت حالت‌ها */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.guardianMode
                ? "bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            🛡️ محافظت {status.guardianMode ? "روشن" : "خاموش"}
          </span>
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.rocketMode
                ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            🚀 موشک {status.rocketMode ? "روشن" : "خاموش"}
          </span>
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.autoAttack
                ? "bg-red-500/25 text-red-200 ring-1 ring-red-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            ⚔️ اتوکلیک {status.autoAttack ? "روشن" : "خاموش"}
          </span>
          {status.players.length > 0 ? (
            <span className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs text-slate-300">
              آنلاین: {status.players.join("، ")}
            </span>
          ) : null}
        </div>

        {status.msDeviceCode ? (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            🔐 برای ورود مایکروسافت به{" "}
            <a
              href="https://microsoft.com/link"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              microsoft.com/link
            </a>{" "}
            برو و کد <b dir="ltr">{status.msDeviceCode}</b> را وارد کن.
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* فرم اتصال */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
            <Server size={18} className="text-neon-cyan" /> اتصال به سرور
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>آدرس سرور</Label>
              <Field
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost یا play.example.com"
              />
            </div>
            <div>
              <Label>پورت</Label>
              <Field
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 25565)}
              />
            </div>
            <div>
              <Label>نسخه</Label>
              <Field
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="auto یا 1.21.1"
              />
            </div>
            <div>
              <Label>نام ربات در بازی</Label>
              <Field
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="DastiarBot"
              />
            </div>
            <div>
              <Label>نوع ورود</Label>
              <select
                value={auth}
                onChange={(e) => setAuth(e.target.value as "offline" | "microsoft")}
                className="field"
              >
                <option value="offline">آفلاین (کرک / LAN)</option>
                <option value="microsoft">مایکروسافت (رسمی)</option>
              </select>
            </div>
            <div>
              <Label>بازیکن هدف محافظت (اختیاری)</Label>
              <Field
                value={protectTarget}
                onChange={(e) => setProtectTarget(e.target.value)}
                placeholder="نام تو در بازی"
              />
            </div>
            <div>
              <Label>نام سرور برای ذخیره</Label>
              <Field
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="سرور من"
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={saveServer}
              onChange={(e) => setSaveServer(e.target.checked)}
              className="h-4 w-4 rounded accent-cyan-400"
            />
            ذخیرهٔ این سرور در لیست
          </label>

          <div className="mt-4 flex gap-2">
            <Btn onClick={() => void connect()} disabled={busy} className="flex-1">
              {status.connecting ? "در حال اتصال..." : "اتصال"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => void disconnect()}
              disabled={busy || (!status.connected && !status.connecting)}
            >
              <span className="flex items-center gap-2">
                <LogOut size={16} /> قطع
              </span>
            </Btn>
          </div>

          {/* سرورهای ذخیره‌شده */}
          {servers.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium text-slate-400">
                سرورهای ذخیره‌شده
              </h3>
              <div className="space-y-2">
                {servers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-500" dir="ltr">
                        {s.host}:{s.port} — {s.username ?? "بدون نام"} ({s.auth})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setHost(s.host);
                        setPort(s.port);
                        setVersion(s.version);
                        setAuth(s.auth);
                        setUsername(s.username ?? "DastiarBot");
                        setServerName(s.name);
                      }}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                    >
                      پر کردن فرم
                    </button>
                    <button
                      onClick={() => void deleteServer(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* دستورهای سریع */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
            <Zap size={18} className="text-neon-amber" /> دستورهای سریع
          </h2>

          {/* دکمه‌های حالت ویژه */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Btn
              variant={status.guardianMode ? "success" : "ghost"}
              onClick={() => void runCommand(status.guardianMode ? "محافظت رو خاموش کن" : "محافظت کن")}
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Shield size={15} /> محافظت
              </span>
            </Btn>
            <Btn
              variant={status.rocketMode ? "success" : "ghost"}
              onClick={() => void runCommand(status.rocketMode ? "موشک خاموش" : "موشک روشن")}
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Rocket size={15} /> موشک
              </span>
            </Btn>
            <Btn
              variant={status.autoAttack ? "danger" : "ghost"}
              onClick={() =>
                void runCommand(status.autoAttack ? "اتوکلیک خاموش" : "اتوکلیک روشن")
              }
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Swords size={15} /> اتوکلیک
              </span>
            </Btn>
          </div>

          {/* دستورهای رایج */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_COMMANDS.map((c) => (
              <button
                key={c.text}
                onClick={() => void runCommand(c.text)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-xs text-slate-200 transition hover:border-neon-cyan/40 hover:bg-white/10"
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>

          {/* دستور دلخواه */}
          <div className="mt-4 flex gap-2">
            <Field
              value={customCmd}
              onChange={(e) => setCustomCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customCmd.trim()) {
                  void runCommand(customCmd.trim());
                  setCustomCmd("");
                }
              }}
              placeholder="دستور فارسی دلخواه... مثلاً: برو به مختصات ۱۰ ۶۴ -۵"
            />
            <Btn
              onClick={() => {
                if (customCmd.trim()) {
                  void runCommand(customCmd.trim());
                  setCustomCmd("");
                }
              }}
              disabled={!customCmd.trim()}
            >
              <Send size={16} className="-scale-x-100" />
            </Btn>
          </div>

          {/* دکمهٔ قرمز توقف فوری */}
          <button
            onClick={() => void emergencyStop()}
            className="btn-emergency mt-4 flex w-full items-center justify-center gap-2 text-lg"
          >
            <Crosshair size={20} /> توقف فوری
          </button>

          {/* پیام‌های نتیجه */}
          {reply ? (
            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-sm leading-6 text-emerald-100">
              {reply}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}
        </Card>
      </div>

      {/* لاگ کنسول */}
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Activity size={18} className="text-neon-green" /> لاگ رویدادها
          </h2>
          <button
            onClick={() => {
              setLogs([]);
              lastLogId.current = 0;
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10"
          >
            <RefreshCw size={13} /> پاک‌کردن نمایش
          </button>
        </div>
        <div className="h-72 overflow-y-auto rounded-xl bg-black/40 p-4 font-mono text-xs leading-6">
          {logs.length === 0 ? (
            <p className="text-slate-600">
              هنوز رویدادی ثبت نشده. وصل که بشی همه‌چیز اینجا میاد...
            </p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className={`flex gap-2 ${LOG_CLASS[l.type]}`}>
                <span className="opacity-70">
                  {new Date(l.at).toLocaleTimeString("fa-IR")}
                </span>
                <span>{LOG_PREFIX[l.type]}</span>
                <span className="flex-1 whitespace-pre-wrap">{l.text}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </Card>
    </div>
  );
}

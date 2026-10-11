/**
 * BotManager — ماژول اختصاصی کنترل ربات ماینکرفت (Singleton روی globalThis)
 *
 * معماری امن Whitelist: مدل زبانی هرگز کد دلخواه اجرا نمی‌کند؛
 * فقط دستورهای ازپیش‌تعریف‌شده از طریق پارسر فارسی اجرا می‌شوند.
 *
 * قابلیت‌های کلیدی:
 * - اتصال offline (سرورهای کرک / Open to LAN) و microsoft (Device-Code Flow)
 * - دستورهای زبان طبیعی فارسی
 * - حالت محافظت پلیسی (دنبال‌کردن + درگیری با ماب‌های خصم)
 * - حالت موشک (اسپرینت + پرش مداوم — ونیلا و بدون تقلب)
 * - اتوکلیک (حملهٔ خودکار مداوم به نزدیک‌ترین دشمن)
 */
import mineflayer, { type Bot } from "mineflayer";
import type { Entity } from "prismarine-entity";
import { Movements, goals, pathfinder } from "mineflayer-pathfinder";
import { plugin as collectBlockPlugin } from "mineflayer-collectblock";
import path from "node:path";
import {
  BLOCK_MAP,
  MC_HELP_TEXT,
  normalizeBlockName,
  parseCommand
} from "@/minecraft/parser";
import type {
  BotLogEntry,
  BotStatus,
  CommandResult,
  ConnectOptions,
  LogType
} from "@/minecraft/types";

/** فهرست ماب‌های خصم برای حالت محافظت و حملهٔ خودکار */
const HOSTILE_NAMES = new Set([
  "zombie",
  "skeleton",
  "creeper",
  "spider",
  "cave_spider",
  "enderman",
  "witch",
  "pillager",
  "vindicator",
  "evoker",
  "ravager",
  "vex",
  "phantom",
  "drowned",
  "husk",
  "stray",
  "zombie_villager",
  "zombified_piglin",
  "zombie_pigman",
  "slime",
  "magma_cube",
  "blaze",
  "ghast",
  "wither_skeleton",
  "guardian",
  "elder_guardian",
  "shulker",
  "silverfish",
  "endermite",
  "hoglin",
  "zoglin",
  "warden",
  "breeze",
  "bogged",
  "creaking"
]);

const MAX_LOGS = 250;
const GUARD_FOLLOW_DISTANCE = 2.5;

type GoalLike = InstanceType<(typeof goals)["Goal"]>;

class BotManager {
  private bot: Bot | null = null;
  private logs: BotLogEntry[] = [];
  private logSeq = 1;
  private connecting = false;
  private guardianMode = false;
  private rocketMode = false;
  private autoAttack = false;
  private protectTarget: string | null = null;
  private guardTimer: ReturnType<typeof setInterval> | null = null;
  private attackTimer: ReturnType<typeof setInterval> | null = null;
  private rocketTimer: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;
  private msDeviceCode: string | null = null;
  private connectInfo: { host: string; port: number; username: string | null } =
    { host: "", port: 25565, username: null };

  /* ---------------------------------------------------------------- */
  /* لاگ‌ها                                                            */
  /* ---------------------------------------------------------------- */

  /** ثبت یک رویداد در لاگ رنگی */
  private log(type: LogType, text: string): void {
    this.logs.push({ id: this.logSeq++, type, text, at: Date.now() });
    if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
  }

  /** دریافت لاگ‌ها (از شناسهٔ مشخص برای پولینگ) */
  getLogs(sinceId = 0): BotLogEntry[] {
    return this.logs.filter((l) => l.id > sinceId);
  }

  clearLogs(): void {
    this.logs = [];
  }

  /* ---------------------------------------------------------------- */
  /* وضعیت                                                             */
  /* ---------------------------------------------------------------- */

  getStatus(): BotStatus {
    const bot = this.bot;
    const entity = bot?.entity ?? null;
    return {
      connected: !!bot && !!entity,
      connecting: this.connecting,
      host: this.connectInfo.host || null,
      port: this.connectInfo.port || null,
      username: this.connectInfo.username,
      health: bot?.health ?? null,
      food: bot?.food ?? null,
      position: entity
        ? {
            x: Math.round(entity.position.x * 10) / 10,
            y: Math.round(entity.position.y * 10) / 10,
            z: Math.round(entity.position.z * 10) / 10
          }
        : null,
      dimension: (bot as unknown as { game?: { dimension?: string } })?.game
        ?.dimension
        ? String((bot as unknown as { game: { dimension: string } }).game.dimension)
        : null,
      players: bot ? Object.keys(bot.players).filter((p) => p !== bot.username) : [],
      guardianMode: this.guardianMode,
      rocketMode: this.rocketMode,
      autoAttack: this.autoAttack,
      protectTarget: this.protectTarget,
      lastError: this.lastError,
      msDeviceCode: this.msDeviceCode
    };
  }

  /* ---------------------------------------------------------------- */
  /* اتصال و قطع اتصال                                                */
  /* ---------------------------------------------------------------- */

  /** اتصال به سرور ماینکرفت */
  connect(opts: ConnectOptions): Promise<CommandResult> {
    return new Promise((resolve) => {
      if (this.bot) {
        this.log("warn", "اتصال قبلی قطع شد تا اتصال جدید برقرار بشه.");
        this.disconnect();
      }

      this.connecting = true;
      this.lastError = null;
      this.connectInfo = { host: opts.host, port: opts.port, username: opts.username };
      this.protectTarget = opts.protectTarget ?? null;

      const version = opts.version === "auto" ? undefined : opts.version;

      this.log(
        "system",
        `در حال اتصال به ${opts.host}:${opts.port} با نام ${opts.username}...`
      );

      let settled = false;
      const settle = (result: CommandResult) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      try {
        const bot = mineflayer.createBot({
          host: opts.host,
          port: opts.port,
          username: opts.username,
          auth: opts.auth === "microsoft" ? "microsoft" : "offline",
          version,
          profilesFolder: path.join(process.cwd(), "accounts"),
          // نمایش کد Device-Code ورود مایکروسافت در برنامه
          onMsaCode: (data: {
            user_code: string;
            verification_uri: string;
            device_code: string;
            expires_in: number;
            interval: number;
            message: string;
          }) => {
            this.msDeviceCode = data.user_code;
            this.log(
              "warn",
              `برای ورود مایکروسافت به ${data.verification_uri} برو و کد ${data.user_code} را وارد کن.`
            );
          }
        } as Parameters<typeof mineflayer.createBot>[0]);

        this.bot = bot;
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(collectBlockPlugin);

        /* ---- رویدادهای زنده ---- */
        bot.once("login", () => {
          this.connecting = false;
          this.log("success", `وارد بازی شدم! نام ربات: ${bot.username}`);
          // تنظیمات مسیریابی
          const movements = new Movements(bot);
          movements.canDig = false;
          movements.allow1by1towers = true;
          movements.canOpenDoors = true;
          bot.pathfinder.setMovements(movements);
          this.startLoops();
          settle({
            ok: true,
            reply: `اتصال برقرار شد. ✅ الان توی سرور ${opts.host}:${opts.port} هستم با نام ${bot.username}.`,
            command: "status"
          });
        });

        bot.on("kicked", (reason: unknown) => {
          const text =
            typeof reason === "string" ? reason : JSON.stringify(reason);
          this.lastError = text.slice(0, 300);
          this.log("error", `از سرور کیک شدم: ${text.slice(0, 200)}`);
          this.cleanupAfterDisconnect();
          settle({
            ok: false,
            reply: `اتصال برقرار نشد؛ سرور منو بیرون کرد. دلیل: ${text.slice(0, 150)}`,
            command: "status"
          });
        });

        bot.on("error", (err: Error) => {
          this.lastError = err.message;
          this.log("error", `خطای اتصال: ${err.message}`);
          this.cleanupAfterDisconnect();
          settle({
            ok: false,
            reply: `اتصال ناموفق بود: ${err.message}`,
            command: "status"
          });
        });

        bot.on("end", (reason: unknown) => {
          const text = typeof reason === "string" ? reason : "پایان اتصال";
          this.log("warn", `اتصال قطع شد: ${text}`);
          this.cleanupAfterDisconnect();
        });

        bot.on("death", () => {
          this.log("event", "💀 ربات مرد! دوباره ریسپاون می‌شم...");
        });

        bot.on("message", (msg: { toString(): string }) => {
          const text = msg.toString();
          if (text.trim()) this.log("chat", text);
        });

        bot.on("whisper", (username: string, message: string) => {
          this.log("chat", `📨 ویسپر از ${username}: ${message}`);
        });

        bot.on("playerCollect", (_collector: Entity, _dropped: Entity) => {
          // رویداد جمع‌آوری آیتم — فقط لاگ سبک
        });

        bot.on("health", () => {
          if ((bot.health ?? 20) <= 6) {
            this.log("warn", `⚠️ جان کمه: ${bot.health}/20 — مراقب باش!`);
          }
        });

        // تایم‌اوت اتصال
        setTimeout(() => {
          if (this.connecting && !settled) {
            this.connecting = false;
            this.log("error", "مهلت اتصال تمام شد (۳۰ ثانیه).");
            this.disconnect();
            settle({
              ok: false,
              reply: "مهلت اتصال تمام شد. آدرس سرور و اینترنت رو چک کن.",
              command: "status"
            });
          }
        }, 30_000);
      } catch (err) {
        this.connecting = false;
        const message = err instanceof Error ? err.message : "خطای ناشناخته";
        this.lastError = message;
        this.log("error", `خطای ساخت ربات: ${message}`);
        settle({ ok: false, reply: `اتصال ناموفق بود: ${message}`, command: "status" });
      }
    });
  }

  /** قطع اتصال امن */
  disconnect(): void {
    this.stopLoops();
    if (this.bot) {
      try {
        this.bot.quit();
      } catch {
        /* نادیده بگیر */
      }
      this.bot = null;
    }
    this.connecting = false;
    this.log("system", "اتصال به سرور قطع شد.");
  }

  private cleanupAfterDisconnect(): void {
    this.stopLoops();
    this.bot = null;
    this.connecting = false;
    this.guardianMode = false;
    this.rocketMode = false;
    this.autoAttack = false;
    this.msDeviceCode = null;
  }

  /* ---------------------------------------------------------------- */
  /* لوپ‌های حالت‌های ویژه                                             */
  /* ---------------------------------------------------------------- */

  private startLoops(): void {
    this.stopLoops();

    // لوپ محافظت پلیسی — هر ۸۰۰ میلی‌ثانیه
    this.guardTimer = setInterval(() => {
      if (!this.guardianMode) return;
      try {
        this.guardianTick();
      } catch (err) {
        this.log("error", `خطای حالت محافظت: ${(err as Error).message}`);
      }
    }, 800);

    // لوپ اتوکلیک/حملهٔ خودکار — هر ۳۰۰ میلی‌ثانیه
    this.attackTimer = setInterval(() => {
      if (!this.autoAttack && !this.guardianMode) return;
      try {
        this.attackTick();
      } catch (err) {
        this.log("error", `خطای حملهٔ خودکار: ${(err as Error).message}`);
      }
    }, 300);

    // لوپ حالت موشک — اسپرینت و پرش مداوم هنگام حرکت
    this.rocketTimer = setInterval(() => {
      if (!this.rocketMode || !this.bot) return;
      try {
        this.rocketTick();
      } catch {
        /* نادیده بگیر */
      }
    }, 500);
  }

  private stopLoops(): void {
    if (this.guardTimer) clearInterval(this.guardTimer);
    if (this.attackTimer) clearInterval(this.attackTimer);
    if (this.rocketTimer) clearInterval(this.rocketTimer);
    this.guardTimer = this.attackTimer = this.rocketTimer = null;
  }

  /** پیدا کردن نزدیک‌ترین ماب خصم */
  private nearestHostile(maxDistance: number): Entity | null {
    const bot = this.bot;
    if (!bot?.entity) return null;
    let best: Entity | null = null;
    let bestDist = maxDistance;
    for (const e of Object.values(bot.entities)) {
      if (!e || e === bot.entity || !e.position || !e.name) continue;
      const hostile =
        HOSTILE_NAMES.has(e.name.toLowerCase()) || e.kind === "Hostile mobs";
      if (!hostile) continue;
      const d = e.position.distanceTo(bot.entity.position);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  /** پیدا کردن موجودیت بازیکنِ هدف محافظت */
  private resolveProtectEntity(): Entity | null {
    const bot = this.bot;
    if (!bot?.entity) return null;

    // اول بازیکن هدف مشخص‌شده
    if (this.protectTarget) {
      const p = bot.players[this.protectTarget];
      if (p?.entity) return p.entity;
    }

    // نزدیک‌ترین بازیکن دیگر
    let best: Entity | null = null;
    let bestDist = 64;
    for (const [name, p] of Object.entries(bot.players)) {
      if (name === bot.username || !p.entity) continue;
      const d = p.entity.position.distanceTo(bot.entity.position);
      if (d < bestDist) {
        best = p.entity;
        bestDist = d;
      }
    }
    return best;
  }

  /** یک قدم از لوپ محافظت */
  private guardianTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;

    const target = this.resolveProtectEntity();
    const hostile = this.nearestHostile(16);

    if (hostile?.position) {
      // دشمن نزدیکه — درگیر شو
      const dist = hostile.position.distanceTo(bot.entity.position);
      if (dist > 2.5) {
        const { x, y, z } = hostile.position;
        bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 2));
      } else {
        bot.pathfinder.setGoal(null);
      }
      return;
    }

    // دشمنی نیست — کنار بازیکن هدف بایست
    if (target) {
      const dist = target.position.distanceTo(bot.entity.position);
      if (dist > 4.5) {
        bot.pathfinder.setGoal(
          new goals.GoalFollow(target, GUARD_FOLLOW_DISTANCE)
        );
      } else {
        bot.pathfinder.setGoal(null);
      }
      // به اطراف نگاه کن تا تهدیدها رو ببینی
      const yaw = Math.atan2(-Math.cos(Date.now() / 2500), 1);
      bot.look(yaw, 0, false).catch(() => undefined);
    }
  }

  /** یک قدم از لوپ حملهٔ خودکار (اتوکلیک) */
  private attackTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;

    const range = this.autoAttack ? 32 : 16;
    const hostile = this.nearestHostile(range);
    if (!hostile) return;

    const dist = hostile.position.distanceTo(bot.entity.position);
    if (dist < 3.6) {
      // کلیک چپ مداوم روی دشمن
      bot.attack(hostile);
      bot.swingArm("right");
    }
  }

  /** یک قدم از حالت موشک */
  private rocketTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;
    const v = bot.entity.velocity;
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    bot.setControlState("sprint", true);
    if (speed > 0.08) {
      bot.setControlState("jump", true);
    } else {
      bot.setControlState("jump", false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌های حرکت                                                    */
  /* ---------------------------------------------------------------- */

  private requireBot(): Bot | null {
    if (!this.bot?.entity) {
      return null;
    }
    return this.bot;
  }

  private setGoal(goal: GoalLike | null): void {
    const bot = this.bot;
    if (!bot) return;
    bot.pathfinder.setGoal(goal);
    if (this.rocketMode) {
      bot.setControlState("sprint", true);
    }
  }

  /* ---------------------------------------------------------------- */
  /* توقف فوری (دکمه قرمز)                                            */
  /* ---------------------------------------------------------------- */

  /** توقف کامل: اهداف مسیر، حرکت، کلنگ‌زنی، وضعیت کلیدها و حالت‌های فعال */
  emergencyStop(): CommandResult {
    const bot = this.bot;
    this.guardianMode = false;
    this.rocketMode = false;
    this.autoAttack = false;

    if (bot) {
      try {
        bot.pathfinder.setGoal(null);
      } catch {
        /* نادیده بگیر */
      }
      try {
        bot.collectBlock.cancelTask();
      } catch {
        /* نادیده بگیر */
      }
      try {
        bot.clearControlStates();
      } catch {
        /* نادیده بگیر */
      }
    }

    this.log("system", "🛑 توقف فوری اجرا شد؛ همه‌چیز متوقفه.");
    return {
      ok: true,
      reply:
        "🛑 چشم، همه‌چیز متوقف شد: مسیر، حرکت، کلنگ‌زنی، اتوکلیک و حالت محافظت. هر وقت گفتی دوباره بلند می‌شم.",
      command: "stop"
    };
  }

  /* ---------------------------------------------------------------- */
  /* اجرای دستورهای زبان طبیعی                                        */
  /* ---------------------------------------------------------------- */

  /** اجرای متن فارسی کاربر — اگر دستور ماینکرفتی نباشد، command: 'none' */
  async runCommand(rawText: string): Promise<CommandResult> {
    const cmd = parseCommand(rawText);
    if (!cmd) return { ok: false, reply: "", command: "none" };

    const bot = this.bot;

    // راهنما و وضعیت حتی بدون اتصال هم جواب می‌دن
    if (cmd.type === "help") {
      return { ok: true, reply: MC_HELP_TEXT, command: "help" };
    }

    if (cmd.type === "status") {
      const s = this.getStatus();
      if (!s.connected) {
        return {
          ok: true,
          reply: `الان به هیچ سروری وصل نیستم${s.lastError ? ` (آخرین خطا: ${s.lastError})` : ""}. از صفحهٔ ماینکرفت وصلم کن.`,
          command: "status"
        };
      }
      const players =
        s.players.length > 0 ? s.players.join("، ") : "کسی دیگه آنلاین نیست";
      return {
        ok: true,
        reply: `📊 گزارش وضعیت:
• مختصات: X=${s.position?.x} Y=${s.position?.y} Z=${s.position?.z}
• جان: ${s.health}/20 — سیری: ${s.food}/20
• بعد: ${s.dimension ?? "نامشخص"}
• بازیکنان آنلاین: ${players}
• محافظت: ${s.guardianMode ? "روشن" : "خاموش"} | موشک: ${s.rocketMode ? "روشن" : "خاموش"} | اتوکلیک: ${s.autoAttack ? "روشن" : "خاموش"}`,
        command: "status"
      };
    }

    // بقیهٔ دستورها نیاز به اتصال دارن
    if (!bot) {
      return {
        ok: false,
        reply: "فعلاً به سروری وصل نیستم. اول از صفحهٔ ماینکرفت به سرور وصلم کن، بعد دستور بده.",
        command: cmd.type
      };
    }

    switch (cmd.type) {
      case "follow": {
        const target = this.resolveProtectEntity();
        if (!target) {
          return {
            ok: false,
            reply: "بازیکنی این اطراف نیست که دنبالش بیام! 🤔",
            command: "follow"
          };
        }
        this.setGoal(new goals.GoalFollow(target, GUARD_FOLLOW_DISTANCE));
        this.log("info", "در حال دنبال‌کردن بازیکن...");
        return {
          ok: true,
          reply: "چشم، دارم دنبالت میام! 🏃",
          command: "follow"
        };
      }

      case "come": {
        const target = this.resolveProtectEntity();
        if (!target) {
          return {
            ok: false,
            reply: "پیدات نمی‌کنم! یه بازیکن باید اطرافم باشه.",
            command: "come"
          };
        }
        const { x, y, z } = target.position;
        this.setGoal(new goals.GoalNear(x, y, z, 2));
        this.log("info", "در حال رفتن به سمت بازیکن...");
        return { ok: true, reply: "دارم میام پیشت! ⚡", command: "come" };
      }

      case "stop": {
        return this.emergencyStop();
      }

      case "goto": {
        const { x, y, z } = cmd;
        this.setGoal(new goals.GoalNear(x, y, z, 2));
        this.log("info", `در حال رفتن به مختصات ${x} ${y} ${z}`);
        return {
          ok: true,
          reply: `دارم می‌رم به مختصات ${x} ${y} ${z}. 🧭`,
          command: "goto"
        };
      }

      case "collect": {
        const blockName = normalizeBlockName(cmd.block) ?? cmd.block;
        return this.collectBlocks(blockName);
      }

      case "jump": {
        bot.setControlState("jump", true);
        setTimeout(() => bot?.setControlState("jump", false), 450);
        return { ok: true, reply: "هپ! پریدم. 🐇", command: "jump" };
      }

      case "look": {
        const target = this.resolveProtectEntity();
        if (target) {
          await bot.lookAt(
            target.position.offset(0, (target.height ?? 1.8) - 0.2, 0)
          );
          return { ok: true, reply: "دارم نگات می‌کنم! 👀", command: "look" };
        }
        return {
          ok: false,
          reply: "کسی اینجا نیست که بهش نگاه کنم.",
          command: "look"
        };
      }

      case "say": {
        bot.chat(cmd.text);
        this.log("chat", `🤖 گفتم: ${cmd.text}`);
        return {
          ok: true,
          reply: `توی چت گفتم: «${cmd.text}»`,
          command: "say"
        };
      }

      case "guard": {
        this.guardianMode = cmd.on;
        if (cmd.on && !this.protectTarget) {
          const t = this.resolveProtectEntity();
          if (t) {
            // نام بازیکن رو از لیست بازیکنان پیدا کن
            for (const [name, p] of Object.entries(bot.players)) {
              if (p.entity === t) this.protectTarget = name;
            }
          }
        }
        this.log(
          "system",
          cmd.on ? "🛡️ حالت محافظت (پلیسی) روشن شد." : "حالت محافظت خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "🛡️ چشم! حالت محافظت روشن شد. عین پلیس کنارت می‌مونم و به هر ماب خصمی که نزدیک بشه حمله می‌کنم."
            : "محافظت رو خاموش کردم.",
          command: "guard"
        };
      }

      case "rocket": {
        this.rocketMode = cmd.on;
        if (bot) {
          bot.setControlState("sprint", cmd.on);
          if (!cmd.on) bot.setControlState("jump", false);
        }
        this.log(
          "system",
          cmd.on ? "🚀 حالت موشک روشن شد." : "حالت موشک خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "🚀 حالت موشک روشن! با سرعت کامل و پرش‌های پیاپی حرکت می‌کنم."
            : "حالت موشک خاموش شد؛ با سرعت عادی حرکت می‌کنم.",
          command: "rocket"
        };
      }

      case "autoAttack": {
        this.autoAttack = cmd.on;
        this.log(
          "system",
          cmd.on ? "⚔️ اتوکلیک (حملهٔ خودکار) روشن شد." : "اتوکلیک خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "⚔️ اتوکلیک روشن شد! عین موشک به نزدیک‌ترین دشمن کلیک چپ می‌زنم تا نیستش کنم."
            : "اتوکلیک خاموش شد.",
          command: "autoAttack"
        };
      }

      default:
        return { ok: false, reply: "", command: "none" };
    }
  }

  /** جمع‌آوری بلوک با افزونهٔ collectblock (شعاع ۴۸) */
  private collectBlocks(blockName: string): Promise<CommandResult> {
    const bot = this.bot;
    if (!bot) {
      return Promise.resolve({
        ok: false,
        reply: "اتصال برقرار نیست.",
        command: "collect"
      });
    }

    const blockId = bot.registry.blocksByName[blockName]?.id;
    if (blockId == null) {
      return Promise.resolve({
        ok: false,
        reply: `بلوک «${blockName}» رو نمی‌شناسم. اسمایی مثل چوب، سنگ، خاک، الماس، آهن رو امتحان کن.`,
        command: "collect"
      });
    }

    const positions = bot.findBlocks({
      matching: blockId,
      count: 12,
      maxDistance: 48
    });

    const blocks = positions
      .map((p) => bot.blockAt(p))
      .filter((b): b is NonNullable<typeof b> => b != null);

    if (blocks.length === 0) {
      return Promise.resolve({
        ok: false,
        reply: `تا شعاع ۴۸ بلوکی «${blockName}» پیدا نکردم. 🤷`,
        command: "collect"
      });
    }

    this.log("info", `در حال جمع‌آوری ${blocks.length} بلوک ${blockName}...`);

    return new Promise((resolve) => {
      bot.collectBlock.collect(
        blocks,
        (err: Error | null | undefined) => {
          if (err) {
            this.log("error", `خطای جمع‌آوری: ${err.message}`);
            resolve({
              ok: false,
              reply: `جمع‌آوری نصفه موند: ${err.message}`,
              command: "collect"
            });
          } else {
            this.log("success", `جمع‌آوری ${blocks.length} بلوک تموم شد.`);
            resolve({
              ok: true,
              reply: `تموم شد! ${blocks.length} تا ${blockName} جمع کردم. ⛏️`,
              command: "collect"
            });
          }
        }
      );
    });
  }
}

/* ------------------------------------------------------------------ */
/* Singleton روی globalThis تا در HMR از بین نرود                       */
/* ------------------------------------------------------------------ */

const globalForMc = globalThis as unknown as {
  __dastiarBotManager?: BotManager;
};

if (!globalForMc.__dastiarBotManager) {
  globalForMc.__dastiarBotManager = new BotManager();
}

export const botManager = globalForMc.__dastiarBotManager;
export { BLOCK_MAP };

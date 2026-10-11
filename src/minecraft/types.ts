/**
 * تایپ‌های ماژول ماینکرفت
 */

export type LogType =
  | "info"
  | "success"
  | "warn"
  | "error"
  | "event"
  | "chat"
  | "system";

export interface BotLogEntry {
  id: number;
  type: LogType;
  text: string;
  at: number;
}

export interface BotPosition {
  x: number;
  y: number;
  z: number;
}

export interface BotStatus {
  connected: boolean;
  connecting: boolean;
  host: string | null;
  port: number | null;
  username: string | null;
  health: number | null;
  food: number | null;
  position: BotPosition | null;
  dimension: string | null;
  players: string[];
  guardianMode: boolean;
  rocketMode: boolean;
  autoAttack: boolean;
  protectTarget: string | null;
  lastError: string | null;
  /** آخرین کد Device-Code برای ورود مایکروسافت */
  msDeviceCode: string | null;
}

export interface ConnectOptions {
  host: string;
  port: number;
  version: string;
  auth: "offline" | "microsoft";
  username: string;
  /** نام بازیکنی که باید از او محافظت شود */
  protectTarget?: string | null;
  serverId?: number | null;
}

/** نتیجهٔ اجرای یک دستور زبان طبیعی */
export interface CommandResult {
  ok: boolean;
  reply: string;
  command: ParsedCommand["type"] | "none";
}

/** ساختار دستورهای تحلیل‌شده از فارسی */
export type ParsedCommand =
  | { type: "follow" }
  | { type: "come" }
  | { type: "stop" }
  | { type: "goto"; x: number; y: number; z: number }
  | { type: "collect"; block: string }
  | { type: "jump" }
  | { type: "look" }
  | { type: "say"; text: string }
  | { type: "status" }
  | { type: "guard"; on: boolean }
  | { type: "rocket"; on: boolean }
  | { type: "autoAttack"; on: boolean }
  | { type: "help" };

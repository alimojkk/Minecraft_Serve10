"use client";

/**
 * پوستهٔ برنامه — سایدبار ناوبری راست‌چین + ناوبری موبایل
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Download,
  Gamepad2,
  MessageSquare,
  Mic,
  Settings
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "چت", icon: MessageSquare },
  { href: "/voice", label: "صوت", icon: Mic },
  { href: "/memory", label: "حافظه", icon: Brain },
  { href: "/minecraft", label: "ماینکرفت", icon: Gamepad2 },
  { href: "/settings", label: "تنظیمات", icon: Settings },
  { href: "/downloads", label: "دانلود", icon: Download }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* سایدبار دسکتاپ (سمت راست) */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-20 flex-col items-center gap-2 border-l border-white/10 bg-night-900/60 py-6 backdrop-blur-xl md:flex">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-violet text-lg font-bold text-night-950 shadow-glow">
          د
        </div>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition ${
                active
                  ? "bg-white/10 text-neon-cyan shadow-glow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </aside>

      {/* محتوا */}
      <main className="w-full pb-20 md:mr-20 md:pb-0">{children}</main>

      {/* ناوبری پایین موبایل */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-night-900/90 py-2 backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] ${
                active ? "text-neon-cyan" : "text-slate-400"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

/**
 * مرکز دانلود — پکیج ویندوز و راهنمای ساخت EXE
 */
import {
  Download,
  ExternalLink,
  FileDown,
  Github,
  Monitor,
  Package,
  Terminal
} from "lucide-react";
import { Card, PageTitle } from "@/components/ui";

export default function DownloadsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        title="مرکز دانلود"
        subtitle="برنامه روی ویندوز اجرا می‌شه — یا مستقیم نصب کن، یا خودت EXE بساز."
      />

      {/* دانلود مستقیم */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border border-neon-cyan/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 shadow-glow">
            <Monitor size={24} className="text-neon-cyan" />
          </div>
          <h2 className="text-lg font-bold text-white">
            نصب‌کنندهٔ ویندوز (Dastiar Setup)
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            فایل <span dir="ltr">Dastiar Setup 1.0.0.exe</span> با NSIS ساخته
            می‌شه؛ نصب تمیز، میان‌بر در استارت‌منو و اجرای یک‌کلیکی.
          </p>
          <a
            href="https://github.com/your-repo/dastiar/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-bl from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
          >
            <Download size={16} /> دانلود از GitHub Releases
          </a>
        </Card>

        <Card className="border border-neon-violet/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet/30 to-neon-pink/30 shadow-glow-violet">
            <Package size={24} className="text-neon-violet" />
          </div>
          <h2 className="text-lg font-bold text-white">نسخهٔ پرتابل</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            بدون نصب، فقط اجرا کن. مناسب فلش‌مموری و سیستم‌هایی که دسترسی نصب
            ندارن.
          </p>
          <a
            href="https://github.com/your-repo/dastiar/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <FileDown size={16} /> دانلود نسخهٔ پرتابل
          </a>
        </Card>
      </div>

      {/* راهنمای اجرا */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Terminal size={18} className="text-neon-green" /> اجرای مستقیم روی
          ویندوز
        </h2>
        <ol className="space-y-3 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">۱.</b> آخرین نسخهٔ Node.js (نسخهٔ ۱۸ به
            بالا) رو از{" "}
            <a
              href="https://nodejs.org"
              target="_blank"
              rel="noreferrer"
              className="text-neon-cyan underline"
            >
              nodejs.org
            </a>{" "}
            نصب کن.
          </li>
          <li>
            <b className="text-white">۲.</b> فایل{" "}
            <span dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5">
              start-dastiar.bat
            </span>{" "}
            رو از پوشهٔ release اجرا کن — خودش بررسی می‌کنه، دیتابیس رو
            آماده می‌کنه و برنامه رو توی مرورگر باز می‌کنه.
          </li>
          <li>
            <b className="text-white">۳.</b> از صفحهٔ تنظیمات، ارائه‌دهندهٔ
            هوش مصنوعی و کلید API رو وارد کن.
          </li>
        </ol>
      </Card>

      {/* ساخت EXE از طریق گیت‌هاب */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Github size={18} className="text-white" /> ساخت خودکار EXE در GitHub
          Actions
        </h2>
        <ol className="space-y-3 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">۱.</b> پروژه رو روی گیت‌هاب آپلود کن.
          </li>
          <li>
            <b className="text-white">۲.</b> ورک‌فلوی{" "}
            <span dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5">
              build-windows.yml
            </span>{" "}
            به‌صورت خودکار روی سرور ویندوزی مایکروسافت اجرا می‌شه.
          </li>
          <li>
            <b className="text-white">۳.</b> از بخش Actions → Artifacts می‌تونی{" "}
            <span dir="ltr">Dastiar Setup 1.0.0.exe</span> و نسخهٔ پرتابل رو
            دانلود کنی.
          </li>
        </ol>
        <a
          href="https://github.com/your-repo/dastiar/actions"
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <ExternalLink size={16} /> مشاهدهٔ صفحهٔ Actions
        </a>
      </Card>
    </div>
  );
}

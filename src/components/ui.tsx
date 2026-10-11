"use client";

/**
 * اجزای مشترک رابط کاربری — دکمه، فیلد، کارت و تیتر
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** تیتر صفحه */
export function PageTitle({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white neon-text">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** دکمهٔ اصلی */
export function Btn({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "success";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-bl from-blue-600 to-violet-600 text-white shadow-glow hover:brightness-110",
    ghost: "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
    danger:
      "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-glow-red hover:brightness-110",
    success:
      "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:brightness-110"
  };
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** فیلد ورودی متنی */
export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field" {...props} />;
}

/** برچسب فرم */
export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-400">
      {children}
    </label>
  );
}

/** کارت شیشه‌ای */
export function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass p-5 ${className}`}>{children}</div>;
}

/** سوییچ روشن/خاموش */
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
    >
      <span className="text-slate-200">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-neon-cyan/80" : "bg-slate-600"
        }`}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={checked ? { right: "2px" } : { right: "22px" }}
        />
      </span>
    </button>
  );
}

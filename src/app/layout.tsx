/**
 * لایوت اصلی — RTL، فونت وزیرمتن، تم تیره
 */
import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "دستیار — دستیار هوش مصنوعی شخصی",
  description:
    "دستیار هوش مصنوعی شخصی و محلی با حافظهٔ دائمی، مکالمهٔ صوتی فارسی و کنترل ربات ماینکرفت"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

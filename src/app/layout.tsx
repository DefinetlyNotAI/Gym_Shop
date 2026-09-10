import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import{SimulationSwitcher}from"@/components/simulation-switcher";
import { LanguageProvider, type Language } from "@/components/language-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gym Shop",
  description: "Gym apparel and accessories in Jordan",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const saved = (await cookies()).get("gym_shop_language")?.value;
  const language: Language = saved === "en" ? "en" : "ar";
  return (
    <html lang={language} dir={language === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body><LanguageProvider initialLanguage={language}><SimulationSwitcher/>{children}</LanguageProvider></body>
    </html>
  );
}

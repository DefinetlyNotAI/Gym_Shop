import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { SimulationSwitcher } from "@/components/simulation-switcher";
import {
  LanguageProvider,
  type Language,
} from "@/components/language-provider";
import { StoreFooter, StoreHeader } from "@/components/store-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gym Shop",
  description: "Gym apparel and accessories in Jordan",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const saved = (await cookies()).get("gym_shop_language")?.value;
  const language: Language = saved === "en" ? "en" : "ar";
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body>
        <LanguageProvider initialLanguage={language}>
          <a className="skip-link" href="#main-content">
            Skip to content / انتقل إلى المحتوى
          </a>
          <SimulationSwitcher />
          <StoreHeader />
          <div id="main-content" className="site-content" tabIndex={-1}>
            {children}
          </div>
          <StoreFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}

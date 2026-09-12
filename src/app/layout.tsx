import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import "./globals.css";
import {
  LanguageProvider,
  LocalizedText,
  type Language,
} from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SimulationSwitcher } from "@/components/simulation-switcher";
import { AdminNavigation } from "@/components/admin-navigation";
import { getSession } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Gym Shop Staff",
  description: "Gym Shop operations for authorized staff",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const saved = (await cookies()).get("gym_shop_language")?.value;
  const language: Language = saved === "en" ? "en" : "ar";
  const actor = await getSession();
  const navigationRole =
    actor?.sessionKind === "EMERGENCY" ? "" : (actor?.role ?? "");
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
          <header className="staff-header">
            <Link className="staff-brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                GS
              </span>
              <span>
                <LocalizedText en="Gym Shop" ar="جيم شوب" />
                <small>
                  <LocalizedText en="Staff workspace" ar="مساحة الموظفين" />
                </small>
              </span>
            </Link>
            <div className="header-utilities">
              <a href={process.env.STOREFRONT_ORIGIN ?? "https://example.com"}>
                <LocalizedText en="Customer store" ar="متجر العملاء" />
              </a>
              <LanguageSwitcher />
            </div>
          </header>
          <div
            className={`staff-workspace${navigationRole && !["CUSTOMER", "DELIVERY_AGENT"].includes(navigationRole) ? " has-sidebar" : ""}`}
          >
            <AdminNavigation role={navigationRole} />
            <div id="main-content" className="workspace-content" tabIndex={-1}>
              {children}
            </div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}

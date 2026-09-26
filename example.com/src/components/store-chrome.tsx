"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export function StoreHeader() {
  const { text } = useLanguage();

  return (
    <header className="nav">
      <Link
        className="brand"
        href="/"
        aria-label={text("Gym Shop home", "الصفحة الرئيسية لمتجر جيم")}
      >
        <span className="brand-mark" aria-hidden="true">
          GS
        </span>
        <span>GYM SHOP</span>
      </Link>
      <nav
        className="primary-nav"
        aria-label={text("Primary navigation", "التنقل الرئيسي")}
      >
        <Link href="/shop">{text("Shop", "المتجر")}</Link>
        <Link href="/cart">{text("Cart", "السلة")}</Link>
        <Link href="/account">{text("Account", "حسابي")}</Link>
      </nav>
      <LanguageSwitcher />
    </header>
  );
}

export function StoreFooter() {
  const { text } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <strong>GYM SHOP</strong>
        <span>
          {text(
            "Training essentials, selected in Amman.",
            "أساسيات التدريب المختارة في عمّان.",
          )}
        </span>
      </div>
      <nav aria-label={text("Footer navigation", "روابط تذييل الصفحة")}>
        <Link href="/about">{text("About", "من نحن")}</Link>
        <Link href="/faq">{text("FAQ", "الأسئلة الشائعة")}</Link>
        <Link href="/shipping">{text("Shipping", "الشحن")}</Link>
        <Link href="/contact">{text("Support", "الدعم")}</Link>
        <Link href="/legal">{text("Legal", "الشروط القانونية")}</Link>
      </nav>
    </footer>
  );
}

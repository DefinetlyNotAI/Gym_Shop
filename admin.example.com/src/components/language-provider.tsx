"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ar" | "en";
const STORAGE_KEY = "gym-shop-language";
const COOKIE_NAME = "gym_shop_language";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; text: (english: string, arabic: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const LOCALIZED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;

function selectedHalf(value: string, language: Language) {
  const parts = value.split(/\s+\/\s+/u);
  if (parts.length !== 2 || !/[\u0600-\u06ff]/u.test(parts[1])) return value;
  return language === "ar" ? parts[1] : parts[0];
}

function normalizeLegacyBilingualText(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const previous = originalText.get(node);
    const source = previous && (node.data === selectedHalf(previous, "en") || node.data === selectedHalf(previous, "ar")) ? previous : node.data; originalText.set(node, source);
    const selected = selectedHalf(source, language); if (node.data !== selected) node.data = selected;
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) for (const name of LOCALIZED_ATTRIBUTES) {
    const current = element.getAttribute(name); if (current === null) continue;
    const saved = originalAttributes.get(element) ?? new Map<string, string>(); if (!originalAttributes.has(element)) originalAttributes.set(element, saved);
    const previous = saved.get(name);
    const source = previous && (current === selectedHalf(previous, "en") || current === selectedHalf(previous, "ar")) ? previous : current; saved.set(name, source);
    const selected = selectedHalf(source, language); if (current !== selected) element.setAttribute(name, selected);
  }
}

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  function setLanguage(next: Language) {
    updateLanguage(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_NAME}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  useEffect(() => {
    normalizeLegacyBilingualText(document.body, language);
    const observer = new MutationObserver((records) => { for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) normalizeLegacyBilingualText(node, language); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage, text: (english, arabic) => language === "ar" ? arabic : english }), [language]);
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required");
  return value;
}

export function LocalizedText({ en, ar }: { en: string; ar: string }) {
  return useLanguage().language === "ar" ? ar : en;
}

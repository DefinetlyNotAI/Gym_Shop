"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ar" | "en";
const STORAGE_KEY = "gym-shop-language";
const COOKIE_NAME = "gym_shop_language";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (english: string, arabic: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyDocumentLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  function setLanguage(next: Language) {
    updateLanguage(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_NAME}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") updateLanguage(stored);
  }, []);
  useEffect(() => applyDocumentLanguage(language), [language]);
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

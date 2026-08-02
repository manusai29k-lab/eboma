import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { translations, LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE, type Language, type TranslationKeys } from "@/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (stored as Language) || DEFAULT_LANGUAGE;
  });
  const [location] = useLocation();

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    // The admin panel never reads `t`/`language` and must stay Arabic-only
    // regardless of what a merchant previously chose on this same browser
    // (language persists in localStorage, shared across the whole origin) —
    // this guard strips the Kurdish lang/font from <html> the instant an
    // /admin* route is active, even on a fresh full-page load straight to
    // /admin-login.
    const isAdminRoute = location.startsWith("/admin");
    // Both ar and ku (Sorani) render RTL, so dir is never touched here —
    // client/index.html's dir="rtl" stays correct for either language.
    document.documentElement.lang = !isAdminRoute && language === "ku" ? "ckb" : "ar";
    document.documentElement.classList.toggle("font-kurdish", !isAdminRoute && language === "ku");
  }, [language, location]);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === "ar" ? "ku" : "ar"));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

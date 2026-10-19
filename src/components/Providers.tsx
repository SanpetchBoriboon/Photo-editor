"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { HeroUIProvider } from "@heroui/react";
import { messages } from "@/lib/i18n";
import type { Language, MessageKey } from "@/lib/i18n";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("th");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t: (key) => messages[language][key],
  };

  return (
    <HeroUIProvider locale={language === "th" ? "th-TH" : "en-US"}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </HeroUIProvider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within Providers");
  return value;
}

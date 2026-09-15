"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, type Lang, en } from "./dictionaries";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof en;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: en,
});

const STORAGE_KEY = "nagomi.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Japanese is the default; a visitor's explicit choice (saved) wins.
  const [lang, setLangState] = useState<Lang>("ja");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ja") {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

/** Tiny template helper: fill("{n} nights", { n: 3 }) → "3 nights" */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

/**
 * A deferred, language-reactive message: store the dictionary KEY (dotted path,
 * e.g. "reservations.cancelledHalf") + any data params instead of the resolved
 * string, so notices already on screen re-translate when the language switches.
 * If `key` isn't found in the dictionary it's returned as-is — handy for raw
 * error strings that shouldn't be translated.
 */
export type Message = { key: string; params?: Record<string, string | number> };

export function resolveMessage(t: unknown, msg: Message): string {
  const raw = msg.key
    .split(".")
    .reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
  if (typeof raw === "string") return msg.params ? fill(raw, msg.params) : raw;
  return msg.key;
}

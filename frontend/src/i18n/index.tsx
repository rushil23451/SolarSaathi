import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en, type Dict } from "./en";
import { hi } from "./hi";

export type Lang = "en" | "hi";
const DICTS: Record<Lang, Dict> = { en, hi };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "hi") return saved;
  } catch {
    /* private mode */
  }
  return navigator.languages?.some((l) => l.startsWith("hi")) ? "hi" : "en";
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* private mode */
    }
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;

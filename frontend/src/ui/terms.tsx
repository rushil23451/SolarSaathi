// One shared side drawer that explains a term (sanctioned load, DCR, ...). Opened from any
// dotted-underlined term; it never blocks the page. Esc or Close returns focus to the link.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useT } from "../i18n";
import type { Dict } from "../i18n/en";

export type TermKey = keyof Dict["terms"];

const TermContext = createContext<(k: TermKey, from: HTMLElement) => void>(() => {});

export function TermProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [term, setTerm] = useState<TermKey | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = () => {
    setTerm(null);
    opener.current?.focus();
  };

  useEffect(() => {
    if (!term) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [term]);

  return (
    <TermContext.Provider value={(k, from) => { opener.current = from; setTerm(k); }}>
      {children}
      <aside
        aria-hidden={!term}
        className={`fixed inset-y-0 right-0 z-50 w-[400px] max-w-[92vw] transition-transform duration-300 ease-[var(--ease-out-soft)] ${
          term ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {term && (
          <div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-labelledby="term-title"
            className="h-full overflow-y-auto overscroll-contain border-l border-line bg-surface p-8 shadow-[var(--shadow-lift)] focus:outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="term-title" className="type-h2">{t.terms[term].title}</h2>
              <button onClick={close} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-paper" aria-label={t.common.close}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 type-prose text-ink-2">{t.terms[term].body}</p>
          </div>
        )}
      </aside>
    </TermContext.Provider>
  );
}

/** A term in running text: dotted underline, opens the drawer with its plain explanation. */
export function Term({ k, children }: { k: TermKey; children?: ReactNode }) {
  const open = useContext(TermContext);
  const t = useT();
  return (
    <button
      type="button"
      onClick={(e) => open(k, e.currentTarget)}
      className="inline text-left underline decoration-dotted decoration-[1.5px] underline-offset-4 hover:decoration-solid"
    >
      {children ?? t.terms[k].title}
    </button>
  );
}

export function TermHelp({ k }: { k: TermKey }) {
  const open = useContext(TermContext);
  const t = useT();
  return (
    <button
      type="button"
      onClick={(e) => open(k, e.currentTarget)}
      className="type-small text-grid underline underline-offset-4 hover:decoration-2"
    >
      {t.common.whatsThis}
    </button>
  );
}

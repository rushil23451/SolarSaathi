import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useLang, useT } from "../i18n";
import { Wordmark } from "../ui/Wordmark";
import { TermProvider } from "../ui/terms";
import { apiConfigured } from "../lib/api";

function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t.common.language} className="flex rounded-full border border-line-strong p-0.5">
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          lang={l}
          // Shown in the system font while English is active, so English pages never load the Hindi font file.
          style={l === "hi" && lang !== "hi" ? { fontFamily: "system-ui, 'Noto Sans Devanagari', sans-serif" } : undefined}
          className={`h-9 rounded-full px-3.5 text-[15px] font-medium transition-colors duration-150 ${
            lang === l ? "bg-ink text-paper" : "text-ink hover:bg-line/60"
          }`}
        >
          {l === "en" ? "English" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

export function Layout() {
  const t = useT();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // After each step, move focus to the page so screen readers announce the new heading.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <TermProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t.common.skip}
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-8">
          <Link to="/" viewTransition className="rounded-lg text-ink no-underline" aria-label="SolarSaathi home">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/how-it-works" viewTransition className="font-medium text-ink no-underline hover:underline">
              {t.common.howItWorks}
            </Link>
            <LangSwitch />
          </nav>
        </div>
      </header>
      {!apiConfigured && (
        <p className="bg-bad-soft px-8 py-2 text-center type-small text-bad">{t.common.notConfigured}</p>
      )}
      <main id="main" ref={main} className="min-h-[calc(100dvh-72px)]">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[1.2fr_1fr_1fr] gap-10 px-8 py-12 type-small text-muted">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-[44ch]">{t.footer.built}</p>
          </div>
          <p>{t.footer.privacy}</p>
          <p>
            {t.footer.advice}{" "}
            <Link to="/how-it-works" className="text-grid">{t.common.howItWorks}</Link>
          </p>
        </div>
      </footer>
    </TermProvider>
  );
}

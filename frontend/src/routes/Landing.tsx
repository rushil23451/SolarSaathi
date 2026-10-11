import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ClockCounterClockwise, LockSimple } from "@phosphor-icons/react";
import { useLang } from "../i18n";
import { lastReport } from "../app/flow";
import { ButtonLink } from "../ui/controls";
import { Meter } from "../ui/Meter";
import { useTitle } from "../lib/useTitle";

export function Landing() {
  const { t, lang } = useLang();
  const L = t.landing;
  const last = lastReport.get();
  useTitle(L.title);
  const lastDate = last ? new Date(last.date).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long" }) : "";

  return (
    <div>
      {/* hero */}
      <section className="mx-auto grid max-w-[1280px] grid-cols-12 items-center gap-12 px-8 pb-24 pt-20">
        <div className="col-span-7 flex flex-col gap-7">
          <h1 tabIndex={-1} className="type-display max-w-[14ch] focus:outline-none">{L.title}</h1>
          <p className="max-w-[56ch] type-prose text-ink-2">{L.lead}</p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink to="/bill">{L.ctaBill}</ButtonLink>
            <ButtonLink to="/quote" variant="secondary" className="h-14 text-[17px]">{L.ctaQuote}</ButtonLink>
          </div>
          <p className="type-small text-muted">{L.note}</p>
          {last && (
            <Link to={`/report/${last.id}`} viewTransition className="flex items-center gap-2 self-start font-medium">
              <ClockCounterClockwise aria-hidden="true" /> {L.lastReport(lastDate)}: {L.open}
            </Link>
          )}
        </div>
        <div className="col-span-5">
          <Meter value={361} digits={5} unit={L.meterUnit} caption={L.example} label={`361 ${L.meterUnit}. ${L.example}`} className="rotate-[1.5deg]" />
        </div>
      </section>

      <Story />

      {/* two checks */}
      <section aria-labelledby="checks" className="mx-auto max-w-[1280px] px-8 py-24">
        <h2 id="checks" className="type-h1">{L.checksTitle}</h2>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-ink p-10 text-paper">
            <h3 className="type-h2">{L.billCard.title}</h3>
            <p className="max-w-[48ch] type-prose text-paper/80">{L.billCard.body}</p>
            <ButtonLink to="/bill" className="mt-4 self-start">{L.billCard.cta}</ButtonLink>
          </div>
          <div className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-surface p-10">
            <h3 className="type-h2">{L.quoteCard.title}</h3>
            <p className="max-w-[48ch] type-prose text-ink-2">{L.quoteCard.body}</p>
            <ButtonLink to="/quote" variant="secondary" className="mt-4 self-start">{L.quoteCard.cta}</ButtonLink>
          </div>
        </div>
      </section>

      {/* how we work: a real sequence, so it is numbered */}
      <section aria-labelledby="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-8 py-24">
          <h2 id="how" className="type-h1">{L.howTitle}</h2>
          <ol className="mt-12 grid grid-cols-3 gap-10">
            {L.how.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 border-t-2 border-ink pt-5">
                <span className="text-[56px] leading-none font-[700] text-marigold [font-stretch:120%] nums" aria-hidden="true">{i + 1}</span>
                <h3 className="type-h2">{s.title}</h3>
                <p className="type-prose text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1280px] items-start gap-5 px-8 py-20">
        <LockSimple size={32} className="mt-1 shrink-0 text-marigold-text" aria-hidden="true" />
        <div>
          <h2 className="type-h2">{L.privacyTitle}</h2>
          <p className="mt-2 max-w-[70ch] type-prose text-ink-2">{L.privacy}</p>
        </div>
      </section>
    </div>
  );
}

/** The meter story: one real bill, three stages. The meter is sticky and changes as each stage
 *  scrolls into view; nothing autoplays and nothing hijacks the scroll. */
function Story() {
  const { t } = useLang();
  const L = t.landing;
  const [stage, setStage] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStage(Number((e.target as HTMLElement).dataset.stage))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const s = L.story[stage];
  return (
    <section aria-labelledby="story" className="bg-[#eef0eb]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-12 px-8 py-24">
        <div className="col-span-5">
          <div className="sticky top-[140px] flex flex-col gap-5">
            <h2 id="story" className="type-h2">{L.storyTitle}</h2>
            <Meter value={s.meter} digits={4} unit={s.unit} caption={L.example} tone={stage === 1 ? "marigold" : "ink"} label={`${s.meter} ${s.unit}`} />
            <ol className="flex gap-2" aria-hidden="true">
              {L.story.map((_, i) => (
                <li key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= stage ? "bg-marigold" : "bg-line-strong/50"}`} />
              ))}
            </ol>
          </div>
        </div>
        <ol className="col-span-6 col-start-7 flex flex-col">
          {L.story.map((st, i) => (
            <li
              key={st.title}
              data-stage={i}
              ref={(el) => { refs.current[i] = el; }}
              className={`flex min-h-[70vh] flex-col justify-center gap-4 transition-opacity duration-300 ${stage === i ? "opacity-100" : "opacity-40"}`}
            >
              <h3 className="type-h1">{st.title}</h3>
              <p className="max-w-[48ch] type-prose text-ink-2">{st.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { ArrowSquareOut } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { ButtonLink } from "../ui/controls";
import { useTitle } from "../lib/useTitle";

const PORTAL = "https://pmsuryaghar.gov.in";
const VARIES = new Set([2, 4]); // steps that differ most between discoms

export function HowItWorks() {
  const t = useT();
  const H = t.how;
  useTitle(H.title);
  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-16">
      <div className="grid grid-cols-12 gap-12">
        <div className="col-span-7">
          <h1 tabIndex={-1} className="type-h1 focus:outline-none">{H.title}</h1>
          <p className="mt-4 max-w-[60ch] type-prose text-ink-2">{H.lead}</p>
        </div>
        <div className="col-span-5 flex items-end justify-end">
          <a href={PORTAL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-button)] border border-ink/80 px-5 font-semibold text-ink no-underline hover:bg-ink hover:text-paper">
            {H.portal} <ArrowSquareOut aria-hidden="true" />
          </a>
        </div>
      </div>

      <ol className="mt-14 grid grid-cols-3 gap-x-10 gap-y-14">
        {H.steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 border-t-2 border-ink pt-5">
            <span className="text-[44px] leading-none font-[700] text-marigold [font-stretch:120%] nums" aria-hidden="true">{i + 1}</span>
            <h2 className="type-h3">{s.title}</h2>
            <p className="text-ink-2">{s.body}</p>
            {VARIES.has(i) && <span className="self-start rounded-full bg-warn-soft px-3 py-1 type-small text-warn">{H.varies}</span>}
          </li>
        ))}
      </ol>

      <div className="mt-24 grid grid-cols-12 gap-12">
        <section className="col-span-7" aria-labelledby="method">
          <h2 id="method" className="type-h2">{H.methodTitle}</h2>
          <ul className="mt-5 flex flex-col gap-3">
            {H.method.map((m) => (
              <li key={m} className="flex gap-3 type-prose">
                <span aria-hidden="true" className="mt-[13px] h-[3px] w-4 shrink-0 rounded bg-marigold" />{m}
              </li>
            ))}
          </ul>
        </section>
        <section className="col-span-5 self-start rounded-[var(--radius-panel)] border border-line bg-surface p-8" aria-labelledby="data">
          <h2 id="data" className="type-h3">{H.dataTitle}</h2>
          <p className="mt-3 text-ink-2">{H.data}</p>
          <ButtonLink to="/bill" className="mt-6">{t.landing.ctaBill}</ButtonLink>
        </section>
      </div>
    </div>
  );
}

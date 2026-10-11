import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle, Copy, Info, Printer, Question, WarningCircle, WhatsappLogo, XCircle } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { useFlow } from "../app/flow";
import { inr } from "../lib/format";
import type { Check, CheckStatus, QuoteReport } from "../types/api";
import { Button, ButtonLink, Steps } from "../ui/controls";
import { Term } from "../ui/terms";
import { useTitle } from "../lib/useTitle";

const ORDER: CheckStatus[] = ["red", "amber", "info", "green"];
const TONE: Record<CheckStatus, { icon: JSX.Element; text: string; bar: string }> = {
  red: { icon: <XCircle weight="fill" />, text: "text-bad", bar: "bg-bad" },
  amber: { icon: <WarningCircle weight="fill" />, text: "text-warn", bar: "bg-marigold" },
  info: { icon: <Question weight="fill" />, text: "text-muted", bar: "bg-line-strong" },
  green: { icon: <CheckCircle weight="fill" />, text: "text-good", bar: "bg-good" },
};

export function QuoteReview() {
  const t = useT();
  const flow = useFlow();
  const report = flow.state.quote;
  useTitle(t.quote.title);

  if (!report) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-8 py-24">
        <h1 tabIndex={-1} className="type-h1 focus:outline-none">{t.quote.title}</h1>
        <p className="type-prose text-ink-2">{t.quote.noReview}</p>
        <ButtonLink to="/quote">{t.quote.upload}</ButtonLink>
      </div>
    );
  }
  return <Review report={report} reportId={flow.state.quoteFromReport} />;
}

function Review({ report, reportId }: { report: QuoteReport; reportId: string | null }) {
  const t = useT();
  const Q = t.quote;
  const [showFine, setShowFine] = useState(false);
  const by = (s: CheckStatus) => report.checks.filter((c) => c.status === s);
  const reds = by("red").length, ambers = by("amber").length;
  const headline = reds ? Q.verdict.red(reds) : ambers ? Q.verdict.amber(ambers) : Q.verdict.green;
  const price = report.checks.find((c) => c.id === "price");
  const questions = report.advice?.questions?.length
    ? report.advice.questions
    : report.checks.filter((c) => c.status === "red" || c.status === "amber").map((c) => Q.ask[c.id]);

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-10">
      <Steps steps={t.steps.quote} current={1} label={t.steps.label} />
      <div className="mt-10 grid grid-cols-12 gap-12">
        <div className="col-span-8 flex flex-col gap-12">
          <header className="flex flex-col gap-4">
            <p className="type-small font-semibold text-marigold-text">{Q.title}</p>
            <h1 tabIndex={-1} className="type-h1 focus:outline-none">{headline}</h1>
            <p className="type-prose text-ink-2 nums">{Q.summaryLine(report.quote.vendor_name, report.quote.system_kw, report.quote.price_total_inr)}</p>
            {report.advice?.summary && (
              <p className="border-l-2 border-marigold pl-4 type-prose">
                <span className="sr-only">{Q.agentSummary}: </span>{report.advice.summary}
              </p>
            )}
          </header>

          {price && price.params.price_per_kw && <PriceScale check={price} gstExcluded={report.quote.gst_included === false} />}

          {ORDER.filter((s) => s !== "green").map((s) => by(s).length > 0 && (
            <section key={s} aria-labelledby={`g-${s}`} className="flex flex-col gap-4">
              <h2 id={`g-${s}`} className={`flex items-center gap-2 type-h2 ${TONE[s].text}`}>
                <span aria-hidden="true">{TONE[s].icon}</span> {Q.groups[s as "red" | "amber" | "info"]} <span className="text-muted nums">({by(s).length})</span>
              </h2>
              <div className="flex flex-col gap-4">
                {by(s).map((c) => <Finding key={c.id} c={c} hasReport={Boolean(reportId)} />)}
              </div>
            </section>
          ))}

          {by("green").length > 0 && (
            <section aria-labelledby="g-green" className="flex flex-col gap-4">
              <h2 id="g-green" className={`flex items-center gap-2 type-h2 ${TONE.green.text}`}>
                <span aria-hidden="true">{TONE.green.icon}</span> {Q.groups.green} <span className="text-muted nums">({by("green").length})</span>
              </h2>
              <button type="button" onClick={() => setShowFine(!showFine)} aria-expanded={showFine} className="self-start font-medium text-grid underline underline-offset-4">
                {showFine ? Q.hideFine : Q.showFine(by("green").length)}
              </button>
              {showFine && <div className="flex flex-col gap-4">{by("green").map((c) => <Finding key={c.id} c={c} hasReport={Boolean(reportId)} />)}</div>}
            </section>
          )}

          <div className="flex flex-wrap gap-4 border-t border-line pt-8">
            <ButtonLink to={reportId ? `/quote?report=${reportId}` : "/quote"} variant="secondary">{Q.another}</ButtonLink>
            {reportId && <ButtonLink to={`/report/${reportId}`} variant="tertiary">{Q.backToReport}</ButtonLink>}
          </div>
        </div>

        <aside className="col-span-4">
          <QuestionsPanel questions={questions} />
        </aside>
      </div>
    </div>
  );
}

function Finding({ c, hasReport }: { c: Check; hasReport: boolean }) {
  const t = useT();
  const Q = t.quote;
  const found = (Q.found[c.id] as (s: CheckStatus, p: Record<string, any>) => string)(c.status, c.params);
  const termFor: Partial<Record<Check["id"], "dcr" | "almm" | "sanctioned_load" | "net_metering" | "pm_surya_ghar">> = {
    dcr: "dcr", almm: "almm", size: "sanctioned_load", inverter: "net_metering", subsidy: "pm_surya_ghar",
  };
  const term = termFor[c.id];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface p-6 pl-8">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${TONE[c.status].bar}`} />
      <h3 className="type-h3">{Q.titles[c.id]}</h3>
      <dl className="mt-3 grid grid-cols-[9.5rem_1fr] gap-x-6 gap-y-2">
        <dt className="type-small font-semibold text-muted">{Q.labels.found}</dt>
        <dd className="nums">{found}</dd>
        {c.status !== "green" && (
          <>
            <dt className="type-small font-semibold text-muted">{Q.labels.why}</dt>
            <dd className="text-ink-2">{Q.why[c.id]} {term && <Term k={term} />}</dd>
            <dt className="type-small font-semibold text-muted">{Q.labels.ask}</dt>
            <dd className="font-medium">“{Q.ask[c.id]}”</dd>
          </>
        )}
      </dl>
      {c.id === "size" && c.status === "info" && !hasReport && (
        <Link to="/bill" viewTransition className="mt-4 inline-block font-semibold">{Q.noBill}</Link>
      )}
    </article>
  );
}

/** Price per kW on a scale: the usual range as a band, this quote as a marker. */
function PriceScale({ check, gstExcluded }: { check: Check; gstExcluded: boolean }) {
  const t = useT();
  const Q = t.quote;
  const { price_per_kw: p, low_per_kw: lo, high_per_kw: hi, pct_over, too_low } = check.params;
  const min = Math.min(lo * 0.7, p * 0.9), max = Math.max(hi * 1.4, p * 1.08);
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  const verdict = too_low ? Q.priceBelow : pct_over > 0 ? Q.priceAbove(pct_over) : Q.priceWithin;
  return (
    <section aria-labelledby="price-q" className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-surface p-7">
      <h2 id="price-q" className="type-h3">{Q.priceTitle}</h2>
      <div className="relative mt-10 h-3 rounded-full bg-line/60" role="img" aria-label={`${Q.priceYours}: ${inr(p)}. ${Q.priceRange}: ${inr(lo)}–${inr(hi)}. ${verdict}.`}>
        <div className="absolute inset-y-0 rounded-full bg-good/30 ring-1 ring-good" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
        <span className="absolute -top-8 -translate-x-1/2 whitespace-nowrap type-small text-good" style={{ left: `${(pos(lo) + pos(hi)) / 2}%` }}>{Q.priceRange}</span>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(p)}%` }}>
          <span className="block size-6 rounded-full border-4 border-surface bg-ink shadow-[var(--shadow-panel)]" />
        </div>
      </div>
      <div className="relative h-6 type-small nums">
        <span className="absolute -translate-x-1/2 text-muted" style={{ left: `${pos(lo)}%` }}>{inr(lo)}</span>
        <span className="absolute -translate-x-1/2 text-muted" style={{ left: `${pos(hi)}%` }}>{inr(hi)}</span>
        </div>
        <p className="nums font-semibold">
        {Q.priceYours}: {inr(p)} / kW, {verdict.toLowerCase()}
        </p>
      {gstExcluded && <p className="flex items-center gap-2 type-small text-muted"><Info aria-hidden="true" /> {Q.gstNote}</p>}
    </section>
  );
}

function QuestionsPanel({ questions }: { questions: string[] }) {
  const t = useT();
  const Q = t.quote;
  const [copied, setCopied] = useState(false);
  const text = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  if (!questions.length) return null;
  return (
    <div className="sticky top-[104px] flex flex-col gap-5 rounded-[var(--radius-panel)] bg-ink p-7 text-paper">
      <div>
        <h2 className="type-h2">{Q.questions}</h2>
        <p className="mt-1 text-paper/70">{Q.questionsNote}</p>
      </div>
      <ol className="flex list-decimal flex-col gap-3 pl-5 marker:font-semibold marker:text-marigold">
        {questions.map((q) => <li key={q} className="pl-1">{q}</li>)}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" className="h-12 text-[16px]" icon={<Copy size={20} aria-hidden="true" />} onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* blocked */ }
        }}>
          {copied ? Q.copied : Q.copy}
        </Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-button)] border border-paper/60 px-4 font-semibold text-paper no-underline hover:bg-paper hover:text-ink">
          <WhatsappLogo size={20} aria-hidden="true" /> {Q.whatsapp}
        </a>
        <button type="button" onClick={() => window.print()} className="inline-flex h-12 items-center gap-2 px-2 font-medium text-paper/80 underline underline-offset-4 hover:text-paper">
          <Printer size={20} aria-hidden="true" /> {Q.print}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? Q.copied : ""}</span>
    </div>
  );
}

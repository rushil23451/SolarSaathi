import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowsClockwise, CheckCircle, Info, ShareNetwork, SpeakerHigh, Stop, WhatsappLogo } from "@phosphor-icons/react";
import { useLang } from "../i18n";
import { lastReport } from "../app/flow";
import { ApiError, getResult, speech } from "../lib/api";
import { inr, inrShort, kw, num } from "../lib/format";
import { reasons } from "../lib/reasons";
import type { Analysis } from "../types/api";
import { Button, ButtonLink } from "../ui/controls";
import { Meter } from "../ui/Meter";
import { Term } from "../ui/terms";
import { CostWaterfall, HBars, MonthStrip, PaybackChart } from "../features/report/charts";
import { Roof3D } from "../features/Roof3D";
import { useTitle } from "../lib/useTitle";

const SECTIONS = ["worth", "bill", "roof", "cost", "payback", "loan", "air", "method"] as const;

type Load = { k: "loading" } | { k: "ok"; r: Analysis } | { k: "missing" } | { k: "error" };

export function Report() {
  const { t } = useLang();
  const { id = "" } = useParams();
  const [load, setLoad] = useState<Load>({ k: "loading" });
  const owner = lastReport.get()?.id === id;
  useTitle(t.report.title);

  const fetchIt = () => {
    setLoad({ k: "loading" });
    getResult(id)
      .then((res) => setLoad({ k: "ok", r: res.result }))
      .catch((e) => setLoad(e instanceof ApiError && e.kind === "not_found" ? { k: "missing" } : { k: "error" }));
  };
  useEffect(fetchIt, [id]);

  if (load.k === "loading") return <ReportSkeleton />;
  if (load.k === "missing" || load.k === "error") {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-8 py-24">
        <h1 tabIndex={-1} className="type-h1 max-w-[22ch] focus:outline-none">{load.k === "missing" ? t.report.notFoundTitle : t.report.loadFailed}</h1>
        {load.k === "missing" && <p className="type-prose text-ink-2">{t.report.notFoundText}</p>}
        <div className="flex gap-4">
          <ButtonLink to="/bill">{t.report.startNew}</ButtonLink>
          {load.k === "error" && <Button variant="secondary" onClick={fetchIt}>{t.common.tryAgain}</Button>}
        </div>
      </div>
    );
  }
  return <ReportBody r={load.r} id={id} owner={owner} />;
}

function ReportBody({ r, id, owner }: { r: Analysis; id: string; owner: boolean }) {
  const { t } = useLang();
  const R = t.report;
  const full = Boolean(r.system_kw && r.months && r.lifetime);
  const sections = full ? SECTIONS : (["worth", "bill"] as const);
  const active = useActiveSection(sections as readonly string[]);
  const verdictText = R.verdict[r.verdict];
  const why = r.verdict === "unsupported_discom" ? [] : reasons(r, R.reasons);
  const shareUrl = `${location.origin}/report/${id}`;
  const g = r.assumptions?.tariff_growth_pct ?? 3;
  const sc = (pct: number) => r.scenarios?.find((s) => s.growth_pct === pct)?.payback_years ?? null;

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-x-10 px-8 pb-24 pt-10">
      {/* question rail */}
      <nav aria-label={R.railLabel} className="col-span-3">
        <ol className="sticky top-[104px] flex flex-col gap-1 border-l border-line">
          {sections.map((s) => {
            const label = R.rail[SECTIONS.indexOf(s)];
            const on = active === s;
            return (
              <li key={s}>
                <a
                  href={`#${s}`}
                  aria-current={on ? "location" : undefined}
                  className={`-ml-px block border-l-2 py-1.5 pl-4 no-underline transition-colors duration-150 ${
                    on ? "border-marigold font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="col-span-9 flex flex-col gap-24">
        {!owner && (
          <p className="-mb-16 flex items-center gap-2 rounded-[var(--radius-input)] bg-grid-soft px-4 py-3 text-ink-2">
            <Info className="shrink-0 text-grid" aria-hidden="true" /> {R.next.sharedNote}{" "}
            <Link to="/bill" viewTransition className="font-semibold">{R.next.own}</Link>
          </p>
        )}

        {/* 1. verdict */}
        <section id="worth" className="grid grid-cols-9 gap-x-10">
          <div className="col-span-6 flex flex-col gap-6">
            <p className="type-small font-semibold text-marigold-text">{R.title}</p>
            <h1 tabIndex={-1} className="text-[52px] leading-[58px] font-[700] [font-stretch:118%] focus:outline-none text-balance">
              {verdictText}
            </h1>
            <p className="type-prose text-ink-2">
              {r.verdict === "unsupported_discom" ? R.unsupported(r.discom ?? "") : r.reason ? R.verdictSub[r.reason] : null}
            </p>
            {why.length > 0 && (
              <div>
                <h2 className="type-h3">{R.why}</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {why.map((w) => (
                    <li key={w} className="flex gap-3 type-prose">
                      <span aria-hidden="true" className="mt-[13px] h-[3px] w-4 shrink-0 rounded bg-marigold" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ReportActions r={r} verdictText={verdictText} shareUrl={shareUrl} />
          </div>
          {full && (
            <aside className="col-span-3 flex flex-col gap-4 pt-10">
              <Meter value={Math.round(r.net_cost!)} digits={6} unit={`₹ ${R.cost.steps[2]}`} caption={R.cost.sub} tone="marigold" label={`${R.cost.steps[2]} ${inr(r.net_cost)} ${R.cost.sub}`} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 nums">
                <Stat label={R.bill.savedLabel} value={inr(r.monthly_saving)} />
                <Stat label={R.rail[4]} value={r.payback_years ? t.common.years(r.payback_years) : "—"} />
                <Stat label={R.rail[2]} value={kw(r.system_kw)} />
                <Stat label={R.rail[6]} value={`${num(r.co2_tonnes_year, 1)} t`} />
              </dl>
            </aside>
          )}
        </section>

        {/* 2. bill */}
        {r.bill_now && (
          <Section id="bill" q={R.bill.q} value={r.bill_with_solar ? R.bill.value(r.bill_now.payable, r.bill_with_solar.payable) : inr(r.bill_now.payable)} sub={R.bill.sub}
            margin={full ? [R.bill.marginAvg, R.bill.marginExport] : []}>
            {r.bill_with_solar ? (
              <>
                <p className="type-prose">
                  {r.bill_now.payable < 1
                    ? R.bill.alreadyZero(r.free_units_limit ?? null)
                    : r.free_units_limit && r.zero_bill_months === 12
                      ? R.bill.whyZeroAll(r.coverage_pct!, r.grid_units_month!, r.free_units_limit)
                      : r.free_units_limit && r.zero_bill_months
                        ? R.bill.whyZeroSome(r.zero_bill_months, r.free_units_limit)
                        : R.bill.whyNormal(r.grid_units_month!)}
                </p>
                <BillSlips r={r} />
                <div>
                  <h3 className="type-h3">{R.bill.monthsTitle}</h3>
                  <div className="mt-4"><MonthStrip months={r.months!} limit={r.free_units_limit ?? null} /></div>
                </div>
              </>
            ) : (
              <p className="type-prose">{t.common.unitsMonth(r.monthly_units ?? 0)}</p>
            )}
          </Section>
        )}

        {full && (
          <>
            {/* 3. roof */}
            <Section id="roof" q={R.roof.q} value={R.roof.value(r.system_kw!)} sub={R.roof.sub(r.size!.panels, r.size!.roof_sqft)} margin={[R.roof.marginRoof]}>
              <p className="type-prose">{R.roof.explain(r.system_kw!, r.coverage_pct!)} <Term k="kw_kwh" /></p>
              <HBars
                rows={[
                  { label: R.roof.useYear, value: (r.monthly_units ?? 0) * 12, text: R.roof.unitsYear((r.monthly_units ?? 0) * 12), cls: "bg-ink-2" },
                  { label: R.roof.makesYear(r.system_kw!), value: (r.solar_units_month ?? 0) * 12, text: R.roof.unitsYear((r.solar_units_month ?? 0) * 12), cls: "bg-solar" },
                ]}
              />
              <p className="text-ink-2">
                {r.size!.limited_by === "need" ? R.roof.limitedBy.need(r.size!.coverage_target_pct)
                  : r.size!.limited_by === "sanctioned_load" ? <>{R.roof.limitedBy.sanctioned_load(r.size!.sanctioned_load_kw!)} <Term k="sanctioned_load" /></>
                  : R.roof.limitedBy.roof(r.size!.roof_limit_kw!)}
              </p>
              <div className="flex flex-col gap-6">
                                <Roof3D r={r} />
                <Rows rows={[
                  [R.roof.rows.use, t.common.unitsMonth(r.monthly_units!)],
                  [R.roof.rows.perKw, R.roof.rows.perKwValue(r.size!.yield_per_kw_year)],
                  [R.roof.rows.needed(r.size!.coverage_target_pct), kw(r.size!.needed_kw)],
                  ...(r.size!.sanctioned_load_kw ? [[R.roof.rows.load, kw(r.size!.sanctioned_load_kw)] as [string, string]] : []),
                  ...(r.size!.roof_limit_kw ? [[R.roof.rows.roofLimit, kw(r.size!.roof_limit_kw)] as [string, string]] : []),
                  [R.roof.rows.rounded(r.size!.step_kw), kw(r.system_kw)],
                  [R.roof.rows.panels, `${r.size!.panels} × ${r.size!.panel_watt} W`],
                  [R.roof.rows.space, `${num(r.size!.roof_sqft)} sq ft`],
                ]} />
              </div>
            </Section>

            {/* 4. cost */}
            <Section id="cost" q={R.cost.q} value={R.cost.value(r.net_cost!)} sub={R.cost.sub} margin={[R.cost.marginCost, R.cost.marginSubsidy]}>
              <p className="type-prose">
                {R.cost.explain(r.system_kw!, r.cost_low!, r.cost_high!, r.central_subsidy!, Boolean(r.subsidy_detail?.eligible))} <Term k="pm_surya_ghar" />
              </p>
              <CostWaterfall r={r} />
              <Rows rows={[
                [R.cost.rows.market, `${inr(r.cost_low)} – ${inr(r.cost_high)}`],
                [R.cost.rows.mid, inr(r.cost_mid)],
                ...(r.subsidy_detail?.eligible
                  ? [
                      [R.cost.rows.first(r.subsidy_detail.first_kw, r.subsidy_detail.first_rate), `−${inr(r.subsidy_detail.first_kw * r.subsidy_detail.first_rate)}`] as [string, string],
                      ...(r.subsidy_detail.third_kw > 0 ? [[R.cost.rows.third(r.subsidy_detail.third_kw, r.subsidy_detail.third_rate), `−${inr(r.subsidy_detail.third_kw * r.subsidy_detail.third_rate)}`] as [string, string]] : []),
                      [`(${R.cost.rows.cap})`, inr(r.subsidy_detail.cap)] as [string, string],
                    ]
                  : []),
                ...(r.state_incentive ? [[R.cost.rows.state, `−${inr(r.state_incentive)}`] as [string, string]] : []),
                [R.cost.rows.pay, inr(r.net_cost)],
              ]} total />
            </Section>

            {/* 5. payback */}
            <Section id="payback" q={R.payback.q} value={R.payback.value(r.payback_years ?? null)}
              sub={R.payback.sub(inrShort(r.lifetime_savings!, t.common.lakh), r.assumptions!.lifetime_years)} margin={[R.payback.marginGrowth(g)]}>
              <p className="type-prose">{R.payback.explain(r.net_cost!)} <Term k="payback" /></p>
              <PaybackChart r={r} />
              {r.scenarios && <p className="text-ink-2">{R.payback.range(sc(0), sc(5))}</p>}
              <Rows rows={[
                [R.payback.rows.saved(r.assumptions!.lifetime_years), inrShort(r.lifetime!.total_saved, t.common.lakh)],
                [R.payback.rows.paid, `−${inr(r.net_cost)}`],
                [R.payback.rows.maint(inr(r.lifetime!.maintenance_year)), `−${inr(r.lifetime!.maintenance_year * r.assumptions!.lifetime_years)}`],
                [R.payback.rows.inverter(r.assumptions!.inverter_year), `−${inr(r.lifetime!.inverter_cost)}`],
                [R.payback.rows.net, inrShort(r.lifetime_savings!, t.common.lakh)],
              ]} total />
            </Section>

            {/* 6. loan */}
            <Section id="loan" q={R.loan.q} value={R.loan.value(r.loan!.emi)}
              sub={r.loan!.net_monthly >= 0 ? R.loan.subAhead(r.loan!.net_monthly) : R.loan.subBehind(-r.loan!.net_monthly)} margin={[R.loan.margin]}>
              <p className="type-prose">
                {R.loan.explain(r.loan!.amount, r.loan!.rate_pct, r.loan!.years, r.loan!.emi)} {r.loan!.net_monthly >= 0 && R.loan.ahead}
              </p>
              <HBars rows={[
                { label: R.loan.emi, value: r.loan!.emi, text: inr(r.loan!.emi), cls: "bg-ink-2" },
                { label: R.loan.save, value: r.monthly_saving!, text: inr(r.monthly_saving), cls: "bg-solar" },
              ]} />
            </Section>

            {/* 7. air */}
            <Section id="air" q={R.air.q} value={R.air.value(r.co2_tonnes_year!)} sub={R.air.sub(r.co2_tonnes_lifetime!, r.assumptions!.lifetime_years)} margin={[R.air.margin]}>
              {(() => {
                const f = r.assumptions!.emission_kg_per_unit;
                const now = ((r.monthly_units ?? 0) * 12 * f) / 1000;
                const after = Math.max(0, now - r.co2_tonnes_year!);
                const pct = now ? Math.round((r.co2_tonnes_year! / now) * 100) : 0;
                return (
                  <>
                    <p className="type-prose">{R.air.explain(Math.min(100, pct), f)}</p>
                    <HBars max={now} rows={[
                      { label: R.air.now, value: now, text: R.air.tonnes(now), cls: "bg-grid" },
                      { label: R.air.after, value: after, text: R.air.tonnes(after), cls: "bg-grid" },
                    ]} />
                  </>
                );
              })()}
            </Section>

            {/* 8. method */}
            <Section id="method" q={R.method.q} margin={[]}>
              <p className="type-prose">{R.method.intro}</p>
              <details className="group rounded-[var(--radius-panel)] border border-line bg-surface">
                <summary className="cursor-pointer list-none px-6 py-4 font-semibold marker:hidden">
                  <span className="text-grid underline underline-offset-4">{R.method.open}</span>
                </summary>
                <ol className="flex flex-col divide-y divide-line px-6 pb-4">
                  {r.working?.map((w) => (
                    <li key={w.key} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-3">
                      <span className="font-semibold">{R.method.steps[w.key] ?? w.key}</span>
                      <span className="text-right font-semibold nums" translate="no">{w.value}</span>
                      <span className="col-span-2 type-small text-muted" translate="no">{w.note}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <div>
                <h3 className="type-h3">{R.method.sources}</h3>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-2">
                  {R.method.sourceList(r.tariff_name ?? "", r.ghi_source ?? "NASA POWER").map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </Section>
          </>
        )}

        <NextSteps id={id} owner={owner} shareUrl={shareUrl} r={r} verdictText={verdictText} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Section({ id, q, value, sub, margin, children }: { id: string; q: string; value?: string; sub?: string; margin: string[]; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-q`} className="grid grid-cols-9 gap-x-10">
      <div className="col-span-6 flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-t-2 border-ink pt-6">
          <h2 id={`${id}-q`} className="type-h2">{q}</h2>
          {value && <p className="text-[40px] leading-[46px] font-[700] [font-stretch:112%] nums">{value}</p>}
          {sub && <p className="text-ink-2">{sub}</p>}
        </header>
        {children}
      </div>
      <aside className="col-span-3 flex flex-col gap-4 pt-[30px]">
        {margin.map((m) => (
          <p key={m} className="border-l-2 border-line-strong pl-4 type-small text-muted">{m}</p>
        ))}
      </aside>
    </section>
  );
}

function Rows({ rows, total }: { rows: [string, string][]; total?: boolean }) {
  return (
    <table className="w-full nums">
      <tbody>
        {rows.map(([k, v], i) => {
          const last = total && i === rows.length - 1;
          return (
            <tr key={k} className={last ? "border-t-2 border-ink font-semibold" : "border-t border-line"}>
              <th className={`py-2 pr-4 text-left ${last ? "" : "font-normal text-ink-2"}`}>{k}</th>
              <td className="py-2 text-right whitespace-nowrap">{v}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-2">
      <dt className="type-small text-muted">{label}</dt>
      <dd className="text-[20px] font-[680] leading-7">{value}</dd>
    </div>
  );
}

/** Two printed bill slips: today and with solar, same lines, so the difference is obvious. */
function BillSlips({ r }: { r: Analysis }) {
  const { t } = useLang();
  const b = t.report.bill;
  const a = r.bill_now!, s = r.bill_with_solar!;
  const lines: [string, number, number, boolean?][] = [
    [b.rows[0], a.units, s.units],
    [b.rows[1], a.energy, s.energy],
    [b.rows[2], a.fixed, s.fixed],
    [b.rows[3], a.ppac, s.ppac],
    [b.rows[4], a.surcharges_and_tax, s.surcharges_and_tax],
    [b.rows[5], -a.state_subsidy, -s.state_subsidy],
  ];
  const slip = (title: string, which: 0 | 1, tone: string) => (
    <div className={`rounded-[var(--radius-slip)] border border-line bg-surface p-5 shadow-[var(--shadow-panel)] ${tone}`}>
      <p className="font-semibold">{title}</p>
      <dl className="mt-3 flex flex-col gap-1.5 type-small nums">
        {lines.map(([k, x, y], i) => {
          const v = which === 0 ? x : y;
          return (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5">
              <dt className="text-ink-2">{k}</dt>
              <dd>{i === 0 ? num(v) : v < 0 ? `−${inr(-v)}` : inr(v)}</dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-semibold">{b.rows[6]}</span>
        <span className="text-[26px] font-[700] nums">{inr(which === 0 ? a.payable : s.payable)}</span>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-5">
        {slip(b.now, 0, "")}
        {slip(b.withSolar, 1, "ring-2 ring-marigold")}
      </div>
      <p className="flex items-center gap-2 self-end rounded-full bg-marigold-soft px-4 py-1.5 font-semibold text-marigold-text">
        <CheckCircle weight="fill" aria-hidden="true" /> {b.saves(r.monthly_saving ?? 0)}
      </p>
    </div>
  );
}

function ReportActions({ r, verdictText, shareUrl }: { r: Analysis; verdictText: string; shareUrl: string }) {
  const { t, lang } = useLang();
  const speak = useSpeech();
  const [copied, setCopied] = useState(false);
  const text = t.report.speech(r, verdictText);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" aria-pressed={speak.state !== "idle"} onClick={() => speak.toggle(lang, text)}
        icon={speak.state === "idle" ? <SpeakerHigh size={20} aria-hidden="true" /> : <Stop size={20} weight="fill" aria-hidden="true" />}>
        {speak.state === "idle" ? t.report.next.listen : t.report.next.stop}
      </Button>
      <Button variant="secondary" icon={<ShareNetwork size={20} aria-hidden="true" />} onClick={async () => {
        try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked */ }
      }}>
        {copied ? t.report.next.copied : t.report.next.copyLink}
      </Button>
      <span className="sr-only" aria-live="polite">{copied ? t.report.next.copied : ""}</span>
    </div>
  );
}

function NextSteps({ id, owner, shareUrl, r, verdictText }: { id: string; owner: boolean; shareUrl: string; r: Analysis; verdictText: string }) {
  const { t } = useLang();
  const N = t.report.next;
  const msg = N.shareMessage(verdictText, r.monthly_saving ?? 0, r.payback_years ?? null, shareUrl);
  return (
    <section aria-labelledby="next-q" className="grid grid-cols-9 gap-x-10">
      <div className="col-span-9 flex flex-col gap-6 border-t-2 border-ink pt-6">
        <h2 id="next-q" className="type-h2">{N.title}</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-ink p-6 text-paper">
            <h3 className="type-h3">{N.quote}</h3>
            <p className="text-paper/80">{N.quoteText}</p>
            <ButtonLink to={`/quote?report=${id}`} className="mt-auto self-start">{N.quote}</ButtonLink>
          </div>
          <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
            <h3 className="type-h3">{N.process}</h3>
            <p className="text-ink-2">{N.processText}</p>
            <ButtonLink to="/how-it-works" variant="secondary" className="mt-auto self-start">{N.process}</ButtonLink>
          </div>
          <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
            <h3 className="type-h3">{N.share}</h3>
            <p className="text-ink-2">{N.shareText}</p>
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
              className="mt-auto inline-flex h-12 items-center gap-2 self-start rounded-[var(--radius-button)] border border-ink/80 px-5 font-semibold text-ink no-underline hover:bg-ink hover:text-paper">
              <WhatsappLogo size={20} aria-hidden="true" /> {N.whatsapp}
            </a>
          </div>
        </div>
        <div className="flex gap-6">
          {owner ? (
            <Link to="/bill/check" viewTransition className="inline-flex items-center gap-2 font-medium">
              <ArrowsClockwise aria-hidden="true" /> {N.change}
            </Link>
          ) : (
            <Link to="/bill" viewTransition className="font-medium">{N.own}</Link>
          )}
          <Link to="/" viewTransition className="font-medium" onClick={() => sessionStorage.removeItem("solarsaathi.flow")}>{t.common.startOver}</Link>
        </div>
      </div>
    </section>
  );
}

function ReportSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1280px] animate-pulse grid-cols-12 gap-x-10 px-8 pb-24 pt-10" aria-busy="true">
      <div className="col-span-3 flex flex-col gap-3 border-l border-line pl-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 w-32 rounded bg-line/70" />)}
      </div>
      <div className="col-span-6 flex flex-col gap-5">
        <div className="h-4 w-40 rounded bg-line/70" />
        <div className="h-14 w-full rounded bg-line/70" />
        <div className="h-14 w-4/5 rounded bg-line/70" />
        <div className="h-6 w-full rounded bg-line/60" />
        <div className="h-6 w-5/6 rounded bg-line/60" />
      </div>
      <div className="col-span-3"><div className="h-40 rounded-[var(--radius-meter)] bg-line/70" /></div>
    </div>
  );
}

/** Highlight the rail entry for the section in view. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids.join(",")]);
  return active;
}

/** Read aloud with Amazon Polly; tap again to stop. Falls back to the browser's own voice. */
function useSpeech() {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const stop = () => {
    token.current += 1;
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
    setState("idle");
  };
  const fallback = (lang: string, text: string) => {
    if (!window.speechSynthesis) return setState("idle");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    u.onend = u.onerror = () => setState("idle");
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setState("playing");
  };
  const play = async (lang: string, text: string) => {
    const mine = ++token.current;
    setState("loading");
    try {
      const { audio: data, contentType } = await speech(text, lang);
      if (mine !== token.current) return;
      const a = new Audio(`data:${contentType};base64,${data}`);
      a.onended = () => { if (audio.current === a) stop(); };
      audio.current = a;
      await a.play();
      setState("playing");
    } catch {
      if (mine === token.current) fallback(lang, text);
    }
  };
  useEffect(() => stop, []);
  return { state, toggle: (lang: string, text: string) => (state === "idle" ? play(lang, text) : stop()) };
}

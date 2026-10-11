// Hand-built SVG charts for the report. Colour has one meaning: marigold/solar = from your roof,
// cobalt/grid = from the grid. Every chart has a text readout on hover AND keyboard focus, and
// a table view, so nothing depends on colour or a mouse.
import { useRef, useState, type ReactNode } from "react";
import { useLang } from "../../i18n";
import { inr, num, inrShort } from "../../lib/format";
import type { Analysis, MonthRow, Scenario, YearPoint } from "../../types/api";

export const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"],
};

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(v || 1)); // 608 -> 100s -> 700, not 1,000
  return Math.ceil(v / step) * step;
}

export function TableToggle({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="type-small text-muted underline underline-offset-4 hover:text-ink">
        {open ? t.common.hideTable : t.common.seeTable}
      </button>
      {open && <div className="mt-3 overflow-x-auto">{children}</div>}
    </div>
  );
}

export function Legend({ items }: { items: { swatch: ReactNode; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 type-small text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          {it.swatch}
          {it.label}
        </li>
      ))}
    </ul>
  );
}
export const Swatch = ({ cls }: { cls: string }) => <span aria-hidden="true" className={`inline-block size-3 rounded-[3px] ${cls}`} />;

/* ---------------------------------------------------------------- month strip */

export function MonthStrip({ months, limit }: { months: MonthRow[]; limit: number | null }) {
  const { t, lang } = useLang();
  const b = t.report.bill;
  const [active, setActive] = useState<number | null>(null);
  const W = 640, H = 250, L = 40, R = 8, T = 18, B = 26;
  const max = niceMax(Math.max(...months.map((m) => m.use), limit ?? 0) * 1.08);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / 12;
  const bw = band * 0.6;
  const names = MONTHS[lang];
  const tip = (m: MonthRow) =>
    b.monthTip(names[m.month - 1], m.use, Math.min(m.solar, m.use), m.grid, inr(m.with_solar)) +
    (m.sun != null ? ` ${b.sunTip(m.sun)}` : "") + (m.from_bills === false ? ` ${b.averageMonth}` : "");
  const someAverage = months.some((m) => m.from_bills === false) && months.some((m) => m.from_bills);

  return (
    <figure className="flex flex-col gap-3">
      <Legend items={[{ swatch: <Swatch cls="bg-solar" />, label: b.fromRoof }, { swatch: <Swatch cls="bg-grid" />, label: b.fromGrid }]} />
      <p className="min-h-[26px] type-small nums text-ink-2" aria-live="polite">
        {active != null ? tip(months[active]) : <span className="text-muted">{b.tapMonth}</span>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={b.monthsTitle} onMouseLeave={() => setActive(null)}>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v ? "var(--color-line)" : "var(--color-muted)"} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] nums">{num(v)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const x = L + i * band + (band - bw) / 2;
          const solar = Math.min(m.solar, m.use);
          const gTop = y(m.grid);
          const sTop = y(m.grid + solar);
          const gap = m.grid > 0 && solar > 0 ? 2 : 0;
          const dim = active != null && active !== i;
          return (
            <g
              key={m.month}
              tabIndex={0}
              role="img"
              aria-label={tip(m)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none [&:focus-visible>rect.hit]:stroke-grid"
              style={{ opacity: dim ? 0.45 : 1, transition: "opacity 150ms" }}
            >
              <rect className="hit" x={L + i * band + 1} y={T} width={band - 2} height={H - T - B} fill="transparent" stroke="transparent" strokeWidth={2} rx={4} />
              {m.grid > 0 && <rect x={x} y={gTop} width={bw} height={y(0) - gTop} fill="var(--color-grid)" rx={solar > 0 ? 0 : 3} />}
              {solar > 0 && <path d={roundTop(x, sTop, bw, gTop - sTop - gap, 3)} fill="var(--color-solar)" />}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${m.from_bills === false && someAverage ? "fill-muted/60 italic" : "fill-muted"}`}>
                {names[i]}{m.from_bills === false && someAverage ? "*" : ""}
              </text>
            </g>
          );
        })}
        {limit && limit < max && (
          <g pointerEvents="none">
            <line x1={L} x2={W - R} y1={y(limit)} y2={y(limit)} stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={W - R} y={y(limit) - 6} textAnchor="end" className="fill-ink text-[12px] font-semibold" paintOrder="stroke" stroke="var(--color-paper)" strokeWidth={4}>
              {b.freeLine(limit)}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="type-small text-muted">{b.monthsNote(limit)}{someAverage ? ` ${b.averageNote}` : ""}</figcaption>
      <TableToggle>
        <table className="w-full type-small nums">
          <thead><tr className="text-left text-muted">{b.tableHead.map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <th className="py-1 pr-3 text-left font-medium">{names[m.month - 1]}{m.from_bills === false && someAverage ? "*" : ""}</th>
                <td className="pr-3">{m.sun != null ? num(m.sun, 2) : "—"}</td>
                <td className="pr-3">{num(m.use)}</td><td className="pr-3">{num(Math.min(m.solar, m.use))}</td><td className="pr-3">{num(m.grid)}</td><td>{inr(m.with_solar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableToggle>
    </figure>
  );
}

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ---------------------------------------------------------------- horizontal bars */

export function HBars({ rows, max }: { rows: { label: string; value: number; text: string; cls: string }[]; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(150px,auto)_1fr] items-center gap-4">
          <span className="type-small text-ink-2">{r.label}</span>
          <div className="flex items-center gap-3">
            <span className="h-5 flex-1 overflow-hidden rounded-[4px] bg-line/50">
              <span className={`block h-full rounded-r-[4px] ${r.cls}`} style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%` }} />
            </span>
            <span className="w-[8.5rem] shrink-0 text-right font-semibold nums">{r.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- roof diagram */

/** A terrace seen from above, with the panels drawn roughly to scale (545 W ≈ 2.3 m × 1.1 m). */
export function RoofDiagram({ panels, caption }: { panels: number; caption: string }) {
  const perRow = panels <= 6 ? panels : Math.ceil(panels / Math.ceil(panels / 6));
  const rows = Math.ceil(panels / perRow);
  const pw = 34, ph = 70, gap = 6;
  const arrayW = perRow * pw + (perRow - 1) * gap;
  const arrayH = rows * ph + (rows - 1) * 14;
  const W = Math.max(300, arrayW + 140), H = arrayH + 90;
  const ox = 30, oy = (H - arrayH) / 2;
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]" role="img" aria-label={caption}>
        <rect x="4" y="4" width={W - 8} height={H - 8} rx="6" fill="#eef0eb" stroke="var(--color-line-strong)" strokeWidth="3" />
        <rect x={W - 74} y="18" width="48" height="48" rx="24" fill="#dfe3dc" stroke="var(--color-line-strong)" />
        {Array.from({ length: panels }).map((_, i) => {
          const r = Math.floor(i / perRow), c = i % perRow;
          const x = ox + c * (pw + gap), y = oy + r * (ph + 14);
          return (
            <g key={i}>
              <rect x={x} y={y} width={pw} height={ph} rx="2" fill="var(--color-ink)" />
              {[1, 2, 3, 4, 5].map((k) => <line key={k} x1={x + 2} x2={x + pw - 2} y1={y + (ph / 6) * k} y2={y + (ph / 6) * k} stroke="#3c5079" strokeWidth="1" />)}
              <line x1={x + pw / 2} x2={x + pw / 2} y1={y + 2} y2={y + ph - 2} stroke="#3c5079" strokeWidth="1" />
            </g>
          );
        })}
      </svg>
      <figcaption className="type-small text-muted">{caption}</figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------- cost waterfall */

export function CostWaterfall({ r }: { r: Analysis }) {
  const { t } = useLang();
  const c = t.report.cost;
  const W = 600, H = 250, L = 10, T = 40, B = 34;
  const top = Math.max(r.cost_high ?? 0, 1) * 1.05;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const col = (W - L * 2) / 3, bw = 120;
  const cx = (i: number) => L + col * i + col / 2;
  const mid = r.cost_mid ?? 0, net = r.net_cost ?? 0, sub = (r.central_subsidy ?? 0) + (r.state_incentive ?? 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${c.steps[0]} ${inr(r.cost_low)}–${inr(r.cost_high)}, ${c.steps[1]} −${inr(sub)}, ${c.steps[2]} ${inr(net)}`}>
        <line x1={L} x2={W - L} y1={y(0)} y2={y(0)} stroke="var(--color-muted)" />
        {/* market price: bar to the middle of the range, whisker for the range */}
        <rect x={cx(0) - bw / 2} y={y(mid)} width={bw} height={y(0) - y(mid)} rx="4" fill="var(--color-ink-2)" />
        <line x1={cx(0)} x2={cx(0)} y1={y(r.cost_high ?? mid)} y2={y(r.cost_low ?? mid)} stroke="var(--color-ink)" strokeWidth="2" />
        {[r.cost_high, r.cost_low].map((v, i) => <line key={i} x1={cx(0) - 14} x2={cx(0) + 14} y1={y(v ?? mid)} y2={y(v ?? mid)} stroke="var(--color-ink)" strokeWidth="2" />)}
        <text x={cx(0)} y={y(r.cost_high ?? mid) - 10} textAnchor="middle" className="fill-ink text-[13px] font-semibold nums">{inr(r.cost_low)} – {inr(r.cost_high)}</text>
        {/* subsidy: a step down from the middle of the range */}
        <line x1={cx(0) + bw / 2} x2={cx(1) - bw / 2} y1={y(mid)} y2={y(mid)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
        {sub > 0 && <rect x={cx(1) - bw / 2} y={y(mid)} width={bw} height={y(net) - y(mid)} rx="4" fill="var(--color-marigold-soft)" stroke="var(--color-marigold)" strokeWidth="1.5" />}
        <text x={cx(1)} y={sub > 0 ? (y(mid) + y(net)) / 2 + 5 : y(mid) - 10} textAnchor="middle" className="fill-marigold-text text-[15px] font-bold nums">−{inr(sub)}</text>
        <line x1={cx(1) + bw / 2} x2={cx(2) - bw / 2} y1={y(net)} y2={y(net)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
        {/* you pay */}
        <rect x={cx(2) - bw / 2} y={y(net)} width={bw} height={y(0) - y(net)} rx="4" fill="var(--color-ink)" />
        <text x={cx(2)} y={y(net) - 10} textAnchor="middle" className="fill-ink text-[16px] font-bold nums">{inr(net)}</text>
        {c.steps.map((s, i) => <text key={s} x={cx(i)} y={H - 10} textAnchor="middle" className="fill-ink-2 text-[13px]">{s}</text>)}
      </svg>
    </figure>
  );
}

/* ---------------------------------------------------------------- payback */

export function PaybackChart({ r }: { r: Analysis }) {
  const { t } = useLang();
  const p = t.report.payback;
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const expected = r.lifetime!.years;
  const scenarios: Scenario[] = r.scenarios?.length ? r.scenarios : [{ growth_pct: r.assumptions?.tariff_growth_pct ?? 3, payback_years: r.payback_years ?? null, net_25: r.lifetime_savings ?? 0, years: expected }];
  const exp = scenarios.find((s) => s.growth_pct === (r.assumptions?.tariff_growth_pct ?? 3)) ?? scenarios[0];
  const all = scenarios.flatMap((s) => s.years.map((y) => y.cumulative));
  const W = 640, H = 300, L = 58, R = 14, T = 20, B = 30;
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const n = expected.length - 1;
  const x = (yr: number) => L + (W - L - R) * (yr / n);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const path = (pts: YearPoint[]) => pts.map((q, i) => `${i ? "L" : "M"}${x(q.year).toFixed(1)},${y(q.cumulative).toFixed(1)}`).join("");
  const pb = exp.payback_years;
  const invYear = r.assumptions?.inverter_year ?? 12;
  const yTicks = [lo, 0, hi / 2, hi].filter((v, i, a) => a.indexOf(v) === i);

  const pick = (clientX: number) => {
    const box = svg.current!.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    setActive(Math.max(0, Math.min(n, Math.round(((px - L) / (W - L - R)) * n))));
  };
  const fmt = (v: number) => inrShort(v, t.common.lakh);
  const readout = (yr: number) =>
    p.tip(yr, scenarios.map((s) => `${p.lines[s.growth_pct] ?? `${s.growth_pct}%`}: ${fmt(s.years[yr].cumulative)}`).join(" · "));

  return (
    <figure className="flex flex-col gap-3">
      <Legend
        items={scenarios.map((s) => ({
          swatch: <svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" stroke={s === exp ? "var(--color-grid)" : "var(--color-muted)"} strokeWidth={s === exp ? 3 : 1.5} strokeDasharray={s === exp ? undefined : "4 3"} /></svg>,
          label: p.lines[s.growth_pct] ?? `${s.growth_pct}%`,
        }))}
      />
      <p className="min-h-[26px] type-small nums text-ink-2" aria-live="polite">
        {active != null ? readout(active) : <span className="text-muted">{p.point}</span>}
      </p>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none outline-none focus-visible:outline-[3px] focus-visible:outline-grid"
        tabIndex={0}
        role="img"
        aria-label={`${p.explain(r.net_cost ?? 0)} ${pb ? p.value(pb) : ""}`}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(n, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? 1) - 1));
        }}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--color-ink)" : "var(--color-line)"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] nums">{fmt(v)}</text>
          </g>
        ))}
        <text x={W - R} y={y(0) - 7} textAnchor="end" className="fill-ink text-[12px] font-semibold">{p.zero}</text>
        {[0, 5, 10, 15, 20, 25].filter((v) => v <= n).map((v) => (
          <text key={v} x={x(v)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px] nums">{v}</text>
        ))}
        {scenarios.filter((s) => s !== exp).map((s) => (
          <path key={s.growth_pct} d={path(s.years)} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
        ))}
        <path d={path(exp.years)} fill="none" stroke="var(--color-grid)" strokeWidth="3" strokeLinejoin="round" />
        {invYear <= n && (
          <text x={x(invYear)} y={y(exp.years[invYear].cumulative) + 22} textAnchor="middle" className="fill-muted text-[11px]">{p.inverter}</text>
        )}
        {pb != null && pb <= n && (
          <g>
            <circle cx={x(pb)} cy={y(0)} r="7" fill="var(--color-good)" stroke="var(--color-surface)" strokeWidth="3" />
            <text x={x(pb) + 12} y={y(0) + 22} className="fill-ink text-[13px] font-semibold">{p.value(pb)}</text>
          </g>
        )}
        {active != null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} stroke="var(--color-muted)" strokeDasharray="2 3" />
            <circle cx={x(active)} cy={y(exp.years[active].cumulative)} r="5" fill="var(--color-grid)" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      <p className="type-small text-muted">{p.yearAxis}</p>
      <TableToggle>
        <table className="w-full type-small nums">
          <thead><tr className="text-left text-muted">{p.tableHead.map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {expected.filter((q) => q.year % 5 === 0 || q.year === invYear).map((q) => (
              <tr key={q.year} className="border-t border-line">
                <th className="py-1 pr-3 text-left font-medium">{q.year}</th>
                {[0, 3, 5].map((g) => <td key={g} className="pr-3">{inr(scenarios.find((s) => s.growth_pct === g)?.years[q.year].cumulative ?? null)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </TableToggle>
    </figure>
  );
}

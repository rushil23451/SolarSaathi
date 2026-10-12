// A 3D picture of a flat roof with solar panels on it, drawn with CSS 3D transforms (no 3D
// library, so it stays light on cheap phones). Used twice: on the location page as a preview of
// how many panels fit the chosen roof size, and in the report with the recommended panels.
//
// It moves: the house swings into view and sways, a sun crosses the sky, energy flows from the
// panels to the inverter, and in the report it plays through the year, so the panels glow, the
// sun rides and the flow runs in step with each month's real output. Panel figures are the
// backend's system totals divided by the number of panels; nothing about money or energy is
// calculated here.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Lightning } from "@phosphor-icons/react";
import { useLang } from "../i18n";
import { inr, num } from "../lib/format";
import { MONTHS } from "./report/charts";
import type { Analysis, Roof } from "../types/api";

const PANEL_W = 2.28, PANEL_D = 1.13; // a 545 W panel lying landscape, metres
const CELL_W = 2.3, CELL_D = 2.2;     // roof per panel incl. the gap that stops rows shading each other:
const CELL_M2 = CELL_W * CELL_D;      // 5.06 m², the backend's 100 sq ft per kW at 545 W
const EDGE = 0.6;                     // walkway along the parapet
const SQFT_PER_M2 = 10.764;
const PANEL_KW = 0.545;
const MONTH_MS = 1100;                // how long "Play the year" stays on each month

/** Roof area behind each choice on the location page (the top of each range). */
export const ROOF_SQFT: Record<Exclude<Roof, "unknown">, number> = { small: 150, medium: 300, large: 600 };
// The report only carries the roof limit in kW (roof_limits_kw in solar.json: 1.5, 3, 10).
const roofFromLimit = (k: number | null | undefined): Exclude<Roof, "unknown"> | null =>
  k == null ? null : k <= 1.5 ? "small" : k <= 3 ? "medium" : "large";

const slotsFor = (sqft: number) => Math.max(1, Math.round(sqft / SQFT_PER_M2 / CELL_M2));

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Panel positions on a roof just big enough for `slots` panels, filled from the front (south) row back. */
function layoutRoof(slots: number) {
  const cols = Math.ceil(Math.sqrt(slots));
  const rows = Math.ceil(slots / cols);
  const W = cols * CELL_W + 2 * EDGE, D = rows * CELL_D + 2 * EDGE;
  const cells = Array.from({ length: slots }, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, slots - row * cols);
    return {
      row,
      x: EDGE + ((cols - inRow) * CELL_W) / 2 + col * CELL_W + (CELL_W - PANEL_W) / 2,
      y: D - EDGE - (row + 1) * CELL_D + (CELL_D - PANEL_D) / 2,
    };
  });
  return { W, D, cells };
}

/** Each panel's share of the system figures the backend returned. */
function perPanel(r: Analysis, p: number) {
  const solar = (r.months ?? []).map((m) => m.solar); // what the panels make, incl. any surplus
  const best = solar.length ? solar.indexOf(Math.max(...solar)) : -1;
  const worst = solar.length ? solar.indexOf(Math.min(...solar)) : -1;
  return {
    solar, // whole system, per calendar month
    month: (r.solar_units_month ?? 0) / p,
    year: ((r.solar_units_month ?? 0) * 12) / p,
    best: best >= 0 ? ([best, solar[best] / p] as const) : null,
    worst: worst >= 0 ? ([worst, solar[worst] / p] as const) : null,
    saving: (r.annual_benefit ?? 0) / p,
    life: r.lifetime ? r.lifetime.total_saved / p : null,
    // from unrounded units (co2_tonnes_year is rounded to 0.1 t, ~2% off per panel)
    co2: r.assumptions ? ((r.solar_units_month ?? 0) * 12 * r.assumptions.emission_kg_per_unit) / p : ((r.co2_tonnes_year ?? 0) * 1000) / p,
    // a free slot would hold a real 545 W panel: what that makes here, per month
    extra: ((r.size?.yield_per_kw_year ?? 0) * PANEL_KW) / 12,
  };
}

/** Animates a number from where it was (0 at first) to `target`. */
function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const v = a + (target - a) * (1 - (1 - k) ** 3);
      from.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

type Props = { roof: Exclude<Roof, "unknown">; r?: undefined } | { r: Analysis; roof?: undefined };

export function Roof3D(props: Props) {
  const { t, lang } = useLang();
  const L = t.roof3d;
  const r = props.r;
  const choice = r ? roofFromLimit(r.size?.roof_limit_kw) : props.roof!;
  // "Large" only means more than 300 sq ft, so the report never claims a size for it (or free slots
  // on it); the location-page preview draws an example large roof and says so.
  const sqft = choice && !(r && choice === "large") ? ROOF_SQFT[choice] : null;
  const panels = r ? r.size!.panels : slotsFor(sqft!);
  const slots = Math.max(panels, sqft ? slotsFor(sqft) : panels);
  const { W, D, cells } = layoutRoof(slots);
  const each = r ? perPanel(r, panels) : null;
  const solar = each?.solar ?? [];
  const peak = Math.max(1, ...solar);

  const [active, setActive] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const [turn, setTurn] = useState(-32);
  const [still, setStill] = useState(false); // stop the idle sway once the person takes over
  const [month, setMonth] = useState<number | null>(null);
  const [playing, setPlaying] = useState(() => solar.length === 12 && !reducedMotion());
  const drag = useRef<{ x: number; turn: number; moved: boolean } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  // "Play the year": step through the months until the person picks a month or a panel.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setMonth((m) => (m == null ? 0 : (m + 1) % 12)), MONTH_MS);
    return () => clearInterval(id);
  }, [playing]);

  const s = Math.min(42, 250 / Math.max(W, D)); // pixels per metre
  const px = (m: number) => `${(m * s).toFixed(1)}px`;
  const wallH = Math.min(3 * s, 76);
  const lip = Math.max(4, 0.35 * s);
  // The report's system size; on the location page, the backend's rule of 100 sq ft per kW.
  const kwp = r ? r.system_kw! : sqft! / 100;
  const usedSqft = r ? r.size!.roof_sqft : panels * CELL_M2 * SQFT_PER_M2;

  // 0.3–1: how strong this month is against the best month. Drives glow, sun height and flow speed.
  const power = month == null ? 1 : Math.max(0.3, solar[month] / peak);
  const chipTarget = !each ? panels : month == null ? r!.solar_units_month ?? 0 : solar[month];
  const chip = useCountUp(chipTarget, month == null ? 900 : 500);

  const where = (e: { clientX: number; clientY: number }) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    // keep the card inside the picture: it is about 180 px wide and sits above the pointer
    return { x: Math.min(Math.max(e.clientX - box.left, 96), box.width - 96), y: Math.max(e.clientY - box.top, 132) };
  };
  const onDown = (e: PointerEvent) => { drag.current = { x: e.clientX, turn, moved: false }; };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 4) { d.moved = true; setStill(true); setTip(null); }
      if (d.moved) return setTurn(Math.max(-85, Math.min(85, d.turn + dx * 0.5)));
    }
    if (active != null && active < panels && e.pointerType === "mouse") setTip(where(e));
  };
  const onUp = () => { drag.current = null; };
  const pick = (i: number) => (e: PointerEvent | { clientX: number; clientY: number }) => {
    if (drag.current?.moved || !each) return;
    setActive(i);
    setStill(true);
    setPlaying(false);
    setTip(i < panels ? where(e) : null);
  };
  const focusPanel = (i: number) => {
    if (!each) return;
    setActive(i);
    setPlaying(false);
    const box = stage.current?.getBoundingClientRect();
    setTip(i < panels && box ? { x: box.width / 2, y: box.height * 0.3 } : null);
  };
  const chooseMonth = (m: number) => { setPlaying(false); setMonth(m); };

  // The text under the picture: the selected panel in full, else the roof summary and the month.
  let info: ReactNode;
  if (!each) {
    info = <p>{choice === "large" ? L.previewLarge(panels) : L.preview(L.sizes[choice!], sqft!, kwp, panels)}</p>;
  } else if (active != null && active >= panels) {
    info = <p>{L.ghost(each.extra)}</p>;
  } else if (active != null) {
    const rows: [string, string][] = [
      [L.power, "545 W"],
      [L.perMonth, L.units(each.month)],
      ...(each.best && each.worst
        ? [[L.range, `${MONTHS[lang][each.best[0]]} ${num(each.best[1])} · ${MONTHS[lang][each.worst[0]]} ${L.units(each.worst[1])}`] as [string, string]]
        : []),
      [L.perYear, L.units(each.year)],
      [L.saves, L.perYearInr(inr(each.saving))],
      ...(each.life != null ? [[L.life, inr(each.life)] as [string, string]] : []),
      [L.co2, L.kgYear(each.co2)],
    ];
    info = (
      <>
        <p className="font-semibold">{L.panel(active + 1, panels)}</p>
        <table className="w-full nums">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-4 text-left font-normal text-ink-2">{k}</th>
                <td className="py-1.5 text-right">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="type-small text-muted">{L.note}</p>
      </>
    );
  } else {
    info = (
      <>
        <p>{L.summary(panels, kwp, usedSqft, sqft, slots - panels)} <span className="text-muted">{L.tapHint}</span></p>
        {month != null && <p className="nums text-ink">{L.monthLine(MONTHS[lang][month], solar[month] / panels, solar[month], panels, r!.months![month].use)}</p>}
      </>
    );
  }

  // Wires: one along the front of each row of panels, a trunk down the right edge, the inverter
  // in the front-right corner.
  const trunkX = W - EDGE / 2, invY = D - EDGE / 2;
  const rowWires = Array.from(new Set(cells.slice(0, panels).map((c) => c.row))).map((row) => {
    const inRow = cells.slice(0, panels).filter((c) => c.row === row);
    return { row, x: Math.min(...inRow.map((c) => c.x)) + PANEL_W / 2, y: inRow[0].y + PANEL_D + 0.2 };
  });
  const trunkTop = Math.min(...rowWires.map((w) => w.y));

  const wall = (cls: string, style: CSSProperties, label?: string) => (
    <div className={`roof3d-wall ${cls}`} style={style}>{label && <span className="roof3d-compass">{label}</span>}</div>
  );

  return (
    <figure className="flex flex-col gap-3">
      <div
        ref={stage}
        className={`roof3d-stage${still ? " still" : ""}`}
        style={{ "--power": power.toFixed(2), "--sun-r": `${Math.round(170 + 95 * power)}px` } as CSSProperties}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={(e) => { onUp(); if (e.pointerType === "mouse") { setActive(null); setTip(null); } }}
      >
        <div className="roof3d-sunpath" aria-hidden="true"><div className="roof3d-sun" /></div>

        <div className="roof3d-camera">
          <div className="roof3d-scene" style={{ width: px(W), height: px(D), transform: `translate(-50%, -50%) rotateX(56deg) rotateZ(${turn}deg)` }}>
            <div className="roof3d-ground" style={{ left: px(-W * 0.35), top: px(-D * 0.35), width: px(W * 1.7), height: px(D * 1.7), transform: `translateZ(${-wallH}px)` }} />
            {wall("front", { left: 0, top: px(D), width: px(W), height: wallH }, L.south)}
            {wall("back", { left: 0, top: 0, width: px(W), height: wallH })}
            {wall("left", { left: 0, top: 0, width: wallH, height: px(D) })}
            {wall("right", { left: px(W), top: 0, width: wallH, height: px(D) })}
            <div className="roof3d-top" style={{ width: px(W), height: px(D) }} />
            <div className="roof3d-lip front" style={{ left: 0, top: px(D), width: px(W), height: lip }} />
            <div className="roof3d-lip back" style={{ left: 0, top: 0, width: px(W), height: lip }} />
            <div className="roof3d-lip left" style={{ left: 0, top: 0, width: lip, height: px(D) }} />
            <div className="roof3d-lip right" style={{ left: px(W), top: 0, width: lip, height: px(D) }} />

            {rowWires.map((w) => (
              <div key={w.row} className="roof3d-wire" style={{ left: px(w.x), top: px(w.y), width: px(trunkX - w.x), height: 3 }} />
            ))}
            <div className="roof3d-wire trunk" style={{ left: px(trunkX), top: px(trunkTop), width: 3, height: px(invY - trunkTop) }} />
            <div className="roof3d-inverter" style={{ left: px(trunkX - 0.32), top: px(invY - 0.32), width: px(0.64), height: px(0.64) }}><Lightning weight="fill" aria-hidden="true" /></div>

            {cells.map((c, i) => {
              const pos = { left: px(c.x), top: px(c.y), width: px(PANEL_W), height: px(PANEL_D) };
              if (i >= panels) {
                return (
                  <button key={i} type="button" className={`roof3d-ghost${active === i ? " on" : ""}`} style={pos}
                    aria-label={each ? L.ghost(each.extra) : L.free} disabled={!each}
                    onPointerEnter={pick(i)} onClick={pick(i)} onFocus={() => focusPanel(i)} />
                );
              }
              return (
                <div key={i} className="roof3d-slot" style={{ ...pos, animationDelay: `${600 + i * 110}ms` }}>
                  <div className="roof3d-shadow" />
                  <button type="button" className={`roof3d-panel${active === i ? " on" : ""}`} tabIndex={each ? 0 : -1}
                    style={{ "--glint": `${(i % 4) * 0.35}s` } as CSSProperties}
                    aria-label={L.panel(i + 1, panels)}
                    onPointerEnter={pick(i)} onClick={pick(i)} onFocus={() => focusPanel(i)} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="roof3d-chip nums" aria-hidden="true">
          {each ? (
            <>
              <b>{L.units(chip)}</b>
              <span>{month == null ? L.chipAvg : L.chipMonth(MONTHS[lang][month])}</span>
            </>
          ) : (
            <>
              <b>{L.chipPanels(Math.round(chip))}</b>
              <span>≈ {num(kwp, 1)} kW</span>
            </>
          )}
        </div>

        {each && active != null && active < panels && tip && (
          <PanelTip key={active} at={tip} i={active} total={panels} month={month} each={each} />
        )}

        <span className="roof3d-hint type-small">{each ? L.hint : L.turn}</span>
      </div>

      {solar.length === 12 && (
        <div className="roof3d-year">
          <button type="button" className="roof3d-play" onClick={() => { setActive(null); setTip(null); setPlaying(!playing); }}
            aria-pressed={playing} aria-label={playing ? L.pause : L.play}>
            {playing ? "❚❚" : "▶"} <span>{playing ? L.pause : L.play}</span>
          </button>
          <div className="roof3d-months" role="group" aria-label={L.yearLabel}>
            {solar.map((v, m) => (
              <button key={m} type="button" className={month === m ? "on" : ""} aria-pressed={month === m}
                aria-label={`${MONTHS[lang][m]}: ${L.units(v)}`} onClick={() => chooseMonth(m)}>
                <i style={{ height: `${Math.max(4, Math.round((v / peak) * 38))}px` }} />
                <span>{MONTHS[lang][m]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <figcaption className="flex min-h-12 flex-col gap-1 text-ink-2" aria-live="polite">{info}</figcaption>
    </figure>
  );
}

/** The card that pops out next to a panel, with its numbers counting up. */
function PanelTip({ at, i, total, month, each }: {
  at: { x: number; y: number };
  i: number;
  total: number;
  month: number | null;
  each: NonNullable<ReturnType<typeof perPanel>>;
}) {
  const { t, lang } = useLang();
  const L = t.roof3d;
  const units = useCountUp(month == null ? each.month : each.solar[month] / total);
  const saving = useCountUp(each.saving);
  const co2 = useCountUp(each.co2);
  return (
    <div className="roof3d-tip nums" style={{ left: at.x, top: at.y }} aria-hidden="true">
      <p className="roof3d-tip-title">{L.panel(i + 1, total)}</p>
      <p><b>{num(units)}</b> {month == null ? L.tipAvg : L.tipMonth(MONTHS[lang][month])}</p>
      <p><b>{inr(saving)}</b> {L.tipSave}</p>
      <p><b>{num(co2)}</b> {L.tipCo2}</p>
    </div>
  );
}

// The result screen: the verdict, the key numbers, and one card per metric with a plain
// explanation, a tap-to-open breakdown and, where it helps, a chart.
import { useEffect, useRef, useState } from "react";
import { inr, t } from "./i18n.js";
import { ex, MONTHS } from "./explain.js";
import { post } from "./api.js";

function Stat({ label, value }) {
  return <div className="stat"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}

// Read the result aloud with Amazon Polly; tap again to stop. Falls back to the device's own
// voice when Polly isn't available (e.g. running locally).
function useSpeech() {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const audio = useRef(null);
  const token = useRef(0);

  const stop = () => {
    token.current += 1;
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
    setState("idle");
  };

  const fallback = (lang, text) => {
    if (!window.speechSynthesis) return setState("idle");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    u.onend = u.onerror = () => setState("idle");
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setState("playing");
  };

  const play = async (lang, text) => {
    const mine = ++token.current;
    setState("loading");
    try {
      const { audio: data, contentType } = await post("/speech", { text, lang });
      if (mine !== token.current) return; // stopped while loading
      const a = new Audio(`data:${contentType};base64,${data}`);
      a.onended = () => { if (audio.current === a) stop(); };
      audio.current = a;
      await a.play();
      setState("playing");
    } catch {
      if (mine === token.current) fallback(lang, text);
    }
  };

  useEffect(() => stop, []); // stop talking when leaving the screen
  return { state, toggle: (lang, text) => (state === "idle" ? play(lang, text) : stop()) };
}

// ---------- building blocks ----------

function Metric({ lang, icon, title, value, sub, why, visual, children }) {
  return (
    <section className="metric">
      <div className="metric-head">
        <span className="metric-icon" aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {why && <p className="metric-why">{why}</p>}
      {visual}
      {children && (
        <details className="metric-more">
          <summary>{ex(lang, "tapForDetails")}</summary>
          {children}
        </details>
      )}
    </section>
  );
}

function Rows({ rows }) {
  const last = rows.length - 1;
  return (
    <table className="breakdown"><tbody>
      {rows.map(([k, v], i) => <tr key={k} className={i === last ? "total" : ""}><th>{k}</th><td>{v}</td></tr>)}
    </tbody></table>
  );
}

function BillTable({ rows }) {
  const [head, ...body] = rows;
  const last = body.length - 1;
  return (
    <table className="breakdown three">
      <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>{body.map(([k, a, b], i) => <tr key={k} className={i === last ? "total" : ""}><th>{k}</th><td>{a}</td><td>{b}</td></tr>)}</tbody>
    </table>
  );
}

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(([cls, label]) => <span key={label}><i className={`swatch ${cls}`} />{label}</span>)}
    </div>
  );
}

const short = (x) => {
  const a = Math.abs(x);
  const s = a >= 100000 ? `${(a / 100000).toFixed(a >= 1000000 ? 0 : 1)}L` : a >= 1000 ? `${Math.round(a / 1000)}k` : `${Math.round(a)}`;
  return `${x < 0 ? "−" : ""}₹${s}`;
};

function niceMax(v) {
  const step = 10 ** Math.floor(Math.log10(v || 1));
  return Math.ceil(v / step) * step;
}

// ---------- charts ----------

function CoverageBar({ lang, r }) {
  const solar = Math.max(0, Math.min(100, r.coverage_pct));
  return (
    <div>
      <div className="coverage" role="img" aria-label={ex(lang, "coverage", r)}>
        <div className="seg solar" style={{ width: `${solar}%` }}><span>{solar}%</span></div>
        {solar < 100 && <div className="seg grid" style={{ width: `${100 - solar}%` }}><span>{100 - solar}%</span></div>}
      </div>
      <Legend items={[["solar", `${ex(lang, "solar")} · ${r.solar_units_month} ${ex(lang, "units")}`],
                      ["grid", `${ex(lang, "grid")} · ${r.grid_units_month} ${ex(lang, "units")}`]]} />
    </div>
  );
}

// Each month's use as one bar: grid part (blue) at the bottom, solar part (orange) on top,
// with Delhi's free-units line for the grid part.
function MonthChart({ lang, r }) {
  const [active, setActive] = useState(null);
  const W = 340, H = 190, L = 34, R = 6, T = 14, B = 22;
  const months = r.months;
  const max = niceMax(Math.max(...months.map((m) => m.use), r.free_units_limit || 0) * 1.05);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / 12;
  const bw = band * 0.62;
  const ticks = [0, max / 2, max];
  const limit = r.free_units_limit;
  const m = active == null ? null : months[active];

  return (
    <figure className="chart">
      <Legend items={[["solar", ex(lang, "solar")], ["grid", ex(lang, "grid")]]} />
      <div className="tip" aria-live="polite">
        {m ? (
          <>
            <b>{MONTHS[lang][m.month - 1]}</b> · {ex(lang, "useCol")} {m.use} · {ex(lang, "solar")} {Math.min(m.solar, m.use)} · {ex(lang, "grid")} {m.grid} · {ex(lang, "billCol")} {inr(m.with_solar)}
          </>
        ) : <span className="muted">{lang === "hi" ? "किसी महीने पर टैप करें" : "Tap a month for details"}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ex(lang, "monthsTitle")} onMouseLeave={() => setActive(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={L - 4} y={y(v) + 3} className="axis" textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {months.map((mo, i) => {
          const x = L + i * band + (band - bw) / 2;
          const solar = Math.min(mo.solar, mo.use);
          const gTop = y(mo.grid), sTop = y(mo.grid + solar);
          const gap = mo.grid > 0 && solar > 0 ? 2 : 0;
          return (
            <g key={mo.month} className={active === i ? "on" : active != null ? "dim" : ""}>
              {mo.grid > 0 && <rect className="bar grid" x={x} y={gTop} width={bw} height={y(0) - gTop} rx={solar > 0 ? 0 : 3} />}
              {solar > 0 && <path className="bar solar" d={roundTop(x, sTop, bw, gTop - sTop - gap, 3)} />}
              <text x={x + bw / 2} y={H - 7} className="axis" textAnchor="middle">{MONTHS[lang][i]}</text>
              <rect x={L + i * band} y={T} width={band} height={H - T - B} fill="transparent"
                onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
            </g>
          );
        })}
        {limit && limit < max && (
          <g>
            <line x1={L} x2={W - R} y1={y(limit)} y2={y(limit)} className="limit" />
            <text x={W - R} y={y(limit) - 4} className="axis limit-label" textAnchor="end">{ex(lang, "freeLine", limit)}</text>
          </g>
        )}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="baseline" />
      </svg>
      <figcaption className="small muted">{ex(lang, "monthsNote", r)}</figcaption>
      <details className="table-view">
        <summary>{ex(lang, "seeTable")}</summary>
        <table className="breakdown four">
          <thead><tr><th>{ex(lang, "monthCol")}</th><th>{ex(lang, "useCol")}</th><th>{ex(lang, "solar")}</th><th>{ex(lang, "grid")}</th><th>{ex(lang, "billCol")}</th></tr></thead>
          <tbody>{months.map((mo) => (
            <tr key={mo.month}><th>{MONTHS[lang][mo.month - 1]}</th><td>{mo.use}</td><td>{mo.solar}</td><td>{mo.grid}</td><td>{inr(mo.with_solar)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// Money position over the years: starts at minus what you paid, crosses zero at payback.
function CashflowChart({ lang, r }) {
  const [active, setActive] = useState(null);
  const ref = useRef(null);
  const years = r.lifetime.years;
  const W = 340, H = 190, L = 44, R = 10, T = 14, B = 22;
  const vals = years.map((p) => p.cumulative);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.08;
  const ymin = lo - pad, ymax = hi + pad;
  const n = years.length - 1;
  const x = (yr) => L + (W - L - R) * (yr / n);
  const y = (v) => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin));
  const d = years.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join("");
  const pb = r.payback_years;
  const p = active == null ? null : years[active];

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setActive(Math.max(0, Math.min(n, Math.round(((px - L) / (W - L - R)) * n))));
  };

  return (
    <figure className="chart">
      <div className="tip" aria-live="polite">
        {p ? <><b>{ex(lang, "yearCol")} {p.year}</b> · {ex(lang, "cumulative")}: {inr(p.cumulative)}</>
          : <span className="muted">{lang === "hi" ? "किसी साल पर टैप करें" : "Tap the line for any year"}</span>}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ex(lang, "paybackTitle")}
        onMouseMove={onMove} onClick={onMove} onMouseLeave={() => setActive(null)}>
        {[ymin + pad, 0, ymax - pad].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "baseline" : "gridline"} />
            <text x={L - 4} y={y(v) + 3} className="axis" textAnchor="end">{short(v)}</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25].filter((yr) => yr <= n).map((yr) => (
          <text key={yr} x={x(yr)} y={H - 7} className="axis" textAnchor="middle">{yr}</text>
        ))}
        <path d={d} className="money-line" />
        {pb && pb <= n && (
          <g>
            <circle cx={x(pb)} cy={y(0)} r="5" className="breakeven" />
            <text x={x(pb) + 8} y={y(0) - 8} className="axis strong">{ex(lang, "breakEven")} · {pb} {t(lang, "years")}</text>
          </g>
        )}
        {p && (
          <g>
            <line x1={x(p.year)} x2={x(p.year)} y1={T} y2={H - B} className="crosshair" />
            <circle cx={x(p.year)} cy={y(p.cumulative)} r="4" className="dot" />
          </g>
        )}
      </svg>
      <figcaption className="small muted">{ex(lang, "paybackWhy", r)}</figcaption>
      <details className="table-view">
        <summary>{ex(lang, "seeTable")}</summary>
        <table className="breakdown">
          <tbody>{years.filter((q) => q.year % 5 === 0 || q.year === r.assumptions.inverter_year).map((q) => (
            <tr key={q.year}><th>{ex(lang, "yearCol")} {q.year}</th><td>{inr(q.cumulative)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}

function EmiBars({ lang, r }) {
  const max = Math.max(r.loan.emi, r.monthly_saving, 1);
  return (
    <div className="hbars">
      {[["grid", ex(lang, "emi"), r.loan.emi], ["solar", ex(lang, "save"), r.monthly_saving]].map(([cls, label, v]) => (
        <div key={label} className="hbar">
          <span className="hbar-label">{label}</span>
          <span className="hbar-track"><span className={`hbar-fill ${cls}`} style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="hbar-value">{inr(v)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- the screen ----------

export function Result({ lang, analysisId, result: r, onQuote, onRestart }) {
  const [showSteps, setShowSteps] = useState(false);
  const speech = useSpeech();
  const verdictClass = { yes: "good", maybe: "warn", not_worth: "bad" }[r.verdict] || "warn";
  const shareUrl = `${location.origin}${location.pathname}?r=${analysisId}`;
  const full = r.system_kw > 0 && Array.isArray(r.months);

  const share = () => {
    const text = t(lang, "speech")(r);
    if (navigator.share) navigator.share({ title: "SolarSaathi", text, url: shareUrl });
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`);
  };

  return (
    <div className="stack">
      <div className={`banner ${verdictClass}`}>
        <h2>{t(lang, "verdict_" + r.verdict)}</h2>
        {r.reason && <p>{t(lang, "reason_" + r.reason)}</p>}
      </div>

      {full && r.verdict !== "not_worth" && (
        <div className="stats">
          <Stat label={t(lang, "youPay")} value={inr(r.net_cost)} />
          <Stat label={t(lang, "saving")} value={inr(r.monthly_saving)} />
          <Stat label={t(lang, "payback")} value={r.payback_years ? `${r.payback_years} ${t(lang, "years")}` : "—"} />
          <Stat label={t(lang, "co2")} value={`${r.co2_tonnes_year} ${t(lang, "tonnes")}`} />
        </div>
      )}

      <div className="row">
        <button className="secondary" aria-pressed={speech.state !== "idle"} onClick={() => speech.toggle(lang, t(lang, "speech")(r))}>
          {speech.state === "idle" ? `▶ ${t(lang, "listen")}` : `■ ${t(lang, "stop")}`}
        </button>
        <button className="secondary" onClick={share}>↗ {t(lang, "share")}</button>
      </div>

      {(r.flags || []).map((f) => <p key={f} className="note">ⓘ {t(lang, "flag_" + f)}</p>)}

      {full ? (
        <>
          <Metric lang={lang} icon="☀️" title={ex(lang, "coverageTitle")} value={`${r.coverage_pct}%`} why={ex(lang, "coverage", r)} visual={<CoverageBar lang={lang} r={r} />} />

          <Metric lang={lang} icon="🧾" title={ex(lang, "billTitle")} value={ex(lang, "billValue", r)} sub={ex(lang, "billSub")} why={ex(lang, "billWhy", r)}
            visual={<MonthChart lang={lang} r={r} />}>
            <BillTable rows={ex(lang, "billRows", r)} />
          </Metric>

          <Metric lang={lang} icon="🔆" title={ex(lang, "sizeTitle")} value={ex(lang, "sizeValue", r)} sub={ex(lang, "sizeSub", r)} why={ex(lang, "sizeWhy", r)}>
            <Rows rows={ex(lang, "sizeRows", r)} />
          </Metric>

          <Metric lang={lang} icon="💰" title={ex(lang, "costTitle")} value={ex(lang, "costValue", r)} sub={ex(lang, "costSub")} why={ex(lang, "costWhy", r)}>
            <Rows rows={ex(lang, "costRows", r)} />
          </Metric>

          <Metric lang={lang} icon="📈" title={ex(lang, "paybackTitle")} value={ex(lang, "paybackValue", r)} sub={ex(lang, "paybackSub", r)}
            visual={<CashflowChart lang={lang} r={r} />}>
            <Rows rows={ex(lang, "paybackRows", r)} />
          </Metric>

          <Metric lang={lang} icon="🏦" title={ex(lang, "loanTitle")} value={ex(lang, "loanValue", r)} sub={ex(lang, "loanSub", r)} why={ex(lang, "loanWhy", r)} visual={<EmiBars lang={lang} r={r} />} />

          <Metric lang={lang} icon="🌱" title={ex(lang, "co2Title")} value={ex(lang, "co2Value", r)} sub={ex(lang, "co2Sub", r)} why={ex(lang, "co2Why", r)} />

          <details>
            <summary>{ex(lang, "assumptionsTitle")}</summary>
            <ul className="working">{ex(lang, "assumptions", r).map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </>
      ) : r.bill_now && (
        <table className="facts"><tbody>
          <tr><th>{t(lang, "billNow")}</th><td>{inr(r.bill_now.payable)} · {r.monthly_units} {t(lang, "roughUnits")}</td></tr>
        </tbody></table>
      )}

      <button className="secondary" onClick={() => setShowSteps(!showSteps)}>{t(lang, "nextSteps")}</button>
      {showSteps && <ol className="steps">{t(lang, "steps").map((s) => <li key={s}>{s}</li>)}</ol>}

      <button className="primary" onClick={onQuote}>📄 {t(lang, "checkAQuote")}</button>
      <button className="link" onClick={onRestart}>{t(lang, "startOver")}</button>
    </div>
  );
}

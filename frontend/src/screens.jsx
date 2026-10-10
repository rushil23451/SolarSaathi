import { useEffect, useRef, useState } from "react";
import { checkText, fallbackQuestions, inr, t } from "./i18n.js";
import { post } from "./api.js";

const CITIES = [
  ["New Delhi", 28.61, 77.21], ["Mumbai", 19.08, 72.88], ["Bengaluru", 12.97, 77.59],
  ["Chennai", 13.08, 80.27], ["Kolkata", 22.57, 88.36], ["Hyderabad", 17.39, 78.49],
  ["Pune", 18.52, 73.86], ["Ahmedabad", 23.02, 72.57], ["Jaipur", 26.91, 75.79], ["Lucknow", 26.85, 80.95],
];

// Warnings from the backend's sanity checks that mean "look at the units again".
const CHECK_UNITS = ["units_mismatch", "units_from_readings", "low_confidence", "units_missing"];

export function Home({ lang, onBill, onQuote }) {
  return (
    <div className="stack">
      <p className="lead">{t(lang, "tagline")}</p>
      <button className="primary big" onClick={onBill}>☀️ {t(lang, "checkBill")}</button>
      <button className="secondary" onClick={onQuote}>📄 {t(lang, "checkQuote")}</button>
      <p className="small muted">🔒 {t(lang, "privacy")}</p>
    </div>
  );
}

export function Snap({ lang, kind, onFile }) {
  const input = useRef(null);
  return (
    <div className="stack">
      <h2>{t(lang, kind === "bill" ? "snapBill" : "snapQuote")}</h2>
      <p className="muted">{t(lang, kind === "bill" ? "snapBillTip" : "snapQuoteTip")}</p>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden
             onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <button className="primary big" onClick={() => input.current.click()}>📷 {t(lang, "choosePhoto")}</button>
    </div>
  );
}

export function Busy({ text }) {
  return (
    <div className="stack center">
      <div className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function Confirm({ lang, bill, onBack, onNext }) {
  const historyText = (bill.history || []).map((h) => h.units).join(", ");
  const [f, setF] = useState({
    discom: bill.discom || "",
    category: bill.category || "domestic",
    sanctioned_load_kw: bill.sanctioned_load_kw ?? "",
    billing_period_days: bill.billing_period_days ?? 30,
    units_billed: bill.units_billed ?? "",
    history: historyText,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const history = f.history === historyText ? bill.history || []
      : f.history.split(/[,\s]+/).map(Number).filter((n) => n > 0).map((units) => ({ units, days: 30 }));
    onNext({
      ...bill,
      discom: f.discom,
      category: f.category,
      sanctioned_load_kw: Number(f.sanctioned_load_kw) || null,
      billing_period_days: Number(f.billing_period_days) || 30,
      units_billed: Number(f.units_billed) || null,
      history,
    });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <h2>{t(lang, "confirmTitle")}</h2>
      <p className="muted">{t(lang, "confirmTip")}</p>
      {CHECK_UNITS.some((w) => bill.warnings?.includes(w)) && <p className="warning">⚠ {t(lang, "checkUnits")}</p>}
      {bill.warnings?.includes("history_row_dropped") && <p className="warning">⚠ {t(lang, "checkHistory")}</p>}
      <label>{t(lang, "discom")}<input value={f.discom} onChange={set("discom")} required /></label>
      <label>{t(lang, "category")}
        <select value={f.category} onChange={set("category")}>
          {["domestic", "non_domestic", "other"].map((c) => <option key={c} value={c}>{t(lang, c)}</option>)}
        </select>
      </label>
      <div className="row">
        <label>{t(lang, "units")}<input type="number" inputMode="decimal" value={f.units_billed} onChange={set("units_billed")} required /></label>
        <label>{t(lang, "days")}<input type="number" inputMode="numeric" value={f.billing_period_days} onChange={set("billing_period_days")} /></label>
      </div>
      <label>{t(lang, "load")}<input type="number" inputMode="decimal" step="0.01" value={f.sanctioned_load_kw} onChange={set("sanctioned_load_kw")} /></label>
      <label>{t(lang, "history")}<input value={f.history} onChange={set("history")} placeholder="400, 292, 359" /></label>
      <div className="row">
        <button type="button" className="secondary" onClick={onBack}>{t(lang, "back")}</button>
        <button className="primary">{t(lang, "next")}</button>
      </div>
    </form>
  );
}

export function Where({ lang, onNext }) {
  const [loc, setLoc] = useState(null);
  const [roof, setRoof] = useState("unknown");
  const [err, setErr] = useState("");

  const locate = () => {
    setErr("");
    navigator.geolocation?.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lon: p.coords.longitude, label: t(lang, "located") }),
      () => setErr("Location not available. Pick your city instead."),
      { timeout: 10000 },
    );
  };

  return (
    <div className="stack">
      <h2>{t(lang, "whereTitle")}</h2>
      <button className="secondary" onClick={locate}>📍 {t(lang, "useLocation")}</button>
      <label>{t(lang, "orCity")}
        <select value={loc?.label || ""} onChange={(e) => {
          const c = CITIES.find((x) => x[0] === e.target.value);
          if (c) setLoc({ lat: c[1], lon: c[2], label: c[0] });
        }}>
          <option value="" disabled>—</option>
          {loc?.label === t(lang, "located") && <option>{loc.label}</option>}
          {CITIES.map((c) => <option key={c[0]}>{c[0]}</option>)}
        </select>
      </label>
      {err && <p className="error">{err}</p>}
      <fieldset>
        <legend>{t(lang, "roof")}</legend>
        {["small", "medium", "large", "unknown"].map((r) => (
          <label key={r} className="choice">
            <input type="radio" name="roof" checked={roof === r} onChange={() => setRoof(r)} />
            {t(lang, "roof_" + r)}
          </label>
        ))}
      </fieldset>
      <button className="primary big" disabled={!loc} onClick={() => onNext({ ...loc, roof })}>{t(lang, "calculate")}</button>
    </div>
  );
}

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

export function Result({ lang, analysisId, result: r, onQuote, onRestart }) {
  const [showSteps, setShowSteps] = useState(false);
  const speech = useSpeech();
  const verdictClass = { yes: "good", maybe: "warn", not_worth: "bad" }[r.verdict] || "warn";
  const shareUrl = `${location.origin}${location.pathname}?r=${analysisId}`;

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

      {r.system_kw > 0 && r.verdict !== "not_worth" && (
        <div className="stats">
          <Stat label={t(lang, "youPay")} value={inr(r.net_cost)} />
          <Stat label={t(lang, "saving")} value={inr(r.monthly_saving)} />
          <Stat label={t(lang, "payback")} value={`${r.payback_years} ${t(lang, "years")}`} />
          <Stat label={t(lang, "co2")} value={`${r.co2_tonnes_year} ${t(lang, "tonnes")}`} />
        </div>
      )}

      {r.bill_now && (
        <table className="facts"><tbody>
          {r.system_kw > 0 && <tr><th>{t(lang, "size")}</th><td>{r.system_kw} kW</td></tr>}
          <tr><th>{t(lang, "billNow")}</th><td>{inr(r.bill_now.payable)} · {r.monthly_units} {t(lang, "roughUnits")}</td></tr>
          {r.bill_with_solar && <tr><th>{t(lang, "billSolar")}</th><td>{inr(r.bill_with_solar.payable)}</td></tr>}
        </tbody></table>
      )}

      {(r.flags || []).map((f) => <p key={f} className="note">ⓘ {t(lang, "flag_" + f)}</p>)}

      <div className="row">
        <button className="secondary" aria-pressed={speech.state !== "idle"} onClick={() => speech.toggle(lang, t(lang, "speech")(r))}>
          {speech.state === "idle" ? `▶ ${t(lang, "listen")}` : `■ ${t(lang, "stop")}`}
        </button>
        <button className="secondary" onClick={share}>↗ {t(lang, "share")}</button>
      </div>

      {r.working && (
        <details>
          <summary>{t(lang, "showWorking")}</summary>
          <ul className="working">
            {r.working.map((w) => <li key={w.key}><b>{w.value}</b> <span className="muted">— {w.note}</span></li>)}
          </ul>
        </details>
      )}

      <button className="secondary" onClick={() => setShowSteps(!showSteps)}>{t(lang, "nextSteps")}</button>
      {showSteps && <ol className="steps">{t(lang, "steps").map((s) => <li key={s}>{s}</li>)}</ol>}

      <button className="primary" onClick={onQuote}>📄 {t(lang, "checkAQuote")}</button>
      <button className="link" onClick={onRestart}>{t(lang, "startOver")}</button>
    </div>
  );
}

export function QuoteReport({ lang, report, onRestart }) {
  const [copied, setCopied] = useState(false);
  const questions = report.advice?.questions?.length ? report.advice.questions : fallbackQuestions(lang, report.checks);
  const cls = { green: "good", amber: "warn", red: "bad" }[report.overall];

  return (
    <div className="stack">
      <div className={`banner ${cls}`}>
        <h2>{t(lang, "overall_" + report.overall)}</h2>
        {report.advice?.summary && <p>{report.advice.summary}</p>}
      </div>
      <ul className="checks">
        {report.checks.map((c) => (
          <li key={c.id}><span className={`dot ${c.status}`} aria-label={c.status} />{checkText(lang, c)}</li>
        ))}
      </ul>
      {questions.length > 0 && (
        <>
          <h3>{t(lang, "askVendor")}</h3>
          <ol className="steps">{questions.map((q) => <li key={q}>{q}</li>)}</ol>
          <button className="secondary" onClick={() => {
            navigator.clipboard.writeText(questions.map((q, i) => `${i + 1}. ${q}`).join("\n"));
            setCopied(true);
          }}>{copied ? t(lang, "copied") : t(lang, "copy")}</button>
        </>
      )}
      <button className="link" onClick={onRestart}>{t(lang, "startOver")}</button>
    </div>
  );
}

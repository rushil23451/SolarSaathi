import { useEffect, useState } from "react";
import { apiConfigured, get, post, upload, waitForJob } from "./api.js";
import { prepareFile } from "./image.js";
import { t } from "./i18n.js";
import { Busy, Confirm, Home, QuoteReport, Result, Snap, Where } from "./screens.jsx";

export default function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lang") || "hi"; } catch { return "hi"; }
  });
  const [step, setStep] = useState("home");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [bill, setBill] = useState(null);
  const [analysis, setAnalysis] = useState(null); // { analysisId, result }
  const [report, setReport] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch { /* private mode */ }
  }, [lang]);

  // A shared link (?r=<id>) opens that saved result directly.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("r");
    if (id) run(t(lang, "reading"), async () => {
      setAnalysis(await get(`/results/${id}`));
      setStep("result");
    });
  }, []);

  async function run(message, fn) {
    setError("");
    setBusy(message);
    try {
      await fn();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  const readBill = (file) => run(t(lang, "reading"), async () => {
    const key = await upload(await prepareFile(file), "bill");
    const { jobId } = await post("/bill/extract", { key });
    setBill(await waitForJob(jobId));
    setStep("confirm");
  });

  const analyse = (where) => run("…", async () => {
    setAnalysis(await post("/bill/analyse", { bill, lat: where.lat, lon: where.lon, roof: where.roof }));
    setStep("result");
  });

  const readQuote = (file) => run(t(lang, "reading"), async () => {
    const key = await upload(await prepareFile(file), "quote");
    const { jobId } = await post("/quote/check", { key, analysisId: analysis?.analysisId, lang });
    setReport(await waitForJob(jobId));
    setStep("quoteReport");
  });

  const restart = () => {
    setBill(null); setAnalysis(null); setReport(null); setError(""); setStep("home");
    history.replaceState(null, "", location.pathname);
  };

  let screen;
  if (busy) screen = <Busy text={busy} />;
  else if (step === "home") screen = <Home lang={lang} onBill={() => setStep("snapBill")} onQuote={() => setStep("snapQuote")} />;
  else if (step === "snapBill") screen = <Snap lang={lang} kind="bill" onFile={readBill} />;
  else if (step === "confirm") screen = <Confirm lang={lang} bill={bill} onBack={() => setStep("snapBill")} onNext={(b) => { setBill(b); setStep("where"); }} />;
  else if (step === "where") screen = <Where lang={lang} onNext={analyse} />;
  else if (step === "result") screen = <Result lang={lang} {...analysis} onQuote={() => setStep("snapQuote")} onRestart={restart} />;
  else if (step === "snapQuote") screen = <Snap lang={lang} kind="quote" onFile={readQuote} />;
  else if (step === "quoteReport") screen = <QuoteReport lang={lang} report={report} onRestart={restart} />;

  return (
    <main>
      <header>
        <button className="brand" onClick={restart}>☀️ SolarSaathi</button>
        <div className="lang" role="group" aria-label="Language">
          <button aria-pressed={lang === "hi"} onClick={() => setLang("hi")}>हिंदी</button>
          <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
        </div>
      </header>
      {!apiConfigured && <p className="error">{t(lang, "notConfigured")}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {screen}
    </main>
  );
}

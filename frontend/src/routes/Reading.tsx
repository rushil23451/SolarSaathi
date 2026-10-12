import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CheckCircle, Circle, FileText, WarningCircle } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { useFlow } from "../app/flow";
import { ApiError, waitForJob } from "../lib/api";
import type { Bill, QuoteReport } from "../types/api";
import { ButtonLink, Spinner, Steps } from "../ui/controls";
import { useTitle } from "../lib/useTitle";

type State = { k: "reading" } | { k: "failed"; kind: ApiError["kind"]; msg: string };

export function Reading({ kind }: { kind: "bill" | "quote" }) {
  const t = useT();
  const { jobId = "" } = useParams();
  const flow = useFlow();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ k: "reading" });
  const [seconds, setSeconds] = useState(0);
  const preview = flow.preview[kind];
  useTitle(kind === "bill" ? t.reading.billTitle : t.reading.quoteTitle);

  useEffect(() => {
    if (state.k !== "reading") return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [state.k]);

  useEffect(() => {
    if (state.k !== "reading") return;
    const ctrl = new AbortController();
    waitForJob<Bill | QuoteReport>(jobId, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        if (kind === "bill") {
          flow.update({ billRead: result as Bill, bill: result as Bill, edited: [], manual: false });
          navigate("/bill/check", { viewTransition: true, replace: true });
        } else {
          flow.update({ quote: result as QuoteReport });
          navigate("/quote/review", { viewTransition: true, replace: true });
        }
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        const err = e instanceof ApiError ? e : new ApiError("network", String(e));
        setState({ k: "failed", kind: err.kind, msg: err.message });
      });
    return () => ctrl.abort();
  }, [jobId, kind, state.k]);

  const failMessage = (s: Extract<State, { k: "failed" }>) => {
    if (/does not look like|not a solar|not an electricity/i.test(s.msg)) return kind === "bill" ? t.reading.notABill : t.reading.notAQuote;
    if (s.kind === "timeout") return t.reading.timeout;
    if (s.kind === "busy") return t.reading.busy;
    if (s.kind === "network" || s.kind === "http") return t.reading.network;
    return t.reading.unreadable;
  };

  const stages = [
    { label: t.reading.stageUploaded, done: true },
    { label: kind === "bill" ? t.reading.stageReadingBill : t.reading.stageReadingQuote, done: false, active: state.k === "reading" },
    { label: t.reading.stageReady(kind), done: false },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-10">
      <Steps steps={kind === "bill" ? t.steps.bill : t.steps.quote} current={0} label={t.steps.label} />
      <div className="mt-10 grid grid-cols-12 gap-12">
        <figure className="col-span-7">
          <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-panel)]">
            {preview ? (
              preview.type === "application/pdf" ? (
                <iframe src={preview.url} title={t.reading.yourDocument} className="h-[620px] w-full" />
              ) : (
                <img src={preview.url} alt={t.reading.yourDocument} className="max-h-[620px] w-full object-contain" />
              )
            ) : (
              <div className="grid h-[420px] place-items-center p-10 text-center text-muted">
                <div className="flex flex-col items-center gap-3">
                  <FileText size={48} aria-hidden="true" />
                  <p className="max-w-[40ch]">{t.reading.noPreview}</p>
                </div>
              </div>
            )}
            {state.k === "reading" && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-marigold/25 to-transparent" />
              </div>
            )}
          </div>
        </figure>

        <section className="col-span-5 flex flex-col gap-8">
          <h1 tabIndex={-1} className="type-h1 focus:outline-none">
            {kind === "bill" ? t.reading.billTitle : t.reading.quoteTitle}
          </h1>

          <ol className="flex flex-col gap-4" aria-live="polite">
            {stages.map((s) => (
              <li key={s.label} className={`flex items-center gap-3 type-h3 ${s.done || s.active ? "text-ink" : "text-muted"}`}>
                <span className="grid size-7 place-items-center" aria-hidden="true">
                  {s.done ? (
                    <CheckCircle size={26} weight="fill" className="text-good" />
                  ) : s.active ? (
                    <Spinner className="text-grid" />
                  ) : state.k === "failed" && s === stages[1] ? (
                    <WarningCircle size={26} weight="fill" className="text-bad" />
                  ) : (
                    <Circle size={24} />
                  )}
                </span>
                {s.label}
              </li>
            ))}
          </ol>

          {state.k === "reading" ? (
            <div className="flex flex-col gap-2 text-ink-2">
              <p>{t.reading.usual}</p>
              {seconds >= 5 && <p className="nums text-muted">{t.reading.elapsed(seconds)}</p>}
              {seconds >= 45 && (
                <div className="mt-3 rounded-[var(--radius-input)] bg-warn-soft px-4 py-3 text-warn">
                  <p>{t.reading.slow}</p>
                  {kind === "bill" && (
                    <Link to="/bill/check" viewTransition onClick={() => flow.update({ manual: true, billRead: null, bill: null, edited: [] })} className="mt-2 inline-block font-semibold text-warn">
                      {t.reading.typeNumbers}
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div role="alert" className="flex flex-col gap-5">
              <div>
                <p className="type-h3 text-bad">{failMessage(state)}</p>
                <p className="mt-2 text-ink-2">{t.reading.unreadableHelp}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink to={`/${kind}`} variant="primary">{t.reading.anotherFile}</ButtonLink>
                {kind === "bill" && (
                  <ButtonLink to="/bill/check" variant="secondary" onClick={() => flow.update({ manual: true, billRead: null, bill: null, edited: [] })}>
                    {t.reading.typeNumbers}
                  </ButtonLink>
                )}
                {state.kind === "timeout" || state.kind === "network" ? (
                  <button className="font-medium text-grid underline underline-offset-4" onClick={() => { setSeconds(0); setState({ k: "reading" }); }}>
                    {t.common.tryAgain}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

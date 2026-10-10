import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FilePdf, ImageSquare, LockSimple, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { useLang } from "../i18n";
import { useFlow } from "../app/flow";
import { ApiError, startBillJob, startQuoteJob, uploadFile } from "../lib/api";
import { ACCEPT, FileProblem, prepareFile } from "../lib/image";
import { Button, Steps } from "../ui/controls";
import { useTitle } from "../lib/useTitle";

type Phase =
  | { k: "idle" }
  | { k: "preparing" }
  | { k: "uploading"; pct: number }
  | { k: "error"; msg: string; file?: File };

export function Upload({ kind }: { kind: "bill" | "quote" }) {
  const { t, lang } = useLang();
  const flow = useFlow();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const reportId = kind === "quote" ? params.get("report") || flow.state.quoteFromReport : null;
  useTitle(kind === "bill" ? t.upload.billTitle : t.upload.quoteTitle);

  useEffect(() => {
    if (kind === "quote" && params.get("report")) flow.update({ quoteFromReport: params.get("report") });
  }, [kind, params]);
  useEffect(() => () => abort.current?.abort(), []);

  async function handle(file: File) {
    if (phase.k === "preparing" || phase.k === "uploading") return;
    setPhase({ k: "preparing" });
    abort.current = new AbortController();
    try {
      const ready = await prepareFile(file);
      flow.setPreview(kind, ready);
      setPhase({ k: "uploading", pct: 0 });
      const key = await uploadFile(ready, kind, (f) => setPhase({ k: "uploading", pct: Math.round(f * 100) }), abort.current.signal);
      const { jobId } = kind === "bill" ? await startBillJob(key) : await startQuoteJob(key, reportId, lang);
      if (kind === "bill") flow.update({ manual: false });
      navigate(`/${kind}/reading/${jobId}`, { viewTransition: true });
    } catch (e) {
      if (e instanceof ApiError && e.kind === "cancelled") return setPhase({ k: "idle" });
      const msg =
        e instanceof FileProblem ? (e.kind === "too_big" ? t.upload.tooBig : t.upload.unsupported) : t.upload.failed;
      setPhase({ k: "error", msg, file: e instanceof FileProblem ? undefined : file });
    }
  }

  const busy = phase.k === "preparing" || phase.k === "uploading";

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-10">
      <Steps steps={kind === "bill" ? t.steps.bill : t.steps.quote} current={0} label={t.steps.label} />
      <div className="mt-10 grid grid-cols-12 gap-12">
        <section className="col-span-7 flex flex-col gap-6">
          <div>
            <h1 tabIndex={-1} className="type-h1 focus:outline-none">
              {kind === "bill" ? t.upload.billTitle : t.upload.quoteTitle}
            </h1>
            <p className="mt-4 max-w-[60ch] type-prose text-ink-2">{kind === "bill" ? t.upload.billLead : t.upload.quoteLead}</p>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handle(f);
            }}
            className={`group relative flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[var(--radius-panel)] border-2 border-dashed px-10 py-12 text-center transition-[background-color,border-color] duration-200 ${
              dragging ? "border-grid bg-grid-soft" : "border-line-strong bg-surface hover:border-ink/50"
            } ${busy ? "pointer-events-none" : "cursor-pointer"}`}
          >
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handle(f);
              }}
            />
            {busy ? (
              <div className="flex w-full max-w-sm flex-col items-center gap-4" aria-live="polite">
                <UploadSimple size={40} className="text-grid" aria-hidden="true" />
                <p className="type-h3 nums">{phase.k === "uploading" ? t.upload.uploading(phase.pct) : t.upload.preparing}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div
                    className="h-full origin-left rounded-full bg-grid transition-transform duration-200"
                    style={{ transform: `scaleX(${phase.k === "uploading" ? phase.pct / 100 : 0.04})` }}
                  />
                </div>
                <Button variant="tertiary" className="pointer-events-auto" onClick={(e) => { e.preventDefault(); abort.current?.abort(); }}>
                  {t.upload.cancel}
                </Button>
              </div>
            ) : (
              <>
                <span className="grid size-16 place-items-center rounded-full bg-marigold-soft text-marigold-text" aria-hidden="true">
                  <UploadSimple size={30} weight="bold" />
                </span>
                <span className="type-h2">{dragging ? t.upload.dropActive : t.upload.drop(kind)}</span>
                <span className="text-muted">{t.upload.or}</span>
                <span className="inline-flex h-12 items-center rounded-[var(--radius-button)] border border-ink/80 bg-surface px-5 font-semibold transition-colors group-hover:bg-ink group-hover:text-paper">
                  {t.upload.choose}
                </span>
                <span className="flex items-center gap-2 type-small text-muted">
                  <ImageSquare aria-hidden="true" /> <FilePdf aria-hidden="true" /> {t.upload.formats}
                </span>
              </>
            )}
          </label>

          {phase.k === "error" && (
            <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-input)] bg-bad-soft px-4 py-3 text-bad">
              <WarningCircle size={22} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
                <p>{phase.msg}</p>
                {phase.file && (
                  <Button variant="secondary" className="h-10" onClick={() => phase.file && handle(phase.file)}>
                    {t.common.tryAgain}
                  </Button>
                )}
              </div>
            </div>
          )}

          <p className="flex items-center gap-2 type-small text-muted">
            <LockSimple aria-hidden="true" /> {t.upload.privacy}
          </p>

          {kind === "bill" && (
            <Link
              to="/bill/check"
              viewTransition
              onClick={() => flow.update({ manual: true, billRead: null, bill: null, edited: [] })}
              className="self-start font-medium"
            >
              {t.upload.manual}
            </Link>
          )}
        </section>

        <aside className="col-span-5 flex flex-col gap-6">
          {kind === "bill" ? <SampleBill /> : <QuoteChecklist reportId={reportId} />}
        </aside>
      </div>
    </div>
  );
}

/** A drawn bill with the four things we read highlighted. Example values only. */
export function SampleBill() {
  const { t } = useLang();
  const rows: [string, string, boolean][] = [
    ["Sanctioned load", "4.00 kW", true],
    ["Meter reading", "52146 / 51583", false],
    ["Units consumed", "563", true],
    ["No. of days", "30", true],
    ["Energy charges", "₹ 2,642.00", false],
  ];
  return (
    <figure className="flex flex-col gap-5">
      <div aria-hidden="true" className="rotate-[-1.2deg] rounded-[var(--radius-slip)] border border-line bg-surface p-6 shadow-[var(--shadow-panel)]">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <span className="font-[680] [font-stretch:110%]">BSES Rajdhani Power Ltd</span>
          <span className="type-small text-muted">Bill month MAY-25</span>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 type-small nums">
          {rows.map(([k, v, hl]) => (
            <div key={k} className={`flex justify-between rounded px-2 py-1 ${hl ? "bg-marigold-soft ring-1 ring-marigold" : ""}`}>
              <dt className={hl ? "font-semibold" : "text-muted"}>{k}</dt>
              <dd className={hl ? "font-semibold" : "text-muted"}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 rounded bg-marigold-soft px-2 py-2 ring-1 ring-marigold">
          <p className="type-small font-semibold">Consumption history</p>
          <div className="mt-2 flex h-12 items-end gap-1.5">
            {[400, 292, 359, 370, 329, 223].map((u, i) => (
              <span key={i} className="flex-1 rounded-t-sm bg-solar/70" style={{ height: `${(u / 400) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        <h2 className="type-h3">{t.upload.billReads}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {t.upload.billReadsList.map((x) => (
            <li key={x} className="flex gap-3"><span className="mt-2.5 size-2 shrink-0 rounded-full bg-marigold" aria-hidden="true" />{x}</li>
          ))}
        </ul>
        <p className="mt-4 type-small text-muted">{t.upload.billTip}</p>
      </figcaption>
    </figure>
  );
}

function QuoteChecklist({ reportId }: { reportId: string | null }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-panel)] border border-line bg-surface p-7">
      <h2 className="type-h3">{t.upload.quoteChecks}</h2>
      <ul className="flex flex-col gap-2.5">
        {t.upload.quoteChecksList.map((x) => (
          <li key={x} className="flex gap-3"><span className="mt-2.5 size-2 shrink-0 rounded-full bg-marigold" aria-hidden="true" />{x}</li>
        ))}
      </ul>
      <p className="border-t border-line pt-4 type-small text-ink-2">
        {reportId ? t.upload.linkedReport : (
          <>
            {t.upload.noReport} <Link to="/bill" viewTransition>{t.upload.noReportLink}</Link>
          </>
        )}
      </p>
    </div>
  );
}

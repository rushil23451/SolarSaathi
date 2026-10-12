import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { useFlow, type BillField } from "../app/flow";
import type { Bill, BillWarning, Category } from "../types/api";
import { Button, ButtonLink, Field, StatusChip, Steps, inputClass, type FieldStatus } from "../ui/controls";
import { TermHelp } from "../ui/terms";
import { BillViewer } from "../features/BillViewer";
import { SampleBill } from "./Upload";
import { useTitle } from "../lib/useTitle";

const WARN_FIELD: Record<BillWarning, BillField> = {
  units_mismatch: "units_billed",
  units_from_readings: "units_billed",
  low_confidence: "units_billed",
  units_missing: "units_billed",
  load_missing: "sanctioned_load_kw",
  load_in_kva: "sanctioned_load_kw",
  days_assumed_30: "billing_period_days",
  days_from_dates: "billing_period_days",
  history_row_dropped: "history",
  no_history: "history",
  category_unclear: "category",
};
// Warnings that are information, not a request to check the value.
const INFO_ONLY: BillWarning[] = ["load_in_kva", "days_from_dates", "no_history"];

// Discoms we have tariffs for (mirrors discom_aliases in backend data/tariffs.json).
const SUPPORTED = ["bses", "brpl", "bypl", "rajdhani", "yamuna", "tata power", "tpddl", "ndmc"];
export const isSupportedDiscom = (d: string) => SUPPORTED.some((a) => d.toLowerCase().includes(a));

type Values = { discom: string; category: Category; load: string; units: string; days: string; history: string };

const fromBill = (b: Bill | null): Values => ({
  discom: b?.discom ?? "",
  category: b?.category ?? "domestic",
  load: b?.sanctioned_load_kw != null ? String(b.sanctioned_load_kw) : "",
  units: b?.units_billed != null ? String(b.units_billed) : "",
  days: b?.billing_period_days != null ? String(b.billing_period_days) : "",
  history: (b?.history ?? []).map((h) => h.units).join(", "),
});

const parseHistory = (s: string) =>
  s.split(/[,\s]+/).filter(Boolean).map(Number);

export function Check() {
  const t = useT();
  const flow = useFlow();
  const navigate = useNavigate();
  const { billRead, bill, manual } = flow.state;
  const original = useMemo(() => fromBill(billRead), [billRead]);
  const [v, setV] = useState<Values>(() => fromBill(bill ?? billRead));
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const preview = flow.preview.bill;
  const noSource = !manual && !billRead;
  useTitle(manual || noSource ? t.check.manualTitle : t.check.title);

  const errors: Partial<Record<keyof Values, string>> = {};
  const n = (s: string) => Number(s.trim());
  if (!v.discom.trim()) errors.discom = t.check.errors.discom;
  if (!(n(v.units) > 0 && n(v.units) <= 100000)) errors.units = t.check.errors.units;
  if (!(n(v.days) >= 1 && n(v.days) <= 120)) errors.days = t.check.errors.days;
  if (!(n(v.load) > 0 && n(v.load) <= 1000)) errors.load = t.check.errors.load;
  if (v.history.trim() && parseHistory(v.history).some((x) => !(x >= 0 && x <= 100000))) errors.history = t.check.errors.history;
  const errorKeys = Object.keys(errors) as (keyof Values)[];
  const show = (k: keyof Values) => (touched[k] || submitted ? errors[k] ?? null : null);

  const FIELD: Record<keyof Values, BillField> = {
    discom: "discom", category: "category", load: "sanctioned_load_kw", units: "units_billed", days: "billing_period_days", history: "history",
  };
  const warningsFor = (k: keyof Values) => (billRead?.warnings ?? []).filter((w) => WARN_FIELD[w] === FIELD[k]);
  const crossFor = (k: keyof Values) =>
    k === "discom" ? undefined : billRead?.cross_check?.[FIELD[k] as keyof NonNullable<Bill["cross_check"]>];
  const showValue = (k: keyof Values, value: unknown) =>
    Array.isArray(value) ? (value.length ? value.join(", ") : t.check.none)
      : k === "category" ? t.check.categories[value as Category] ?? String(value) : String(value);

  function status(k: keyof Values): FieldStatus {
    if (manual || noSource) return "typed";
    if (v[k].toString().trim() !== original[k].toString().trim()) return "edited";
    if (!original[k].toString().trim()) return "missing";
    if (warningsFor(k).some((w) => !INFO_ONLY.includes(w)) || crossFor(k)) return "check";
    return "from_bill";
  }

  const set = (k: keyof Values) => (value: string) => setV((s) => ({ ...s, [k]: value }));
  const describe = (id: string, err: string | null) => [`${id}-help`, err ? `${id}-error` : ""].filter(Boolean).join(" ");

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errorKeys.length) {
      requestAnimationFrame(() => document.getElementById(`f-${errorKeys[0]}`)?.focus());
      return;
    }
    const hist = parseHistory(v.history);
    const oldRows = (billRead ?? bill)?.history ?? [];
    const sameRows = oldRows.length === hist.length;
    const next: Bill = {
      ...(billRead ?? ({ warnings: [] } as unknown as Bill)),
      discom: v.discom.trim(),
      category: v.category,
      sanctioned_load_kw: n(v.load),
      units_billed: n(v.units),
      billing_period_days: n(v.days),
      // Keep each row's dates when the rows are unchanged in number: the calculation uses them to
      // place the use in the right months (summer vs winter).
      history: hist.map((u, i) => ({
        units: u,
        days: sameRows ? oldRows[i].days : 30,
        period_start: sameRows ? oldRows[i].period_start ?? null : null,
        period_end: sameRows ? oldRows[i].period_end ?? null : null,
      })),
      warnings: billRead?.warnings ?? [],
    };
    const edited = (Object.keys(FIELD) as (keyof Values)[]).filter((k) => status(k) === "edited").map((k) => FIELD[k]);
    flow.update({ bill: next, edited });
    navigate("/bill/home", { viewTransition: true });
  }

  const note = (k: keyof Values) => {
    const ws = warningsFor(k);
    const cross = crossFor(k);
    if (manual || (!ws.length && !cross)) return null;
    return (
      <ul className="flex flex-col gap-1">
        {cross && (
          <li className="flex items-start gap-1.5 type-small text-warn">
            <WarningCircle weight="bold" className="mt-1 shrink-0" aria-hidden="true" />
            {t.check.secondReader(showValue(k, cross.second))}
          </li>
        )}
        {ws.map((w) => (
          <li key={w} className={`flex items-start gap-1.5 type-small ${INFO_ONLY.includes(w) ? "text-muted" : "text-warn"}`}>
            {INFO_ONLY.includes(w) ? <Info className="mt-1 shrink-0" aria-hidden="true" /> : <WarningCircle weight="bold" className="mt-1 shrink-0" aria-hidden="true" />}
            {t.check.warnings[w]}
          </li>
        ))}
      </ul>
    );
  };

  const chip = (k: keyof Values) => <StatusChip status={status(k)} labels={t.check.status} />;
  const input = (k: keyof Values, extra: Record<string, unknown> = {}) => {
    const err = show(k);
    const st = status(k);
    return (
      <input
        id={`f-${k}`}
        value={v[k]}
        onChange={(e) => set(k)(e.target.value)}
        onBlur={() => setTouched((s) => ({ ...s, [k]: true }))}
        aria-invalid={Boolean(err)}
        aria-describedby={describe(`f-${k}`, err)}
        className={`${inputClass} ${st === "missing" && !v[k] ? "hatch" : ""} ${st === "check" ? "border-warn" : ""}`}
        {...extra}
      />
    );
  };

  const historyCount = parseHistory(v.history).length;
  const unsupported = v.discom.trim() && !isSupportedDiscom(v.discom);

  const form = (
    <form onSubmit={submit} noValidate className="flex flex-col gap-10">
      {submitted && errorKeys.length > 0 && (
        <div ref={summary} role="alert" className="rounded-[var(--radius-input)] bg-bad-soft px-4 py-3 font-semibold text-bad">
          {t.check.errors.summary(errorKeys.length)}
        </div>
      )}
      <fieldset className="flex flex-col gap-6">
        <legend className="mb-5 type-h2">{t.check.connection}</legend>
        <Field id="f-discom" label={t.check.discom} help={t.check.discomHelp} status={chip("discom")} error={show("discom")}
          note={unsupported ? <p className="flex items-start gap-1.5 type-small text-warn"><WarningCircle weight="bold" className="mt-1 shrink-0" aria-hidden="true" />{t.check.unsupported}</p> : note("discom")}>
          {input("discom", { autoComplete: "off", spellCheck: false })}
        </Field>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span id="cat-label" className="font-semibold">{t.check.category}</span>
            {chip("category")}
          </div>
          <p className="type-small text-muted -mt-1">{t.check.categoryHelp}</p>
          <div role="radiogroup" aria-labelledby="cat-label" className="grid grid-cols-3 gap-3">
            {(["domestic", "non_domestic", "other"] as Category[]).map((c) => (
              <label key={c} className={`flex h-12 items-center gap-2.5 rounded-[var(--radius-input)] border px-4 transition-colors ${v.category === c ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:border-ink/60"}`}>
                <input type="radio" name="category" value={c} checked={v.category === c} onChange={() => set("category")(c)} className="sr-only" />
                <span aria-hidden="true" className={`size-4 rounded-full border-2 ${v.category === c ? "border-marigold bg-marigold" : "border-line-strong"}`} />
                {t.check.categories[c]}
              </label>
            ))}
          </div>
          {note("category")}
        </div>
        <Field id="f-load" label={t.check.load} help={<>{t.check.loadHelp} <TermHelp k="sanctioned_load" /></>} status={chip("load")} error={show("load")} note={note("load")}>
          <div className="relative w-48">
            {input("load", { inputMode: "decimal", autoComplete: "off" })}
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">kW</span>
          </div>
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-5 type-h2">{t.check.use}</legend>
        <div className="grid grid-cols-2 gap-6">
          <Field id="f-units" label={t.check.units} help={t.check.unitsHelp} status={chip("units")} error={show("units")} note={note("units")}>
            {input("units", { inputMode: "decimal", autoComplete: "off" })}
          </Field>
          <Field id="f-days" label={t.check.days} help={t.check.daysHelp} status={chip("days")} error={show("days")} note={note("days")}>
            {input("days", { inputMode: "numeric", autoComplete: "off" })}
          </Field>
        </div>
        <Field id="f-history" label={t.check.history} help={t.check.historyHelp} status={chip("history")} error={show("history")} note={note("history")}>
          {input("history", { inputMode: "text", autoComplete: "off", placeholder: t.check.historyPlaceholder })}
          {historyCount > 0 && !errors.history && <HistoryBars values={parseHistory(v.history)} label={t.check.historyCount(historyCount)} />}
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
        <Button type="submit">{manual || noSource ? t.check.manualConfirm : t.check.confirm}</Button>
        {!manual && <ButtonLink to="/bill" variant="tertiary">{t.check.different}</ButtonLink>}
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-10">
      <Steps steps={t.steps.bill} current={1} label={t.steps.label} />
      <div className="mt-10 grid grid-cols-12 gap-12">
        <div className="col-span-7 flex flex-col gap-10">
          <div>
            <h1 tabIndex={-1} className="type-h1 focus:outline-none">{manual || noSource ? t.check.manualTitle : t.check.title}</h1>
            <p className="mt-4 max-w-[60ch] type-prose text-ink-2">{manual || noSource ? t.check.manualLead : t.check.lead}</p>
            {!manual && billRead?.checked_by_two_readers && (
              <p className="mt-3 flex items-center gap-2 type-small text-good"><CheckCircle weight="fill" aria-hidden="true" /> {t.check.twoReaders}</p>
            )}
          </div>
          {form}
        </div>
        <aside className="col-span-5">
          <div className="sticky top-[96px]">
            {preview && !manual ? <BillViewer url={preview.url} type={preview.type} /> : <SampleBill />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function HistoryBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-3 pt-1">
      <div className="flex h-10 items-end gap-1" aria-hidden="true">
        {values.slice(0, 12).map((u, i) => (
          <span key={i} className="w-3 rounded-t-sm bg-solar" style={{ height: `${Math.max(8, (u / max) * 100)}%` }} />
        ))}
      </div>
      <span className="type-small text-muted">{label}</span>
    </div>
  );
}

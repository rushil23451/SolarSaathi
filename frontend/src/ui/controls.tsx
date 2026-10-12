import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { CheckCircle, PencilSimple, WarningCircle, Question } from "@phosphor-icons/react";

type Variant = "primary" | "secondary" | "tertiary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out " +
  "active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-marigold text-ink px-6 h-14 text-[18px] shadow-[inset_0_-2px_0_rgb(20_33_61/0.18)] hover:bg-[#ffb81a] " +
    "hover:shadow-[inset_0_-2px_0_rgb(20_33_61/0.24),0_6px_18px_-8px_rgb(242_169_0/0.8)]",
  secondary: "bg-surface text-ink px-5 h-12 border border-ink/80 hover:bg-ink hover:text-paper",
  tertiary: "text-grid underline underline-offset-4 decoration-1 hover:decoration-2 px-1 h-10 font-medium",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`spin inline-block size-[1.05em] rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

/** Loading keeps the label and adds a spinner (Vercel guideline); the button is disabled meanwhile. */
export function Button({ variant = "primary", loading, icon, children, className = "", disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", icon, children, className = "", ...rest }: LinkProps & { variant?: Variant; icon?: ReactNode }) {
  return (
    <Link {...rest} viewTransition className={`${base} ${variants[variant]} ${className}`}>
      {icon}
      {children}
    </Link>
  );
}

export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-3 type-small text-muted">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3" aria-current={i === current ? "step" : undefined}>
            <span
              className={`grid size-7 place-items-center rounded-full nums text-[13px] font-semibold ${
                i < current ? "bg-ink text-paper" : i === current ? "bg-marigold text-ink" : "border border-line-strong"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={i === current ? "text-ink font-semibold" : ""}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden="true" className="h-px w-8 bg-line-strong" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type FieldStatus = "from_bill" | "edited" | "check" | "missing" | "typed";

export function StatusChip({ status, labels }: { status: FieldStatus; labels: Record<FieldStatus, string> }) {
  const style: Record<FieldStatus, string> = {
    from_bill: "text-muted",
    typed: "text-muted",
    edited: "text-marigold-text",
    check: "text-warn bg-warn-soft",
    missing: "text-bad bg-bad-soft",
  };
  const icon: Record<FieldStatus, ReactNode> = {
    from_bill: <CheckCircle weight="regular" />,
    typed: <PencilSimple />,
    edited: <span className="size-2 rounded-full bg-marigold" />,
    check: <WarningCircle weight="bold" />,
    missing: <Question weight="bold" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 type-small ${style[status]}`}>
      <span aria-hidden="true" className="inline-flex">{icon[status]}</span>
      {labels[status]}
    </span>
  );
}

interface FieldProps {
  id: string;
  label: string;
  help?: ReactNode;
  status?: ReactNode;
  error?: string | null;
  note?: ReactNode;
  children: ReactNode;
}

/** Label above, one-line help under it, the control, then an error linked by aria-describedby. */
export function Field({ id, label, help, status, error, note, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {status}
      </div>
      {help && (
        <p id={`${id}-help`} className="type-small text-muted -mt-1">
          {help}
        </p>
      )}
      {children}
      {note}
      {error && (
        <p id={`${id}-error`} className="type-small text-bad flex items-center gap-1.5" role="alert">
          <WarningCircle aria-hidden="true" weight="bold" /> {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-[var(--radius-input)] border border-line-strong bg-surface px-3.5 text-[17px] nums " +
  "transition-[border-color,box-shadow] duration-150 hover:border-ink/60 " +
  "focus:border-grid focus:outline-none focus:shadow-[0_0_0_3px_rgb(42_91_215/0.25)] " +
  "aria-[invalid=true]:border-bad";

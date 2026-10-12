// Wordmark: the "S" is built from seven-segment meter strokes, followed by the name in wide Anek.
export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#14213D" />
      <g fill="#F2A900">
        <rect x="10" y="6" width="12" height="3" rx="1.5" />
        <rect x="7" y="9" width="3" height="6" rx="1.5" />
        <rect x="10" y="14.5" width="12" height="3" rx="1.5" />
        <rect x="22" y="17" width="3" height="6" rx="1.5" />
        <rect x="10" y="23" width="12" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5" translate="no">
      <Mark />
      <span className="text-[22px] font-[720] [font-stretch:122%] tracking-[-0.01em]">SolarSaathi</span>
    </span>
  );
}

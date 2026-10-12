// The signature element: a seven-segment readout like the electricity meter on every wall.
// Unlit segments stay faintly visible, as on a real LCD.
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

// Segment polygons on a 40 x 70 digit cell, slightly slanted like real meter displays.
const SHAPES: Record<string, string> = {
  a: "9,2 33,2 29,8 13,8",
  b: "34,4 37,8 35,32 31,30 33,10",
  c: "31,40 35,38 33,62 29,66 29,46",
  d: "7,68 27,68 31,62 9,62",
  e: "3,38 7,40 5,58 2,66 0,62",
  f: "5,6 9,8 7,30 3,32 2,10",
  g: "6,35 10,32 30,32 34,35 30,38 10,38",
};

function Digit({ ch, x, lit, unlit }: { ch: string; x: number; lit: string; unlit: string }) {
  const on = SEGMENTS[ch] ?? "";
  return (
    <g transform={`translate(${x} 0) skewX(-6)`}>
      {Object.entries(SHAPES).map(([seg, pts]) => (
        <polygon
          key={seg}
          points={pts}
          fill={on.includes(seg) ? lit : unlit}
          style={{ transition: "fill 220ms ease-out" }}
        />
      ))}
    </g>
  );
}

interface MeterProps {
  value: number | string;
  digits?: number;
  unit?: string;
  caption?: string;
  tone?: "ink" | "marigold";
  className?: string;
  label: string; // accessible text, e.g. "367 units this month"
}

export function Meter({ value, digits = 5, unit, caption, tone = "ink", className = "", label }: MeterProps) {
  const text = String(value).padStart(digits, " ").slice(-digits);
  const lit = tone === "marigold" ? "#f2a900" : "#f8f9f6";
  const unlit = "rgb(248 249 246 / 0.07)";
  const w = digits * 46;
  return (
    <figure
      role="img"
      aria-label={label}
      className={`relative rounded-[var(--radius-meter)] bg-ink p-6 pb-5 text-paper shadow-[var(--shadow-lift)] ${className}`}
    >
      <div className="rounded-[12px] bg-[#0b1426] px-5 py-4 shadow-[inset_0_2px_10px_rgb(0_0_0/0.45)]">
        <svg viewBox={`-4 -2 ${w + 4} 74`} className="block w-full" aria-hidden="true">
          {[...text].map((ch, i) => (
            <Digit key={i} ch={ch} x={i * 46} lit={lit} unlit={unlit} />
          ))}
        </svg>
      </div>
      {(unit || caption) && (
        <figcaption className="mt-3 flex flex-col type-small" aria-hidden="true">
          <span className="font-semibold text-paper/90">{unit}</span>
          <span className="text-paper/60">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}

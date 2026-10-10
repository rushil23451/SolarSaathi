// Numbers for people: Indian digit grouping (₹1,24,000), units joined by a non-breaking space.
const NBSP = " ";
const intFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export const num = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "—" : (digits ? oneFmt : intFmt).format(n);

export const inr = (n: number | null | undefined) => (n == null ? "—" : `${n < 0 ? "−" : ""}₹${intFmt.format(Math.abs(Math.round(n)))}`);

/** ₹3.64 lakh for big amounts, plain rupees below one lakh. */
export const inrShort = (n: number, lakhWord = "lakh") =>
  Math.abs(n) >= 100000 ? `${n < 0 ? "−" : ""}₹${oneFmt.format(Math.abs(n) / 100000)}${NBSP}${lakhWord}` : inr(n);

export const kw = (n: number | null | undefined) => `${num(n, 1)}${NBSP}kW`;
export const withUnit = (n: number | null | undefined, unit: string, digits = 0) => `${num(n, digits)}${NBSP}${unit}`;

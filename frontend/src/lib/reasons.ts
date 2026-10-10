// "Why we think so": 2-4 short observations chosen by plain rules from the report's own
// numbers (no AI). Order = what matters most for the verdict.
import type { Analysis } from "../types/api";
import type { Dict } from "../i18n/en";

export function reasons(r: Analysis, t: Dict["report"]["reasons"]): string[] {
  const out: string[] = [];
  const units = r.monthly_units ?? 0;
  const limit = r.free_units_limit ?? null;
  const payback = r.payback_years ?? null;

  if (r.bill_now && r.bill_now.payable < 1 && limit) out.push(t.already_free(limit));
  else if (units >= 300) out.push(t.high_use(units));
  else if (units < 150) out.push(t.low_use(units));

  if (r.system_kw && r.bill_now && r.bill_now.payable >= 1) {
    if (limit && r.zero_bill_months === 12) out.push(t.free_all(limit));
    else if (limit && (r.zero_bill_months ?? 0) > 0) out.push(t.free_some(r.zero_bill_months!, limit));
    else if ((r.coverage_pct ?? 0) >= 50) out.push(t.coverage(r.coverage_pct!));
  }

  if (r.system_kw) {
    if (payback == null) out.push(t.payback_none);
    else if (payback <= 7) out.push(t.payback_fast(payback));
    else out.push(t.payback_slow(payback));
  }

  if (r.flags?.includes("load_increase") && r.size?.sanctioned_load_kw) out.push(t.load_limit(r.size.sanctioned_load_kw));
  else if (r.subsidy_detail?.eligible && r.central_subsidy) out.push(t.subsidy(r.central_subsidy));
  else if (r.flags?.includes("not_eligible_central_subsidy")) out.push(t.no_subsidy);

  if (r.flags?.includes("single_month")) out.push(t.one_month);
  return out.slice(0, 4);
}

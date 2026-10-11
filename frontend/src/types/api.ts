// Shapes returned by the SolarSaathi backend (backend/src/solarsaathi). Keep in sync with
// extract.normalize_bill, calc.analyse and quote_rules.run_all.

export type JobStatus = "pending" | "done" | "error";

export interface Job<T> {
  jobId: string;
  type?: string;
  status: JobStatus;
  result?: T | null;
  error?: string | null;
}

export type Category = "domestic" | "non_domestic" | "other";

export type BillWarning =
  | "category_unclear"
  | "load_in_kva"
  | "load_missing"
  | "units_from_readings"
  | "units_mismatch"
  | "days_from_dates"
  | "units_missing"
  | "days_assumed_30"
  | "history_row_dropped"
  | "no_history"
  | "low_confidence";

export interface HistoryRow {
  units: number;
  days: number;
  period_start?: string | null;
  period_end?: string | null;
}

export interface Bill {
  discom: string | null;
  category: Category;
  sanctioned_load_kw: number | null;
  billing_period_days: number | null;
  units_billed: number | null;
  history: HistoryRow[];
  current_charges_inr?: number | null;
  amount_payable_inr?: number | null;
  bill_month?: string | null;
  notes?: string | null;
  period_start?: string | null; // this bill's own period, from the meter reading dates
  period_end?: string | null;
  warnings: BillWarning[];
}

export interface BillBreakdown {
  units: number;
  energy: number;
  fixed: number;
  ppac: number;
  surcharges_and_tax: number;
  gross: number;
  state_subsidy: number;
  payable: number;
}

export interface MonthRow {
  month: number; // 1-12
  use: number;
  solar: number;
  grid: number;
  now: number;
  with_solar: number;
  from_bills?: boolean; // false: the bills don't cover this month, so it uses the average
}

export interface YearPoint {
  year: number;
  cumulative: number;
}

export interface CashFlow {
  payback_years: number | null;
  net_25: number;
  total_saved: number;
  total_costs: number;
  maintenance_year: number;
  inverter_cost: number;
  years: YearPoint[];
}

export interface Scenario {
  growth_pct: number;
  payback_years: number | null;
  net_25: number;
  years: YearPoint[];
}

export type Verdict = "yes" | "maybe" | "not_worth" | "unsupported_discom";

export type Reason =
  | "good_payback"
  | "medium_payback"
  | "long_payback"
  | "low_usage"
  | "already_low_bill"
  | "load_limit"
  | "too_small";

export type Flag = "single_month" | "load_increase" | "not_eligible_central_subsidy" | "state_subsidy_now";

export interface Analysis {
  verdict: Verdict;
  reason?: Reason;
  discom?: string | null;
  tariff_id?: string;
  tariff_name?: string;
  category?: Category;
  monthly_units?: number;
  ghi?: number;
  ghi_source?: string;
  bill_now?: BillBreakdown;
  flags?: Flag[];
  working?: { key: string; value: string; note: string }[];
  system_kw?: number;
  size?: {
    needed_kw: number;
    limited_by: "need" | "sanctioned_load" | "roof";
    coverage_target_pct: number;
    yield_per_kw_year: number;
    sanctioned_load_kw: number | null;
    roof_limit_kw: number | null;
    step_kw: number;
    panels: number;
    panel_watt: number;
    roof_sqft: number;
  };
  solar_units_month?: number;
  grid_units_month?: number;
  coverage_pct?: number;
  cost_low?: number;
  cost_high?: number;
  cost_mid?: number;
  central_subsidy?: number;
  subsidy_detail?: { eligible: false } | {
    eligible: true;
    first_kw: number;
    first_rate: number;
    third_kw: number;
    third_rate: number;
    cap: number;
  };
  state_incentive?: number;
  net_cost?: number;
  bill_with_solar?: BillBreakdown;
  zero_bill_months?: number;
  free_units_limit?: number | null;
  monthly_saving?: number;
  annual_benefit?: number;
  payback_years?: number | null;
  lifetime_savings?: number;
  lifetime?: CashFlow;
  scenarios?: Scenario[];
  months?: MonthRow[];
  loan?: { amount: number; rate_pct: number; years: number; emi: number; net_monthly: number };
  co2_tonnes_year?: number;
  co2_tonnes_lifetime?: number;
  assumptions?: {
    performance_ratio: number;
    degradation_pct: number;
    tariff_growth_pct: number;
    maintenance_per_kw: number;
    inverter_year: number;
    inverter_per_kw: number;
    emission_kg_per_unit: number;
    lifetime_years: number;
  };
}

export interface AnalysisResponse {
  analysisId: string;
  result: Analysis;
}

export type CheckId = "price" | "dcr" | "almm" | "size" | "inverter" | "warranties" | "items" | "payment" | "subsidy";
export type CheckStatus = "green" | "amber" | "red" | "info";

export interface Check {
  id: CheckId;
  status: CheckStatus;
  params: Record<string, any>;
}

export interface Quote {
  vendor_name: string | null;
  system_kw: number | null;
  price_total_inr: number | null;
  gst_included: boolean | null;
  panel_maker: string | null;
  panel_model: string | null;
  panel_wattage_w?: number | null;
  dcr_stated: boolean | null;
  inverter: { maker: string | null; capacity_kw: number | null; type: string };
  warranties: Record<string, number | null>;
  included_items: string[];
  extra_charges: { item: string; amount_inr?: number | null }[];
  advance_pct: number | null;
  subsidy_handling: "vendor_files" | "not_mentioned" | "suspicious";
}

export interface QuoteReport {
  quote: Quote;
  overall: "green" | "amber" | "red";
  checks: Check[];
  advice: { summary: string; questions: string[] } | null;
}

export type Roof = "small" | "medium" | "large" | "unknown";

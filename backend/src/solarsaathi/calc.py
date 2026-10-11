"""The calculation engine. Every number the user sees comes from here, never from the AI.

Input is a *confirmed* bill (the user has checked what the AI read). Output is a plain dict
that the API returns as-is and the frontend renders.
"""

import math

from . import config, tariff


def average_monthly_units(bill: dict) -> tuple[float, int]:
    """Average use per 30 days over the current bill and any history rows.

    Returns (units_per_month, number_of_periods_used). Bills can cover 27-91 days, so each
    period is scaled to 30 days before averaging.
    """
    periods = []
    if bill.get("units_billed"):
        periods.append((bill["units_billed"], bill.get("billing_period_days") or 30))
    for row in bill.get("history") or []:
        if row.get("units"):
            periods.append((row["units"], row.get("days") or 30))
    if not periods:
        raise ValueError("bill has no consumption figures")
    per_month = [units * 30 / max(days, 1) for units, days in periods]
    return sum(per_month) / len(per_month), len(per_month)


def central_subsidy(kw: float, category: str) -> float:
    rules = config.solar()["central_subsidy"]
    if category not in rules["categories"] or kw <= 0:
        return 0.0
    amount = rules["per_kw_first_2"] * min(kw, 2) + rules["per_kw_third"] * max(0.0, min(kw, 3) - 2)
    return min(amount, rules["cap_inr"])


def cost_range(kw: float) -> tuple[float, float]:
    for band in config.solar()["cost_per_kw_inr"]:
        if band["up_to_kw"] is None or kw <= band["up_to_kw"]:
            return kw * band["low"], kw * band["high"]
    raise ValueError("no cost band")


def _floor_to_step(value: float, step: float) -> float:
    return math.floor(value / step + 1e-9) * step


def analyse(bill: dict, ghi: dict, roof: str = "unknown") -> dict:
    s = config.solar()
    tariff_id = config.find_tariff_id(bill.get("discom"))
    if tariff_id is None:
        return {"verdict": "unsupported_discom", "discom": bill.get("discom")}

    category = bill.get("category") or "domestic"
    load_kw = float(bill.get("sanctioned_load_kw") or 0)
    monthly_units, periods = average_monthly_units(bill)
    flags, working = [], []

    # Step 2: how much 1 kW of panels makes here
    yield_per_kw_year = ghi["ghi"] * 365 * s["performance_ratio"]
    working.append({"key": "sunlight", "value": f"{ghi['ghi']:.2f} kWh/m²/day", "note": ghi["source"]})
    working.append({"key": "yield_per_kw", "value": f"{yield_per_kw_year:.0f} units/year",
                    "note": f"sunlight × 365 × performance ratio {s['performance_ratio']}"})
    working.append({"key": "monthly_units", "value": f"{monthly_units:.0f} units/month",
                    "note": f"average of {periods} billing period(s), each scaled to 30 days"})
    if periods == 1:
        flags.append("single_month")

    # Step 3: recommended size
    needed_kw = s["coverage_target"] * monthly_units * 12 / yield_per_kw_year
    caps = {"need": needed_kw}
    if load_kw > 0:
        caps["sanctioned_load"] = load_kw
    roof_limit = s["roof_limits_kw"].get(roof)
    if roof_limit:
        caps["roof"] = roof_limit
    limit_by = min(caps, key=caps.get)
    kw = _floor_to_step(caps[limit_by], s["size_step_kw"])
    if kw < s["min_system_kw"]:
        kw = 0.0
    if limit_by == "sanctioned_load" and needed_kw - load_kw >= s["size_step_kw"]:
        flags.append("load_increase")
    working.append({"key": "size", "value": f"{kw:g} kW",
                    "note": f"covers {int(s['coverage_target'] * 100)}% of use = {needed_kw:.2f} kW, "
                            f"limited by {limit_by.replace('_', ' ')}, rounded down to {s['size_step_kw']} kW"})

    # Step 5: bill now (needed even when we recommend nothing)
    bill_now = tariff.monthly_bill(monthly_units, load_kw, category, tariff_id)
    if bill_now["state_subsidy"] > 0:
        flags.append("state_subsidy_now")
    if category not in s["central_subsidy"]["categories"]:
        flags.append("not_eligible_central_subsidy")

    base = {
        "tariff_id": tariff_id,
        "tariff_name": config.tariffs()[tariff_id]["name"],
        "category": category,
        "monthly_units": round(monthly_units),
        "ghi": round(ghi["ghi"], 2),
        "ghi_source": ghi["source"],
        "bill_now": bill_now,
        "flags": flags,
        "working": working,
    }

    if kw == 0:
        reason = "load_limit" if limit_by == "sanctioned_load" else "too_small"
        if monthly_units < s["verdict"]["min_monthly_units"]:
            reason = "low_usage"
        return {**base, "verdict": "not_worth", "reason": reason, "system_kw": 0}

    # Step 4: cost and subsidy
    cost_low, cost_high = cost_range(kw)
    cost_mid = (cost_low + cost_high) / 2
    subsidy = central_subsidy(kw, category)
    state = s["state_incentives"].get(tariff_id, {})
    state_capital = min(kw * state["capital_per_kw"], state["capital_cap_inr"]) if state.get("enabled") else 0.0
    net_cost = max(0.0, cost_mid - subsidy - state_capital)
    working.append({"key": "cost", "value": f"₹{cost_low:,.0f} – ₹{cost_high:,.0f}",
                    "note": s["cost_source"]})
    working.append({"key": "subsidy", "value": f"₹{subsidy:,.0f}",
                    "note": s["central_subsidy"]["name"] + ("" if subsidy else " (residential connections only)")})

    # Step 5: month by month, because sunlight changes through the year and slab tariffs (and
    # Delhi's free-200-units rule) depend on each month's units. Surplus export is ignored.
    months = month_by_month(kw, monthly_units, ghi, load_kw, category, tariff_id, seasonal_use(bill, monthly_units))
    annual_saving = sum(m["saving"] for m in months)
    monthly_saving = annual_saving / 12
    solar_units_year = sum(m["solar"] for m in months)
    use_year = sum(m["use"] for m in months)
    grid_units_month = sum(m["grid"] for m in months) / 12
    coverage_pct = min(100.0, solar_units_year / use_year * 100) if use_year else 0.0
    bill_now = average_bill([m["bill_now"] for m in months])
    bill_solar = average_bill([m["bill_solar"] for m in months])
    zero_bill_months = sum(1 for m in months if m["bill_solar"]["payable"] <= 0)
    state_rules = config.tariffs()[tariff_id].get("state_subsidy") or {}
    free_limit = state_rules.get("free_up_to_units") if category in state_rules.get("categories", []) else None
    working.append({"key": "bill_with_solar", "value": f"₹{bill_solar['payable']:,.0f}/month",
                    "note": f"average of 12 months; solar covers {coverage_pct:.0f}% of use; "
                            f"{grid_units_month:.0f} units/month still from the grid; export credit ignored"})

    # Step 6: 25-year cash flow, payback, CO2, loan
    gbi_on = bool(state.get("enabled"))
    gbi_year = solar_units_year * state["gbi_per_kwh"] if gbi_on else 0.0
    flow = cash_flow(net_cost, annual_saving, kw, gbi_year, state.get("gbi_years", 0) if gbi_on else 0)
    payback = flow["payback_years"]
    co2_t = solar_units_year * s["grid_emission_kg_per_kwh"] / 1000
    co2_lifetime = sum(co2_t * (1 - s["degradation_per_year"]) ** y for y in range(s["lifetime_years"]))
    working.append({"key": "co2", "value": f"{co2_t:.1f} t/year",
                    "note": f"{s['grid_emission_kg_per_kwh']} kg CO₂ per unit — {s['grid_emission_source']}"})
    loan = s["loan"]
    emi = loan_emi(net_cost, loan["rate_pct"], loan["years"])
    # The same cash flow if electricity prices rise slower or faster than we assume.
    scenarios = []
    for g in s["tariff_growth_scenarios_pct"]:
        alt = cash_flow(net_cost, annual_saving, kw, gbi_year, state.get("gbi_years", 0) if gbi_on else 0, growth_pct=g)
        scenarios.append({"growth_pct": g, "payback_years": alt["payback_years"], "net_25": alt["net_25"],
                          "years": alt["years"]})

    # Step 7: the honest verdict
    v = s["verdict"]
    if monthly_units < v["min_monthly_units"]:
        verdict, reason = "not_worth", "low_usage"
    elif bill_now["payable"] < v["min_monthly_bill_inr"]:
        verdict, reason = "not_worth", "already_low_bill"
    elif payback is None or payback > v["ok_payback_years"]:
        verdict, reason = "not_worth", "long_payback"
    elif payback > v["good_payback_years"]:
        verdict, reason = "maybe", "medium_payback"
    else:
        verdict, reason = "yes", "good_payback"

    return {
        **base,
        "bill_now": bill_now,
        "verdict": verdict,
        "reason": reason,
        "system_kw": kw,
        "size": {"needed_kw": round(needed_kw, 2), "limited_by": limit_by,
                 "coverage_target_pct": round(s["coverage_target"] * 100),
                 "yield_per_kw_year": round(yield_per_kw_year), "sanctioned_load_kw": load_kw or None,
                 "roof_limit_kw": roof_limit, "step_kw": s["size_step_kw"],
                 "panels": math.ceil(kw * 1000 / s["panel_watt"]), "panel_watt": s["panel_watt"],
                 "roof_sqft": round(kw * s["roof_sqft_per_kw"])},
        "solar_units_month": round(solar_units_year / 12),
        "grid_units_month": round(grid_units_month),
        "coverage_pct": round(coverage_pct),
        "cost_low": round(cost_low),
        "cost_high": round(cost_high),
        "cost_mid": round(cost_mid),
        "central_subsidy": round(subsidy),
        "subsidy_detail": subsidy_detail(kw, category),
        "state_incentive": round(state_capital),
        "net_cost": round(net_cost),
        "bill_with_solar": bill_solar,
        "zero_bill_months": zero_bill_months,
        "free_units_limit": free_limit,
        "monthly_saving": round(monthly_saving),
        "annual_benefit": round(annual_saving + gbi_year),
        "payback_years": payback,
        "lifetime_savings": flow["net_25"],
        "lifetime": flow,
        "scenarios": scenarios,
        "months": [{k: m[k] for k in ("month", "use", "solar", "grid", "now", "with_solar", "from_bills")} for m in months],
        "loan": {"amount": round(net_cost), "rate_pct": loan["rate_pct"], "years": loan["years"],
                 "emi": round(emi), "net_monthly": round(monthly_saving - emi)},
        "co2_tonnes_year": round(co2_t, 1),
        "co2_tonnes_lifetime": round(co2_lifetime),
        "assumptions": {
            "performance_ratio": s["performance_ratio"], "degradation_pct": s["degradation_per_year"] * 100,
            "tariff_growth_pct": s["tariff_growth_pct_per_year"], "maintenance_per_kw": s["maintenance_inr_per_kw_year"],
            "inverter_year": s["inverter_replacement"]["year"], "inverter_per_kw": s["inverter_replacement"]["inr_per_kw"],
            "emission_kg_per_unit": s["grid_emission_kg_per_kwh"], "lifetime_years": s["lifetime_years"],
        },
    }


MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def seasonal_use(bill: dict, monthly_units: float) -> list[tuple[float, bool]]:
    """Units per day for each calendar month, and whether it comes from the person's own bills.

    Every billing period with dates (this bill and the history rows) spreads its units evenly over
    its days; a month covered by at least a week of those days gets its real daily rate. Months the
    bills don't cover fall back to the overall average. So winter and summer differ when the bills
    show it, instead of every month being the same.
    """
    from datetime import date, timedelta

    periods = [(bill.get("period_start"), bill.get("period_end"), bill.get("units_billed"))]
    periods += [(h.get("period_start"), h.get("period_end"), h.get("units")) for h in bill.get("history") or []]
    units_by_month, days_by_month = [0.0] * 12, [0] * 12
    for start, end, units in periods:
        try:
            d0, d1 = date.fromisoformat(str(start)), date.fromisoformat(str(end))
        except ValueError:
            continue
        n = (d1 - d0).days + 1
        if not units or not 1 <= n <= 120:
            continue
        for k in range(n):
            m = (d0 + timedelta(days=k)).month - 1
            units_by_month[m] += units / n
            days_by_month[m] += 1
    average = monthly_units * 12 / 365
    return [(units_by_month[m] / days_by_month[m], True) if days_by_month[m] >= 7 else (average, False) for m in range(12)]


def month_by_month(kw: float, monthly_units: float, ghi: dict, load_kw: float, category: str, tariff_id: str,
                   use_per_day: list[tuple[float, bool]] | None = None) -> list[dict]:
    """Solar follows each month's sunlight (NASA monthly averages); use follows the person's own
    bills where they cover that month, otherwise their average."""
    pr = config.solar()["performance_ratio"]
    sun = ghi.get("monthly") or [ghi["ghi"]] * 12
    rates = use_per_day or [(monthly_units * 12 / 365, False)] * 12
    out = []
    for i, days in enumerate(MONTH_DAYS):
        use = rates[i][0] * days
        solar = kw * sun[i] * days * pr
        grid = max(0.0, use - solar)
        now = tariff.monthly_bill(use, load_kw, category, tariff_id)
        with_solar = tariff.monthly_bill(grid, load_kw, category, tariff_id)
        out.append({"month": i + 1, "use": round(use), "solar": round(solar), "grid": round(grid),
                    "now": round(now["payable"]), "with_solar": round(with_solar["payable"]),
                    "from_bills": rates[i][1], "bill_now": now, "bill_solar": with_solar,
                    "saving": max(0.0, now["payable"] - with_solar["payable"])})
    return out


def average_bill(bills: list[dict]) -> dict:
    return {k: round(sum(b[k] for b in bills) / len(bills), 2) for k in bills[0]}


def subsidy_detail(kw: float, category: str) -> dict:
    rules = config.solar()["central_subsidy"]
    if category not in rules["categories"]:
        return {"eligible": False}
    return {"eligible": True, "first_kw": min(kw, 2), "first_rate": rules["per_kw_first_2"],
            "third_kw": round(max(0.0, min(kw, 3) - 2), 2), "third_rate": rules["per_kw_third"], "cap": rules["cap_inr"]}


def loan_emi(principal: float, rate_pct: float, years: int) -> float:
    r, n = rate_pct / 100 / 12, years * 12
    if principal <= 0:
        return 0.0
    return principal / n if r == 0 else principal * r * (1 + r) ** n / ((1 + r) ** n - 1)


def cash_flow(net_cost: float, first_year_saving: float, kw: float, gbi_year: float = 0.0, gbi_years: int = 0,
              growth_pct: float | None = None) -> dict:
    """Money in and out over the system's life. Savings grow with electricity prices and shrink
    as panels age; yearly maintenance and one inverter replacement are subtracted."""
    s = config.solar()
    growth = (s["tariff_growth_pct_per_year"] if growth_pct is None else growth_pct) / 100
    degr = s["degradation_per_year"]
    maintenance = s["maintenance_inr_per_kw_year"] * kw
    inv = s["inverter_replacement"]
    cumulative, payback, saved, costs = -net_cost, None, 0.0, 0.0
    years = [{"year": 0, "cumulative": round(-net_cost)}]
    for y in range(1, s["lifetime_years"] + 1):
        saving = first_year_saving * (1 + growth) ** (y - 1) * (1 - degr) ** (y - 1) + (gbi_year if y <= gbi_years else 0)
        cost = maintenance + (inv["inr_per_kw"] * kw if y == inv["year"] else 0)
        before = cumulative
        cumulative += saving - cost
        saved, costs = saved + saving, costs + cost
        if payback is None and cumulative >= 0 and saving > cost:
            payback = round(y - 1 + (-before) / (saving - cost), 1)
        years.append({"year": y, "cumulative": round(cumulative)})
    return {"payback_years": payback, "net_25": round(cumulative), "total_saved": round(saved),
            "total_costs": round(costs), "maintenance_year": round(maintenance),
            "inverter_cost": round(inv["inr_per_kw"] * kw), "years": years}

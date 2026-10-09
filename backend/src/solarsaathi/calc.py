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
    solar_units_month = kw * yield_per_kw_year / 12
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

    # Step 5: bill with solar. Monthly netting; surplus export credit ignored (conservative).
    bill_solar = tariff.monthly_bill(monthly_units - solar_units_month, load_kw, category, tariff_id)
    monthly_saving = max(0.0, bill_now["payable"] - bill_solar["payable"])
    gbi = solar_units_month * 12 * state["gbi_per_kwh"] if state.get("enabled") else 0.0
    annual_benefit = monthly_saving * 12 + gbi
    working.append({"key": "bill_with_solar", "value": f"₹{bill_solar['payable']:,.0f}/month",
                    "note": f"net {max(0, monthly_units - solar_units_month):.0f} units after "
                            f"{solar_units_month:.0f} solar units; monthly netting, export credit ignored"})

    # Step 6: payback, lifetime, CO2
    payback = net_cost / annual_benefit if annual_benefit > 0 else None
    lifetime = sum(annual_benefit * (1 - s["degradation_per_year"]) ** y for y in range(s["lifetime_years"]))
    co2_t = solar_units_month * 12 * s["grid_emission_kg_per_kwh"] / 1000
    working.append({"key": "co2", "value": f"{co2_t:.1f} t/year",
                    "note": f"{s['grid_emission_kg_per_kwh']} kg CO₂ per unit — {s['grid_emission_source']}"})

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
        "verdict": verdict,
        "reason": reason,
        "system_kw": kw,
        "solar_units_month": round(solar_units_month),
        "cost_low": round(cost_low),
        "cost_high": round(cost_high),
        "central_subsidy": round(subsidy),
        "state_incentive": round(state_capital),
        "net_cost": round(net_cost),
        "bill_with_solar": bill_solar,
        "monthly_saving": round(monthly_saving),
        "annual_benefit": round(annual_benefit),
        "payback_years": round(payback, 1) if payback else None,
        "lifetime_savings": round(lifetime - net_cost),
        "co2_tonnes_year": round(co2_t, 1),
    }

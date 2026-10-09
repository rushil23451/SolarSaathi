"""Monthly electricity bill for a given number of units, following a discom's tariff order."""

from . import config


def _slab_energy_charge(units: float, slabs: list[dict]) -> float:
    charge, lower = 0.0, 0.0
    for slab in slabs:
        upper = slab["up_to"]
        if upper is None or units <= upper:
            return charge + (units - lower) * slab["rate"]
        charge += (upper - lower) * slab["rate"]
        lower = upper
    return charge


def _fixed_charge(load_kw: float, slabs: list[dict]) -> float:
    for slab in slabs:
        if slab["load_up_to_kw"] is None or load_kw <= slab["load_up_to_kw"]:
            return load_kw * slab["per_kw"]
    return 0.0


def _state_subsidy(units: float, gross: float, category: str, rules: dict | None) -> float:
    if not rules or category not in rules["categories"]:
        return 0.0
    if units <= rules["free_up_to_units"]:
        return gross
    if units <= rules["partial_up_to_units"]:
        return min(gross * rules["partial_share"], rules["partial_cap_inr"])
    return 0.0


def monthly_bill(
    units: float,
    load_kw: float,
    category: str,
    tariff_id: str,
    apply_state_subsidy: bool = True,
) -> dict:
    """Return the bill for one 30-day month, with each component shown separately."""
    tariff = config.tariffs()[tariff_id]
    cat = tariff["categories"].get(category) or tariff["categories"]["domestic"]
    units = max(0.0, units)

    energy = _slab_energy_charge(units, cat["energy_slabs"])
    fixed = _fixed_charge(load_kw, cat["fixed_charge_slabs"])
    base = energy + fixed
    ppac = base * cat["ppac_pct"] / 100
    surcharge = base * tariff["surcharge_pct"] / 100
    pension = base * tariff["pension_surcharge_pct"] / 100
    tax = base * tariff["electricity_tax_pct"] / 100
    gross = base + ppac + surcharge + pension + tax

    subsidy = _state_subsidy(units, gross, category, tariff.get("state_subsidy")) if apply_state_subsidy else 0.0
    return {
        "units": round(units, 1),
        "energy": round(energy, 2),
        "fixed": round(fixed, 2),
        "ppac": round(ppac, 2),
        "surcharges_and_tax": round(surcharge + pension + tax, 2),
        "gross": round(gross, 2),
        "state_subsidy": round(subsidy, 2),
        "payable": round(gross - subsidy, 2),
    }

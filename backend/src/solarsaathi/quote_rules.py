"""The nine quote checks. Fixed rules in plain code, so the verdict never depends on the AI.

Each check returns {"id", "status", "params"}. Status is green / amber / red, or "info" when
a check cannot run. The frontend turns id + status + params into a sentence in Hindi or English.
"""

from . import calc, config


def _check(cid: str, status: str, **params) -> dict:
    return {"id": cid, "status": status, "params": params}


def check_price(q: dict, ctx: dict) -> dict:
    kw, total = q.get("system_kw"), q.get("price_total_inr")
    if not kw or not total:
        return _check("price", "amber", missing=True)
    if q.get("gst_included") is False:
        total *= 1 + config.solar()["gst_effective_pct"] / 100
    low, high = calc.cost_range(kw)
    r = config.quote_rules()["price"]
    per_kw = total / kw
    pct_over = (total - high) / high * 100
    params = dict(price_per_kw=round(per_kw), low_per_kw=round(low / kw), high_per_kw=round(high / kw), pct_over=round(pct_over))
    if total < low * (1 - r["suspicious_below_pct"] / 100):
        return _check("price", "red", too_low=True, **params)
    if pct_over > r["red_over_pct"]:
        return _check("price", "red", **params)
    if pct_over > r["amber_over_pct"]:
        return _check("price", "amber", **params)
    return _check("price", "green", **params)


def check_dcr(q: dict, ctx: dict) -> dict:
    if q.get("dcr_stated") is True:
        return _check("dcr", "green" if q.get("panel_model") else "amber", model=q.get("panel_model"))
    return _check("dcr", "red", stated=q.get("dcr_stated"))


def check_almm(q: dict, ctx: dict) -> dict:
    rules = config.quote_rules()
    maker = (q.get("panel_maker") or "").strip()
    if not maker:
        return _check("almm", "amber", maker=None)
    found = any(m.lower() in maker.lower() or maker.lower() in m.lower() for m in rules["almm_makers"])
    if found:
        return _check("almm", "green", maker=maker)
    return _check("almm", "red" if rules["almm_list_complete"] else "amber", maker=maker)


def check_size(q: dict, ctx: dict) -> dict:
    kw, rec = q.get("system_kw"), ctx.get("recommended_kw")
    load = ctx.get("sanctioned_load_kw")
    if not kw:
        return _check("size", "amber", missing=True)
    if load and kw > load:
        return _check("size", "red", quoted=kw, load=load, above_load=True)
    if not rec:
        return _check("size", "info", quoted=kw)
    r = config.quote_rules()["size"]
    diff = kw - rec
    status = "green" if abs(diff) <= r["green_within_kw"] else "amber" if abs(diff) <= r["amber_within_kw"] else (
        "red" if diff > 0 else "amber")
    return _check("size", status, quoted=kw, recommended=rec)


def check_inverter(q: dict, ctx: dict) -> dict:
    inv = q.get("inverter") or {}
    kw, cap = q.get("system_kw"), inv.get("capacity_kw")
    if inv.get("type") == "off_grid":
        return _check("inverter", "red", type="off_grid")
    if inv.get("type") == "unknown" and not cap:
        return _check("inverter", "amber", missing=True)
    if kw and cap:
        r = config.quote_rules()["inverter"]
        ratio = cap / kw
        if not r["ratio_min"] <= ratio <= r["ratio_max"]:
            return _check("inverter", "amber", capacity=cap, system_kw=kw)
    return _check("inverter", "amber" if inv.get("type") == "hybrid" else "green", type=inv.get("type"), capacity=cap)


def check_warranties(q: dict, ctx: dict) -> dict:
    need = config.quote_rules()["warranties"]
    have = q.get("warranties") or {}
    missing = [k for k, years in need.items() if (have.get(k) or 0) < years]
    status = "green" if not missing else "amber" if len(missing) == 1 else "red"
    return _check("warranties", status, missing=missing)


def check_items(q: dict, ctx: dict) -> dict:
    required = config.quote_rules()["required_items"]
    extras = [c["item"] for c in q.get("extra_charges") or []]
    unclear = [i for i in required if i not in (q.get("included_items") or [])]
    if extras:
        return _check("items", "red", extras=extras, unclear=unclear)
    return _check("items", "green" if not unclear else "amber", unclear=unclear)


def check_payment(q: dict, ctx: dict) -> dict:
    adv = q.get("advance_pct")
    r = config.quote_rules()["payment"]
    if adv is None:
        return _check("payment", "amber", missing=True)
    status = "green" if adv <= r["green_max_advance_pct"] else "amber" if adv <= r["amber_max_advance_pct"] else "red"
    return _check("payment", status, advance_pct=adv)


def check_subsidy(q: dict, ctx: dict) -> dict:
    handling = q.get("subsidy_handling")
    status = {"vendor_files": "green", "suspicious": "red"}.get(handling, "amber")
    return _check("subsidy", status, handling=handling)


CHECKS = [check_price, check_dcr, check_almm, check_size, check_inverter,
          check_warranties, check_items, check_payment, check_subsidy]


def run_all(quote: dict, ctx: dict) -> dict:
    """ctx: {"recommended_kw": float|None, "sanctioned_load_kw": float|None} from the bill check."""
    checks = [fn(quote, ctx) for fn in CHECKS]
    statuses = [c["status"] for c in checks]
    if "red" in statuses:
        overall = "red"
    elif statuses.count("amber") >= 2:
        overall = "amber"
    else:
        overall = "green"
    return {"overall": overall, "checks": checks}

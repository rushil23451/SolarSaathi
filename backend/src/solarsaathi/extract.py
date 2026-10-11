"""Turn the model's raw JSON into clean, checked fields.

The model can misread a photo. Everything here is a sanity check in plain code, and every
field still goes to the user's confirmation screen before any calculation runs.
"""

from datetime import date

from . import llm, pages, prompts

CATEGORIES = {"domestic", "non_domestic", "other"}
QUOTE_ITEMS = {"mounting_structure", "dc_ac_cabling", "earthing", "lightning_arrester", "net_meter_process", "installation"}


class NotABill(Exception):
    pass


def _num(value, lo: float = 0, hi: float = 1e9) -> float | None:
    try:
        n = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def _units_from_readings(meter: dict) -> float | None:
    cur, prev = _num(meter.get("current_reading")), _num(meter.get("previous_reading"))
    factor = _num(meter.get("multiplication_factor"), 0.001, 10000) or 1.0
    if cur is None or prev is None or cur <= prev:
        return None
    used = (cur - prev) * factor
    return used if used <= 100000 else None


def _iso(value) -> str | None:
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError:
        return None


def _days_between(start, end) -> int | None:
    try:
        d = (date.fromisoformat(str(end)) - date.fromisoformat(str(start))).days
    except ValueError:
        return None
    return d if 1 <= d <= 100 else None  # bills cover 1-3 months; more means a misread date


def normalize_bill(raw: dict) -> dict:
    if raw.get("is_electricity_bill") is False:
        raise NotABill("this does not look like an electricity bill")

    warnings = []
    category = raw.get("category") if raw.get("category") in CATEGORIES else None
    if category is None:
        warnings.append("category_unclear")

    load = _num(raw.get("sanctioned_load"), 0.1, 500)
    if load is not None and str(raw.get("sanctioned_load_unit") or "").lower() == "kva":
        warnings.append("load_in_kva")  # treated as kW (power factor close to 1 for homes)
    if load is None:
        warnings.append("load_missing")

    meter = raw.get("meter") or {}
    # This bill's own period, so the calculation can place its use in the right months.
    period = (_iso(meter.get("previous_reading_date")), _iso(meter.get("current_reading_date")))
    # The Days and Unit cells of the kWh row are the same values as billing_period_days and
    # units_billed; use them when the top-level fields are missing.
    days = _num(raw.get("billing_period_days"), 1, 400) or _num(meter.get("days"), 1, 400)
    units = _num(raw.get("units_billed"), 0, 100000)
    if units is None:
        units = _num(meter.get("units"), 0, 100000)
    # "Total Units" in Billing Details is what the discom actually charged for. Shops are often
    # billed in kVAh, and models tend to copy the kWh row instead (1,156 instead of 1,220).
    total = _num(raw.get("billing_total_units"), 1, 100000)
    if total is not None and units is not None and abs(total - units) > 0.5:
        units = total
        meter = {}  # the readings belong to the other register; don't cross-check against them

    # Cross-check against the meter readings: models sometimes copy a cumulative reading
    # (e.g. 52146) where the period's units (e.g. 563) belong.
    readings = {_num(meter.get("current_reading")), _num(meter.get("previous_reading"))} - {None}
    metered = _units_from_readings(meter)
    if metered is not None:
        # A copied reading equals one of the readings, or dwarfs the metered use. (Comparing
        # against the readings' size alone fails on new meters with small readings, like 884.)
        copied_a_reading = units is not None and (
            any(abs(units - r) <= 1 for r in readings) or units > 5 * metered)
        if units is None or copied_a_reading:
            units = metered
            warnings.append("units_from_readings")
        elif abs(units - metered) > 0.15 * metered:
            # Readings on a blurry photo are often misread too, so don't overrule the
            # printed units; ask the user to check instead.
            warnings.append("units_mismatch")
    metered_days = _days_between(meter.get("previous_reading_date"), meter.get("current_reading_date"))
    if metered_days and (days is None or abs(days - metered_days) > 3):
        days = metered_days
        warnings.append("days_from_dates")

    if units is None:
        warnings.append("units_missing")
    if days is None:
        days = 30
        warnings.append("days_assumed_30")

    history = []
    for row in raw.get("history") or []:
        if not isinstance(row, dict):
            continue
        u = _num(row.get("units"), 0, 100000)
        row_days = _num(row.get("days"), 1, 400)
        # Bills count both ends of the period (27-03 to 25-04 is 30 days), so trust the dates
        # when the Days cell was misread.
        span = _days_between(row.get("period_start"), row.get("period_end"))
        if span and (row_days is None or abs(row_days - (span + 1)) > 2):
            row_days = span + 1
        amount = _num(row.get("bill_amount"), 0, 1e7)
        if u is None or u in readings or (amount is not None and u == amount):
            continue  # a meter reading or the bill amount copied into the Units column
        if u == units and (row_days is None or abs(row_days - days) <= 1):
            continue  # the current bill repeated as a history row
        if units and not units / 8 <= u <= units * 4:
            warnings.append("history_row_dropped")  # almost certainly a misread
            continue
        history.append({"units": u, "days": row_days or 30, "period_start": row.get("period_start"),
                        "period_end": row.get("period_end")})
    if not history:
        warnings.append("no_history")

    confidence = raw.get("confidence") or {}
    if any(v == "low" for v in confidence.values()):
        warnings.append("low_confidence")

    return {
        "discom": raw.get("discom"),
        "category": category or "domestic",
        "sanctioned_load_kw": load,
        "billing_period_days": days,
        "units_billed": units,
        "history": history[:12],
        "period_start": period[0] if _days_between(*period) else None,
        "period_end": period[1] if _days_between(*period) else None,
        "current_charges_inr": _num(raw.get("current_charges_inr")),
        "amount_payable_inr": _num(raw.get("amount_payable_inr"), -1e7, 1e7),
        "bill_month": raw.get("bill_month"),
        "notes": raw.get("notes"),
        "warnings": warnings,
    }


def normalize_quote(raw: dict) -> dict:
    if raw.get("is_solar_quote") is False:
        raise NotABill("this does not look like a solar quotation")
    inverter = raw.get("inverter") or {}
    warranties = raw.get("warranties") or {}
    inv_type = inverter.get("type") if inverter.get("type") in {"on_grid", "hybrid", "off_grid"} else "unknown"
    handling = raw.get("subsidy_handling")
    return {
        "vendor_name": raw.get("vendor_name"),
        "system_kw": _num(raw.get("system_kw"), 0.1, 1000),
        "price_total_inr": _num(raw.get("price_total_inr"), 1000, 1e9),
        "gst_included": raw.get("gst_included") if isinstance(raw.get("gst_included"), bool) else None,
        "panel_maker": raw.get("panel_maker"),
        "panel_model": raw.get("panel_model"),
        "panel_wattage_w": _num(raw.get("panel_wattage_w"), 50, 1000),
        "dcr_stated": raw.get("dcr_stated") if isinstance(raw.get("dcr_stated"), bool) else None,
        "inverter": {"maker": inverter.get("maker"), "capacity_kw": _num(inverter.get("capacity_kw"), 0.1, 1000), "type": inv_type},
        "warranties": {k: _num(warranties.get(k), 0, 50) for k in
                       ("panel_performance_years", "panel_product_years", "inverter_years", "maintenance_years")},
        "included_items": [i for i in raw.get("included_items") or [] if i in QUOTE_ITEMS],
        "extra_charges": [c for c in raw.get("extra_charges") or [] if isinstance(c, dict) and c.get("item")],
        "advance_pct": _num(raw.get("advance_pct"), 0, 100),
        "subsidy_handling": handling if handling in {"vendor_files", "suspicious"} else "not_mentioned",
        "notes": raw.get("notes"),
    }


def read_bill(data: bytes, media_type: str) -> dict:
    images = pages.bill_images(data, media_type)
    instruction = prompts.BILL_INSTRUCTION + (prompts.BILL_ZOOM_NOTE if images else "")
    return normalize_bill(llm.read_to_json(data, media_type, prompts.BILL_SYSTEM, instruction, images))


def read_quote(data: bytes, media_type: str) -> dict:
    images = pages.document_images(data, media_type)
    return normalize_quote(llm.read_to_json(data, media_type, prompts.QUOTE_SYSTEM, prompts.QUOTE_INSTRUCTION, images))

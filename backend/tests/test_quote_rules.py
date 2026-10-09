from solarsaathi import quote_rules

GOOD = {
    "system_kw": 3, "price_total_inr": 180000, "gst_included": True,
    "panel_maker": "Waaree Energies", "panel_model": "WS-540", "dcr_stated": True,
    "inverter": {"maker": "X", "capacity_kw": 3, "type": "on_grid"},
    "warranties": {"panel_performance_years": 25, "inverter_years": 8, "maintenance_years": 5},
    "included_items": ["mounting_structure", "dc_ac_cabling", "earthing", "lightning_arrester",
                       "net_meter_process", "installation"],
    "extra_charges": [], "advance_pct": 10, "subsidy_handling": "vendor_files",
}
CTX = {"recommended_kw": 3.0, "sanctioned_load_kw": 4.0}


def test_fair_quote_is_green():
    report = quote_rules.run_all(GOOD, CTX)
    assert report["overall"] == "green", report


def test_overpriced_non_dcr_quote_is_red():
    bad = {**GOOD, "price_total_inr": 260000, "dcr_stated": None, "advance_pct": 70,
           "extra_charges": [{"item": "net meter fee", "amount_inr": 8000}]}
    report = quote_rules.run_all(bad, CTX)
    reds = {c["id"] for c in report["checks"] if c["status"] == "red"}
    assert report["overall"] == "red"
    assert {"price", "dcr", "payment", "items"} <= reds


def test_quote_above_sanctioned_load_is_red():
    report = quote_rules.run_all({**GOOD, "system_kw": 5}, CTX)
    size = next(c for c in report["checks"] if c["id"] == "size")
    assert size["status"] == "red"


def test_size_check_without_bill_is_info():
    report = quote_rules.run_all(GOOD, {})
    size = next(c for c in report["checks"] if c["id"] == "size")
    assert size["status"] == "info"

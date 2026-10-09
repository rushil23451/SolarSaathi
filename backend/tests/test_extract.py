import pytest

from solarsaathi import extract, llm


def test_normalize_bill_cleans_numbers_and_flags_kva():
    raw = {"is_electricity_bill": True, "discom": "BSES Rajdhani", "category": "non_domestic",
           "sanctioned_load": "1.00", "sanctioned_load_unit": "kVA", "billing_period_days": 91,
           "units_billed": "1,220", "history": [], "confidence": {"units_billed": "high"}}
    bill = extract.normalize_bill(raw)
    assert bill["units_billed"] == 1220
    assert bill["sanctioned_load_kw"] == 1.0
    assert "load_in_kva" in bill["warnings"] and "no_history" in bill["warnings"]


def test_normalize_bill_rejects_non_bills():
    with pytest.raises(extract.NotABill):
        extract.normalize_bill({"is_electricity_bill": False})


def test_history_rows_without_units_are_dropped():
    bill = extract.normalize_bill({"units_billed": 500, "history": [{"units": None}, {"units": 300, "days": 31}]})
    assert bill["history"] == [{"units": 300, "days": 31, "period_end": None}]


def test_parse_json_ignores_surrounding_text():
    assert llm._parse_json('Here you go:\n{"a": 1}\nThanks') == {"a": 1}

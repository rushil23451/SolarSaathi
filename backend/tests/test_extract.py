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


def test_meter_reading_copied_as_units_is_corrected():
    raw = {"units_billed": 52146, "billing_period_days": 30,
           "meter": {"current_reading": 52146, "previous_reading": 51583, "multiplication_factor": 1,
                     "current_reading_date": "2025-05-25", "previous_reading_date": "2025-04-25"},
           "history": [{"units": 51583}, {"units": 400, "days": 30}]}
    bill = extract.normalize_bill(raw)
    assert bill["units_billed"] == 563
    assert "units_from_readings" in bill["warnings"]
    assert [h["units"] for h in bill["history"]] == [400]


def test_quarterly_days_come_from_reading_dates():
    raw = {"units_billed": 1220, "billing_period_days": 30,
           "meter": {"current_reading": 2159, "previous_reading": 939,
                     "current_reading_date": "2020-05-29", "previous_reading_date": "2020-02-28"}}
    bill = extract.normalize_bill(raw)
    assert bill["billing_period_days"] == 91
    assert bill["units_billed"] == 1220


def test_misread_readings_do_not_overrule_printed_units():
    raw = {"units_billed": 163, "billing_period_days": 32,
           "meter": {"current_reading": 14571, "previous_reading": 14257}}
    bill = extract.normalize_bill(raw)
    assert bill["units_billed"] == 163
    assert "units_mismatch" in bill["warnings"]

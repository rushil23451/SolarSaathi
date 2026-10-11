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
    assert bill["history"] == [{"units": 300, "days": 31, "period_start": None, "period_end": None}]


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


def test_units_and_days_fall_back_to_the_kwh_row():
    raw = {"meter": {"current_reading": 52146, "previous_reading": 51583, "days": 30, "units": 563}, "history": []}
    bill = extract.normalize_bill(raw)
    assert bill["units_billed"] == 563 and bill["billing_period_days"] == 30


def test_history_days_come_from_the_period_dates_when_misread():
    raw = {"units_billed": 563, "billing_period_days": 30, "history": [
        {"period_start": "2024-11-25", "period_end": "2024-12-28", "days": 3, "units": 329, "bill_amount": 1200}]}
    assert extract.normalize_bill(raw)["history"][0]["days"] == 34  # both ends counted, as on the bill


def test_bill_amount_copied_into_units_is_dropped():
    raw = {"units_billed": 563, "billing_period_days": 30, "history": [
        {"units": 850, "bill_amount": 850, "days": 30}, {"units": 292, "bill_amount": 850, "days": 30}]}
    assert [h["units"] for h in extract.normalize_bill(raw)["history"]] == [292]


def test_billed_total_units_win_over_the_kwh_row():
    raw = {"units_billed": 1156, "billing_total_units": 1220, "billing_period_days": 91,
           "meter": {"current_reading": 2040, "previous_reading": 884}}
    bill = extract.normalize_bill(raw)
    assert bill["units_billed"] == 1220 and "units_mismatch" not in bill["warnings"]


def test_small_meter_readings_are_not_mistaken_for_a_copied_reading():
    # kVAh-billed shop: kWh readings 2040 - 884 = 1156, but the bill charges 1220 kVAh.
    raw = {"units_billed": 1220, "billing_total_units": 1220, "meter": {"current_reading": 2040, "previous_reading": 884}}
    assert extract.normalize_bill(raw)["units_billed"] == 1220


def test_falls_back_to_the_second_model_when_the_first_is_throttled(monkeypatch):
    from botocore.exceptions import ClientError
    from solarsaathi import config

    calls = []

    class Runtime:
        def converse(self, modelId, **kw):
            calls.append(modelId)
            if modelId == "primary":
                raise ClientError({"Error": {"Code": "ThrottlingException", "Message": "Too many tokens per day"}}, "Converse")
            return {"output": {"message": {"role": "assistant", "content": [{"text": '{"ok": true}'}]}}, "stopReason": "end_turn"}

    monkeypatch.setattr(config, "MODEL_ID", "primary")
    monkeypatch.setattr(config, "FALLBACK_MODEL_ID", "backup")
    monkeypatch.setattr(llm, "_bedrock_runtime", lambda: Runtime())
    assert llm.read_to_json(b"x", "image/jpeg", "s", "i", images=[b"jpeg"]) == {"ok": True}
    assert calls == ["primary", "backup"]


METER = {"current_reading": 52146, "previous_reading": 51583, "multiplication_factor": 1,
         "current_reading_date": "2025-05-25", "previous_reading_date": "2025-04-25"}


def test_reconcile_picks_the_value_the_meter_readings_support():
    first = {"units_billed": 653, "billing_period_days": 30, "meter": METER, "history": []}
    second = {"units_billed": 563, "billing_period_days": 30, "meter": METER, "history": []}
    merged, issues = extract.reconcile(first, second)
    assert merged["units_billed"] == 563 and issues == {}


def test_reconcile_flags_what_the_bill_cannot_settle():
    first = {"units_billed": 563, "sanctioned_load": 4, "history": [{"units": 400}, {"units": 292}]}
    second = {"units_billed": 563, "sanctioned_load": 7, "history": [{"units": 400}, {"units": 252}]}
    merged, issues = extract.reconcile(first, second)
    assert merged["sanctioned_load"] == 4  # the first reading is kept...
    assert issues["sanctioned_load_kw"] == {"first": 4, "second": 7}  # ...and the person is asked to check
    assert issues["history"]["second"] == [400, 252]


def test_reconcile_days_follow_the_reading_dates():
    first = {"units_billed": 563, "billing_period_days": 36, "meter": METER}
    second = {"units_billed": 563, "billing_period_days": 30, "meter": METER}
    merged, issues = extract.reconcile(first, second)
    assert merged["billing_period_days"] == 30 and "billing_period_days" not in issues


def test_without_a_second_reading_nothing_changes():
    first = {"units_billed": 563}
    assert extract.reconcile(first, None) == (first, {})


def test_evidence_only_one_reader_saw_settles_nothing():
    # The second reader misread a meter reading (14410 instead of 14420), which "supports" its own 153.
    first = {"units_billed": 163, "meter": {"current_reading": 14420, "previous_reading": 14257}}
    second = {"units_billed": 153, "meter": {"current_reading": 14410, "previous_reading": 14257}}
    merged, issues = extract.reconcile(first, second)
    assert merged["units_billed"] == 163 and issues["units_billed"] == {"first": 163, "second": 153}


def test_history_only_the_second_reader_saw_is_flagged_not_adopted():
    merged, issues = extract.reconcile({"units_billed": 1220, "history": []}, {"units_billed": 1220, "history": [{"units": 2159}]})
    assert merged["history"] == [] and issues["history"] == {"first": [], "second": [2159]}

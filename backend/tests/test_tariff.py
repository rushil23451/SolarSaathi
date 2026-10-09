import pytest

from solarsaathi import tariff


def within(actual, expected, pct):
    return abs(actual - expected) / expected * 100 <= pct


def test_domestic_bill_matches_real_brpl_bill():
    # BRPL May-25: 563 units, 4 kW, current charges Rs 3,654.35
    bill = tariff.monthly_bill(563, 4.0, "domestic", "delhi_derc")
    assert within(bill["payable"], 3654.35, 5), bill


def test_non_domestic_bill_matches_real_bypl_bill():
    # BYPL Feb-24: 584 units, 7 kVA, current charges Rs 10,317.56 (before arrears)
    bill = tariff.monthly_bill(584 * 30 / 31, 7.0, "non_domestic", "delhi_derc")
    assert within(bill["payable"] * 31 / 30, 10317.56, 5), bill


def test_delhi_subsidy_makes_low_use_bill_zero():
    # BRPL Jan-21: 163 units -> "No payment required"
    assert tariff.monthly_bill(163, 1.0, "domestic", "delhi_derc")["payable"] == 0


def test_partial_subsidy_is_capped():
    bill = tariff.monthly_bill(390, 3.0, "domestic", "delhi_derc")
    assert 0 < bill["state_subsidy"] <= 800


def test_slabs_are_progressive():
    a = tariff.monthly_bill(500, 4, "domestic", "delhi_derc", apply_state_subsidy=False)
    assert a["energy"] == pytest.approx(200 * 3 + 200 * 4.5 + 100 * 6.5)

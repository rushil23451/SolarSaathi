import pytest
from conftest import DELHI_GHI

from solarsaathi import calc


def test_quarterly_bill_is_scaled_to_30_days(bills):
    units, periods = calc.average_monthly_units(bills["brpl_non_domestic_quarterly_jun20"])
    assert units == pytest.approx(1220 * 30 / 91)
    assert periods == 1


def test_high_use_domestic_home_should_go_solar(bills):
    r = calc.analyse(bills["brpl_domestic_may25"], DELHI_GHI, "unknown")
    assert r["verdict"] == "yes"
    assert 2.0 <= r["system_kw"] <= 4.0
    assert r["central_subsidy"] == 78000 if r["system_kw"] >= 3 else r["central_subsidy"] > 0
    assert r["payback_years"] < 7
    assert r["co2_tonnes_year"] > 0


def test_low_use_home_is_told_no(bills):
    r = calc.analyse(bills["brpl_domestic_jan21_low"], DELHI_GHI, "unknown")
    assert r["verdict"] == "not_worth"
    assert r["reason"] in {"already_low_bill", "load_limit", "too_small"}


def test_commercial_connection_gets_no_central_subsidy(bills):
    r = calc.analyse(bills["bypl_non_domestic_feb24"], DELHI_GHI, "unknown")
    assert "not_eligible_central_subsidy" in r["flags"]
    assert r["central_subsidy"] == 0
    assert r["system_kw"] > 0


def test_sanctioned_load_limits_size(bills):
    r = calc.analyse(bills["brpl_non_domestic_quarterly_jun20"], DELHI_GHI, "unknown")
    assert r["system_kw"] <= 1.0
    assert "load_increase" in r["flags"]


def test_roof_limit_applies(bills):
    r = calc.analyse(bills["brpl_domestic_may25"], DELHI_GHI, "small")
    assert r["system_kw"] <= 1.5


def test_subsidy_formula():
    assert calc.central_subsidy(1, "domestic") == 30000
    assert calc.central_subsidy(2, "domestic") == 60000
    assert calc.central_subsidy(3, "domestic") == 78000
    assert calc.central_subsidy(5, "domestic") == 78000
    assert calc.central_subsidy(3, "non_domestic") == 0


def test_unknown_discom_is_reported_not_guessed(bills):
    bill = {**bills["brpl_domestic_may25"], "discom": "Some Other Discom"}
    assert calc.analyse(bill, DELHI_GHI)["verdict"] == "unsupported_discom"

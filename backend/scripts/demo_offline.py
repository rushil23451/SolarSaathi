"""Run the calculation engine on the four sample bills. No AWS account needed.

    python scripts/demo_offline.py            # uses New Delhi sunlight (4.89)
    python scripts/demo_offline.py --live     # fetches sunlight from NASA POWER
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from solarsaathi import calc, irradiance  # noqa: E402

DELHI = (28.61, 77.21)

fixtures = json.loads((Path(__file__).resolve().parents[1] / "tests/fixtures/bills.json").read_text())
ghi = irradiance.annual_ghi(*DELHI) if "--live" in sys.argv else {"ghi": 4.89, "source": "NASA POWER (saved value)"}

for name, case in fixtures.items():
    if name.startswith("_"):
        continue
    r = calc.analyse(case["bill"], ghi, "unknown")
    print(f"\n=== {name} ({case['file']}) — expected: {case['expect']}")
    print(f"verdict: {r['verdict']} ({r.get('reason')})   flags: {', '.join(r['flags']) or '-'}")
    print(f"use: {r['monthly_units']} units/month   bill now: Rs {r['bill_now']['payable']:,.0f}/month")
    if r.get("system_kw"):
        print(f"size: {r['system_kw']} kW   cost: Rs {r['cost_low']:,}–{r['cost_high']:,}   "
              f"subsidy: Rs {r['central_subsidy']:,}   you pay: Rs {r['net_cost']:,}")
        print(f"bill with solar: Rs {r['bill_with_solar']['payable']:,.0f}   saving: Rs {r['monthly_saving']:,}/month   "
              f"payback: {r['payback_years']} yrs   CO2: {r['co2_tonnes_year']} t/yr")

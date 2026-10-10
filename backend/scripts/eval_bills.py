"""Score a model on the sample bills: which key fields did it read correctly?

    python scripts/eval_bills.py ~/Desktop/bill_folder
    MODEL_ID=apac.amazon.nova-pro-v1:0 python scripts/eval_bills.py ~/Desktop/bill_folder

Each run calls the model once per bill. Add more bills (and their correct values in
tests/fixtures/bills.json) to make the score meaningful.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from solarsaathi import config, extract  # noqa: E402
from try_bill import load  # noqa: E402

folder = Path(sys.argv[1]).expanduser()
fixtures = json.loads((Path(__file__).resolve().parents[1] / "tests/fixtures/bills.json").read_text())


def close(a, b, tol):
    return a is not None and b is not None and abs(a - b) <= tol * max(abs(b), 1)


total = correct = 0
print(f"model: {config.MODEL_ID}\n")
for name, case in fixtures.items():
    if name.startswith("_"):
        continue
    pattern = case["file"].replace("...", "*")
    files = sorted(folder.glob(pattern))
    if not files:
        print(f"{name}: file {case['file']} not found, skipped")
        continue
    want = case["bill"]
    try:
        got = extract.read_bill(*load(files[0]))
    except Exception as e:  # noqa: BLE001
        print(f"{name}: FAILED to read ({e})")
        total += 5
        continue
    checks = {
        "units": close(got["units_billed"], want["units_billed"], 0.02),
        "days": close(got["billing_period_days"], want["billing_period_days"], 0.05),
        "load": close(got["sanctioned_load_kw"], want["sanctioned_load_kw"], 0.01),
        "category": got["category"] == want["category"],
        "history": [h["units"] for h in got["history"]] == [h["units"] for h in want["history"]],
    }
    total += len(checks)
    correct += sum(checks.values())
    marks = "  ".join(f"{k} {'✓' if ok else '✗'}" for k, ok in checks.items())
    print(f"{name:38} {marks}   (read units={got['units_billed']}, days={got['billing_period_days']}, warnings={got['warnings']})")

print(f"\nscore: {correct}/{total} fields correct")

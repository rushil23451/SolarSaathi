import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

DELHI_GHI = {"ghi": 4.89, "monthly": [3.09, 4.35, 5.65, 6.58, 6.71, 6.09, 5.01, 4.89, 5.06, 4.66, 3.58, 3.03], "source": "NASA POWER (test value for New Delhi)"}


@pytest.fixture
def bills():
    with open(Path(__file__).parent / "fixtures" / "bills.json") as f:
        return {k: v["bill"] for k, v in json.load(f).items() if not k.startswith("_")}

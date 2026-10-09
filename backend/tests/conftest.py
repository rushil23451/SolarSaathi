import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

DELHI_GHI = {"ghi": 4.89, "source": "NASA POWER (test value for New Delhi)"}


@pytest.fixture
def bills():
    with open(Path(__file__).parent / "fixtures" / "bills.json") as f:
        return {k: v["bill"] for k, v in json.load(f).items() if not k.startswith("_")}

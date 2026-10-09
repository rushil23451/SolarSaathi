"""Reference data (tariffs, subsidy rules, costs, quote rules) loaded from versioned JSON files.

Keeping these as files rather than database rows means every number the app uses can be
reviewed, diffed and cited in a pull request.
"""

import json
import os
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-opus-5-5")
LLM_EFFORT = os.environ.get("LLM_EFFORT", "low")


@lru_cache(maxsize=None)
def load(name: str) -> dict:
    with open(DATA_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def tariffs() -> dict:
    return load("tariffs")


def solar() -> dict:
    return load("solar")


def quote_rules() -> dict:
    return load("quote_rules")


def find_tariff_id(discom: str | None) -> str | None:
    """Map a discom name read off a bill to a tariff table. Returns None if unsupported."""
    if not discom:
        return None
    name = discom.lower()
    for tariff_id, tariff in tariffs().items():
        if any(alias in name for alias in tariff["discom_aliases"]):
            return tariff_id
    return None

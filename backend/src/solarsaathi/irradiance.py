"""Average solar radiation for a location, from NASA POWER, cached in DynamoDB.

NASA POWER is free and needs no API key. Radiation barely changes year to year, so a
0.1-degree grid cell (about 11 km) is fetched once and reused forever.
"""

import json
import logging
import os
import urllib.request
from decimal import Decimal

from . import config

log = logging.getLogger(__name__)

NASA_URL = (
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
    "?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON"
)


def _cache_table():
    name = os.environ.get("IRRADIANCE_TABLE")
    if not name:
        return None
    import boto3

    return boto3.resource("dynamodb").Table(name)


MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def fetch_from_nasa(lat: float, lon: float, timeout: float = 8.0) -> tuple[float, list[float]]:
    """Long-term average sunlight: (annual, [Jan..Dec]) in kWh/m²/day."""
    with urllib.request.urlopen(NASA_URL.format(lat=lat, lon=lon), timeout=timeout) as resp:
        data = json.load(resp)
    values = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
    annual, monthly = values.get("ANN"), [values.get(m) for m in MONTHS]
    if annual is None or annual <= 0 or any(v is None or v <= 0 for v in monthly):
        raise ValueError("NASA POWER returned incomplete values")
    return float(annual), [float(v) for v in monthly]


def annual_ghi(lat: float, lon: float) -> dict:
    """Return {"ghi": annual kWh/m²/day, "monthly": [Jan..Dec], "source": ...}.

    Never raises: falls back to a national average (same value every month)."""
    cell = f"{round(lat, 1)}#{round(lon, 1)}"
    table = _cache_table()
    if table is not None:
        try:
            item = table.get_item(Key={"cell": cell}).get("Item")
            if item and item.get("monthly"):
                return {"ghi": float(item["ghi"]), "monthly": [float(v) for v in item["monthly"]],
                        "source": "NASA POWER (cached)"}
        except Exception:
            log.exception("irradiance cache read failed")

    try:
        ghi, monthly = fetch_from_nasa(round(lat, 1), round(lon, 1))
    except Exception:
        log.exception("NASA POWER request failed, using fallback")
        fallback = config.solar()["fallback_ghi_kwh_m2_day"]
        return {"ghi": fallback, "monthly": [fallback] * 12, "source": "fallback (India average)"}

    if table is not None:
        try:
            table.put_item(Item={"cell": cell, "ghi": Decimal(str(ghi)),
                                 "monthly": [Decimal(str(v)) for v in monthly]})
        except Exception:
            log.exception("irradiance cache write failed")
    return {"ghi": ghi, "monthly": monthly, "source": "NASA POWER"}

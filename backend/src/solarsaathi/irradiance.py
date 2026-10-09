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


def fetch_from_nasa(lat: float, lon: float, timeout: float = 8.0) -> float:
    with urllib.request.urlopen(NASA_URL.format(lat=lat, lon=lon), timeout=timeout) as resp:
        data = json.load(resp)
    value = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]["ANN"]
    if value is None or value <= 0:
        raise ValueError("NASA POWER returned no annual value")
    return float(value)


def annual_ghi(lat: float, lon: float) -> dict:
    """Return {"ghi": kWh/m2/day, "source": ...}. Never raises: falls back to a national average."""
    cell = f"{round(lat, 1)}#{round(lon, 1)}"
    table = _cache_table()
    if table is not None:
        try:
            item = table.get_item(Key={"cell": cell}).get("Item")
            if item:
                return {"ghi": float(item["ghi"]), "source": "NASA POWER (cached)"}
        except Exception:
            log.exception("irradiance cache read failed")

    try:
        ghi = fetch_from_nasa(round(lat, 1), round(lon, 1))
    except Exception:
        log.exception("NASA POWER request failed, using fallback")
        return {"ghi": config.solar()["fallback_ghi_kwh_m2_day"], "source": "fallback (India average)"}

    if table is not None:
        try:
            table.put_item(Item={"cell": cell, "ghi": Decimal(str(ghi))})
        except Exception:
            log.exception("irradiance cache write failed")
    return {"ghi": ghi, "source": "NASA POWER"}

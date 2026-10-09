import json
import os

os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")

from handlers import api  # noqa: E402
from solarsaathi import quote_agent  # noqa: E402
from test_quote_rules import CTX, GOOD  # noqa: E402


def call(route, body=None, params=None):
    resp = api.handler({"routeKey": route, "body": json.dumps(body or {}), "pathParameters": params}, None)
    return resp["statusCode"], json.loads(resp["body"])


def test_unknown_route():
    assert call("GET /nope")[0] == 404


def test_upload_rejects_unsupported_types():
    assert call("POST /uploads", {"kind": "bill", "contentType": "image/avif"})[0] == 400


def test_extract_rejects_keys_outside_uploads():
    assert call("POST /bill/extract", {"key": "../secret"})[0] == 400


def test_analyse_rejects_locations_outside_india():
    assert call("POST /bill/analyse", {"bill": {}, "lat": 51.5, "lon": -0.1})[0] == 400


def test_quote_check_falls_back_when_agent_fails(monkeypatch):
    def broken_agent(**kwargs):
        raise RuntimeError("no Bedrock access in tests")

    monkeypatch.setattr(quote_agent, "Agent", broken_agent)
    monkeypatch.setattr(quote_agent.extract, "read_quote", lambda data, mt: GOOD)
    report = quote_agent.check_quote(b"x", "image/jpeg", CTX)
    assert report["overall"] == "green"
    assert report["advice"] is None
    assert len(report["checks"]) == 9

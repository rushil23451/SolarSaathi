"""The local server end to end, over real HTTP, with the model call faked."""

import json
import sys
import threading
import time
import urllib.request
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import local_api  # noqa: E402
from solarsaathi import irradiance, llm  # noqa: E402

FIXTURES = json.loads((Path(__file__).parent / "fixtures/bills.json").read_text())


@pytest.fixture()
def server(monkeypatch):
    monkeypatch.setattr(llm, "read_to_json", lambda *a, **k: dict(FIXTURES["brpl_domestic_may25"]["bill"]))
    monkeypatch.setattr(irradiance, "fetch_from_nasa", lambda lat, lon: 4.89)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_api.Handler)
    local_api.base_url = f"http://127.0.0.1:{httpd.server_port}"
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield local_api.base_url
    httpd.shutdown()


def call(url, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"),
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read() or b"{}")


def multipart(fields: dict, file_bytes: bytes) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    out += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="bill.jpg"\r\n'
            f"Content-Type: image/jpeg\r\n\r\n").encode() + file_bytes + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return out, f"multipart/form-data; boundary={boundary}"


def test_upload_read_and_analyse_a_bill(server):
    _, up = call(f"{server}/uploads", {"kind": "bill", "contentType": "image/jpeg"})
    body, ctype = multipart(up["fields"], b"\xff\xd8 fake jpeg bytes")
    req = urllib.request.Request(up["url"], data=body, method="POST", headers={"content-type": ctype})
    assert urllib.request.urlopen(req).status == 204

    status, started = call(f"{server}/bill/extract", {"key": up["key"]})
    assert status == 202
    for _ in range(50):
        _, job = call(f"{server}/jobs/{started['jobId']}")
        if job["status"] != "pending":
            break
        time.sleep(0.05)
    assert job["status"] == "done", job
    assert job["result"]["units_billed"] == 563

    _, analysis = call(f"{server}/bill/analyse", {"bill": job["result"], "lat": 28.61, "lon": 77.21})
    assert analysis["result"]["verdict"] in {"yes", "maybe", "no"}
    _, again = call(f"{server}/results/{analysis['analysisId']}")
    assert again["result"] == analysis["result"]


def test_unknown_upload_key_fails_cleanly(server):
    _, started = call(f"{server}/bill/extract", {"key": "uploads/bill/missing.jpg"})
    time.sleep(0.2)
    _, job = call(f"{server}/jobs/{started['jobId']}")
    assert job["status"] == "error"

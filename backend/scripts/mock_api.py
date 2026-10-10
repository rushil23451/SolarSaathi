"""A local stand-in for the AWS API, so the frontend team can work before (or without) AWS.

It runs the REAL calculation engine and quote rules. Only the AI reading is faked: every
uploaded bill "reads" as the BSES Rajdhani May-25 sample, and every quote as a sample quote.

    python scripts/mock_api.py              # serves http://localhost:8787
    echo "VITE_API_URL=http://localhost:8787" > ../frontend/.env.local
"""

import json
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from solarsaathi import calc, quote_rules  # noqa: E402

PORT = 8787
SAMPLE_BILL = {**json.loads((ROOT / "tests/fixtures/bills.json").read_text())["brpl_domestic_may25"]["bill"],
               # e.g. MOCK_WARNINGS=units_mismatch to preview the "check the units" banner
               "warnings": [w for w in os.environ.get("MOCK_WARNINGS", "").split(",") if w]}
SAMPLE_QUOTE = {
    "vendor_name": "Sample Solar Pvt Ltd", "system_kw": 3, "price_total_inr": 225000, "gst_included": True,
    "panel_maker": "Waaree", "panel_model": None, "dcr_stated": True,
    "inverter": {"maker": "Sample", "capacity_kw": 3, "type": "on_grid"},
    "warranties": {"panel_performance_years": 25, "inverter_years": 5, "maintenance_years": None},
    "included_items": ["mounting_structure", "dc_ac_cabling", "earthing", "installation"],
    "extra_charges": [{"item": "net meter fee", "amount_inr": 7500}], "advance_pct": 60,
    "subsidy_handling": "not_mentioned",
}
jobs, analyses = {}, {}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "content-type")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, {})

    def _json(self):
        length = int(self.headers.get("content-length") or 0)
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        parts = self.path.strip("/").split("/")
        if parts[0] == "jobs" and parts[1] in jobs:
            return self._send(200, jobs[parts[1]])
        if parts[0] == "results" and parts[1] in analyses:
            return self._send(200, {"analysisId": parts[1], "result": analyses[parts[1]]})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/s3-upload":  # stands in for the S3 pre-signed POST
            self.rfile.read(int(self.headers.get("content-length") or 0))
            return self._send(204, {})
        body = self._json()
        if self.path == "/uploads":
            return self._send(200, {"key": f"uploads/{body.get('kind')}/{uuid.uuid4().hex}",
                                    "url": f"http://localhost:{PORT}/s3-upload", "fields": {}})
        if self.path in ("/bill/extract", "/quote/check"):
            job_id = uuid.uuid4().hex[:16]
            if self.path == "/bill/extract":
                result = SAMPLE_BILL
            else:
                ctx = {}
                if body.get("analysisId") in analyses:
                    ctx = {"recommended_kw": analyses[body["analysisId"]].get("system_kw"),
                           "sanctioned_load_kw": SAMPLE_BILL["sanctioned_load_kw"]}
                result = {"quote": SAMPLE_QUOTE, **quote_rules.run_all(SAMPLE_QUOTE, ctx), "advice": None}
            jobs[job_id] = {"jobId": job_id, "status": "done", "result": result}
            return self._send(202, {"jobId": job_id})
        if self.path == "/bill/analyse":
            ghi = {"ghi": 4.89, "source": "NASA POWER (saved value for New Delhi; mock API)"}
            result = calc.analyse(body["bill"], ghi, body.get("roof", "unknown"))
            analysis_id = uuid.uuid4().hex[:16]
            analyses[analysis_id] = result
            return self._send(200, {"analysisId": analysis_id, "result": result})
        if self.path == "/speech":
            return self._send(501, {"error": "Speech needs Amazon Polly (deploy to AWS to hear it)"})
        self._send(404, {"error": "not found"})


if __name__ == "__main__":
    print(f"Mock SolarSaathi API on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

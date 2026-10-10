"""Run the REAL SolarSaathi backend on your laptop, without deploying anything.

Bills and quotes are read by the real model on Amazon Bedrock, and the real calculation engine,
quote checks and Strands quote agent run on every request. Only the storage is local: uploads,
jobs and results live in memory (S3 and DynamoDB are not used) and vanish when you stop it.

It uses the same handler code as the Lambda functions, so what works here works when deployed.

    AWS_PROFILE=college python scripts/local_api.py          # serves http://localhost:8787
    AWS_PROFILE=college python scripts/local_api.py --phone  # also reachable from your phone on Wi-Fi

The profile needs Bedrock access (bedrock:InvokeModel). Read aloud needs Amazon Polly; if the
profile can't use Polly, the app simply hides that button's audio and shows an error instead.
"""

import argparse
import email.parser
import email.policy
import json
import logging
import os
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("AWS_REGION", "ap-south-1")
os.environ.setdefault("AWS_DEFAULT_REGION", os.environ["AWS_REGION"])

import boto3  # noqa: E402

from handlers import api, worker  # noqa: E402
from solarsaathi import config, store  # noqa: E402

PORT = 8787
MAX_UPLOAD = 10 * 1024 * 1024
log = logging.getLogger("local_api")

# ---------- in-memory replacements for S3 and DynamoDB ----------

uploads: dict[str, tuple[bytes, str]] = {}
jobs: dict[str, dict] = {}
analyses: dict[str, dict] = {}
lock = threading.Lock()
base_url = f"http://localhost:{PORT}"


def presigned_upload(kind: str, content_type: str, max_bytes: int = MAX_UPLOAD) -> dict:
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}[content_type]
    key = f"uploads/{kind}/{store.new_id()}.{ext}"
    return {"key": key, "url": f"{base_url}/local-upload", "fields": {"key": key, "Content-Type": content_type}}


def read_upload(key: str) -> tuple[bytes, str]:
    if key not in uploads:
        raise KeyError(f"no upload {key}")
    return uploads[key]


def create_job(job_type: str, payload: dict) -> str:
    job_id = store.new_id()
    with lock:
        jobs[job_id] = {"jobId": job_id, "type": job_type, "status": "pending", "result": None, "error": None}
    return job_id


def finish_job(job_id: str, result: dict | None = None, error: str | None = None) -> None:
    with lock:
        jobs[job_id].update(status="error" if error else "done", result=result, error=error)


def save_analysis(record: dict) -> str:
    analysis_id = store.new_id()
    analyses[analysis_id] = json.loads(json.dumps(record))
    return analysis_id


def start_job(job_type: str, payload: dict) -> dict:
    """Instead of invoking the worker Lambda, run the same worker code in a background thread."""
    job_id = create_job(job_type, payload)
    event = {"jobId": job_id, "type": job_type, **payload}
    threading.Thread(target=worker.handler, args=(event, None), daemon=True).start()
    return api._resp(202, {"jobId": job_id})


store.presigned_upload = presigned_upload
store.read_upload = read_upload
store.create_job = create_job
store.finish_job = finish_job
store.get_job = jobs.get
store.save_analysis = save_analysis
store.get_analysis = analyses.get
api._start_job = start_job

# ---------- HTTP server that speaks the same API as API Gateway ----------


def parse_multipart(body: bytes, content_type: str) -> dict:
    """Parse the browser's multipart form (the same form it would POST to S3)."""
    msg = email.parser.BytesParser(policy=email.policy.HTTP).parsebytes(
        f"Content-Type: {content_type}\r\n\r\n".encode() + body)
    fields = {}
    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        fields[name] = part.get_payload(decode=True) if part.get_filename() else part.get_content().strip()
    return fields


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("%s %s", self.command, self.path)

    def _send(self, status: int, body) -> None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "content-type")
        self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(data)

    def _lambda(self, route: str, body: bytes = b"", params: dict | None = None) -> None:
        event = {"routeKey": route, "body": body.decode() or "{}", "pathParameters": params or {}}
        resp = api.handler(event, None)
        if route == "POST /speech" and resp["statusCode"] == 500:
            resp = api._resp(501, {"error": "Read aloud needs Amazon Polly, which this AWS profile can't use."})
        self._send(resp["statusCode"], resp["body"].encode())

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts == ["health"]:
            return self._send(200, {"ok": True, "model": config.MODEL_ID, "region": config.AWS_REGION})
        if len(parts) == 2 and parts[0] == "jobs":
            return self._lambda("GET /jobs/{jobId}", params={"jobId": parts[1]})
        if len(parts) == 2 and parts[0] == "results":
            return self._lambda("GET /results/{analysisId}", params={"analysisId": parts[1]})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        if length > MAX_UPLOAD + 64 * 1024:
            return self._send(413, {"error": "file too large (max 10 MB)"})
        body = self.rfile.read(length)
        path = self.path.split("?")[0]
        if path == "/local-upload":  # stands in for the S3 pre-signed POST
            fields = parse_multipart(body, self.headers.get("content-type", ""))
            key, data = fields.get("key"), fields.get("file")
            if not isinstance(key, str) or not key.startswith("uploads/") or not isinstance(data, bytes):
                return self._send(400, {"error": "bad upload"})
            uploads[key] = (data, fields.get("Content-Type") or "application/octet-stream")
            return self._send(204, b"")
        routes = {"/uploads", "/bill/extract", "/bill/analyse", "/quote/check", "/speech"}
        if path in routes:
            return self._lambda(f"POST {path}", body)
        self._send(404, {"error": "not found"})


def check_credentials() -> None:
    profile = os.environ.get("AWS_PROFILE", "default")
    try:
        account = boto3.client("sts").get_caller_identity()["Account"]
    except Exception as e:  # noqa: BLE001
        sys.exit(f"\nAWS profile '{profile}' isn't working: {e}\n"
                 f"Run: aws configure --profile {profile}   (see docs/RUNNING.md)\n")
    print(f"AWS profile : {profile} (account {account})")
    print(f"Model       : {config.MODEL_ID} in {config.AWS_REGION}")


def lan_ip() -> str:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def main() -> None:
    global base_url
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--phone", action="store_true", help="listen on Wi-Fi so a phone can use it")
    parser.add_argument("--host-ip", help="with --phone: the Wi-Fi address to give the phone (auto-detected)")
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("strands").setLevel(logging.WARNING)

    check_credentials()
    host = (args.host_ip or lan_ip()) if args.phone else "localhost"
    base_url = f"http://{host}:{args.port}"
    print(f"API         : {base_url}  (Ctrl+C to stop)\n")
    ThreadingHTTPServer(("0.0.0.0" if args.phone else "127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()

"""The API Lambda: every fast endpoint behind API Gateway (HTTP API, payload format 2.0).

Slow AI work (reading a bill or quote) is handed to the worker Lambda as a background job,
because API Gateway cuts requests off at about 30 seconds.
"""

import base64
import json
import logging
import os

import boto3

from solarsaathi import calc, irradiance, store

log = logging.getLogger()
log.setLevel(logging.INFO)

_lambda = boto3.client("lambda")
_polly = boto3.client("polly")

UPLOAD_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
ROOF_SIZES = {"small", "medium", "large", "unknown"}


def _resp(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"content-type": "application/json"}, "body": json.dumps(body)}


def _body(event: dict) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return json.loads(raw)


def _valid_key(key) -> bool:
    return isinstance(key, str) and key.startswith("uploads/") and ".." not in key


def _start_job(job_type: str, payload: dict) -> dict:
    job_id = store.create_job(job_type, payload)
    _lambda.invoke(FunctionName=os.environ["WORKER_FUNCTION"], InvocationType="Event",
                   Payload=json.dumps({"jobId": job_id, "type": job_type, **payload}))
    return _resp(202, {"jobId": job_id})


def uploads(body: dict) -> dict:
    kind, ctype = body.get("kind"), body.get("contentType")
    if kind not in {"bill", "quote"} or ctype not in UPLOAD_TYPES:
        return _resp(400, {"error": "kind must be bill|quote and contentType an image or PDF"})
    return _resp(200, store.presigned_upload(kind, ctype))


def bill_extract(body: dict) -> dict:
    if not _valid_key(body.get("key")):
        return _resp(400, {"error": "missing upload key"})
    return _start_job("bill_extract", {"key": body["key"]})


def quote_check(body: dict) -> dict:
    if not _valid_key(body.get("key")):
        return _resp(400, {"error": "missing upload key"})
    ctx = {}
    if body.get("analysisId"):
        analysis = store.get_analysis(body["analysisId"]) or {}
        ctx = {"recommended_kw": analysis.get("result", {}).get("system_kw") or None,
               "sanctioned_load_kw": analysis.get("bill", {}).get("sanctioned_load_kw")}
    lang = "hi" if body.get("lang") == "hi" else "en"
    return _start_job("quote_check", {"key": body["key"], "ctx": ctx, "lang": lang})


def get_job(job_id: str) -> dict:
    job = store.get_job(job_id)
    if not job:
        return _resp(404, {"error": "not found"})
    return _resp(200, {k: job.get(k) for k in ("jobId", "type", "status", "result", "error")})


def bill_analyse(body: dict) -> dict:
    bill = body.get("bill") or {}
    try:
        lat, lon = float(body["lat"]), float(body["lon"])
    except (KeyError, TypeError, ValueError):
        return _resp(400, {"error": "lat and lon are required"})
    if not (6 <= lat <= 37 and 68 <= lon <= 98):
        return _resp(400, {"error": "location must be in India"})
    roof = body.get("roof") if body.get("roof") in ROOF_SIZES else "unknown"
    try:
        result = calc.analyse(bill, irradiance.annual_ghi(lat, lon), roof)
    except ValueError as e:
        return _resp(400, {"error": str(e)})
    # Only the confirmed numbers are stored: no image, no name, location rounded to ~1 km.
    analysis_id = store.save_analysis({"bill": bill, "lat": round(lat, 2), "lon": round(lon, 2),
                                       "roof": roof, "result": result})
    return _resp(200, {"analysisId": analysis_id, "result": result})


def get_result(analysis_id: str) -> dict:
    record = store.get_analysis(analysis_id)
    if not record:
        return _resp(404, {"error": "not found or expired"})
    return _resp(200, {"analysisId": analysis_id, "result": record["result"]})


def speech(body: dict) -> dict:
    text = str(body.get("text") or "")[:1500]
    if not text:
        return _resp(400, {"error": "text is required"})
    lang = "hi-IN" if body.get("lang") == "hi" else "en-IN"
    try:
        audio = _polly.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId="Kajal",
                                         Engine="neural", LanguageCode=lang)
    except Exception:
        log.exception("neural voice failed, falling back to standard voice")
        audio = _polly.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId="Aditi",
                                         Engine="standard", LanguageCode=lang)
    data = base64.b64encode(audio["AudioStream"].read()).decode()
    return _resp(200, {"audio": data, "contentType": "audio/mpeg"})


def handler(event, context):
    route = event.get("routeKey", "")
    params = event.get("pathParameters") or {}
    try:
        if route == "POST /uploads":
            return uploads(_body(event))
        if route == "POST /bill/extract":
            return bill_extract(_body(event))
        if route == "POST /quote/check":
            return quote_check(_body(event))
        if route == "GET /jobs/{jobId}":
            return get_job(params["jobId"])
        if route == "POST /bill/analyse":
            return bill_analyse(_body(event))
        if route == "GET /results/{analysisId}":
            return get_result(params["analysisId"])
        if route == "POST /speech":
            return speech(_body(event))
        return _resp(404, {"error": "unknown route"})
    except json.JSONDecodeError:
        return _resp(400, {"error": "body must be JSON"})
    except Exception:
        log.exception("unhandled error on %s", route)
        return _resp(500, {"error": "something went wrong"})

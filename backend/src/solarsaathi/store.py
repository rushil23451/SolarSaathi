"""DynamoDB and S3 access. Table and bucket names come from environment variables set by SAM."""

import json
import os
import time
import uuid
from decimal import Decimal

import boto3

_dynamodb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")

TTL_DAYS = 30


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def _table(env: str):
    return _dynamodb.Table(os.environ[env])


def _to_dynamo(obj):
    # DynamoDB needs Decimal, not float.
    return json.loads(json.dumps(obj), parse_float=Decimal)


def _from_dynamo(obj):
    if isinstance(obj, list):
        return [_from_dynamo(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _from_dynamo(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj


def _expires() -> int:
    return int(time.time()) + TTL_DAYS * 86400


# Jobs: slow AI work (reading a bill or a quote) runs in the background and is polled.
def create_job(job_type: str, payload: dict) -> str:
    job_id = new_id()
    _table("JOBS_TABLE").put_item(Item=_to_dynamo(
        {"jobId": job_id, "type": job_type, "status": "pending", "input": payload, "expiresAt": _expires()}))
    return job_id


def finish_job(job_id: str, result: dict | None = None, error: str | None = None) -> None:
    _table("JOBS_TABLE").update_item(
        Key={"jobId": job_id},
        UpdateExpression="SET #s = :s, #r = :r, #e = :e",
        ExpressionAttributeNames={"#s": "status", "#r": "result", "#e": "error"},
        ExpressionAttributeValues=_to_dynamo({":s": "error" if error else "done", ":r": result, ":e": error}),
    )


def get_job(job_id: str) -> dict | None:
    item = _table("JOBS_TABLE").get_item(Key={"jobId": job_id}).get("Item")
    return _from_dynamo(item) if item else None


# Analyses: saved results, so a result can be shared by link.
def save_analysis(record: dict) -> str:
    analysis_id = new_id()
    _table("ANALYSES_TABLE").put_item(Item=_to_dynamo({**record, "analysisId": analysis_id, "expiresAt": _expires()}))
    return analysis_id


def get_analysis(analysis_id: str) -> dict | None:
    item = _table("ANALYSES_TABLE").get_item(Key={"analysisId": analysis_id}).get("Item")
    return _from_dynamo(item) if item else None


# Uploads: the phone sends files straight to S3 with a pre-signed POST.
def presigned_upload(kind: str, content_type: str, max_bytes: int = 10 * 1024 * 1024) -> dict:
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}[content_type]
    key = f"uploads/{kind}/{new_id()}.{ext}"
    post = _s3.generate_presigned_post(
        os.environ["UPLOAD_BUCKET"], key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}, ["content-length-range", 1, max_bytes]],
        ExpiresIn=300,
    )
    return {"key": key, "url": post["url"], "fields": post["fields"]}


def read_upload(key: str) -> tuple[bytes, str]:
    obj = _s3.get_object(Bucket=os.environ["UPLOAD_BUCKET"], Key=key)
    return obj["Body"].read(), obj["ContentType"]

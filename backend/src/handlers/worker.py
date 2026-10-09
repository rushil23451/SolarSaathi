"""The worker Lambda: reads bills and quotes with Claude on Bedrock, invoked asynchronously.

The API Lambda creates a job row and invokes this function with InvocationType=Event, so the
phone gets an answer straight away and polls GET /jobs/{jobId} until the result is ready.
"""

import logging

from solarsaathi import extract, llm, quote_agent, store

log = logging.getLogger()
log.setLevel(logging.INFO)


def handler(event, context):
    job_id, job_type = event["jobId"], event["type"]
    try:
        data, media_type = store.read_upload(event["key"])
        if job_type == "bill_extract":
            result = extract.read_bill(data, media_type)
        elif job_type == "quote_check":
            result = quote_agent.check_quote(data, media_type, event.get("ctx") or {}, event.get("lang", "en"))
        else:
            raise ValueError(f"unknown job type {job_type}")
        store.finish_job(job_id, result=result)
    except (extract.NotABill, llm.ReadError) as e:
        store.finish_job(job_id, error=str(e))
    except Exception:
        log.exception("job %s failed", job_id)
        store.finish_job(job_id, error="could not read this file, please try a clearer photo")

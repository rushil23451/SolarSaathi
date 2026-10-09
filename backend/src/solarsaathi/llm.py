"""Reading documents with Claude on Amazon Bedrock.

The model's only job is to turn a photo or PDF into JSON. It never calculates anything.
Claude in Amazon Bedrock does not support structured outputs, so we ask for JSON in the
prompt, parse it ourselves, and ask once more if the reply is not valid JSON.
"""

import base64
import json
import logging

import anthropic

from . import config

log = logging.getLogger(__name__)

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
DOCUMENT_TYPES = {"application/pdf"}

_client = None


class ReadError(Exception):
    """The document could not be read into JSON."""


def client() -> anthropic.AnthropicBedrockMantle:
    global _client
    if _client is None:
        _client = anthropic.AnthropicBedrockMantle(aws_region=config.AWS_REGION, timeout=90.0, max_retries=2)
    return _client


def file_block(data: bytes, media_type: str) -> dict:
    encoded = base64.standard_b64encode(data).decode("ascii")
    if media_type in IMAGE_TYPES:
        return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}}
    if media_type in DOCUMENT_TYPES:
        return {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": encoded}}
    raise ReadError(f"unsupported file type {media_type}")


def _parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in reply")
    return json.loads(text[start : end + 1])


def _create(messages: list, system: str):
    kwargs = dict(model=config.MODEL_ID, max_tokens=8000, system=system, messages=messages)
    if config.LLM_EFFORT:
        try:
            return client().messages.create(**kwargs, output_config={"effort": config.LLM_EFFORT})
        except anthropic.BadRequestError as e:
            # If this endpoint ever rejects the effort setting, carry on without it.
            log.warning("effort rejected, retrying without it: %s", e)
    return client().messages.create(**kwargs)


def read_to_json(data: bytes, media_type: str, system: str, instruction: str) -> dict:
    messages = [{"role": "user", "content": [file_block(data, media_type), {"type": "text", "text": instruction}]}]
    for attempt in range(2):
        response = _create(messages, system)
        if response.stop_reason == "refusal":
            raise ReadError("the model declined to read this document")
        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            return _parse_json(text)
        except ValueError:
            log.warning("reply was not valid JSON (attempt %d)", attempt + 1)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": "That was not valid JSON. Reply with only the JSON object."})
    raise ReadError("could not get valid JSON from the model")

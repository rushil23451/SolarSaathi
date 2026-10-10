"""Reading documents with a vision model on Amazon Bedrock.

The model's only job is to turn a photo or PDF into JSON. It never calculates anything.
We ask for JSON in the prompt, parse it ourselves, and ask once more if the reply is not
valid JSON.

Two model families are supported, chosen by MODEL_ID:
- Amazon Nova (e.g. global.amazon.nova-2-lite-v1:0) through the Bedrock Converse API.
  Works on AWS Free plan accounts.
- Claude (e.g. anthropic.claude-opus-5-5) through Claude in Amazon Bedrock (Messages API).
  Needs an account that can subscribe to Anthropic models (Paid plan).
"""

import base64
import json
import logging

from . import config

log = logging.getLogger(__name__)

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
DOCUMENT_TYPES = {"application/pdf"}
RETRY_PROMPT = "That was not valid JSON. Reply with only the JSON object."

_clients: dict = {}


class ReadError(Exception):
    """The document could not be read into JSON."""


def _parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in reply")
    return json.loads(text[start : end + 1])


def _check_type(media_type: str) -> None:
    if media_type not in IMAGE_TYPES | DOCUMENT_TYPES:
        raise ReadError(f"unsupported file type {media_type}")


# ---------- Amazon Nova (Bedrock Converse API) ----------

def _bedrock_runtime():
    if "converse" not in _clients:
        import boto3
        from botocore.config import Config

        _clients["converse"] = boto3.client(
            "bedrock-runtime", region_name=config.AWS_REGION,
            config=Config(read_timeout=120, retries={"max_attempts": 3, "mode": "adaptive"}))
    return _clients["converse"]


def _converse_file_block(data: bytes, media_type: str) -> dict:
    if media_type in IMAGE_TYPES:
        return {"image": {"format": media_type.split("/")[1], "source": {"bytes": data}}}
    return {"document": {"format": "pdf", "name": "document", "source": {"bytes": data}}}


def _read_converse(data: bytes, media_type: str, system: str, instruction: str) -> dict:
    messages = [{"role": "user", "content": [_converse_file_block(data, media_type), {"text": instruction}]}]
    for attempt in range(2):
        response = _bedrock_runtime().converse(
            modelId=config.MODEL_ID, system=[{"text": system}], messages=messages,
            inferenceConfig={"maxTokens": 4000, "temperature": 0})
        message = response["output"]["message"]
        if response.get("stopReason") == "content_filtered":
            raise ReadError("the model declined to read this document")
        text = "".join(block.get("text", "") for block in message["content"])
        try:
            return _parse_json(text)
        except ValueError:
            log.warning("reply was not valid JSON (attempt %d)", attempt + 1)
            messages += [message, {"role": "user", "content": [{"text": RETRY_PROMPT}]}]
    raise ReadError("could not get valid JSON from the model")


# ---------- Claude (Claude in Amazon Bedrock, Messages API) ----------

def _anthropic():
    if "anthropic" not in _clients:
        import anthropic

        _clients["anthropic"] = anthropic.AnthropicBedrockMantle(
            aws_region=config.AWS_REGION, timeout=90.0, max_retries=2)
    return _clients["anthropic"]


def _anthropic_file_block(data: bytes, media_type: str) -> dict:
    encoded = base64.standard_b64encode(data).decode("ascii")
    kind = "image" if media_type in IMAGE_TYPES else "document"
    return {"type": kind, "source": {"type": "base64", "media_type": media_type, "data": encoded}}


def _anthropic_create(messages: list, system: str):
    import anthropic

    kwargs = dict(model=config.MODEL_ID, max_tokens=8000, system=system, messages=messages)
    if config.LLM_EFFORT:
        try:
            return _anthropic().messages.create(**kwargs, output_config={"effort": config.LLM_EFFORT})
        except anthropic.BadRequestError as e:
            # If this endpoint ever rejects the effort setting, carry on without it.
            log.warning("effort rejected, retrying without it: %s", e)
    return _anthropic().messages.create(**kwargs)


def _read_anthropic(data: bytes, media_type: str, system: str, instruction: str) -> dict:
    messages = [{"role": "user", "content": [_anthropic_file_block(data, media_type), {"type": "text", "text": instruction}]}]
    for attempt in range(2):
        response = _anthropic_create(messages, system)
        if response.stop_reason == "refusal":
            raise ReadError("the model declined to read this document")
        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            return _parse_json(text)
        except ValueError:
            log.warning("reply was not valid JSON (attempt %d)", attempt + 1)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": RETRY_PROMPT})
    raise ReadError("could not get valid JSON from the model")


def read_to_json(data: bytes, media_type: str, system: str, instruction: str) -> dict:
    _check_type(media_type)
    if config.is_anthropic_model():
        return _read_anthropic(data, media_type, system, instruction)
    return _read_converse(data, media_type, system, instruction)

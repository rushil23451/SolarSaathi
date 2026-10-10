"""The quote check, run by a Strands agent (AWS open-source Agents SDK).

The agent calls two tools, `read_quote` and `run_quote_checks`, then writes a short summary
and the questions to ask the vendor. The tools store their results as they run, so the
traffic-light report always comes from code. If the agent fails for any reason, the same
pipeline runs directly and the frontend falls back to template questions.
"""

import json
import logging

from strands import Agent, tool

from . import config, extract, quote_rules

log = logging.getLogger(__name__)

SYSTEM = """You help an Indian family judge a rooftop solar quotation.
Steps, in order:
1. Call read_quote to read the quotation.
2. Call run_quote_checks with nothing else; it uses what read_quote found.
3. Reply with only this JSON: {"summary": "...", "questions": ["...", "..."]}
   - summary: one plain sentence on whether the quote looks fair and the biggest problem, if any.
   - questions: up to 6 short questions the family should ask the vendor, one per amber or red check.
   - Write both in LANGUAGE. Use only facts from the tool results; never invent numbers.

What the terms and checks mean (use these meanings, never guess others):
- DCR = Domestic Content Requirement: panels made with Indian-made solar cells. Required for the
  PM Surya Ghar subsidy; non-DCR panels can get the subsidy rejected.
- ALMM = Approved List of Models and Manufacturers, published by MNRE (the government).
- PM Surya Ghar = the central government rooftop solar subsidy for homes, applied for on the national portal.
- Net metering = the discom's two-way meter; its application is normally part of the vendor's job.
- price: cost per kW compared with the normal range. dcr: whether DCR panels are stated.
  almm: whether the panel maker is approved. size: quoted kW vs what the bill needs and the sanctioned load.
  inverter: on-grid and matched to the panels. warranties: 25-year panel performance, 5-year inverter,
  5-year maintenance. items: standard items included, nothing charged extra. payment: advance before
  installation. subsidy: whether the vendor will file the subsidy application on the portal."""


def _model():
    if not config.is_anthropic_model():
        from strands.models.bedrock import BedrockModel

        return BedrockModel(model_id=config.MODEL_ID, region_name=config.AWS_REGION, temperature=0)

    import anthropic
    from strands.models.anthropic import AnthropicModel

    model = AnthropicModel(model_id=config.MODEL_ID, max_tokens=8000)
    # Strands builds a first-party Anthropic client; point it at Claude in Amazon Bedrock instead.
    model.client = anthropic.AsyncAnthropicBedrockMantle(aws_region=config.AWS_REGION)
    return model


def _parse(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    data = json.loads(text[start : end + 1])
    return {"summary": str(data.get("summary") or ""), "questions": [str(q) for q in data.get("questions") or []][:6]}


def check_quote(data: bytes, media_type: str, ctx: dict, lang: str = "en") -> dict:
    state: dict = {}

    @tool
    def read_quote() -> dict:
        """Read the uploaded solar quotation into structured fields (price, size, panels, inverter, warranties, extras)."""
        state["quote"] = extract.read_quote(data, media_type)
        return state["quote"]

    @tool
    def run_quote_checks() -> dict:
        """Run the nine fixed checks on the quotation read by read_quote. Returns each check's colour and details."""
        if "quote" not in state:
            return {"error": "call read_quote first"}
        state["report"] = quote_rules.run_all(state["quote"], ctx)
        return state["report"]

    advice = None
    try:
        agent = Agent(
            model=_model(),
            tools=[read_quote, run_quote_checks],
            system_prompt=SYSTEM.replace("LANGUAGE", "Hindi" if lang == "hi" else "English"),
            callback_handler=None,
        )
        result = agent("Check this quotation.")
        advice = _parse(str(result))
    except extract.NotABill:
        raise
    except Exception:
        log.exception("quote agent failed; falling back to the direct pipeline")

    if "quote" not in state:
        state["quote"] = extract.read_quote(data, media_type)
    if "report" not in state:
        state["report"] = quote_rules.run_all(state["quote"], ctx)
    return {"quote": state["quote"], **state["report"], "advice": advice}

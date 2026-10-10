# SolarSaathi ☀️

**Is rooftop solar worth it for you? Two photos, one honest answer.**

SolarSaathi reads an Indian electricity bill from a photo and tells a family whether rooftop
solar pays off for them: what size to buy, what it costs after the PM Surya Ghar subsidy,
the monthly saving, the payback period and the CO₂ avoided. It also reads a vendor's quote
and flags overpricing, non-DCR panels (which lose the subsidy), hidden extras and risky
payment terms, then gives the family the exact questions to ask the vendor.

Track 03, Waste and Energy (rooftop solar). Built on AWS with two AWS open-source tools
(**Strands Agents SDK**, **AWS SAM CLI**) and deployed on AWS (Lambda, API Gateway, S3,
DynamoDB, Bedrock with **Amazon Nova**, Polly, Amplify). Claude on Bedrock is a one-setting
switch for Paid-plan accounts.

> **Design rule:** the AI only *reads* documents. Every number comes from plain, unit-tested
> Python in [`backend/src/solarsaathi/calc.py`](backend/src/solarsaathi/calc.py).

---

## How it works

```
Phone (React PWA on Amplify)
  │ 1. POST /uploads ──► pre-signed S3 POST ──► photo goes straight to S3 (deleted after 24 h)
  │ 2. POST /bill/extract or /quote/check ──► job created, worker invoked in the background
  │ 3. GET /jobs/{id} (poll every 2 s) ◄── worker writes the result to DynamoDB
  │ 4. POST /bill/analyse ──► calculation engine + NASA POWER sunlight ──► result saved
  ▼
API Gateway (HTTP API) ─► ApiFunction (Lambda, fast routes)
                          └─► WorkerFunction (Lambda, async)
                                ├─ Amazon Nova on Bedrock (or Claude): reads the bill / quote into JSON
                                └─ Strands agent: runs the 9 quote rules, writes vendor questions
DynamoDB: Jobs · Analyses (30-day TTL) · IrradianceCache      Polly: Hindi/English voice
```

Two Lambda functions instead of one per endpoint: the fast routes share one warm function,
and the slow AI work runs in a separate worker. That's because API Gateway stops waiting
after about 30 seconds, and reading a photo with an AI model can take longer.

## Repository layout

| Path | What it is |
| --- | --- |
| `backend/template.yaml` | SAM template: every AWS resource, IAM permission and alarm |
| `backend/src/solarsaathi/calc.py` | Calculation engine: size, cost, subsidy, savings, payback, CO₂, verdict |
| `backend/src/solarsaathi/tariff.py` | Slab tariff → monthly bill (checked against real BSES bills) |
| `backend/src/solarsaathi/quote_rules.py` | The nine quote checks |
| `backend/src/solarsaathi/quote_agent.py` | Strands agent that runs the quote check (with a fallback pipeline) |
| `backend/src/solarsaathi/llm.py`, `prompts.py`, `extract.py` | Reading documents on Bedrock (Nova via Converse, or Claude) + sanity checks against meter readings |
| `backend/src/solarsaathi/data/*.json` | Tariffs, subsidy rules, cost benchmarks, approved panel makers (**verify these**) |
| `backend/src/handlers/` | Lambda entry points: `api.py`, `worker.py` |
| `backend/tests/` | 29 unit tests, including tariff calibration against real bills |
| `backend/scripts/demo_offline.py` | Run the engine on the four sample bills, no AWS needed |
| `backend/scripts/mock_api.py` | Local fake API so the frontend works without AWS |
| `backend/scripts/try_bill.py` | Read a real bill photo with Bedrock from your laptop |
| `backend/scripts/eval_bills.py` | Score a model on the sample bills (which fields it reads correctly) |
| `frontend/` | React + Vite phone web app (Hindi/English) |
| `amplify.yml` | Build settings for Amplify Hosting |
| `docs/AWS_SETUP.md` | **Step-by-step AWS setup and deployment** |
| `docs/SCALING.md` | What to change to serve thousands of users |

## Quick start

### 1. Run the maths on the sample bills (no AWS, 1 minute)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/src/requirements.txt pytest
cd backend && python -m pytest -q && python scripts/demo_offline.py --live
```

### 2. Run the app locally with the mock API (no AWS)

```bash
python backend/scripts/mock_api.py
```

In a second terminal:

```bash
cd frontend && npm install && echo "VITE_API_URL=http://localhost:8787" > .env.local && npm run dev
```

Open http://localhost:5173. Any uploaded photo "reads" as the sample BSES Rajdhani bill; the
calculation and quote rules are real.

### 3. Deploy to AWS

Follow **[docs/AWS_SETUP.md](docs/AWS_SETUP.md)**. Short version, once the AWS CLI, SAM CLI and
Bedrock model access are set up:

```bash
cd backend && sam build && sam deploy
```

Then put the printed `ApiUrl` into Amplify Hosting as `VITE_API_URL`.

## What the sample bills show

| Bill | Category | Use | Verdict |
| --- | --- | --- | --- |
| BSES Rajdhani, May 2025 | Domestic, 4 kW | 367 units/month (7-month average) | **Yes**: 2.5 kW, ₹81,000 after subsidy, payback ≈ 5.6 years |
| BSES Rajdhani, Jan 2021 | Domestic, 1 kW | 153 units/month | **No**: bill is already ₹0 under Delhi's free-200-units scheme |
| BSES Yamuna, Feb 2024 | Non-domestic, 7 kVA | 565 units/month | Pays back ≈ 3 years, but **no** PM Surya Ghar subsidy (homes only) |
| BSES Rajdhani, Jun 2020 (PDF, quarterly) | Non-domestic, 1 kVA | 402 units/month | Size capped at 1 kW by sanctioned load → "ask for a load increase" |

## Before the demo: verify the reference data

Figures in `backend/src/solarsaathi/data/` came from the sample bills and from memory. Check
each against its official source and update the JSON:

- [ ] PM Surya Ghar subsidy amounts: pmsuryaghar.gov.in
- [ ] DERC tariff slabs, fixed charges, PPAC, surcharges: current DERC tariff order
- [ ] Delhi free-electricity subsidy rules (still 200 units free, 50% up to 400?)
- [ ] Cost per kW range: government benchmark + 2–3 real local quotes
- [ ] ALMM List-I makers (then set `almm_list_complete: true`): mnre.gov.in
- [ ] Grid emission factor: CEA CO₂ Baseline Database
- [ ] Delhi Solar Policy incentives (then set `enabled: true` in `solar.json`)

## Privacy

Bills carry names, addresses and account numbers. The model is told not to copy them,
uploads are deleted from S3 after 24 hours, only confirmed numbers are stored (30-day TTL),
location is rounded to ~1 km, and there is no login. **Never commit real bills to git**
(`.gitignore` blocks image and PDF files).

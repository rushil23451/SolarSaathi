# Scaling SolarSaathi beyond the demo

The architecture is already serverless: Lambda, API Gateway, DynamoDB (on-demand), S3 and
Amplify all scale on their own and cost nothing when idle. What breaks first at scale is not
the servers but **model throughput, cost, abuse and data accuracy**. This is the order in
which to fix things.

## What changes at each stage

| Stage | Users | Change |
| --- | --- | --- |
| Demo | tens | Nothing. Current template. |
| Pilot (one city, one discom) | ~1,000/day | Eval set, queue, cheaper reading model, real tariff data, CI/CD |
| City-wide | ~10,000/day | Quota increases, abuse protection, monitoring dashboards, more discoms |
| Multi-state | 100,000+/day | Tariff data service, more languages, analytics lake, partner integrations |

## 1. Accuracy first: build an eval set

Before changing models or prompts, collect 50–100 real bills (with consent, personal details
blurred) across discoms and photo quality. Write down the correct fields for each, then run
`try_bill.py` over all of them and count field-level errors. Every prompt or model change gets
checked against this set. This is what makes "reads your actual bill" trustworthy.

## 2. Put a queue between the API and the worker

Today the API invokes the worker Lambda directly (async). At scale, put **Amazon SQS** in between:

- The API sends a message; the worker reads from the queue.
- Set `ScalingConfig.MaximumConcurrency` on the SQS event source to cap parallel Bedrock calls,
  which keeps you under Bedrock quotas instead of getting throttled.
- Add a dead-letter queue for jobs that keep failing, plus an alarm on its depth.

## 3. Model throughput and cost

- **Quotas:** Claude in Amazon Bedrock defaults to 2 million input tokens per minute. One bill
  read is roughly 3,000 input tokens, so that is roughly 600 bills per minute. Request increases
  in *Service Quotas* well before a launch.
- **Right model per job:** reading a clear bill is a simple task. Once the eval set shows a
  faster, cheaper Claude model is just as accurate, use it for `bill_extract` and keep the
  stronger model for the quote agent. `ModelId` is already a parameter; split it into two.
- **Skip repeat work:** cache results by a hash of the uploaded file, so the same bill photo
  is never read twice.

## 4. Protect against abuse and runaway cost

- API Gateway throttling is already set (10 req/s, burst 20). Raise it deliberately.
- HTTP APIs can't attach AWS WAF directly. Put **CloudFront + AWS WAF** in front with a
  rate-based rule per IP, or move to a REST API with usage plans.
- Add **Amazon Cognito** (anonymous guest identities, or phone login) and a per-user daily
  limit stored in DynamoDB.
- Keep the AWS Budgets alert, and add a CloudWatch alarm on Bedrock invocation count.

## 5. Lambda limits and latency

- New accounts often start with a concurrency limit of 10. Request **1,000** in Service Quotas.
- If the first request after idle feels slow, add provisioned concurrency to `ApiFunction` only.
- Replace polling with push (API Gateway WebSocket or AWS AppSync) only if polling traffic
  becomes significant. At pilot scale, polling every 2 seconds is fine.

## 6. Tariff and subsidy data as a maintained service

Tariffs change every year in every state, and a wrong tariff makes every answer wrong.

- Move `data/*.json` to versioned files in S3 (or a DynamoDB table) with an effective date,
  a source link and a reviewer, keyed by state + discom + category.
- Keep a calibration test per discom: a real bill and its expected amount, like
  `test_tariff.py` does for BSES, run in CI on every data change.
- Add discoms one at a time, each with its own tests.

## 7. Observability

- CloudWatch dashboard: jobs started/finished/failed, p95 job time, Bedrock latency, analyses per day.
- Turn on AWS X-Ray tracing on both functions (`Tracing: Active` in the template).
- Turn on Bedrock model invocation logging to S3 (mind privacy: it stores prompts, which include bill images).
- Log a structured line per job (type, duration, model, success) with no personal data.

## 8. Impact analytics

Judges, partners and funders will ask "how much solar did this unlock?"

- Stream the Analyses and Jobs tables (DynamoDB Streams or a daily export) to S3, and query
  with Athena: kW recommended, ₹ of overpricing flagged, subsidy-risk quotes caught, CO₂ potential.
- Publish a small public dashboard from those aggregates (no personal data).

## 9. Privacy and compliance (India DPDP Act 2023)

- Show a clear consent line before upload (what is read, what is kept, for how long).
- Keep the 24-hour S3 expiry and 30-day result TTL; document them in a privacy notice.
- Least-privilege IAM: replace `Resource: "*"` on Bedrock and Polly with specific ARNs.
- Encrypt tables and bucket with a customer-managed KMS key if a partner requires it.

## 10. Delivery pipeline

- GitHub Actions: on every pull request run `pytest` and `npm run build`; on merge to `main`
  run `sam build && sam deploy` using an **OIDC role** (no long-lived AWS keys in GitHub).
- Two stacks from the same template: `solarsaathi-staging` and `solarsaathi-prod`
  (`samconfig.toml` environments). Amplify gets a branch per environment.

## 11. Reach more people

- **More languages:** Claude can write the explanation in any Indian language; check Amazon
  Polly's voice list for which of them can be spoken aloud.
- **WhatsApp:** most families would rather send a photo on WhatsApp than open a website. The
  same API can sit behind a WhatsApp Business webhook (a new Lambda route); the result
  card becomes a message.
- **RWA mode:** add up the common-area bills of a housing society and size a shared system
  (the stretch goal from the design doc).

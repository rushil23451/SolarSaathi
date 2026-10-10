# AWS setup and deployment, step by step

> **Just want to run it?** See [RUNNING.md](RUNNING.md): `./run.sh setup`, `./run.sh local`, `./run.sh deploy`.

This takes about 60–90 minutes the first time. One person (the team leader) does steps 1–4;
everyone else can work against the mock API until the backend is live.

Region used everywhere: **Asia Pacific (Mumbai), `ap-south-1`**. Claude in Amazon Bedrock is
available there through the *global* endpoint.

---

## Step 1. Create the AWS account (team leader, 15 min)

1. Sign up at the AWS Free Tier link from the hackathon page. A new account starts with up to
   $200 in credits. Debit cards and RuPay work; the verification charge is about ₹2.
2. **Turn on MFA for the root user**: top-right account menu → *Security credentials* →
   *Assign MFA device*. Then stop using the root user for daily work.
3. Separately, every team member verifies their student status on **AWS Builder Center**
   (required to compete; it is not the same thing as the AWS account).

## Step 2. Create a working user and access keys (5 min)

For a weekend hackathon the simplest safe setup is one IAM user per team member:

1. Console → **IAM** → *Users* → *Create user* → name it e.g. `rushil-dev`.
2. *Attach policies directly* → `AdministratorAccess` (fine for a hackathon account; remove it afterwards).
3. Open the user → *Security credentials* → *Create access key* → *Command Line Interface (CLI)*.
4. Copy the **Access key ID** and **Secret access key**. Never paste them into code, chat or git.

## Step 3. Choose the model (5 min)

The app reads bills with a vision model on Amazon Bedrock. Which models you can use depends on
your account's plan:

| Account plan | Models that work | What to do |
| --- | --- | --- |
| **Free plan** (new accounts) | **Amazon Nova** (Nova 2 Lite, Nova Pro) | Nothing. Nova works straight away. This is the default. |
| **Paid plan** | Amazon Nova **and** Claude (Anthropic) | Bedrock console → *Model catalog* → Claude → submit the use-case form once |

Anthropic models are sold through AWS Marketplace, which Free-plan accounts can't use. With
Claude on a Free plan you get a confusing `404 ... model does not exist` error.

Check your plan and a model's status from the terminal:

```bash
aws freetier get-account-plan-state --region us-east-1
```

```bash
aws bedrock get-foundation-model-availability --model-id amazon.nova-2-lite-v1:0 --region ap-south-1
```

`agreementAvailability.status` must be `AVAILABLE`.

Model IDs (pass one as `MODEL_ID` locally, or `ModelId` when deploying):

| Model | ID to use from Mumbai |
| --- | --- |
| Amazon Nova 2 Lite (default, cheapest) | `global.amazon.nova-2-lite-v1:0` |
| Amazon Nova Pro | `apac.amazon.nova-pro-v1:0` |
| Claude Opus 5.5 (Paid plan) | `anthropic.claude-opus-5-5` |
| Claude Haiku 5.5 (Paid plan) | `anthropic.claude-haiku-5-5` |

## Step 4. Install the tools on your laptop (15 min)

On macOS with Homebrew:

```bash
brew install awscli aws-sam-cli python@3.13
```

- **AWS CLI**: talks to your account.
- **AWS SAM CLI** (AWS open source): builds and deploys `backend/template.yaml`.
- **Python 3.13**: matches the Lambda runtime. `sam build` needs the same Python version on
  your machine. If you'd rather not install it, use `sam build --use-container`, which needs
  Docker or **Finch** (AWS open-source container tool: `brew install --cask finch`).

Then connect the CLI to your account:

```bash
aws configure
```

Enter the two keys from step 2, region `ap-south-1`, output `json`. Check it worked:

```bash
aws sts get-caller-identity
```

## Step 5. Test the model on real bills from your laptop (5 min)

Before deploying anything, confirm that the model reads your bills correctly:

```bash
source .venv/bin/activate
python backend/scripts/try_bill.py ~/Desktop/bill_folder/bill1.webp
```

You'll see the fields the model read and the full result. To score a model on all the sample
bills at once (units, days, load, category, history):

```bash
cd backend && python scripts/eval_bills.py ~/Desktop/bill_folder
```

```bash
MODEL_ID=apac.amazon.nova-pro-v1:0 python scripts/eval_bills.py ~/Desktop/bill_folder
```

If a field is often wrong, improve `backend/src/solarsaathi/prompts.py` and run again. This is
the cheapest place to tune. Add more bills and their correct values to
`backend/tests/fixtures/bills.json` so the score means something.

If you get `404 ... does not exist` for a Claude model, see step 3 (Free plan).

## Step 6. Deploy the backend (10 min)

```bash
cd backend
sam build
sam deploy --parameter-overrides AlertEmail=you@example.com
```

- `sam build` installs the Python packages for Lambda (Linux, arm64).
- `sam deploy` shows the change set; type `y` to deploy. It creates the S3 bucket, three
  DynamoDB tables, the HTTP API, two Lambda functions, log groups, an error alarm and a
  **$10/month budget alert**.
- AWS emails you to **confirm the SNS subscription**. Click the link, or you won't get alerts.

At the end, SAM prints the outputs. Copy **`ApiUrl`**, e.g.
`https://abc123.execute-api.ap-south-1.amazonaws.com`.

Quick check:

```bash
curl -X POST "$API_URL/uploads" -H 'content-type: application/json' -d '{"kind":"bill","contentType":"image/jpeg"}'
```

You should get back a JSON with `url`, `fields` and `key`.

## Step 7. Run the frontend against the real backend (5 min)

```bash
cd frontend
echo "VITE_API_URL=https://abc123.execute-api.ap-south-1.amazonaws.com" > .env.local
npm run dev
```

Open http://localhost:5173 and photograph a real bill. To try it on your phone over Wi-Fi,
run `npm run dev -- --host` and open the printed network address. The camera works there, but
"Use my location" needs HTTPS, so pick a city instead until step 8.

## Step 8. Host the frontend on Amplify (15 min)

1. Push this repository to GitHub (private is fine). `.gitignore` already keeps bills and
   `.env.local` out.
2. Console → **AWS Amplify** → *Create new app* → *GitHub* → authorise → pick the repo and branch.
3. Amplify detects `amplify.yml` (app root `frontend`). Tick *My app is a monorepo* if asked
   and enter `frontend`.
4. *Advanced settings* → *Environment variables* → add `VITE_API_URL` = your `ApiUrl`.
5. *Save and deploy*. After 2–3 minutes you get a URL like `https://main.d1abc.amplifyapp.com`.
   Every `git push` redeploys it automatically.

## Step 9. Lock the backend to your frontend (2 min)

While developing, CORS allows any origin. Once Amplify gives you a URL, restrict it:

```bash
cd backend
sam deploy --parameter-overrides AllowedOrigin=https://main.d1abc.amplifyapp.com AlertEmail=you@example.com
```

For local development afterwards, deploy a second stack with `--stack-name solarsaathi-dev`
and leave `AllowedOrigin=*` there.

## Step 10. Watch it work

```bash
sam logs --stack-name solarsaathi -n WorkerFunction --tail
```

This streams the worker's logs while you test. In the console: **CloudWatch** → *Alarms*
for errors, **Billing** → *Budgets* for spend, **Bedrock** → *Usage* for model calls.

---

## What it costs (approximate)

| Service | Demo-weekend usage | Cost |
| --- | --- | --- |
| Bedrock (Amazon Nova 2 Lite) | ~200 bill reads + ~50 quote checks | well under $1 (check the Bedrock pricing page) |
| Bedrock (Claude Opus 5.5, if you switch) | same usage | roughly $10–20 (check the Bedrock pricing page) |
| Lambda, API Gateway, DynamoDB, S3 | a few thousand requests | within the free tier |
| Polly (neural voice) | a few hundred results read aloud | within the free tier for new accounts |
| Amplify Hosting | one small site | within the free tier |

The model is the only real cost. Change `ModelId` only **after** scoring the new model with
`eval_bills.py`.

## Clean up after the hackathon

```bash
cd backend && sam delete --stack-name solarsaathi
```

Then delete the Amplify app in the console, and delete the IAM users' access keys (or the users).

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `404 ... model does not exist` for a Claude model | Account is on the Free plan (step 3). Use Nova, or upgrade to Paid |
| `AccessDeniedException` / 403 from Bedrock | Model access not granted yet (step 3), or wrong region |
| "on-demand throughput isn't supported" | Use the inference profile ID (`global.` / `apac.` prefix) from step 3 |
| `No space left on device` during installs | Free up disk space (System Settings → General → Storage) |
| `sam build` says Python 3.13 not found | `brew install python@3.13`, or `sam build --use-container` with Docker/Finch |
| Upload fails with a CORS error | `AllowedOrigin` doesn't match the site's URL exactly (no trailing slash) |
| Job stays "pending" | Check worker logs (`sam logs ... -n WorkerFunction`); usually Bedrock access |
| "Could not read this file" | Photo too blurry or cropped; the bill's units table must be visible |
| Deploy fails on concurrency | New accounts have low Lambda limits; don't add reserved concurrency |

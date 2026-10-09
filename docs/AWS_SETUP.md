# AWS setup and deployment, step by step

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

## Step 3. Enable Claude in Amazon Bedrock (10 min, sometimes longer)

1. Console → switch region to **Asia Pacific (Mumbai)** (top right).
2. Open **Amazon Bedrock** → *Model access* (or *Model catalog*).
3. Request access to **Anthropic: Claude Opus 5.5**. Fill in the short use-case form
   ("Student hackathon: reading electricity bills to recommend rooftop solar").
4. Wait until the status says *Access granted*.

If Opus 5.5 access is slow to be approved, deploy with a model that is open to every Bedrock
customer and switch later (no code change, it's a parameter):

```bash
sam deploy --parameter-overrides ModelId=anthropic.claude-opus-4-8
```

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

## Step 5. Test Bedrock on a real bill from your laptop (5 min)

Before deploying anything, confirm that the model reads your bills correctly:

```bash
source .venv/bin/activate
python backend/scripts/try_bill.py ~/Desktop/bill_folder/bill1.webp
```

You'll see the fields the model read and the full result. Try all four sample bills. If a
field is wrong, improve `backend/src/solarsaathi/prompts.py` and run again. This is the
cheapest place to tune prompts.

If you get an access error, step 3 isn't finished yet. If you get a model-ID error, check the
exact ID on the Bedrock console's model page and pass it with `MODEL_ID=... python ...`.

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
| Bedrock (Claude Opus 5.5) | ~200 bill reads + ~50 quote checks | roughly $10–20 (Bedrock pricing differs from Anthropic's list price; check the Bedrock pricing page) |
| Lambda, API Gateway, DynamoDB, S3 | a few thousand requests | within the free tier |
| Polly (neural voice) | a few hundred results read aloud | within the free tier for new accounts |
| Amplify Hosting | one small site | within the free tier |

The model is the only real cost. To cut it, change `ModelId` (a faster, cheaper Claude
model can read clear bills well) **after** checking it against your sample bills with
`try_bill.py`.

## Clean up after the hackathon

```bash
cd backend && sam delete --stack-name solarsaathi
```

Then delete the Amplify app in the console, and delete the IAM users' access keys (or the users).

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `AccessDeniedException` / 403 from Bedrock | Model access not granted yet (step 3), or wrong region |
| Model not found | Check the exact model ID on the Bedrock console and redeploy with `ModelId=...` |
| `sam build` says Python 3.13 not found | `brew install python@3.13`, or `sam build --use-container` with Docker/Finch |
| Upload fails with a CORS error | `AllowedOrigin` doesn't match the site's URL exactly (no trailing slash) |
| Job stays "pending" | Check worker logs (`sam logs ... -n WorkerFunction`); usually Bedrock access |
| "Could not read this file" | Photo too blurry or cropped; the bill's units table must be visible |
| Deploy fails on concurrency | New accounts have low Lambda limits; don't add reserved concurrency |

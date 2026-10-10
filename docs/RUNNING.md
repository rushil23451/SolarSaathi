# Running SolarSaathi: local demo and AWS deployment

This guide gets you from a fresh terminal to a working demo, then to a deployed app on AWS.
Everything goes through one helper script, `./run.sh`, run from the project folder.

## The three ways to run the app

| Command | Backend | AI reading | Needs | Use it for |
| --- | --- | --- | --- | --- |
| `./run.sh mock` | fake API on your laptop | none: every bill reads as the same sample | nothing | UI work, emergency backup demo |
| `./run.sh local` | **real backend on your laptop** | **real, Amazon Nova on Bedrock** | an AWS profile where Bedrock works (`college`) | **the demo, until the new account is verified** |
| `./run.sh deploy` + `./run.sh cloud` | **real backend on AWS** (Lambda, S3, DynamoDB) | real, on Bedrock | a verified AWS account (`deploy`) | the final, deployed app |

`local` runs exactly the same code as the Lambda functions, including the calculation engine,
the nine quote checks and the Strands quote agent. The only difference is that uploads and
results are kept in memory instead of S3 and DynamoDB, and disappear when you stop it.

## The two AWS profiles

A *profile* is a named set of AWS keys stored in `~/.aws/credentials`. The project uses two:

| Profile | Account | Used by | Why |
| --- | --- | --- | --- |
| `college` | the account made with your college email | `./run.sh local` | Bedrock works there today. It can't deploy: its organization blocks Lambda, S3, CloudFormation and others. |
| `deploy` | your new account (with billing) | `./run.sh deploy`, `./run.sh cloud` | Full AWS access once AWS finishes verifying it. |

Profiles don't overwrite each other, so you never need to swap keys back and forth again.
If the new account starts working, you can run the local demo on it too:
`LOCAL_PROFILE=deploy ./run.sh local`.

---

## Part 1. One-time setup (15 min)

### 1.1 Tools you need

Check what's installed:

```bash
aws --version; node --version; sam --version
```

- Missing `aws` or `node`: `brew install awscli node`.
- Missing `sam` (only needed for deploying): install it with pip into its own folder. This
  avoids Homebrew compiling it from source, which is slow and fills the disk:

```bash
/opt/homebrew/bin/python3.13 -m venv ~/.aws-sam-cli && ~/.aws-sam-cli/bin/pip install aws-sam-cli && ln -sf ~/.aws-sam-cli/bin/sam /opt/homebrew/bin/sam
```

Then run `rehash` (or open a new terminal tab).

### 1.2 Get an access key for each account

Do this once per account, in the browser:

1. Sign in to the account. Check the account ID at the top right so you know which account you're in.
2. Search **IAM** → **Users** → click your user (`rushil-dev`), or **Create user** with the
   **AdministratorAccess** policy if there isn't one.
3. **Security credentials** tab → **Create access key** → **Command Line Interface (CLI)** →
   copy the **Access key ID** and the **Secret access key**. The secret is shown only once.

For the **college** account: running `aws configure` for the new account replaced the old
college keys on your laptop, so create a new access key there. A user can have at most two
keys; if AWS says the limit is reached, deactivate and delete the old one first.

Never paste keys into chats, code or GitHub. They only go into `aws configure`.

### 1.3 Run setup

```bash
cd ~/Desktop/solarsaathi
./run.sh setup
```

It installs the Python and frontend packages, then asks for each profile:

- **Profile 'college'**: paste the college account's key ID and secret. Region `ap-south-1`, output `json`.
- **Profile 'deploy'**: if your current default keys are for the new account, answer **y** to
  copy them, so you don't have to paste them again. Otherwise paste the new account's keys.

You can re-run `./run.sh setup` at any time to fix or replace keys.

### 1.4 Check what works

```bash
./run.sh check
```

For each profile it prints which account it reaches, whether Bedrock answers, and (for
`deploy`) whether deploying is allowed. It sends one tiny test message to Nova, which costs a
fraction of a paisa. Example while the new account is still being verified:

```
Profile 'college' (local)
  ✓ signed in to account 111122223333, region ap-south-1
  ✓ Bedrock (global.amazon.nova-2-lite-v1:0) answers

Profile 'deploy' (deploy)
  ✓ signed in to account 2xxxxxxxxxxx, region ap-south-1
  ✗ Bedrock: account verification still in progress (wait, or ask AWS Support)

What you can do now
  ✓ ./run.sh local   (real AI on your laptop)
  ✗ ./run.sh deploy  not yet (see above); use ./run.sh local meanwhile
  ✓ ./run.sh mock    (always works, no AWS)
```

Run `./run.sh check` again every few hours. When the `deploy` lines turn green, go to Part 4.

---

## Part 2. Run the real app on your laptop

```bash
./run.sh local
```

You'll see:

```
AWS profile : college (account 111122223333)
Model       : global.amazon.nova-2-lite-v1:0 in ap-south-1
API         : http://localhost:8787
Open the app:  http://localhost:5173
```

Open **http://localhost:5173**. The terminal shows each request as it happens, which is handy
during a demo. Press **Ctrl+C** to stop everything.

### On your phone

The camera upload feels best on a real phone. Connect the phone and laptop to the same Wi-Fi, then:

```bash
./run.sh local --phone
```

Open the **"On your phone"** address it prints (like `http://192.168.1.5:5173`) in the
phone's browser.

- "Use my location" needs HTTPS, so on the phone pick a **city** instead. It works after
  deployment on Amplify.
- If the phone can't connect, macOS may be blocking it: allow incoming connections for
  Python and Node when macOS asks, or check System Settings → Network → Firewall.
- College and public Wi-Fi often block devices from talking to each other. A **phone
  hotspot** with the laptop connected to it always works.

### Read aloud

"Listen" uses Amazon Polly when the profile allows it. If it doesn't (the college account
blocks Polly), the app automatically uses the phone's or laptop's built-in voice, so the
button still works.

---

## Part 3. The demo (3–4 minutes)

Before you start, run `./run.sh check`, then `./run.sh local`, and do one full run-through so
everything is warm. Keep the sample files handy:

- Bills: `~/Desktop/bill_folder/` (`bill1.webp` is the clearest)
- Quote: `samples/sample_quote.pdf` (a 3 kW quote with planted problems)

**1. The problem (20 s).** "A family in Delhi pays ₹2,000–₹3,000 a month for electricity.
Vendors pitch rooftop solar, but nobody tells them honestly whether it pays off for *their*
house, or whether the quote is fair."

**2. Photograph the bill (40 s).** Tap **Check my electricity bill** → choose `bill1.webp`
(or photograph a printed bill with the phone). While it reads (about 10 seconds), say: "Amazon
Nova on Bedrock reads the bill: units, sanctioned load and the past months' history."

**3. Confirm (20 s).** Point out that the family can fix anything the AI misread, and that the
app warns when a photo was hard to read. "The AI only *reads*. Every number after this comes
from plain, tested Python code, not from the AI."

**4. The answer (90 s).** Pick **New Delhi** and the roof size, then tap **Show my answer**.
- The verdict and the four headline numbers: you pay ₹81,000 after subsidy, save about ₹1,240 a
  month, pay back in 5.6 years, and avoid 2.4 tonnes of CO₂ a year.
- **Solar covers 77%** of your use (orange vs blue bar).
- **Your bill ₹1,240 → ₹0**, with the reason: the leftover grid units stay under Delhi's free 200
  units. Tap a winter month on the chart to show December getting close to the line.
- **When it pays for itself**: the line starts at minus ₹81,000 and crosses zero at 5.6 years. The
  small dip at year 12 is the inverter replacement. "We count maintenance and the inverter."
- **If you take a loan**: EMI ₹940 vs saving ₹1,240. "Solar pays its own EMI from month one."
- Open any **How we worked this out** to show the full breakdown, then switch to **हिंदी** and
  tap **Listen** (tap again to stop).

**5. Check a vendor quote (60 s).** Tap **Check a vendor quote** → choose
`samples/sample_quote.pdf`. "A Strands agent reads the quote and runs nine checks." Show the
red flags (price 23% above normal, DCR panels not stated, net-meter fee charged extra, 60%
advance) and the questions it suggests asking the vendor.

**6. Architecture (30 s).** Show the diagram in `README.md`: React app → API Gateway → Lambda
→ Bedrock (Nova) + Strands agent; DynamoDB, S3, Polly; deployed with AWS SAM. If you're
still on `local`: "It runs today on Bedrock. The full AWS stack deploys with one command as soon
as our new account finishes verification."

**If something fails during the demo:** stop with Ctrl+C and run `./run.sh mock`. Every bill
then reads as the sample bill, but the whole flow and all the calculations still work.

**Recording a video:** on macOS press **Cmd+Shift+5** → *Record Selected Portion*. For the
phone, use the iPhone's Screen Recording (Control Centre).

---

## Part 4. Deploy to AWS (when `./run.sh check` is all green)

### 4.1 Deploy the backend (10 min)

```bash
./run.sh deploy rushilsingha13@gmail.com
```

It checks the `deploy` profile, runs `sam build`, then `sam deploy`. SAM shows the list of
resources it will create (S3 bucket, DynamoDB tables, HTTP API, two Lambda functions, alarm,
**$10/month budget alert**). Type **y** to confirm. At the end it prints the API address.

Then:

1. **Check your email** and click **Confirm subscription** in the message from AWS
   Notifications, so budget and error alerts reach you.
2. Try the deployed backend with the frontend on your laptop:

```bash
./run.sh cloud
```

Open http://localhost:5173 and run through the demo again. This time everything happens on AWS.

To use Claude instead of Nova later (when AWS approves the Anthropic form):

```bash
./run.sh deploy rushilsingha13@gmail.com ModelId=anthropic.claude-opus-5-5
```

### 4.2 Put the website online with Amplify (15 min)

1. Push the project to GitHub (a private repo is fine; `.gitignore` already keeps bills, quotes
   and keys out).
2. AWS console (new account, region **Mumbai**) → **AWS Amplify** → **Create new app** →
   **GitHub** → pick the repo and branch. If asked about a monorepo, enter `frontend`.
3. **Advanced settings** → **Environment variables** → add `VITE_API_URL` = the API address
   that `./run.sh deploy` printed.
4. **Save and deploy**. After 2–3 minutes you get a link like `https://main.d1abc.amplifyapp.com`.
   That's the link to submit. "Use my location" works there because it's HTTPS.

### 4.3 Lock the API to your website (2 min)

```bash
./run.sh deploy rushilsingha13@gmail.com AllowedOrigin=https://main.d1abc.amplifyapp.com
```

Use your real Amplify link, with no slash at the end. After this, `./run.sh cloud` on your
laptop is blocked by CORS. That's expected: use the Amplify link, or use `./run.sh local`.

### 4.4 Watch it work

```bash
cd backend && sam logs --stack-name solarsaathi -n WorkerFunction --tail --profile deploy
```

### 4.5 After the hackathon

```bash
cd backend && sam delete --stack-name solarsaathi --profile deploy
```

Then delete the Amplify app in the console, and the access keys of both IAM users.

---

## Command cheat sheet

| Task | Command |
| --- | --- |
| First-time setup / replace keys | `./run.sh setup` |
| What works right now? | `./run.sh check` |
| Real app on laptop (college Bedrock) | `./run.sh local` |
| Same, open on your phone | `./run.sh local --phone` |
| Real app on laptop using the new account | `LOCAL_PROFILE=deploy ./run.sh local` |
| No-AWS backup demo | `./run.sh mock` |
| Tests + offline engine demo | `./run.sh test` |
| Read one bill in the terminal | `AWS_PROFILE=college .venv/bin/python backend/scripts/try_bill.py ~/Desktop/bill_folder/bill1.webp` |
| Score the AI on the sample bills | `cd backend && AWS_PROFILE=college ../.venv/bin/python scripts/eval_bills.py ~/Desktop/bill_folder` |
| Deploy backend | `./run.sh deploy you@example.com` |
| Laptop frontend → deployed backend | `./run.sh cloud` |
| Which account is a profile? | `aws sts get-caller-identity --profile college` |

### Without the helper script

In two terminal tabs:

```bash
cd ~/Desktop/solarsaathi && AWS_PROFILE=college .venv/bin/python backend/scripts/local_api.py
```

```bash
cd ~/Desktop/solarsaathi/frontend && VITE_API_URL=http://localhost:8787 npm run dev
```

---

## Troubleshooting

| What you see | What it means / what to do |
| --- | --- |
| `./run.sh: permission denied` | Run `chmod +x run.sh` once |
| `profile 'college' isn't set up` | `./run.sh setup` |
| `keys don't work` / `InvalidClientTokenId` | The key was deleted or mistyped. Create a new access key (1.2) and run `./run.sh setup` |
| `account verification still in progress` / `Operation not allowed` | The new account isn't verified yet. Use `./run.sh local` with `college`; chase AWS Support if it takes over 24 h |
| `daily Bedrock token limit reached` | Wait (it resets within 24 h), or run with the other profile: `LOCAL_PROFILE=deploy ./run.sh local` |
| `blocked by an AWS Organizations policy` | That account can't do this (e.g. the college account can't deploy). Use the other profile |
| "Could not read this file" in the app | The photo is too blurry or cropped; the units table must be visible. The terminal running `./run.sh local` shows the real error |
| `The API didn't start on port 8787` | Something else is using it: `lsof -i :8787`, then quit that program |
| Phone can't open the address | Same Wi-Fi? Try a phone hotspot; allow Python/Node through the macOS firewall |
| "API not configured" message in the app | You started the frontend with plain `npm run dev`; use `./run.sh local` (or set `VITE_API_URL`) |
| `sam: command not found` | See 1.1, then `rehash` |
| `No space left on device` | Free up disk space (System Settings → General → Storage) |

For the full AWS background (plans, model access, costs), see [AWS_SETUP.md](AWS_SETUP.md).

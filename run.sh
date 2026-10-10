#!/usr/bin/env bash
# SolarSaathi helper: set up, run locally, check AWS access, deploy.
# Full guide: docs/RUNNING.md
#
#   ./run.sh setup            install everything and connect your two AWS profiles (once)
#   ./run.sh check            is each AWS profile working? (Bedrock, deploy permissions)
#   ./run.sh local [--phone]  real app on your laptop: real AI on Bedrock, no deploy needed
#   ./run.sh mock             demo app with sample answers, no AWS at all
#   ./run.sh test             run the unit tests and the offline demo
#   ./run.sh deploy EMAIL     deploy the backend to AWS (SAM) with the "deploy" profile
#   ./run.sh cloud [--phone]  run the frontend on your laptop against the deployed backend
#
# Profiles (override with environment variables):
#   LOCAL_PROFILE=college     used by ./run.sh local   (needs only Bedrock)
#   DEPLOY_PROFILE=deploy     used by deploy / cloud   (needs a fully verified account)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOCAL_PROFILE="${LOCAL_PROFILE:-college}"
DEPLOY_PROFILE="${DEPLOY_PROFILE:-deploy}"
REGION="${AWS_REGION:-ap-south-1}"
STACK="solarsaathi"
API_PORT=8787
WEB_PORT=5173
PY="$ROOT/.venv/bin/python"
TEST_MODEL="global.amazon.nova-2-lite-v1:0"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$*"; }
info() { printf "  • %s\n" "$*"; }
die()  { printf "\n\033[31m%s\033[0m\n" "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed. $2"; }

profile_exists() { aws configure list-profiles 2>/dev/null | grep -qx "$1"; }

account_of() { aws sts get-caller-identity --profile "$1" --query Account --output text 2>/dev/null; }

lan_ip() { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1; }

# Explain an AWS error in plain words.
explain() {
  case "$1" in
    *"Operation not allowed"*)        echo "account verification still in progress (wait, or ask AWS Support)";;
    *"Too many tokens per day"*)      echo "daily Bedrock token limit reached (resets within 24 h; raise it in Service Quotas)";;
    *"service control policy"*)       echo "blocked by an AWS Organizations policy on this account";;
    *"verification"*)                 echo "account verification still in progress";;
    *"InvalidClientTokenId"*|*"SignatureDoesNotMatch"*) echo "the access keys are wrong or deleted; run: aws configure --profile $2";;
    *"could not be found"*|*"ProfileNotFound"*)         echo "profile '$2' isn't set up; run: ./run.sh setup";;
    *)                                echo "$(echo "$1" | tr '\n' ' ' | cut -c1-200)";;
  esac
}

# ---------------------------------------------------------------- setup

setup_profile() {
  local name="$1" purpose="$2"
  echo
  bold "AWS profile '$name' ($purpose)"
  if profile_exists "$name" && [ -n "$(account_of "$name")" ]; then
    ok "already set up (account $(account_of "$name"))"
    read -r -p "  Replace its keys? [y/N] " a
    [[ "$a" =~ ^[Yy]$ ]] || return 0
  fi
  if [ "$name" = "$DEPLOY_PROFILE" ] && [ -n "$(account_of default)" ]; then
    read -r -p "  Your current default keys are for account $(account_of default). Copy them into '$name'? [y/N] " a
    if [[ "$a" =~ ^[Yy]$ ]]; then
      aws configure set aws_access_key_id "$(aws configure get aws_access_key_id)" --profile "$name"
      aws configure set aws_secret_access_key "$(aws configure get aws_secret_access_key)" --profile "$name"
      aws configure set region "$REGION" --profile "$name"
      ok "copied (account $(account_of "$name"))"
      return 0
    fi
  fi
  info "Paste this account's IAM access key ID and secret. Region: $REGION. Output: json."
  aws configure --profile "$name"
  [ -n "$(aws configure get region --profile "$name")" ] || aws configure set region "$REGION" --profile "$name"
  local acct; acct="$(account_of "$name")"
  [ -n "$acct" ] && ok "connected to account $acct" || bad "these keys don't work yet; check them and run ./run.sh setup again"
}

cmd_setup() {
  bold "1. Tools"
  need aws "Install: brew install awscli"
  need npm "Install: brew install node"
  ok "aws $(aws --version 2>&1 | cut -d' ' -f1 | cut -d/ -f2), node $(node --version)"
  command -v sam >/dev/null && ok "sam $(sam --version | awk '{print $4}')" || info "sam not found (only needed to deploy; see docs/RUNNING.md)"

  bold "2. Python packages"
  if [ ! -x "$PY" ]; then
    local base; base="$(command -v python3.13 || command -v python3)"
    "$base" -m venv "$ROOT/.venv"
  fi
  "$PY" -m pip install -q -r "$ROOT/backend/src/requirements.txt" pytest
  ok "installed into .venv"

  bold "3. Frontend packages"
  (cd "$ROOT/frontend" && npm install --silent --no-fund --no-audit)
  ok "installed"

  setup_profile "$LOCAL_PROFILE" "for ./run.sh local: the account where Bedrock works today"
  setup_profile "$DEPLOY_PROFILE" "for ./run.sh deploy: your new, verified account"

  echo; bold "Done. Next: ./run.sh check"
}

# ---------------------------------------------------------------- check

check_bedrock() {
  local profile="$1" out
  if out="$(aws bedrock-runtime converse --profile "$profile" --region "$REGION" --model-id "$TEST_MODEL" \
      --messages '[{"role":"user","content":[{"text":"Reply with OK"}]}]' \
      --inference-config maxTokens=5 --query 'output.message.content[0].text' --output text 2>&1)"; then
    ok "Bedrock ($TEST_MODEL) answers"
    return 0
  fi
  bad "Bedrock: $(explain "$out" "$profile")"
  return 1
}

check_deploy_access() {
  local profile="$1" out
  if out="$(aws cloudformation list-stacks --profile "$profile" --region "$REGION" --max-items 1 --output text 2>&1)"; then
    ok "CloudFormation (needed by sam deploy) allowed"
  else
    bad "CloudFormation: $(explain "$out" "$profile")"; return 1
  fi
  if out="$(aws lambda list-functions --profile "$profile" --region "$REGION" --max-items 1 --output text 2>&1)"; then
    ok "Lambda allowed"
  else
    bad "Lambda: $(explain "$out" "$profile")"; return 1
  fi
}

check_profile() {
  local profile="$1" role="$2" acct
  echo; bold "Profile '$profile' ($role)"
  if ! profile_exists "$profile"; then bad "not set up; run ./run.sh setup"; return 1; fi
  acct="$(account_of "$profile")"
  if [ -z "$acct" ]; then bad "keys don't work; run: aws configure --profile $profile"; return 1; fi
  ok "signed in to account $acct, region $(aws configure get region --profile "$profile" || echo "$REGION")"
  local status=0
  check_bedrock "$profile" || status=1
  if [ "$role" = "deploy" ]; then check_deploy_access "$profile" || status=1; fi
  return $status
}

cmd_check() {
  local l=0 d=0
  check_profile "$LOCAL_PROFILE" "local" || l=1
  check_profile "$DEPLOY_PROFILE" "deploy" || d=1
  echo; bold "What you can do now"
  [ $l -eq 0 ] && ok "./run.sh local   (real AI on your laptop)" || bad "./run.sh local   needs profile '$LOCAL_PROFILE' fixed (or: LOCAL_PROFILE=$DEPLOY_PROFILE ./run.sh local)"
  [ $d -eq 0 ] && ok "./run.sh deploy you@example.com" || bad "./run.sh deploy  not yet (see above); use ./run.sh local meanwhile"
  ok "./run.sh mock    (always works, no AWS)"
}

# ---------------------------------------------------------------- run

PIDS=()
cleanup() { for p in ${PIDS[@]+"${PIDS[@]}"}; do kill "$p" 2>/dev/null || true; done; }

wait_for_api() {
  for _ in $(seq 1 40); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/health")" != "000" ] && return 0
    kill -0 "${PIDS[0]}" 2>/dev/null || die "The API stopped while starting (see the message above)."
    sleep 0.5
  done
  die "The API didn't start on port $API_PORT. Is something else using it? Try: lsof -i :$API_PORT"
}

start_frontend() {
  local api_url="$1" phone="$2"
  [ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install --silent --no-fund --no-audit)
  echo
  bold "Open the app:  http://localhost:$WEB_PORT"
  [ "$phone" = 1 ] && bold "On your phone (same Wi-Fi):  http://$(lan_ip):$WEB_PORT"
  echo "  (Ctrl+C stops everything)"
  echo
  local host_flag=()
  [ "$phone" = 1 ] && host_flag=(--host)
  cd "$ROOT/frontend"
  # A VITE_API_URL already in the environment wins over frontend/.env.local.
  VITE_API_URL="$api_url" npx vite --port "$WEB_PORT" --strictPort ${host_flag[@]+"${host_flag[@]}"}
}

cmd_local() {
  local phone=0; [ "${1:-}" = "--phone" ] && phone=1
  [ -x "$PY" ] || die "Run ./run.sh setup first."
  profile_exists "$LOCAL_PROFILE" || die "AWS profile '$LOCAL_PROFILE' isn't set up yet. Run ./run.sh setup (or use ./run.sh mock)."
  [ -n "$(account_of "$LOCAL_PROFILE")" ] || die "The keys in profile '$LOCAL_PROFILE' don't work. Run ./run.sh setup to replace them."
  trap cleanup EXIT INT TERM
  bold "Starting the real backend locally (profile '$LOCAL_PROFILE')"
  local args=(); local host=localhost
  if [ $phone = 1 ]; then host="$(lan_ip)"; args=(--phone --host-ip "$host"); fi
  AWS_PROFILE="$LOCAL_PROFILE" AWS_REGION="$REGION" "$PY" "$ROOT/backend/scripts/local_api.py" --port "$API_PORT" ${args[@]+"${args[@]}"} &
  PIDS+=($!)
  wait_for_api
  start_frontend "http://$host:$API_PORT" "$phone"
}

cmd_mock() {
  [ -x "$PY" ] || die "Run ./run.sh setup first."
  trap cleanup EXIT INT TERM
  bold "Starting the mock backend (sample answers, no AWS)"
  "$PY" "$ROOT/backend/scripts/mock_api.py" &
  PIDS+=($!)
  wait_for_api
  start_frontend "http://localhost:$API_PORT" 0
}

cmd_test() {
  [ -x "$PY" ] || die "Run ./run.sh setup first."
  (cd "$ROOT/backend" && "$PY" -m pytest -q)
  (cd "$ROOT/backend" && "$PY" scripts/demo_offline.py)
}

# ---------------------------------------------------------------- deploy

api_url() {
  aws cloudformation describe-stacks --stack-name "$STACK" --profile "$DEPLOY_PROFILE" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>/dev/null
}

cmd_deploy() {
  local email="${1:-}"; shift || true
  [ -n "$email" ] || die "Usage: ./run.sh deploy you@example.com   (where budget and error alerts go)"
  need sam "See docs/RUNNING.md, 'Install SAM'."
  check_profile "$DEPLOY_PROFILE" "deploy" || die "Profile '$DEPLOY_PROFILE' can't deploy yet (see above)."
  echo; bold "Building (sam build)"
  (cd "$ROOT/backend" && sam build)
  echo; bold "Deploying to account $(account_of "$DEPLOY_PROFILE") in $REGION (sam deploy)"
  info "Review the change set, then type y."
  (cd "$ROOT/backend" && sam deploy --profile "$DEPLOY_PROFILE" --region "$REGION" \
     --parameter-overrides "AlertEmail=$email${*:+ $*}")
  local url; url="$(api_url)"
  echo; bold "Deployed. API: $url"
  info "Confirm the SNS email AWS just sent to $email, or alerts won't reach you."
  info "Try it:        ./run.sh cloud"
  info "Host the site: docs/RUNNING.md, part 6 (Amplify), with VITE_API_URL=$url"
}

cmd_cloud() {
  local phone=0; [ "${1:-}" = "--phone" ] && phone=1
  local url; url="$(api_url)"
  [ -n "$url" ] && [ "$url" != "None" ] || die "No deployed stack found for profile '$DEPLOY_PROFILE'. Run ./run.sh deploy first."
  bold "Frontend on your laptop, backend on AWS: $url"
  start_frontend "$url" "$phone"
}

# ---------------------------------------------------------------- main

case "${1:-}" in
  setup)  cmd_setup ;;
  check)  cmd_check ;;
  local)  shift; cmd_local "$@" ;;
  mock)   cmd_mock ;;
  test)   cmd_test ;;
  deploy) shift; cmd_deploy "$@" ;;
  cloud)  shift; cmd_cloud "$@" ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

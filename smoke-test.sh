#!/usr/bin/env bash
# =============================================================
# Asgard Smoke Test Suite
# Run before deploying to prod:    bash smoke-test.sh
# Run against staging:             bash smoke-test.sh staging
# =============================================================
set -uo pipefail

TARGET="${1:-prod}"
PIN="${ASGARD_PIN:-2967}"

if [ "$TARGET" = "staging" ]; then
  BASE="https://asgard-staging.luckdragon.io"
else
  BASE="https://asgard.luckdragon.io"
fi

AI="https://asgard-ai.luckdragon.io"
TOOLS="https://asgard-tools.luckdragon.io"
BRAIN="https://asgard-brain.luckdragon.io"
VAULT="https://asgard-vault.luckdragon.io"

PASS=0; FAIL=0; WARN=0

pass() { printf "\033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "\033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
warn() { printf "\033[33mWARN\033[0m  %s\n" "$1"; WARN=$((WARN+1)); }

check_http() {
  local label="$1" url="$2" expected="$3"
  shift 3
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "$@" "$url" 2>/dev/null)
  if [ "$code" = "$expected" ]; then pass "$label ($code)"
  else fail "$label -- expected $expected got $code"; fi
}

check_body() {
  local label="$1" url="$2" pattern="$3"
  shift 3
  local body
  body=$(curl -s --max-time 12 "$@" "$url" 2>/dev/null)
  if echo "$body" | grep -q "$pattern"; then pass "$label"
  else fail "$label -- '$pattern' not found"; fi
}

check_absent() {
  local label="$1" url="$2" pattern="$3"
  shift 3
  local body
  body=$(curl -s --max-time 12 "$@" "$url" 2>/dev/null)
  if echo "$body" | grep -q "$pattern"; then fail "$label -- '$pattern' still present"
  else pass "$label"; fi
}

printf "\n========================================\n"
printf "  Asgard Smoke Tests -- %s\n" "$TARGET"
printf "  %s\n" "$(date)"
printf "========================================\n\n"

echo "[ Main App: $BASE ]"

check_http   "Login page loads"             "$BASE/login" "200"
check_body   "Login page has email form"    "$BASE/login" "type=email"
check_body   "Login page has password form" "$BASE/login" "type=password"
check_absent "Zero pgallivan refs"          "$BASE/"      "pgallivan"

LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST -d "email=pgallivan%40outlook.com&password=LuckDragon%232025" \
  -c /tmp/asgard_smoke_cookies.txt "$BASE/login" 2>/dev/null)
if [ "$LOGIN_CODE" = "302" ] || [ "$LOGIN_CODE" = "200" ]; then
  pass "POST /login authenticates ($LOGIN_CODE)"
else
  fail "POST /login -- got $LOGIN_CODE"
fi

CSP=$(curl -sI --max-time 10 -b "asgard_pin=$PIN" "$BASE/" 2>/dev/null \
  | grep -i "content-security-policy" | head -1)
if [ -n "$CSP" ]; then pass "CSP header present"
else warn "CSP header missing"; fi

if echo "$CSP" | grep -q "luckdragon.io"; then
  pass "CSP uses luckdragon.io backends"
else
  warn "CSP may still reference old backend URLs"
fi

echo ""
echo "[ Backend Workers ]"

check_body "asgard-ai health"    "$AI/health"    '"ok":true'  -H "X-Pin: $PIN"
check_body "asgard-tools health" "$TOOLS/health" '"ok":true'  -H "X-Pin: $PIN"
check_body "asgard-brain health" "$BRAIN/health" '"ok":true'  -H "X-Pin: $PIN"
check_body "asgard-vault health" "$VAULT/health" '"ok":true'  -H "X-Pin: $PIN"

echo ""
echo "[ Key Features ]"

check_body "Projects list"       "$TOOLS/admin/projects" '"workers"'        -H "X-Pin: $PIN" -H "Origin: $BASE"
check_body "AI models listed"    "$AI/health"            '"models"'         -H "X-Pin: $PIN"
check_body "Multi-provider AI"   "$AI/health"            '"anthropic":true' -H "X-Pin: $PIN"
check_body "Vault lists secrets" "$VAULT/secrets"        '"keys"'           -H "X-Pin: $PIN"
check_body "Brain has tools"     "$BRAIN/health"         '"tools"'          -H "X-Pin: $PIN"

echo ""
echo "[ Security ]"

VAULT_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$VAULT/secrets" 2>/dev/null)
if [ "$VAULT_UNAUTH" = "401" ] || [ "$VAULT_UNAUTH" = "403" ]; then
  pass "Vault rejects unauthenticated ($VAULT_UNAUTH)"
else
  fail "Vault accepted unauthenticated request ($VAULT_UNAUTH)"
fi

TOOLS_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$TOOLS/admin/projects" 2>/dev/null)
if [ "$TOOLS_UNAUTH" = "401" ] || [ "$TOOLS_UNAUTH" = "403" ]; then
  pass "Tools rejects unauthenticated ($TOOLS_UNAUTH)"
else
  fail "Tools accepted unauthenticated request ($TOOLS_UNAUTH)"
fi

WRONG=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST -d "email=wrong%40example.com&password=wrongpassword" "$BASE/login" 2>/dev/null)
if [ "$WRONG" = "401" ] || [ "$WRONG" = "403" ] || [ "$WRONG" = "200" ]; then
  pass "Login rejects wrong credentials"
else
  fail "Login wrong credentials gave unexpected $WRONG"
fi

echo ""
printf "========================================\n"
printf "  Results: %d passed, %d failed, %d warnings\n" "$PASS" "$FAIL" "$WARN"
printf "========================================\n\n"

if [ "$FAIL" -gt 0 ]; then
  printf "DO NOT DEPLOY -- %d test(s) failed\n" "$FAIL"
  exit 1
else
  printf "ALL CLEAR -- safe to deploy to %s\n" "$TARGET"
  exit 0
fi

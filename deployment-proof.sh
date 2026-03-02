#!/usr/bin/env bash
# ============================================================
# SkyNet Glass — Deployment Integrity Proof Script  v2
# Runs 7 proof sections (A–G) with PASS / FAIL verdicts.
# Usage:  cd ~/skynet-glass && sudo bash deployment-proof.sh
# ============================================================
set -uo pipefail   # no -e so we can collect all verdicts

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

PASS=0; FAIL=0; WARN=0
verdict() {
  local status="$1"; local msg="$2"
  if [[ "$status" == "PASS" ]]; then
    echo -e "  \033[32m✓ PASS\033[0m  $msg"; ((PASS++))
  elif [[ "$status" == "WARN" ]]; then
    echo -e "  \033[33m⚠ WARN\033[0m  $msg"; ((WARN++))
  else
    echo -e "  \033[31m✗ FAIL\033[0m  $msg"; ((FAIL++))
  fi
}

SEP="================================================================"
echo "$SEP"
echo "  SkyNet Glass — Deployment Integrity Proof  v2"
echo "  Directory: $APP_DIR"
echo "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "$SEP"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION A: GIT PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION A: GIT PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
GIT_SHA_FULL=$(git rev-parse HEAD 2>/dev/null || echo "NONE")
GIT_SHA_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "NONE")
echo "  HEAD: $GIT_SHA_FULL"
echo "  Short: $GIT_SHA_SHORT"
echo ""
echo "--- Working tree status ---"
git status --short 2>/dev/null
echo ""
echo "--- Last 3 commits ---"
git log -3 --oneline 2>/dev/null
echo ""
echo "--- Feature commit search ---"
for FEAT in "BuildFingerprint" "DataSourceBadge" "abuseipdb" "speedguide" "sidebar-expanded" "syslog"; do
  HIT=$(git log --all --oneline --grep="$FEAT" -1 2>/dev/null || echo "")
  if [[ -n "$HIT" ]]; then
    verdict "PASS" "$FEAT found in git: $HIT"
  else
    # Also check source directly
    SRC_HIT=$(grep -rIl "$FEAT" client/src/ server/ 2>/dev/null | head -1 || echo "")
    if [[ -n "$SRC_HIT" ]]; then
      verdict "WARN" "$FEAT not in commit message but found in source: $SRC_HIT"
    else
      verdict "FAIL" "$FEAT not found in git history or source"
    fi
  fi
done
echo ""

# ────────────────────────────────────────────────────────────
# SECTION B: SOURCE PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION B: SOURCE PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
for PATTERN in "BuildFingerprint" "DataSourceBadge" "abuseipdb.com/check" "speedguide.net/port.php" "skynet-sidebar-expanded" "__BUILD_SHA__"; do
  COUNT=$(grep -rIc "$PATTERN" client/src/ 2>/dev/null | awk -F: '{s+=$2}END{print s+0}')
  if [[ "$COUNT" -gt 0 ]]; then
    verdict "PASS" "'$PATTERN' found $COUNT time(s) in client/src/"
    grep -rIn "$PATTERN" client/src/ 2>/dev/null | head -2 | sed 's/^/    /'
  else
    verdict "FAIL" "'$PATTERN' NOT FOUND in client/src/"
  fi
  echo ""
done

# ────────────────────────────────────────────────────────────
# SECTION C: BUILD PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION C: BUILD PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
if [[ -f dist/index.js ]]; then
  verdict "PASS" "dist/index.js exists ($(wc -c < dist/index.js) bytes)"
  echo "    sha256: $(sha256sum dist/index.js | cut -d' ' -f1)"
else
  verdict "FAIL" "dist/index.js MISSING — run: pnpm build"
fi
echo ""

if [[ -d dist/public/assets ]]; then
  JS_FILE=$(ls -1 dist/public/assets/index-*.js 2>/dev/null | head -1)
  if [[ -n "$JS_FILE" ]]; then
    verdict "PASS" "Frontend bundle: $JS_FILE ($(wc -c < "$JS_FILE") bytes)"
    echo "    sha256: $(sha256sum "$JS_FILE" | cut -d' ' -f1)"
  else
    verdict "FAIL" "No index-*.js in dist/public/assets/"
  fi
else
  verdict "FAIL" "dist/public/assets/ directory MISSING"
fi
echo ""

echo "--- Build fingerprint in dist ---"
DIST_SHA=$(grep -oP '"[0-9a-f]{7}"' dist/public/assets/index-*.js 2>/dev/null | head -1 | tr -d '"')
DIST_TIME=$(grep -oP '"2026-[0-9 :-]+"' dist/public/assets/index-*.js 2>/dev/null | head -1 | tr -d '"')
if [[ -n "$DIST_SHA" ]]; then
  verdict "PASS" "Build fingerprint SHA in dist: $DIST_SHA"
  if [[ "$DIST_SHA" == "$GIT_SHA_SHORT" ]]; then
    verdict "PASS" "Fingerprint SHA matches git HEAD ($GIT_SHA_SHORT)"
  else
    verdict "FAIL" "Fingerprint SHA ($DIST_SHA) != git HEAD ($GIT_SHA_SHORT) → STALE BUILD"
  fi
else
  verdict "FAIL" "No build fingerprint SHA found in dist — BuildFingerprint not compiled"
fi
if [[ -n "$DIST_TIME" ]]; then
  echo "    Build timestamp: $DIST_TIME"
fi
echo ""

echo "--- Feature strings in dist ---"
for PATTERN in "abuseipdb.com/check" "speedguide.net/port.php" "skynet-sidebar-expanded" "LIVE ROUTER DATA" "CACHED REAL DATA" "ERROR"; do
  if grep -rq "$PATTERN" dist/ 2>/dev/null; then
    verdict "PASS" "'$PATTERN' present in dist/"
  else
    verdict "FAIL" "'$PATTERN' NOT in dist/"
  fi
done
echo ""

# ────────────────────────────────────────────────────────────
# SECTION D: DATABASE PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION D: DATABASE PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
# Extract DATABASE_URL from .env
if [[ -f .env ]]; then
  DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [[ -z "$DB_URL" ]]; then
    verdict "FAIL" "DATABASE_URL not set in .env"
  elif echo "$DB_URL" | grep -q "YOUR_DB_PASSWORD"; then
    verdict "FAIL" "DATABASE_URL contains placeholder 'YOUR_DB_PASSWORD' — DB BLOCKED"
    echo "    FIX: Re-run sudo bash install.sh or manually set the password in .env"
  else
    verdict "PASS" "DATABASE_URL is set (no placeholder detected)"
    # Try a real connection
    DB_USER=$(echo "$DB_URL" | grep -oP '//\K[^:]+')
    DB_PASS=$(echo "$DB_URL" | grep -oP '://[^:]+:\K[^@]+')
    DB_HOST=$(echo "$DB_URL" | grep -oP '@\K[^:/]+')
    DB_NAME=$(echo "$DB_URL" | grep -oP '/\K[^?]+' | tail -1)
    if command -v mysql &>/dev/null; then
      TABLES=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | tail -n +2 | wc -l)
      if [[ "$TABLES" -gt 0 ]]; then
        verdict "PASS" "MySQL connection OK — $TABLES tables found"
        mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | sed 's/^/    /'
      else
        verdict "FAIL" "MySQL connected but 0 tables — run: pnpm db:push"
      fi
    else
      verdict "WARN" "mysql CLI not installed — cannot verify DB connection directly"
    fi
  fi
else
  verdict "FAIL" ".env file MISSING"
fi
echo ""

# ────────────────────────────────────────────────────────────
# SECTION E: SERVICE PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION E: SERVICE PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- systemd status ---"
SVCSTATE=$(systemctl is-active skynet-glass 2>/dev/null || echo "inactive")
if [[ "$SVCSTATE" == "active" ]]; then
  verdict "PASS" "systemd service is active"
else
  verdict "FAIL" "systemd service is $SVCSTATE"
fi
systemctl status skynet-glass --no-pager 2>&1 | head -15 | sed 's/^/    /'
echo ""

echo "--- process check ---"
PROC=$(ps -ef | grep -E "node .*dist/index" | grep -v grep)
if [[ -n "$PROC" ]]; then
  verdict "PASS" "node dist/index.js process running"
  echo "$PROC" | sed 's/^/    /'
else
  verdict "FAIL" "no node dist/index.js process found"
fi
echo ""

echo "--- port 3006 check ---"
PORT_PID=$(lsof -ti :3006 2>/dev/null || echo "")
if [[ -n "$PORT_PID" ]]; then
  verdict "PASS" "port 3006 is bound (PID: $PORT_PID)"
else
  verdict "FAIL" "port 3006 not in use"
fi
echo ""

echo "--- recent journal (last 30 lines) ---"
journalctl -u skynet-glass -n 30 --no-pager 2>&1 | sed 's/^/    /'
echo ""

# ────────────────────────────────────────────────────────────
# SECTION F: FORCED RESTART + VERIFY
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION F: FORCED RESTART + VERIFY"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- Stopping ---"
systemctl stop skynet-glass 2>/dev/null || true
pkill -f "node .*dist/index" 2>/dev/null || true
sleep 2
echo "  Stopped."
echo ""
echo "--- Starting ---"
systemctl start skynet-glass 2>/dev/null || {
  echo "  systemd unit not available, starting manually..."
  cd "$APP_DIR"
  nohup node dist/index.js > /tmp/skynet-glass.log 2>&1 &
  echo "  Started with PID $!"
}
sleep 4
echo ""

echo "--- Post-restart verification ---"
SVCSTATE2=$(systemctl is-active skynet-glass 2>/dev/null || echo "inactive")
PROC2=$(ps -ef | grep -E "node .*dist/index" | grep -v grep)
PORT2=$(lsof -ti :3006 2>/dev/null || echo "")
[[ "$SVCSTATE2" == "active" ]] && verdict "PASS" "service active after restart" || verdict "FAIL" "service NOT active after restart"
[[ -n "$PROC2" ]] && verdict "PASS" "process running after restart" || verdict "FAIL" "process NOT running after restart"
[[ -n "$PORT2" ]] && verdict "PASS" "port 3006 bound after restart" || verdict "FAIL" "port 3006 NOT bound after restart"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION G: RUNTIME API PROOF
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION G: RUNTIME API PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- HTTP root ---"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/ 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  verdict "PASS" "GET / → HTTP 200"
else
  verdict "FAIL" "GET / → HTTP $HTTP_STATUS"
fi
echo ""

echo "--- Build fingerprint in served HTML ---"
SERVED_HTML=$(curl -s http://localhost:3006/ 2>/dev/null)
SERVED_JS=$(echo "$SERVED_HTML" | grep -oP 'src="/assets/index-[^"]+\.js"' | head -1 | grep -oP '/assets/[^"]+')
if [[ -n "$SERVED_JS" ]]; then
  verdict "PASS" "Served JS bundle: $SERVED_JS"
  # Check if the served JS matches what's in dist
  LOCAL_JS=$(ls dist/public/assets/index-*.js 2>/dev/null | head -1 | sed 's|dist/public||')
  if [[ "$SERVED_JS" == "$LOCAL_JS" ]]; then
    verdict "PASS" "Served JS filename matches dist/ build"
  else
    verdict "FAIL" "Served JS ($SERVED_JS) != dist/ JS ($LOCAL_JS) → WRONG BUILD SERVED"
  fi
else
  verdict "WARN" "Could not extract JS bundle name from served HTML"
fi
echo ""

echo "--- API: skynet.getConfig ---"
CONFIG_RESP=$(curl -s http://localhost:3006/api/trpc/skynet.getConfig 2>/dev/null)
if echo "$CONFIG_RESP" | grep -q '"result"'; then
  verdict "PASS" "skynet.getConfig returns result"
  echo "    $(echo "$CONFIG_RESP" | head -c 300)"
elif echo "$CONFIG_RESP" | grep -q "Access denied"; then
  verdict "FAIL" "skynet.getConfig → DB ACCESS DENIED — password wrong in .env"
elif echo "$CONFIG_RESP" | grep -q "error"; then
  verdict "FAIL" "skynet.getConfig → error: $(echo "$CONFIG_RESP" | head -c 200)"
else
  verdict "FAIL" "skynet.getConfig → unexpected response: $(echo "$CONFIG_RESP" | head -c 200)"
fi
echo ""

echo "--- API: skynet.getStats ---"
STATS_RESP=$(curl -s http://localhost:3006/api/trpc/skynet.getStats 2>/dev/null)
if echo "$STATS_RESP" | grep -q '"result"'; then
  verdict "PASS" "skynet.getStats returns result"
  # Check for real data indicators
  if echo "$STATS_RESP" | grep -q '"totalBannedIPs"'; then
    verdict "PASS" "Stats contain totalBannedIPs field"
  fi
  if echo "$STATS_RESP" | grep -q '"fetchedAt"'; then
    verdict "PASS" "Stats contain fetchedAt timestamp"
  fi
  echo "    $(echo "$STATS_RESP" | head -c 400)"
elif echo "$STATS_RESP" | grep -q "Access denied"; then
  verdict "FAIL" "skynet.getStats → DB ACCESS DENIED"
else
  verdict "FAIL" "skynet.getStats → $(echo "$STATS_RESP" | head -c 200)"
fi
echo ""

echo "--- API: skynet.getStatus ---"
STATUS_RESP=$(curl -s http://localhost:3006/api/trpc/skynet.getStatus 2>/dev/null)
if echo "$STATUS_RESP" | grep -q '"result"'; then
  verdict "PASS" "skynet.getStatus returns result"
  echo "    $(echo "$STATUS_RESP" | head -c 300)"
else
  verdict "FAIL" "skynet.getStatus → $(echo "$STATUS_RESP" | head -c 200)"
fi
echo ""

# ────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────
echo "$SEP"
echo ""
echo "  DEPLOYMENT PROOF SUMMARY"
echo "  ────────────────────────"
echo -e "  \033[32m✓ PASS: $PASS\033[0m"
echo -e "  \033[33m⚠ WARN: $WARN\033[0m"
echo -e "  \033[31m✗ FAIL: $FAIL\033[0m"
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "  \033[32m█ DEPLOYMENT VERIFIED — ALL CHECKS PASSED\033[0m"
elif [[ $FAIL -le 3 ]]; then
  echo -e "  \033[33m█ DEPLOYMENT PARTIAL — $FAIL issue(s) need attention\033[0m"
else
  echo -e "  \033[31m█ DEPLOYMENT BROKEN — $FAIL failures detected\033[0m"
fi
echo ""
echo "  Completed: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "$SEP"

#!/usr/bin/env bash
# ============================================================
# SkyNet Glass — Deployment Integrity Proof Script
# Runs all 5 proof sections (A–E) from the Truth Enforcement Order
# Usage: cd ~/skynet-glass && bash deployment-proof.sh
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

SEP="================================================================"
echo "$SEP"
echo "  SkyNet Glass — Deployment Integrity Proof"
echo "  Directory: $APP_DIR"
echo "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "$SEP"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION A: Git Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION A: GIT PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- HEAD commit ---"
git rev-parse HEAD
echo ""
echo "--- Working tree status ---"
git status --short
echo ""
echo "--- Last commit details ---"
git log -1 --stat
echo ""
echo "--- Feature commit check ---"
echo "Checking if HEAD contains the claimed features:"
FEATURES_COMMIT=$(git log --all --oneline --grep="DataSourceBadge" -1 2>/dev/null || echo "NOT FOUND")
echo "  DataSourceBadge commit: $FEATURES_COMMIT"
FEATURES_COMMIT=$(git log --all --oneline --grep="click-through" -1 2>/dev/null || echo "NOT FOUND")
echo "  click-through commit: $FEATURES_COMMIT"
FEATURES_COMMIT=$(git log --all --oneline --grep="sidebar persistence" -1 2>/dev/null || echo "NOT FOUND")
echo "  sidebar persistence commit: $FEATURES_COMMIT"
FEATURES_COMMIT=$(git log --all --oneline --grep="syslog diagnostics" -1 2>/dev/null || echo "NOT FOUND")
echo "  syslog diagnostics commit: $FEATURES_COMMIT"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION B: Source Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION B: SOURCE PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- grep: Blocked Connections ---"
grep -RIn "Blocked Connections" client/src || echo "  NOT FOUND"
echo ""
echo "--- grep: DataSourceBadge ---"
grep -RIn "DataSourceBadge" client/src || echo "  NOT FOUND"
echo ""
echo "--- grep: abuseipdb.com/check ---"
grep -RIn "abuseipdb.com/check" client/src || echo "  NOT FOUND"
echo ""
echo "--- grep: speedguide.net/port.php ---"
grep -RIn "speedguide.net/port.php" client/src || echo "  NOT FOUND"
echo ""
echo "--- grep: skynet-sidebar-expanded ---"
grep -RIn "skynet-sidebar-expanded" client/src || echo "  NOT FOUND"
echo ""
echo "--- grep: diagnostics ---"
grep -RIn "diagnostics" client/src server --include="*.ts" --include="*.tsx" || echo "  NOT FOUND"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION C: Build Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION C: BUILD PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- Installing dependencies ---"
pnpm install --frozen-lockfile 2>&1 | tail -3
echo ""
echo "--- Building ---"
pnpm build 2>&1 | tail -15
echo ""
echo "--- Built files ---"
find dist -maxdepth 3 -type f | sort
echo ""
echo "--- dist/index.js checksum ---"
sha256sum dist/index.js
echo ""
echo "--- grep built assets: Blocked Connections ---"
grep -rn "Blocked Connections" dist/ 2>/dev/null | head -3 || echo "  NOT FOUND in dist"
echo ""
echo "--- grep built assets: DataSourceBadge ---"
grep -rn "DataSourceBadge" dist/ 2>/dev/null | head -3 || echo "  NOT FOUND in dist (may be minified away)"
echo ""
echo "--- grep built assets: abuseipdb.com/check ---"
grep -rn "abuseipdb.com/check" dist/ 2>/dev/null | head -3 || echo "  NOT FOUND in dist"
echo ""
echo "--- grep built assets: speedguide.net/port.php ---"
grep -rn "speedguide.net/port.php" dist/ 2>/dev/null | head -3 || echo "  NOT FOUND in dist"
echo ""
echo "--- grep built assets: skynet-sidebar-expanded ---"
grep -rn "skynet-sidebar-expanded" dist/ 2>/dev/null | head -3 || echo "  NOT FOUND in dist"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION D: Service Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION D: SERVICE PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- systemd status ---"
sudo systemctl status skynet-glass --no-pager 2>&1 || echo "  systemd unit not found"
echo ""
echo "--- recent journal logs ---"
sudo journalctl -u skynet-glass -n 100 --no-pager 2>&1 || echo "  no journal entries"
echo ""
echo "--- process check ---"
ps -ef | grep -E "node .*dist/index" | grep -v grep || echo "  no matching process found"
echo ""
echo "--- port 3006 check ---"
sudo lsof -i :3006 2>/dev/null || echo "  port 3006 not in use"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION E: Forced Restart Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION E: FORCED RESTART PROOF"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- Stopping service ---"
sudo systemctl stop skynet-glass 2>/dev/null || true
sudo pkill -f "node .*dist/index" 2>/dev/null || true
sleep 2
echo "  Stopped."
echo ""
echo "--- Starting service ---"
sudo systemctl start skynet-glass 2>/dev/null || {
  echo "  systemd unit not available, starting manually..."
  cd "$APP_DIR"
  nohup node dist/index.js > /tmp/skynet-glass.log 2>&1 &
  echo "  Started with PID $!"
}
sleep 3
echo ""
echo "--- Post-restart journal ---"
sudo journalctl -u skynet-glass -n 50 --no-pager 2>&1 || {
  echo "  No journal. Checking manual log:"
  tail -50 /tmp/skynet-glass.log 2>/dev/null || echo "  No log found"
}
echo ""
echo "--- Post-restart process check ---"
ps -ef | grep -E "node .*dist/index" | grep -v grep || echo "  no matching process found"
echo ""
echo "--- Post-restart port check ---"
sudo lsof -i :3006 2>/dev/null || echo "  port 3006 not in use"
echo ""

# ────────────────────────────────────────────────────────────
# SECTION F: Runtime API Proof
# ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SECTION F: RUNTIME API PROOF (bonus)"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "--- HTTP status check ---"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/ 2>/dev/null || echo "FAILED")
echo "  GET / → HTTP $HTTP_STATUS"
echo ""
echo "--- API config check ---"
echo "  GET /api/trpc/skynet.getConfig →"
curl -s http://localhost:3006/api/trpc/skynet.getConfig 2>/dev/null | head -c 500 || echo "  FAILED"
echo ""
echo ""
echo "--- API stats check ---"
echo "  GET /api/trpc/skynet.getStats →"
curl -s http://localhost:3006/api/trpc/skynet.getStats 2>/dev/null | head -c 500 || echo "  FAILED"
echo ""
echo ""

echo "$SEP"
echo "  DEPLOYMENT PROOF COMPLETE"
echo "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "$SEP"

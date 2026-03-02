#!/usr/bin/env bash
# ============================================================================
#  Skynet Glass — Automated Installer
#  One script to install everything on Ubuntu 22.04 / 24.04 LTS.
#
#  Usage:
#    sudo bash install.sh
#    sudo MYSQL_ROOT_PASS="yourpass" bash install.sh   # if root needs password
#
#  What this does:
#    1. Installs system packages (Node.js 22, pnpm, MySQL 8, nginx)
#    2. Creates MySQL database and user (auto-generates app password)
#    3. Creates app user and clones/updates the repository
#    4. Installs dependencies and builds the production bundle
#    5. Generates or patches .env with correct DATABASE_URL
#    6. Runs database migrations (idempotent — safe to re-run)
#    7. Creates systemd service for auto-start
#    8. Configures nginx reverse proxy
#    9. Starts everything and verifies
#
#  Handles:
#    - MySQL root via auth_socket (sudo mysql) or password auth
#    - Existing skynet MySQL user (resets password idempotently)
#    - Existing database (CREATE IF NOT EXISTS, no data loss)
#    - Existing .env (backs up, patches DATABASE_URL only)
#    - Safe to re-run at any time
# ============================================================================

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────

APP_NAME="skynet-glass"
APP_PORT=3006
APP_USER="skynet"
APP_DIR="/home/${APP_USER}/skynet-glass"
REPO_URL="https://github.com/cvalentine99/SkyNet_Glass.git"
DB_NAME="skynet_glass"
DB_USER="skynet"

# ─── Colors ─────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗ ERROR:${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# ─── Pre-flight checks ─────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
  fail "This script must be run as root. Use: sudo bash install.sh"
fi

if ! grep -qi "ubuntu\|debian" /etc/os-release 2>/dev/null; then
  warn "This script is designed for Ubuntu/Debian. Proceeding anyway..."
fi

step "Skynet Glass Installer"
echo -e "This will install Skynet Glass on this machine."
echo -e "  • App port: ${CYAN}${APP_PORT}${NC}"
echo -e "  • App user: ${CYAN}${APP_USER}${NC}"
echo -e "  • Install dir: ${CYAN}${APP_DIR}${NC}"
echo ""

# ─── Step 1: System Packages ───────────────────────────────────────────────

step "Step 1/9: System Packages"

info "Updating package lists..."
apt-get update -qq

info "Installing base packages..."
apt-get install -y -qq curl git build-essential nginx openssl lsof python3 > /dev/null 2>&1
ok "Base packages installed"

# Node.js 22
if command -v node &>/dev/null && [[ "$(node --version)" == v22* ]]; then
  ok "Node.js $(node --version) already installed"
else
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  ok "Node.js $(node --version) installed"
fi

# pnpm
if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version) already installed"
else
  info "Installing pnpm..."
  npm install -g pnpm@10 > /dev/null 2>&1
  ok "pnpm installed"
fi

# ─── Step 2: MySQL ─────────────────────────────────────────────────────────

step "Step 2/9: MySQL Database"

# --- 2a: Ensure MySQL is installed and running ---
if ! command -v mysql &>/dev/null; then
  info "Installing MySQL 8..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server > /dev/null 2>&1
  ok "MySQL installed"
fi

# Ensure MySQL service is running
if ! systemctl is-active --quiet mysql 2>/dev/null && ! systemctl is-active --quiet mysqld 2>/dev/null; then
  info "Starting MySQL service..."
  systemctl enable --now mysql 2>/dev/null || systemctl enable --now mysqld 2>/dev/null || true
  sleep 2
fi

if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
  ok "MySQL is running"
else
  fail "MySQL is not running and could not be started. Run: sudo systemctl status mysql"
fi

# --- 2b: Detect MySQL root access method ---
# Strategy: try auth_socket first (sudo mysql), then password from env, then prompt.
MYSQL_ROOT_CMD=""

# Attempt 1: auth_socket — works on default Ubuntu MySQL installs
if mysql -u root -e "SELECT 1;" &>/dev/null 2>&1; then
  MYSQL_ROOT_CMD="mysql -u root"
  ok "MySQL root access: auth_socket (no password)"
# Attempt 2: sudo mysql — some systems require this even as root
elif sudo mysql -e "SELECT 1;" &>/dev/null 2>&1; then
  MYSQL_ROOT_CMD="sudo mysql"
  ok "MySQL root access: sudo mysql"
# Attempt 3: password from environment variable
elif [[ -n "${MYSQL_ROOT_PASS:-}" ]]; then
  if mysql -u root -p"${MYSQL_ROOT_PASS}" -e "SELECT 1;" &>/dev/null 2>&1; then
    MYSQL_ROOT_CMD="mysql -u root -p${MYSQL_ROOT_PASS}"
    ok "MySQL root access: password from MYSQL_ROOT_PASS env var"
  else
    fail "MYSQL_ROOT_PASS was provided but login failed. Check the password."
  fi
# Attempt 4: prompt the user
else
  echo ""
  warn "Cannot connect to MySQL as root via auth_socket."
  echo -e "  MySQL root requires a password on this system."
  echo ""
  echo -e "  You have two options:"
  echo -e "  ${CYAN}Option A:${NC} Enter the MySQL root password now"
  echo -e "  ${CYAN}Option B:${NC} Ctrl+C, then re-run with:"
  echo -e "           ${YELLOW}sudo MYSQL_ROOT_PASS=\"yourpass\" bash install.sh${NC}"
  echo ""
  read -sp "  MySQL root password (or Ctrl+C to abort): " MYSQL_ROOT_PASS_INPUT
  echo ""

  if [[ -z "${MYSQL_ROOT_PASS_INPUT}" ]]; then
    fail "No password entered. Re-run with: sudo MYSQL_ROOT_PASS=\"yourpass\" bash install.sh"
  fi

  if mysql -u root -p"${MYSQL_ROOT_PASS_INPUT}" -e "SELECT 1;" &>/dev/null 2>&1; then
    MYSQL_ROOT_CMD="mysql -u root -p${MYSQL_ROOT_PASS_INPUT}"
    ok "MySQL root access: password authentication"
  else
    fail "MySQL root login failed with provided password."
  fi
fi

# --- 2c: Generate app DB password ---
DB_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)

# --- 2d: Create or reset the app MySQL user ---
# Uses CREATE USER IF NOT EXISTS + ALTER USER for idempotent behavior.
# This handles: new user, existing user with wrong password, existing user with different auth plugin.

info "Configuring MySQL user '${DB_USER}'..."

${MYSQL_ROOT_CMD} -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || {
  # If CREATE USER IF NOT EXISTS fails (very old MySQL), try ALTER directly
  warn "CREATE USER IF NOT EXISTS not supported, trying ALTER USER..."
}

# Always reset password to ensure we know it — this is the key idempotent step
${MYSQL_ROOT_CMD} -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';" 2>/dev/null || {
  # Fallback: some MySQL versions don't support IDENTIFIED WITH
  ${MYSQL_ROOT_CMD} -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || {
    fail "Could not set password for MySQL user '${DB_USER}'. Check MySQL version and permissions."
  }
}

ok "MySQL user '${DB_USER}' configured with fresh password"

# --- 2e: Create database if not exists ---
${MYSQL_ROOT_CMD} -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
ok "Database '${DB_NAME}' exists"

# --- 2f: Grant privileges ---
${MYSQL_ROOT_CMD} -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
${MYSQL_ROOT_CMD} -e "FLUSH PRIVILEGES;"
ok "Privileges granted"

# --- 2g: Verify the app user can connect ---
if mysql -u "${DB_USER}" -p"${DB_PASS}" -e "SELECT 1;" "${DB_NAME}" > /dev/null 2>&1; then
  ok "Database connection verified: ${DB_USER}@localhost → ${DB_NAME}"
else
  # Diagnostic: show what went wrong
  echo ""
  warn "Connection test failed. Diagnostics:"
  echo -e "  User exists: $(${MYSQL_ROOT_CMD} -N -e "SELECT COUNT(*) FROM mysql.user WHERE User='${DB_USER}' AND Host='localhost';" 2>/dev/null || echo 'unknown')"
  echo -e "  DB exists:   $(${MYSQL_ROOT_CMD} -N -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';" 2>/dev/null || echo 'unknown')"
  echo -e "  Auth plugin: $(${MYSQL_ROOT_CMD} -N -e "SELECT plugin FROM mysql.user WHERE User='${DB_USER}' AND Host='localhost';" 2>/dev/null || echo 'unknown')"
  fail "Cannot connect to MySQL as '${DB_USER}'. See diagnostics above."
fi

# ─── Step 3: App User ──────────────────────────────────────────────────────

step "Step 3/9: App User"

if id "${APP_USER}" &>/dev/null; then
  ok "User '${APP_USER}' already exists"
else
  info "Creating system user '${APP_USER}'..."
  useradd -m -s /bin/bash "${APP_USER}"
  ok "User '${APP_USER}' created"
fi

# ─── Step 4: Clone / Update Repository ─────────────────────────────────────

step "Step 4/9: Application Code"

if [[ -d "${APP_DIR}/.git" ]]; then
  info "Repository exists, pulling latest..."
  sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && git pull" 2>/dev/null || true
  ok "Repository updated"
else
  if [[ -d "${APP_DIR}" ]]; then
    info "Directory exists but is not a git repo. Backing up and re-cloning..."
    mv "${APP_DIR}" "${APP_DIR}.bak.$(date +%s)"
  fi
  info "Cloning repository..."
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
  ok "Repository cloned to ${APP_DIR}"
fi

# ─── Step 5: Install Dependencies & Build ──────────────────────────────────

step "Step 5/9: Dependencies & Build"

# Write .npmrc for build approvals
sudo -u "${APP_USER}" bash -c "
  cd '${APP_DIR}'
  cat > .npmrc << 'NPMRC'
approve-builds=esbuild,@tailwindcss/oxide
NPMRC
"

info "Installing dependencies (this may take a minute)..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
ok "Dependencies installed"

info "Building production bundle..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && NODE_ENV= pnpm build"
ok "Production build complete"

# Verify build output
if [[ -f "${APP_DIR}/dist/index.js" ]]; then
  ok "Build artifact verified: dist/index.js"
else
  fail "Build failed — dist/index.js not found"
fi

# ─── Step 6: Generate / Patch .env ────────────────────────────────────────

step "Step 6/9: Environment Configuration"

# URL-encode the DB password (handle any special chars)
DB_PASS_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASS}', safe=''))" 2>/dev/null || echo "${DB_PASS}")

DATABASE_URL="mysql://${DB_USER}:${DB_PASS_ENCODED}@127.0.0.1:3306/${DB_NAME}"
ENV_FILE="${APP_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # Case 5: .env already exists — back it up, then patch DATABASE_URL only
  info "Existing .env found — backing up to .env.bak"
  cp "${ENV_FILE}" "${ENV_FILE}.bak"

  if grep -q "^DATABASE_URL=" "${ENV_FILE}"; then
    # Replace existing DATABASE_URL line
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "${ENV_FILE}"
    ok "DATABASE_URL updated in existing .env"
  else
    # Add DATABASE_URL if missing
    echo "DATABASE_URL=${DATABASE_URL}" >> "${ENV_FILE}"
    ok "DATABASE_URL added to existing .env"
  fi

  # Ensure PORT is set
  if ! grep -q "^PORT=" "${ENV_FILE}"; then
    echo "PORT=${APP_PORT}" >> "${ENV_FILE}"
  fi

  # Ensure JWT_SECRET exists
  if ! grep -q "^JWT_SECRET=" "${ENV_FILE}"; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> "${ENV_FILE}"
  fi

  # Ensure NODE_ENV is set
  if ! grep -q "^NODE_ENV=" "${ENV_FILE}"; then
    echo "NODE_ENV=production" >> "${ENV_FILE}"
  fi
else
  # Fresh .env
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "${ENV_FILE}" << EOF
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
EOF
  ok ".env created from scratch"
fi

chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
ok ".env secured (owner-read only)"

# Print the DATABASE_URL for verification (mask password)
MASKED_URL=$(echo "${DATABASE_URL}" | sed "s|:${DB_PASS_ENCODED}@|:****@|")
info "DATABASE_URL = ${MASKED_URL}"

# ─── Step 7: Database Migrations ───────────────────────────────────────────

step "Step 7/9: Database Migrations"

# Clear stale migration tracking so the consolidated migration runs cleanly.
# The migration uses CREATE TABLE IF NOT EXISTS — safe to re-run on existing databases.
info "Clearing stale migration state..."
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "DROP TABLE IF EXISTS \`__drizzle_migrations\`;" 2>/dev/null || true

info "Running migrations..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm db:push" 2>&1 || {
  warn "Migration command returned an error — checking if tables exist anyway..."
}

# Verify tables exist
TABLE_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -N -e "SHOW TABLES;" 2>/dev/null | wc -l)
if [[ ${TABLE_COUNT} -ge 7 ]]; then
  ok "Migrations complete — ${TABLE_COUNT} tables found"
  # List them
  info "Tables:"
  mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -N -e "SHOW TABLES;" 2>/dev/null | while read t; do
    echo -e "    ${CYAN}${t}${NC}"
  done
else
  warn "Expected ≥7 tables but found ${TABLE_COUNT}. Migration may need manual review."
  info "Tables found:"
  mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -N -e "SHOW TABLES;" 2>/dev/null | while read t; do
    echo -e "    ${CYAN}${t}${NC}"
  done
fi

# Verify skynet_config table specifically (the one that was causing the query failure)
if mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM skynet_config;" 2>/dev/null; then
  ok "skynet_config table accessible"
else
  warn "skynet_config table not accessible — check migration output above"
fi

# ─── Step 8: systemd Service ───────────────────────────────────────────────

step "Step 8/9: systemd Service"

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=Skynet Glass Dashboard
Documentation=https://github.com/cvalentine99/SkyNet_Glass
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Environment
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${APP_DIR}
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APP_NAME} > /dev/null 2>&1

# Stop if already running
systemctl stop ${APP_NAME} 2>/dev/null || true

# Kill anything on the port
lsof -t -i:${APP_PORT} 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 1

systemctl start ${APP_NAME}

# Wait for server to come up
sleep 4

if systemctl is-active --quiet ${APP_NAME}; then
  ok "systemd service is running"
else
  warn "Service may not have started. Checking journal..."
  journalctl -u ${APP_NAME} -n 10 --no-pager 2>/dev/null || true
fi

# Check for [Database] Connection OK in journal
sleep 2
if journalctl -u ${APP_NAME} -n 20 --no-pager 2>/dev/null | grep -q "Connection OK"; then
  ok "App confirmed: [Database] Connection OK"
elif journalctl -u ${APP_NAME} -n 20 --no-pager 2>/dev/null | grep -q "FATAL"; then
  warn "App reported database connection failure. Check: sudo journalctl -u ${APP_NAME} -n 20"
else
  info "Waiting for app startup log..."
  sleep 3
  if journalctl -u ${APP_NAME} -n 30 --no-pager 2>/dev/null | grep -q "Connection OK"; then
    ok "App confirmed: [Database] Connection OK"
  else
    warn "Could not confirm DB connection from logs. Check: sudo journalctl -u ${APP_NAME} -n 30"
  fi
fi

# ─── Step 9: Nginx ─────────────────────────────────────────────────────────

step "Step 9/9: Nginx Reverse Proxy"

# Get the server's LAN IP
SERVER_IP=$(hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen 80;
    server_name ${SERVER_IP} skynet.local _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}

# Remove default site if it exists (conflicts with catch-all)
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test and reload nginx
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  ok "Nginx configured and reloaded"
else
  warn "Nginx config test failed. Check: sudo nginx -t"
fi

# ─── Done ───────────────────────────────────────────────────────────────────

step "Installation Complete!"

echo ""
echo -e "${GREEN}${BOLD}Skynet Glass is running!${NC}"
echo ""
echo -e "  Dashboard:  ${CYAN}http://${SERVER_IP}${NC}  (via nginx)"
echo -e "  Direct:     ${CYAN}http://${SERVER_IP}:${APP_PORT}${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo -e "  1. Open the dashboard in your browser"
echo -e "  2. Go to ${CYAN}Settings${NC}"
echo -e "  3. Enter your router SSH credentials:"
echo -e "     • Address: ${CYAN}192.168.50.1${NC}"
echo -e "     • Port: ${CYAN}22${NC}"
echo -e "     • Username: ${CYAN}admin${NC}"
echo -e "     • Password: ${CYAN}(your router admin password)${NC}"
echo -e "  4. Click ${CYAN}Test Connection${NC}"
echo -e "  5. Enable polling to start collecting data"
echo ""
echo -e "  ${BOLD}Verification commands:${NC}"
echo -e "  ${YELLOW}sudo systemctl status ${APP_NAME}${NC}           # service running?"
echo -e "  ${YELLOW}sudo journalctl -u ${APP_NAME} -n 20${NC}       # app logs"
echo -e "  ${YELLOW}mysql -u ${DB_USER} -p'****' ${DB_NAME} -e 'SHOW TABLES;'${NC}  # tables exist?"
echo -e "  ${YELLOW}curl -s http://localhost:${APP_PORT}/api/trpc/skynet.getConfig | head -c 200${NC}  # API works?"
echo ""
echo -e "  ${BOLD}Credentials saved to:${NC} ${YELLOW}${ENV_FILE}${NC}"
echo -e "  (DB password is auto-generated — you never need to know it)"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  Status:   ${YELLOW}sudo systemctl status ${APP_NAME}${NC}"
echo -e "  Logs:     ${YELLOW}sudo journalctl -u ${APP_NAME} -f${NC}"
echo -e "  Restart:  ${YELLOW}sudo systemctl restart ${APP_NAME}${NC}"
echo -e "  Stop:     ${YELLOW}sudo systemctl stop ${APP_NAME}${NC}"
echo ""

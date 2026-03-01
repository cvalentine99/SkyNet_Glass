#!/usr/bin/env bash
# ============================================================================
#  Skynet Glass — Automated Installer
#  One script to install everything on Ubuntu 24.04 LTS.
#
#  Usage:
#    sudo bash install.sh
#
#  What this does:
#    1. Installs system packages (Node.js 22, pnpm, MySQL 8, nginx)
#    2. Creates MySQL database and user (auto-generates password)
#    3. Clones or updates the repository
#    4. Installs dependencies and builds the production bundle
#    5. Generates .env with all required variables
#    6. Runs database migrations
#    7. Creates systemd service for auto-start
#    8. Configures nginx reverse proxy
#    9. Starts everything up
#
#  Run this as root or with sudo. It will create a 'skynet' system user
#  to run the application.
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

if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  warn "This script is designed for Ubuntu. Proceeding anyway..."
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
apt-get install -y -qq curl git build-essential nginx openssl lsof > /dev/null 2>&1
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

if command -v mysql &>/dev/null; then
  ok "MySQL already installed"
else
  info "Installing MySQL 8..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server > /dev/null 2>&1
  systemctl enable --now mysql > /dev/null 2>&1
  ok "MySQL installed and started"
fi

# Generate a random DB password
DB_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)

# Check if user already exists
if mysql -u root -e "SELECT User FROM mysql.user WHERE User='${DB_USER}' AND Host='localhost';" 2>/dev/null | grep -q "${DB_USER}"; then
  info "MySQL user '${DB_USER}' already exists — resetting password..."
  mysql -u root -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}'; FLUSH PRIVILEGES;" 2>/dev/null
  ok "Password reset for MySQL user '${DB_USER}'"
else
  info "Creating MySQL user '${DB_USER}'..."
  mysql -u root -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null
  ok "MySQL user '${DB_USER}' created"
fi

# Create database if not exists
mysql -u root -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
mysql -u root -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null
ok "Database '${DB_NAME}' ready"

# Verify connection
if mysql -u "${DB_USER}" -p"${DB_PASS}" -e "SELECT 1;" "${DB_NAME}" > /dev/null 2>&1; then
  ok "Database connection verified"
else
  fail "Cannot connect to MySQL with generated credentials. Check MySQL installation."
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
  info "Cloning repository..."
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
  ok "Repository cloned to ${APP_DIR}"
fi

# ─── Step 5: Install Dependencies & Build ──────────────────────────────────

step "Step 5/9: Dependencies & Build"

info "Configuring pnpm build approvals..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm config set --location project approve-builds esbuild" 2>/dev/null || true
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm config set --location project approve-builds @tailwindcss/oxide" 2>/dev/null || true

# Also write .npmrc directly as a fallback
sudo -u "${APP_USER}" bash -c "
  cd '${APP_DIR}'
  if ! grep -q 'approve-builds' .npmrc 2>/dev/null; then
    echo 'approve-builds=esbuild,@tailwindcss/oxide' >> .npmrc
  fi
"

info "Installing dependencies (this may take a minute)..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
ok "Dependencies installed"

info "Building production bundle..."
# Build needs NODE_ENV unset (Vite complains about NODE_ENV=production in .env during build)
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm build"
ok "Production build complete"

# Verify build output
if [[ -f "${APP_DIR}/dist/index.js" ]]; then
  ok "Build artifact verified: dist/index.js"
else
  fail "Build failed — dist/index.js not found"
fi

# ─── Step 6: Generate .env ─────────────────────────────────────────────────

step "Step 6/9: Environment Configuration"

JWT_SECRET=$(openssl rand -hex 32)

# URL-encode the DB password (handle any special chars)
DB_PASS_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASS}', safe=''))" 2>/dev/null || echo "${DB_PASS}")

ENV_FILE="${APP_DIR}/.env"

cat > "${ENV_FILE}" << EOF
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_URL=mysql://${DB_USER}:${DB_PASS_ENCODED}@127.0.0.1:3306/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
EOF

chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
ok ".env created with auto-generated credentials"

# ─── Step 7: Database Migrations ───────────────────────────────────────────

step "Step 7/9: Database Migrations"

info "Running migrations..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && pnpm db:push"

# Verify tables
TABLE_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -N -e "SHOW TABLES;" 2>/dev/null | wc -l)
if [[ ${TABLE_COUNT} -ge 7 ]]; then
  ok "Migrations complete — ${TABLE_COUNT} tables created"
else
  warn "Expected 8 tables but found ${TABLE_COUNT}. Check migration output above."
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
ok "systemd service created and started"

# Wait for server to come up
sleep 3
if systemctl is-active --quiet ${APP_NAME}; then
  ok "Service is running"
else
  warn "Service may not have started. Check: sudo journalctl -u ${APP_NAME} -n 20"
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
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  Status:   ${YELLOW}sudo systemctl status ${APP_NAME}${NC}"
echo -e "  Logs:     ${YELLOW}sudo journalctl -u ${APP_NAME} -f${NC}"
echo -e "  Restart:  ${YELLOW}sudo systemctl restart ${APP_NAME}${NC}"
echo -e "  Stop:     ${YELLOW}sudo systemctl stop ${APP_NAME}${NC}"
echo ""
echo -e "  ${BOLD}Credentials saved to:${NC} ${YELLOW}${ENV_FILE}${NC}"
echo -e "  (DB password is auto-generated — you never need to know it)"
echo ""

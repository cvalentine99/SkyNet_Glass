# Skynet Glass — Bare Metal Deployment Guide (Ubuntu 24.04 LTS)

This guide walks through deploying Skynet Glass on a fresh Ubuntu 24.04 LTS server. The application is a Node.js/Express server that serves a React SPA frontend, connects to a MySQL-compatible database, and communicates with your ASUS router running Skynet firewall.

---

## Architecture Overview

Skynet Glass is a single-process Node.js application. In production, the Express server handles both the tRPC API and serves the pre-built static frontend files. A reverse proxy (Nginx) sits in front to handle TLS termination, compression, and static asset caching.

```
Internet → Nginx (443/80) → Node.js (3000) → MySQL (3306)
                                            → Your Router (LAN)
```

The application uses Manus OAuth for authentication by default. For a self-hosted deployment, you have two options: keep Manus OAuth (requires the app to be reachable from the internet) or disable authentication entirely for LAN-only use. Both approaches are covered below.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| CPU | 1 core | 2+ cores |
| RAM | 512 MB | 1 GB |
| Disk | 1 GB free | 5 GB free |
| Node.js | 20.x | 22.x LTS |
| MySQL | 8.0 | 8.0+ or TiDB |
| Network | LAN access to router | LAN + internet for OAuth |

---

## Step 1: System Preparation

Update the system and install essential packages.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

### Install Node.js 22.x

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v22.x.x
```

### Install pnpm

```bash
sudo npm install -g pnpm@10
pnpm --version   # should print 10.x.x
```

### Install MySQL 8.0

If you already have a MySQL/MariaDB/TiDB instance, skip this section and use your existing connection string.

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

Secure the installation and create the application database and user:

```bash
sudo mysql -u root <<'SQL'
CREATE DATABASE skynet_glass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'skynet'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON skynet_glass.* TO 'skynet'@'localhost';
FLUSH PRIVILEGES;
SQL
```

> **Important:** Replace `CHANGE_ME_STRONG_PASSWORD` with a strong, unique password. You will use this in the `DATABASE_URL` environment variable.

---

## Step 2: Clone and Build the Application

Create a dedicated system user (optional but recommended for security):

```bash
sudo useradd -m -s /bin/bash skynet
sudo su - skynet
```

Clone the repository and install dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/skynet-glass.git ~/skynet-glass
cd ~/skynet-glass
pnpm install --frozen-lockfile
```

> If you exported from Manus rather than GitHub, upload the project files to the server via `scp` or `rsync` instead of `git clone`.

Build the production assets:

```bash
pnpm build
```

This produces two artifacts:

| Output | Description |
|---|---|
| `dist/index.js` | Bundled Express server (ESM) |
| `dist/public/` | Pre-built React SPA (HTML, CSS, JS) |

---

## Step 3: Environment Variables

Create a `.env` file in the project root. The server loads it automatically via `dotenv`.

```bash
cat > ~/skynet-glass/.env << 'EOF'
# ─── Required ────────────────────────────────────────────
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://skynet:CHANGE_ME_STRONG_PASSWORD@localhost:3306/skynet_glass
JWT_SECRET=GENERATE_A_RANDOM_64_CHAR_STRING

# ─── Manus OAuth (required for authentication) ──────────
# These values come from your Manus project settings.
# If running LAN-only without auth, see "LAN-Only Mode" below.
VITE_APP_ID=your_manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im

# ─── Owner Info (for notifications) ─────────────────────
OWNER_OPEN_ID=your_manus_open_id
OWNER_NAME=your_name

# ─── Manus Forge API (notifications, LLM — optional) ────
# Leave empty if you don't need push notifications.
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=

# ─── Frontend Forge API (optional) ──────────────────────
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
EOF
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
# Paste the output as the JWT_SECRET value
```

### Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret for signing session cookies (min 32 chars) |
| `VITE_APP_ID` | For auth | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | For auth | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | For auth | Manus login portal URL |
| `OWNER_OPEN_ID` | No | Owner's Manus OpenID for notifications |
| `OWNER_NAME` | No | Owner display name |
| `BUILT_IN_FORGE_API_URL` | No | Manus Forge API for notifications/LLM |
| `BUILT_IN_FORGE_API_KEY` | No | Bearer token for Forge API |

---

## Step 4: Run Database Migrations

Apply the Drizzle schema migrations to create all required tables:

```bash
cd ~/skynet-glass
pnpm db:push
```

This runs `drizzle-kit generate && drizzle-kit migrate`, which applies all SQL migration files in `drizzle/` to your database. You should see output confirming each migration was applied.

Verify the tables were created:

```bash
mysql -u skynet -p skynet_glass -e "SHOW TABLES;"
```

Expected tables:

| Table | Purpose |
|---|---|
| `users` | User accounts (from OAuth) |
| `skynet_config` | Router connection settings |
| `skynet_stats_cache` | Cached parsed stats |
| `skynet_stats_history` | Historical KPI snapshots |
| `skynet_alert_config` | Alert thresholds and toggles |
| `skynet_alert_history` | Notification log |
| `device_policies` | Per-device blocking rules |
| `__drizzle_migrations` | Migration tracking |

---

## Step 5: Test the Server

Run a quick smoke test before setting up the service:

```bash
cd ~/skynet-glass
NODE_ENV=production node dist/index.js
```

You should see:

```
[OAuth] Initialized with baseURL: https://api.manus.im
Server running on http://localhost:3000/
[Skynet] Auto-start polling skipped (no config or error)
```

Open `http://YOUR_SERVER_IP:3000` in a browser. You should see the Skynet Glass dashboard. Press `Ctrl+C` to stop.

---

## Step 6: Create a systemd Service

Create a systemd unit file so the application starts automatically and restarts on failure.

```bash
sudo tee /etc/systemd/system/skynet-glass.service > /dev/null << 'EOF'
[Unit]
Description=Skynet Glass Dashboard
Documentation=https://github.com/YOUR_USERNAME/skynet-glass
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=skynet
Group=skynet
WorkingDirectory=/home/skynet/skynet-glass
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/home/skynet/skynet-glass/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/skynet/skynet-glass
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=skynet-glass

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable skynet-glass
sudo systemctl start skynet-glass
```

Check the status:

```bash
sudo systemctl status skynet-glass
sudo journalctl -u skynet-glass -f   # follow live logs
```

---

## Step 7: Configure Nginx Reverse Proxy

### Option A: HTTP Only (LAN use)

```bash
sudo tee /etc/nginx/sites-available/skynet-glass > /dev/null << 'NGINX'
server {
    listen 80;
    server_name skynet.local;  # Change to your hostname or IP

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Static assets — long cache
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API and SPA
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeouts for long-polling tRPC calls
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # Increase body size for config import
        client_max_body_size 10M;
    }
}
NGINX
```

### Option B: HTTPS with Let's Encrypt (internet-facing)

```bash
sudo tee /etc/nginx/sites-available/skynet-glass > /dev/null << 'NGINX'
server {
    listen 80;
    server_name skynet.yourdomain.com;  # Change to your domain
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name skynet.yourdomain.com;  # Change to your domain

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/skynet.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/skynet.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Static assets
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API and SPA
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 10M;
    }
}
NGINX
```

Enable the site and obtain a certificate:

```bash
sudo ln -sf /etc/nginx/sites-available/skynet-glass /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# For HTTPS (Option B only):
sudo certbot --nginx -d skynet.yourdomain.com
```

---

## Step 8: LAN-Only Mode (No Authentication)

If you are running Skynet Glass exclusively on your LAN and do not want Manus OAuth, you need to bypass the authentication middleware. This involves a small code change before building.

Edit `server/_core/context.ts` and modify the `createContext` function so that `ctx.user` always returns a mock admin user instead of authenticating via OAuth. Here is a minimal patch:

```typescript
// In server/_core/context.ts, replace the user resolution with:
export async function createContext({ req, res }: CreateExpressContextOptions): Promise<TrpcContext> {
  // LAN-only mode: bypass OAuth, use a static admin user
  const user = {
    id: 1,
    openId: "local-admin",
    email: "admin@local",
    name: "Admin",
    loginMethod: "local",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req, res };
}
```

Then rebuild:

```bash
pnpm build
sudo systemctl restart skynet-glass
```

> **Warning:** This removes all authentication. Only use this on a trusted LAN behind a firewall. Do not expose an unauthenticated instance to the internet.

---

## Step 9: Firewall Configuration

Allow HTTP/HTTPS traffic and restrict direct access to the Node.js port:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

The Node.js server on port 3000 is only accessible via `127.0.0.1` through Nginx. No external access to port 3000 is needed.

---

## Step 10: Post-Deployment Verification

Run through this checklist to confirm everything is working:

| Check | Command / Action | Expected Result |
|---|---|---|
| Service running | `sudo systemctl status skynet-glass` | Active (running) |
| Nginx proxy | `curl -I http://localhost` | HTTP 200 |
| Dashboard loads | Open `https://skynet.yourdomain.com` | Skynet Glass UI |
| Database connected | Check logs for no DB errors | No connection errors |
| Router config | Go to Settings, enter router IP | Test connection succeeds |
| Stats polling | Click "Fetch Now" in Settings | Stats populate dashboard |

---

## Updating the Application

To deploy a new version:

```bash
sudo su - skynet
cd ~/skynet-glass

# Pull latest code
git pull origin main

# Install any new dependencies
pnpm install --frozen-lockfile

# Run migrations (if schema changed)
pnpm db:push

# Rebuild
pnpm build

# Restart
exit
sudo systemctl restart skynet-glass
```

---

## Troubleshooting

### Server won't start

Check the logs for the specific error:

```bash
sudo journalctl -u skynet-glass --no-pager -n 50
```

Common causes and fixes:

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required` | Missing `.env` or wrong path | Verify `.env` exists in project root |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL not running | `sudo systemctl start mysql` |
| `Access denied for user` | Wrong DB credentials | Check `DATABASE_URL` in `.env` |
| `EADDRINUSE :::3000` | Port already in use | Change `PORT` in `.env` or kill the other process |
| `Cannot find module` | Build artifacts missing | Run `pnpm build` again |

### OAuth callback fails

The OAuth callback URL must match the origin the browser uses. If you access the app at `https://skynet.example.com`, the callback will be `https://skynet.example.com/api/oauth/callback`. Ensure your Nginx `server_name` and DNS both resolve correctly.

### Database migrations fail

If `pnpm db:push` fails, check that `DATABASE_URL` is set in the current shell:

```bash
source ~/skynet-glass/.env
export DATABASE_URL
pnpm db:push
```

### High memory usage

The application typically uses 80–150 MB of RAM. If memory grows beyond 300 MB, it may be due to accumulated stats history. You can prune old history:

```sql
DELETE FROM skynet_stats_history WHERE snapshotAt < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

---

## Backup Strategy

### Database

Set up a daily MySQL dump via cron:

```bash
sudo tee /etc/cron.daily/skynet-backup > /dev/null << 'BASH'
#!/bin/bash
BACKUP_DIR="/home/skynet/backups"
mkdir -p "$BACKUP_DIR"
mysqldump -u skynet -p'CHANGE_ME_STRONG_PASSWORD' skynet_glass | gzip > "$BACKUP_DIR/skynet-glass-$(date +%Y%m%d).sql.gz"
# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
BASH
sudo chmod +x /etc/cron.daily/skynet-backup
```

### Application Config

Use the built-in Configuration Export feature in Settings to download a JSON backup of all router config, alert settings, and device policies. This can be restored via the Import feature on a fresh installation.

---

## Quick Reference

```bash
# Service management
sudo systemctl start skynet-glass
sudo systemctl stop skynet-glass
sudo systemctl restart skynet-glass
sudo systemctl status skynet-glass

# View logs
sudo journalctl -u skynet-glass -f          # follow live
sudo journalctl -u skynet-glass --since "1 hour ago"

# Rebuild after code changes
cd ~/skynet-glass && pnpm build && sudo systemctl restart skynet-glass

# Run migrations
cd ~/skynet-glass && pnpm db:push
```

# Skynet Glass — Bare Metal Deployment Guide (Ubuntu 24.04 LTS)

This guide walks through deploying Skynet Glass on a fresh Ubuntu 24.04 LTS server. The application is a Node.js/Express server that serves a React SPA frontend, connects to a MySQL-compatible database, and communicates with your ASUS router running Skynet firewall.

**Authentication is disabled (LAN-only mode).** Every user is treated as a local admin. Only deploy on a trusted LAN behind a firewall.

---

## Architecture Overview

Skynet Glass is a single-process Node.js application. In production, the Express server handles both the tRPC API and serves the pre-built static frontend files. A reverse proxy (Nginx) sits in front to handle compression and static asset caching.

```
LAN Browser → Nginx (80) → Node.js (3000) → MySQL (3306)
                                           → Your Router (SSH)
```

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
| Network | LAN access to router | Same subnet as router |

---

## Step 1: System Preparation

Update the system and install essential packages.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx
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

Create the application database and user:

```bash
sudo mysql -u root <<'SQL'
CREATE DATABASE skynet_glass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'skynet'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON skynet_glass.* TO 'skynet'@'localhost';
FLUSH PRIVILEGES;
SQL
```

> **Important:** Replace `CHANGE_ME_STRONG_PASSWORD` with a strong, unique password.

---

## Step 2: Clone and Build the Application

Create a dedicated system user (optional but recommended for security):

```bash
sudo useradd -m -s /bin/bash skynet
sudo su - skynet
```

Clone the repository and install dependencies:

```bash
git clone https://github.com/cvalentine99/SkyNet_Glass.git ~/skynet-glass
cd ~/skynet-glass
pnpm install --frozen-lockfile
```

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

Skynet Glass needs only **4 environment variables**. Create a `.env` file in the project root:

```bash
cat > ~/skynet-glass/.env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://skynet:CHANGE_ME_STRONG_PASSWORD@localhost:3306/skynet_glass
JWT_SECRET=PASTE_YOUR_RANDOM_SECRET_HERE
EOF
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
# Paste the output as the JWT_SECRET value in .env
```

### Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | Yes | Server listen port (default: 3000) |
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret for signing session cookies (min 32 chars) |

That's it. No OAuth, Forge API, or analytics variables are needed for bare metal deployment.

---

## Step 4: Run Database Migrations

Apply the Drizzle schema migrations to create all required tables:

```bash
cd ~/skynet-glass
pnpm db:push
```

This runs `drizzle-kit generate && drizzle-kit migrate`, which applies all SQL migration files to your database.

Verify the tables were created:

```bash
mysql -u skynet -p skynet_glass -e "SHOW TABLES;"
```

Expected tables:

| Table | Purpose |
|---|---|
| `users` | User accounts (local admin) |
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
Documentation=https://github.com/cvalentine99/SkyNet_Glass
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

Since this is a LAN-only deployment, HTTP is sufficient. If you later want HTTPS, add Let's Encrypt with `certbot`.

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

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/skynet-glass /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 8: Firewall Configuration

Allow HTTP traffic and restrict direct access to the Node.js port:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

The Node.js server on port 3000 is only accessible via `127.0.0.1` through Nginx. No external access to port 3000 is needed.

---

## Step 9: Post-Deployment Verification

Run through this checklist to confirm everything is working:

| Check | Command / Action | Expected Result |
|---|---|---|
| Service running | `sudo systemctl status skynet-glass` | Active (running) |
| Nginx proxy | `curl -I http://localhost` | HTTP 200 |
| Dashboard loads | Open `http://skynet.local` in browser | Skynet Glass UI |
| Database connected | Check logs for no DB errors | No connection errors |
| Router config | Go to Settings, enter router IP | Test connection succeeds |
| Stats polling | Click "Update Stats" on dashboard | Stats populate |

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

### Database migrations fail

If `pnpm db:push` fails, check that `DATABASE_URL` is set in the current shell:

```bash
source ~/skynet-glass/.env
export DATABASE_URL
pnpm db:push
```

### High memory usage

The application typically uses 80–150 MB of RAM. If memory grows beyond 300 MB, prune old history:

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

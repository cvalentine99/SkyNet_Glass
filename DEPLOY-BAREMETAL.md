# Skynet Glass — Bare Metal Deployment Guide (Ubuntu 24.04 LTS)

This guide walks through deploying Skynet Glass on a fresh Ubuntu 24.04 LTS server. The application is a Node.js/Express server that serves a React SPA frontend, connects to a MySQL-compatible database, and communicates with your ASUS router running Skynet firewall.

**Authentication is disabled (LAN-only mode).** Every user is treated as a local admin. Only deploy on a trusted LAN behind a firewall.

---

## Architecture Overview

```
LAN Browser → Nginx (80) → Node.js (3006) → MySQL (3306)
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

## Who Runs What

This guide has two types of commands. If you do not have sudo/root access, hand the **Admin** steps to someone who does and run the **App User** steps yourself.

| Step | Who | Why |
|---|---|---|
| 1. System Preparation | **Admin** (root/sudo) | Installs system packages, creates DB user |
| 2. Clone & Build | App User (`skynet`) | No root needed |
| 3. Environment Variables | App User (`skynet`) | No root needed |
| 4. Migrations & Smoke Test | App User (`skynet`) | No root needed |
| 5. systemd Service | **Admin** (root/sudo) | Creates system service |
| 6. Nginx & Firewall | **Admin** (root/sudo) | Configures reverse proxy |
| 7. Post-Deploy Verification | Either | Browser check |

---

## Step 1: System Preparation (requires sudo)

> **If you don't have sudo access**, give this entire section to your server admin and skip to Step 2 once they confirm it's done.

### 1a. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx
```

### 1b. Node.js 22.x

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v22.x.x
```

### 1c. pnpm

```bash
sudo npm install -g pnpm@10
pnpm --version   # should print 10.x.x
```

### 1d. MySQL 8.0

Skip this if you already have a MySQL/MariaDB/TiDB instance.

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

Create the database and user. Run these **one line at a time** in a `sudo mysql` session (heredocs can break when pasted into some terminals):

```bash
sudo mysql
```

Then inside the MySQL prompt, run each line individually:

```sql
CREATE DATABASE skynet_glass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'skynet'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON skynet_glass.* TO 'skynet'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> **Important:** Replace `CHANGE_ME_STRONG_PASSWORD` with a strong, unique password. You will use this same password in the `DATABASE_URL` environment variable in Step 3.

Verify the user works:

```bash
mysql -u skynet -p'CHANGE_ME_STRONG_PASSWORD' -e "SELECT 1;"
```

If this prints `1`, the database user is ready. If you get `Access denied`, double-check the password — do not try `ALTER USER` or other workarounds until you have confirmed the exact password matches.

### 1e. Create app user (optional)

```bash
sudo useradd -m -s /bin/bash skynet
sudo su - skynet
```

---

## Step 2: Clone and Build (no sudo needed)

If you created the `skynet` user above, make sure you are logged in as that user (`sudo su - skynet`). Otherwise, use your own home directory.

### 2a. Clone

```bash
git clone https://github.com/cvalentine99/SkyNet_Glass.git ~/skynet-glass
cd ~/skynet-glass
```

### 2b. Approve native build scripts

pnpm 10+ requires you to approve packages that run build scripts (like `esbuild` and `@tailwindcss/oxide`). The interactive `pnpm approve-builds` command can be difficult in some terminals. Use this non-interactive approach instead:

```bash
pnpm config set --location project approve-builds esbuild
pnpm config set --location project approve-builds @tailwindcss/oxide
```

If that doesn't work, you can also edit `.npmrc` in the project root directly:

```bash
cat >> .npmrc << 'EOF'
approve-builds=esbuild,@tailwindcss/oxide
EOF
```

### 2c. Install dependencies

```bash
pnpm install
```

> **Note:** If pnpm warns about unapproved build scripts and skips them, run `pnpm rebuild` after adding the approve-builds config above, then try `pnpm install` again.

### 2d. Build

```bash
pnpm build
```

This produces two artifacts:

| Output | Description |
|---|---|
| `dist/index.js` | Bundled Express server (ESM) |
| `dist/public/` | Pre-built React SPA (HTML, CSS, JS) |

---

## Step 3: Environment Variables (no sudo needed)

Skynet Glass needs only **4 environment variables**. Create a `.env` file in the project root:

```bash
nano ~/skynet-glass/.env
```

Paste this content (edit the values):

```
NODE_ENV=production
PORT=3006
DATABASE_URL=mysql://skynet:CHANGE_ME_STRONG_PASSWORD@localhost:3306/skynet_glass
JWT_SECRET=PASTE_YOUR_RANDOM_SECRET_HERE
```

Generate a secure JWT secret and paste it in:

```bash
openssl rand -hex 32
```

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | Yes | Server listen port (default: 3006) |
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret for signing session cookies (min 32 chars) |

That's it. No OAuth, Forge API, or analytics variables are needed.

---

## Step 4: Migrations and Smoke Test (no sudo needed)

### 4a. Run database migrations FIRST

> **This step must happen before you start the server.** If you skip it, the server will start but every query will fail with "table doesn't exist" errors — which looks like a connection problem but isn't.

```bash
cd ~/skynet-glass
pnpm db:push
```

If this fails with a connection error, verify your `DATABASE_URL` is correct:

```bash
source ~/skynet-glass/.env
mysql -u skynet -p"$(echo $DATABASE_URL | sed 's|.*://skynet:\(.*\)@.*|\1|')" skynet_glass -e "SELECT 1;"
```

### 4b. Verify tables exist

```bash
mysql -u skynet -p skynet_glass -e "SHOW TABLES;"
```

You should see these tables:

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

> **If SHOW TABLES returns empty**, migrations did not run. Go back to 4a.

### 4c. Pre-flight checklist

Before starting the server, confirm all of these:

| Check | Command | Expected |
|---|---|---|
| `.env` exists | `cat ~/skynet-glass/.env` | Shows 4 variables |
| Build exists | `ls ~/skynet-glass/dist/index.js` | File exists |
| Tables exist | `mysql -u skynet -p skynet_glass -e "SHOW TABLES;"` | 8 tables listed |
| Port available | `ss -tlnp \| grep 3006` | Nothing (port is free) |

### 4d. Smoke test

```bash
cd ~/skynet-glass
NODE_ENV=production node dist/index.js
```

You should see:

```
Server running on http://localhost:3006/
[Skynet] Auto-start polling skipped (no config or error)
```

Open `http://YOUR_SERVER_IP:3006` in a browser. You should see the Skynet Glass dashboard. Press `Ctrl+C` to stop.

> **If you see "Failed query" or "table doesn't exist" errors**, you skipped Step 4a. Stop the server, run `pnpm db:push`, and try again.

---

## Step 5: systemd Service (requires sudo)

> **If you don't have sudo access**, give this section to your server admin.

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

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable skynet-glass
sudo systemctl start skynet-glass
sudo systemctl status skynet-glass
```

Follow live logs:

```bash
sudo journalctl -u skynet-glass -f
```

---

## Step 6: Nginx and Firewall (requires sudo)

> **If you don't have sudo access**, give this section to your server admin.

### 6a. Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/skynet-glass > /dev/null << 'NGINX'
server {
    listen 80;
    server_name skynet.local;  # Change to your hostname or IP

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    location /assets/ {
        proxy_pass http://127.0.0.1:3006;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3006;
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

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/skynet-glass /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6b. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

The Node.js server on port 3006 is only accessible via `127.0.0.1` through Nginx. No external access to port 3006 is needed.

---

## Step 7: Post-Deployment Verification

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

```bash
# As the skynet user (or whoever owns the project):
cd ~/skynet-glass
git pull origin main
pnpm install
pnpm db:push          # run migrations if schema changed
pnpm build

# As admin (requires sudo):
sudo systemctl restart skynet-glass
```

---

## Troubleshooting

### Diagnostic order (check these in order, not randomly)

When something goes wrong, work through this list **top to bottom**. Most problems are #1 or #2.

| # | Check | Command | What it means if it fails |
|---|---|---|---|
| 1 | **Tables exist** | `mysql -u skynet -p skynet_glass -e "SHOW TABLES;"` | Migrations never ran. Run `pnpm db:push`. |
| 2 | **Build exists** | `ls dist/index.js` | Build artifacts missing. Run `pnpm build`. |
| 3 | **Env file exists** | `cat .env` | Missing `.env`. Create it per Step 3. |
| 4 | **DB connects** | `mysql -u skynet -p skynet_glass -e "SELECT 1;"` | Wrong password or MySQL not running. |
| 5 | **Port free** | `ss -tlnp \| grep 3006` | Something else is using port 3006. |
| 6 | **Service logs** | `sudo journalctl -u skynet-glass -n 50` | Read the actual error message. |

### "Failed query" or "table doesn't exist"

This is the most common error. It means the server connected to MySQL successfully, but the tables were never created. The fix is always:

```bash
cd ~/skynet-glass
pnpm db:push
sudo systemctl restart skynet-glass
```

### pnpm approve-builds issues

If `pnpm install` warns about unapproved build scripts for `esbuild` or `@tailwindcss/oxide`:

```bash
# Option 1: Non-interactive config
pnpm config set --location project approve-builds esbuild
pnpm config set --location project approve-builds @tailwindcss/oxide
pnpm rebuild

# Option 2: Edit .npmrc directly
echo "approve-builds=esbuild,@tailwindcss/oxide" >> .npmrc
pnpm rebuild
```

### MySQL "Access denied"

Before trying `ALTER USER` or other workarounds, verify the basics:

```bash
# 1. Confirm the user exists
sudo mysql -e "SELECT user, host FROM mysql.user WHERE user='skynet';"

# 2. Test with the exact password from your .env
mysql -u skynet -p'YOUR_EXACT_PASSWORD' -e "SELECT 1;"

# 3. If the user doesn't exist, create it (requires sudo mysql)
sudo mysql -e "CREATE USER 'skynet'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON skynet_glass.* TO 'skynet'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### Database migrations fail

If `pnpm db:push` can't find the DATABASE_URL:

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

Set up a daily MySQL dump via cron (requires sudo):

```bash
sudo tee /etc/cron.daily/skynet-backup > /dev/null << 'BASH'
#!/bin/bash
BACKUP_DIR="/home/skynet/backups"
mkdir -p "$BACKUP_DIR"
mysqldump -u skynet -p'CHANGE_ME_STRONG_PASSWORD' skynet_glass | gzip > "$BACKUP_DIR/skynet-glass-$(date +%Y%m%d).sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
BASH
sudo chmod +x /etc/cron.daily/skynet-backup
```

### Application Config

Use the built-in Configuration Export feature in Settings to download a JSON backup of all router config, alert settings, and device policies. This can be restored via the Import feature on a fresh installation.

---

## Quick Reference

```bash
# Service management (requires sudo)
sudo systemctl start skynet-glass
sudo systemctl stop skynet-glass
sudo systemctl restart skynet-glass
sudo systemctl status skynet-glass

# View logs (requires sudo)
sudo journalctl -u skynet-glass -f
sudo journalctl -u skynet-glass --since "1 hour ago"

# Rebuild after code changes (as app user)
cd ~/skynet-glass && pnpm build

# Run migrations (as app user)
cd ~/skynet-glass && pnpm db:push
```

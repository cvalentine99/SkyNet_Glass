# Skynet Glass — Environment Variables Reference

Only **4 variables** are required for a bare metal LAN-only deployment. OAuth is disabled — every user is treated as a local admin.

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server listen port | `3000` |
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://skynet:pass@localhost:3306/skynet_glass` |
| `JWT_SECRET` | Cookie signing secret (generate with `openssl rand -hex 32`) | `a1b2c3d4...` |

## Optional Variables

These are only needed if you want push alert notifications via the Forge API. Leave unset to disable (alerts still log to console).

| Variable | Description |
|---|---|
| `BUILT_IN_FORGE_API_URL` | Manus Forge API base URL |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API bearer token |

## Not Required (LAN-Only Mode)

The following variables are part of the template but are **not needed** for bare metal deployment:

| Variable | Why Not Needed |
|---|---|
| `VITE_APP_ID` | Manus OAuth app ID — OAuth is disabled |
| `OAUTH_SERVER_URL` | Manus OAuth server — OAuth is disabled |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal — OAuth is disabled |
| `OWNER_OPEN_ID` | Owner identification — all users are admin |
| `OWNER_NAME` | Owner display name — not used |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Forge API — not used |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge token — not used |
| `VITE_ANALYTICS_ENDPOINT` | Manus analytics — not used on bare metal |
| `VITE_ANALYTICS_WEBSITE_ID` | Manus analytics — not used on bare metal |

## Example .env File

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://skynet:YOUR_PASSWORD@localhost:3306/skynet_glass
JWT_SECRET=YOUR_RANDOM_SECRET_HERE
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

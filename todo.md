# Skynet Glass Full-Stack Upgrade

## Phase 1: Backend
- [x] Upgrade project to web-db-user
- [x] Remove Manus OAuth from Home page — simple app, no auth gating
- [x] Create backend tRPC routes:
  - [x] skynet.getConfig — connection settings
  - [x] skynet.saveConfig — save connection settings
  - [x] skynet.getStats — fetch + parse stats.js from router, return clean JSON
  - [x] skynet.fetchNow — force immediate fetch
  - [x] skynet.triggerGenstats — trigger genstats on the router
  - [x] skynet.getStatus — polling health check
  - [x] skynet.testConnection — test connection to router
  - [x] skynet.startPolling / skynet.stopPolling — polling control
- [x] Build stats.js parser (JavaScript arrays → JSON)
- [x] Add polling logic with configurable interval
- [x] Write vitest tests for parser (13 tests passing)
- [x] Create DB schema for skynet_config and skynet_stats_cache

## Phase 2: Frontend
- [x] Create Settings page for router configuration (/settings)
- [x] Update Sidebar to navigate to /settings
- [x] Replace hardcoded sample data with tRPC query hooks (useSkynetStats hook)
- [x] Add auto-refresh polling on frontend (60s refetch interval)
- [x] Show connection status indicator in header (Live/Offline/Sample Data)
- [x] Graceful fallback when router is unreachable (show sample data)

## Phase 3: Deliver
- [x] Final test pass (14 tests passing)
- [ ] Checkpoint
- [ ] Deliver to user

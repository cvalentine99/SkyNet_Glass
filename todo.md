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
- [x] Checkpoint (1c4744f0)
- [x] Deliver to user

## Phase 4: Wire All Charts to Live Data
- [x] Audit all components for hardcoded sample data imports
- [x] BlockedConnectionsChart — accept data via props
- [x] ConnectionTypesChart — accept data via props
- [x] CountryDistributionChart — accept data via props
- [x] PortHitsChart — accept data via props
- [x] OutboundBlocksChart — accept data via props
- [x] LiveConnectionsTable — accept data via props
- [x] ThreatTable — accept data via props
- [x] ThreatMapPanel — accept data via props
- [x] KpiCard row — already wired, verified
- [x] Update Home.tsx to pass all live data from useSkynetStats
- [x] Update useSkynetStats to provide data for all chart types
- [x] Test and checkpoint (14 tests passing)
- [x] Update default router config: address=192.168.50.1, port=8443, protocol=https

## Phase 5: Loading Animations
- [x] Create ChartSkeleton component with glass shimmer effect
- [x] Create KpiSkeleton component
- [x] Create TableSkeleton component
- [x] Add loading states to useSkynetStats hook (isRefetching, isFetchingStats)
- [x] Integrate skeletons into Home.tsx for all chart/table sections
- [x] Test and checkpoint (14 tests passing)

## Phase 6: Router Authentication
- [x] Add username/password columns to skynetConfig DB table
- [x] Update skynet-db.ts helpers to handle credentials
- [x] Update tRPC routes (saveConfig, testConnection, getConfig) to accept credentials
- [x] Update skynet-fetcher.ts to use HTTP Basic Auth (buildAuthHeaders helper)
- [x] Add username/password fields to Settings UI with show/hide toggle
- [x] Write vitest tests for auth header generation (8 tests)
- [x] Test and checkpoint (22 tests passing)

## Phase 7: Sidebar Cleanup — Use or Remove Tabs
- [x] Decide which sidebar tabs to keep vs remove (kept 5: Dashboard, Ports, Threats, Connections, Settings)
- [x] Convert sidebar from section-switcher to page navigator (routes + scroll-to)
- [x] Build scroll-to-section behavior for Ports, Threats, Connections
- [x] Removed 4 dead stubs: Alerts, Banned IPs, AlienVault, Live Monitor
- [x] Test and checkpoint (22 tests passing)

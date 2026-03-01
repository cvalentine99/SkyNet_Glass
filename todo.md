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

## Phase 8: Accuracy Fixes (from audit report)
### Critical
- [x] #1 Removed fabricated timeline — now shows honest inbound vs outbound bar chart with totals
- [x] #4 Fixed LiveConnectionsTable to use actual SkynetConnection fields (ip, banReason, country, alienVaultUrl, associatedDomains)
### Medium
- [x] #2 Renamed to "Port Hit Distribution", uses honest service names from port numbers (SSH, Telnet, HTTP, etc.)
- [x] #3 Country distribution now aggregates from ALL connection types (inbound+outbound+HTTP+topBlocks)
### Nit
- [x] #5 Missing original features — acknowledged as design choice, no action needed
- [x] #6 Changed default stats path to /user/skynet/stats.js everywhere (Settings, routers, schema)
- [x] #7 Uses already-parsed alienVaultUrl from stats.js, falls back to OTX URL only when missing
- [x] Test and checkpoint (22 tests passing, 0 TS errors)

## Phase 9: Premium Overhaul — No Mock Data, Real Threat Map, All Premium Features

### Kill Mock Data
- [x] Delete lib/data.ts entirely
- [x] Rewrite useSkynetStats to return empty/zero states (no sample data fallback)
- [x] Add proper empty states to every component ("Connect your router")
- [x] Remove "Sample Data Mode" banner — replaced with "No Router Connected" state

### Real Interactive Threat Map (Google Maps)
- [x] Build ThreatMapPanel with Google Maps dark-styled map
- [x] Plot threat IPs using country centroids with severity-colored markers
- [x] Add animated pulse effects on markers
- [x] Click markers for IP details popup
- [x] Heat density overlay for high-concentration areas

### Premium Features
- [x] Scroll-spy sidebar — highlight active section based on viewport (IntersectionObserver)
- [x] JSON/CSV export button in sidebar + format picker toast
- [x] Keyboard shortcuts (1-5 for sidebar nav, E for export)
- [x] Auto-start polling on server boot when config exists
- [x] Animated number transitions on KPI value changes (smooth from→to counter)

### Test & Deliver
- [x] Update all tests (22 passing, 0 TS errors)
- [x] Checkpoint and deliver

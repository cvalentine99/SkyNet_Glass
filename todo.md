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

## Phase 10: IP Ban/Unban Controls & Historical Stats Tracking

### Research
- [x] Study firewall.sh ban/unban command structure (firewall ban ip X / firewall unban ip X)
- [x] Study how start_apply.htm accepts Skynet commands (action_script + SystemCmd)
- [x] Document the exact POST body format for ban/unban

### IP Ban/Unban Backend
- [x] Add tRPC route: skynet.banIP — sends ban command to router
- [x] Add tRPC route: skynet.unbanIP — sends unban command to router
- [x] Respect Skynet's actual command format (SystemCmd with firewall ban/unban ip)
- [x] Add confirmation/safety checks (IP regex validation + comment sanitization)

### IP Ban/Unban Frontend
- [x] Add Ban IP button to ThreatTable rows + manual ban form
- [x] Add Ban/Unban buttons to LiveConnectionsTable rows with confirm/cancel
- [x] Add confirmation dialog before ban/unban actions
- [x] Show success/error feedback via toast notifications

### Historical Stats Tracking Backend
- [x] Create DB table for historical stats snapshots (skynet_stats_history)
- [x] Store KPI values on each stats fetch (dedup by content hash)
- [x] Add tRPC route: skynet.getHistory — returns historical data points

### Historical Stats Trend Charts Frontend
- [x] Build TrendChart component showing block counts over time
- [x] Add time range selector (24h, 7d, 30d, all)
- [x] Integrate into dashboard layout (above Port Statistics)

### Test & Deliver
- [x] Write vitest tests for ban/unban and history (12 tests)
- [x] Checkpoint and deliver (34 tests passing)

## Phase 11: Whitelist Management, Advanced Ban/Unban, Firewall Controls

### Backend — New tRPC Routes
- [x] skynet.whitelistIP — whitelist ip X "comment"
- [x] skynet.whitelistDomain — whitelist domain X "comment"
- [x] skynet.removeWhitelistIP / removeWhitelistDomain — whitelist remove ip/domain X
- [x] skynet.banRange — ban range X.X.X.X/CIDR "comment"
- [x] skynet.banDomain — ban domain example.com
- [x] skynet.banCountry — ban country CC CC ...
- [x] skynet.unbanRange — unban range X.X.X.X/CIDR
- [x] skynet.unbanDomain — unban domain example.com
- [x] skynet.unbanBulk — unban malware / nomanual / country / all
- [x] skynet.refreshWhitelist — whitelist refresh
- [x] Validation for CIDR ranges, domain names, and country codes

### Frontend — Firewall Management Page
- [x] Create /manage route with Firewall Management page
- [x] Add "Manage" tab to sidebar (between Connections and Settings, shortcut 5)
- [x] Whitelist section: add IP/domain to whitelist with comment + refresh shared whitelists
- [x] Ban section: ban IP/range/domain/country with comment
- [x] Unban section: unban IP/range/domain
- [x] Bulk Unban section: unban malware/non-manual/countries/all with confirmation
- [x] Remove from whitelist section
- [x] Command Reference documentation section
- [x] Warning banner about real-time command execution

### Tests
- [x] Write vitest tests for new ban/unban/whitelist commands (44 tests)
- [x] Verify all tests pass (78 total tests, 5 test files)

## Phase 12: Real-Time Syslog Viewer

### Research
- [x] Study Skynet syslog format from firewall.sh (iptables LOG prefixes, field extraction)
- [x] Identify log entry fields: timestamp, hostname, direction, IN/OUT interface, MAC, SRC/DST IP, LEN, TTL, PROTO, SPT/DPT, TCP flags

### Backend — Syslog Parser & Routes
- [x] Build syslog parser (skynet-syslog-parser.ts) with parseSyslogLine, parseSyslogLines, filterLogEntries, summarizeLogEntries
- [x] Add tRPC route: skynet.getLogs — fetches syslog via SystemCmd + cmdRet_check.htm, parses and filters
- [x] Support filtering by direction (INBOUND/OUTBOUND/INVALID/IOT/ALL), IP, port, protocol
- [x] Limit output to configurable maxLines (50-2000) via tail command
- [x] Auto-refresh support via tRPC refetchInterval on frontend

### Frontend — Logs Viewer Page
- [x] Create /logs route with Logs viewer page
- [x] Add "Logs" tab to sidebar navigation (shortcut 6)
- [x] Build log table with 8-column grid (Dir, Time, Source IP, Dest IP, Proto, Src Port, Dst Port, Details)
- [x] Add filter controls (direction dropdown, IP search, protocol dropdown, port input, max lines)
- [x] Add real-time auto-refresh toggle with configurable interval (5s/10s/30s/60s)
- [x] Color-code log entries by direction (orange=inbound, blue=outbound, red=invalid, yellow=IOT)
- [x] Add expandable row detail (interface, packet length, TTL, TCP flags, hostname, timestamp, service, line#)
- [x] Ultrawide-optimized 2-column layout (table + summary sidebar at 2xl breakpoint)
- [x] Summary sidebar: direction breakdown, unique IPs, time span, top source IPs, top targeted ports, protocol breakdown
- [x] Clickable summary items to auto-filter (click IP → filter by IP, click port → filter by port)
- [x] Keyboard shortcut: R to refresh
- [x] Well-known port → service name mapping (SSH, HTTP, HTTPS, RDP, etc.)

### Tests
- [x] Write vitest tests for syslog parser (48 tests covering parsing, filtering, summarizing)
- [x] Verify all tests pass (126 total tests, 6 test files)

## Phase 13: Ipset Browser, Log Export, GeoIP Enrichment

### Feature 1 — Active Ipset Browser
- [x] Research Skynet ipset commands (ipset save format, skynet.ipset file)
- [x] Build backend fetcher (fetchIpsetData) to retrieve ipset contents from router
- [x] Build parser (skynet-ipset-parser.ts) for ipset save format (IP, CIDR, timeout, comment, category)
- [x] Add tRPC routes: skynet.getBlacklist, skynet.getWhitelist with filtering
- [x] Create /ipsets page with tabbed view (Ban List / Whitelist)
- [x] Add search/filter: address search, category dropdown, comment search, type filter (IP/range/all)
- [x] Add entry count, limit to 2000 entries for performance
- [x] Add "Ipsets" tab to sidebar navigation (shortcut 7)
- [x] Ultrawide-optimized 2-column layout (table + summary sidebar)
- [x] Category-colored badges, unban/remove actions per entry
- [x] Summary sidebar: category breakdown, set breakdown, IP/range counts

### Feature 2 — Log Export (CSV/JSON)
- [x] Add CSV export function for filtered log entries (with GeoIP country)
- [x] Add JSON export function for filtered log entries (with full GeoIP data)
- [x] Add CSV/JSON export buttons to Logs page header
- [x] Include all visible columns plus GeoIP enrichment
- [x] Add CSV/JSON export buttons to Ipsets page header

### Feature 3 — GeoIP Enrichment
- [x] Research free GeoIP API (ip-api.com batch endpoint, 15 req/min, 100 IPs/batch)
- [x] Build server-side GeoIP resolver (geoip-resolver.ts) with 24h in-memory cache
- [x] Add tRPC route: skynet.resolveGeoIP for batch IP resolution
- [x] Add country code, country name, city, ISP, ASN to resolved IPs
- [x] Add flag emoji + country code column to log table
- [x] Add country column to ipset browser entries
- [x] Add GeoIP info to log entry detail expansion (country, city, ISP, ASN)
- [x] Private IP detection returns "Local Network" with house emoji

### Tests
- [x] Write vitest tests for ipset parser (parseIpsetLines, filterIpsetEntries, summarizeIpsetEntries)
- [x] Write vitest tests for GeoIP resolver (getFlagEmoji, getCacheSize)
- [x] Verify all tests pass (157 total tests, 7 test files)

## Phase 14: Over-the-Top GeoIP Threat Map

### Research & Design
- [x] Researched Norse, Kaspersky, Fortinet threat maps for visual inspiration
- [x] Chose react-globe.gl (Three.js wrapper) for 3D WebGL globe rendering
- [x] Designed cinematic HUD overlay with glass panels and cyan/dark theme

### 3D Globe Component
- [x] Built interactive 3D globe with react-globe.gl + Three.js
- [x] NASA Black Marble night texture with city lights + topology bump map
- [x] Blue atmosphere glow (atmosphereColor #1a6bff, altitude 0.2)
- [x] Smooth auto-rotation (0.4 speed) with damping, pause on interaction
- [x] Country labels for top 15 threat sources with severity coloring

### Attack Visualization
- [x] Animated dash arcs from attacker countries → target (US center) with severity-gradient colors
- [x] Arc stroke width and animation speed proportional to threat volume (sqrt scaling)
- [x] Pulsing concentric rings at attack origin locations (propagation speed scales with intensity)
- [x] Glowing point markers at all attack source locations
- [x] Target location has distinct cyan pulsing ring
- [x] Color-coded by severity: red=CRITICAL (3000+), orange=HIGH (1500+), gold=MEDIUM (500+), green=LOW
- [x] Arc altitude varies by intensity (0.1–0.5) for visual depth

### HUD Overlay & Stats
- [x] Left panel: Threat Overview — total blocks, source countries, severity breakdown, 4 mini KPI cards
- [x] Right panel: Top Threats leaderboard (top 12 countries) — clickable to fly globe to country
- [x] Bottom ticker: LIVE FEED with scrolling threat entries, severity badges, and legend
- [x] Top-left: Navigation (back arrow) + title with live/offline status indicator
- [x] Top-right: Reset view + fullscreen toggle controls
- [x] Cinematic scan line animation, subtle grid overlay, starfield gradient background
- [x] Arc hover tooltip showing country name and block count
- [x] HUD toggle button to show/hide all overlays for clean globe view

### Integration
- [x] Connected to useSkynetStats hook for country distribution data
- [x] Uses COUNTRY_CENTROIDS for lat/lon mapping (48 countries)
- [x] Data auto-refreshes with existing Skynet polling interval
- [x] Added to sidebar navigation as shortcut 3 (replaced scroll-to with dedicated /threatmap route)
- [x] Earth textures uploaded to CDN for production deployment

### Tests & Polish
- [x] All 157 existing tests still pass (no regressions)
- [x] 0 TypeScript errors, 0 console errors (only deprecation warning from Three.js Clock)
- [x] Full-screen layout — fills entire viewport with no scrolling
- [x] Responsive: HUD panels adapt, globe fills available space

## Phase 15: Notifications, Target Location, Historical Playback

### Pre-flight: Core Function Audit
- [x] Run full test suite — all 157 tests pass (7 files)
- [x] Verify 0 TypeScript errors
- [x] Audit all 28 existing tRPC routes intact (auth, config, stats, ban, unban, whitelist, logs, ipsets, geoip, testConnection)

### Feature 1 — Configurable Target Location
- [x] Add targetLat / targetLng fields to skynetConfig table in DB schema
- [x] Default to US center (37.09, -95.71) when not set
- [x] ThreatMap reads target location via trpc.skynet.getTargetLocation and uses for arc endpoints + target ring
- [x] Added "Router Location" section in Settings with lat/lng number inputs + Save Location button
- [x] Added getTargetLocation and saveTargetLocation tRPC routes

### Feature 2 — Notification Alerts
- [x] Added skynetAlerts table to DB schema (alertType, title, content, delivered, triggeredAt)
- [x] Added alert config fields to skynetConfig (alertsEnabled, blockSpikeEnabled, blockSpikeThreshold, newCountryEnabled, countryMinBlocks, newPortEnabled, cooldownMinutes)
- [x] Built server-side alert checker (skynet-alerts.ts) with baseline tracking and cooldown logic
- [x] Wired checkAlerts() into fetchStatsFromRouter — runs after every successful stats fetch
- [x] Triggers notifyOwner() for block spikes, new countries, and new ports
- [x] Added "Notification Alerts" section in Settings with toggle switches, threshold sliders, cooldown config
- [x] Added "Show Alert History" button and alert history display
- [x] Added getAlertConfig, saveAlertConfig, getAlertHistory tRPC routes

### Feature 3 — Historical Playback
- [x] Extended getHistory route to include countryData from history snapshots
- [x] Added countryData JSON column to statsHistory table
- [x] fetchStatsFromRouter now saves countryDistribution in history snapshots
- [x] Added timeline slider to ThreatMap with range input and tick marks
- [x] Globe data (arcs, rings, points, labels) updates based on selected snapshot
- [x] Playback controls: play/pause, skip-back, skip-forward, drag slider
- [x] Auto-advance at 2s intervals during playback
- [x] Timestamp overlay shows date, time, total blocks, and snapshot index
- [x] HISTORY/PLAYBACK toggle button in bottom timeline bar

### Tests & Regression
- [x] Wrote 11 tests for alert baseline initialization and state tracking (skynet-alerts.test.ts)
- [x] Run full regression — 168 tests pass across 8 test files
- [x] 0 TypeScript errors
- [x] 34 tRPC routes verified intact (up from 28 — 6 new routes added)
- [x] Only console warnings: Three.js Clock deprecation (harmless, from globe.gl dependency)

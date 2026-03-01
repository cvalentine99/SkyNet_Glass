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

## Phase 16: Bulk Ban Import from File

### Backend
- [x] Created bulkBanImport function in skynet-fetcher.ts — processes entries sequentially with 500ms delay
- [x] Client-side parser (parseImportText) validates IPv4, CIDR /8-/32, rejects reserved IPs, strips comments, deduplicates
- [x] Added tRPC route: skynet.bulkBanImport — accepts up to 500 entries, returns per-entry results
- [x] Returns total/succeeded/failed/skipped counts plus per-entry error details

### Frontend — Manage Page
- [x] Added "Bulk Ban Import" section at top of Manage page (before Ban section)
- [x] File upload dropzone with drag & drop + "Browse Files" button (.txt, .csv, .list, .conf, .log)
- [x] Paste-directly textarea as alternative input method
- [x] Live preview table with entry count, valid/invalid badges, type (IP/range) badges
- [x] Comment field for all entries in the import batch
- [x] Loading spinner during import with "Importing..." state
- [x] Results panel showing succeeded/failed counts with per-entry error details
- [x] Format help section explaining supported formats
- [x] Clear button to reset all state

### Tests
- [x] Wrote 34 vitest tests for bulk import parser (IPs, CIDR, comments, dedup, validation, realistic files)
- [x] All 202 tests pass across 9 test files
- [x] 0 TypeScript errors, 35 tRPC routes verified intact

## Phase 17: Connection Detail Drill-Down

### Frontend — LiveConnectionsTable Enhancement
- [x] Add expandable row to each connection entry (click to expand/collapse)
- [x] Show block details: direction, ban reason, /24 range, associated domains
- [x] Integrate GeoIP resolver for source IP enrichment (country, city, ISP, ASN, org, flag emoji, lat/lon)
- [x] One-click "Ban IP" button with confirmation dialog and toast
- [x] One-click "Whitelist IP" button with confirmation dialog and toast
- [x] One-click "Ban /24 Range" button (auto-derived from IP) with confirmation
- [x] Visual indicator for expanded state (chevron rotates 180° when expanded)
- [x] Smooth expand/collapse animation via framer-motion AnimatePresence
- [x] Copy IP to clipboard button with checkmark feedback
- [x] Link to Ipsets page with pre-filled search for the IP ("Check Ipsets" button)
- [x] AlienVault OTX external link in expanded detail panel
- [x] 4-panel detail grid: Location, Network (ISP/ASN/Org), Block Details, Associated Domains
- [x] Tab badge counts showing number of entries per direction
- [x] Expanded row resets when switching tabs
- [x] Updated subtitle: "click any row for details"

### Tests
- [x] All 202 existing tests pass (9 test files)
- [x] 0 TypeScript errors
- [x] 0 console errors

## Phase 18: DNS Sinkhole Log Viewer

### Research
- [x] Studied Skynet DNS sinkhole implementation — dnsmasq log-queries, config/NXDOMAIN/0.0.0.0 sinkhole patterns
- [x] Identified dnsmasq log format: query[TYPE] DOMAIN from CLIENT_IP, config DOMAIN is NXDOMAIN/0.0.0.0
- [x] Understood DHCP lease format for device name resolution: EPOCH MAC IP HOSTNAME CLIENT_ID

### Backend — DNS Sinkhole Parser & Routes
- [x] Built skynet-dns-parser.ts with parseDnsmasqLine, parseDnsmasqLines, extractSinkholedRequests, filterSinkholedRequests, summarizeSinkholedRequests
- [x] Built parseDhcpLeases for IP→device name mapping from dnsmasq.leases
- [x] Added tRPC routes: skynet.getDnsSinkhole (fetches dnsmasq log + DHCP leases, parses and filters)
- [x] Added tRPC route: skynet.getDevices (returns DHCP lease list for device dropdown)
- [x] Support filtering by device IP, domain substring, query type (A/AAAA/CNAME/PTR/MX/TXT)
- [x] Device-level aggregation: top offending devices with hostname + blocked count
- [x] Domain-level aggregation: top blocked domains with count
- [x] Query type breakdown in summary

### Frontend — DNS Sinkhole Page
- [x] Created /dns route with DNS Sinkhole viewer page
- [x] Added "DNS Sinkhole" tab to sidebar navigation (shortcut 8, Settings moved to 9)
- [x] Built sinkholed requests table with columns: TIME, DOMAIN, DEVICE, CLIENT IP, TYPE, RESPONSE
- [x] Filter controls: device dropdown (populated from DHCP leases), domain search, query type dropdown, max lines
- [x] Right sidebar: Sinkhole Summary (4 KPI cards), Top Blocked Domains, Top Offending Devices, Query Types
- [x] Clickable summary items to auto-filter (click device → filter by device, click domain → filter by domain)
- [x] Auto-refresh toggle with configurable interval (5s/10s/30s/60s)
- [x] CSV and JSON export buttons
- [x] Ultrawide-optimized 2-column layout (table + summary sidebar at 2xl breakpoint)
- [x] Color-coded response badges (red for NXDOMAIN, orange for 0.0.0.0)
- [x] Empty state with shield icon and helpful message

### Tests
- [x] Wrote 42 vitest tests for DNS parser (DHCP leases, line parsing, sinkhole extraction, filtering, summarization, realistic logs)
- [x] All 244 tests pass across 10 test files
- [x] 0 TypeScript errors, 0 console errors
- [x] 37 tRPC routes verified intact

## Phase 19: Per-Device Blocking Policies

### Research
- [x] Studied Skynet IOT commands: `firewall iot ban/unban IP`, `firewall iot view`, `firewall iot ports/proto`
- [x] Identified two blocking modes: IOT (block outbound, allow LAN) and full ban (Skynet-Blacklist)
- [x] IOT uses Skynet-IOT ipset + iptables FORWARD chain; full ban uses Skynet-Blacklist ipset

### Backend — DB Schema & tRPC Routes
- [x] Added devicePolicies table to DB schema (id, deviceIp, deviceName, macAddress, policyType enum, enabled, reason, createdAt, updatedAt)
- [x] Added tRPC route: skynet.getDevicePolicies — list all device policies from DB
- [x] Added tRPC route: skynet.createDevicePolicy — create policy + execute IOT ban or Skynet ban on router
- [x] Added tRPC route: skynet.removeDevicePolicy — remove policy + execute IOT unban or Skynet unban
- [x] Added tRPC route: skynet.toggleDevicePolicy — enable/disable with router command execution
- [x] Added tRPC routes: skynet.iotSetPorts, skynet.iotSetProto — configure IOT allowed ports/protocols
- [x] Added fetchIotBan, fetchIotUnban, fetchIotView, fetchIotSetPorts, fetchIotSetProto to skynet-fetcher.ts
- [x] All commands execute real Skynet firewall commands: `firewall iot ban/unban`, `firewall ban`

### Frontend — Device Policies Page
- [x] Created /devices route with Device Policies management page
- [x] Added "Devices" tab to sidebar navigation (shortcut 9, Settings moved to 0)
- [x] Policy table with device name, IP, MAC, policy type, status badge, reason, created date, actions
- [x] Add new policy form with IP input, device name, MAC, policy type dropdown, reason field
- [x] Toggle enable/disable per policy with confirmation
- [x] Delete policy with confirmation dialog
- [x] IOT Configuration section: set allowed ports and protocol for IOT-blocked devices
- [x] Search/filter across all policy fields
- [x] 4 KPI stat cards: Total, Enabled, Block Outbound, Full Block
- [x] Info section explaining how IOT blocking and full blocking work
- [x] URL query param pre-fill: navigating to /devices?ip=X&name=Y auto-opens the add form

### Quick Actions from Other Pages
- [x] Added "Block Device" button to DNS Sinkhole expanded row Quick Actions → links to /devices?ip=X&name=Y
- [x] Added "Block Device" button to Connections table expanded detail → links to /devices?ip=X
- [x] Both buttons navigate to Device Policies page with pre-filled IP and auto-opened add form

### Tests
- [x] All 244 existing tests pass across 10 test files (no regressions)
- [x] 0 TypeScript errors
- [x] 43 tRPC routes verified intact (up from 37 — 6 new device policy routes)

## Phase 20: Network Topology Map & Config Export/Backup

### Feature 1 — Network Topology Map
- [x] Research interactive graph/network visualization approach (Canvas/SVG) — chose HTML5 Canvas with spring physics
- [x] Build backend route: skynet.getTopology — aggregates DHCP leases + device policies + DNS activity
- [x] Create /topology route with interactive network diagram
- [x] Show router as central hub node with LAN devices radiating outward in concentric rings
- [x] Color-code devices by blocking status (green=normal, amber=IOT-blocked, red=fully blocked, cyan=DNS active)
- [x] Show device details on hover (tooltip) and click (detail panel with IP, hostname, MAC, policy, DNS hits)
- [x] Add "Topology" tab to sidebar navigation (Cpu icon)
- [x] Ultrawide-optimized layout with 2-column grid (canvas + detail/list panel)
- [x] Animated connection lines between router and devices with data packet dots
- [x] Spring physics for smooth node positioning, glow effects, pulsing router hub
- [x] Search and status filter controls overlaid on canvas
- [x] Quick action buttons: Manage Device Policy, View DNS Activity
- [x] Device list panel with status indicators and DNS hit badges

### Feature 2 — Configuration Export/Backup/Restore
- [x] Build backend route: skynet.exportConfig — exports router config, alert settings, device policies as JSON
- [x] Build backend route: skynet.importConfig — imports/restores from JSON backup with dedup
- [x] Add Export/Import section to Settings page (ConfigBackupSection component)
- [x] Export button downloads a timestamped JSON file (skynet-glass-backup-YYYY-MM-DDTHH-MM-SS.json)
- [x] Import with file upload, preview changes (file info, sections included, policy count), and confirm before applying
- [x] Include validation for imported config format (version check, structure validation)
- [x] Warning banner about overwrite behavior, skip duplicate device policies

### Tests
- [x] Write 34 vitest tests for topology parsing, node status, aggregation, export structure, import validation, dedup, and round-trip
- [x] All 278 tests pass across 11 test files, 0 TypeScript errors

## Phase 21: Bare Metal Deployment Guide (Ubuntu 24 LTS)

- [x] Audit project build process, runtime deps, env vars, database requirements
- [x] Test production build locally (builds cleanly: dist/index.js + dist/public/)
- [x] Write comprehensive deployment guide with step-by-step instructions
- [x] Include systemd service file, Nginx reverse proxy config, SSL setup
- [x] Include LAN-only mode (no auth), firewall, backup strategy, troubleshooting
- [ ] Deliver guide to user

## Phase 22: LAN-Only Auth Bypass + GitHub Push

- [x] Bypass Manus OAuth in server context — always return local admin user
- [x] Disable OAuth callback routes gracefully (redirect to /)
- [x] Update frontend to skip OAuth login redirect (main.tsx cleaned)
- [x] Remove/disable login button and OAuth portal references (const.ts, useAuth.ts)
- [x] Update frontend useAuth hook for LAN-only mode
- [x] Write 9 tests verifying LAN-only auth bypass (287 total pass)
- [x] Rebuild production bundle (builds cleanly)
- [x] Push to connected GitHub repo (cvalentine99/SkyNet_Glass)

## Phase 23: Slim .env — Remove Unused OAuth/Forge Variables

- [x] Slim env.ts — documented required vs optional vs deprecated vars
- [x] Kept forgeApiUrl/Key as optional (notifications still work if set)
- [x] Rewrote DEPLOY-BAREMETAL.md — LAN-only is now the default, only 4 env vars shown
- [x] Created ENV-REFERENCE.md with full variable reference table
- [x] All 287 tests pass, production build clean
- [x] Push to GitHub (cvalentine99/SkyNet_Glass)

## Phase 24: Change Default Port from 3000 to 3006

- [x] Update server/_core/index.ts default port (3000 → 3006)
- [x] Update server/index.ts default port (3000 → 3006)
- [x] Update DEPLOY-BAREMETAL.md (all 7 references)
- [x] Update ENV-REFERENCE.md
- [x] Push to GitHub

## Phase 25: Deployment Guide Rewrite (Post-Deploy Feedback)

- [x] Fix pnpm approve-builds — added non-interactive workaround + .npmrc fallback
- [x] Replace MySQL heredoc with one-line-at-a-time approach in sudo mysql session
- [x] Restructure guide: "Who Runs What" table, every section labeled (requires sudo) or (no sudo needed)
- [x] Reorder: migrations now Step 4a, smoke test is 4d, tables verified before server starts
- [x] Improve troubleshooting: numbered diagnostic order, #1 is "tables exist", not connection
- [x] Add pre-flight checklist (4c) — .env, build, tables, port all verified before smoke test
- [x] Added MySQL "Access denied" section: verify basics before trying ALTER USER
- [x] Push to GitHub

## Phase 26: Fix Skynet stats.js Parser — Invalid File Format

- [x] Downloaded Skynet firewall.sh, reverse-engineered WriteStats_ToJS and WriteData_ToJS
- [x] Root cause: extractArray regex used 's' (dotall) flag — on empty .unshift(''), it matched across newlines capturing garbage
- [x] Fixed extractArray: removed 's' flag (unshift is always single-line), changed (.+?) to (.*?) for empty strings
- [x] Added validateStatsJs() with specific errors: empty, HTML login page, JSON, random JS, missing KPIs
- [x] Integrated validation into fetchStatsFromRouter and testConnection routes
- [x] Rewrote skynet-parser.test.ts with realistic tab-indented format from firewall.sh (26 tests)
- [x] All 300 tests pass across 12 test files, 0 TypeScript errors
- [x] Push to GitHub

## Phase 27: Fix Router Auth — Replace HTTP Basic Auth with ASUS Merlin Form Login

- [ ] Research ASUS Merlin login.cgi auth flow (form POST, asus_token cookie, session management)
- [ ] Rewrite buildAuthHeaders → proper form login with session token caching
- [ ] Update all router command functions (ban, unban, whitelist, genstats, syslog, ipset, DHCP) to use session token
- [ ] Handle session expiry and automatic re-login
- [ ] Update testConnection to use form-based auth
- [ ] Update Settings UI if needed (remove Basic Auth references)
- [ ] Write tests for new auth flow
- [ ] Push to GitHub

## Phase 27: Rewrite Router Communication — HTTP → SSH

### Audit & Plan
- [ ] Audit all HTTP router touchpoints (fetcher, commands, syslog, ipset, DHCP)
- [ ] Map each HTTP call to its SSH equivalent

### SSH Client Module
- [ ] Install ssh2 npm package for Node.js SSH support
- [ ] Create server/skynet-ssh.ts with connection pooling, password auth, key auth
- [ ] Handle connection errors, timeouts, and reconnection gracefully

### Rewrite Fetcher
- [ ] stats.js: cat /tmp/var/wwwext/skynet/stats.js (replaces HTTP GET)
- [ ] Skynet commands (ban/unban/whitelist): run via SSH instead of start_apply.htm POST
- [ ] Syslog: cat/tail syslog files via SSH instead of SystemCmd + cmdRet_check.htm
- [ ] Ipset: ipset save via SSH instead of HTTP
- [ ] DHCP leases: cat /var/lib/misc/dnsmasq.leases via SSH
- [ ] DNS log: cat /opt/var/log/dnsmasq.log via SSH
- [ ] Genstats trigger: run firewall command via SSH instead of start_apply.htm

### Settings UI Update
- [x] Remove HTTP-specific fields (statsPath, routerPort, routerProtocol)
- [x] Add SSH port field (default 22)
- [x] Update testConnection to use SSH
- [x] Keep username/password fields (same credentials for SSH)

### Tests & Deploy
- [x] Write tests for SSH module (skynet-auth.test.ts rewritten for SSH)
- [x] All 297 tests pass across 12 test files
- [ ] Checkpoint and push to GitHub

## Phase 28: Fix All Broken Routes After SSH Rewrite
- [x] Audit all imports/exports between routers.ts and skynet-fetcher.ts — all 25 match
- [x] Fixed stale banCountry runtime error (cached module, resolved by restart)
- [x] Updated stale HTTP references: Manage.tsx command reference, routers.ts comments (apply.cgi → SSH)
- [x] Replaced skynet-auth.test.ts: old HTTP Basic Auth tests → SSH auth tests
- [x] Restarted server — 0 runtime errors
- [x] Full test suite: 297 tests pass across 12 files
- [x] Production build: clean (118KB dist/index.js)
- [x] Browser verified: Dashboard, Settings (SSH form), Topology, Manage all render correctly
- [ ] Push to GitHub

## Phase 29: Fix Broken Route Wiring (banDomain, banCountry, unbanDomain)
- [x] Bug 1: banDomain now calls `/jffs/scripts/firewall ban domain` (was calling whitelistDomain)
- [x] Bug 2: banCountry now calls `/jffs/scripts/firewall ban country XX` (was passing fake CIDR to banRange)
- [x] Added banDomain, unbanDomain, banCountry, unbanBulk to skynet-fetcher.ts
- [x] Fixed unbanDomain route (was calling removeWhitelistDomain, now calls unbanDomain)
- [x] Fixed unbanBulk route (was inline SSH, now uses exported unbanBulk function)
- [x] All 297 tests pass, production build clean (118KB)
- [ ] Push to GitHub

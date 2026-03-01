# Screenshot Notes 7 — After Accuracy Fixes

## Observations:
1. **Blocked Connections chart** — Now shows honest bar chart with Inbound (45,832) vs Outbound (2,156) totals. Has percentage breakdown (96% / 4%) and total count (47,988). Includes italic disclaimer "Totals from stats.js — Skynet does not provide hourly/daily breakdown data". FIXED.

2. **Port Hit Distribution** — Title changed from "Attack Types" to "Port Hit Distribution", subtitle says "Inbound blocks grouped by target service". BUT the legend still shows the OLD sample data labels: "Telnet Exploit", "SSH Brute Force", "Port Scan", "SMB Exploit", "HTTP Flood", "Other". This means the sample data in lib/data.ts still has the old attack-type labels. Need to fix the sample data to use honest service names.

3. **KPI cards** — All rendering correctly with sample data.

## Issue to fix:
- The sample data `connectionTypes` in lib/data.ts still uses fabricated attack labels. Need to update them to honest service names like "SSH", "Telnet", "HTTP", etc.

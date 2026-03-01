# E2E Test Notes

## Viewport 1 — Top of Dashboard (No Router Connected)

### Observations:
1. **BUG: KPI cards are NOT visible** — the screenshot shows the "No Router Connected" banner and then a huge empty dark area. The 8 KPI cards should be visible below the banner but they're not rendering visually (though the markdown extraction shows them). Possible CSS issue — cards may be transparent/invisible against the dark background.
2. **BUG: The entire middle section is a massive dark void** — the Blocked Connections chart, Port Hit Distribution, and other components are not visible in the screenshot. Only the "No Router Connected" banner and the Block Trends time range buttons (11-14) are visible at the bottom right.
3. The sidebar looks correct — 5 items with keyboard shortcut labels (1-5), plus Export Data (E) and expand button.
4. The "Update Stats" button (9) is visible in the top right.
5. The Settings link (10) in the banner works.
6. The Block Trends time range buttons (24h, 7 Days, 30 Days, All) are visible.

### Critical Issue:
The dashboard appears mostly blank/invisible when no data is present. The empty state components may have visibility issues or the glass cards are too transparent against the background.

## Viewport 2 — Middle Section
- Port Statistics panel visible with Inbound/Source tabs and H/V toggle buttons
- Threat Origins panel visible but empty
- Top Blocks by IP with 4 tabs (Inbound/Outbound/Devices/HTTP(S)) — good empty state message
- Recent Blocked Connections table with proper column headers (IP ADDRESS, COUNTRY, BAN REASON, DOMAINS, INTEL, ACTION)
- All empty states show "connect your router" messaging — consistent

## Viewport 3 — Bottom Section
- Global Threat Map panel with "No Threat Data" empty state and map pin icon — looks good
- Threat Intelligence table with Ban IP button, search bar, sortable SEVERITY and HITS columns
- Footer: "Skynet Firewall Statistics Dashboard v1.0.0 — Obsidian Glass"
- All sections render correctly with proper empty states

## Bugs Found:
1. **VISUAL BUG**: First viewport shows massive dark void — KPI cards and charts are barely visible. The glass cards may be too transparent or the content is rendering below the fold incorrectly.
2. **LAYOUT**: The "No Router Connected" banner takes up too much vertical space, pushing KPI cards off-screen.
3. **NIT**: The Block Trends time range buttons appear floating in the void without clear association to the chart.

## What Works Well:
- All empty states are consistent and helpful
- Sidebar scroll-spy and keyboard shortcuts visible
- Tab controls for all multi-view components
- Ban IP button and search in Threat Intelligence
- Sortable columns in Threat Intelligence table

## Settings Page E2E
- All form fields render correctly
- Default values pre-populated: HTTPS, 192.168.50.1, 8443, /user/skynet/stats.js, admin
- Password field with show/hide toggle (24)
- Auto-Polling toggle (26) and interval slider (28) showing "5m"
- Test Connection, Fetch Now, Regenerate Stats, Save Configuration buttons all present
- "How It Works" documentation section at bottom — good UX
- **BUG**: Settings page form fields are barely visible — the input borders and labels are very faint against the dark background. Hard to see where to type.
- **BUG**: The sidebar on Settings page only shows items 2-7 (no Dashboard icon at top), and the sidebar doesn't have the Skynet logo.
- **NIT**: "Polling Inactive" status badge visible at top — good indicator

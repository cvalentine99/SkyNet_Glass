# Skynet Glass — Design Brainstorm

The user has provided a detailed "Obsidian Glass" design specification. All three ideas below interpret that spec through different layout and interaction philosophies.

---

<response>
## Idea 1: "Command Bridge" — Military HUD Layout

<text>
**Design Movement**: Sci-fi military HUD meets luxury automotive cockpit (Porsche Taycan instrument cluster, F-35 HMD)

**Core Principles**:
1. Information density without clutter — every pixel earns its place
2. Peripheral awareness — critical alerts visible without direct focus
3. Asymmetric tension — left-heavy sidebar with right-expanding content panels
4. Monochrome discipline — black/slate canvas, gold is the ONLY color that speaks

**Color Philosophy**: True black (#0D0D0D) creates infinite depth. Gold (oklch 0.769 0.108 85.805) is reserved exclusively for actionable elements and critical data — never decorative. The severity palette (red→amber→green) provides the only other color, and only in data contexts.

**Layout Paradigm**: Fixed left sidebar (280px) with collapsible icon-only mode. Main content uses a "command grid" — a CSS grid with named areas that shift based on content priority. KPI cards span the top as a "status bar". Charts fill the center "viewport". Tables anchor the bottom as a "data feed". No centered layouts — everything aligns to a left baseline grid with 40px columns.

**Signature Elements**:
1. "Scan line" — a subtle horizontal gradient that sweeps across glass cards on hover, like a radar sweep
2. "Edge glow" — gold border-bottom on active sidebar items that pulses gently
3. "Grid overlay" — 40px grid pattern at 3% opacity on the background, like cockpit HUD gridlines

**Interaction Philosophy**: Hover reveals depth (shadow deepens, border brightens). Click triggers a brief "lock-on" animation (gold ring contracts). Transitions are fast (200ms) and mechanical — no bounce, no spring.

**Animation**: Staggered card entrance from left-to-right with 50ms delay between cards. Charts draw their data lines progressively. KPI numbers count up from 0 with easing. Critical alerts pulse with a red glow ring (2s infinite). Page transitions slide content horizontally.

**Typography System**: 
- Display: Inter 700 for page titles, with gradient-text (white→gold)
- Body: Inter 400 for all content, letter-spacing: -0.01em
- Mono: JetBrains Mono 500 for IPs, ports, hashes
- All numeric displays use tabular-nums
</text>

<probability>0.08</probability>
</response>

---

<response>
## Idea 2: "Obsidian Monolith" — Vertical Scroll Narrative

<text>
**Design Movement**: Brutalist luxury — inspired by Dieter Rams' "less but better" meets dark mode Bloomberg Terminal

**Core Principles**:
1. Vertical rhythm — content flows as a single scrollable narrative, not a grid of widgets
2. Breathing room — generous vertical spacing (64px between sections) creates gravitas
3. Full-bleed charts — visualizations span the entire viewport width for maximum data density
4. Progressive disclosure — sections collapse/expand, revealing depth on demand

**Color Philosophy**: Near-true-black (oklch 0.05 0 0) is the void. Glass cards float in it like monoliths. Gold appears only at interaction points — it's the "touch of Midas" that indicates where human action is possible. The severity palette is used sparingly and only in data contexts.

**Layout Paradigm**: No sidebar. Full-width single-column layout with a floating top navigation bar (glassmorphism, 80% opacity). Content sections are full-bleed glass panels stacked vertically. KPIs sit in a sticky header row. Charts use the full 1920px max-width. Tables have their own full-width sections with horizontal scroll for data density.

**Signature Elements**:
1. "Monolith cards" — tall, narrow glass panels with a single gold accent line on the left edge
2. "Depth layers" — three distinct z-levels of glass opacity (40%, 60%, 80%) creating parallax-like depth
3. "Gold thread" — a continuous 1px gold line running down the left margin, connecting all sections

**Interaction Philosophy**: Scroll-triggered reveals — sections fade in as they enter the viewport. Hover on cards lifts them (translateY -2px) and brightens the gold edge. Click expands sections with a smooth height animation.

**Animation**: Intersection Observer-driven entrance animations. Cards slide up 20px and fade in. Charts animate their data from left to right. Numbers count up with a slight overshoot. The gold thread grows downward as you scroll.

**Typography System**:
- Display: Inter 300 (light) at 48px for section titles — elegant and airy
- Body: Inter 400 at 14px, line-height 1.6
- Mono: JetBrains Mono 400 for all data values
- Section labels: Inter 600 at 11px, letter-spacing: 0.1em, uppercase — like luxury watch dial text
</text>

<probability>0.05</probability>
</response>

---

<response>
## Idea 3: "Glass Cockpit" — Multi-Panel Dashboard with Floating Panels

<text>
**Design Movement**: Aviation glass cockpit meets Porsche 992 digital instrument cluster — information-dense but supremely legible

**Core Principles**:
1. Panel-based composition — each data domain lives in its own glass panel, freely arranged
2. Hierarchy through luminance — more important panels are slightly brighter glass, less important are darker
3. Edge-to-edge data — minimize chrome, maximize data surface area
4. Contextual density — panels show summary by default, expand to full detail on interaction

**Color Philosophy**: The background is a void (oklch 0.05 0 0). Glass panels have varying opacity (30%-60%) creating a natural depth hierarchy. Gold is the "instrument needle" — it points to what matters. Critical severity red pulses like a warning light. The chart palette (gold→cyan→green→amber→red) is carefully sequenced for maximum distinguishability on dark backgrounds.

**Layout Paradigm**: Compact sidebar (64px icons, expandable to 240px with labels) on the left. Main area uses a responsive CSS grid: 3 columns on ultrawide (>1600px), 2 columns on desktop, 1 on mobile. KPI cards form a 4-column row at the top. Below, charts and tables are arranged in a masonry-like grid where each panel can span 1 or 2 columns. Max-width 1920px for ultrawide optimization.

**Signature Elements**:
1. "Instrument bezels" — glass cards have a subtle inner shadow and top-edge shine that mimics physical instrument bezels
2. "Status indicators" — small colored dots (green/amber/red) in card headers showing data freshness
3. "Floating action bar" — a glassmorphism toolbar at the bottom with quick actions (refresh, export, filter)

**Interaction Philosophy**: Panels respond to hover with edge illumination (gold border glow). Double-click expands a panel to full-screen overlay. Drag-to-reorder panels (future feature). Right-click context menus for chart options. Everything feels tactile — like touching real glass instruments.

**Animation**: Cards enter with a staggered scale-up (0.95→1.0) and fade. Charts use progressive line drawing. KPI numbers use spring physics for counting. Hover transitions are 150ms with cubic-bezier(0.4, 0, 0.2, 1). Panel expand/collapse uses layout animation. Critical alerts have a breathing red glow.

**Typography System**:
- Display: Inter 600 at 28px for panel titles
- Body: Inter 400 at 13px — slightly smaller for density
- Mono: JetBrains Mono 500 at 13px for all data
- KPI numbers: Inter 700 at 36px with tabular-nums
- Labels: Inter 500 at 11px, uppercase, letter-spacing 0.05em
</text>

<probability>0.07</probability>
</response>

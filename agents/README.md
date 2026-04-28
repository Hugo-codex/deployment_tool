# WTC Deployment Tool — Project Agents

Complete agent suite for the WTC 40k deployment planning app. Designed to slot alongside the general-purpose agents in `/nest/`.

---

## Agent Overview

```
wtc-agents/
├── list-parser-agent.md         # Raw export ingestion (GW App, War Organ, New Recruit)
├── name-resolver-agent.md       # Fuzzy match unit names → WTC base doc
├── army-builder-agent.md        # Build canvas-ready unit manifest from resolved roster
├── map-terrain-agent.md         # Board canvas, terrain coordinates, deployment zones
├── rules-agent.md               # Rules rulings, LOS, movement, terrain interactions
├── layout-validator-agent.md    # Pre-game validation, illegal placement detection
└── measurement-overlay-agent.md # Rulers, range arcs, threat ranges, pinned markers
```

---

## Agent Responsibilities

| Agent | Owns | Reads From | Writes To |
|-------|------|-----------|-----------|
| **List Parser** | Raw export normalization | GW App / War Organ / New Recruit export | `parsed_roster.json` |
| **Name Resolver** | Fuzzy name matching, WTC doc lookup | `parsed_roster.json` + WTC base size doc | `resolved_roster.json` |
| **Army Builder** | Canvas unit manifest, base sizes, labels | `resolved_roster.json` + deployment zones | `unit_manifest_p1.json`, `unit_manifest_p2.json` |
| **Map & Terrain** | Board state, terrain positions, zones | WTC Map Pack v2.4 coordinates (embedded) | `board_state.json` |
| **Rules** | Rule rulings, terrain interactions | Board state + unit manifests (context) | `rulings.json` |
| **Layout Validator** | Validation report, fix instructions | `board_state.json` + both unit manifests | `validation_report.json` |
| **Measurement Overlay** | Rulers, arcs, threat ranges, markers | `board_state.json` + unit manifests | `overlay_state.json` |

---

## Full Orchestration Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 1 — LIST INGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  USER pastes / uploads list from GW App, War Organ, or New Recruit
        ↓
  LIST PARSER AGENT
    → Auto-detects format
    → Strips wargear, points, keywords
    → Normalizes unit names + counts
    → Outputs: parsed_roster.json
        ↓
  NAME RESOLVER AGENT
    → Fuzzy matches each unit → WTC base size doc
    → Scores confidence per match (Exact / Contains / Token / Fuzzy)
    → Flags needs_review and unresolved units
    → Surfaces ambiguous matches to USER for confirmation
        ↓
  [USER confirms or manually enters base sizes for flagged units]
        ↓
  NAME RESOLVER AGENT (finalized)
    → Outputs: resolved_roster.json (all units have base size or explicit null)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 2 — BOARD SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  USER selects deployment type + map number
        ↓
  MAP & TERRAIN AGENT                    ARMY BUILDER AGENT (x2, parallel)
    → Loads WTC v2.4 coordinates           → Reads resolved_roster.json
    → Places terrain + objectives          → Generates canvas-ready unit bases
    → Draws deployment zones               → Labels, sizes, initial positions
    → Outputs: board_state.json            → Outputs: unit_manifest_p1.json
                                                       unit_manifest_p2.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 3 — DEPLOYMENT PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [USER drags units into position on canvas]
        ↓
  MEASUREMENT OVERLAY AGENT (on-demand, continuous)
    → Live ruler tool (drag-to-measure)
    → Range arcs from unit base edges (move, shoot, charge, scout, aura...)
    → Threat range mode (move + shoot combined arc)
    → Concentric rings or toggleable layers
    → Pin markers with labels + colors
    → Outputs: overlay_state.json (updated continuously)
        ↓
  RULES AGENT (on-demand)
    → User asks rules questions during planning
    → Returns ruling + authority + confidence
    → Outputs: rulings.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 4 — VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [USER signals ready to validate]
        ↓
  LAYOUT VALIDATOR AGENT
    → Reads board_state.json + both unit manifests
    → Runs 18 checks across 4 groups (terrain / deployment / coherency / objectives)
    → Outputs: validation_report.json
        ↓
  [USER reviews report, fixes flagged issues, re-validates if needed]
        ↓
  legal_to_play: true → GAME BEGINS
```

---

## State Files — Quick Reference

```
parsed_roster.json        Normalized unit list from raw export (no base sizes yet)
resolved_roster.json      Unit list with WTC base sizes + match confidence scores
unit_manifest_p1.json     P1 canvas-ready units: bases, labels, positions
unit_manifest_p2.json     P2 canvas-ready units: bases, labels, positions
board_state.json          Terrain, objectives, deployment zones, map metadata
rulings.json              Stack of rules queries and rulings (append-only)
overlay_state.json        All active rulers, arcs, threat ranges, pinned markers
validation_report.json    Pre-game check results + fix instructions
```

---

## Measurement Overlay — Range Color Reference

```
MOVE          #4A90D9  Blue
ADVANCE       #7BB3E8  Light Blue
SCOUT         #50C878  Emerald
CHARGE        #E84040  Red
ENGAGEMENT    #C83030  Dark Red
SHOOT         #FFD700  Yellow
RAPID FIRE    #E8A838  Amber
THREAT        #9B30E8  Purple   (combined move + shoot)
AURA          #30E8B0  Teal
DEEP STRIKE   #FF6B35  Orange   (exclusion zone)
CUSTOM        user-defined
```

---

## Data Sources

| Data | Source | Version |
|------|--------|---------|
| Terrain coordinates | WTC Map Pack Lite | 2026 v2.4 (embedded in Map & Terrain Agent) |
| Base sizes | WTC Basisize Document | 2024 v1.3 (external file, provide path) |
| Deployment rules | 10th Edition core + WTC event rules | Current 2026 |
| Terrain dimensions | WTC Map Pack — Terrain Index | 2026 v2.4 |
| List formats | GW App, War Organ, New Recruit | Current as of 2026 |

---

## Integration Notes for the Nest

- Phases 1 and 2 run once per game setup — Phases 3 and 4 are continuous/repeated
- List Parser + Name Resolver can run independently of the board — useful for army prep before the map is decided
- Measurement Overlay is the only agent that runs continuously during Phase 3 — treat as real-time UI state, not batch processor
- Rules Agent is fully stateless — call at any point in any phase
- Layout Validator can run multiple times — each run overwrites validation_report.json
- All agents use inches internally; pixel conversion via canvas_scale (default: 20 px/inch for 1200x880px canvas)

---

## Architecture & Build Constraints

### No Backend — Fully Local
This app runs entirely in the browser. No server, no API calls, no database.
All state (lists, board, overlay, manifests) lives in `localStorage` using the same
pattern established in the Brush Rush project. Agents that reference "output_path"
and "state files" are logical concepts — at build time these map directly to
named `localStorage` keys.

```
localStorage key map:
  wtc_lists                   → all saved army lists (array)
  wtc_active_list_p1          → currently loaded P1 list
  wtc_active_list_p2          → currently loaded P2 list
  wtc_board_state             → current board state
  wtc_overlay_state           → measurement overlay markers + layers
  wtc_validation_report       → last validation run result
  wtc_rulings                 → rulings log (append-only)
  wtc_settings                → user preferences (scale, display mode, theme)
```

### Netlify Ready
- Pure static build — no serverless functions required
- `netlify.toml` at root with standard SPA redirect rule (`/* → /index.html 200`)
- All assets bundled at build time — no runtime fetches except optional WTC doc load
- Deploy via Git push, same workflow as Brush Rush

### Tailwind CSS
- Reuse the Brush Rush theme tokens directly: colors, spacing scale, typography, border radius
- Reuse Brush Rush component patterns: cards, modals, sidebars, icon buttons, toasts
- Dark theme first — canvas-heavy tools read better on dark backgrounds
- Tailwind config extended with WTC range colors as named tokens:

```js
// tailwind.config.js additions
colors: {
  'wtc-move':       '#4A90D9',
  'wtc-scout':      '#50C878',
  'wtc-charge':     '#E84040',
  'wtc-shoot':      '#FFD700',
  'wtc-threat':     '#9B30E8',
  'wtc-aura':       '#30E8B0',
  'wtc-deepstrike': '#FF6B35',
  'wtc-advance':    '#7BB3E8',
  'wtc-engage':     '#C83030',
  'wtc-custom':     '#FFFFFF',
}
```

### Army List Persistence — Multiple Lists
Lists are saved and reloaded across sessions, same pattern as Brush Rush save slots.

```
List object schema (stored in wtc_lists array):
{
  id:           uuid,
  name:         string,         // user-defined e.g. "Ultramarines GT List"
  faction:      string,
  created_at:   ISO timestamp,
  updated_at:   ISO timestamp,
  raw_export:   string,         // original pasted text preserved for re-parsing
  resolved:     unit[],         // fully resolved unit manifest
  wtc_doc_ver:  string          // base doc version used at resolution time
}
```

- No limit on number of saved lists
- Lists are selectable from a list manager panel (same UX as Brush Rush brush/palette manager)
- A list can be loaded as P1 or P2 independently
- Same list can be loaded for both players (mirror match practice)
- Lists persist across browser sessions via localStorage
- Export list as JSON file for backup / sharing with teammates
- Import list JSON file to restore on any device

---

## Known Gaps / Future Expansion

- [ ] Scout move simulation (interactive post-deployment repositioning)
- [ ] Infiltrator placement phase (separate from main deployment)
- [ ] Mission card / secondary objective overlay
- [ ] Export full board snapshot to image / PDF
- [ ] WTC base doc auto-sync when new version released
- [ ] Multi-map randomizer for match setup
- [ ] Overlay snapshot save/load per game turn
- [ ] Aura stacking visualization (multiple characters)
- [ ] Deep Strike exclusion zone per unit (not just 9" blanket)

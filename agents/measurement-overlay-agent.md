# Measurement Overlay Agent

Manage all ruler tools, range arcs, threat radius calculations, and persistent measurement markers on the board canvas. Let players visualize move, shoot, charge, scout, and aura ranges directly from unit bases.

## Role

This agent owns the **entire measurement layer** of the canvas — everything drawn on top of the board that is not a terrain piece or unit base. It handles live rulers, pinned markers, range arcs from unit bases, combined threat range calculations, and the display mode (concentric rings vs toggleable layers). It is a pure UI state manager — it reads unit and board data but never modifies them.

---

## Inputs

- **trigger**: `"ruler_draw"` | `"arc_add"` | `"threat_calc"` | `"marker_pin"` | `"marker_remove"` | `"layer_toggle"` | `"clear_all"` | `"export_overlay"`
- **board_state_path**: Path to current board state JSON (for scale reference)
- **unit_manifest_path**: Optional — path to unit manifest for unit-linked arcs
- **overlay_state_path**: Path to current overlay state JSON (read + write — persists between interactions)
- **params**: Trigger-specific parameters (see per-trigger spec below)
- **output_path**: Where to write updated overlay state JSON

---

## Range Type Registry

All built-in range types with default colors and labels:

```
MOVEMENT RANGES:
  move:           color #4A90D9  (blue)       label "MOVE"       default: unit's Move stat (inches)
  advance:        color #7BB3E8  (light blue) label "ADV"        default: Move + D6 (show Move+6 max)
  scout:          color #50C878  (emerald)    label "SCOUT"      default: 6"
  fallback:       color #B0C4DE  (steel blue) label "FALL"       default: Move"

SHOOTING RANGES:
  rapid_fire:     color #E8A838  (amber)      label "RF"         user-defined inches
  assault:        color #F0C060  (gold)       label "ASLT"       user-defined inches
  heavy:          color #D4883A  (dark amber) label "HVY"        user-defined inches
  pistol:         color #E8C878  (pale gold)  label "PSTL"       user-defined inches
  shoot_generic:  color #FFD700  (yellow)     label "SHOOT"      user-defined inches

CHARGE & MELEE:
  charge:         color #E84040  (red)        label "CHRG"       default: 12"
  engagement:     color #C83030  (dark red)   label "ENG"        default: 1"
  consolidate:    color #E87070  (pale red)   label "CONS"       default: 3"

THREAT (COMBINED):
  threat:         color #9B30E8  (purple)     label "THREAT"     move + shoot range combined

AURAS & ABILITIES:
  aura_generic:   color #30E8B0  (teal)       label "AURA"       user-defined inches
  deep_strike:    color #FF6B35  (orange)     label "DS-EX"      default: 9" (exclusion zone)
  infiltrate:     color #FF9F60  (pale orange)label "INFIL"      user-defined inches

CUSTOM:
  custom:         color user-defined          label user-defined  user-defined inches
```

---

## Display Modes

### Mode A — Concentric Rings
All arcs for a given unit displayed simultaneously as nested rings on the canvas, always visible. Rings are semi-transparent fills with solid stroke. Outer rings do not obscure inner rings (z-order: smallest arc on top).

### Mode B — Toggleable Layers
Each range type is a named layer. Layers can be shown/hidden individually via a layer panel. Only active layers are rendered. Default: all layers hidden on load, user activates per need.

### Combined Mode
Both modes can coexist: some range types are always-on rings (e.g. move + charge), others are layer-toggled (e.g. aura, deep strike exclusion). User configures per range type which mode applies.

---

## Arc Rendering Spec

```
ARC ORIGIN:
  - Always from the EDGE of the unit base, not the center
  - For round bases: full 360° arc from base edge
  - For oval bases: full 360° arc from the edge of the oval perimeter
  - Arc radius = range in inches × canvas_scale (px/inch)

THREAT COMBINED ARC:
  - Inner ring = move range (from base edge)
  - Outer ring = move + shoot range (from base edge of inner ring)
  - Renders as two concentric arcs with a filled band between them
  - Label shows both values: "MOVE 6" + SHOOT 24" = 30" THREAT"

VISUAL STYLE:
  - Fill: range color at 15% opacity
  - Stroke: range color at 80% opacity, 2px width
  - Label: positioned at top of arc, same color, 11px sans-serif
  - When stacked: each ring's fill is additive (darker where ranges overlap)
  - Pinned markers: solid stroke 3px, fill 25% opacity, label always visible
  - Live ruler (drag): dashed stroke 2px, no fill, live measurement text floats at cursor
```

---

## Trigger Specifications

### `ruler_draw`
Live drag-to-measure ruler. No persistent state written until pinned.

```
params:
  start_x_px: number
  start_y_px: number
  end_x_px:   number
  end_y_px:   number
  color:       hex string | null (default: white #FFFFFF)
  label:       string | null

output: live measurement in inches (calculated from canvas_scale), not persisted
```

### `arc_add`
Add a range arc to a unit or a freestanding point on the canvas.

```
params:
  unit_id:       string | null (if null, uses anchor point)
  anchor_x_px:   number | null (used if unit_id is null)
  anchor_y_px:   number | null
  range_type:    string (from Range Type Registry or "custom")
  range_inches:  number (required for custom or shoot types; auto-filled for defaults)
  display_mode:  "ring" | "layer" | null (inherits global setting if null)
  color:         hex string | null (overrides default color if provided)
  label:         string | null (overrides default label if provided)
  show_label:    boolean (default: true)
  player:        1 | 2 | null
```

### `threat_calc`
Calculate and render combined move + shoot threat arc.

```
params:
  unit_id:        string (must be in unit manifest)
  move_inches:    number
  shoot_inches:   number
  include_advance: boolean (adds 6" to move range, shows as dotted outer band)
  color_override: hex string | null
  show_label:     boolean (default: true)
  player:         1 | 2 | null

output: renders inner arc (move) + outer arc (move+shoot) + optional advance band
label format: "MOVE {M}" + SHOOT {S}" = {M+S}" THREAT"
              optionally "+ ADV" if include_advance is true
```

### `marker_pin`
Pin the current ruler or arc as a permanent marker on the canvas.

```
params:
  marker_type:   "ruler" | "arc" | "arc_from_unit"
  color:         hex string
  label:         string | null
  show_label:    boolean (default: true)
  label_color:   hex string | null (defaults to marker color)
  start_x_px:    number (for ruler)
  start_y_px:    number (for ruler)
  end_x_px:      number (for ruler)
  end_y_px:      number (for ruler)
  unit_id:       string | null (for arc_from_unit)
  range_inches:  number (for arc)
  range_type:    string (from registry or "custom")
  player:        1 | 2 | null
```

### `marker_remove`
Remove one or all markers.

```
params:
  marker_id:  string | "all" | "all_player_1" | "all_player_2"
```

### `layer_toggle`
Show or hide a named range layer.

```
params:
  layer_name:  string (range_type from registry, or custom layer name)
  visible:     boolean
  scope:       "all" | "player_1" | "player_2"
```

### `clear_all`
Remove all overlay markers and reset layer visibility.

```
params:
  scope:  "all" | "player_1" | "player_2" | "arcs_only" | "rulers_only"
```

### `export_overlay`
Export current overlay state as a snapshot (for saving/sharing board state).

```
params:
  format:  "json" | "svg_layer"
output:  overlay state embedded in export file
```

---

## Overlay State Schema

The overlay state file persists all active markers between interactions:

```json
{
  "canvas_scale": 20,
  "display_mode": "combined",
  "active_layers": ["move", "charge", "shoot_generic"],
  "markers": [
    {
      "id": "marker_001",
      "type": "arc_from_unit",
      "range_type": "charge",
      "unit_id": "unit_003",
      "unit_base_edge_px": { "cx": 340, "cy": 220, "radius_px": 20 },
      "range_inches": 12,
      "range_px": 240,
      "color": "#E84040",
      "label": "CHRG 12\"",
      "show_label": true,
      "display_mode": "ring",
      "player": 1,
      "pinned": true,
      "created_at": "2026-04-27T00:00:00Z"
    },
    {
      "id": "marker_002",
      "type": "threat",
      "unit_id": "unit_003",
      "move_inches": 6,
      "shoot_inches": 24,
      "include_advance": false,
      "total_threat_inches": 30,
      "inner_range_px": 120,
      "outer_range_px": 600,
      "color": "#9B30E8",
      "label": "MOVE 6\" + SHOOT 24\" = 30\" THREAT",
      "show_label": true,
      "player": 1,
      "pinned": true
    },
    {
      "id": "marker_003",
      "type": "ruler",
      "start_x_px": 100,
      "start_y_px": 200,
      "end_x_px": 340,
      "end_y_px": 200,
      "length_inches": 12.0,
      "color": "#FFFFFF",
      "label": "12\"",
      "show_label": true,
      "player": null,
      "pinned": true
    }
  ],
  "layers": {
    "move":         { "visible": true,  "scope": "all" },
    "charge":       { "visible": true,  "scope": "all" },
    "shoot_generic":{ "visible": false, "scope": "all" },
    "deep_strike":  { "visible": true,  "scope": "player_2" }
  }
}
```

---

## Standard Range Defaults (10th Edition)

Used when a unit is linked but no override is provided:

```
MOVEMENT (from unit manifest if available, else these defaults):
  Infantry standard:    6"
  Infantry slow:        5"
  Cavalry / Bikes:      12"
  Vehicles:             10"–12"
  Fly keyword:          12"–20"

FIXED DEFAULTS (always use these):
  Scout move:           6"
  Charge:               12"
  Engagement range:     1"
  Consolidate:          3"
  Deep Strike exclusion:9"
  Rapid fire range:     always user-provided (weapon-specific)
```

---

## Interfaces With

- **Map & Terrain Agent** → reads `canvas_scale` and board dimensions for pixel/inch conversion
- **Army Builder Agent** → reads unit base sizes (for arc origin calculation) and unit positions
- Does NOT modify board state or unit manifests
- Does NOT interface with Rules Agent or Layout Validator directly

---

## Constraints

- **Arcs always originate from base edge**, never center — this is non-negotiable and must be enforced at render time
- **Never modify unit positions** — read-only access to unit manifest
- **Never auto-remove markers** — only remove on explicit `marker_remove` trigger
- Layer visibility is per-session — reset to defaults on `clear_all`
- Threat calc always shows both inner and outer rings — never collapse to a single arc
- Custom colors must be valid hex strings — reject invalid values and use range type default

---

## Error Handling

| Error | Response |
|-------|----------|
| Unit ID not found in manifest | Flag error, offer freestanding anchor point as fallback |
| Invalid range_inches (≤ 0) | Reject: "Range must be greater than 0 inches" |
| Invalid hex color | Use range type default color, log warning |
| Overlay state file missing | Initialize fresh empty overlay state |
| canvas_scale not set | Default to 20 (px/inch), log warning |
| Arc origin outside board bounds | Render arc clipped to board edge — do not abort |

---

## Build & Architecture Notes

### No Backend
Runs entirely in the browser. Overlay state is persisted to localStorage:
```
wtc_overlay_state    → all active markers, arcs, rulers, layer visibility
wtc_settings         → canvas_scale, display_mode, default color preferences
```
All rendering happens on an HTML5 Canvas or SVG layer sitting above the board canvas.
No server calls. No file system writes. State is written to localStorage on every
marker add, remove, or layer toggle — never batch-delayed.

### Netlify / Static Build
Pure canvas/SVG rendering logic — no server dependencies. Ships as part of the
static bundle exactly as Brush Rush does. No runtime API calls.

### Tailwind / Theme
The overlay UI panel (ruler tool, range type picker, layer toggles, color swatches)
reuses Brush Rush's floating toolbar and panel component patterns.

Range type color swatches are rendered using the named Tailwind tokens defined in
`tailwind.config.js` (`wtc-move`, `wtc-charge`, `wtc-threat` etc.) so they stay
consistent with any theme changes made at the config level.

Layer toggle buttons use Brush Rush's pill/chip toggle pattern:
- Active layer: filled background using range color token
- Inactive layer: outline only, muted text
- Hover: 20% opacity fill preview

### Display Mode Persistence
The user's chosen display mode (concentric rings / toggleable layers / combined)
is saved to `wtc_settings` in localStorage and restored on next session.
Per-range-type display mode overrides are also persisted alongside the global setting.

### Ruler Snap-to-Inch
Live ruler snaps to nearest 0.5" increment by default (configurable in settings).
Snap can be disabled by holding Shift during drag — same interaction pattern as
Brush Rush's grid snap toggle.

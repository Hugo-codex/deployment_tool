# Army Builder Agent

Parse army rosters, resolve WTC-legal base sizes for every unit, and produce a structured unit manifest ready for placement on the board canvas.

## Role

This agent turns a raw army list (text, CSV, or structured input) into a **canvas-ready unit manifest** — every unit gets its correct WTC base size, a display label, and initial placement metadata. It is the entry point for all player army data.

---

## Inputs

Parameters received at invocation:

- **roster_input**: Raw army list as string, or path to file (`.txt`, `.csv`, `.json`)
- **faction**: Faction name (e.g. `space_marines`, `necrons`, `chaos_daemons`) — used to scope base size lookup
- **player**: `1` | `2`
- **base_size_doc_path**: Optional path to WTC base size XLSX/CSV if locally available
- **output_path**: Where to write the resolved unit manifest JSON

---

## Data: WTC Standard Base Sizes

Common base sizes for reference. Always prefer the WTC base size document over these defaults if available.

```
ROUND BASES (diameter):
  25mm  — Infantry small (Guardsmen, Termagants, basic troops)
  28mm  — Some older sculpts
  28.5mm— Some Eldar/specialist infantry
  32mm  — Standard infantry (Space Marines, Necron Warriors, etc.)
  40mm  — Heavy infantry, bikes, small beasts
  50mm  — Large infantry, cavalry, dreadnought-class small
  60mm  — Large monsters, dreadnoughts
  80mm  — Very large models
  90mm  — Large vehicles/monsters
  100mm — Superheavy infantry scale
  130mm — Large superheavy
  160mm — Titan-class infantry scale
  170mm — Largest round

OVAL BASES (length × width):
  75×42mm    — Standard cavalry/bike oval
  90×52mm    — Large cavalry
  105×70mm   — Large oval (Carnifex, Leman Russ, etc.)
  120×92mm   — Very large oval (Land Raider scale)
  170×109mm  — Knight-scale oval
  110mm oval — Knight movement reference base

NOTE: Height restriction of 127mm applies to some 120×92mm oval models.
```

---

## Process

### Step 1: Parse Roster Input

Accept any of these formats:

**Plain text** (BattleScribe export style):
```
++ Space Marines [2000pts] ++
+ HQ +
Captain in Terminator Armour [100pts]
Marneus Calgar [150pts]

+ Troops +
Intercessor Squad [90pts] x5
  - Intercessors x4
  - Intercessor Sergeant x1
```

**Structured JSON**:
```json
{
  "faction": "Space Marines",
  "units": [
    { "name": "Captain in Terminator Armour", "count": 1 },
    { "name": "Intercessors", "count": 5 }
  ]
}
```

For each detected unit:
1. Extract unit name (normalize: trim whitespace, remove point costs, remove `x` multipliers)
2. Extract model count per unit
3. Tag unit type if detectable (HQ, Troops, Elites, etc.)

### Step 2: Resolve Base Sizes

For each unit:

1. **If `base_size_doc_path` provided**: Look up exact unit name in the WTC base size document. Use fuzzy match if exact name fails (e.g. `Intercessors` → `Intercessor Squad`).
2. **If no doc**: Use the faction + unit name to infer from the built-in defaults above.
3. **If ambiguous** (multiple valid sizes exist): Flag unit with `"size_ambiguous": true` and list options. Do not block — use the most common size as default.
4. **If completely unknown**: Flag `"size_unknown": true`, set `base_size` to `null`, request manual input.

### Step 3: Classify Base Shape

For each unit determine:

```
shape: "round" | "oval"
size_primary_mm: number (diameter for round, length for oval)
size_secondary_mm: number | null (width for oval, null for round)
```

### Step 4: Generate Display Labels

For each unit group, produce a short canvas label:

```
Rules:
- Max 20 characters
- Use abbreviations for long names: "Terminators" → "TERM", "Intercessors" → "INTER"
- Append count if >1 model in unit: "INTER ×5"
- Append player color tag: "[P1]" | "[P2]"
```

### Step 5: Assign Initial Placement Zone

Units start in their player's deployment zone. Produce a suggested starting position:

```
- Distribute units evenly across deployment zone width
- Stack multiple units vertically with 5px padding between bases
- Do not place outside deployment zone bounds
- Flag any unit whose base diameter exceeds deployment zone depth (edge case)
```

### Step 6: Write Unit Manifest

Save to `{output_path}`:

```json
{
  "player": 1,
  "faction": "Space Marines",
  "total_units": 8,
  "units": [
    {
      "id": "unit_001",
      "name": "Captain in Terminator Armour",
      "display_label": "CAPT-TERM [P1]",
      "model_count": 1,
      "unit_type": "HQ",
      "base": {
        "shape": "round",
        "size_primary_mm": 40,
        "size_secondary_mm": null,
        "wtc_verified": true,
        "size_ambiguous": false,
        "size_unknown": false
      },
      "placement": {
        "x_inches": 5.0,
        "y_inches": 3.0,
        "placed": false
      }
    }
  ],
  "warnings": [
    {
      "unit": "Custom Character",
      "message": "Base size unknown — defaulting to 32mm. Please verify."
    }
  ]
}
```

---

## Rules & Constraints

- **Never** assign a base size smaller than what the WTC doc specifies — if the player's model is on a larger base, that is allowed but the WTC minimum is the legal floor
- **Always** flag size conflicts between WTC doc and user-provided size — do not silently override
- Units with multiple base types within one unit (e.g. mixed squads) get the **largest** base size applied to all models for canvas display
- Knight-class units always get the 110mm oval regardless of what the player states, unless WTC doc explicitly differs
- Do not remove units from the manifest — flag issues and proceed

## Interfaces With

- **Map & Terrain Agent** → sends unit manifest; receives board dimensions and deployment zone bounds for initial placement calculation
- **Layout Validator Agent** → sends unit manifest for coherency and deployment legality checks
- **Rules Agent** → queries for unit-specific deployment rules (Scout moves, Deep Strike, Infiltrators, etc.)

---

## Error Handling

| Error | Response |
|-------|----------|
| Unrecognized roster format | Attempt best-effort parse, list assumptions made, ask for confirmation |
| Unit not found in WTC base doc | Flag `size_unknown`, use faction average as fallback, request manual input |
| Count mismatch (e.g. "5 models" vs squad rules) | Flag warning, use stated count |
| Duplicate unit names | Append `_a`, `_b` suffixes to IDs, preserve both |
| File not found at `base_size_doc_path` | Fall back to built-in defaults, log warning |

---

## Build & Architecture Notes

### No Backend
Runs entirely in the browser. Unit manifests are written to `localStorage`:
```
wtc_unit_manifest_p1    → Player 1 canvas-ready manifest
wtc_unit_manifest_p2    → Player 2 canvas-ready manifest
```
No server calls. No file system writes. All state is in-memory during a session
and persisted to localStorage on every meaningful change.

### Multiple Lists
The Army Builder works with whichever list is currently active per player.
Lists are selected from the List Manager panel — the same list can be loaded
for both players independently (useful for mirror match practice).

```
Active list flow:
  User opens List Manager → selects saved list → assigns to P1 or P2
  → Army Builder reads wtc_active_list_p1 / wtc_active_list_p2 from localStorage
  → Builds unit manifest for that player
  → Manifest written to wtc_unit_manifest_p1 / wtc_unit_manifest_p2
  → Canvas updates immediately
```

Switching lists mid-session clears that player's current unit positions on the
canvas and re-runs the Army Builder for the newly selected list.

### List Save Schema (shared with List Parser)
```js
{
  id:           uuid,
  name:         string,         // "Ultramarines GT List"
  faction:      string,
  created_at:   ISO timestamp,
  updated_at:   ISO timestamp,
  raw_export:   string,         // original paste preserved
  resolved:     unit[],         // resolved unit manifest snapshot
  wtc_doc_ver:  string          // WTC base doc version at resolution time
}
```

### Netlify / Static Build
Pure JS logic — no build-time dependencies beyond the Brush Rush stack.
WTC base size doc loaded once at session start from a bundled JSON asset
(pre-converted from XLSX at build time). No runtime fetches.

### Tailwind / Theme
Unit base chips on canvas reuse Brush Rush's token/badge component pattern.
Player 1 bases: left-accent color from Brush Rush theme.
Player 2 bases: right-accent color from Brush Rush theme.
Unresolved/flagged units rendered with `border-red-500` warning ring.

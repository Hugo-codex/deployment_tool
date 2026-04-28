# List Parser Agent

Parse raw army list exports from the GW App, Warhammer Official App (War Organ), and New Recruit into a normalized clean roster JSON — ready for the Name Resolver Agent.

## Role

This agent is the **raw input handler**. It receives whatever the user pastes or uploads from their list-building app and outputs one clean, consistent format regardless of source. It does not look up base sizes, does not resolve unit names, and does not touch the WTC base doc. Its only job is structural normalization.

---

## Inputs

- **raw_input**: String (pasted export text) or file path (`.txt`, `.json`, `.csv`)
- **source_hint**: Optional — `"gw_app"` | `"war_organ"` | `"new_recruit"` | `"auto"`. Default: `"auto"`
- **player**: `1` | `2`
- **output_path**: Where to write normalized roster JSON

---

## Source Format Signatures

Use these patterns to auto-detect source when `source_hint` is `"auto"`:

### GW App (Warhammer 40,000 App)
```
Signature markers:
  - Starts with army name line followed by total points in brackets: "Space Marines (2000 Points)"
  - Unit blocks separated by blank lines
  - Wargear listed with bullet "•" character
  - Enhancement/stratagems noted inline
  - Keywords listed at bottom of each unit block

Example block:
  Captain in Terminator Armour (105 Points)
  • 1x Storm bolter
  • 1x Thunder hammer
  Keywords: Infantry, Character, Imperium, Terminator, Captain
```

### War Organ (Warhammer Official App)
```
Signature markers:
  - Header line: "++ [Faction] ([Points]pts) ++"
  - Section headers: "+ HQ +" / "+ Troops +" etc in brackets
  - Unit names followed by point cost in square brackets: "Marneus Calgar [180pts]"
  - Model options listed with "- " prefix
  - Roster ends with "++ Total: [X] pts ++"

Example block:
  + HQ +
  Captain in Terminator Armour [105pts]
  - Storm bolter
  - Thunder hammer
```

### New Recruit
```
Signature markers:
  - JSON export available (preferred) or structured text
  - Text format uses indented model counts: "  x5 Intercessors"
  - Section labels in ALL CAPS: "TROOPS", "HQ", "ELITES"
  - Points in parentheses at end: "Intercessor Squad (90pts)"
  - Model breakdown listed as sub-items with count prefix

Example block:
  HQ
  Captain in Terminator Armour (105pts)
    x1 Captain in Terminator Armour

  TROOPS
  Intercessor Squad (90pts)
    x4 Intercessors
    x1 Intercessor Sergeant
```

---

## Process

### Step 1: Detect Source Format

1. If `source_hint` is not `"auto"` → use stated format
2. If `"auto"` → scan for signature markers in order: GW App → War Organ → New Recruit
3. If format cannot be determined → flag `"source_unknown": true` and attempt best-effort parse
4. Log detected format in output metadata

### Step 2: Extract Army Metadata

Pull top-level army info:

```
faction:        string — army/faction name as written in the export
subfaction:     string | null — detachment, chapter, dynasty etc if present
total_points:   integer | null
player:         1 | 2 (from input)
source_format:  "gw_app" | "war_organ" | "new_recruit" | "unknown"
```

### Step 3: Extract Unit Blocks

For each unit in the export:

1. Extract **unit name** — strip point costs, brackets, bullet characters
2. Extract **model count** — explicit if listed, else default to 1
3. Extract **unit role** if present (HQ, Troops, Elites, Fast Attack, Heavy Support, etc.)
4. Extract **model sub-types** if the unit has named model variants within it:

```
"Intercessor Squad" → models: ["Intercessor Sergeant x1", "Intercessors x4"]
```

5. Strip all wargear, keywords, enhancements, stratagems — these are NOT passed forward
6. Strip all point costs from unit names

### Step 4: Normalize Unit Names

Apply these normalization rules to every unit name:

```
RULES (in order):
1. Trim leading/trailing whitespace
2. Remove point costs:  "Captain (105pts)" → "Captain"
3. Remove brackets:     "[Named Character]" → "Named Character"  
4. Remove model count suffixes: "Intercessors x5" → "Intercessors"
5. Collapse multiple spaces to single space
6. Preserve capitalization exactly as exported — do NOT lowercase
   (Name Resolver Agent handles matching, not this agent)
7. Preserve special characters in names (apostrophes, hyphens)
```

### Step 5: Extract Model Count

Priority order for model count:

```
1. Explicit sub-model list with counts → sum all sub-model counts
2. "x[N]" suffix on unit name → use N
3. "([N] models)" annotation → use N
4. Unit has no count information → default to 1, flag "count_assumed": true
```

### Step 6: Handle Edge Cases

```
DETACHMENTS / FORCE ORG MARKERS:
  Strip completely — not passed forward
  Log which detachment was detected in metadata (informational only)

NAMED CHARACTERS:
  Keep name exactly as written
  Do not split into generic + named variant

ALLIED / AUXILIARY UNITS:
  Flag "allied": true if unit appears under a different faction header
  Keep in roster — Name Resolver will handle lookup

DUPLICATE UNIT ENTRIES:
  If same unit name appears twice (different loadouts):
  → Keep both as separate entries
  → Append suffix: "Intercessors_a", "Intercessors_b"
  → Flag "duplicate_name": true on both

UNIT COUNTS > EXPECTED:
  Do not validate against codex legal limits — just parse and pass forward
  Validation is the Layout Validator Agent's job
```

### Step 7: Write Normalized Roster

Save to `{output_path}`:

```json
{
  "metadata": {
    "source_format": "gw_app",
    "source_detected": true,
    "faction": "Space Marines",
    "subfaction": "Ultramarines",
    "total_points": 2000,
    "player": 1,
    "parsed_at": "2026-04-27T00:00:00Z"
  },
  "units": [
    {
      "id": "parsed_001",
      "raw_name": "Captain in Terminator Armour (105 Points)",
      "normalized_name": "Captain in Terminator Armour",
      "unit_role": "HQ",
      "model_count": 1,
      "model_subtypes": [
        { "name": "Captain in Terminator Armour", "count": 1 }
      ],
      "flags": {
        "count_assumed": false,
        "duplicate_name": false,
        "allied": false,
        "source_unknown": false
      }
    },
    {
      "id": "parsed_002",
      "raw_name": "Intercessor Squad (90 Points)",
      "normalized_name": "Intercessor Squad",
      "unit_role": "Troops",
      "model_count": 5,
      "model_subtypes": [
        { "name": "Intercessor Sergeant", "count": 1 },
        { "name": "Intercessors", "count": 4 }
      ],
      "flags": {
        "count_assumed": false,
        "duplicate_name": false,
        "allied": false,
        "source_unknown": false
      }
    }
  ],
  "warnings": [
    {
      "unit_id": "parsed_005",
      "message": "Model count not found in export — defaulted to 1"
    }
  ],
  "parse_errors": []
}
```

---

## Interfaces With

- **Name Resolver Agent** → sends normalized roster; receives resolved WTC names + base sizes
- Does NOT interface with Map & Terrain, Rules, or Layout Validator directly

---

## Constraints

- **Never** look up base sizes — that is Name Resolver's job
- **Never** modify unit names beyond the normalization rules in Step 4
- **Always** preserve `raw_name` alongside `normalized_name` for traceability
- **Always** pass through units even if they cannot be fully parsed — flag and continue
- Wargear, keywords, enhancements are silently stripped — do not log them as warnings

---

## Error Handling

| Error | Response |
|-------|----------|
| Empty input | Abort: "No list content found" |
| Unrecognized format | Set `source_detected: false`, attempt generic line-by-line parse |
| Malformed JSON (New Recruit) | Fall back to text parser for same source |
| Unit block has no name | Skip unit, log parse_error with line number |
| File not found | Abort: report path and suggest pasting text directly |

---

## Build & Architecture Notes

### No Backend
This agent runs entirely in the browser — no server, no API.
Raw input comes from a textarea (paste) or a file input (drag-and-drop `.txt` / `.json`).
Parsed output is written to `localStorage` under the key `wtc_parsed_roster_p{player}`.
Never make network requests. Never write to disk.

### Multiple Lists & Persistence
Parsed rosters feed into saved list objects stored in `localStorage` under `wtc_lists`.
Each saved list preserves the `raw_export` string so it can be re-parsed at any time
(useful when WTC base doc is updated — re-run Name Resolver without re-pasting the list).

```
List save flow:
  User pastes list → List Parser runs → normalized roster in memory
  User clicks "Save List" → prompt for list name
  → Store as new entry in wtc_lists array with raw_export + resolved units
  → List appears immediately in List Manager panel
```

Multiple lists can be saved without limit. Each has a user-defined name (e.g.
"Ultramarines GT v2", "Mirror Match Practice"). Lists persist across sessions.

### Netlify / Static Build
No changes needed for deployment — this agent's logic is pure JS, no build-time
dependencies beyond what Brush Rush already uses.

### Tailwind / Theme
Input UI (textarea, file drop zone, format badge) reuses Brush Rush card and
input component patterns. Format detection badge uses Tailwind utility classes:
`bg-wtc-move` for GW App, `bg-wtc-scout` for War Organ, `bg-wtc-shoot` for New Recruit.

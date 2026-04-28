# Layout Validator Agent

Validate terrain placement, unit deployment positions, and overall board state against WTC rules. Surface errors before the game begins.

## Role

This agent is the **pre-game checklist**. After the Map & Terrain Agent builds the board and the Army Builder Agent populates units, the Layout Validator runs a full sweep to catch illegal placements, terrain errors, and rule violations — before they cause a dispute at the table. It produces a structured validation report with pass/fail status and actionable fixes.

---

## Inputs

Parameters received at invocation:

- **board_state_path**: Path to board state JSON (from Map & Terrain Agent)
- **unit_manifest_p1_path**: Path to Player 1 unit manifest (from Army Builder Agent)
- **unit_manifest_p2_path**: Path to Player 2 unit manifest (from Army Builder Agent)
- **strict_mode**: Boolean — if `true`, flag warnings as errors (tournament mode). Default: `false`
- **output_path**: Where to write the validation report JSON

---

## Validation Checks

### CHECK GROUP A — Terrain Placement

```
A1 — COORDINATE ACCURACY
  ✓ Each terrain piece center matches the official WTC coordinate for the selected map (±0.5" tolerance)
  ✗ Flag any piece deviating beyond tolerance

A2 — CONTAINER GAP RULE
  ✓ On maps Crucible 4-5 and Search & Destroy 1-3-7: gap between center containers ≥ 110mm
  ✓ Each container is ≥ 55mm from table center
  ✗ Flag if gap is < 110mm

A3 — TERRAIN PIECE COUNT
  ✓ Number of terrain pieces on board matches expected count for selected map
  ✗ Flag missing or extra pieces

A4 — TERRAIN TYPE ASSIGNMENT
  ✓ Each piece is assigned the correct terrain type (3-storey ruin / 2-storey ruin / container / prototype)
  ✗ Flag type mismatches

A5 — FOOTPRINT OVERLAP
  ✓ No two terrain footprints overlap
  ✗ Flag overlapping pieces (touching is allowed — overlapping is not)

A6 — BOARD BOUNDARY
  ✓ All terrain pieces are wholly within the 60"×44" board
  ✗ Flag any piece extending beyond board edge
```

### CHECK GROUP B — Deployment Zone Legality

```
B1 — UNIT IN ZONE
  ✓ All placed units are wholly within their player's deployment zone
  ✗ Flag any unit extending outside their zone

B2 — RESERVES DECLARED
  ✓ Units declared as Deep Strike / Reserves are NOT placed on the board
  ✗ Flag if a reserve unit appears in board placement

B3 — INFILTRATORS UNPLACED
  ✓ Infiltrator units are NOT placed in the initial deployment (placed in separate Infiltrator phase)
  ✗ Flag if placed during main deployment

B4 — UNIT WITHIN TERRAIN
  ✓ Units placed inside ruins are on a valid floor level
  ✓ No model is wholly within the 22mm corner exclusion zone of a ruin
  ✗ Flag illegal positions within terrain

B5 — BASE OVERLAP
  ✓ No two unit bases from the same player overlap
  ✓ No unit base overlaps a terrain footprint wall (bases may be inside accessible area)
  ✗ Flag overlapping bases
```

### CHECK GROUP C — Coherency & Unit Integrity

```
C1 — SQUAD COHERENCY
  ✓ All models within a multi-model unit are within 2" of at least one other model in the unit (10th Ed standard)
  ✓ Units of 6+ models: all within 2" of 2 other models in the unit
  ✗ Flag any model out of coherency

C2 — UNIT COMPLETENESS
  ✓ Number of placed bases matches declared model count in unit manifest
  ✗ Flag discrepancies

C3 — CHARACTER PROXIMITY
  ✓ Characters using bodyguard/attached rules are within valid attachment range of their unit
  ✗ Flag detached characters (informational, not always illegal)
```

### CHECK GROUP D — Objective Visibility

```
D1 — OBJECTIVE ACCESSIBILITY
  ✓ Each objective marker is accessible to at least one model from each side
  ✗ Flag objectives completely blocked by terrain from both sides

D2 — OBJ WALL BLOCKING
  ✓ For objectives marked with the OBJ wall symbol: neither player has units already controlling from the blocked side
  ✗ Flag illegal pre-game objective control

D3 — OBJECTIVE MARKER PLACEMENT
  ✓ Objective markers are at official positions for the selected map
  ✗ Flag misplaced objectives
```

---

## Process

### Step 1: Load State Files

1. Read `board_state_path` → extract terrain, deployment zones, objectives, map metadata
2. Read `unit_manifest_p1_path` and `unit_manifest_p2_path` → extract unit positions and metadata
3. Verify all files are present and valid JSON before proceeding

### Step 2: Run Check Groups A–D

Execute each check in order. For each check:

```
result: "pass" | "fail" | "warning" | "skip"
```

- `pass` — check passed cleanly
- `fail` — hard rule violation found
- `warning` — potential issue, not a definitive violation (ambiguous situation)
- `skip` — check not applicable to current map/context (e.g. container gap check on a map with no center containers)

### Step 3: Score the Board

Produce a summary score:

```
hard_fails:   Count of checks with result "fail"
warnings:     Count of checks with result "warning"
overall:      "legal" | "illegal" | "needs_review"
```

- `legal` → 0 hard fails
- `illegal` → 1+ hard fails
- `needs_review` → 0 hard fails but 1+ warnings (or strict_mode off with borderline cases)

### Step 4: Generate Fix Instructions

For every `fail` and `warning`, produce a human-readable fix:

```json
{
  "check_id": "A2",
  "check_name": "Container Gap Rule",
  "result": "fail",
  "description": "The gap between center containers on Search & Destroy Map 1 measures 95mm. Minimum required: 110mm.",
  "fix": "Move each container 7.5mm further from table center (total gap increase: 15mm).",
  "severity": "hard" | "soft",
  "affects_player": "both" | "player_1" | "player_2"
}
```

### Step 5: Write Validation Report

Save to `{output_path}`:

```json
{
  "map": {
    "deployment_type": "search_and_destroy",
    "map_number": 1,
    "pack_version": "WTC 2026 v2.4"
  },
  "summary": {
    "overall": "illegal",
    "hard_fails": 1,
    "warnings": 2,
    "checks_run": 18,
    "checks_passed": 15,
    "checks_skipped": 0
  },
  "results": [
    {
      "check_id": "A2",
      "check_name": "Container Gap Rule",
      "result": "fail",
      "description": "...",
      "fix": "...",
      "severity": "hard",
      "affects_player": "both"
    },
    {
      "check_id": "B1",
      "check_name": "Unit in Deployment Zone",
      "result": "warning",
      "description": "Unit 'Infiltrators [P1]' base edge is 0.1\" outside Player 1 deployment zone.",
      "fix": "Move unit 2mm toward Player 1 board edge.",
      "severity": "soft",
      "affects_player": "player_1"
    }
  ],
  "legal_to_play": false,
  "generated_at": "2026-04-27T00:00:00Z"
}
```

---

## Severity Definitions

| Severity | Meaning | Tournament Impact |
|----------|---------|-------------------|
| `hard` | Clear rule violation, must be fixed before play | Yellow card risk if not corrected |
| `soft` | Borderline or ambiguous — recommend fixing | Discuss with opponent |
| `info` | Informational only, no action required | No impact |

---

## Strict Mode Behavior

When `strict_mode: true`:
- All `warning` results are escalated to `fail`
- Tolerance on coordinate accuracy reduced from ±0.5" to ±0.25"
- `overall` is `"legal"` only if hard_fails = 0 AND warnings = 0

Use strict mode for tournament prep and team captain verification.

---

## Interfaces With

- **Map & Terrain Agent** → receives board state; may send requests to re-query specific terrain positions
- **Army Builder Agent** → receives unit manifests; may request base size re-verification for flagged units
- **Rules Agent** → escalates ambiguous cases for a formal ruling before deciding pass/fail

---

## Constraints

- **Never auto-fix** — report issues and fixes, but do not modify board state or unit manifests directly
- **Always check both players** — validate symmetrically, do not assume P1 is the "home" player
- All tolerances are explicitly stated — do not apply silent tolerances beyond what is documented
- If board state or manifests are incomplete, run all checks possible and flag which were skipped and why

---

## Error Handling

| Error | Response |
|-------|----------|
| Missing board state file | Abort with error: "Board state required to run validation" |
| Missing one player manifest | Run partial validation for the available player, flag P2 checks as skipped |
| Invalid JSON in any input | Report parse error, abort cleanly — do not run partial checks on corrupt data |
| Unknown map version | Warn that coordinates may differ from expected, proceed with best available data |
| Unit positions not yet set | Skip Group B and C checks, run Group A and D only |

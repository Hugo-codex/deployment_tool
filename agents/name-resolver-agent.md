# Name Resolver Agent

Fuzzy-match normalized unit names from the List Parser against the official WTC base size document. Produce a resolved roster where every unit has a confirmed WTC base size or a clearly flagged unresolved entry.

## Role

This agent bridges the gap between **what the list app calls a unit** and **what the WTC base doc calls that same unit**. Names rarely match exactly across sources. This agent owns all fuzzy matching logic, confidence scoring, and ambiguity resolution. It is the only agent that reads the WTC base size document.

---

## Inputs

- **parsed_roster_path**: Path to normalized roster JSON (from List Parser Agent)
- **wtc_base_doc_path**: Path to WTC base size document (`.xlsx`, `.csv`, or `.json`)
- **faction**: Faction string — used to scope lookups and resolve ambiguous matches
- **match_threshold**: Confidence threshold 0.0–1.0 below which a match is flagged for review. Default: `0.75`
- **output_path**: Where to write resolved roster JSON

---

## WTC Base Doc Structure

The WTC document (2024 v1.3 format) contains columns:

```
| Faction | Unit Name | Base Size | Last Updated |
```

Base size values appear as:
- Round: `"25 mm"`, `"32 mm"`, `"40 mm"` etc.
- Oval: `"75x42 mm (oval)"`, `"105x70 mm (oval)"` etc.
- Special: `"120x92mm, height 127mm"` (height cap noted)
- Multiple valid: `"25 mm / 28mm"` (slash-separated)
```

---

## Matching Strategy

Apply matching strategies in order, stopping at first confident match:

### Level 1 — Exact Match (confidence: 1.0)
```
Normalize both strings identically:
  - Lowercase
  - Strip punctuation
  - Collapse whitespace
  
Compare. If identical → exact match.

Example: "Intercessor Squad" → "intercessor squad"
         WTC doc: "Intercessor Squad" → "intercessor squad" ✓
```

### Level 2 — Contains Match (confidence: 0.90)
```
Check if normalized unit name is fully contained within a WTC doc entry, or vice versa.

Example: "Primaris Intercessors" contains "Intercessors"
         WTC doc has "Intercessor Squad" — partial overlap
         → Flag for Level 3 before confirming
```

### Level 3 — Token Match (confidence: 0.85)
```
Tokenize both strings. Calculate % of tokens shared.

Example: "Captain in Terminator Armour" 
         Tokens: [captain, terminator, armour]
         WTC doc: "Terminator Captain" → [terminator, captain]
         Shared: 2/3 = 0.67 → below threshold, flag for review

         WTC doc: "Captain in Terminator Armour" → exact ✓
```

### Level 4 — Faction-Scoped Fuzzy Match (confidence: 0.75–0.84)
```
Within the faction's entries only, apply Levenshtein distance scoring.
Normalize to 0.0–1.0 confidence range.
Only accept if score ≥ match_threshold.

Example: "Intercessors" vs "Intercessor Squad" → distance 6, length 16 → score ~0.81 ✓
```

### Level 5 — Cross-Faction Fuzzy Match (confidence: 0.60–0.74)
```
Expand search to all factions. Same Levenshtein scoring.
Always flagged for manual review regardless of threshold.
Used only for allied units or when faction-scoped search returns nothing.
```

### No Match (confidence: 0.0)
```
No strategy returned a result above 0.5.
Unit is flagged "unresolved: true".
Base size set to null.
Requires manual input.
```

---

## Special Cases

### Multiple Valid Base Sizes
```
WTC doc entry: "25 mm / 28mm"
→ Set base_size_options: ["25mm", "28mm"]
→ Set size_ambiguous: true
→ Default to the first (smaller) option
→ Flag for user confirmation
```

### Named Characters
```
Named characters often appear in WTC doc under their full name.
Also try matching against their generic unit type if exact fails.

Example: "Marneus Calgar" → check exact first
         If not found → try "Captain" within Ultramarines scope
         Flag which match strategy was used
```

### Height-Capped Bases
```
If WTC doc entry contains height notation (e.g. "height 127mm"):
→ Extract and store as separate field: "height_cap_mm": 127
→ Pass to Army Builder for display annotation
```

### Model Subtypes Within a Unit
```
If parsed unit has model_subtypes (e.g. Sergeant + troopers):
→ Check if subtypes have DIFFERENT base sizes in WTC doc
→ If yes: flag "mixed_bases": true, list each subtype's size
→ Army Builder will render each model individually
→ If all same size: use single base size for whole unit
```

---

## Process

### Step 1: Load Inputs

1. Read parsed roster from `parsed_roster_path`
2. Load WTC base doc from `wtc_base_doc_path`
3. Index WTC doc by faction for fast scoped lookup
4. Validate faction string against WTC doc faction list — warn if not found

### Step 2: Resolve Each Unit

For each unit in parsed roster:

1. Run matching strategies Level 1 → 5 in order
2. Stop at first result that meets `match_threshold`
3. Record: matched WTC name, base size, confidence score, strategy used
4. Apply special case handling if triggered

### Step 3: Score the Roster

```
resolved:    Units with confidence ≥ match_threshold
review:      Units with confidence 0.50–(threshold-0.01)
unresolved:  Units with confidence < 0.50 or no match found
```

### Step 4: Generate Match Report

For every unit, record the resolution path taken — useful for debugging and user review.

### Step 5: Write Resolved Roster

Save to `{output_path}`:

```json
{
  "metadata": {
    "faction": "Space Marines",
    "wtc_doc_version": "2024 v1.3",
    "match_threshold": 0.75,
    "resolved_count": 12,
    "review_count": 2,
    "unresolved_count": 1,
    "player": 1
  },
  "units": [
    {
      "id": "parsed_001",
      "parsed_name": "Captain in Terminator Armour",
      "wtc_matched_name": "Captain in Terminator Armour",
      "wtc_faction": "Space Marines",
      "match_confidence": 1.0,
      "match_strategy": "exact",
      "base": {
        "shape": "round",
        "size_primary_mm": 40,
        "size_secondary_mm": null,
        "height_cap_mm": null,
        "size_ambiguous": false,
        "size_options": [],
        "mixed_bases": false
      },
      "model_count": 1,
      "flags": {
        "needs_review": false,
        "unresolved": false,
        "mixed_bases": false,
        "size_ambiguous": false
      }
    },
    {
      "id": "parsed_007",
      "parsed_name": "Outriders",
      "wtc_matched_name": "Outrider Squad",
      "wtc_faction": "Space Marines",
      "match_confidence": 0.82,
      "match_strategy": "faction_fuzzy",
      "base": {
        "shape": "oval",
        "size_primary_mm": 90,
        "size_secondary_mm": 52,
        "height_cap_mm": null,
        "size_ambiguous": false,
        "size_options": [],
        "mixed_bases": false
      },
      "model_count": 3,
      "flags": {
        "needs_review": true,
        "unresolved": false,
        "mixed_bases": false,
        "size_ambiguous": false
      }
    },
    {
      "id": "parsed_011",
      "parsed_name": "Custom Counts-As Character",
      "wtc_matched_name": null,
      "wtc_faction": null,
      "match_confidence": 0.0,
      "match_strategy": "none",
      "base": {
        "shape": null,
        "size_primary_mm": null,
        "size_secondary_mm": null,
        "height_cap_mm": null,
        "size_ambiguous": false,
        "size_options": [],
        "mixed_bases": false
      },
      "model_count": 1,
      "flags": {
        "needs_review": true,
        "unresolved": true,
        "mixed_bases": false,
        "size_ambiguous": false
      }
    }
  ],
  "review_required": [
    {
      "unit_id": "parsed_007",
      "parsed_name": "Outriders",
      "best_match": "Outrider Squad",
      "confidence": 0.82,
      "action": "confirm_or_override"
    },
    {
      "unit_id": "parsed_011",
      "parsed_name": "Custom Counts-As Character",
      "best_match": null,
      "confidence": 0.0,
      "action": "manual_base_size_required"
    }
  ]
}
```

---

## User Review Flow

For any unit in `review_required`, surface to user before passing to Army Builder:

```
CONFIRM MATCH:
  "We matched 'Outriders' → 'Outrider Squad' (90×52mm oval). Correct? [Yes / No / Change]"

MANUAL INPUT:
  "'Custom Counts-As Character' not found in WTC base doc.
   Please enter base size: [____mm] Shape: [Round / Oval]"

AMBIGUOUS SIZE:
  "'Some Unit' has valid sizes: 25mm or 28mm in WTC doc.
   Which is your model on? [25mm / 28mm]"
```

Do not pass to Army Builder until all `unresolved` units have either a confirmed match or a manually entered base size.

---

## Interfaces With

- **List Parser Agent** → receives normalized roster
- **Army Builder Agent** → sends fully resolved roster (all units have base size or are explicitly manual)
- Does NOT interface with Map & Terrain, Rules, or Layout Validator directly

---

## Constraints

- **Only** use the WTC base size document as source of truth — no other base size references
- **Never** silently assign a base size — every assignment must have a confidence score and strategy
- **Always** surface `needs_review` units to the user before Army Builder runs
- Faction scoping is preferred — cross-faction matches are always flagged
- If WTC doc is unavailable → abort entirely, do not guess

---

## Error Handling

| Error | Response |
|-------|----------|
| WTC doc not found | Abort: "WTC base size document required. Provide path to .xlsx or .csv" |
| Faction not in WTC doc | Warn, fall back to cross-faction search for all units |
| Parsed roster empty | Abort: "No units to resolve — check List Parser output" |
| All units unresolved | Abort with full unresolved list — do not pass empty manifest to Army Builder |
| WTC doc format changed | Flag column mapping error, list expected vs found columns |

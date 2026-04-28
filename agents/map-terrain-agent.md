# WTC Map & Terrain Agent

Manage the board canvas state: load official WTC maps, place terrain pieces from coordinates, enforce layout rules, and expose the board state to other agents.

## Role

This agent is the **source of truth for the physical board**. It knows every official WTC map pack layout (v2.4+), all terrain piece dimensions, placement coordinates, and deployment zone boundaries. Other agents query this agent for spatial data — it never queries them.

---

## Inputs

Parameters received at invocation:

- **deployment_type**: One of `hammer_and_anvil` | `crucible_of_battle` | `search_and_destroy` | `tipping_point` | `dawn_of_war` | `sweeping_engagement`
- **map_number**: Integer 1–8 (or `4-5` for shared maps)
- **canvas_scale**: Pixels per inch (default: `20` → 1200×880px canvas for 60"×44" board)
- **show_measurements**: Boolean — overlay coordinate grid
- **player_pov**: `1` | `2` | `both`
- **output_path**: Where to write the resolved board state JSON

---

## Data: Board & Terrain Constants

```
BOARD: 60" × 44"

TERRAIN TYPES:
  three_storey_ruin:
    footprint: 12" × 6"
    accessible_area: 10.5" × 5"
    height: 9.5"
    floors: ground + 3" + 6"
    category: Ruins

  two_storey_ruin:
    footprint: 12" × 6"
    accessible_area: 10.5" × 5"
    height: 5.01"
    floors: ground + 3"
    category: Ruins

  containers:
    footprint: 5" × 2.5"
    height: 5"
    category: Armoured Containers
    note: No LOS through gaps between containers or table floor

  prototype_ruin (BETA only):
    footprint: 6" × 5"
    height: 0"
    category: Ruins
    note: No vertical elements
```

---

## Data: Map Coordinates (WTC 2026 v2.4)

Coordinates are expressed as `(X-Y)` inches from the **bottom-left corner of the board**, using the RED arrow as primary placement point, YELLOW arrow as secondary.

All measurements reference the **base of the terrain piece**, not the walls.

```
HAMMER AND ANVIL:
  map_1:  (5-10)(18-9)(22-7)(27-0)(14-20)(24-18)(15-3)(6-14)(2-19)
  map_2:  (3-11)(10-8)(12-9)(11-4)(5-14)(14-18)(17-21)(18-5)(21.5-7)
  map_3:  (18-5)(23-2)(25-3)(6-10)(13-17)(12-14)(5-4)(20-3)(24-14)(23-13)(24-18)
  map_4_5:(27-0)(15-2)(6-14)(2-19)(24-17)(17-16)(26-11)(23-15)(7-14)(18-9)
  map_6:  (2-6)(13-13)(18-12)(18-19)(7-20)(8-11)(18-4)(27-15)(29-2)(25-18)
  map_7:  (15-3)(29-0)(26-13)(7-0)(12-3)(2-19)(6-14)(11-14)(23-16)(17-18)
  map_8:  (8-2)(13-13)(8-19)(13-14)(24-18)(20-23)(19-8)(25-5)(15-2)(24-12)

CRUCIBLE OF BATTLE:
  map_1:  (13-0)(5-9)(22-11)(28-2)(22-17)(25-13)(14-0)(12-17)(6-9)(4-18)(20-20)
  map_2:  (23-0)(3-11)(12-3)(26-13)(14-17)(22-18)(6-6)(22-4)(14-13)
  map_3:  (11-13)(14-0)(22-5)(25-7)(21-17)(9-15)(25-19)(12-16)(23-13)(14-0)(11-13)
  map_4_5:(19-17)(6-6)(22-4)(22-18)(19-13)(23-0)(7-15)(10-2)(26-13) [110mm container gap]
  map_6:  (2-18)(7-15)(13-15)(10-2)(23-3)(26-16)(30-3)(20-16)(15-19)(14-3)
  map_7:  (14-0)(24-2)(6-23)(24-7.5)(8.5-6)(18.5-4)(12-17)(14-0)(6-8.5)(20-19.5)(23-13)(22-17)
  map_8:  (10-2)(17-3)(9-15)(19-13)(27.5-11)(14.5-17)(0-22)(13-20)(22-2)(20-15)

SEARCH AND DESTROY:
  map_1:  (19-13)(7-15)(10-2)(23-0)(26-13)(6-6)(22-4)(22-18)(19-17) [110mm gap]
  map_2:  (6-5)(27-4)(21-14)(30-17)(24-17)(3-12)(3-21)(24-0)(21-13)
  map_3:  (19-13)(7-15)(10-2)(23-0)(26-13)(6-6)(22-4)(14-13)(22-18) [110mm gap]
  map_4_5:(11-13)(14-0)(24-11)(26-2)(21-17)(4-19)(26-18)(12-16)(23-13)(14-0)(6-9)
  map_6:  (6-5)(26-4)(21-14)(29-17)(24-17)(3-12)(3-21)(24-0)(19-11)
  map_7:  (19-13)(7-15)(16-7)(23-0)(22-3)(14-12)(13-19)(26-13)(22-18) [110mm gap]
  map_8:  (22-7)(6-4)(27-4)(21-14)(28-17)(22-17)(3-12)(3-21)(24-0)(18-10)

TIPPING POINT:
  map_1:  (3-5)(14-12)(18-7)(28-1)(5-16)(12-17)(11-15)(20-6)(15-4)(23-15)(18-18)
  map_2:  (12-0)(25-0)(20-11)(12-20)(23-2)(20-6)(25-18)(23-13)(11-15)(10-2)(22-16)
  map_3:  (11-0)(14-13)(28-0)(24-13)(9-14)(4-17)(6-6)(14-15)(22-22)(28-12)(29-15)(30-17)
  map_4_5:(13-4)(6-15)(23-2)(22-15)(13-15)(14-16)(9-16)(10-3)(24-2)(23-15)(23-20)(25-19)
  map_6:  (0-14)(11-9)(17-0)(12-3)(29-0)(25-12)(28-15)(20-22)(6-15)(8-2)
  map_7:  (6-22)(14-0)(22-8)(23-8)(27-17)(20-22)(3-12)(9-1)(15-14)(28-0)
  map_8:  (24-0)(15-9)(5-2)(15-0)(8-15)(7-16)(17-16)(24-17)

DAWN OF WAR: maps 1-3 (stable), maps 4-6 (BETA)
SWEEPING ENGAGEMENT: maps 1-3 (stable), maps 4-6 (BETA)
```

---

## Process

### Step 1: Validate Inputs

1. Confirm `deployment_type` is one of the 6 valid types
2. Confirm `map_number` exists for that deployment type
3. Default `canvas_scale` to 20 if not provided
4. Flag BETA maps with a warning in output

### Step 2: Resolve Deployment Zone Boundaries

Calculate deployment zone polygons in pixels based on deployment type:

```
hammer_and_anvil:   Player 1 = bottom 9", Player 2 = top 9"
crucible_of_battle: Player 1 = bottom-left triangle, Player 2 = top-right triangle (9" from edges)
search_and_destroy: Player 1 = left 9", Player 2 = right 9"
tipping_point:      Player 1 = bottom 6", Player 2 = top 6" (with center scoring zone)
dawn_of_war:        Player 1 = bottom 12", Player 2 = top 12"
sweeping_engagement:Player 1 = bottom-left, Player 2 = top-right (diagonal split)
```

### Step 3: Place Terrain from Coordinates

For each coordinate in the selected map:

1. Convert `(X-Y)` inches → pixels using `canvas_scale`
2. Assign terrain type (ruins vs containers) based on map visual pattern
3. Note any special rules (110mm container gap, OBJ wall blocking, knight passage markers)
4. Build terrain object:

```json
{
  "id": "terrain_01",
  "type": "three_storey_ruin",
  "x_inches": 5,
  "y_inches": 10,
  "x_px": 100,
  "y_px": 200,
  "rotation": 0,
  "special_rules": []
}
```

### Step 4: Place Objectives

Resolve objective positions per deployment type. Objectives use 40mm markers. Flag any OBJ blocked behind ruin walls per map annotations.

### Step 5: Apply Special Rules

Check for map-specific directives:
- **110mm container gap**: For Crucible 4-5, Search & Destroy 1-3-7 — enforce 55mm from center per container
- **OBJ wall blocking**: Mark objectives that cannot be controlled from behind the nearest ruin wall
- **Knight passage markers**: Flag 110mm oval gaps between terrain pieces

### Step 6: Write Board State

Save to `{output_path}`:

```json
{
  "board": {
    "width_inches": 60,
    "height_inches": 44,
    "canvas_scale": 20
  },
  "deployment": {
    "type": "hammer_and_anvil",
    "map_number": 1,
    "is_beta": false,
    "zones": {
      "player_1": { "polygon": [...] },
      "player_2": { "polygon": [...] }
    }
  },
  "terrain": [ ...terrain objects ],
  "objectives": [ ...objective objects ],
  "special_rules": [ ...active rule flags ],
  "warnings": []
}
```

---

## Rules & Constraints

- **Never** move terrain from official coordinates unless explicitly asked by user
- **Always** flag BETA maps in warnings
- Terrain coordinates reference **base of terrain, not walls**
- Ruin corners are positioned ≤22mm from the two closest footprint edges
- If two terrain pieces touch, they remain **two separate features**
- WTC terrain is played **WYSIWYG** — windows, walls, flaps are literal

## Interfaces With

- **Army Builder Agent** → provides unit positions to overlay on board state
- **Layout Validator Agent** → receives board state JSON for validation
- **Rules Agent** → queries terrain dimensions and LOS rules for rulings

---

## Error Handling

| Error | Response |
|-------|----------|
| Unknown deployment type | List valid types, ask user to clarify |
| Map number out of range | State valid range for that deployment type |
| BETA map requested | Proceed but add `"beta_warning"` to output warnings |
| Coordinate parse failure | Skip piece, log error, continue with rest of map |

// WTC Map Pack 2026 v2.4
// Coordinates: (X-Y) inches from bottom-left corner of board
// RED arrow = primary placement point

export const BOARD = { width: 60, height: 44 }

export const DEPLOYMENT_TYPES = [
  'hammer_and_anvil',
  'crucible_of_battle',
  'search_and_destroy',
  'tipping_point',
  'dawn_of_war',
  'sweeping_engagement',
]

// Deployment zone geometry (all in inches from board edges)
export const DEPLOYMENT_ZONES = {
  hammer_and_anvil:    { p1: { type: 'strip', edge: 'bottom', depth: 9 }, p2: { type: 'strip', edge: 'top', depth: 9 } },
  crucible_of_battle:  { p1: { type: 'triangle', corner: 'bottom-left', depth: 9 }, p2: { type: 'triangle', corner: 'top-right', depth: 9 } },
  search_and_destroy:  { p1: { type: 'strip', edge: 'left', depth: 9 }, p2: { type: 'strip', edge: 'right', depth: 9 } },
  tipping_point:       { p1: { type: 'strip', edge: 'bottom', depth: 6 }, p2: { type: 'strip', edge: 'top', depth: 6 } },
  dawn_of_war:         { p1: { type: 'strip', edge: 'bottom', depth: 12 }, p2: { type: 'strip', edge: 'top', depth: 12 } },
  sweeping_engagement: { p1: { type: 'diagonal', corner: 'bottom-left' }, p2: { type: 'diagonal', corner: 'top-right' } },
}

// Maps with container gap rule requiring 110mm gap between center containers
export const CONTAINER_GAP_MAPS = [
  'crucible_of_battle:4_5',
  'search_and_destroy:1',
  'search_and_destroy:3',
  'search_and_destroy:7',
]

// Raw coordinate strings from WTC v2.4 — parsed at runtime by mapTerrain lib
// Format: "(X-Y)" inches from bottom-left
export const MAP_COORDS = {
  hammer_and_anvil: {
    1: '(5-10)(18-9)(22-7)(27-0)(14-20)(24-18)(15-3)(6-14)(2-19)',
    2: '(3-11)(10-8)(12-9)(11-4)(5-14)(14-18)(17-21)(18-5)(21.5-7)',
    3: '(18-5)(23-2)(25-3)(6-10)(13-17)(12-14)(5-4)(20-3)(24-14)(23-13)(24-18)',
    '4_5': '(27-0)(15-2)(6-14)(2-19)(24-17)(17-16)(26-11)(23-15)(7-14)(18-9)',
    6: '(2-6)(13-13)(18-12)(18-19)(7-20)(8-11)(18-4)(27-15)(29-2)(25-18)',
    7: '(15-3)(29-0)(26-13)(7-0)(12-3)(2-19)(6-14)(11-14)(23-16)(17-18)',
    8: '(8-2)(13-13)(8-19)(13-14)(24-18)(20-23)(19-8)(25-5)(15-2)(24-12)',
  },
  crucible_of_battle: {
    1: '(13-0)(5-9)(22-11)(28-2)(22-17)(25-13)(14-0)(12-17)(6-9)(4-18)(20-20)',
    2: '(23-0)(3-11)(12-3)(26-13)(14-17)(22-18)(6-6)(22-4)(14-13)',
    3: '(11-13)(14-0)(22-5)(25-7)(21-17)(9-15)(25-19)(12-16)(23-13)(14-0)(11-13)',
    '4_5': '(19-17)(6-6)(22-4)(22-18)(19-13)(23-0)(7-15)(10-2)(26-13)',
    6: '(2-18)(7-15)(13-15)(10-2)(23-3)(26-16)(30-3)(20-16)(15-19)(14-3)',
    7: '(14-0)(24-2)(6-23)(24-7.5)(8.5-6)(18.5-4)(12-17)(14-0)(6-8.5)(20-19.5)(23-13)(22-17)',
    8: '(10-2)(17-3)(9-15)(19-13)(27.5-11)(14.5-17)(0-22)(13-20)(22-2)(20-15)',
  },
  search_and_destroy: {
    1: '(19-13)(7-15)(10-2)(23-0)(26-13)(6-6)(22-4)(22-18)(19-17)',
    2: '(6-5)(27-4)(21-14)(30-17)(24-17)(3-12)(3-21)(24-0)(21-13)',
    3: '(19-13)(7-15)(10-2)(23-0)(26-13)(6-6)(22-4)(14-13)(22-18)',
    '4_5': '(11-13)(14-0)(24-11)(26-2)(21-17)(4-19)(26-18)(12-16)(23-13)(14-0)(6-9)',
    6: '(6-5)(26-4)(21-14)(29-17)(24-17)(3-12)(3-21)(24-0)(19-11)',
    7: '(19-13)(7-15)(16-7)(23-0)(22-3)(14-12)(13-19)(26-13)(22-18)',
    8: '(22-7)(6-4)(27-4)(21-14)(28-17)(22-17)(3-12)(3-21)(24-0)(18-10)',
  },
  tipping_point: {
    1: '(3-5)(14-12)(18-7)(28-1)(5-16)(12-17)(11-15)(20-6)(15-4)(23-15)(18-18)',
    2: '(12-0)(25-0)(20-11)(12-20)(23-2)(20-6)(25-18)(23-13)(11-15)(10-2)(22-16)',
    3: '(11-0)(14-13)(28-0)(24-13)(9-14)(4-17)(6-6)(14-15)(22-22)(28-12)(29-15)(30-17)',
    '4_5': '(13-4)(6-15)(23-2)(22-15)(13-15)(14-16)(9-16)(10-3)(24-2)(23-15)(23-20)(25-19)',
    6: '(0-14)(11-9)(17-0)(12-3)(29-0)(25-12)(28-15)(20-22)(6-15)(8-2)',
    7: '(6-22)(14-0)(22-8)(23-8)(27-17)(20-22)(3-12)(9-1)(15-14)(28-0)',
    8: '(24-0)(15-9)(5-2)(15-0)(8-15)(7-16)(17-16)(24-17)',
  },
  // Dawn of War and Sweeping Engagement: maps 1-3 stable, 4-6 BETA
  dawn_of_war: {
    // Coordinates to be added when WTC releases stable maps
  },
  sweeping_engagement: {
    // Coordinates to be added when WTC releases stable maps
  },
}

export const BETA_MAPS = new Set([
  'dawn_of_war:4', 'dawn_of_war:5', 'dawn_of_war:6',
  'sweeping_engagement:4', 'sweeping_engagement:5', 'sweeping_engagement:6',
])

export const TERRAIN_TYPES = {
  three_storey_ruin: {
    label: '3-Storey Ruin',
    footprintW: 12,
    footprintH: 6,
    accessibleW: 10.5,
    accessibleH: 5,
    height: 9.5,
    floors: [0, 3, 6],
    category: 'Ruins',
  },
  two_storey_ruin: {
    label: '2-Storey Ruin',
    footprintW: 12,
    footprintH: 6,
    accessibleW: 10.5,
    accessibleH: 5,
    height: 5.01,
    floors: [0, 3],
    category: 'Ruins',
  },
  containers: {
    label: 'Containers',
    footprintW: 5,
    footprintH: 2.5,
    height: 5,
    floors: [0],
    category: 'Armoured Containers',
    note: 'No LOS through gaps between containers or table floor',
  },
  prototype_ruin: {
    label: 'Prototype Ruin (BETA)',
    footprintW: 6,
    footprintH: 5,
    height: 0,
    floors: [0],
    category: 'Ruins',
    isBeta: true,
    note: 'No vertical elements',
  },
}

// 22mm corner exclusion zone — no model may be wholly within this area
export const RUIN_CORNER_EXCLUSION_MM = 22

// WTC Rules Knowledge Base — deployment-phase rulings
// Stateless: each call returns a structured ruling object

import { load, save, KEYS } from '../utils/storage.js'

const AUTHORITY = {
  WTC: 'WTC 2026 Map Pack v2.4',
  CORE: '10th Edition Core Rules',
  EVENT: 'WTC 2026 Event Rules',
  CONSENSUS: 'Competitive consensus (non-official)',
}

// ─── Embedded rule definitions ────────────────────────────────────────────────

const DEPLOYMENT_RULES = {
  order: {
    text: 'Deployment order: place all units → Infiltrators → Scouts → roll for first turn.',
    authority: AUTHORITY.WTC,
  },
  deep_strike_declaration: {
    text: 'Units with Deep Strike or Reserves are declared during deployment but NOT placed on the board.',
    authority: AUTHORITY.CORE,
  },
  infiltrators_phase: {
    text: 'Infiltrators are placed after all main deployment, before Scout moves. They are NOT placed during main deployment.',
    authority: AUTHORITY.CORE,
  },
  scout_move: {
    text: 'Scout moves happen after ALL units (including Infiltrators) are deployed, before the first turn. Move up to 6" (or the unit\'s Scout move characteristic).',
    authority: AUTHORITY.CORE,
  },
  wholly_within: {
    text: 'All units must be placed WHOLLY within their deployment zone — no part of any base may cross the zone boundary.',
    authority: AUTHORITY.CORE,
  },
  terrain_verification: {
    text: 'Terrain must be set and verified by BOTH players before deployment begins. If terrain is wrong after deployment starts, refer to Referee Instructions in the WTC Map Pack.',
    authority: AUTHORITY.WTC,
  },
}

const TERRAIN_RULES = {
  los_ruins: {
    text: 'Ruins block LOS from ground level up to the top of the shortest wall section (marked on WTC maps). Models on upper floors draw LOS normally from their position.',
    authority: AUTHORITY.WTC,
  },
  los_containers: {
    text: 'You cannot draw LOS through gaps between containers or between a container and the table floor.',
    authority: AUTHORITY.WTC,
  },
  ground_floor_windows: {
    text: 'Ground floor windows in Two-Storey Ruins are treated as CLOSED — LOS cannot be drawn through them.',
    authority: AUTHORITY.WTC,
  },
  ruin_movement: {
    text: 'Models may move through ruins freely. Floors and walls count as terrain features for movement purposes.',
    authority: AUTHORITY.CORE,
  },
  move_over_terrain: {
    text: 'Models with "move over terrain 4\" or shorter": this ability applies to terrain pieces shorter than 4". Such models CANNOT end their move within a wall.',
    authority: AUTHORITY.CORE,
  },
  knight_containers: {
    text: 'Knight-class bases (110mm oval) can pass around containers from all sides normally. Specific maps mark gaps where a knight CAN or CANNOT pass through — check the map pack symbol.',
    authority: AUTHORITY.WTC,
  },
  ruin_footprint: {
    text: 'Ruins sit on a 12"×6" footprint base. All measurements to the ruin are taken to the footprint base, NOT to the actual walls.',
    authority: AUTHORITY.WTC,
  },
  corner_exclusion: {
    text: 'No model may be placed WHOLLY within the 22mm corner exclusion zone of a ruin footprint. Ruin corners ≤22mm from two closest footprint edges define this zone.',
    authority: AUTHORITY.WTC,
  },
  touching_terrain: {
    text: 'If two terrain pieces are touching, they remain two SEPARATE terrain features for rules purposes.',
    authority: AUTHORITY.WTC,
  },
}

const OBJECTIVE_RULES = {
  control: {
    text: 'Objectives are controlled by having more models within 3" than the opponent. Models must be on the same floor level to contest (per WTC floor rules).',
    authority: AUTHORITY.CORE,
  },
  wall_symbol: {
    text: 'Objectives marked with the OBJ wall symbol cannot be controlled from behind the nearest ruin wall. Neither player may control from the blocked side.',
    authority: AUTHORITY.WTC,
  },
  tipping_point: {
    text: 'Tipping Point has a central scoring zone with different control rules — refer to the mission card for the specific zone dimensions.',
    authority: AUTHORITY.CORE,
  },
}

const BASE_RULES = {
  wtc_authority: {
    text: 'The WTC base size document is the final authority at WTC events.',
    authority: AUTHORITY.EVENT,
  },
  larger_ok: {
    text: 'Players MAY use bases larger than specified in the WTC document (benefit of the doubt to the opponent).',
    authority: AUTHORITY.EVENT,
  },
  smaller_illegal: {
    text: 'Players may NOT use bases smaller than specified in the WTC document.',
    authority: AUTHORITY.EVENT,
  },
  dispute: {
    text: 'If base size is disputed, the WTC referee on site is the final authority.',
    authority: AUTHORITY.EVENT,
  },
  ruin_fit: {
    text: 'Ruin internal area: 128×280mm total, 230×75mm free vertical space. Wall thickness: 3mm. Models assembled per GW instructions. Optional assemblies may not be eligible.',
    authority: AUTHORITY.WTC,
  },
}

const CONTAINER_GAP_RULE = {
  applies_to: 'Crucible of Battle maps 4-5 and Search & Destroy maps 1, 3, 7.',
  text: 'After placing containers, ensure a 110mm gap between the two center containers. Each container is positioned 55mm from the center of the table.',
  authority: AUTHORITY.WTC,
}

const BETA_MAP_RULES = {
  maps: 'Dawn of War 4-6, Sweeping Engagement 4-6.',
  text: 'Beta maps use a Prototype ruin with 0" height (no vertical elements). These maps are subject to change and are not used in official WTC scoring rounds — check current event rules.',
  authority: AUTHORITY.WTC,
}

// ─── Query router ─────────────────────────────────────────────────────────────

const QUERY_KEYWORDS = {
  deployment_rule: ['deploy', 'deployment', 'zone', 'wholly', 'scout', 'infiltrat', 'reserve', 'deep strike'],
  terrain_interaction: ['los', 'line of sight', 'ruin', 'container', 'move through', 'terrain', 'wall', 'floor', 'window', 'footprint', 'corner'],
  base_legality: ['base', 'base size', 'footprint', 'oval', 'round', 'mm', 'fit in ruin', 'model size'],
  movement_clearance: ['move', 'movement', 'pass', 'gap', 'through', 'knight', 'over terrain', 'clearance'],
  objective_control: ['objective', 'control', 'contest', 'within 3', 'wall symbol', 'tipping point'],
}

function detectQueryType(query) {
  const lower = query.toLowerCase()
  let best = 'general', bestScore = 0
  for (const [type, keywords] of Object.entries(QUERY_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; best = type }
  }
  return best
}

function searchRuleBase(query) {
  const lower = query.toLowerCase()
  const hits = []

  const searchObj = (obj, category) => {
    for (const [key, rule] of Object.entries(obj)) {
      const text = (rule.text ?? '').toLowerCase()
      const score = lower.split(' ').filter(w => w.length > 3 && text.includes(w)).length
      if (score > 0) hits.push({ key, category, rule, score })
    }
  }

  searchObj(DEPLOYMENT_RULES, 'deployment')
  searchObj(TERRAIN_RULES, 'terrain')
  searchObj(OBJECTIVE_RULES, 'objective')
  searchObj(BASE_RULES, 'base')

  // Special rules
  const lowerQ = query.toLowerCase()
  if (lowerQ.includes('110mm') || lowerQ.includes('container gap') || lowerQ.includes('55mm')) {
    hits.push({ key: 'container_gap', category: 'terrain', rule: CONTAINER_GAP_RULE, score: 3 })
  }
  if (lowerQ.includes('beta') || lowerQ.includes('prototype') || lowerQ.includes('dawn of war 4') || lowerQ.includes('sweeping engagement 4')) {
    hits.push({ key: 'beta_maps', category: 'terrain', rule: BETA_MAP_RULES, score: 3 })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 5)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function queryRules(query, queryType = null, context = null) {
  if (!query?.trim()) {
    return { error: 'Query is required.' }
  }

  const resolvedType = queryType ?? detectQueryType(query)
  const hits = searchRuleBase(query)

  if (hits.length === 0) {
    return {
      query,
      query_type: resolvedType,
      ruling: 'This case is not directly covered in the embedded WTC Map Pack v2.4 or core rules. Recommend discussing with your opponent or consulting the WTC Discord.',
      authority: 'N/A',
      confidence: 'low',
      caveats: ['Embedded knowledge base may not cover all edge cases.'],
      related_rules: [],
    }
  }

  // Build ruling text from top hits
  const primaryHit = hits[0]
  const relatedRules = hits.slice(1).map(h => `${h.category}:${h.key}`)
  const caveats = ['Rulings are advisory — the WTC referee on site is always the final authority at live events.']

  let confidence = 'high'
  if (hits[0].score < 2) confidence = 'medium'
  if (hits[0].score < 1) confidence = 'low'

  return {
    query,
    query_type: resolvedType,
    ruling: primaryHit.rule.text,
    authority: primaryHit.rule.authority ?? AUTHORITY.WTC,
    confidence,
    caveats,
    related_rules: relatedRules,
    additional_context: hits.length > 1
      ? hits.slice(1, 3).map(h => ({ key: h.key, text: h.rule.text, authority: h.rule.authority }))
      : [],
  }
}

// Append a new ruling to the rulings log in localStorage
export function logRuling(ruling) {
  const log = load(KEYS.rulings) ?? []
  const entry = {
    ...ruling,
    query_id: `q_${Date.now()}`,
    logged_at: new Date().toISOString(),
  }
  log.push(entry)
  save(KEYS.rulings, log)
  return entry
}

// Re-export the embedded rule tables for use in the Rules panel UI
export { DEPLOYMENT_RULES, TERRAIN_RULES, OBJECTIVE_RULES, BASE_RULES, CONTAINER_GAP_RULE, BETA_MAP_RULES, AUTHORITY }

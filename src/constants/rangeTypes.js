// WTC Measurement Overlay — Range Type Registry
// All arcs originate from base EDGE, never center

export const RANGE_TYPES = {
  // Movement
  move:        { color: '#4A90D9', label: 'MOVE',   group: 'movement', defaultInches: 6 },
  advance:     { color: '#7BB3E8', label: 'ADV',    group: 'movement', defaultInches: 12 },
  scout:       { color: '#50C878', label: 'SCOUT',  group: 'movement', defaultInches: 6 },
  fallback:    { color: '#B0C4DE', label: 'FALL',   group: 'movement', defaultInches: 6 },
  // Shooting
  shoot:       { color: '#FFD700', label: 'SHOOT',  group: 'shooting', defaultInches: null },
  rapid_fire:  { color: '#E8A838', label: 'RF',     group: 'shooting', defaultInches: null },
  assault:     { color: '#F0C060', label: 'ASLT',   group: 'shooting', defaultInches: null },
  heavy:       { color: '#D4883A', label: 'HVY',    group: 'shooting', defaultInches: null },
  pistol:      { color: '#E8C878', label: 'PSTL',   group: 'shooting', defaultInches: null },
  // Charge & melee
  charge:      { color: '#E84040', label: 'CHRG',   group: 'melee',    defaultInches: 12 },
  engagement:  { color: '#C83030', label: 'ENG',    group: 'melee',    defaultInches: 1 },
  consolidate: { color: '#E87070', label: 'CONS',   group: 'melee',    defaultInches: 3 },
  // Combined
  threat:      { color: '#9B30E8', label: 'THREAT', group: 'combined', defaultInches: null },
  // Abilities
  aura:        { color: '#30E8B0', label: 'AURA',   group: 'ability',  defaultInches: null },
  deep_strike: { color: '#FF6B35', label: 'DS-EX',  group: 'ability',  defaultInches: 9 },
  infiltrate:  { color: '#FF9F60', label: 'INFIL',  group: 'ability',  defaultInches: null },
  // Custom
  custom:      { color: '#FFFFFF', label: 'CUSTOM', group: 'custom',   defaultInches: null },
}

export const RANGE_GROUPS = {
  movement: 'Movement',
  shooting: 'Shooting',
  melee:    'Charge & Melee',
  combined: 'Threat',
  ability:  'Abilities & Special',
  custom:   'Custom',
}

// Standard 10th Ed movement defaults (fallback when unit manifest has no stat)
export const MOVEMENT_DEFAULTS = {
  infantry_standard: 6,
  infantry_slow:     5,
  cavalry:           12,
  bikes:             12,
  vehicles:          10,
  fly:               12,
  scout_move:        6,
  charge:            12,
  engagement:        1,
  consolidate:       3,
  deep_strike_excl:  9,
}

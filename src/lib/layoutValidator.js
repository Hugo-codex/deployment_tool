// Layout Validator — runs 18 pre-game checks against board state + unit manifests
// Checks A1-A6 (terrain), B1-B5 (deployment), C1-C3 (coherency), D1-D3 (objectives)

import { load, KEYS } from '../utils/storage.js'
import { pxToInch } from '../utils/geometry.js'

const TOLERANCE_IN = 0.5   // ±0.5" coordinate tolerance (normal mode)
const TOLERANCE_STRICT = 0.25
const CONTAINER_GAP_MM = 110
const CORNER_EXCL_MM = 22
const COHERENCY_IN = 2     // 10th Ed squad coherency

// Maps requiring the container gap check
const CONTAINER_GAP_MAPS = {
  crucible_of_battle: [4, 5],
  search_and_destroy: [1, 3, 7],
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.sqrt((a.xPx - b.xPx) ** 2 + (a.yPx - b.yPx) ** 2)
}

function distInch(a, b, scale) {
  return pxToInch(dist(a, b), scale)
}

function circlesOverlap(a, b) {
  const minDist = (a.radiusPx || 0) + (b.radiusPx || 0)
  return dist(a, b) < minDist - 1 // 1px grace
}

function pointInPoly(px, py, poly) {
  // Ray-casting inside polygon test
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function unitInZone(unit, zonePolygon) {
  // Check all 4 "corners" of the base circle are inside the zone
  const r = unit.base.sizePx / 2
  const cx = unit.placement.xPx
  const cy = unit.placement.yPx
  const testPoints = [
    { x: cx, y: cy },
    { x: cx - r, y: cy },
    { x: cx + r, y: cy },
    { x: cx, y: cy - r },
    { x: cx, y: cy + r },
  ]
  return testPoints.every(p => pointInPoly(p.x, p.y, zonePolygon))
}

function needsContainerGapCheck(deploymentType, mapNumber) {
  const maps = CONTAINER_GAP_MAPS[deploymentType]
  return maps?.includes(mapNumber) ?? false
}

function makeResult(checkId, checkName, result, description, fix = null, severity = 'soft', affectsPlayer = 'both') {
  return { check_id: checkId, check_name: checkName, result, description, fix, severity, affects_player: affectsPlayer }
}

function pass(id, name) {
  return makeResult(id, name, 'pass', `${name}: OK`, null, 'soft', 'both')
}

function skip(id, name, reason) {
  return makeResult(id, name, 'skip', reason, null, 'soft', 'both')
}

// ─── CHECK GROUP A — Terrain Placement ───────────────────────────────────────

function checkA1(terrain, mapCoords, toleranceIn, scale) {
  if (!mapCoords || mapCoords.length === 0) return skip('A1', 'Coordinate Accuracy', 'No official coordinates available for this map.')
  const failures = []
  for (const piece of terrain) {
    const ref = mapCoords.find(m => m.pieceId === piece.id || m.label === piece.label)
    if (!ref) continue
    const dx = pxToInch(Math.abs(piece.xPx - ref.xPx), scale)
    const dy = pxToInch(Math.abs(piece.yPx - ref.yPx), scale)
    const deviation = Math.sqrt(dx ** 2 + dy ** 2)
    if (deviation > toleranceIn) {
      failures.push(`${piece.label}: ${deviation.toFixed(2)}" off (max ${toleranceIn}")`)
    }
  }
  if (failures.length === 0) return pass('A1', 'Coordinate Accuracy')
  return makeResult('A1', 'Coordinate Accuracy', 'fail',
    `${failures.length} terrain piece(s) deviate beyond ±${toleranceIn}" tolerance: ${failures.join('; ')}`,
    'Reposition flagged pieces to their official WTC map coordinates.',
    'hard', 'both')
}

function checkA2(terrain, deploymentType, mapNumber) {
  if (!needsContainerGapCheck(deploymentType, mapNumber)) {
    return skip('A2', 'Container Gap Rule', 'Not applicable for this map.')
  }
  const containers = terrain.filter(t => t.terrainType === 'container')
  if (containers.length < 2) return skip('A2', 'Container Gap Rule', 'Fewer than 2 containers found.')

  // Find the two center containers (closest pair)
  let minDist = Infinity, pair = null
  for (let i = 0; i < containers.length; i++) {
    for (let j = i + 1; j < containers.length; j++) {
      const d = dist(containers[i], containers[j])
      if (d < minDist) { minDist = d; pair = [containers[i], containers[j]] }
    }
  }
  if (!pair) return skip('A2', 'Container Gap Rule', 'Could not identify center container pair.')

  // Convert gap to mm (scale: px/inch, 1 inch = 25.4mm)
  const gapInch = pxToInch(minDist, 20)
  const gapMm = gapInch * 25.4
  if (gapMm >= CONTAINER_GAP_MM) return pass('A2', 'Container Gap Rule')
  return makeResult('A2', 'Container Gap Rule', 'fail',
    `Gap between center containers is ~${gapMm.toFixed(0)}mm. Minimum required: ${CONTAINER_GAP_MM}mm.`,
    `Move each container ${((CONTAINER_GAP_MM - gapMm) / 2).toFixed(1)}mm further from table center.`,
    'hard', 'both')
}

function checkA3(terrain, expectedCount) {
  if (expectedCount == null) return skip('A3', 'Terrain Piece Count', 'Expected count not defined for this map.')
  if (terrain.length === expectedCount) return pass('A3', 'Terrain Piece Count')
  return makeResult('A3', 'Terrain Piece Count', 'fail',
    `Board has ${terrain.length} terrain piece(s); expected ${expectedCount} for this map.`,
    terrain.length < expectedCount
      ? `Add ${expectedCount - terrain.length} missing piece(s) as defined in the WTC Map Pack.`
      : `Remove ${terrain.length - expectedCount} extra piece(s).`,
    'hard', 'both')
}

function checkA4(terrain) {
  const valid = ['3_storey_ruin', '2_storey_ruin', 'container', 'prototype']
  const bad = terrain.filter(t => !valid.includes(t.terrainType))
  if (bad.length === 0) return pass('A4', 'Terrain Type Assignment')
  return makeResult('A4', 'Terrain Type Assignment', 'fail',
    `${bad.length} piece(s) have unrecognised terrain types: ${bad.map(t => `${t.label} (${t.terrainType})`).join(', ')}`,
    'Correct terrain type for each flagged piece in the terrain panel.',
    'soft', 'both')
}

function checkA5(terrain) {
  const overlaps = []
  for (let i = 0; i < terrain.length; i++) {
    for (let j = i + 1; j < terrain.length; j++) {
      // Simplified: treat each piece as a circle with radius from footprint
      const a = terrain[i], b = terrain[j]
      const ra = (a.footprintWPx || 0) / 2, rb = (b.footprintWPx || 0) / 2
      const d = dist(a, b)
      if (d < ra + rb - 2) overlaps.push(`${a.label} ↔ ${b.label}`)
    }
  }
  if (overlaps.length === 0) return pass('A5', 'Footprint Overlap')
  return makeResult('A5', 'Footprint Overlap', 'fail',
    `Overlapping terrain footprints: ${overlaps.join(', ')}`,
    'Separate flagged terrain pieces so their footprints do not overlap.',
    'hard', 'both')
}

function checkA6(terrain, boardWPx, boardHPx) {
  const outside = terrain.filter(t => {
    const hw = (t.footprintWPx || 0) / 2
    const hh = (t.footprintHPx || hw) / 2
    return (t.xPx - hw < 0) || (t.xPx + hw > boardWPx) || (t.yPx - hh < 0) || (t.yPx + hh > boardHPx)
  })
  if (outside.length === 0) return pass('A6', 'Board Boundary')
  return makeResult('A6', 'Board Boundary', 'fail',
    `${outside.length} terrain piece(s) extend beyond the board edge: ${outside.map(t => t.label).join(', ')}`,
    'Move flagged pieces fully onto the board.',
    'hard', 'both')
}

// ─── CHECK GROUP B — Deployment Zone Legality ─────────────────────────────────

function checkB1(units, zonePolygon, player) {
  if (!zonePolygon) return skip(`B1`, 'Unit in Deployment Zone', `No zone polygon for player ${player}.`)
  const placed = units.filter(u => u.placement?.placed && !u.inReserve && !u.isInfiltrator)
  const outside = placed.filter(u => !unitInZone(u, zonePolygon))
  if (outside.length === 0) return pass('B1', 'Unit in Deployment Zone')
  return makeResult('B1', 'Unit in Deployment Zone', 'fail',
    `P${player}: ${outside.length} unit(s) outside deployment zone: ${outside.map(u => u.displayLabel).join(', ')}`,
    'Move flagged units fully within the deployment zone boundary.',
    'hard', `player_${player}`)
}

function checkB2(units, player) {
  const reservesOnBoard = units.filter(u => u.inReserve && u.placement?.placed)
  if (reservesOnBoard.length === 0) return pass('B2', 'Reserves Declared')
  return makeResult('B2', 'Reserves Declared', 'fail',
    `P${player}: ${reservesOnBoard.length} reserve unit(s) are placed on the board: ${reservesOnBoard.map(u => u.displayLabel).join(', ')}`,
    'Remove reserve units from the board — they are declared, not placed.',
    'hard', `player_${player}`)
}

function checkB3(units, player) {
  const infiltratorsPlaced = units.filter(u => u.isInfiltrator && u.placement?.placed)
  if (infiltratorsPlaced.length === 0) return pass('B3', 'Infiltrators Unplaced')
  return makeResult('B3', 'Infiltrators Unplaced', 'warning',
    `P${player}: ${infiltratorsPlaced.length} Infiltrator unit(s) are placed in main deployment: ${infiltratorsPlaced.map(u => u.displayLabel).join(', ')}`,
    'Infiltrators are placed after main deployment. Remove them from main deployment and place in the Infiltrator phase.',
    'soft', `player_${player}`)
}

function checkB4(units, terrain, player) {
  // Flag any unit wholly within the 22mm corner exclusion zone of a ruin
  const ruins = terrain.filter(t => t.terrainType === '3_storey_ruin' || t.terrainType === '2_storey_ruin')
  const placed = units.filter(u => u.placement?.placed)
  const flagged = []
  for (const unit of placed) {
    for (const ruin of ruins) {
      // Corners: approximate as the 4 corners of the ruin footprint
      const hw = (ruin.footprintWPx || 120) / 2
      const hh = (ruin.footprintHPx || 240) / 2
      const corners = [
        { x: ruin.xPx - hw, y: ruin.yPx - hh },
        { x: ruin.xPx + hw, y: ruin.yPx - hh },
        { x: ruin.xPx - hw, y: ruin.yPx + hh },
        { x: ruin.xPx + hw, y: ruin.yPx + hh },
      ]
      const exclPx = (CORNER_EXCL_MM / 25.4) * 20 // 22mm in px at 20px/inch
      for (const corner of corners) {
        if (dist({ xPx: unit.placement.xPx, yPx: unit.placement.yPx }, { xPx: corner.x, yPx: corner.y }) < exclPx) {
          flagged.push(`${unit.displayLabel} near ${ruin.label} corner`)
          break
        }
      }
    }
  }
  if (flagged.length === 0) return pass('B4', 'Unit Within Terrain')
  return makeResult('B4', 'Unit Within Terrain', 'fail',
    `P${player}: Unit(s) in ruin corner exclusion zone (${CORNER_EXCL_MM}mm): ${flagged.join(', ')}`,
    'Move flagged models out of the 22mm corner exclusion zone.',
    'hard', `player_${player}`)
}

function checkB5(units, terrain, player) {
  const placed = units.filter(u => u.placement?.placed)
  const overlaps = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (circlesOverlap(
        { xPx: placed[i].placement.xPx, yPx: placed[i].placement.yPx, radiusPx: placed[i].base.sizePx / 2 },
        { xPx: placed[j].placement.xPx, yPx: placed[j].placement.yPx, radiusPx: placed[j].base.sizePx / 2 }
      )) overlaps.push(`${placed[i].displayLabel} ↔ ${placed[j].displayLabel}`)
    }
  }
  if (overlaps.length === 0) return pass('B5', 'Base Overlap')
  return makeResult('B5', 'Base Overlap', 'fail',
    `P${player}: Overlapping unit bases: ${overlaps.join(', ')}`,
    'Separate flagged bases so they do not overlap.',
    'hard', `player_${player}`)
}

// ─── CHECK GROUP C — Coherency & Unit Integrity ───────────────────────────────

function checkC1(units, player, scale) {
  // Multi-model units: each model must be within 2" of at least one other
  const squads = units.filter(u => u.placement?.placed && u.modelCount > 1 && Array.isArray(u.modelPositions))
  const flagged = []
  for (const squad of squads) {
    const positions = squad.modelPositions
    for (let i = 0; i < positions.length; i++) {
      const closeEnough = positions.some((other, j) => j !== i && distInch(positions[i], other, scale) <= COHERENCY_IN)
      if (!closeEnough) {
        flagged.push(`${squad.displayLabel} model ${i + 1}`)
      }
    }
  }
  if (flagged.length === 0) return pass('C1', 'Squad Coherency')
  return makeResult('C1', 'Squad Coherency', 'fail',
    `P${player}: Model(s) out of coherency (>${COHERENCY_IN}"): ${flagged.join(', ')}`,
    'Move flagged models within 2" of another model in the same unit.',
    'hard', `player_${player}`)
}

function checkC2(units, player) {
  const placed = units.filter(u => u.placement?.placed)
  const mismatches = placed.filter(u => {
    if (!Array.isArray(u.modelPositions)) return false
    return u.modelPositions.length !== u.modelCount
  })
  if (mismatches.length === 0) return pass('C2', 'Unit Completeness')
  return makeResult('C2', 'Unit Completeness', 'warning',
    `P${player}: Base count ≠ model count for: ${mismatches.map(u => `${u.displayLabel} (${u.modelPositions?.length} placed, ${u.modelCount} declared)`).join(', ')}`,
    'Ensure the number of placed bases matches the declared model count.',
    'soft', `player_${player}`)
}

function checkC3(units, player, scale) {
  const characters = units.filter(u => u.isCharacter && u.attachedToUnitId && u.placement?.placed)
  const flagged = []
  for (const char of characters) {
    const host = units.find(u => u.id === char.attachedToUnitId)
    if (!host || !host.placement?.placed) continue
    const d = distInch(
      { xPx: char.placement.xPx, yPx: char.placement.yPx },
      { xPx: host.placement.xPx, yPx: host.placement.yPx },
      scale
    )
    if (d > 3) flagged.push(`${char.displayLabel} is ${d.toFixed(1)}" from ${host.displayLabel}`)
  }
  if (flagged.length === 0) return pass('C3', 'Character Proximity')
  return makeResult('C3', 'Character Proximity', 'warning',
    `P${player}: Attached character(s) separated from their unit: ${flagged.join(', ')}`,
    'Move flagged characters within attachment range of their unit.',
    'soft', `player_${player}`)
}

// ─── CHECK GROUP D — Objective Visibility ─────────────────────────────────────

function checkD1(objectives, terrain) {
  if (!objectives?.length) return skip('D1', 'Objective Accessibility', 'No objectives defined.')
  // Simplified: flag any objective whose center is within the footprint of a terrain piece
  const blocked = objectives.filter(obj => {
    return terrain.some(t => {
      const hw = (t.footprintWPx || 0) / 2
      const hh = (t.footprintHPx || hw) / 2
      return obj.xPx > t.xPx - hw && obj.xPx < t.xPx + hw && obj.yPx > t.yPx - hh && obj.yPx < t.yPx + hh
    })
  })
  if (blocked.length === 0) return pass('D1', 'Objective Accessibility')
  return makeResult('D1', 'Objective Accessibility', 'warning',
    `${blocked.length} objective(s) may be within terrain footprints: ${blocked.map(o => o.label).join(', ')}`,
    'Verify these objectives are accessible from at least one side.',
    'soft', 'both')
}

function checkD2(objectives) {
  if (!objectives?.length) return skip('D2', 'OBJ Wall Blocking', 'No objectives defined.')
  const wallBlocked = objectives.filter(o => o.hasWallSymbol)
  if (wallBlocked.length === 0) return skip('D2', 'OBJ Wall Blocking', 'No wall-symbol objectives on this map.')
  // Cannot programmatically check pre-game control; return informational warning
  return makeResult('D2', 'OBJ Wall Blocking', 'warning',
    `${wallBlocked.length} objective(s) have the wall-blocking symbol: ${wallBlocked.map(o => o.label).join(', ')}. Neither player may control these from the blocked side.`,
    'Verify no units are pre-positioned to control from the blocked wall side.',
    'soft', 'both')
}

function checkD3(objectives, mapObjectivePositions) {
  if (!objectives?.length) return skip('D3', 'Objective Marker Placement', 'No objectives defined.')
  if (!mapObjectivePositions?.length) return skip('D3', 'Objective Marker Placement', 'No reference positions for this map.')
  const misplaced = []
  for (const obj of objectives) {
    const ref = mapObjectivePositions.find(r => r.label === obj.label)
    if (!ref) continue
    const d = pxToInch(dist(obj, ref), 20)
    if (d > 0.5) misplaced.push(`${obj.label}: ${d.toFixed(2)}" off`)
  }
  if (misplaced.length === 0) return pass('D3', 'Objective Marker Placement')
  return makeResult('D3', 'Objective Marker Placement', 'fail',
    `Misplaced objective(s): ${misplaced.join(', ')}`,
    'Reposition flagged objectives to their official WTC map positions.',
    'hard', 'both')
}

// ─── Main Validator ───────────────────────────────────────────────────────────

export function runValidation(strictMode = false) {
  const boardState = load(KEYS.boardState)
  const manifestP1 = load(KEYS.activeListP1)
  const manifestP2 = load(KEYS.activeListP2)

  if (!boardState) {
    return {
      error: 'Board state required to run validation.',
      legal_to_play: false,
      generated_at: new Date().toISOString(),
    }
  }

  const {
    terrain = [],
    objectives = [],
    deploymentType,
    mapNumber,
    mapCoords,
    mapObjectivePositions,
    boardWPx = 1200,
    boardHPx = 880,
    scale = 20,
    deploymentZones = {},
    expectedTerrainCount,
  } = boardState

  const tolerance = strictMode ? TOLERANCE_STRICT : TOLERANCE_IN

  const results = []

  // Group A
  results.push(checkA1(terrain, mapCoords, tolerance, scale))
  results.push(checkA2(terrain, deploymentType, mapNumber))
  results.push(checkA3(terrain, expectedTerrainCount))
  results.push(checkA4(terrain))
  results.push(checkA5(terrain))
  results.push(checkA6(terrain, boardWPx, boardHPx))

  // Group B + C — per player
  for (const [player, manifestKey] of [[1, manifestP1], [2, manifestP2]]) {
    const manifest = manifestKey
    const zoneKey = `player_${player}`
    const zonePolygon = deploymentZones[zoneKey]

    if (!manifest) {
      ;['B1','B2','B3','B4','B5'].forEach(id => results.push(skip(id, CHECK_NAMES[id], `No P${player} manifest loaded.`)))
      ;['C1','C2','C3'].forEach(id => results.push(skip(id, CHECK_NAMES[id], `No P${player} manifest loaded.`)))
      continue
    }

    const units = manifest.units || []
    results.push(checkB1(units, zonePolygon, player))
    results.push(checkB2(units, player))
    results.push(checkB3(units, player))
    results.push(checkB4(units, terrain, player))
    results.push(checkB5(units, terrain, player))
    results.push(checkC1(units, player, scale))
    results.push(checkC2(units, player))
    results.push(checkC3(units, player, scale))
  }

  // Group D
  results.push(checkD1(objectives, terrain))
  results.push(checkD2(objectives))
  results.push(checkD3(objectives, mapObjectivePositions))

  // Score
  let hardFails = 0, warnings = 0, passed = 0, skipped = 0
  for (const r of results) {
    if (strictMode && r.result === 'warning') r.result = 'fail'
    if (r.result === 'fail') hardFails++
    else if (r.result === 'warning') warnings++
    else if (r.result === 'pass') passed++
    else if (r.result === 'skip') skipped++
  }

  const overall = hardFails > 0 ? 'illegal' : warnings > 0 ? 'needs_review' : 'legal'

  return {
    map: { deployment_type: deploymentType, map_number: mapNumber, pack_version: 'WTC 2026 v2.4' },
    summary: {
      overall,
      hard_fails: hardFails,
      warnings,
      checks_run: results.length - skipped,
      checks_passed: passed,
      checks_skipped: skipped,
    },
    results,
    legal_to_play: hardFails === 0,
    generated_at: new Date().toISOString(),
  }
}

const CHECK_NAMES = {
  A1: 'Coordinate Accuracy', A2: 'Container Gap Rule', A3: 'Terrain Piece Count',
  A4: 'Terrain Type Assignment', A5: 'Footprint Overlap', A6: 'Board Boundary',
  B1: 'Unit in Deployment Zone', B2: 'Reserves Declared', B3: 'Infiltrators Unplaced',
  B4: 'Unit Within Terrain', B5: 'Base Overlap',
  C1: 'Squad Coherency', C2: 'Unit Completeness', C3: 'Character Proximity',
  D1: 'Objective Accessibility', D2: 'OBJ Wall Blocking', D3: 'Objective Marker Placement',
}

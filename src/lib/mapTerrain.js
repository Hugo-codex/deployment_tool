// Map & Terrain Agent — builds board state from WTC v2.4 coordinates

import { MAP_COORDS, TERRAIN_TYPES, BETA_MAPS, DEPLOYMENT_ZONES, BOARD } from '../constants/wtcMaps.js'
import { inchToPx } from '../utils/geometry.js'

const DEFAULT_SCALE = 20 // px/inch

// Parse "(X-Y)(X-Y)..." coordinate string → array of {xInch, yInch}
function parseCoords(str) {
  if (!str) return []
  const matches = [...str.matchAll(/\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/g)]
  return matches.map(m => ({ xInch: parseFloat(m[1]), yInch: parseFloat(m[2]) }))
}

// Assign terrain type based on position heuristics (best-effort without visual map)
// In production the map images would encode this; for now alternate ruin/container
function assignTerrainType(index, deploymentType) {
  // Containers appear less frequently — assign every 4th piece as container
  if (index % 4 === 3) return 'containers'
  return index % 3 === 0 ? 'three_storey_ruin' : 'two_storey_ruin'
}

// Build deployment zone polygons in px
function buildZones(deploymentType, scale) {
  const bw = inchToPx(BOARD.width, scale)
  const bh = inchToPx(BOARD.height, scale)
  const zones = DEPLOYMENT_ZONES[deploymentType]
  if (!zones) return {}

  function zoneRect(config) {
    const depth = inchToPx(config.depth || 9, scale)
    switch (config.edge) {
      case 'bottom': return [{ x: 0, y: bh - depth }, { x: bw, y: bh - depth }, { x: bw, y: bh }, { x: 0, y: bh }]
      case 'top':    return [{ x: 0, y: 0 }, { x: bw, y: 0 }, { x: bw, y: depth }, { x: 0, y: depth }]
      case 'left':   return [{ x: 0, y: 0 }, { x: depth, y: 0 }, { x: depth, y: bh }, { x: 0, y: bh }]
      case 'right':  return [{ x: bw - depth, y: 0 }, { x: bw, y: 0 }, { x: bw, y: bh }, { x: bw - depth, y: bh }]
      default:       return []
    }
  }

  const p1 = zones.p1.type === 'strip' ? zoneRect(zones.p1) : buildSpecialZone(zones.p1, bw, bh)
  const p2 = zones.p2.type === 'strip' ? zoneRect(zones.p2) : buildSpecialZone(zones.p2, bw, bh)
  return { player_1: { polygon: p1 }, player_2: { polygon: p2 } }
}

function buildSpecialZone(config, bw, bh) {
  const d = bh * 0.4 // approximate diagonal zones
  if (config.corner === 'bottom-left') return [{ x: 0, y: bh }, { x: d, y: bh }, { x: 0, y: bh - d }]
  if (config.corner === 'top-right')   return [{ x: bw, y: 0 }, { x: bw - d, y: 0 }, { x: bw, y: d }]
  return []
}

// Standard objective positions (center of board + quadrant positions)
function buildObjectives(deploymentType, mapKey, scale) {
  const bw = inchToPx(BOARD.width, scale)
  const bh = inchToPx(BOARD.height, scale)
  const center = { x: bw / 2, y: bh / 2 }

  const objectives = [{ id: 'obj_center', xPx: center.x, yPx: center.y, radiusPx: inchToPx(3, scale), wallBlocked: false }]

  // Flanking objectives
  objectives.push(
    { id: 'obj_p1_left',  xPx: bw * 0.2, yPx: bh * 0.8, radiusPx: inchToPx(3, scale), wallBlocked: false },
    { id: 'obj_p1_right', xPx: bw * 0.8, yPx: bh * 0.8, radiusPx: inchToPx(3, scale), wallBlocked: false },
    { id: 'obj_p2_left',  xPx: bw * 0.2, yPx: bh * 0.2, radiusPx: inchToPx(3, scale), wallBlocked: false },
    { id: 'obj_p2_right', xPx: bw * 0.8, yPx: bh * 0.2, radiusPx: inchToPx(3, scale), wallBlocked: false },
  )

  return objectives
}

// Main entry point
export function buildBoardState(deploymentType, mapNumber, scale = DEFAULT_SCALE) {
  const mapKey = String(mapNumber).replace('-', '_')
  const coordString = MAP_COORDS[deploymentType]?.[mapKey]
  const isBeta = BETA_MAPS.has(`${deploymentType}:${mapKey}`)

  const coords = parseCoords(coordString || '')
  const warnings = []

  if (isBeta) warnings.push({ type: 'beta_map', message: `Map ${mapNumber} for ${deploymentType} is BETA — subject to change.` })
  if (!coordString) warnings.push({ type: 'missing_coords', message: `No coordinates found for ${deploymentType} map ${mapNumber}.` })

  const terrain = coords.map((coord, i) => {
    const type = assignTerrainType(i, deploymentType)
    const dims = TERRAIN_TYPES[type]
    return {
      id: `terrain_${String(i + 1).padStart(2, '0')}`,
      type,
      label: dims.label,
      xInch: coord.xInch,
      yInch: coord.yInch,
      xPx: inchToPx(coord.xInch, scale),
      yPx: inchToPx(BOARD.height - coord.yInch, scale), // flip Y (canvas Y=0 at top)
      footprintWPx: inchToPx(dims.footprintW, scale),
      footprintHPx: inchToPx(dims.footprintH, scale),
      heightInch: dims.height,
      rotation: 0,
      specialRules: [],
    }
  })

  const zones = buildZones(deploymentType, scale)
  const objectives = buildObjectives(deploymentType, mapKey, scale)

  return {
    board: { widthInch: BOARD.width, heightInch: BOARD.height, widthPx: inchToPx(BOARD.width, scale), heightPx: inchToPx(BOARD.height, scale), canvasScale: scale },
    deployment: { type: deploymentType, mapNumber, isBeta, zones },
    terrain,
    objectives,
    specialRules: [],
    warnings,
    builtAt: new Date().toISOString(),
  }
}

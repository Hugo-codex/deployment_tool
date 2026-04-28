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

// WTC coords are for one half of the board (X 0-30, Y 0-22).
// Mirror each piece to its symmetric counterpart across the board center.
// fullCoords is interleaved: [orig0, mirror0, orig1, mirror1, ...]
function mirrorCoords(coords) {
  const result = []
  for (const c of coords) {
    result.push(c)
    result.push({ xInch: BOARD.width - c.xInch, yInch: BOARD.height - c.yInch })
  }
  return result
}

// Rotation sequence matching the diagonal/angled ruins visible in WTC/GW layouts
// Applied per half-board index so original and mirror share the same rotation
const ROTATION_SEQ = [30, -25, 45, 0, -35, 25, -45, 0, 35, -20, 30, -30, 0, 40, -28, 22]

// Type + rotation assignment per half-board index (i.e. Math.floor(fullIndex / 2))
// Pattern: 3 ruins then 1 container, repeating. Ruins alternate 3-storey / 2-storey.
function getTerrainMeta(halfIndex) {
  const posInCycle = halfIndex % 4
  if (posInCycle === 3) {
    // Container: always axis-aligned
    return { type: 'container', rotationDeg: 0 }
  }
  // Ruin: alternate 3-storey and 2-storey
  const ruinRank = Math.floor(halfIndex / 4) * 3 + posInCycle
  const type = ruinRank % 3 === 2 ? '2_storey_ruin' : '3_storey_ruin'
  const rotationDeg = ROTATION_SEQ[halfIndex % ROTATION_SEQ.length]
  return { type, rotationDeg }
}

// Build deployment zone polygon in px — returns array of {x, y} points
function buildZonePolygon(config, bw, bh, scale) {
  const depth = inchToPx(config.depth || 9, scale)
  switch (config.edge) {
    case 'bottom': return [{ x: 0, y: bh - depth }, { x: bw, y: bh - depth }, { x: bw, y: bh }, { x: 0, y: bh }]
    case 'top':    return [{ x: 0, y: 0 }, { x: bw, y: 0 }, { x: bw, y: depth }, { x: 0, y: depth }]
    case 'left':   return [{ x: 0, y: 0 }, { x: depth, y: 0 }, { x: depth, y: bh }, { x: 0, y: bh }]
    case 'right':  return [{ x: bw - depth, y: 0 }, { x: bw, y: 0 }, { x: bw, y: bh }, { x: bw - depth, y: bh }]
    default:       return []
  }
}

function buildSpecialZone(config, bw, bh, scale) {
  // Crucible of Battle / Sweeping Engagement corner zones
  // Each zone is a triangle from a board corner, depth = inches from each adjacent edge
  const d = config.depth ? inchToPx(config.depth, scale) : Math.min(bw, bh) * 0.4
  if (config.corner === 'bottom-left') return [{ x: 0, y: bh }, { x: d, y: bh }, { x: 0, y: bh - d }]
  if (config.corner === 'top-right')   return [{ x: bw, y: 0 }, { x: bw - d, y: 0 }, { x: bw, y: d }]
  if (config.corner === 'bottom-right') return [{ x: bw, y: bh }, { x: bw - d, y: bh }, { x: bw, y: bh - d }]
  if (config.corner === 'top-left')     return [{ x: 0, y: 0 }, { x: d, y: 0 }, { x: 0, y: d }]
  return []
}

function buildZones(deploymentType, scale) {
  const bw = inchToPx(BOARD.width, scale)
  const bh = inchToPx(BOARD.height, scale)
  const zoneDef = DEPLOYMENT_ZONES[deploymentType]
  if (!zoneDef) return {}

  const p1 = zoneDef.p1.type === 'strip'
    ? buildZonePolygon(zoneDef.p1, bw, bh, scale)
    : buildSpecialZone(zoneDef.p1, bw, bh, scale)
  const p2 = zoneDef.p2.type === 'strip'
    ? buildZonePolygon(zoneDef.p2, bw, bh, scale)
    : buildSpecialZone(zoneDef.p2, bw, bh, scale)

  return { player_1: p1, player_2: p2 }
}

// Standard WTC objective positions per deployment type
function buildObjectives(deploymentType, scale) {
  const bw = inchToPx(BOARD.width, scale)
  const bh = inchToPx(BOARD.height, scale)

  const obj = (id, xFrac, yFrac, label, hasWallSymbol = false) => ({
    id,
    label,
    xPx: bw * xFrac,
    yPx: bh * yFrac,
    hasWallSymbol,
  })

  // Deployment type drives objective layout
  switch (deploymentType) {
    case 'hammer_and_anvil':
      return [
        obj('obj_c',    0.5,  0.5,  'C'),
        obj('obj_p1_l', 0.25, 0.82, 'P1L'),
        obj('obj_p1_r', 0.75, 0.82, 'P1R'),
        obj('obj_p2_l', 0.25, 0.18, 'P2L'),
        obj('obj_p2_r', 0.75, 0.18, 'P2R'),
      ]
    case 'search_and_destroy':
      return [
        obj('obj_c',    0.5,  0.5,  'C'),
        obj('obj_p1_t', 0.18, 0.25, 'P1T'),
        obj('obj_p1_b', 0.18, 0.75, 'P1B'),
        obj('obj_p2_t', 0.82, 0.25, 'P2T'),
        obj('obj_p2_b', 0.82, 0.75, 'P2B'),
      ]
    default:
      return [
        obj('obj_c',    0.5,  0.5,  'C'),
        obj('obj_1',    0.25, 0.25, '1'),
        obj('obj_2',    0.75, 0.25, '2'),
        obj('obj_3',    0.25, 0.75, '3'),
        obj('obj_4',    0.75, 0.75, '4'),
      ]
  }
}

// Main entry point
export function buildBoardState(deploymentType, mapNumber, scale = DEFAULT_SCALE) {
  const mapKey = String(mapNumber)
  // MAP_COORDS may use '4_5' style keys for combined maps
  const coordKey = mapKey === '4' || mapKey === '5' ? '4_5' : mapKey
  const coordString = MAP_COORDS[deploymentType]?.[coordKey]
  const isBeta = BETA_MAPS.has(`${deploymentType}:${mapKey}`)

  const halfCoords = parseCoords(coordString || '')
  const fullCoords = mirrorCoords(halfCoords)
  const warnings = []

  if (isBeta) warnings.push({ type: 'beta_map', message: `Map ${mapNumber} for ${deploymentType} is BETA.` })
  if (!coordString) warnings.push({ type: 'missing_coords', message: `No coordinates for ${deploymentType} map ${mapNumber}. Board is empty.` })

  const boardWPx = inchToPx(BOARD.width, scale)
  const boardHPx = inchToPx(BOARD.height, scale)

  const terrain = fullCoords.map((coord, i) => {
    const halfIndex = Math.floor(i / 2)   // original and mirror share the same half-index
    const { type: terrainType, rotationDeg } = getTerrainMeta(halfIndex)

    // Dimension lookup — map canonical type → TERRAIN_TYPES key
    const typeKeyMap = {
      '3_storey_ruin': 'three_storey_ruin',
      '2_storey_ruin': 'two_storey_ruin',
      container:       'containers',
      prototype:       'prototype_ruin',
    }
    const dims = TERRAIN_TYPES[typeKeyMap[terrainType]] ?? TERRAIN_TYPES.two_storey_ruin

    return {
      id: `terrain_${String(i + 1).padStart(2, '0')}`,
      terrainType,      // canonical: '3_storey_ruin' | '2_storey_ruin' | 'container' | 'prototype'
      label: `T${String(i + 1).padStart(2, '0')}`,
      terrainLabel: dims.label,
      xInch: coord.xInch,
      yInch: coord.yInch,
      xPx:   inchToPx(coord.xInch, scale),
      yPx:   inchToPx(BOARD.height - coord.yInch, scale), // flip Y: WTC origin bottom-left, canvas top-left
      footprintWPx: inchToPx(dims.footprintW, scale),
      footprintHPx: inchToPx(dims.footprintH, scale),
      heightInch: dims.height,
      rotationDeg,      // degrees clockwise — used by BoardView canvas renderer
    }
  })

  const deploymentZones = buildZones(deploymentType, scale)
  const objectives = buildObjectives(deploymentType, scale)

  // Flat structure — all consumers read from the top level
  return {
    deploymentType,
    mapNumber,
    isBeta,
    scale,
    boardWPx,
    boardHPx,
    terrain,
    objectives,
    deploymentZones,        // { player_1: [{x,y},...], player_2: [{x,y},...] }
    expectedTerrainCount: fullCoords.length,
    warnings,
    builtAt: new Date().toISOString(),
  }
}

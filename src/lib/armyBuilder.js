// Army Builder Agent — generates canvas-ready unit manifest from resolved roster

import { inchToPx, deploymentZonePolygon } from '../utils/geometry.js'

const CANVAS_W = 1200
const CANVAS_H = 880
const SCALE = 20 // px/inch
const BOARD_W_INCH = 60
const BOARD_H_INCH = 44

// Short display label — max 20 chars
function makeLabel(name, count, player) {
  const abbrevMap = {
    'Intercessor': 'INTER', 'Terminator': 'TERM', 'Captain': 'CAPT',
    'Lieutenant': 'LT', 'Sergeant': 'SGT', 'Devastator': 'DEV',
    'Intercessors': 'INTER', 'Terminators': 'TERM', 'Devastators': 'DEV',
    'Dreadnought': 'DREAD', 'Predator': 'PRED', 'Rhino': 'RHINO',
    'Land Raider': 'LR', 'Thunderhawk': 'THAWK', 'Knight': 'KNT',
    'Guardsman': 'GRD', 'Warrior': 'WAR', 'Immortal': 'IMM',
  }
  let abbrev = name
  for (const [long, short] of Object.entries(abbrevMap)) {
    abbrev = abbrev.replace(new RegExp(long, 'i'), short)
  }
  abbrev = abbrev.replace(/\s+/g, '-').toUpperCase().slice(0, 14)
  const suffix = count > 1 ? ` x${count}` : ''
  const playerTag = ` [P${player}]`
  return (abbrev + suffix + playerTag).slice(0, 20)
}

// Distribute units across deployment zone in a grid
function suggestInitialPositions(units, deploymentType, player, scale = SCALE) {
  const boardWPx = inchToPx(BOARD_W_INCH, scale)
  const boardHPx = inchToPx(BOARD_H_INCH, scale)

  // Simple strip zones (hammer and anvil, search and destroy)
  let startX, startY, rangeX, rangeY
  const zoneDepthPx = inchToPx(9, scale)

  switch (deploymentType) {
    case 'hammer_and_anvil':
    case 'tipping_point':
    case 'dawn_of_war': {
      const depthPx = deploymentType === 'tipping_point' ? inchToPx(6, scale) : deploymentType === 'dawn_of_war' ? inchToPx(12, scale) : zoneDepthPx
      startX = 40; rangeX = boardWPx - 80
      startY = player === 1 ? boardHPx - depthPx + 20 : 20
      rangeY = depthPx - 40
      break
    }
    case 'search_and_destroy': {
      startX = player === 1 ? 20 : boardWPx - zoneDepthPx + 20
      rangeX = zoneDepthPx - 40
      startY = 40; rangeY = boardHPx - 80
      break
    }
    default:
      startX = player === 1 ? 20 : boardWPx * 0.6
      rangeX = boardWPx * 0.35
      startY = player === 1 ? boardHPx * 0.65 : 20
      rangeY = boardHPx * 0.3
  }

  const cols = Math.max(1, Math.floor(rangeX / 60))
  return units.map((u, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      xPx: startX + col * 65,
      yPx: startY + row * 65,
      xInch: (startX + col * 65) / scale,
      yInch: (startY + row * 65) / scale,
      placed: false,
    }
  })
}

// Build canvas-ready unit manifest from resolved roster
export function buildUnitManifest(resolvedRoster, deploymentType = 'hammer_and_anvil', player = 1) {
  const positions = suggestInitialPositions(resolvedRoster.units, deploymentType, player)
  const warnings = []

  const units = resolvedRoster.units.map((u, i) => {
    const base = u.base
    const hasBase = base?.sizePrimaryMm != null

    if (!hasBase) {
      warnings.push({ unit: u.parsedName, message: 'Base size unknown — defaulting to 32mm round. Please verify.' })
    }

    const sizePx = hasBase
      ? inchToPx((base.sizePrimaryMm / 25.4), SCALE) // mm → inches → px
      : inchToPx(32 / 25.4, SCALE)

    return {
      id: u.id,
      name: u.parsedName,
      displayLabel: makeLabel(u.parsedName, u.modelCount, player),
      modelCount: u.modelCount,
      base: {
        shape: base?.shape || 'round',
        sizePrimaryMm: base?.sizePrimaryMm || 32,
        sizeSecondaryMm: base?.sizeSecondaryMm || null,
        sizePx,
        wtcVerified: u.matchConfidence >= 0.75,
        sizeAmbiguous: base?.sizeAmbiguous || false,
        sizeUnknown: !hasBase,
        heightCapMm: base?.heightCapMm || null,
      },
      placement: positions[i] || { xPx: 60, yPx: 60, xInch: 3, yInch: 3, placed: false },
      unitRole: null,
      player,
      needsReview: u.flags.needsReview,
    }
  })

  return {
    player,
    faction: resolvedRoster.metadata.faction,
    totalUnits: units.length,
    deploymentType,
    units,
    warnings,
    builtAt: new Date().toISOString(),
  }
}

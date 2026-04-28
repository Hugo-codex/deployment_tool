// Geometry utilities — inch ↔ px conversion, arc math, collision

export const DEFAULT_SCALE = 20 // px per inch

export function inchToPx(inches, scale = DEFAULT_SCALE) {
  return inches * scale
}

export function pxToInch(px, scale = DEFAULT_SCALE) {
  return px / scale
}

// Snap to nearest 0.5" increment
export function snapToHalfInch(inches) {
  return Math.round(inches * 2) / 2
}

// Distance between two points in px
export function distancePx(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

// Distance in inches given px coords and scale
export function distanceInches(x1, y1, x2, y2, scale = DEFAULT_SCALE) {
  return pxToInch(distancePx(x1, y1, x2, y2), scale)
}

// Check if two round bases overlap (circles)
export function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  return distancePx(x1, y1, x2, y2) < r1 + r2
}

// Check if a point (px) is inside a rectangle
export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
}

// Deployment zone polygon for a given type (returns pixel polygon as array of {x,y})
// boardW and boardH are in pixels
export function deploymentZonePolygon(deploymentType, player, boardW, boardH, scale = DEFAULT_SCALE) {
  const d9 = inchToPx(9, scale)
  const d6 = inchToPx(6, scale)
  const d12 = inchToPx(12, scale)

  switch (deploymentType) {
    case 'hammer_and_anvil':
      return player === 1
        ? [{ x: 0, y: boardH - d9 }, { x: boardW, y: boardH - d9 }, { x: boardW, y: boardH }, { x: 0, y: boardH }]
        : [{ x: 0, y: 0 }, { x: boardW, y: 0 }, { x: boardW, y: d9 }, { x: 0, y: d9 }]

    case 'search_and_destroy':
      return player === 1
        ? [{ x: 0, y: 0 }, { x: d9, y: 0 }, { x: d9, y: boardH }, { x: 0, y: boardH }]
        : [{ x: boardW - d9, y: 0 }, { x: boardW, y: 0 }, { x: boardW, y: boardH }, { x: boardW - d9, y: boardH }]

    case 'tipping_point':
      return player === 1
        ? [{ x: 0, y: boardH - d6 }, { x: boardW, y: boardH - d6 }, { x: boardW, y: boardH }, { x: 0, y: boardH }]
        : [{ x: 0, y: 0 }, { x: boardW, y: 0 }, { x: boardW, y: d6 }, { x: 0, y: d6 }]

    case 'dawn_of_war':
      return player === 1
        ? [{ x: 0, y: boardH - d12 }, { x: boardW, y: boardH - d12 }, { x: boardW, y: boardH }, { x: 0, y: boardH }]
        : [{ x: 0, y: 0 }, { x: boardW, y: 0 }, { x: boardW, y: d12 }, { x: 0, y: d12 }]

    case 'crucible_of_battle':
      // Triangle: bottom-left for P1, top-right for P2
      return player === 1
        ? [{ x: 0, y: boardH }, { x: d9 * 2, y: boardH }, { x: 0, y: boardH - d9 * 2 }]
        : [{ x: boardW, y: 0 }, { x: boardW - d9 * 2, y: 0 }, { x: boardW, y: d9 * 2 }]

    case 'sweeping_engagement':
      // Diagonal split — approximate with a triangle
      return player === 1
        ? [{ x: 0, y: boardH }, { x: boardW * 0.4, y: boardH }, { x: 0, y: boardH * 0.4 }]
        : [{ x: boardW, y: 0 }, { x: boardW * 0.6, y: 0 }, { x: boardW, y: boardH * 0.6 }]

    default:
      return []
  }
}

// Check if a point is inside a polygon (ray casting)
export function pointInPolygon(px, py, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

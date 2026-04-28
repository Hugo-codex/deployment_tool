// Overlay Manager — arc/ruler/marker state for the measurement overlay canvas
// Arcs always originate from base EDGE, never center
// All state persisted to localStorage via wtc_overlay_state

import { load, save, KEYS } from '../utils/storage.js'
import { RANGE_TYPES } from '../constants/rangeTypes.js'

const DEFAULT_SCALE = 20 // px/inch
const SNAP_INCREMENT = 0.5 // snap to nearest 0.5"

// ─── State bootstrap ──────────────────────────────────────────────────────────

export function loadOverlayState() {
  return load(KEYS.overlayState) ?? freshState()
}

function freshState() {
  return {
    canvas_scale: DEFAULT_SCALE,
    display_mode: 'combined',
    active_layers: ['move', 'charge'],
    markers: [],
    layers: Object.fromEntries(
      Object.keys(RANGE_TYPES).map(k => [k, { visible: false, scope: 'all' }])
    ),
  }
}

function persist(state) {
  save(KEYS.overlayState, state)
  return state
}

// ─── Arc geometry helpers ─────────────────────────────────────────────────────

// Returns the pixel radius of the arc FROM the base edge for a given range
export function arcRadiusPx(unit, rangeInches, scale = DEFAULT_SCALE) {
  const baseRadiusPx = unit.base.sizePx / 2
  return baseRadiusPx + rangeInches * scale
}

// For oval bases (secondary size): use the longer half-axis as the edge reference
export function baseRadiusPx(unit) {
  const primary = unit.base.sizePx / 2
  if (unit.base.shape === 'oval' && unit.base.sizeSecondaryMm) {
    const secondary = (unit.base.sizeSecondaryMm / 25.4) * DEFAULT_SCALE / 2
    return Math.max(primary, secondary)
  }
  return primary
}

// Ruler snap: nearest 0.5"
export function snapInches(rawInches) {
  return Math.round(rawInches / SNAP_INCREMENT) * SNAP_INCREMENT
}

export function pixelDistanceToInches(dx, dy, scale = DEFAULT_SCALE) {
  return Math.sqrt(dx ** 2 + dy ** 2) / scale
}

// ─── Marker factory ───────────────────────────────────────────────────────────

function makeId() {
  return `marker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function resolveColor(rangeType, colorOverride) {
  if (colorOverride && /^#[0-9a-fA-F]{3,6}$/.test(colorOverride)) return colorOverride
  return RANGE_TYPES[rangeType]?.color ?? '#FFFFFF'
}

function resolveLabel(rangeType, labelOverride, rangeInches) {
  if (labelOverride) return labelOverride
  const base = RANGE_TYPES[rangeType]?.label ?? rangeType.toUpperCase()
  return rangeInches != null ? `${base} ${rangeInches}"` : base
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

// arc_add — add a persistent range arc to a unit or freestanding anchor
export function addArc(params, unitManifest) {
  const state = loadOverlayState()
  const {
    unit_id, anchor_x_px, anchor_y_px,
    range_type = 'shoot', range_inches,
    display_mode = null, color = null, label = null,
    show_label = true, player = null,
  } = params

  let unit = null
  let cx = anchor_x_px, cy = anchor_y_px

  if (unit_id) {
    unit = unitManifest?.units?.find(u => u.id === unit_id)
    if (!unit) {
      return { error: `Unit ID "${unit_id}" not found in manifest.`, state }
    }
    cx = unit.placement.xPx
    cy = unit.placement.yPx
  }

  const rType = RANGE_TYPES[range_type] ?? RANGE_TYPES.custom
  const inches = range_inches ?? rType.defaultInches
  if (inches == null || inches <= 0) {
    return { error: 'Range must be greater than 0 inches.', state }
  }

  const scale = state.canvas_scale
  const baseEdgePx = unit ? baseRadiusPx(unit) : 0
  const rangePx = baseEdgePx + inches * scale

  const marker = {
    id: makeId(),
    type: 'arc',
    range_type,
    unit_id: unit_id ?? null,
    anchor_x_px: cx,
    anchor_y_px: cy,
    base_edge_px: baseEdgePx,
    range_inches: inches,
    range_px: rangePx,
    color: resolveColor(range_type, color),
    label: resolveLabel(range_type, label, inches),
    show_label,
    display_mode: display_mode ?? state.display_mode,
    player,
    pinned: true,
    created_at: new Date().toISOString(),
  }

  state.markers.push(marker)
  return { marker, state: persist(state) }
}

// threat_calc — combined move + shoot arc
export function addThreatArc(params, unitManifest) {
  const state = loadOverlayState()
  const {
    unit_id, move_inches, shoot_inches,
    include_advance = false, color_override = null,
    show_label = true, player = null,
  } = params

  const unit = unitManifest?.units?.find(u => u.id === unit_id)
  if (!unit) return { error: `Unit ID "${unit_id}" not found in manifest.`, state }

  const scale = state.canvas_scale
  const baseEdgePx = baseRadiusPx(unit)
  const innerPx = baseEdgePx + move_inches * scale
  const outerPx = baseEdgePx + (move_inches + shoot_inches) * scale
  const advancePx = include_advance ? baseEdgePx + (move_inches + 6 + shoot_inches) * scale : null

  const color = resolveColor('threat', color_override)
  const labelStr = include_advance
    ? `MOVE ${move_inches}" + SHOOT ${shoot_inches}" = ${move_inches + shoot_inches}" THREAT (+ADV)`
    : `MOVE ${move_inches}" + SHOOT ${shoot_inches}" = ${move_inches + shoot_inches}" THREAT`

  const marker = {
    id: makeId(),
    type: 'threat',
    unit_id,
    anchor_x_px: unit.placement.xPx,
    anchor_y_px: unit.placement.yPx,
    move_inches,
    shoot_inches,
    include_advance,
    total_threat_inches: move_inches + shoot_inches,
    inner_range_px: innerPx,
    outer_range_px: outerPx,
    advance_range_px: advancePx,
    color,
    label: labelStr,
    show_label,
    player,
    pinned: true,
    created_at: new Date().toISOString(),
  }

  state.markers.push(marker)
  return { marker, state: persist(state) }
}

// marker_pin — pin a live ruler as a persistent marker
export function pinRuler(params) {
  const state = loadOverlayState()
  const {
    start_x_px, start_y_px, end_x_px, end_y_px,
    color = '#FFFFFF', label = null, show_label = true,
    label_color = null, player = null,
  } = params

  const scale = state.canvas_scale
  const dx = end_x_px - start_x_px
  const dy = end_y_px - start_y_px
  const rawInches = pixelDistanceToInches(dx, dy, scale)
  const snappedInches = snapInches(rawInches)

  const marker = {
    id: makeId(),
    type: 'ruler',
    start_x_px,
    start_y_px,
    end_x_px,
    end_y_px,
    length_inches: snappedInches,
    color,
    label: label ?? `${snappedInches}"`,
    label_color: label_color ?? color,
    show_label,
    player,
    pinned: true,
    created_at: new Date().toISOString(),
  }

  state.markers.push(marker)
  return { marker, state: persist(state) }
}

// marker_remove — remove one or all markers
export function removeMarker(params) {
  const state = loadOverlayState()
  const { marker_id } = params

  if (marker_id === 'all') {
    state.markers = []
  } else if (marker_id === 'all_player_1') {
    state.markers = state.markers.filter(m => m.player !== 1)
  } else if (marker_id === 'all_player_2') {
    state.markers = state.markers.filter(m => m.player !== 2)
  } else {
    state.markers = state.markers.filter(m => m.id !== marker_id)
  }

  return persist(state)
}

// layer_toggle — show/hide a named range layer
export function toggleLayer(params) {
  const state = loadOverlayState()
  const { layer_name, visible, scope = 'all' } = params

  if (!state.layers[layer_name]) {
    state.layers[layer_name] = { visible, scope }
  } else {
    state.layers[layer_name].visible = visible
    state.layers[layer_name].scope = scope
  }

  if (visible && !state.active_layers.includes(layer_name)) {
    state.active_layers.push(layer_name)
  } else if (!visible) {
    state.active_layers = state.active_layers.filter(l => l !== layer_name)
  }

  return persist(state)
}

// clear_all — reset overlay state by scope
export function clearOverlay(params = {}) {
  const state = loadOverlayState()
  const { scope = 'all' } = params

  if (scope === 'all') {
    return persist(freshState())
  }

  if (scope === 'player_1') state.markers = state.markers.filter(m => m.player !== 1)
  else if (scope === 'player_2') state.markers = state.markers.filter(m => m.player !== 2)
  else if (scope === 'arcs_only') state.markers = state.markers.filter(m => m.type === 'ruler')
  else if (scope === 'rulers_only') state.markers = state.markers.filter(m => m.type !== 'ruler')

  return persist(state)
}

// Live ruler measurement — not persisted, returns distance only
export function measureRuler(startXPx, startYPx, endXPx, endYPx, snapEnabled = true, scale = DEFAULT_SCALE) {
  const dx = endXPx - startXPx
  const dy = endYPx - startYPx
  const rawInches = pixelDistanceToInches(dx, dy, scale)
  const displayInches = snapEnabled ? snapInches(rawInches) : parseFloat(rawInches.toFixed(2))
  return {
    start_x_px: startXPx,
    start_y_px: startYPx,
    end_x_px: endXPx,
    end_y_px: endYPx,
    length_inches: displayInches,
    label: `${displayInches}"`,
  }
}

// export_overlay — snapshot current state
export function exportOverlay(format = 'json') {
  const state = loadOverlayState()
  if (format === 'json') {
    return JSON.stringify(state, null, 2)
  }
  // svg_layer: returns a minimal SVG string (shell for canvas renderer to fill)
  return `<svg xmlns="http://www.w3.org/2000/svg" data-overlay="wtc" data-markers="${state.markers.length}"></svg>`
}

// Update scale (when canvas is resized / settings changed)
export function setCanvasScale(newScale) {
  const state = loadOverlayState()
  state.canvas_scale = newScale
  return persist(state)
}

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { measureRuler } from '../lib/overlayManager.js'
import { RANGE_TYPES } from '../constants/rangeTypes.js'
import { clsx } from 'clsx'
import UnitRoster from './UnitRoster.jsx'
import OverlayToolbar from './OverlayToolbar.jsx'
import LayerPanel from './LayerPanel.jsx'

const CANVAS_W = 1200
const CANVAS_H = 880
const SCALE = 20 // px/inch

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

function drawBoard(ctx, boardState) {
  // Mat background — light grey/tan like a WTC gaming mat
  ctx.fillStyle = '#d6d2c8'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 1" grid — faint
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 0.5
  for (let x = SCALE; x < CANVAS_W; x += SCALE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
  }
  for (let y = SCALE; y < CANVAS_H; y += SCALE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke()
  }

  // 6" grid — slightly bolder
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 0.75
  for (let x = SCALE * 6; x < CANVAS_W; x += SCALE * 6) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
  }
  for (let y = SCALE * 6; y < CANVAS_H; y += SCALE * 6) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke()
  }

  // Board center × marker
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2, xs = 10
  ctx.strokeStyle = '#cc0000'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx - xs, cy - xs); ctx.lineTo(cx + xs, cy + xs); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + xs, cy - xs); ctx.lineTo(cx - xs, cy + xs); ctx.stroke()

  if (!boardState) return

  // Deployment zones — faint fill + red dashed boundary
  const zones = boardState.deploymentZones
  if (zones) {
    for (const poly of Object.values(zones)) {
      if (!Array.isArray(poly) || poly.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      poly.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = 'rgba(180,0,0,0.04)'
      ctx.fill()
      ctx.strokeStyle = '#cc0000'
      ctx.lineWidth = 1.5
      ctx.setLineDash([8, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Board border
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2)
}

function drawRuin(ctx, hw, hh) {
  // Grey fill
  ctx.fillStyle = '#8a8e8a'
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2)

  // Diagonal hatching (bottom-left to top-right, like WTC map images)
  ctx.save()
  ctx.beginPath()
  ctx.rect(-hw, -hh, hw * 2, hh * 2)
  ctx.clip()
  ctx.strokeStyle = '#6a6e6a'
  ctx.lineWidth = 1.2
  const spacing = 12
  const d = Math.max(hw, hh) * 2 + spacing
  ctx.beginPath()
  for (let i = -d; i < d * 2; i += spacing) {
    ctx.moveTo(i - hh, -hh)
    ctx.lineTo(i + hh, hh)
  }
  ctx.stroke()
  ctx.restore()

  // Border
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2)
}

function drawContainer(ctx, hw, hh) {
  // Solid blue, like in WTC maps
  ctx.fillStyle = '#4a7ab5'
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2)
  ctx.strokeStyle = '#2d5080'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2)
}

function drawTerrain(ctx, terrain = []) {
  for (const piece of terrain) {
    const hw = (piece.footprintWPx || 240) / 2
    const hh = (piece.footprintHPx || 120) / 2
    const rotRad = ((piece.rotationDeg ?? 0) * Math.PI) / 180

    ctx.save()
    ctx.translate(piece.xPx, piece.yPx)
    ctx.rotate(rotRad)

    if (piece.terrainType === 'container') {
      drawContainer(ctx, hw, hh)
    } else {
      drawRuin(ctx, hw, hh)
    }

    // Piece label centred (small, dark)
    ctx.fillStyle = piece.terrainType === 'container' ? '#dbeafe' : '#222'
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(piece.label ?? '', 0, 0)
    ctx.textBaseline = 'alphabetic'

    ctx.restore()
  }
}

function drawObjectives(ctx, objectives = []) {
  for (const obj of objectives) {
    const x = obj.xPx, y = obj.yPx, r = 12

    // Outer ring
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(204,0,0,0.12)'
    ctx.fill()
    ctx.strokeStyle = '#cc0000'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Inner dot
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#cc0000'
    ctx.fill()

    // Crosshair lines (⊕ style)
    ctx.strokeStyle = '#cc0000'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x - r - 4, y); ctx.lineTo(x - r + 4, y)
    ctx.moveTo(x + r - 4, y); ctx.lineTo(x + r + 4, y)
    ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y - r + 4)
    ctx.moveTo(x, y + r - 4); ctx.lineTo(x, y + r + 4)
    ctx.stroke()

    // Label below
    ctx.fillStyle = '#cc0000'
    ctx.font = 'bold 8px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(obj.label ?? '', x, y + r + 2)
    ctx.textBaseline = 'alphabetic'
  }
}

function drawUnits(ctx, units = [], player, selectedUnitId, hoveredUnitId) {
  const baseColor = player === 1 ? '#3b82f6' : '#f59e0b'
  const reserveColor = '#6b7280'

  for (const unit of units) {
    if (unit.inReserve || !unit.placement?.placed) continue

    const cx = unit.placement.xPx
    const cy = unit.placement.yPx
    const r = unit.base.sizePx / 2
    const isSelected = unit.id === selectedUnitId
    const isHovered = unit.id === hoveredUnitId

    // Base circle
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = isSelected
      ? (player === 1 ? 'rgba(59,130,246,0.5)' : 'rgba(245,158,11,0.5)')
      : (player === 1 ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)')
    ctx.fill()
    ctx.strokeStyle = isSelected ? '#fff' : isHovered ? baseColor : baseColor + 'cc'
    ctx.lineWidth = isSelected ? 2 : 1.5
    ctx.stroke()

    // Label
    ctx.fillStyle = '#e5e7eb'
    ctx.font = `${Math.max(7, Math.min(r * 0.6, 10))}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelText = unit.displayLabel?.slice(0, 10) ?? ''
    ctx.fillText(labelText, cx, cy)
    ctx.textBaseline = 'alphabetic'
  }
}

function drawOverlay(ctx, overlayState, snapEnabled, scale) {
  if (!overlayState?.markers) return

  for (const marker of overlayState.markers) {
    if (marker.type === 'ruler') {
      drawRuler(ctx, marker)
    } else if (marker.type === 'arc') {
      drawArc(ctx, marker, overlayState)
    } else if (marker.type === 'threat') {
      drawThreatArc(ctx, marker)
    }
  }
}

function drawRuler(ctx, marker) {
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = marker.color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(marker.start_x_px, marker.start_y_px)
  ctx.lineTo(marker.end_x_px, marker.end_y_px)
  ctx.stroke()
  ctx.setLineDash([])

  // Midpoint label
  if (marker.show_label) {
    const mx = (marker.start_x_px + marker.end_x_px) / 2
    const my = (marker.start_y_px + marker.end_y_px) / 2
    ctx.fillStyle = marker.color
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(marker.label, mx, my - 4)
  }
  ctx.restore()
}

function drawArc(ctx, marker, overlayState) {
  const { active_layers, layers } = overlayState
  const layerEntry = layers?.[marker.range_type]
  if (layerEntry && !layerEntry.visible && overlayState.display_mode !== 'ring') return

  ctx.save()
  ctx.beginPath()
  ctx.arc(marker.anchor_x_px, marker.anchor_y_px, marker.range_px, 0, Math.PI * 2)
  ctx.fillStyle = marker.color + '26' // 15% opacity
  ctx.fill()
  ctx.strokeStyle = marker.color + 'cc' // 80% opacity
  ctx.lineWidth = 2
  ctx.stroke()

  if (marker.show_label) {
    ctx.fillStyle = marker.color
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(marker.label, marker.anchor_x_px, marker.anchor_y_px - marker.range_px - 5)
  }
  ctx.restore()
}

function drawThreatArc(ctx, marker) {
  ctx.save()

  // Inner arc (move)
  ctx.beginPath()
  ctx.arc(marker.anchor_x_px, marker.anchor_y_px, marker.inner_range_px, 0, Math.PI * 2)
  ctx.strokeStyle = marker.color + '99'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Outer arc (move + shoot) with filled band
  ctx.beginPath()
  ctx.arc(marker.anchor_x_px, marker.anchor_y_px, marker.outer_range_px, 0, Math.PI * 2)
  ctx.fillStyle = marker.color + '1a'
  ctx.fill()
  ctx.strokeStyle = marker.color + 'cc'
  ctx.lineWidth = 2
  ctx.stroke()

  // Advance band (dotted)
  if (marker.advance_range_px) {
    ctx.beginPath()
    ctx.arc(marker.anchor_x_px, marker.anchor_y_px, marker.advance_range_px, 0, Math.PI * 2)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = marker.color + '88'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (marker.show_label) {
    ctx.fillStyle = marker.color
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(marker.label, marker.anchor_x_px, marker.anchor_y_px - marker.outer_range_px - 5)
  }
  ctx.restore()
}

function drawNoTerrainWarning(ctx, boardState) {
  if (!boardState || boardState.terrain?.length > 0) return
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(CANVAS_W / 2 - 220, CANVAS_H / 2 - 28, 440, 56)
  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const msg = boardState.warnings?.find(w => w.type === 'missing_coords')
    ? `No terrain data for ${boardState.deploymentType?.replace(/_/g, ' ')} — coordinates not yet in WTC v2.4`
    : 'No terrain pieces on this board.'
  ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

function drawLiveRuler(ctx, liveRuler) {
  if (!liveRuler) return
  ctx.save()
  ctx.setLineDash([6, 3])
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(liveRuler.start_x_px, liveRuler.start_y_px)
  ctx.lineTo(liveRuler.end_x_px, liveRuler.end_y_px)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(liveRuler.label, liveRuler.end_x_px, liveRuler.end_y_px - 8)
  ctx.restore()
}

// ─── BoardView ─────────────────────────────────────────────────────────────────

export default function BoardView() {
  const canvasRef = useRef(null)
  const boardState = useWTCStore(s => s.boardState)
  const activeListP1 = useWTCStore(s => s.activeListP1)
  const activeListP2 = useWTCStore(s => s.activeListP2)
  const overlayState = useWTCStore(s => s.overlayState)
  const selectedUnitId = useWTCStore(s => s.selectedUnitId)
  const hoveredUnitId = useWTCStore(s => s.hoveredUnitId)
  const liveRuler = useWTCStore(s => s.liveRuler)
  const showRulerTool = useWTCStore(s => s.showRulerTool)
  const showLayerPanel = useWTCStore(s => s.showLayerPanel)
  const settings = useWTCStore(s => s.settings)

  const moveUnit = useWTCStore(s => s.moveUnit)
  const selectUnit = useWTCStore(s => s.selectUnit)
  const hoverUnit = useWTCStore(s => s.hoverUnit)
  const setLiveRuler = useWTCStore(s => s.setLiveRuler)
  const pinCurrentRuler = useWTCStore(s => s.pinCurrentRuler)

  const dragging = useRef(null)
  const rulerStart = useRef(null)

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    drawBoard(ctx, boardState)
    drawTerrain(ctx, boardState?.terrain)
    drawObjectives(ctx, boardState?.objectives)
    if (activeListP1) drawUnits(ctx, activeListP1.units, 1, selectedUnitId, hoveredUnitId)
    if (activeListP2) drawUnits(ctx, activeListP2.units, 2, selectedUnitId, hoveredUnitId)
    drawNoTerrainWarning(ctx, boardState)
    drawOverlay(ctx, overlayState, settings.snapEnabled, SCALE)
    drawLiveRuler(ctx, liveRuler)
  }, [boardState, activeListP1, activeListP2, overlayState, selectedUnitId, hoveredUnitId, liveRuler, settings.snapEnabled])

  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  function findUnitAtPos(x, y) {
    // Check P2 first so P1 units render on top when stacked
    for (const [manifest, player] of [[activeListP2, 2], [activeListP1, 1]]) {
      if (!manifest) continue
      for (const unit of manifest.units) {
        if (unit.inReserve || !unit.placement?.placed) continue
        const r = Math.max(unit.base.sizePx / 2, 12) // minimum grab radius
        const dx = x - unit.placement.xPx
        const dy = y - unit.placement.yPx
        if (dx * dx + dy * dy <= r * r) return { unit, player }
      }
    }
    return null
  }

  const onMouseDown = useCallback((e) => {
    const { x, y } = getCanvasPos(e)

    if (showRulerTool) {
      rulerStart.current = { x, y }
      return
    }

    const hit = findUnitAtPos(x, y)
    if (hit) {
      dragging.current = { unitId: hit.unit.id, player: hit.player, offsetX: x - hit.unit.placement.xPx, offsetY: y - hit.unit.placement.yPx }
      selectUnit(hit.unit.id)
    } else {
      selectUnit(null)
    }
  }, [showRulerTool, getCanvasPos, findUnitAtPos, selectUnit])

  const onMouseMove = useCallback((e) => {
    const { x, y } = getCanvasPos(e)

    if (showRulerTool && rulerStart.current) {
      const ruler = measureRuler(rulerStart.current.x, rulerStart.current.y, x, y, settings.snapEnabled, SCALE)
      setLiveRuler(ruler)
      return
    }

    if (dragging.current) {
      const nx = x - dragging.current.offsetX
      const ny = y - dragging.current.offsetY
      moveUnit(dragging.current.unitId, dragging.current.player, nx, ny)
      return
    }

    const hit = findUnitAtPos(x, y)
    hoverUnit(hit?.unit.id ?? null)
  }, [showRulerTool, settings.snapEnabled, getCanvasPos, moveUnit, hoverUnit, setLiveRuler])

  const onMouseUp = useCallback((e) => {
    const { x, y } = getCanvasPos(e)

    if (showRulerTool && rulerStart.current) {
      // Pin ruler on mouse up
      const ruler = measureRuler(rulerStart.current.x, rulerStart.current.y, x, y, settings.snapEnabled, SCALE)
      pinCurrentRuler({
        start_x_px: ruler.start_x_px,
        start_y_px: ruler.start_y_px,
        end_x_px: ruler.end_x_px,
        end_y_px: ruler.end_y_px,
      })
      rulerStart.current = null
      setLiveRuler(null)
      return
    }

    dragging.current = null
  }, [showRulerTool, settings.snapEnabled, getCanvasPos, pinCurrentRuler, setLiveRuler])

  const onMouseLeave = useCallback(() => {
    dragging.current = null
    rulerStart.current = null
    setLiveRuler(null)
    hoverUnit(null)
  }, [setLiveRuler, hoverUnit])

  const cursorClass = showRulerTool ? 'canvas-cursor-crosshair' : dragging.current ? 'canvas-cursor-grabbing' : 'canvas-cursor-grab'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Unit roster sidebar */}
      <UnitRoster />

      {/* Canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
        <OverlayToolbar />
        <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={clsx('block max-w-full max-h-full object-contain border border-neutral-800 rounded', cursorClass)}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          />
        </div>
      </div>

      {/* Layer panel (conditional) */}
      {showLayerPanel && <LayerPanel />}
    </div>
  )
}

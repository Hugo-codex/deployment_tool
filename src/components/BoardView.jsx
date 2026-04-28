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
  if (!boardState) return
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Deployment zone overlays
  if (boardState.deploymentZones) {
    for (const [key, poly] of Object.entries(boardState.deploymentZones)) {
      if (!poly?.length) continue
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      poly.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = key.includes('1') ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)'
      ctx.fill()
      ctx.strokeStyle = key.includes('1') ? 'rgba(59,130,246,0.4)' : 'rgba(245,158,11,0.4)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // Board border
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2)

  // Inch grid (light)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  for (let x = SCALE; x < CANVAS_W; x += SCALE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
  }
  for (let y = SCALE; y < CANVAS_H; y += SCALE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke()
  }
}

function drawTerrain(ctx, terrain = []) {
  for (const piece of terrain) {
    const hw = (piece.footprintWPx || 120) / 2
    const hh = (piece.footprintHPx || hw) / 2
    ctx.fillStyle = 'rgba(120,80,40,0.25)'
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 1.5
    ctx.fillRect(piece.xPx - hw, piece.yPx - hh, hw * 2, hh * 2)
    ctx.strokeRect(piece.xPx - hw, piece.yPx - hh, hw * 2, hh * 2)

    ctx.fillStyle = '#a16207'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(piece.label ?? '', piece.xPx, piece.yPx + 3)
  }
}

function drawObjectives(ctx, objectives = []) {
  for (const obj of objectives) {
    ctx.beginPath()
    ctx.arc(obj.xPx, obj.yPx, 10, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(250,204,21,0.2)'
    ctx.fill()
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#facc15'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(obj.label ?? 'OBJ', obj.xPx, obj.yPx + 3)
  }
}

function drawUnits(ctx, units = [], player, selectedUnitId, hoveredUnitId) {
  const baseColor = player === 1 ? '#3b82f6' : '#f59e0b'
  const reserveColor = '#6b7280'

  for (const unit of units) {
    if (!unit.placement?.placed && !unit.inReserve) continue
    if (unit.inReserve) continue

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
    for (const [manifest, player] of [[activeListP2, 2], [activeListP1, 1]]) {
      if (!manifest) continue
      for (const unit of manifest.units) {
        if (!unit.placement?.placed) continue
        const r = unit.base.sizePx / 2
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

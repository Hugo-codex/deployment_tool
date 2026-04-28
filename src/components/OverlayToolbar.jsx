import React, { useState } from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { RANGE_TYPES, RANGE_GROUPS } from '../constants/rangeTypes.js'
import { clsx } from 'clsx'

function ArcAddPopover({ onClose }) {
  const selectedUnitId = useWTCStore(s => s.selectedUnitId)
  const activePlayer = useWTCStore(s => s.activePlayer)
  const addOverlayArc = useWTCStore(s => s.addOverlayArc)

  const [rangeType, setRangeType] = useState('shoot')
  const [inches, setInches] = useState(24)

  const grouped = {}
  for (const [key, val] of Object.entries(RANGE_TYPES)) {
    if (!grouped[val.group]) grouped[val.group] = []
    grouped[val.group].push({ key, ...val })
  }

  const handle = () => {
    addOverlayArc({
      unit_id: selectedUnitId || undefined,
      range_type: rangeType,
      range_inches: inches,
      player: activePlayer,
    })
    onClose()
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-neutral-800 border border-neutral-700 rounded shadow-xl p-3 w-56">
      <div className="text-xs font-bold text-neutral-300 mb-2">Add Range Arc</div>

      {!selectedUnitId && (
        <div className="text-xs text-amber-400 mb-2">No unit selected — arc will be freestanding.</div>
      )}

      <label className="text-xs text-neutral-400 block mb-1">Range type</label>
      <select
        value={rangeType}
        onChange={e => setRangeType(e.target.value)}
        className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-white mb-2"
      >
        {Object.entries(grouped).map(([group, types]) => (
          <optgroup key={group} label={RANGE_GROUPS[group] ?? group}>
            {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </optgroup>
        ))}
      </select>

      <label className="text-xs text-neutral-400 block mb-1">Range (inches)</label>
      <input
        type="number"
        min={1} max={72} step={1}
        value={inches}
        onChange={e => setInches(Number(e.target.value))}
        className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-white mb-3"
      />

      <div className="flex gap-2">
        <button onClick={handle} className="flex-1 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white">Add</button>
        <button onClick={onClose} className="flex-1 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300">Cancel</button>
      </div>
    </div>
  )
}

function ThreatCalcPopover({ onClose }) {
  const selectedUnitId = useWTCStore(s => s.selectedUnitId)
  const activePlayer = useWTCStore(s => s.activePlayer)
  const addThreatArc = useWTCStore(s => s.addThreatArc)
  const [move, setMove] = useState(6)
  const [shoot, setShoot] = useState(24)
  const [adv, setAdv] = useState(false)

  const handle = () => {
    if (!selectedUnitId) return
    addThreatArc({ unit_id: selectedUnitId, move_inches: move, shoot_inches: shoot, include_advance: adv, player: activePlayer })
    onClose()
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-neutral-800 border border-neutral-700 rounded shadow-xl p-3 w-52">
      <div className="text-xs font-bold text-neutral-300 mb-2">Threat Range</div>
      {!selectedUnitId && <div className="text-xs text-amber-400 mb-2">Select a unit first.</div>}
      <label className="text-xs text-neutral-400 block mb-0.5">Move (inches)</label>
      <input type="number" min={1} value={move} onChange={e => setMove(+e.target.value)} className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-white mb-2" />
      <label className="text-xs text-neutral-400 block mb-0.5">Shoot (inches)</label>
      <input type="number" min={1} value={shoot} onChange={e => setShoot(+e.target.value)} className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-white mb-2" />
      <label className="flex items-center gap-2 text-xs text-neutral-300 mb-3 cursor-pointer">
        <input type="checkbox" checked={adv} onChange={e => setAdv(e.target.checked)} className="accent-blue-500" />
        Include Advance (+6")
      </label>
      <div className="flex gap-2">
        <button onClick={handle} disabled={!selectedUnitId} className="flex-1 py-1 text-xs rounded bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-40">Add</button>
        <button onClick={onClose} className="flex-1 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300">Cancel</button>
      </div>
    </div>
  )
}

export default function OverlayToolbar() {
  const showRulerTool = useWTCStore(s => s.showRulerTool)
  const showLayerPanel = useWTCStore(s => s.showLayerPanel)
  const setShowRulerTool = useWTCStore(s => s.setShowRulerTool)
  const setShowLayerPanel = useWTCStore(s => s.setShowLayerPanel)
  const clearOverlayMarkers = useWTCStore(s => s.clearOverlayMarkers)
  const activePlayer = useWTCStore(s => s.activePlayer)
  const setActivePlayer = useWTCStore(s => s.setActivePlayer)
  const setView = useWTCStore(s => s.setView)

  const [arcOpen, setArcOpen] = useState(false)
  const [threatOpen, setThreatOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
      {/* Player toggle */}
      <div className="flex rounded overflow-hidden border border-neutral-700 mr-2">
        {[1, 2].map(p => (
          <button
            key={p}
            onClick={() => setActivePlayer(p)}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium transition-colors',
              activePlayer === p
                ? (p === 1 ? 'bg-blue-700 text-white' : 'bg-amber-700 text-white')
                : 'text-neutral-400 hover:text-white'
            )}
          >
            P{p}
          </button>
        ))}
      </div>

      {/* Ruler tool */}
      <button
        onClick={() => setShowRulerTool(!showRulerTool)}
        title="Ruler tool (drag to measure)"
        className={clsx(
          'px-2 py-1 text-xs rounded transition-colors',
          showRulerTool ? 'bg-white text-neutral-900 font-semibold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        )}
      >
        Ruler
      </button>

      {/* Arc add */}
      <div className="relative">
        <button
          onClick={() => { setArcOpen(!arcOpen); setThreatOpen(false) }}
          className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          + Arc
        </button>
        {arcOpen && <ArcAddPopover onClose={() => setArcOpen(false)} />}
      </div>

      {/* Threat calc */}
      <div className="relative">
        <button
          onClick={() => { setThreatOpen(!threatOpen); setArcOpen(false) }}
          className="px-2 py-1 text-xs rounded bg-purple-900/60 text-purple-300 hover:bg-purple-800 transition-colors"
        >
          Threat
        </button>
        {threatOpen && <ThreatCalcPopover onClose={() => setThreatOpen(false)} />}
      </div>

      {/* Layers */}
      <button
        onClick={() => setShowLayerPanel(!showLayerPanel)}
        className={clsx(
          'px-2 py-1 text-xs rounded transition-colors',
          showLayerPanel ? 'bg-neutral-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        )}
      >
        Layers
      </button>

      <div className="flex-1" />

      {/* Clear */}
      <button
        onClick={() => clearOverlayMarkers('all')}
        className="px-2 py-1 text-xs rounded bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors"
      >
        Clear All
      </button>

      {/* Validate shortcut */}
      <button
        onClick={() => setView('validate')}
        className="px-2 py-1 text-xs rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900 transition-colors"
      >
        Validate →
      </button>
    </div>
  )
}

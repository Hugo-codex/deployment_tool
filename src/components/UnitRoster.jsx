import React from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { clsx } from 'clsx'

function UnitEntry({ unit, player, isSelected }) {
  const selectUnit = useWTCStore(s => s.selectUnit)
  const toggleUnitReserve = useWTCStore(s => s.toggleUnitReserve)
  const addOverlayArc = useWTCStore(s => s.addOverlayArc)

  const playerColor = player === 1 ? 'blue' : 'amber'
  const statusDot = unit.inReserve
    ? 'bg-neutral-600'
    : unit.placement?.placed
      ? (player === 1 ? 'bg-blue-500' : 'bg-amber-500')
      : 'bg-neutral-700'

  return (
    <div
      className={clsx(
        'px-2 py-1.5 rounded cursor-pointer transition-colors border',
        isSelected
          ? 'bg-neutral-700 border-neutral-500'
          : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'
      )}
      onClick={() => selectUnit(isSelected ? null : unit.id)}
    >
      <div className="flex items-center gap-2">
        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', statusDot)} />
        <span className="text-xs text-neutral-200 truncate flex-1">{unit.displayLabel}</span>
        {unit.base.sizeUnknown && <span className="text-xs text-amber-400">?</span>}
      </div>

      {isSelected && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            onClick={e => { e.stopPropagation(); toggleUnitReserve(unit.id, player) }}
            className="px-1.5 py-0.5 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
          >
            {unit.inReserve ? 'On Board' : 'Reserve'}
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              addOverlayArc({ unit_id: unit.id, range_type: 'charge', range_inches: 12, player })
            }}
            className="px-1.5 py-0.5 text-xs rounded bg-red-900/60 hover:bg-red-800 text-red-300"
          >
            +Charge
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              addOverlayArc({ unit_id: unit.id, range_type: 'move', range_inches: 6, player })
            }}
            className="px-1.5 py-0.5 text-xs rounded bg-blue-900/60 hover:bg-blue-800 text-blue-300"
          >
            +Move
          </button>
        </div>
      )}

      {unit.base.sizeUnknown && (
        <div className="text-xs text-amber-500/70 mt-0.5 pl-3.5">Base size unverified</div>
      )}
    </div>
  )
}

function PlayerSection({ manifest, player }) {
  const selectedUnitId = useWTCStore(s => s.selectedUnitId)
  if (!manifest) return null

  const placed = manifest.units.filter(u => u.placement?.placed && !u.inReserve).length
  const inReserve = manifest.units.filter(u => u.inReserve).length
  const unplaced = manifest.units.length - placed - inReserve

  return (
    <div>
      <div className={clsx(
        'text-xs font-bold uppercase tracking-wider pb-1 mb-2 border-b flex justify-between',
        player === 1 ? 'text-blue-400 border-blue-900' : 'text-amber-400 border-amber-900'
      )}>
        <span>P{player} — {manifest.faction ?? 'Unknown'}</span>
        <span className="text-neutral-500 font-normal">{placed}/{manifest.totalUnits}</span>
      </div>

      <div className="space-y-0.5">
        {manifest.units.map(unit => (
          <UnitEntry
            key={unit.id}
            unit={unit}
            player={player}
            isSelected={unit.id === selectedUnitId}
          />
        ))}
      </div>

      {inReserve > 0 && (
        <div className="mt-1.5 text-xs text-neutral-500 pl-1">{inReserve} in reserve</div>
      )}
    </div>
  )
}

export default function UnitRoster() {
  const activeListP1 = useWTCStore(s => s.activeListP1)
  const activeListP2 = useWTCStore(s => s.activeListP2)

  return (
    <div className="w-52 shrink-0 border-r border-neutral-800 flex flex-col overflow-hidden bg-neutral-950">
      <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
        Units
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        <PlayerSection manifest={activeListP1} player={1} />
        <PlayerSection manifest={activeListP2} player={2} />
        {!activeListP1 && !activeListP2 && (
          <p className="text-xs text-neutral-600 px-1">No lists loaded.</p>
        )}
      </div>
    </div>
  )
}

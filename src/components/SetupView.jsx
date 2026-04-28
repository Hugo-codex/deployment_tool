import React, { useState } from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { clsx } from 'clsx'

const DEPLOYMENT_TYPES = [
  { id: 'hammer_and_anvil',   label: 'Hammer & Anvil' },
  { id: 'search_and_destroy', label: 'Search & Destroy' },
  { id: 'dawn_of_war',        label: 'Dawn of War' },
  { id: 'tipping_point',      label: 'Tipping Point' },
  { id: 'crucible_of_battle', label: 'Crucible of Battle' },
  { id: 'sweeping_engagement',label: 'Sweeping Engagement' },
]

const MAP_NUMBERS = Array.from({ length: 6 }, (_, i) => i + 1)

function ListInputPanel({ player }) {
  const rawInput = useWTCStore(s => player === 1 ? s.rawInputP1 : s.rawInputP2)
  const setRawInput = useWTCStore(s => s.setRawInput)
  const parseAndResolve = useWTCStore(s => s.parseAndResolve)
  const parseState = useWTCStore(s => player === 1 ? s.parseStateP1 : s.parseStateP2)
  const manifest = useWTCStore(s => player === 1 ? s.activeListP1 : s.activeListP2)
  const saveListToLibrary = useWTCStore(s => s.saveListToLibrary)
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)

  const playerColor = player === 1 ? 'blue' : 'amber'

  return (
    <div className="flex flex-col gap-3">
      <div className={clsx(
        'text-xs font-bold uppercase tracking-wider pb-1 border-b',
        player === 1 ? 'text-blue-400 border-blue-900' : 'text-amber-400 border-amber-900'
      )}>
        Player {player}
      </div>

      <textarea
        className="w-full h-40 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-xs text-neutral-200 font-mono resize-none focus:outline-none focus:border-neutral-500"
        placeholder={`Paste Player ${player} army list here…\n(GW App, War Organ, or New Recruit format)`}
        value={rawInput}
        onChange={e => setRawInput(player, e.target.value)}
      />

      <button
        onClick={() => parseAndResolve(player)}
        className="w-full py-1.5 text-xs font-semibold rounded bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
      >
        Parse &amp; Resolve List
      </button>

      {parseState?.status === 'error' && (
        <div className="text-xs text-red-400 bg-red-950/40 rounded px-2 py-1.5">
          {parseState.error}
        </div>
      )}

      {manifest && (
        <div className="text-xs text-neutral-300 bg-neutral-800 rounded px-3 py-2 space-y-1">
          <div className="font-medium text-neutral-200">{manifest.faction ?? 'Unknown Faction'}</div>
          <div className="text-neutral-400">{manifest.totalUnits} units resolved</div>
          {manifest.warnings.length > 0 && (
            <div className="text-amber-400">{manifest.warnings.length} unit(s) need review</div>
          )}
          <div className="flex gap-2 pt-1">
            {!showSave ? (
              <button
                onClick={() => setShowSave(true)}
                className="text-neutral-400 hover:text-white underline text-xs"
              >
                Save to library
              </button>
            ) : (
              <div className="flex gap-1 w-full">
                <input
                  className="flex-1 bg-neutral-700 border border-neutral-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                  placeholder="List name…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { saveListToLibrary(player, saveName); setShowSave(false) } }}
                />
                <button
                  onClick={() => { saveListToLibrary(player, saveName); setShowSave(false) }}
                  className="px-2 py-0.5 bg-emerald-700 rounded text-xs text-white"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ListLibraryPanel({ player }) {
  const savedLists = useWTCStore(s => s.savedLists)
  const loadListFromLibrary = useWTCStore(s => s.loadListFromLibrary)
  const deleteListFromLibrary = useWTCStore(s => s.deleteListFromLibrary)

  if (savedLists.length === 0) return null

  return (
    <div className="mt-4">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Saved Lists</div>
      <div className="space-y-1">
        {savedLists.map(l => (
          <div key={l.id} className="flex items-center justify-between gap-2 bg-neutral-800 rounded px-2 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-200 truncate">{l.name}</div>
              <div className="text-xs text-neutral-500">{l.faction}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => loadListFromLibrary(l.id, player)}
                className="px-2 py-0.5 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-white"
              >
                Load P{player}
              </button>
              <button
                onClick={() => deleteListFromLibrary(l.id)}
                className="px-1.5 py-0.5 text-xs rounded bg-red-900/60 hover:bg-red-800 text-red-300"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SetupView() {
  const selectedDeploymentType = useWTCStore(s => s.selectedDeploymentType)
  const selectedMapNumber = useWTCStore(s => s.selectedMapNumber)
  const setDeploymentType = useWTCStore(s => s.setDeploymentType)
  const setMapNumber = useWTCStore(s => s.setMapNumber)
  const buildBoard = useWTCStore(s => s.buildBoard)
  const activeListP1 = useWTCStore(s => s.activeListP1)
  const activeListP2 = useWTCStore(s => s.activeListP2)

  const canBuild = activeListP1 || activeListP2

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* List inputs */}
        <section className="grid grid-cols-2 gap-6">
          <ListInputPanel player={1} />
          <ListInputPanel player={2} />
        </section>

        {/* List library (shared) */}
        <ListLibraryPanel player={1} />

        {/* Board configuration */}
        <section className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-800 pb-1">
            Board Configuration
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Deployment Type</label>
              <div className="grid grid-cols-2 gap-1">
                {DEPLOYMENT_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => setDeploymentType(dt.id)}
                    className={clsx(
                      'px-2 py-1.5 text-xs rounded text-left transition-colors',
                      selectedDeploymentType === dt.id
                        ? 'bg-neutral-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                    )}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Map Number</label>
              <div className="grid grid-cols-3 gap-1">
                {MAP_NUMBERS.map(n => (
                  <button
                    key={n}
                    onClick={() => setMapNumber(n)}
                    className={clsx(
                      'py-1.5 text-xs rounded font-mono transition-colors',
                      selectedMapNumber === n
                        ? 'bg-neutral-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={buildBoard}
            disabled={!canBuild}
            className={clsx(
              'w-full py-2 text-sm font-semibold rounded transition-colors',
              canBuild
                ? 'bg-blue-700 hover:bg-blue-600 text-white'
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            )}
          >
            Build Board
          </button>
          {!canBuild && (
            <p className="text-xs text-neutral-600 text-center">Load at least one army list to build the board.</p>
          )}
        </section>
      </div>
    </div>
  )
}

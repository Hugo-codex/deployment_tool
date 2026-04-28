import React from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { RANGE_TYPES, RANGE_GROUPS } from '../constants/rangeTypes.js'
import { clsx } from 'clsx'

export default function LayerPanel() {
  const overlayState = useWTCStore(s => s.overlayState)
  const toggleOverlayLayer = useWTCStore(s => s.toggleOverlayLayer)
  const removeOverlayMarker = useWTCStore(s => s.removeOverlayMarker)

  const layers = overlayState?.layers ?? {}
  const markers = overlayState?.markers ?? []

  // Group range types
  const grouped = {}
  for (const [key, val] of Object.entries(RANGE_TYPES)) {
    if (!grouped[val.group]) grouped[val.group] = []
    grouped[val.group].push({ key, ...val })
  }

  return (
    <div className="w-52 shrink-0 border-l border-neutral-800 flex flex-col overflow-hidden bg-neutral-950">
      <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
        Layers
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Layer toggles */}
        <div className="space-y-3 mb-4">
          {Object.entries(grouped).map(([group, types]) => (
            <div key={group}>
              <div className="text-xs text-neutral-600 uppercase tracking-wider mb-1">{RANGE_GROUPS[group]}</div>
              <div className="space-y-0.5">
                {types.map(({ key, label, color }) => {
                  const isVisible = layers[key]?.visible ?? false
                  return (
                    <button
                      key={key}
                      onClick={() => toggleOverlayLayer(key, !isVisible)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors text-left',
                        isVisible ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: isVisible ? color : '#374151' }}
                      />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Active markers list */}
        {markers.length > 0 && (
          <div>
            <div className="text-xs text-neutral-600 uppercase tracking-wider mb-1">Pinned Markers</div>
            <div className="space-y-0.5">
              {markers.map(m => (
                <div key={m.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-neutral-900 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="flex-1 text-neutral-300 truncate">{m.label}</span>
                  <button
                    onClick={() => removeOverlayMarker(m.id)}
                    className="text-neutral-600 hover:text-red-400 px-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useRef } from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { DEPLOYMENT_RULES, TERRAIN_RULES, OBJECTIVE_RULES, BASE_RULES } from '../lib/rulesData.js'
import { clsx } from 'clsx'

const CONFIDENCE_COLOR = {
  high:   'text-emerald-400',
  medium: 'text-amber-400',
  low:    'text-red-400',
}

function RulingCard({ entry }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3 space-y-2">
      <div className="text-xs text-neutral-500">{entry.query_type?.replace('_', ' ')}</div>
      <div className="text-sm text-neutral-200 font-medium">Q: {entry.query}</div>
      <div className="text-xs text-neutral-300 leading-relaxed">{entry.ruling}</div>
      <div className="flex items-center gap-4 pt-1">
        <span className="text-xs text-neutral-500">{entry.authority}</span>
        <span className={clsx('text-xs font-medium ml-auto', CONFIDENCE_COLOR[entry.confidence])}>
          {entry.confidence} confidence
        </span>
      </div>
      {entry.caveats?.length > 0 && (
        <div className="text-xs text-neutral-600 border-t border-neutral-800 pt-2">
          {entry.caveats.join(' ')}
        </div>
      )}
    </div>
  )
}

function RuleRefSection({ title, rules }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border border-neutral-800 rounded">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 rounded"
        onClick={() => setOpen(!open)}
      >
        {title}
        <span className="text-neutral-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {Object.entries(rules).map(([key, rule]) => (
            <div key={key} className="bg-neutral-900 rounded px-3 py-2">
              <div className="text-xs text-neutral-200 leading-relaxed">{rule.text}</div>
              <div className="text-xs text-neutral-600 mt-1">{rule.authority}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RulesView() {
  const rulesQuery = useWTCStore(s => s.rulesQuery)
  const rulesResult = useWTCStore(s => s.rulesResult)
  const rulesLog = useWTCStore(s => s.rulesLog)
  const setRulesQuery = useWTCStore(s => s.setRulesQuery)
  const submitRulesQuery = useWTCStore(s => s.submitRulesQuery)
  const inputRef = useRef(null)

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitRulesQuery()
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Query panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 shrink-0">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Rules Query</div>
            <textarea
              ref={inputRef}
              className="w-full h-20 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 resize-none focus:outline-none focus:border-neutral-500"
              placeholder="Ask a deployment rules question…&#10;e.g. Can Infiltrators be placed in my deployment zone during main deployment?"
              value={rulesQuery}
              onChange={e => setRulesQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              onClick={submitRulesQuery}
              disabled={!rulesQuery.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
            >
              Get Ruling
            </button>
          </div>
        </div>

        {/* Current result */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-2xl space-y-4">
            {rulesResult && <RulingCard entry={rulesResult} />}

            {rulesLog.length > 1 && (
              <div>
                <div className="text-xs text-neutral-600 uppercase tracking-wider mb-2">Earlier queries</div>
                <div className="space-y-2">
                  {[...rulesLog].reverse().slice(1).map(e => (
                    <RulingCard key={e.query_id} entry={e} />
                  ))}
                </div>
              </div>
            )}

            {!rulesResult && (
              <div className="text-center py-12 text-neutral-600">
                <div className="text-3xl mb-3">⚖</div>
                <p className="text-sm">Ask a rules question to get a WTC-authoritative ruling.</p>
                <p className="text-xs mt-1 text-neutral-700">Covers: deployment order, terrain interactions, base sizes, objective control.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reference sidebar */}
      <div className="w-72 shrink-0 border-l border-neutral-800 overflow-y-auto px-3 py-4 space-y-2">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Quick Reference</div>
        <RuleRefSection title="Deployment Rules" rules={DEPLOYMENT_RULES} />
        <RuleRefSection title="Terrain Interactions" rules={TERRAIN_RULES} />
        <RuleRefSection title="Objective Control" rules={OBJECTIVE_RULES} />
        <RuleRefSection title="Base Sizes" rules={BASE_RULES} />
      </div>
    </div>
  )
}

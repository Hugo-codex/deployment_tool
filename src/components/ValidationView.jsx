import React from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { clsx } from 'clsx'

const RESULT_STYLES = {
  pass:    'text-emerald-400',
  fail:    'text-red-400',
  warning: 'text-amber-400',
  skip:    'text-neutral-600',
}

const RESULT_BG = {
  pass:    'bg-emerald-950/30',
  fail:    'bg-red-950/40',
  warning: 'bg-amber-950/30',
  skip:    '',
}

const RESULT_ICON = {
  pass:    '✓',
  fail:    '✗',
  warning: '⚠',
  skip:    '–',
}

const CHECK_GROUPS = {
  A: 'Terrain Placement',
  B: 'Deployment Zone',
  C: 'Coherency',
  D: 'Objectives',
}

function CheckRow({ result }) {
  const [open, setOpen] = React.useState(result.result === 'fail' || result.result === 'warning')
  return (
    <div className={clsx('rounded border border-neutral-800', RESULT_BG[result.result])}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className={clsx('text-xs font-bold w-6 shrink-0', RESULT_STYLES[result.result])}>
          {RESULT_ICON[result.result]}
        </span>
        <span className="text-xs text-neutral-400 w-6 shrink-0">{result.check_id}</span>
        <span className="flex-1 text-xs text-neutral-200">{result.check_name}</span>
        <span className={clsx('text-xs font-medium uppercase', RESULT_STYLES[result.result])}>
          {result.result}
        </span>
      </button>

      {open && (result.result !== 'pass' && result.result !== 'skip') && (
        <div className="px-4 pb-3 space-y-1.5">
          <p className="text-xs text-neutral-300">{result.description}</p>
          {result.fix && (
            <p className="text-xs text-neutral-400">
              <span className="text-neutral-500">Fix: </span>{result.fix}
            </p>
          )}
          {result.affects_player && result.affects_player !== 'both' && (
            <p className="text-xs text-neutral-500">Affects: {result.affects_player.replace('_', ' ')}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ValidationView() {
  const report = useWTCStore(s => s.validationReport)
  const strictMode = useWTCStore(s => s.strictMode)
  const runValidation = useWTCStore(s => s.runValidation)
  const setStrictMode = useWTCStore(s => s.setStrictMode)

  const grouped = {}
  if (report?.results) {
    for (const r of report.results) {
      const group = r.check_id[0]
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(r)
    }
  }

  const overallColor = !report ? 'text-neutral-500'
    : report.summary.overall === 'legal' ? 'text-emerald-400'
    : report.summary.overall === 'illegal' ? 'text-red-400'
    : 'text-amber-400'

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header controls */}
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">Pre-Game Validation</h1>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={e => setStrictMode(e.target.checked)}
              className="accent-blue-500"
            />
            Strict Mode (tournament)
          </label>
          <button
            onClick={runValidation}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors"
          >
            Run Validation
          </button>
        </div>

        {/* Summary */}
        {report && (
          <div className="bg-neutral-900 rounded border border-neutral-800 px-4 py-3 flex items-center gap-6">
            <div>
              <div className={clsx('text-xl font-bold uppercase', overallColor)}>
                {report.summary.overall.replace('_', ' ')}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {report.map.deployment_type?.replace(/_/g, ' ')} — Map {report.map.map_number}
              </div>
            </div>
            <div className="flex-1" />
            <div className="text-right space-y-0.5">
              <div className="text-xs text-neutral-400">{report.summary.checks_passed} passed</div>
              {report.summary.hard_fails > 0 && (
                <div className="text-xs text-red-400">{report.summary.hard_fails} hard fail(s)</div>
              )}
              {report.summary.warnings > 0 && (
                <div className="text-xs text-amber-400">{report.summary.warnings} warning(s)</div>
              )}
              {report.summary.checks_skipped > 0 && (
                <div className="text-xs text-neutral-600">{report.summary.checks_skipped} skipped</div>
              )}
            </div>
            <div className={clsx(
              'w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl font-bold',
              report.legal_to_play
                ? 'border-emerald-600 text-emerald-400'
                : 'border-red-600 text-red-400'
            )}>
              {report.legal_to_play ? '✓' : '✗'}
            </div>
          </div>
        )}

        {/* Results by group */}
        {report && Object.entries(grouped).map(([group, checks]) => (
          <div key={group}>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Group {group} — {CHECK_GROUPS[group]}
            </div>
            <div className="space-y-1">
              {checks.map(r => <CheckRow key={r.check_id + (r.affects_player ?? '')} result={r} />)}
            </div>
          </div>
        ))}

        {!report && (
          <div className="text-center py-16 text-neutral-600">
            <div className="text-3xl mb-3">⬡</div>
            <p className="text-sm">Run validation to check your board for rule violations.</p>
          </div>
        )}
      </div>
    </div>
  )
}

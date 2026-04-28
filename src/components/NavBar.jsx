import React from 'react'
import { useWTCStore } from '../store/useWTCStore.js'
import { clsx } from 'clsx'

const VIEWS = [
  { id: 'setup',    label: 'Setup' },
  { id: 'board',    label: 'Board' },
  { id: 'validate', label: 'Validate' },
  { id: 'rules',    label: 'Rules' },
]

export default function NavBar() {
  const activeView = useWTCStore(s => s.activeView)
  const setView = useWTCStore(s => s.setView)
  const boardState = useWTCStore(s => s.boardState)

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-neutral-900 border-b border-neutral-800 shrink-0">
      <span className="text-sm font-bold tracking-widest text-neutral-300 uppercase">WTC Deployment Tool</span>
      <nav className="flex gap-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            disabled={v.id === 'board' && !boardState}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              activeView === v.id
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
              v.id === 'board' && !boardState && 'opacity-30 cursor-not-allowed'
            )}
          >
            {v.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

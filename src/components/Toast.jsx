import React from 'react'
import { clsx } from 'clsx'

export default function Toast({ message, type = 'info' }) {
  return (
    <div className={clsx(
      'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
      'px-4 py-2 rounded text-sm font-medium shadow-lg',
      'animate-slide-up',
      type === 'success' && 'bg-emerald-700 text-white',
      type === 'error'   && 'bg-red-700 text-white',
      type === 'info'    && 'bg-neutral-700 text-neutral-100',
    )}>
      {message}
    </div>
  )
}

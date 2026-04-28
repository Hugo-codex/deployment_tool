import React from 'react'
import { useWTCStore } from './store/useWTCStore.js'
import SetupView from './components/SetupView.jsx'
import BoardView from './components/BoardView.jsx'
import ValidationView from './components/ValidationView.jsx'
import RulesView from './components/RulesView.jsx'
import NavBar from './components/NavBar.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const activeView = useWTCStore(s => s.activeView)
  const toast = useWTCStore(s => s.toast)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-950">
      <NavBar />
      <main className="flex-1 overflow-hidden">
        {activeView === 'setup'    && <SetupView />}
        {activeView === 'board'    && <BoardView />}
        {activeView === 'validate' && <ValidationView />}
        {activeView === 'rules'    && <RulesView />}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

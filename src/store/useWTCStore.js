// Zustand store — all WTC app state
// Bridges localStorage (via storage.js) with React UI

import { create } from 'zustand'
import { load, save, KEYS } from '../utils/storage.js'
import { parseRoster } from '../lib/listParser.js'
import { resolveRoster } from '../lib/nameResolver.js'
import { buildUnitManifest } from '../lib/armyBuilder.js'
import { buildBoardState } from '../lib/mapTerrain.js'
import { runValidation } from '../lib/layoutValidator.js'
import { loadOverlayState, addArc, addThreatArc, pinRuler, removeMarker, toggleLayer, clearOverlay } from '../lib/overlayManager.js'
import { queryRules, logRuling } from '../lib/rulesData.js'

// ─── Initial state from localStorage ─────────────────────────────────────────

function loadInitialState() {
  return {
    // View routing
    activeView: 'setup',   // 'setup' | 'board' | 'validate' | 'rules'

    // Army lists
    savedLists: load(KEYS.lists) ?? [],
    activeListP1: load(KEYS.activeListP1) ?? null,
    activeListP2: load(KEYS.activeListP2) ?? null,

    // Raw paste inputs
    rawInputP1: '',
    rawInputP2: '',

    // Parse / resolve state
    parseStateP1: null,    // { status, roster, errors }
    parseStateP2: null,

    // Board
    boardState: load(KEYS.boardState) ?? null,
    selectedDeploymentType: 'hammer_and_anvil',
    selectedMapNumber: 1,

    // Overlay
    overlayState: loadOverlayState(),

    // Validation
    validationReport: load(KEYS.validationReport) ?? null,
    strictMode: false,

    // Rules panel
    rulesQuery: '',
    rulesResult: null,
    rulesLog: load(KEYS.rulings) ?? [],

    // UI state
    selectedUnitId: null,
    hoveredUnitId: null,
    activePlayer: 1,
    showLayerPanel: false,
    showRulerTool: false,
    liveRuler: null,       // { startXPx, startYPx, endXPx, endYPx, label }
    toast: null,           // { message, type: 'info'|'success'|'error' }
    settings: load('wtc_settings') ?? { snapEnabled: true, displayMode: 'combined' },
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWTCStore = create((set, get) => ({
  ...loadInitialState(),

  // ── View routing ────────────────────────────────────────────────────────────
  setView: (view) => set({ activeView: view }),

  // ── Toast ───────────────────────────────────────────────────────────────────
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },

  // ── Raw input ───────────────────────────────────────────────────────────────
  setRawInput: (player, text) =>
    set(player === 1 ? { rawInputP1: text } : { rawInputP2: text }),

  // ── Parse + resolve ─────────────────────────────────────────────────────────
  parseAndResolve: async (player) => {
    const { rawInputP1, rawInputP2, selectedDeploymentType, showToast } = get()
    const raw = player === 1 ? rawInputP1 : rawInputP2
    if (!raw.trim()) {
      showToast(`Paste a list for Player ${player} first.`, 'error')
      return
    }

    try {
      const parsed = parseRoster(raw, player)
      if (!parsed || parsed.units.length === 0) throw new Error('No units found in list.')

      const resolved = resolveRoster(parsed, parsed.metadata.faction ?? '')
      const manifest = buildUnitManifest(resolved, selectedDeploymentType, player)

      const key = player === 1 ? KEYS.activeListP1 : KEYS.activeListP2
      save(key, manifest)

      set(player === 1
        ? { activeListP1: manifest, parseStateP1: { status: 'ok', warnings: manifest.warnings } }
        : { activeListP2: manifest, parseStateP2: { status: 'ok', warnings: manifest.warnings } }
      )

      if (manifest.warnings.length > 0) {
        showToast(`P${player} list loaded — ${manifest.warnings.length} unit(s) need base size review.`, 'info')
      } else {
        showToast(`P${player} list loaded. ${manifest.totalUnits} units resolved.`, 'success')
      }
    } catch (err) {
      set(player === 1
        ? { parseStateP1: { status: 'error', error: err.message } }
        : { parseStateP2: { status: 'error', error: err.message } }
      )
      showToast(`P${player}: ${err.message}`, 'error')
    }
  },

  // ── Save list to library ────────────────────────────────────────────────────
  saveListToLibrary: (player, name) => {
    const { activeListP1, activeListP2, savedLists, showToast } = get()
    const manifest = player === 1 ? activeListP1 : activeListP2
    if (!manifest) { showToast('No list loaded.', 'error'); return }

    const entry = {
      id: `list_${Date.now()}`,
      name: name || `${manifest.faction ?? 'Unknown'} — P${player}`,
      faction: manifest.faction,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      manifest,
    }
    const updated = [...savedLists, entry]
    save(KEYS.lists, updated)
    set({ savedLists: updated })
    showToast(`List "${entry.name}" saved.`, 'success')
  },

  loadListFromLibrary: (listId, player) => {
    const { savedLists, showToast } = get()
    const entry = savedLists.find(l => l.id === listId)
    if (!entry) { showToast('List not found.', 'error'); return }

    const key = player === 1 ? KEYS.activeListP1 : KEYS.activeListP2
    save(key, entry.manifest)
    set(player === 1 ? { activeListP1: entry.manifest } : { activeListP2: entry.manifest })
    showToast(`P${player} loaded: ${entry.name}`, 'success')
  },

  deleteListFromLibrary: (listId) => {
    const { savedLists } = get()
    const updated = savedLists.filter(l => l.id !== listId)
    save(KEYS.lists, updated)
    set({ savedLists: updated })
  },

  // ── Board setup ─────────────────────────────────────────────────────────────
  setDeploymentType: (type) => set({ selectedDeploymentType: type }),
  setMapNumber: (num) => set({ selectedMapNumber: num }),

  buildBoard: () => {
    const { selectedDeploymentType, selectedMapNumber, showToast } = get()
    try {
      const boardState = buildBoardState(selectedDeploymentType, selectedMapNumber)
      save(KEYS.boardState, boardState)
      set({ boardState, activeView: 'board' })
      showToast(`Board: ${selectedDeploymentType.replace(/_/g, ' ')} map ${selectedMapNumber}`, 'success')
    } catch (err) {
      showToast(`Board error: ${err.message}`, 'error')
    }
  },

  // ── Unit placement ──────────────────────────────────────────────────────────
  selectUnit: (unitId) => set({ selectedUnitId: unitId }),
  hoverUnit: (unitId) => set({ hoveredUnitId: unitId }),
  setActivePlayer: (player) => set({ activePlayer: player }),

  moveUnit: (unitId, player, xPx, yPx, placed = true) => {
    const { activeListP1, activeListP2 } = get()
    const key = player === 1 ? KEYS.activeListP1 : KEYS.activeListP2
    const manifest = player === 1 ? activeListP1 : activeListP2
    if (!manifest) return

    const scale = get().boardState?.scale ?? 20
    const updated = {
      ...manifest,
      units: manifest.units.map(u =>
        u.id === unitId
          ? { ...u, placement: { xPx, yPx, xInch: xPx / scale, yInch: yPx / scale, placed } }
          : u
      ),
    }
    save(key, updated)
    set(player === 1 ? { activeListP1: updated } : { activeListP2: updated })
  },

  toggleUnitReserve: (unitId, player) => {
    const { activeListP1, activeListP2 } = get()
    const key = player === 1 ? KEYS.activeListP1 : KEYS.activeListP2
    const manifest = player === 1 ? activeListP1 : activeListP2
    if (!manifest) return
    const updated = {
      ...manifest,
      units: manifest.units.map(u =>
        u.id === unitId ? { ...u, inReserve: !u.inReserve, placement: { ...u.placement, placed: false } } : u
      ),
    }
    save(key, updated)
    set(player === 1 ? { activeListP1: updated } : { activeListP2: updated })
  },

  // ── Overlay ─────────────────────────────────────────────────────────────────
  refreshOverlay: () => set({ overlayState: loadOverlayState() }),

  addOverlayArc: (params) => {
    const { activeListP1, activeListP2, activePlayer } = get()
    const manifest = activePlayer === 1 ? activeListP1 : activeListP2
    const { state } = addArc(params, manifest)
    set({ overlayState: state })
  },

  addThreatArc: (params) => {
    const { activeListP1, activeListP2, activePlayer } = get()
    const manifest = activePlayer === 1 ? activeListP1 : activeListP2
    const { state } = addThreatArc(params, manifest)
    set({ overlayState: state })
  },

  pinCurrentRuler: (params) => {
    const state = pinRuler(params)
    set({ overlayState: state, liveRuler: null })
  },

  removeOverlayMarker: (markerId) => {
    const state = removeMarker({ marker_id: markerId })
    set({ overlayState: state })
  },

  toggleOverlayLayer: (layerName, visible, scope = 'all') => {
    const state = toggleLayer({ layer_name: layerName, visible, scope })
    set({ overlayState: state, showLayerPanel: get().showLayerPanel })
  },

  clearOverlayMarkers: (scope = 'all') => {
    const state = clearOverlay({ scope })
    set({ overlayState: state })
  },

  setLiveRuler: (ruler) => set({ liveRuler: ruler }),
  setShowRulerTool: (v) => set({ showRulerTool: v }),
  setShowLayerPanel: (v) => set({ showLayerPanel: v }),

  // ── Validation ──────────────────────────────────────────────────────────────
  runValidation: () => {
    const { strictMode, showToast } = get()
    const report = runValidation(strictMode)
    save(KEYS.validationReport, report)
    set({ validationReport: report })
    const { overall, hard_fails, warnings } = report.summary
    const msg = overall === 'legal'
      ? 'Board is legal to play.'
      : overall === 'illegal'
        ? `${hard_fails} hard fail(s) found — board is illegal.`
        : `${warnings} warning(s) — review before play.`
    showToast(msg, overall === 'legal' ? 'success' : overall === 'illegal' ? 'error' : 'info')
  },

  setStrictMode: (v) => set({ strictMode: v }),

  // ── Rules ───────────────────────────────────────────────────────────────────
  setRulesQuery: (q) => set({ rulesQuery: q }),

  submitRulesQuery: () => {
    const { rulesQuery, rulesLog } = get()
    if (!rulesQuery.trim()) return
    const result = queryRules(rulesQuery)
    const entry = logRuling(result)
    set({ rulesResult: result, rulesLog: [...rulesLog, entry], rulesQuery: '' })
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    save('wtc_settings', settings)
    set({ settings })
  },
}))

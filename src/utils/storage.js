// localStorage helpers — all WTC state lives here

export const KEYS = {
  lists:           'wtc_lists',
  activeListP1:    'wtc_active_list_p1',
  activeListP2:    'wtc_active_list_p2',
  boardState:      'wtc_board_state',
  overlayState:    'wtc_overlay_state',
  validationReport:'wtc_validation_report',
  rulings:         'wtc_rulings',
  settings:        'wtc_settings',
  wtcDoc:          'wtc_base_doc',
}

export function load(key) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : null
  } catch {
    return null
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(key) {
  localStorage.removeItem(key)
}

export function clear() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}

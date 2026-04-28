// List Parser Agent — normalizes raw army list exports
// Sources: GW App, War Organ (BattleScribe), New Recruit

export function detectFormat(raw) {
  if (!raw?.trim()) return 'unknown'
  if (/\+\+\s*.+\(\d+\s*Points?\)\s*\+\+/i.test(raw)) return 'gw_app'
  if (/\+\+\s*\[.+\]\s*\(\d+pts\)\s*\+\+/i.test(raw) || /\+\s*HQ\s*\+/i.test(raw)) return 'war_organ'
  if (/^(HQ|TROOPS|ELITES|FAST ATTACK|HEAVY SUPPORT|FLYER|DEDICATED TRANSPORT)/im.test(raw)) return 'new_recruit'
  if (raw.trimStart().startsWith('{')) return 'json'
  // Fallback: GW App style if bullet points present
  if (raw.includes('•')) return 'gw_app'
  return 'unknown'
}

// Remove point costs, brackets, count suffixes, trim
function normalizeName(raw) {
  return raw
    .replace(/\(\d+\s*[Pp]ts?\)/g, '')
    .replace(/\[\d+\s*[Pp]ts?\]/g, '')
    .replace(/\(\d+\s*[Pp]oints?\)/g, '')
    .replace(/\s*x\d+\s*$/i, '')
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCount(line) {
  const m = line.match(/x(\d+)\s*$/i) || line.match(/\((\d+)\s*models?\)/i)
  return m ? parseInt(m[1]) : null
}

// --- GW App parser ---
function parseGWApp(raw, player) {
  const units = []
  let faction = '', subfaction = '', totalPoints = null

  const headerMatch = raw.match(/^(.+?)\s*\((\d+)\s*Points?\)/im)
  if (headerMatch) {
    faction = headerMatch[1].trim()
    totalPoints = parseInt(headerMatch[2])
  }

  // Split into unit blocks by blank lines
  const blocks = raw.split(/\n\s*\n/).filter(b => b.trim())
  let idCounter = 1

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue

    const firstLine = lines[0]
    // Skip header lines
    if (/^\+\+/.test(firstLine) || /^Keywords:/i.test(firstLine)) continue
    if (/\(\d+\s*Points?\)/.test(firstLine) && idCounter === 1) continue // army header

    const rawName = firstLine
    const normalized = normalizeName(rawName)
    if (!normalized) continue

    const count = extractCount(firstLine) || 1
    const countAssumed = !extractCount(firstLine)

    // Detect model subtypes from indented lines (bullet points)
    const subtypes = []
    for (const line of lines.slice(1)) {
      if (line.startsWith('•') || line.startsWith('-')) {
        const text = line.replace(/^[•\-]\s*/, '').trim()
        // Only track model-type lines, skip wargear (heuristic: starts with number or "x")
        if (/^(\d+x|x\d+)/i.test(text)) {
          const m = text.match(/^(\d+)x?\s+(.+)$/i) || text.match(/^x(\d+)\s+(.+)$/i)
          if (m) subtypes.push({ name: m[2].trim(), count: parseInt(m[1]) })
        }
      }
    }

    units.push({
      id: `parsed_${String(idCounter++).padStart(3, '0')}`,
      rawName,
      normalizedName: normalized,
      unitRole: null,
      modelCount: subtypes.reduce((s, t) => s + t.count, 0) || count,
      modelSubtypes: subtypes,
      flags: { countAssumed, duplicateName: false, allied: false, sourceUnknown: false },
    })
  }

  return { faction, subfaction, totalPoints, units }
}

// --- War Organ (BattleScribe) parser ---
function parseWarOrgan(raw, player) {
  const units = []
  let faction = '', totalPoints = null
  let currentRole = null
  let idCounter = 1

  const headerMatch = raw.match(/\+\+\s*\[?(.+?)\]?\s*\((\d+)pts\)/i)
  if (headerMatch) { faction = headerMatch[1].trim(); totalPoints = parseInt(headerMatch[2]) }

  const rolePattern = /^\+\s+(.+?)\s+\+/
  const lines = raw.split('\n').map(l => l.trim())

  for (const line of lines) {
    if (!line || /^\+\+/.test(line)) continue
    const roleMatch = line.match(rolePattern)
    if (roleMatch) { currentRole = roleMatch[1]; continue }

    // Unit line: "Unit Name [105pts]" or "Unit Name [105pts] x5"
    if (/\[\d+pts\]/i.test(line)) {
      const rawName = line
      const normalized = normalizeName(rawName)
      if (!normalized) continue
      const count = extractCount(line) || 1
      units.push({
        id: `parsed_${String(idCounter++).padStart(3, '0')}`,
        rawName,
        normalizedName: normalized,
        unitRole: currentRole,
        modelCount: count,
        modelSubtypes: [],
        flags: { countAssumed: !extractCount(line), duplicateName: false, allied: false, sourceUnknown: false },
      })
    }
  }

  return { faction, subfaction: null, totalPoints, units }
}

// --- New Recruit parser ---
function parseNewRecruit(raw, player) {
  const units = []
  let faction = '', totalPoints = null
  let currentRole = null
  let idCounter = 1

  const roleKeys = ['HQ', 'TROOPS', 'ELITES', 'FAST ATTACK', 'HEAVY SUPPORT', 'FLYER', 'DEDICATED TRANSPORT', 'FORTIFICATION', 'LORD OF WAR']

  const lines = raw.split('\n').map(l => l.trim())
  for (const line of lines) {
    if (!line) continue
    if (roleKeys.some(r => line.toUpperCase() === r)) { currentRole = line; continue }
    if (/^x\d+\s+/.test(line)) continue // sub-model line

    const pointMatch = line.match(/(.+?)\s*\((\d+)pts?\)/i)
    if (pointMatch) {
      const rawName = line
      const normalized = normalizeName(rawName)
      if (!normalized) continue
      units.push({
        id: `parsed_${String(idCounter++).padStart(3, '0')}`,
        rawName,
        normalizedName: normalized,
        unitRole: currentRole,
        modelCount: extractCount(line) || 1,
        modelSubtypes: [],
        flags: { countAssumed: !extractCount(line), duplicateName: false, allied: false, sourceUnknown: false },
      })
    }
  }

  return { faction, subfaction: null, totalPoints, units }
}

// --- JSON parser ---
function parseJSON(raw, player) {
  const data = JSON.parse(raw)
  const units = (data.units || []).map((u, i) => ({
    id: `parsed_${String(i + 1).padStart(3, '0')}`,
    rawName: u.name,
    normalizedName: normalizeName(u.name),
    unitRole: u.role || null,
    modelCount: u.count || 1,
    modelSubtypes: [],
    flags: { countAssumed: !u.count, duplicateName: false, allied: false, sourceUnknown: false },
  }))
  return { faction: data.faction || '', subfaction: data.subfaction || null, totalPoints: data.points || null, units }
}

// Deduplicate unit names by appending _a, _b
function dedupeNames(units) {
  const seen = {}
  return units.map(u => {
    const key = u.normalizedName.toLowerCase()
    seen[key] = (seen[key] || 0) + 1
    return u
  }).map(u => {
    const key = u.normalizedName.toLowerCase()
    if (seen[key] > 1) {
      u.flags.duplicateName = true
    }
    return u
  })
}

// Main entry point
export function parseRoster(raw, player = 1, sourceHint = 'auto') {
  const format = sourceHint === 'auto' ? detectFormat(raw) : sourceHint
  const warnings = []
  const parseErrors = []

  let result
  try {
    switch (format) {
      case 'gw_app':    result = parseGWApp(raw, player); break
      case 'war_organ': result = parseWarOrgan(raw, player); break
      case 'new_recruit': result = parseNewRecruit(raw, player); break
      case 'json':      result = parseJSON(raw, player); break
      default:
        // Best-effort: try GW App
        result = parseGWApp(raw, player)
        result.units.forEach(u => { u.flags.sourceUnknown = true })
        warnings.push({ message: 'Could not detect list format — attempted best-effort parse. Please verify output.' })
    }
  } catch (e) {
    parseErrors.push({ message: `Parse failed: ${e.message}` })
    result = { faction: '', subfaction: null, totalPoints: null, units: [] }
  }

  result.units = dedupeNames(result.units)

  result.units.forEach(u => {
    if (u.flags.countAssumed) {
      warnings.push({ unitId: u.id, message: `Model count not found — defaulted to 1 for "${u.normalizedName}"` })
    }
  })

  return {
    metadata: {
      sourceFormat: format,
      sourceDetected: format !== 'unknown',
      faction: result.faction,
      subfaction: result.subfaction,
      totalPoints: result.totalPoints,
      player,
      parsedAt: new Date().toISOString(),
    },
    units: result.units,
    warnings,
    parseErrors,
  }
}

// Name Resolver Agent — fuzzy-match unit names against WTC base size doc
// Supports: uploaded XLSX/CSV/JSON doc, or falls back to embedded defaults

import { findBestMatch, normalizeStr } from '../utils/fuzzyMatch.js'
import { parseBaseSizeString, FALLBACK_BASES } from '../constants/wtcBaseSizes.js'
import { load, save, KEYS } from '../utils/storage.js'

// Parse an uploaded WTC doc (CSV text or JSON)
export function parseWTCDoc(content, fileName) {
  if (fileName?.endsWith('.json') || (typeof content === 'string' && content.trimStart().startsWith('['))) {
    return parseWTCDocJSON(content)
  }
  return parseWTCDocCSV(content)
}

function parseWTCDocJSON(content) {
  const rows = JSON.parse(content)
  return rows.map(r => ({
    faction: r.faction || r.Faction || '',
    name: r.unit || r.unit_name || r.Unit || r['Unit Name'] || '',
    baseSizeRaw: r.base_size || r.BaseSize || r['Base Size'] || '',
    base: parseBaseSizeString(r.base_size || r.BaseSize || r['Base Size'] || ''),
  })).filter(r => r.name)
}

function parseWTCDocCSV(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'))
  const factionIdx = header.findIndex(h => h.includes('faction'))
  const nameIdx    = header.findIndex(h => h.includes('unit'))
  const sizeIdx    = header.findIndex(h => h.includes('base') || h.includes('size'))

  if (nameIdx < 0) return []

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const name = cols[nameIdx] || ''
    const baseSizeRaw = sizeIdx >= 0 ? cols[sizeIdx] : ''
    return {
      faction: factionIdx >= 0 ? cols[factionIdx] : '',
      name,
      baseSizeRaw,
      base: parseBaseSizeString(baseSizeRaw),
    }
  }).filter(r => r.name)
}

// Save uploaded WTC doc to localStorage
export function saveWTCDoc(entries) {
  save(KEYS.wtcDoc, entries)
}

// Load WTC doc from localStorage, or return null
export function loadWTCDoc() {
  return load(KEYS.wtcDoc)
}

// Resolve a single unit against the WTC doc entries
function resolveUnit(unit, docEntries, factionEntries, threshold = 0.75) {
  const name = unit.normalizedName

  // Faction-scoped search first (levels 1-4)
  const factionResult = findBestMatch(name, factionEntries.map(e => ({ name: e.name, entry: e })), threshold)
  if (factionResult.matched && factionResult.confidence >= threshold) {
    return {
      ...factionResult,
      entry: factionResult.matched.entry,
      scope: 'faction',
    }
  }

  // Cross-faction (level 5) — always needs_review
  const globalResult = findBestMatch(name, docEntries.map(e => ({ name: e.name, entry: e })), 0.5)
  if (globalResult.matched && globalResult.confidence >= 0.5) {
    return {
      ...globalResult,
      entry: globalResult.matched.entry,
      scope: 'global',
      needsReview: true,
    }
  }

  return { matched: null, confidence: 0, strategy: 'none', entry: null, scope: null }
}

// Fallback resolution using embedded defaults
function resolveFallback(unit) {
  const name = unit.normalizedName
  const fb = FALLBACK_BASES[name]
  if (fb) {
    return {
      matched: { name },
      confidence: 0.7,
      strategy: 'fallback_embedded',
      entry: { name, base: fb, faction: 'unknown' },
      scope: 'fallback',
    }
  }
  return null
}

// Main resolver — takes parsed roster, returns resolved roster
export function resolveRoster(parsedRoster, faction, threshold = 0.75) {
  const docEntries = loadWTCDoc() || []
  const factionNorm = normalizeStr(faction)
  const factionEntries = docEntries.filter(e => normalizeStr(e.faction).includes(factionNorm) || factionNorm.includes(normalizeStr(e.faction)))
  const usingDoc = docEntries.length > 0

  const resolved = []
  const reviewRequired = []

  for (const unit of parsedRoster.units) {
    let result = usingDoc
      ? resolveUnit(unit, docEntries, factionEntries, threshold)
      : null

    // Fallback to embedded defaults if no doc or no match
    if (!result?.matched) {
      result = resolveFallback(unit) || { matched: null, confidence: 0, strategy: 'none', entry: null }
    }

    const base = result.entry?.base || null
    const needsReview = !result.matched || result.confidence < threshold || result.scope === 'global' || base?.ambiguous
    const unresolved = !result.matched

    const resolvedUnit = {
      id: unit.id,
      parsedName: unit.normalizedName,
      wtcMatchedName: result.entry?.name || null,
      wtcFaction: result.entry?.faction || null,
      matchConfidence: result.confidence,
      matchStrategy: result.strategy,
      base: base
        ? {
            shape: base.shape,
            sizePrimaryMm: base.sizeMm || base.wMm || null,
            sizeSecondaryMm: base.hMm || null,
            heightCapMm: base.heightCapMm || null,
            sizeAmbiguous: base.ambiguous || false,
            sizeOptions: base.sizeOptions || [],
            mixedBases: false,
          }
        : { shape: null, sizePrimaryMm: null, sizeSecondaryMm: null, heightCapMm: null, sizeAmbiguous: false, sizeOptions: [], mixedBases: false },
      modelCount: unit.modelCount,
      flags: { needsReview, unresolved, mixedBases: false, sizeAmbiguous: base?.ambiguous || false },
    }

    resolved.push(resolvedUnit)
    if (needsReview || unresolved) {
      reviewRequired.push({
        unitId: unit.id,
        parsedName: unit.normalizedName,
        bestMatch: result.entry?.name || null,
        confidence: result.confidence,
        action: unresolved ? 'manual_base_size_required' : 'confirm_or_override',
      })
    }
  }

  return {
    metadata: {
      faction,
      wtcDocVersion: usingDoc ? '(uploaded)' : '(embedded defaults)',
      matchThreshold: threshold,
      resolvedCount: resolved.filter(u => !u.flags.needsReview && !u.flags.unresolved).length,
      reviewCount: reviewRequired.filter(r => r.action === 'confirm_or_override').length,
      unresolvedCount: reviewRequired.filter(r => r.action === 'manual_base_size_required').length,
      player: parsedRoster.metadata.player,
    },
    units: resolved,
    reviewRequired,
  }
}

// Apply a user override (manual base size entry or confirmed match)
export function applyOverride(resolvedRoster, unitId, override) {
  return {
    ...resolvedRoster,
    units: resolvedRoster.units.map(u => {
      if (u.id !== unitId) return u
      return {
        ...u,
        base: {
          shape: override.shape,
          sizePrimaryMm: override.sizePrimaryMm,
          sizeSecondaryMm: override.sizeSecondaryMm || null,
          heightCapMm: null,
          sizeAmbiguous: false,
          sizeOptions: [],
          mixedBases: false,
        },
        wtcMatchedName: override.wtcMatchedName || u.wtcMatchedName,
        matchConfidence: override.manual ? 1.0 : u.matchConfidence,
        flags: { ...u.flags, needsReview: false, unresolved: false },
      }
    }),
    reviewRequired: resolvedRoster.reviewRequired.filter(r => r.unitId !== unitId),
  }
}

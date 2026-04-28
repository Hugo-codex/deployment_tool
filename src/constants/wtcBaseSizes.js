// WTC embedded base size defaults — used as fallback when no WTC doc is uploaded
// Source: WTC Basisize Document 2024 v1.3 common entries
// The Name Resolver will prefer a user-uploaded doc over these defaults

export const BASE_SHAPES = { ROUND: 'round', OVAL: 'oval' }

// Common base sizes for reference / fallback inference
export const ROUND_BASES_MM = [25, 28, 28.5, 32, 40, 50, 60, 80, 90, 100, 130, 160, 170]
export const OVAL_BASES = [
  { w: 75,  h: 42,  label: '75×42mm' },
  { w: 90,  h: 52,  label: '90×52mm' },
  { w: 105, h: 70,  label: '105×70mm' },
  { w: 120, h: 92,  label: '120×92mm', heightCapMm: 127 },
  { w: 170, h: 109, label: '170×109mm' },
  { w: 110, h: 110, label: '110mm oval (knight movement)' },
]

// Faction-scoped fallback table — covers the most common units
// This is NOT a substitute for the WTC doc — it covers edge cases only
export const FALLBACK_BASES = {
  // Space Marines
  'Intercessor Squad':                  { shape: 'round', sizeMm: 32 },
  'Tactical Squad':                     { shape: 'round', sizeMm: 32 },
  'Captain in Terminator Armour':       { shape: 'round', sizeMm: 40 },
  'Terminator Squad':                   { shape: 'round', sizeMm: 40 },
  'Outrider Squad':                     { shape: 'oval',  wMm: 90,  hMm: 52 },
  'Redemptor Dreadnought':              { shape: 'oval',  wMm: 90,  hMm: 52 },
  'Land Raider':                        { shape: 'oval',  wMm: 120, hMm: 92 },
  // Necrons
  'Necron Warriors':                    { shape: 'round', sizeMm: 32 },
  'Immortals':                          { shape: 'round', sizeMm: 32 },
  'Lychguard':                          { shape: 'round', sizeMm: 40 },
  'Canoptek Scarab Swarms':             { shape: 'round', sizeMm: 40 },
  // Chaos Space Marines
  'Chaos Space Marines':                { shape: 'round', sizeMm: 32 },
  'Terminators':                        { shape: 'round', sizeMm: 40 },
  // Tyranids
  'Termagants':                         { shape: 'round', sizeMm: 25 },
  'Hormagaunts':                        { shape: 'round', sizeMm: 25 },
  'Genestealers':                       { shape: 'round', sizeMm: 32 },
  'Carnifex':                           { shape: 'oval',  wMm: 105, hMm: 70 },
  // Aeldari
  'Guardian Defenders':                 { shape: 'round', sizeMm: 25 },
  'Wraithguard':                        { shape: 'round', sizeMm: 40 },
  // Imperial Guard
  'Infantry Squad':                     { shape: 'round', sizeMm: 25 },
  'Leman Russ Battle Tank':             { shape: 'oval',  wMm: 105, hMm: 70 },
  // Orks
  'Boyz':                               { shape: 'round', sizeMm: 32 },
  'Nobz':                               { shape: 'round', sizeMm: 32 },
  // Knights
  'Knight Paladin':                     { shape: 'oval',  wMm: 170, hMm: 109 },
  'Knight Castellan':                   { shape: 'oval',  wMm: 170, hMm: 109 },
}

// Parse a WTC doc base size string into a normalized object
// e.g. "32 mm" → { shape: 'round', sizeMm: 32 }
// e.g. "90x52 mm (oval)" → { shape: 'oval', wMm: 90, hMm: 52 }
// e.g. "120x92mm, height 127mm" → { shape: 'oval', wMm: 120, hMm: 92, heightCapMm: 127 }
// e.g. "25 mm / 28mm" → { shape: 'round', sizeMm: 25, sizeOptions: [25, 28], ambiguous: true }
export function parseBaseSizeString(str) {
  if (!str) return null
  const s = str.trim()

  // Height cap
  const heightMatch = s.match(/height\s*(\d+)\s*mm/i)
  const heightCapMm = heightMatch ? parseInt(heightMatch[1]) : null

  // Slash = multiple valid sizes
  if (s.includes('/')) {
    const parts = s.split('/').map(p => parseInt(p.match(/\d+/)?.[0]))
    return { shape: 'round', sizeMm: parts[0], sizeOptions: parts, ambiguous: true, heightCapMm }
  }

  // Oval: NxN pattern
  const ovalMatch = s.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm/i)
  if (ovalMatch) {
    return { shape: 'oval', wMm: parseFloat(ovalMatch[1]), hMm: parseFloat(ovalMatch[2]), heightCapMm }
  }

  // Round: single number
  const roundMatch = s.match(/(\d+(?:\.\d+)?)\s*mm/i)
  if (roundMatch) {
    return { shape: 'round', sizeMm: parseFloat(roundMatch[1]), heightCapMm }
  }

  return null
}

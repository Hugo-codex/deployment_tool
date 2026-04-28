// Fuzzy matching utilities for Name Resolver Agent

// Levenshtein distance
export function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

// Normalize a string for matching
export function normalizeStr(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// Tokenize normalized string
export function tokenize(s) {
  return normalizeStr(s).split(' ').filter(Boolean)
}

// Level 1: Exact match — confidence 1.0
export function exactMatch(name, candidate) {
  return normalizeStr(name) === normalizeStr(candidate)
}

// Level 2: Contains match — confidence 0.90
export function containsMatch(name, candidate) {
  const n = normalizeStr(name)
  const c = normalizeStr(candidate)
  return n.includes(c) || c.includes(n)
}

// Level 3: Token overlap — returns ratio 0.0–1.0
export function tokenOverlap(name, candidate) {
  const nt = new Set(tokenize(name))
  const ct = tokenize(candidate)
  if (!nt.size || !ct.length) return 0
  const shared = ct.filter(t => nt.has(t)).length
  return shared / Math.max(nt.size, ct.length)
}

// Level 4/5: Levenshtein score — normalized to 0.0–1.0
export function levenshteinScore(name, candidate) {
  const n = normalizeStr(name)
  const c = normalizeStr(candidate)
  const maxLen = Math.max(n.length, c.length)
  if (!maxLen) return 1.0
  return 1 - levenshtein(n, c) / maxLen
}

// Run all match strategies in order — return best match from a candidates list
// Returns: { matched, confidence, strategy }
export function findBestMatch(name, candidates, threshold = 0.75) {
  // Level 1 — exact
  for (const c of candidates) {
    if (exactMatch(name, c.name)) return { matched: c, confidence: 1.0, strategy: 'exact' }
  }

  // Level 2 — contains
  const containsCandidates = candidates.filter(c => containsMatch(name, c.name))
  if (containsCandidates.length === 1) {
    return { matched: containsCandidates[0], confidence: 0.9, strategy: 'contains' }
  }

  // Level 3 — token overlap
  let best = null, bestScore = 0
  for (const c of candidates) {
    const score = tokenOverlap(name, c.name)
    if (score > bestScore) { bestScore = score; best = c }
  }
  if (best && bestScore >= 0.8) {
    return { matched: best, confidence: 0.85, strategy: 'token' }
  }

  // Level 4/5 — Levenshtein
  best = null; bestScore = 0
  for (const c of candidates) {
    const score = levenshteinScore(name, c.name)
    if (score > bestScore) { bestScore = score; best = c }
  }
  if (best && bestScore >= threshold) {
    return { matched: best, confidence: bestScore, strategy: 'fuzzy' }
  }
  if (best && bestScore >= 0.5) {
    return { matched: best, confidence: bestScore, strategy: 'fuzzy_low' }
  }

  return { matched: null, confidence: 0, strategy: 'none' }
}

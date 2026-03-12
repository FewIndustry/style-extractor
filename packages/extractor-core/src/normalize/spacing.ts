import type { RawSpacingData, SpacingScale } from '../types'

const COMMON_BASES = [4, 5, 6, 8, 10]

export function detectSpacingScale(raw: RawSpacingData[]): SpacingScale | null {
  if (raw.length < 3) return null

  const values = raw
    .filter(s => s.value > 0 && s.value < 200)
    .map(s => ({ value: s.value, count: s.count }))

  if (values.length < 3) return null

  // Try each common base, count how many values are exact multiples
  let bestBase = 4
  let bestHitRate = 0

  for (const base of COMMON_BASES) {
    let hits = 0
    let totalWeight = 0

    for (const { value, count } of values) {
      totalWeight += count
      if (value % base === 0) {
        hits += count
      }
    }

    const hitRate = hits / totalWeight
    if (hitRate > bestHitRate) {
      bestHitRate = hitRate
      bestBase = base
    }
  }

  // Build the scale from actual values that land on the grid
  const scaleValues = new Set<number>()
  for (const { value } of values) {
    if (value % bestBase === 0) {
      scaleValues.add(value)
    }
  }

  const sorted = Array.from(scaleValues).sort((a, b) => a - b)

  return {
    base: bestBase,
    unit: 'px',
    values: sorted,
    confidence: Math.round(bestHitRate * 100) / 100,
  }
}

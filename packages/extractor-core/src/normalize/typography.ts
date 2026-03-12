import type { RawFontData, TypographyToken, TypeScaleEntry } from '../types'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const KNOWN_MONO = ['monospace', 'courier', 'consolas', 'menlo', 'monaco', 'jetbrains', 'fira code', 'source code']

function cleanFontFamily(raw: string): string {
  // Take the first font in the stack, strip quotes
  return raw.split(',')[0].trim().replace(/["']/g, '')
}

function parsePx(val: string): number {
  return parseFloat(val) || 16
}

export function normalizeFonts(raw: RawFontData[]): {
  fonts: TypographyToken[]
  scale: TypeScaleEntry[]
  baseSize: string
} {
  // Group by family
  const familyMap = new Map<string, {
    weights: Set<number>
    charCount: number
    isHeading: boolean
    isMono: boolean
    sizes: Map<string, { lineHeight: string; weight: number; element: string; count: number }>
  }>()

  for (const entry of raw) {
    const family = cleanFontFamily(entry.family)
    if (!family) continue

    if (!familyMap.has(family)) {
      familyMap.set(family, {
        weights: new Set(),
        charCount: 0,
        isHeading: false,
        isMono: false,
        sizes: new Map(),
      })
    }

    const data = familyMap.get(family)!
    data.weights.add(entry.weight)
    data.charCount += entry.charCount
    if (HEADING_TAGS.has(entry.element)) data.isHeading = true
    if (KNOWN_MONO.some(m => family.toLowerCase().includes(m))) data.isMono = true

    const sizeKey = entry.size
    if (!data.sizes.has(sizeKey)) {
      data.sizes.set(sizeKey, {
        lineHeight: entry.lineHeight,
        weight: entry.weight,
        element: entry.element,
        count: 1,
      })
    } else {
      data.sizes.get(sizeKey)!.count++
    }
  }

  // Determine roles
  const sorted = Array.from(familyMap.entries()).sort((a, b) => b[1].charCount - a[1].charCount)

  const fonts: TypographyToken[] = sorted.map(([family, data], i) => {
    let role: TypographyToken['role'] = 'other'
    if (data.isMono) role = 'mono'
    else if (i === 0) role = 'body'
    else if (data.isHeading) role = 'heading'

    return {
      family,
      weights: Array.from(data.weights).sort((a, b) => a - b),
      role,
    }
  })

  // If the body font is also used for headings and there's no separate heading font
  if (fonts.length === 1 || !fonts.some(f => f.role === 'heading')) {
    const bodyFont = fonts.find(f => f.role === 'body')
    if (bodyFont) {
      const bodyData = familyMap.get(bodyFont.family)!
      if (bodyData.isHeading) {
        // Single font system — mark body font as heading too
      }
    }
  }

  // Build type scale
  const allSizes = new Map<string, { lineHeight: string; weight: number; element: string; totalCount: number }>()
  for (const [, data] of familyMap) {
    for (const [size, info] of data.sizes) {
      if (!allSizes.has(size)) {
        allSizes.set(size, { ...info, totalCount: info.count })
      } else {
        allSizes.get(size)!.totalCount += info.count
      }
    }
  }

  const scale: TypeScaleEntry[] = Array.from(allSizes.entries())
    .sort((a, b) => parsePx(a[0]) - parsePx(b[0]))
    .map(([size, info]) => ({
      size,
      lineHeight: info.lineHeight,
      weight: info.weight,
      element: info.element,
    }))

  // Find base size (most used)
  const baseEntry = Array.from(allSizes.entries())
    .sort((a, b) => b[1].totalCount - a[1].totalCount)[0]
  const baseSize = baseEntry ? baseEntry[0] : '16px'

  return { fonts, scale, baseSize }
}

// Try to match extracted scale to known type scale ratios
const KNOWN_RATIOS: Record<string, number> = {
  'Minor Second': 1.067,
  'Major Second': 1.125,
  'Minor Third': 1.2,
  'Major Third': 1.25,
  'Perfect Fourth': 1.333,
  'Augmented Fourth': 1.414,
  'Perfect Fifth': 1.5,
  'Golden Ratio': 1.618,
}

export function detectTypeScaleRatio(scale: TypeScaleEntry[]): {
  name: string
  ratio: number
  confidence: number
} | null {
  if (scale.length < 3) return null

  const sizes = scale.map(s => parsePx(s.size)).filter(s => s > 0)
  if (sizes.length < 3) return null

  let bestMatch = { name: '', ratio: 0, error: Infinity }

  for (const [name, ratio] of Object.entries(KNOWN_RATIOS)) {
    let totalError = 0
    for (let i = 1; i < sizes.length; i++) {
      const expectedRatio = sizes[i] / sizes[i - 1]
      totalError += (expectedRatio - ratio) ** 2
    }
    const avgError = totalError / (sizes.length - 1)
    if (avgError < bestMatch.error) {
      bestMatch = { name, ratio, error: avgError }
    }
  }

  const confidence = Math.max(0, 1 - bestMatch.error * 10)
  if (confidence < 0.3) return null

  return {
    name: bestMatch.name,
    ratio: bestMatch.ratio,
    confidence: Math.round(confidence * 100) / 100,
  }
}

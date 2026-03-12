import { describe, it, expect } from 'vitest'
import { normalizeFonts, detectTypeScaleRatio } from '../normalize/typography'
import type { RawFontData } from '../types'

describe('normalizeFonts', () => {
  it('deduplicates fonts by family', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 300 },
      { family: 'Inter', size: '14px', weight: 400, lineHeight: '1.4', element: 'span', charCount: 100 },
    ]
    const { fonts } = normalizeFonts(raw)
    expect(fonts).toHaveLength(1)
    expect(fonts[0].family).toBe('Inter')
  })

  it('collects all weights', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 300 },
      { family: 'Inter', size: '24px', weight: 700, lineHeight: '1.2', element: 'h1', charCount: 50 },
    ]
    const { fonts } = normalizeFonts(raw)
    expect(fonts[0].weights).toContain(400)
    expect(fonts[0].weights).toContain(700)
  })

  it('assigns body role to most used font', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 500 },
      { family: 'Playfair Display', size: '32px', weight: 700, lineHeight: '1.1', element: 'h1', charCount: 20 },
    ]
    const { fonts } = normalizeFonts(raw)
    const body = fonts.find(f => f.role === 'body')
    expect(body).toBeDefined()
    expect(body!.family).toBe('Inter')
  })

  it('detects mono fonts', () => {
    const raw: RawFontData[] = [
      { family: 'JetBrains Mono', size: '14px', weight: 400, lineHeight: '1.6', element: 'code', charCount: 30 },
    ]
    const { fonts } = normalizeFonts(raw)
    expect(fonts[0].role).toBe('mono')
  })

  it('detects heading fonts', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 500 },
      { family: 'Playfair Display', size: '32px', weight: 700, lineHeight: '1.1', element: 'h1', charCount: 30 },
    ]
    const { fonts } = normalizeFonts(raw)
    const heading = fonts.find(f => f.role === 'heading')
    expect(heading).toBeDefined()
  })

  it('builds type scale sorted by size', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '32px', weight: 700, lineHeight: '1.1', element: 'h1', charCount: 20 },
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 500 },
      { family: 'Inter', size: '14px', weight: 400, lineHeight: '1.4', element: 'span', charCount: 100 },
    ]
    const { scale } = normalizeFonts(raw)
    expect(scale.length).toBeGreaterThanOrEqual(2)
    // Should be sorted ascending by size
    const sizes = scale.map(s => parseFloat(s.size))
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1])
    }
  })

  it('detects base size as most used', () => {
    const raw: RawFontData[] = [
      { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 500 },
      { family: 'Inter', size: '14px', weight: 400, lineHeight: '1.4', element: 'span', charCount: 50 },
    ]
    const { baseSize } = normalizeFonts(raw)
    expect(baseSize).toBe('16px')
  })
})

describe('detectTypeScaleRatio', () => {
  it('returns null for less than 3 scale entries', () => {
    const result = detectTypeScaleRatio([
      { size: '14px', lineHeight: '1.4', weight: 400 },
      { size: '16px', lineHeight: '1.5', weight: 400 },
    ])
    expect(result).toBeNull()
  })

  it('detects a known ratio for a perfect scale', () => {
    // Major Third ratio = 1.25: 12, 15, 18.75, 23.4375
    const scale = [
      { size: '12px', lineHeight: '1.5', weight: 400 },
      { size: '15px', lineHeight: '1.4', weight: 400 },
      { size: '18.75px', lineHeight: '1.3', weight: 500 },
      { size: '23.4375px', lineHeight: '1.2', weight: 700 },
    ]
    const result = detectTypeScaleRatio(scale)
    expect(result).not.toBeNull()
    expect(result!.confidence).toBeGreaterThan(0.5)
  })
})

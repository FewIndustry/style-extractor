import { describe, it, expect } from 'vitest'
import { generateCssVars } from '@/lib/export/css-vars'
import { generateTailwindConfig } from '@/lib/export/tailwind-config'
import { generateDesignTokensJson } from '@/lib/export/design-tokens'
import { generateScss } from '@/lib/export/scss'
import type { DesignTokens } from '../types'

const sampleTokens: DesignTokens = {
  colors: {
    palette: [
      { hex: '#3b82f6', hsl: { h: 217, s: 91, l: 60 }, frequency: 12 },
      { hex: '#ef4444', hsl: { h: 0, s: 84, l: 60 }, frequency: 3 },
    ],
    primary: { hex: '#3b82f6', hsl: { h: 217, s: 91, l: 60 }, frequency: 12 },
    background: { hex: '#ffffff', hsl: { h: 0, s: 0, l: 100 }, frequency: 20 },
    text: { hex: '#111827', hsl: { h: 220, s: 39, l: 11 }, frequency: 15 },
    neutrals: [
      { hex: '#111827', hsl: { h: 220, s: 39, l: 11 }, frequency: 15 },
      { hex: '#6b7280', hsl: { h: 220, s: 9, l: 46 }, frequency: 7 },
      { hex: '#f3f4f6', hsl: { h: 220, s: 14, l: 96 }, frequency: 5 },
    ],
    semantic: {
      success: { hex: '#22c55e', hsl: { h: 142, s: 71, l: 45 }, frequency: 3 },
      error: { hex: '#ef4444', hsl: { h: 0, s: 84, l: 60 }, frequency: 3 },
    },
  },
  typography: {
    fonts: [
      { family: 'Inter', weights: [400, 700], role: 'body' },
      { family: 'JetBrains Mono', weights: [400], role: 'mono' },
    ],
    scale: [
      { size: '14px', lineHeight: '1.4', weight: 400 },
      { size: '16px', lineHeight: '1.5', weight: 400 },
      { size: '24px', lineHeight: '1.2', weight: 700 },
    ],
    baseSize: '16px',
  },
  spacing: {
    base: 4,
    unit: 'px',
    values: [4, 8, 16, 24, 32],
    confidence: 0.85,
  },
  borders: {
    radii: ['4px', '8px'],
    widths: ['1px'],
  },
  shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
  metadata: {
    source: 'https://example.com',
    sourceType: 'url',
    extractedAt: '2024-01-01T00:00:00.000Z',
    layers: ['css-vars', 'heuristics'],
    confidence: 0.85,
  },
}

describe('generateCssVars', () => {
  it('generates valid CSS', () => {
    const css = generateCssVars(sampleTokens)
    expect(css).toContain(':root {')
    expect(css).toContain('}')
    expect(css).toContain('--color-primary: #3b82f6;')
    expect(css).toContain('--color-background: #ffffff;')
    expect(css).toContain('--color-text: #111827;')
  })

  it('includes semantic colors', () => {
    const css = generateCssVars(sampleTokens)
    expect(css).toContain('--color-success: #22c55e;')
    expect(css).toContain('--color-error: #ef4444;')
  })

  it('includes typography', () => {
    const css = generateCssVars(sampleTokens)
    expect(css).toContain('--font-body: Inter;')
    expect(css).toContain('--font-mono: JetBrains Mono;')
    expect(css).toContain('--font-size-base: 16px;')
  })

  it('includes spacing', () => {
    const css = generateCssVars(sampleTokens)
    expect(css).toContain('--spacing-4: 4px;')
    expect(css).toContain('--spacing-32: 32px;')
  })

  it('includes shadows', () => {
    const css = generateCssVars(sampleTokens)
    expect(css).toContain('--shadow-1:')
  })
})

describe('generateTailwindConfig', () => {
  it('generates a valid JS export', () => {
    const config = generateTailwindConfig(sampleTokens)
    expect(config).toContain('export default')
    expect(config).toContain('"primary"')
    expect(config).toContain('#3b82f6')
  })

  it('includes font families', () => {
    const config = generateTailwindConfig(sampleTokens)
    expect(config).toContain('"sans"')
    expect(config).toContain('Inter')
  })

  it('includes spacing', () => {
    const config = generateTailwindConfig(sampleTokens)
    expect(config).toContain('"4"')
    expect(config).toContain('"4px"')
  })
})

describe('generateDesignTokensJson', () => {
  it('generates valid W3C JSON', () => {
    const json = generateDesignTokensJson(sampleTokens)
    const parsed = JSON.parse(json)
    expect(parsed.color).toBeDefined()
    expect(parsed.color.primary.$value).toBe('#3b82f6')
    expect(parsed.color.primary.$type).toBe('color')
  })

  it('includes font families', () => {
    const json = generateDesignTokensJson(sampleTokens)
    const parsed = JSON.parse(json)
    expect(parsed.fontFamily.body.$value).toBe('Inter')
    expect(parsed.fontFamily.body.$type).toBe('fontFamily')
  })

  it('includes spacing', () => {
    const json = generateDesignTokensJson(sampleTokens)
    const parsed = JSON.parse(json)
    expect(parsed.spacing).toBeDefined()
    expect(parsed.spacing['4'].$value).toBe('4px')
  })

  it('includes semantic colors', () => {
    const json = generateDesignTokensJson(sampleTokens)
    const parsed = JSON.parse(json)
    expect(parsed.color.semantic.success.$value).toBe('#22c55e')
  })
})

describe('generateScss', () => {
  it('generates valid SCSS', () => {
    const scss = generateScss(sampleTokens)
    expect(scss).toContain('$color-primary: #3b82f6;')
    expect(scss).toContain('$color-background: #ffffff;')
    expect(scss).toContain('$color-text: #111827;')
  })

  it('includes color map', () => {
    const scss = generateScss(sampleTokens)
    expect(scss).toContain('$colors: (')
    expect(scss).toContain('"palette-1": #3b82f6')
  })

  it('includes typography', () => {
    const scss = generateScss(sampleTokens)
    expect(scss).toContain('$font-body: Inter;')
    expect(scss).toContain('$font-mono: JetBrains Mono;')
  })

  it('includes spacing', () => {
    const scss = generateScss(sampleTokens)
    expect(scss).toContain('$spacing-base: 4px;')
    expect(scss).toContain('$spacing-4: 4px;')
  })
})

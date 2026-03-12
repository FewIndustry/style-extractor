import { describe, it, expect } from 'vitest'
import { extractFromCssVars } from '../detect/css-vars'

describe('extractFromCssVars', () => {
  it('returns resolved:false for empty vars', () => {
    const result = extractFromCssVars({})
    expect(result.resolved).toBe(false)
    expect(result.colors).toHaveLength(0)
  })

  it('extracts hex colors from color vars', () => {
    const vars = {
      '--color-primary': '#3b82f6',
      '--color-secondary': '#9333ea',
      '--color-accent': '#f59e0b',
    }
    const result = extractFromCssVars(vars)
    expect(result.resolved).toBe(true)
    expect(result.colors.length).toBe(3)
    expect(result.colors[0].hex).toBe('#3b82f6')
  })

  it('infers roles from var names', () => {
    const vars = {
      '--color-primary': '#3b82f6',
      '--color-background': '#ffffff',
      '--color-text': '#111827',
    }
    const result = extractFromCssVars(vars)
    const roles = result.colors.map(c => c.role)
    expect(roles).toContain('primary')
    expect(roles).toContain('background')
    expect(roles).toContain('text')
  })

  it('handles rgb color values', () => {
    const vars = {
      '--color-primary': 'rgb(59, 130, 246)',
      '--bg-color': 'rgb(255, 255, 255)',
      '--text-color': 'rgb(17, 24, 39)',
    }
    const result = extractFromCssVars(vars)
    expect(result.resolved).toBe(true)
    expect(result.colors.length).toBe(3)
    expect(result.colors[0].hex).toBe('#3b82f6')
  })

  it('handles hsl color values', () => {
    const vars = {
      '--primary-color': 'hsl(217, 91%, 60%)',
      '--bg-color': 'hsl(0, 0%, 100%)',
      '--accent-color': 'hsl(38, 92%, 50%)',
    }
    const result = extractFromCssVars(vars)
    expect(result.resolved).toBe(true)
    expect(result.colors.length).toBe(3)
  })

  it('handles bare HSL values (shadcn format)', () => {
    const vars = {
      '--primary': '217 91% 60%',
      '--background': '0 0% 100%',
      '--accent': '38 92% 50%',
    }
    const result = extractFromCssVars(vars)
    expect(result.resolved).toBe(true)
    expect(result.colors.length).toBe(3)
  })

  it('extracts font families', () => {
    const vars = {
      '--font-sans': 'Inter, system-ui, sans-serif',
      '--font-mono': 'JetBrains Mono, monospace',
    }
    const result = extractFromCssVars(vars)
    expect(result.fontFamilies.length).toBe(2)
  })

  it('extracts spacing values', () => {
    const vars = {
      '--spacing-1': '4px',
      '--spacing-2': '8px',
    }
    const result = extractFromCssVars(vars)
    expect(result.spacing).toContain(4)
    expect(result.spacing).toContain(8)
  })

  it('extracts radii', () => {
    const vars = {
      '--radius': '0.5rem',
      '--radius-lg': '1rem',
    }
    const result = extractFromCssVars(vars)
    expect(result.radii.length).toBe(2)
  })

  it('ignores non-color values in color vars', () => {
    const vars = {
      '--color-primary': '#3b82f6',
      '--color-mode': 'dark', // not a color value
      '--bg-image': 'url(bg.png)', // not a color
      '--bg-color': '#ffffff',
      '--accent-color': '#f59e0b',
    }
    const result = extractFromCssVars(vars)
    expect(result.colors.every(c => c.hex.startsWith('#'))).toBe(true)
  })
})

import type { DesignTokens } from '@/types/tokens'

export function generateCssVars(tokens: DesignTokens): string {
  const lines: string[] = [':root {']

  // Colors
  lines.push('  /* Colors */')
  if (tokens.colors.primary) lines.push(`  --color-primary: ${tokens.colors.primary.hex};`)
  if (tokens.colors.secondary) lines.push(`  --color-secondary: ${tokens.colors.secondary.hex};`)
  if (tokens.colors.accent) lines.push(`  --color-accent: ${tokens.colors.accent.hex};`)
  if (tokens.colors.background) lines.push(`  --color-background: ${tokens.colors.background.hex};`)
  if (tokens.colors.text) lines.push(`  --color-text: ${tokens.colors.text.hex};`)

  if (tokens.colors.semantic.success) lines.push(`  --color-success: ${tokens.colors.semantic.success.hex};`)
  if (tokens.colors.semantic.error) lines.push(`  --color-error: ${tokens.colors.semantic.error.hex};`)
  if (tokens.colors.semantic.warning) lines.push(`  --color-warning: ${tokens.colors.semantic.warning.hex};`)
  if (tokens.colors.semantic.info) lines.push(`  --color-info: ${tokens.colors.semantic.info.hex};`)

  lines.push('')

  // Neutrals
  if (tokens.colors.neutrals.length > 0) {
    lines.push('  /* Neutrals */')
    tokens.colors.neutrals.forEach((n, i) => {
      const shade = Math.round((i / Math.max(tokens.colors.neutrals.length - 1, 1)) * 900 / 100) * 100 + 50
      lines.push(`  --color-neutral-${shade}: ${n.hex};`)
    })
    lines.push('')
  }

  // Palette
  lines.push('  /* Palette */')
  tokens.colors.palette.slice(0, 12).forEach((c, i) => {
    lines.push(`  --color-palette-${i + 1}: ${c.hex};`)
  })
  lines.push('')

  // Typography
  lines.push('  /* Typography */')
  tokens.typography.fonts.forEach(f => {
    if (f.role && f.role !== 'other') {
      lines.push(`  --font-${f.role}: ${f.family};`)
    }
  })
  if (tokens.typography.baseSize) {
    lines.push(`  --font-size-base: ${tokens.typography.baseSize};`)
  }
  tokens.typography.scale.forEach((s, i) => {
    lines.push(`  --font-size-${i + 1}: ${s.size};`)
  })
  lines.push('')

  // Spacing
  if (tokens.spacing) {
    lines.push('  /* Spacing */')
    tokens.spacing.values.forEach(v => {
      lines.push(`  --spacing-${v}: ${v}px;`)
    })
    lines.push('')
  }

  // Borders
  if (tokens.borders.radii.length > 0) {
    lines.push('  /* Border Radius */')
    tokens.borders.radii.forEach((r, i) => {
      lines.push(`  --radius-${i + 1}: ${r};`)
    })
    lines.push('')
  }

  // Shadows
  if (tokens.shadows.length > 0) {
    lines.push('  /* Shadows */')
    tokens.shadows.forEach((s, i) => {
      lines.push(`  --shadow-${i + 1}: ${s};`)
    })
  }

  lines.push('}')
  return lines.join('\n')
}

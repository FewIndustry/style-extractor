import type { DesignTokens } from '@/types/tokens'

/**
 * Generate W3C Design Tokens Community Group format.
 * https://tr.designtokens.org/format/
 */
export function generateDesignTokensJson(tokens: DesignTokens): string {
  const output: Record<string, unknown> = {}

  // Colors
  output.color = {}
  const colorGroup = output.color as Record<string, unknown>

  if (tokens.colors.primary) {
    colorGroup.primary = { $value: tokens.colors.primary.hex, $type: 'color' }
  }
  if (tokens.colors.secondary) {
    colorGroup.secondary = { $value: tokens.colors.secondary.hex, $type: 'color' }
  }
  if (tokens.colors.accent) {
    colorGroup.accent = { $value: tokens.colors.accent.hex, $type: 'color' }
  }
  if (tokens.colors.background) {
    colorGroup.background = { $value: tokens.colors.background.hex, $type: 'color' }
  }
  if (tokens.colors.text) {
    colorGroup.text = { $value: tokens.colors.text.hex, $type: 'color' }
  }

  // Semantic
  const semantic: Record<string, unknown> = {}
  if (tokens.colors.semantic.success) semantic.success = { $value: tokens.colors.semantic.success.hex, $type: 'color' }
  if (tokens.colors.semantic.error) semantic.error = { $value: tokens.colors.semantic.error.hex, $type: 'color' }
  if (tokens.colors.semantic.warning) semantic.warning = { $value: tokens.colors.semantic.warning.hex, $type: 'color' }
  if (tokens.colors.semantic.info) semantic.info = { $value: tokens.colors.semantic.info.hex, $type: 'color' }
  if (Object.keys(semantic).length > 0) colorGroup.semantic = semantic

  // Neutrals
  const neutralGroup: Record<string, unknown> = {}
  tokens.colors.neutrals.forEach((n, i) => {
    const shade = Math.round((i / Math.max(tokens.colors.neutrals.length - 1, 1)) * 900 / 100) * 100 + 50
    neutralGroup[shade.toString()] = { $value: n.hex, $type: 'color' }
  })
  if (Object.keys(neutralGroup).length > 0) colorGroup.neutral = neutralGroup

  // Typography
  output.fontFamily = {}
  const fontGroup = output.fontFamily as Record<string, unknown>
  tokens.typography.fonts.forEach(f => {
    if (f.role && f.role !== 'other') {
      fontGroup[f.role] = { $value: f.family, $type: 'fontFamily' }
    }
  })

  output.fontSize = {}
  const sizeGroup = output.fontSize as Record<string, unknown>
  tokens.typography.scale.forEach((s, i) => {
    sizeGroup[(i + 1).toString()] = { $value: s.size, $type: 'dimension' }
  })

  // Spacing
  if (tokens.spacing) {
    output.spacing = {}
    const spacingGroup = output.spacing as Record<string, unknown>
    tokens.spacing.values.forEach(v => {
      spacingGroup[v.toString()] = { $value: `${v}px`, $type: 'dimension' }
    })
  }

  // Border radius
  if (tokens.borders.radii.length > 0) {
    output.borderRadius = {}
    const radiusGroup = output.borderRadius as Record<string, unknown>
    tokens.borders.radii.forEach((r, i) => {
      radiusGroup[(i + 1).toString()] = { $value: r, $type: 'dimension' }
    })
  }

  return JSON.stringify(output, null, 2)
}

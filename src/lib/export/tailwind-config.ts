import type { DesignTokens } from '@/types/tokens'

export function generateTailwindConfig(tokens: DesignTokens): string {
  const colors: Record<string, string> = {}

  if (tokens.colors.primary) colors.primary = tokens.colors.primary.hex
  if (tokens.colors.secondary) colors.secondary = tokens.colors.secondary.hex
  if (tokens.colors.accent) colors.accent = tokens.colors.accent.hex
  if (tokens.colors.background) colors.background = tokens.colors.background.hex
  if (tokens.colors.text) colors.foreground = tokens.colors.text.hex
  if (tokens.colors.semantic.success) colors.success = tokens.colors.semantic.success.hex
  if (tokens.colors.semantic.error) colors.error = tokens.colors.semantic.error.hex
  if (tokens.colors.semantic.warning) colors.warning = tokens.colors.semantic.warning.hex
  if (tokens.colors.semantic.info) colors.info = tokens.colors.semantic.info.hex

  // Neutrals as gray scale
  const gray: Record<string, string> = {}
  tokens.colors.neutrals.forEach((n, i) => {
    const shade = Math.round((i / Math.max(tokens.colors.neutrals.length - 1, 1)) * 900 / 100) * 100 + 50
    gray[shade.toString()] = n.hex
  })

  // Font families
  const fontFamily: Record<string, string[]> = {}
  tokens.typography.fonts.forEach(f => {
    if (f.role === 'body') fontFamily.sans = [f.family, 'sans-serif']
    else if (f.role === 'heading') fontFamily.heading = [f.family, 'sans-serif']
    else if (f.role === 'mono') fontFamily.mono = [f.family, 'monospace']
  })

  // Font sizes
  const fontSize: Record<string, string> = {}
  tokens.typography.scale.forEach((s, i) => {
    const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']
    const name = names[i] || `${i + 1}`
    fontSize[name] = s.size
  })

  // Spacing
  const spacing: Record<string, string> = {}
  if (tokens.spacing) {
    tokens.spacing.values.forEach(v => {
      spacing[v.toString()] = `${v}px`
    })
  }

  // Border radius
  const borderRadius: Record<string, string> = {}
  tokens.borders.radii.forEach((r, i) => {
    const names = ['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full']
    borderRadius[names[i] || `${i}`] = r
  })

  // Shadows
  const boxShadow: Record<string, string> = {}
  tokens.shadows.forEach((s, i) => {
    const names = ['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl']
    boxShadow[names[i] || `${i}`] = s
  })

  const config = {
    theme: {
      extend: {
        colors: { ...colors, gray },
        fontFamily,
        fontSize,
        spacing,
        borderRadius,
        boxShadow,
      },
    },
  }

  return `/** @type {import('tailwindcss').Config} */
export default ${JSON.stringify(config, null, 2)}`
}

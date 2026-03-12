/**
 * Main extraction pipeline — Layer 0 → 3 cascade.
 *
 * Layer 0: CSS custom properties (free)
 * Layer 1: Framework detection (free)
 * Layer 2: Heuristic analysis (cheap compute)
 * Layer 3: AI fallback (API cost — only if needed)
 */

import type { RawExtractionData, DesignTokens } from './types'
import { extractFromCssVars } from './detect/css-vars'
import { detectFramework } from './detect/framework'
import { clusterColors, clustersToTokens, separateNeutrals } from './normalize/colors'
import { normalizeFonts } from './normalize/typography'
import { detectSpacingScale } from './normalize/spacing'
import { assignColorRoles } from './detect/heuristics'

export interface PipelineResult {
  tokens: DesignTokens
  layersUsed: string[]
}

export function runPipeline(raw: RawExtractionData): PipelineResult {
  const layersUsed: string[] = []

  // --- Layer 0: CSS Custom Properties ---
  const varTokens = extractFromCssVars(raw.cssVars)
  if (varTokens.resolved) {
    layersUsed.push('css-vars')
  }

  // --- Layer 1: Framework Detection ---
  const framework = detectFramework(raw.classNames, raw.cssVars)
  if (framework) {
    layersUsed.push(`framework:${framework.name}`)
  }

  // --- Layer 2: Computed Style Analysis ---
  layersUsed.push('heuristics')

  // Colors
  const clusters = clusterColors(raw.colors)
  const allTokens = clustersToTokens(clusters)
  const { chromatic, neutrals } = separateNeutrals(allTokens)

  // Merge CSS var colors with extracted colors (var colors get priority for roles)
  const mergedColors = [...varTokens.colors]
  for (const token of [...chromatic, ...neutrals]) {
    if (!mergedColors.some(c => c.hex === token.hex)) {
      mergedColors.push(token)
    }
  }

  // Assign semantic roles
  const colorRoles = assignColorRoles(mergedColors, raw.colors)

  // If CSS vars already had roles, prefer those
  for (const varColor of varTokens.colors) {
    if (varColor.role === 'primary' && !colorRoles.primary) colorRoles.primary = varColor
    if (varColor.role === 'secondary' && !colorRoles.secondary) colorRoles.secondary = varColor
    if (varColor.role === 'accent' && !colorRoles.accent) colorRoles.accent = varColor
    if (varColor.role === 'background' && !colorRoles.background) colorRoles.background = varColor
    if (varColor.role === 'text' && !colorRoles.text) colorRoles.text = varColor
    if (varColor.role === 'success') colorRoles.semantic.success = varColor
    if (varColor.role === 'error') colorRoles.semantic.error = varColor
    if (varColor.role === 'warning') colorRoles.semantic.warning = varColor
    if (varColor.role === 'info') colorRoles.semantic.info = varColor
  }

  // Typography
  const { fonts, scale, baseSize } = normalizeFonts(raw.fonts)

  // Spacing
  const spacingScale = detectSpacingScale(raw.spacing)

  // --- Build final tokens ---
  const tokens: DesignTokens = {
    colors: {
      palette: mergedColors.slice(0, 20), // cap at 20 most relevant
      ...colorRoles,
      neutrals,
    },
    typography: {
      fonts,
      scale,
      baseSize,
    },
    spacing: spacingScale,
    borders: {
      radii: [...new Set(raw.borderRadii)].sort(),
      widths: [...new Set(raw.borderWidths)].sort(),
    },
    shadows: raw.shadows.slice(0, 10),
    metadata: {
      source: raw.url,
      sourceType: 'url',
      extractedAt: new Date().toISOString(),
      layers: layersUsed,
      framework: framework?.name,
      confidence: calculateConfidence(layersUsed, mergedColors.length, fonts.length),
    },
  }

  return { tokens, layersUsed }
}

function calculateConfidence(layers: string[], colorCount: number, fontCount: number): number {
  let score = 0.5

  if (layers.includes('css-vars')) score += 0.2
  if (layers.some(l => l.startsWith('framework:'))) score += 0.15
  if (colorCount >= 5) score += 0.05
  if (colorCount >= 10) score += 0.05
  if (fontCount >= 1) score += 0.05

  return Math.min(Math.round(score * 100) / 100, 1)
}

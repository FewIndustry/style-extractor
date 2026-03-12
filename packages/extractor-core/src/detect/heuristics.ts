/**
 * Layer 2: Heuristic-based semantic labeling.
 * Assigns roles to colors based on usage context (which CSS properties
 * and elements they appear on).
 *
 * When property context is available (Browserless path), uses usedOnInteractive,
 * usedAsBackground, usedAsText counters. When context is missing (regex path),
 * falls back to saturation + frequency + lightness heuristics.
 */

import type { RawColorData, ColorToken, DesignTokens } from '../types'
import { isNeutral } from '../normalize/colors'

interface ColorUsageContext {
  hex: string
  hsl: { h: number; s: number; l: number }
  frequency: number
  usedOnInteractive: number
  usedAsBackground: number
  usedAsText: number
  usedAsBorder: number
}

const INTERACTIVE_SELECTORS = /button|btn|link|a\b|input|select|submit|cta/i

export function assignColorRoles(
  colors: ColorToken[],
  rawColors: RawColorData[]
): Pick<DesignTokens['colors'], 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'semantic'> {
  // Build usage context for each color
  const contextMap = new Map<string, ColorUsageContext>()

  for (const token of colors) {
    contextMap.set(token.hex, {
      hex: token.hex,
      hsl: token.hsl,
      frequency: token.frequency,
      usedOnInteractive: 0,
      usedAsBackground: 0,
      usedAsText: 0,
      usedAsBorder: 0,
    })
  }

  // Check if we have property context (Browserless) or not (regex path)
  let hasPropertyContext = false

  for (const raw of rawColors) {
    if (raw.property !== 'unknown' && raw.property !== '') {
      hasPropertyContext = true
    }
    for (const [, ctx] of contextMap) {
      if (raw.value.includes(ctx.hex) || colorsMatch(raw.value, ctx.hex)) {
        if (raw.property === 'backgroundColor' || raw.property === 'background-color') {
          ctx.usedAsBackground += raw.count
        } else if (raw.property === 'color') {
          ctx.usedAsText += raw.count
        } else if (raw.property.includes('border') || raw.property.includes('outline')) {
          ctx.usedAsBorder += raw.count
        }

        if (INTERACTIVE_SELECTORS.test(raw.selector)) ctx.usedOnInteractive += raw.count
      }
    }
  }

  const contexts = Array.from(contextMap.values())
  const chromatic = contexts.filter(c => !isNeutral(c.hsl))
  const neutrals = contexts.filter(c => isNeutral(c.hsl))

  let primary: ColorUsageContext | undefined
  let secondary: ColorUsageContext | undefined
  let accent: ColorUsageContext | undefined
  let background: ColorUsageContext | undefined
  let text: ColorUsageContext | undefined

  if (hasPropertyContext) {
    // --- Context-aware path (Browserless/DOM extraction) ---
    primary = chromatic.sort((a, b) =>
      (b.usedOnInteractive || b.frequency) - (a.usedOnInteractive || a.frequency)
    )[0]

    secondary = chromatic.find(c =>
      c !== primary && Math.abs(c.hsl.h - (primary?.hsl.h || 0)) > 30
    )

    accent = chromatic.filter(c => c !== primary && c !== secondary)
      .sort((a, b) => a.frequency - b.frequency)[0]

    background = neutrals
      .filter(c => c.usedAsBackground > 0)
      .sort((a, b) => b.usedAsBackground - a.usedAsBackground)[0]
      || neutrals.sort((a, b) => b.hsl.l - a.hsl.l)[0]

    text = neutrals
      .filter(c => c.usedAsText > 0)
      .sort((a, b) => b.usedAsText - a.usedAsText)[0]
      || neutrals.sort((a, b) => a.hsl.l - b.hsl.l)[0]
  } else {
    // --- Fallback path (regex extraction, no property context) ---
    // Primary: most frequent HIGH-SATURATION color (not just most frequent overall)
    // Prioritize saturation to avoid picking a desaturated gray as "primary"
    primary = chromatic
      .filter(c => c.hsl.s >= 30)
      .sort((a, b) => {
        // Score = frequency * saturation weight
        const scoreA = a.frequency * (a.hsl.s / 100)
        const scoreB = b.frequency * (b.hsl.s / 100)
        return scoreB - scoreA
      })[0]
      || chromatic.sort((a, b) => b.frequency - a.frequency)[0]

    // Secondary: different hue family from primary, high saturation
    secondary = chromatic
      .filter(c => c !== primary && hueDifference(c.hsl.h, primary?.hsl.h || 0) > 30 && c.hsl.s >= 20)
      .sort((a, b) => b.frequency - a.frequency)[0]

    // Accent: different from both primary and secondary
    accent = chromatic
      .filter(c => c !== primary && c !== secondary && c.hsl.s >= 20)
      .sort((a, b) => b.frequency - a.frequency)[0]

    // Background: lightest neutral (light theme) or darkest (dark theme)
    // Detect theme by checking if the most-frequent neutral is light or dark
    const sortedNeutrals = [...neutrals].sort((a, b) => b.frequency - a.frequency)
    const dominantNeutral = sortedNeutrals[0]
    const isDarkTheme = dominantNeutral && dominantNeutral.hsl.l < 50

    if (isDarkTheme) {
      background = neutrals.sort((a, b) => a.hsl.l - b.hsl.l)[0]
      text = neutrals.filter(c => c !== background).sort((a, b) => b.hsl.l - a.hsl.l)[0]
    } else {
      background = neutrals.sort((a, b) => b.hsl.l - a.hsl.l)[0]
      text = neutrals.filter(c => c !== background).sort((a, b) => a.hsl.l - b.hsl.l)[0]
    }
  }

  // Semantic: match by hue ranges, prefer higher frequency within range
  const semantic = {
    success: findByHueRange(chromatic, 100, 160),
    error: findByHueRange(chromatic, 340, 20),
    warning: findByHueRange(chromatic, 25, 55),
    info: findByHueRange(chromatic, 190, 240),
  }

  return {
    primary: primary ? toToken(primary) : undefined,
    secondary: secondary ? toToken(secondary) : undefined,
    accent: accent ? toToken(accent) : undefined,
    background: background ? toToken(background) : undefined,
    text: text ? toToken(text) : undefined,
    semantic: {
      success: semantic.success ? toToken(semantic.success) : undefined,
      error: semantic.error ? toToken(semantic.error) : undefined,
      warning: semantic.warning ? toToken(semantic.warning) : undefined,
      info: semantic.info ? toToken(semantic.info) : undefined,
    },
  }
}

function toToken(ctx: ColorUsageContext): ColorToken {
  return { hex: ctx.hex, hsl: ctx.hsl, frequency: ctx.frequency }
}

function hueDifference(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff)
}

function findByHueRange(
  colors: ColorUsageContext[],
  minHue: number,
  maxHue: number
): ColorUsageContext | undefined {
  const matches = colors.filter(c => {
    if (minHue > maxHue) {
      return c.hsl.h >= minHue || c.hsl.h <= maxHue
    }
    return c.hsl.h >= minHue && c.hsl.h <= maxHue
  })
  // Return the highest-frequency match, not just the first one
  return matches.sort((a, b) => b.frequency - a.frequency)[0]
}

function colorsMatch(rawValue: string, hex: string): boolean {
  return rawValue.toLowerCase().includes(hex.toLowerCase())
}

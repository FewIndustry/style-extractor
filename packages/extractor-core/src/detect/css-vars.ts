/**
 * Layer 0: Extract design tokens directly from CSS custom properties.
 * Many modern sites already have well-named --vars on :root.
 */

import type { ColorToken } from '../types'

interface VarTokens {
  colors: ColorToken[]
  fontFamilies: string[]
  spacing: number[]
  radii: string[]
  resolved: boolean
}

const COLOR_VAR_PATTERNS = [
  /color/i, /bg/i, /background/i, /border/i, /accent/i, /primary/i,
  /secondary/i, /success/i, /error/i, /warning/i, /danger/i, /info/i,
  /muted/i, /foreground/i, /card/i, /popover/i, /destructive/i,
]

const FONT_VAR_PATTERNS = [/font/i, /family/i, /sans/i, /serif/i, /mono/i]
const SPACING_VAR_PATTERNS = [/spacing/i, /space/i, /gap/i, /radius/i]
const RADIUS_VAR_PATTERNS = [/radius/i, /rounded/i]

function isColorValue(val: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(val) ||
    /^rgba?\(/.test(val) ||
    /^hsla?\(/.test(val) ||
    /^oklch\(/.test(val) ||
    /^oklab\(/.test(val) ||
    /^lch\(/.test(val) ||
    /^lab\(/.test(val) ||
    /^color\(/.test(val) ||
    // Bare "H S% L%" values from shadcn/radix
    /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(val)
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0
  const h = hex.replace('#', '')
  if (h.length === 3) {
    r = parseInt(h[0]+h[0], 16); g = parseInt(h[1]+h[1], 16); b = parseInt(h[2]+h[2], 16)
  } else {
    r = parseInt(h.slice(0,2), 16); g = parseInt(h.slice(2,4), 16); b = parseInt(h.slice(4,6), 16)
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max - min)
  let hue = 0
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6
  return { h: Math.round(hue * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function extractFromCssVars(cssVars: Record<string, string>): VarTokens {
  const colors: ColorToken[] = []
  const fontFamilies: string[] = []
  const spacing: number[] = []
  const radii: string[] = []

  const entries = Object.entries(cssVars)
  if (entries.length === 0) return { colors: [], fontFamilies: [], spacing: [], radii: [], resolved: false }

  let colorCount = 0

  for (const [name, value] of entries) {
    const trimmed = value.trim()

    // Colors
    if (COLOR_VAR_PATTERNS.some(p => p.test(name)) && isColorValue(trimmed)) {
      const role = inferRoleFromVarName(name)
      const hex = colorValueToHex(trimmed)
      if (hex) {
        colors.push({
          hex,
          hsl: hexToHsl(hex),
          role,
          frequency: 1,
        })
        colorCount++
      }
    }

    // Fonts
    if (FONT_VAR_PATTERNS.some(p => p.test(name)) && !isColorValue(trimmed)) {
      fontFamilies.push(trimmed)
    }

    // Spacing
    if (SPACING_VAR_PATTERNS.some(p => p.test(name))) {
      const px = parseFloat(trimmed)
      if (!isNaN(px) && px > 0) spacing.push(px)
    }

    // Radii
    if (RADIUS_VAR_PATTERNS.some(p => p.test(name))) {
      radii.push(trimmed)
    }
  }

  // Consider resolved if we found at least 3 color vars
  const resolved = colorCount >= 3

  return { colors, fontFamilies, spacing, radii, resolved }
}

/**
 * Convert any supported color value string to a hex color.
 */
function colorValueToHex(val: string): string | null {
  // Already hex
  if (/^#[0-9a-f]{3,8}$/i.test(val)) return val.length === 4
    ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
    : val.toLowerCase()

  // rgb/rgba
  const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3])

  // hsl/hsla
  const hslMatch = val.match(/hsla?\(\s*([\d.]+)\s*,?\s*([\d.]+)%?\s*,?\s*([\d.]+)%?/)
  if (hslMatch) {
    const rgb = hslFuncToRgb(+hslMatch[1], +hslMatch[2], +hslMatch[3])
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  }

  // oklch(L C H)
  const oklchMatch = val.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/)
  if (oklchMatch) {
    const rgb = oklchApproxToRgb(+oklchMatch[1] / 100, +oklchMatch[2], +oklchMatch[3])
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  }

  // Bare "H S% L%" (shadcn/radix)
  const bareHslMatch = val.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (bareHslMatch) {
    const rgb = hslFuncToRgb(+bareHslMatch[1], +bareHslMatch[2], +bareHslMatch[3])
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  }

  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}

function hslFuncToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

function oklchApproxToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hRad = (h * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bv = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255)
  return { r: clamp(r), g: clamp(g), b: clamp(bv) }
}

function inferRoleFromVarName(name: string): string | undefined {
  const lower = name.toLowerCase()
  if (/primary/.test(lower)) return 'primary'
  if (/secondary/.test(lower)) return 'secondary'
  if (/accent/.test(lower)) return 'accent'
  if (/success/.test(lower)) return 'success'
  if (/error|danger|destructive/.test(lower)) return 'error'
  if (/warning/.test(lower)) return 'warning'
  if (/info/.test(lower)) return 'info'
  if (/background|bg/.test(lower)) return 'background'
  if (/foreground|text/.test(lower)) return 'text'
  if (/muted/.test(lower)) return 'muted'
  if (/border/.test(lower)) return 'border'
  return undefined
}

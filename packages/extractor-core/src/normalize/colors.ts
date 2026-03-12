import type { RawColorData, CIELabColor, ColorCluster, ColorToken } from '../types'

// --- Color parsing utilities ---

function parseColor(value: string): { r: number; g: number; b: number } | null {
  // hex
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
    if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  // rgb/rgba
  const rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] }
  }

  // hsl/hsla → convert to RGB
  const hslMatch = value.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/)
  if (hslMatch) {
    return hslToRgb(+hslMatch[1], +hslMatch[2], +hslMatch[3])
  }

  // oklch(L C H) — approximate conversion to sRGB
  const oklchMatch = value.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/)
  if (oklchMatch) {
    return oklchToRgb(+oklchMatch[1] / 100, +oklchMatch[2], +oklchMatch[3])
  }

  // Bare "H S% L%" values (shadcn/radix style CSS var values like "240 5.9% 10%")
  const bareHslMatch = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (bareHslMatch) {
    return hslToRgb(+bareHslMatch[1], +bareHslMatch[2], +bareHslMatch[3])
  }

  return null
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  // OKLCH → OKLab
  const hRad = (h * Math.PI) / 180
  const labA = c * Math.cos(hRad)
  const labB = c * Math.sin(hRad)

  // OKLab → linear sRGB (approximate)
  const l_ = l + 0.3963377774 * labA + 0.2158037573 * labB
  const m_ = l - 0.1055613458 * labA - 0.0638541728 * labB
  const s_ = l - 0.0894841775 * labA - 1.2914855480 * labB

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3

  return {
    r: Math.round(Math.max(0, Math.min(1, r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, b)) * 255),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max - min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// --- CIELAB conversion for perceptual color distance ---

function rgbToLab(r: number, g: number, b: number): CIELabColor {
  // sRGB to linear
  let rl = r / 255, gl = g / 255, bl = b / 255
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92

  // linear RGB to XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  x = f(x); y = f(y); z = f(z)

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  }
}

function deltaE(c1: CIELabColor, c2: CIELabColor): number {
  return Math.sqrt(
    (c1.L - c2.L) ** 2 + (c1.a - c2.a) ** 2 + (c1.b - c2.b) ** 2
  )
}

// --- Clustering ---

export function clusterColors(raw: RawColorData[], threshold = 5): ColorCluster[] {
  const parsed: { hex: string; rgb: { r: number; g: number; b: number }; lab: CIELabColor; freq: number }[] = []

  for (const entry of raw) {
    const rgb = parseColor(entry.value)
    if (!rgb) continue
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
    const existing = parsed.find(p => p.hex === hex)
    if (existing) {
      existing.freq += entry.count
    } else {
      parsed.push({ hex, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b), freq: entry.count })
    }
  }

  // Sort by frequency
  parsed.sort((a, b) => b.freq - a.freq)

  const clusters: ColorCluster[] = []

  for (const color of parsed) {
    let merged = false
    for (const cluster of clusters) {
      if (deltaE(color.lab, cluster.lab) < threshold) {
        cluster.members.push(color.hex)
        cluster.frequency += color.freq
        // Keep the most frequent as representative
        if (color.freq > cluster.frequency - color.freq) {
          cluster.representative = color.hex
          cluster.lab = color.lab
        }
        merged = true
        break
      }
    }
    if (!merged) {
      clusters.push({
        representative: color.hex,
        members: [color.hex],
        lab: color.lab,
        frequency: color.freq,
      })
    }
  }

  return clusters.sort((a, b) => b.frequency - a.frequency)
}

// --- Convert clusters to tokens ---

export function clustersToTokens(clusters: ColorCluster[]): ColorToken[] {
  return clusters.map(c => {
    const rgb = parseColor(c.representative)!
    return {
      hex: c.representative,
      hsl: rgbToHsl(rgb.r, rgb.g, rgb.b),
      frequency: c.frequency,
    }
  })
}

// --- Neutral detection ---

/**
 * Determine if a color is a neutral (grayscale or near-grayscale).
 * - saturation < 15 → always neutral
 * - saturation < 25 AND very light (>90) or very dark (<15) → neutral
 *   (catches desaturated warm/cool grays like Tailwind's slate, zinc)
 */
export function isNeutral(hsl: { s: number; l: number }): boolean {
  if (hsl.s < 15) return true
  if (hsl.s < 25 && (hsl.l > 90 || hsl.l < 15)) return true
  return false
}

// --- Separate neutrals from chromatic colors ---

export function separateNeutrals(tokens: ColorToken[]): {
  chromatic: ColorToken[]
  neutrals: ColorToken[]
} {
  const neutrals: ColorToken[] = []
  const chromatic: ColorToken[] = []

  for (const token of tokens) {
    if (isNeutral(token.hsl)) {
      neutrals.push(token)
    } else {
      chromatic.push(token)
    }
  }

  // Sort neutrals by lightness
  neutrals.sort((a, b) => a.hsl.l - b.hsl.l)

  return { chromatic, neutrals }
}

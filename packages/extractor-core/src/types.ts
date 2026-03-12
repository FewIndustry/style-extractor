export interface RawColorData {
  value: string
  property: string
  selector: string
  count: number
}

export interface RawFontData {
  family: string
  size: string
  weight: number
  lineHeight: string
  element: string
  charCount: number
}

export interface RawSpacingData {
  value: number
  property: string
  count: number
}

export interface RawExtractionData {
  colors: RawColorData[]
  fonts: RawFontData[]
  spacing: RawSpacingData[]
  cssVars: Record<string, string>
  shadows: string[]
  borderRadii: string[]
  borderWidths: string[]
  classNames: string[]
  url: string
}

export interface CIELabColor {
  L: number
  a: number
  b: number
}

export interface ColorCluster {
  representative: string
  members: string[]
  lab: CIELabColor
  frequency: number
}

// --- Shared design token types (canonical source) ---

export interface ColorToken {
  hex: string
  hsl: { h: number; s: number; l: number }
  role?: string
  frequency: number
}

export interface TypographyToken {
  family: string
  weights: number[]
  role?: 'heading' | 'body' | 'display' | 'mono' | 'other'
}

export interface TypeScaleEntry {
  size: string
  lineHeight: string
  weight: number
  element?: string
}

export interface SpacingScale {
  base: number
  unit: 'px' | 'rem'
  values: number[]
  confidence: number
}

export interface DesignTokens {
  colors: {
    palette: ColorToken[]
    primary?: ColorToken
    secondary?: ColorToken
    accent?: ColorToken
    background?: ColorToken
    text?: ColorToken
    neutrals: ColorToken[]
    semantic: {
      success?: ColorToken
      error?: ColorToken
      warning?: ColorToken
      info?: ColorToken
    }
  }
  typography: {
    fonts: TypographyToken[]
    scale: TypeScaleEntry[]
    baseSize?: string
  }
  spacing: SpacingScale | null
  borders: {
    radii: string[]
    widths: string[]
  }
  shadows: string[]
  metadata: {
    source: string
    sourceType: 'url' | 'pdf'
    extractedAt: string
    layers: string[]
    framework?: string
    confidence: number
  }
}

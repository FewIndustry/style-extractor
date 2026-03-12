import { useState, useCallback } from 'react'
import type { DesignTokens } from '@/types/tokens'
import type { RawExtractionData } from '@extractor/types'
import { runPipeline } from '@extractor/pipeline'

interface ExtractionState {
  status: 'idle' | 'processing' | 'complete' | 'failed'
  tokens: DesignTokens | null
  error: string | null
  layers: string[]
  cached: boolean
  refining: boolean
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    status: 'idle',
    tokens: null,
    error: null,
    layers: [],
    cached: false,
    refining: false,
  })

  const extractFromUrl = useCallback(async (url: string, skipCache = false) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false })

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, skipCache }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `Edge function returned ${res.status}`)
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Check if we got a cached result (tokens already computed)
      if (data.cached && data.tokens) {
        setState({
          status: 'complete',
          tokens: data.tokens as DesignTokens,
          error: null,
          layers: (data.tokens as DesignTokens).metadata?.layers || ['cache'],
          cached: true,
          refining: false,
        })
        return
      }

      const { html, css, url: finalUrl } = data as {
        html: string
        css: string
        url: string
      }

      // Combine HTML + fetched CSS for extraction
      const combined = html + '\n' + css
      const rawData = extractFromSource(combined, finalUrl)
      const { tokens, layersUsed } = runPipeline(rawData)

      // Save to cache via Edge Function (fire-and-forget)
      saveToCache(url, tokens).catch(() => {})

      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'Extraction failed',
        layers: [],
        cached: false,
        refining: false,
      })
    }
  }, [])

  const extractFromPdf = useCallback(async (file: File) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false })

    try {
      const { extractPdf } = await import('@/lib/pdf-extractor')
      const rawData = await extractPdf(file)
      const { tokens, layersUsed } = runPipeline(rawData)
      tokens.metadata.sourceType = 'pdf'
      tokens.metadata.source = file.name

      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'PDF extraction failed',
        layers: [],
        cached: false,
        refining: false,
      })
    }
  }, [])

  const extractFromRawData = useCallback((data: RawExtractionData) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false })
    try {
      const { tokens, layersUsed } = runPipeline(data)
      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'Pipeline failed',
        layers: [],
        cached: false,
        refining: false,
      })
    }
  }, [])

  const refineWithAI = useCallback(async () => {
    if (!state.tokens) return
    setState(prev => ({ ...prev, refining: true }))

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: state.tokens }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `AI refinement returned ${res.status}`)
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const refined = data.tokens as DesignTokens
      // Preserve original metadata but add AI layer
      refined.metadata = {
        ...state.tokens.metadata,
        ...refined.metadata,
        layers: [...state.tokens.metadata.layers, 'ai-refine'],
      }

      setState(prev => ({
        ...prev,
        tokens: refined,
        layers: refined.metadata.layers,
        refining: false,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        refining: false,
        error: err instanceof Error ? err.message : 'AI refinement failed',
      }))
    }
  }, [state.tokens])

  const reset = useCallback(() => {
    setState({ status: 'idle', tokens: null, error: null, layers: [], cached: false, refining: false })
  }, [])

  return { ...state, extractFromUrl, extractFromPdf, extractFromRawData, refineWithAI, reset }
}

async function saveToCache(url: string, tokens: DesignTokens): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  // Hash the URL client-side for the cache key
  const data = new TextEncoder().encode(url.toLowerCase().replace(/\/+$/, ''))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const urlHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  await fetch(`${supabaseUrl}/functions/v1/cache-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url_hash: urlHash, tokens }),
  }).catch(() => {})
}

/**
 * Parse colors, fonts, spacing, shadows, etc. from combined HTML + CSS text.
 * Extracts CSS property context (color vs background-color vs border-color)
 * so the heuristic layer can make better role assignments.
 */
function extractFromSource(source: string, url: string): RawExtractionData {
  const colorMap = new Map<string, { property: string; count: number }>()
  const cssVars: Record<string, string> = {}
  const classNames: string[] = []

  // --- Color extraction with property context ---

  // Color property patterns with named CSS properties
  const colorPropPatterns: { regex: RegExp; property: string }[] = [
    { regex: /(?:^|[;{]\s*)color\s*:\s*([^;}{]+)/g, property: 'color' },
    { regex: /background-color\s*:\s*([^;}{]+)/g, property: 'backgroundColor' },
    { regex: /background\s*:\s*([^;}{]+)/g, property: 'backgroundColor' },
    { regex: /border-color\s*:\s*([^;}{]+)/g, property: 'borderColor' },
    { regex: /border(?:-(?:top|right|bottom|left))?-color\s*:\s*([^;}{]+)/g, property: 'borderColor' },
    { regex: /outline-color\s*:\s*([^;}{]+)/g, property: 'outlineColor' },
    { regex: /fill\s*:\s*([^;}{]+)/g, property: 'color' },
    { regex: /stroke\s*:\s*([^;}{]+)/g, property: 'borderColor' },
  ]

  // Extract all color values within their context
  const colorValueRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)/g

  for (const { regex, property } of colorPropPatterns) {
    let match
    while ((match = regex.exec(source)) !== null) {
      const declaration = match[1]
      let colorMatch
      while ((colorMatch = colorValueRegex.exec(declaration)) !== null) {
        const raw = colorMatch[0]
        const normalized = normalizeColorValue(raw)
        if (normalized) {
          const key = `${normalized}::${property}`
          const existing = colorMap.get(key)
          if (existing) {
            existing.count++
          } else {
            colorMap.set(key, { property, count: 1 })
          }
        }
      }
      colorValueRegex.lastIndex = 0
    }
    regex.lastIndex = 0
  }

  // Also do a broad sweep for any colors we missed (not in a known property)
  const broadColorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)/g
  let broadMatch
  while ((broadMatch = broadColorRegex.exec(source)) !== null) {
    const normalized = normalizeColorValue(broadMatch[0])
    if (normalized) {
      // Only add if not already captured with a specific property
      const hasSpecific = Array.from(colorMap.keys()).some(k => k.startsWith(normalized + '::') && !k.endsWith('::unknown'))
      if (!hasSpecific) {
        const key = `${normalized}::unknown`
        const existing = colorMap.get(key)
        if (existing) {
          existing.count++
        } else {
          colorMap.set(key, { property: 'unknown', count: 1 })
        }
      }
    }
  }

  const colors: RawExtractionData['colors'] = []
  colorMap.forEach(({ property, count }, key) => {
    const value = key.split('::')[0]
    colors.push({ value, property, selector: '', count })
  })

  // --- CSS custom properties ---
  const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;}{]+)/g
  let varMatch
  while ((varMatch = varRegex.exec(source)) !== null) {
    cssVars[`--${varMatch[1]}`] = varMatch[2].trim()
  }

  // --- Class names ---
  const classRegex = /class="([^"]+)"/g
  let classMatch
  while ((classMatch = classRegex.exec(source)) !== null) {
    classMatch[1].split(/\s+/).forEach(c => {
      if (c && !classNames.includes(c)) classNames.push(c)
    })
  }

  // --- Font extraction (font-family, font shorthand, font-size, font-weight) ---
  const fonts: RawExtractionData['fonts'] = []
  const seenFontKeys = new Set<string>()

  // Parse font-family declarations
  const fontFamilyRegex = /font-family\s*:\s*([^;}{]+)/g
  let fontMatch
  while ((fontMatch = fontFamilyRegex.exec(source)) !== null) {
    addFontEntry(fonts, seenFontKeys, fontMatch[1].trim(), '16px', 400, '1.5')
  }

  // Parse shorthand font declarations: font: [style] [variant] [weight] size[/lineHeight] family
  const fontShorthandRegex = /(?:^|[;{]\s*)font\s*:\s*([^;}{]+)/g
  let shorthandMatch
  while ((shorthandMatch = fontShorthandRegex.exec(source)) !== null) {
    const val = shorthandMatch[1].trim()
    // Skip CSS keywords
    if (/^(inherit|initial|unset|revert)$/.test(val)) continue

    // Try to parse: optional-weight size/lineHeight family
    const parts = val.split(/\s+/)
    let weight = 400
    let size = '16px'
    let lineHeight = '1.5'
    let familyParts: string[] = []
    let foundSize = false

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (!foundSize) {
        // Check if this is a weight
        if (/^\d{3}$/.test(p)) { weight = parseInt(p); continue }
        if (p === 'bold') { weight = 700; continue }
        if (p === 'normal' || p === 'italic' || p === 'oblique') continue
        if (p === 'small-caps') continue

        // Check if this is a size (contains px/rem/em/%)
        const sizeMatch = p.match(/^([\d.]+(?:px|rem|em|%))(?:\/([\d.]+(?:px|rem|em|%)?))?$/)
        if (sizeMatch) {
          size = sizeMatch[1]
          if (sizeMatch[2]) lineHeight = sizeMatch[2]
          foundSize = true
          continue
        }
      } else {
        familyParts.push(p)
      }
    }

    if (familyParts.length > 0) {
      const family = familyParts.join(' ').replace(/,.*$/, '').trim()
      addFontEntry(fonts, seenFontKeys, family, size, weight, lineHeight)
    }
  }

  // Parse standalone font-size declarations and try to associate with closest font-family
  const sizeRegex = /font-size\s*:\s*([\d.]+(?:px|rem|em|%))/g
  let sizeMatch
  while ((sizeMatch = sizeRegex.exec(source)) !== null) {
    const family = fonts[0]?.family || 'sans-serif'
    addFontEntry(fonts, seenFontKeys, family, sizeMatch[1], 400, '1.5')
  }

  // Collect all font-weight values and distribute across known fonts
  const weightRegex = /font-weight\s*:\s*(\d{3}|bold|normal|lighter|bolder)/g
  let weightMatch
  while ((weightMatch = weightRegex.exec(source)) !== null) {
    const w = weightMatch[1]
    const numWeight = w === 'bold' ? 700 : w === 'normal' ? 400 : w === 'lighter' ? 300 : w === 'bolder' ? 800 : parseInt(w)
    if (!isNaN(numWeight)) {
      // Add the weight to all known fonts (they're all potential users)
      for (const f of fonts) {
        if (f.weight === 400 && numWeight !== 400) {
          // Create a variant with this weight
          addFontEntry(fonts, seenFontKeys, f.family, f.size, numWeight, f.lineHeight)
          break
        }
      }
    }
  }

  // --- Spacing ---
  const spacingRegex = /(?:margin|padding)(?:-(?:top|right|bottom|left))?\s*:\s*([^;}{]+)/g
  const spacingCount = new Map<number, number>()
  let spacingMatch
  while ((spacingMatch = spacingRegex.exec(source)) !== null) {
    const parts = spacingMatch[1].trim().split(/\s+/)
    for (const part of parts) {
      const px = parseFloat(part)
      if (!isNaN(px) && px > 0 && px < 200) {
        const rounded = Math.round(px)
        spacingCount.set(rounded, (spacingCount.get(rounded) || 0) + 1)
      }
    }
  }
  // Also extract gap values
  const gapRegex = /(?:^|[;{]\s*)gap\s*:\s*([^;}{]+)/g
  let gapMatch
  while ((gapMatch = gapRegex.exec(source)) !== null) {
    const parts = gapMatch[1].trim().split(/\s+/)
    for (const part of parts) {
      const px = parseFloat(part)
      if (!isNaN(px) && px > 0 && px < 200) {
        const rounded = Math.round(px)
        spacingCount.set(rounded, (spacingCount.get(rounded) || 0) + 1)
      }
    }
  }
  const spacingValues: RawExtractionData['spacing'] = []
  spacingCount.forEach((count, value) => {
    spacingValues.push({ value, property: 'mixed', count })
  })

  // --- Box shadow ---
  const shadowRegex = /box-shadow\s*:\s*([^;}{]+)/g
  const shadows: string[] = []
  let shadowMatch
  while ((shadowMatch = shadowRegex.exec(source)) !== null) {
    const val = shadowMatch[1].trim()
    if (val !== 'none' && !shadows.includes(val)) shadows.push(val)
  }

  // --- Border radius ---
  const radiusRegex = /border-radius\s*:\s*([^;}{]+)/g
  const borderRadii: string[] = []
  let radiusMatch
  while ((radiusMatch = radiusRegex.exec(source)) !== null) {
    const val = radiusMatch[1].trim()
    if (val !== '0' && val !== '0px' && !borderRadii.includes(val)) borderRadii.push(val)
  }

  // --- Border width ---
  const bwRegex = /border-width\s*:\s*([^;}{]+)/g
  const borderWidths: string[] = []
  let bwMatch
  while ((bwMatch = bwRegex.exec(source)) !== null) {
    const val = bwMatch[1].trim()
    if (val !== '0' && val !== '0px' && !borderWidths.includes(val)) borderWidths.push(val)
  }

  return {
    colors: colors.sort((a, b) => b.count - a.count),
    fonts,
    spacing: spacingValues.sort((a, b) => b.count - a.count),
    cssVars,
    shadows,
    borderRadii,
    borderWidths,
    classNames,
    url,
  }
}

function normalizeColorValue(raw: string): string | null {
  if (raw.length > 9 && raw.startsWith('#')) return null // too long for a hex color
  if (raw.startsWith('#')) {
    return raw.length === 4
      ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
      : raw.toLowerCase()
  }
  return raw
}

function addFontEntry(
  fonts: RawExtractionData['fonts'],
  seen: Set<string>,
  family: string,
  size: string,
  weight: number,
  lineHeight: string
): void {
  const cleanFamily = family.replace(/["']/g, '').trim()
  if (!cleanFamily) return
  const key = `${cleanFamily}::${size}::${weight}`
  if (seen.has(key)) return
  seen.add(key)
  fonts.push({
    family: cleanFamily,
    size,
    weight,
    lineHeight,
    element: 'unknown',
    charCount: 50,
  })
}

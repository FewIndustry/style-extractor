import * as pdfjsLib from 'pdfjs-dist'
import type { RawExtractionData, RawColorData, RawFontData } from '@extractor/types'

// Use the bundled worker — import directly so Vite can resolve it
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Extract design-relevant data from a PDF file.
 * Parses text content for fonts/sizes and page graphics for colors.
 */
export async function extractPdf(file: File): Promise<RawExtractionData> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const colors: RawColorData[] = []
  const colorCount = new Map<string, number>()
  const fontMap = new Map<string, RawFontData>()

  // Process up to 20 pages
  const pageCount = Math.min(pdf.numPages, 20)

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)

    // --- Extract text content for fonts ---
    const textContent = await page.getTextContent()
    const items = textContent.items ?? []
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      if (!item || !('str' in item) || !item.str.trim()) continue

      const fontName = item.fontName || 'unknown'
      // Height approximates font size in PDF points
      const height = item.height || item.transform?.[3] || 12
      const fontSize = `${Math.round(Math.abs(height))}px`

      const key = `${fontName}::${fontSize}`
      if (fontMap.has(key)) {
        fontMap.get(key)!.charCount += item.str.length
      } else {
        fontMap.set(key, {
          family: cleanPdfFontName(fontName),
          size: fontSize,
          weight: fontName.toLowerCase().includes('bold') ? 700 : 400,
          lineHeight: '1.2',
          element: 'unknown',
          charCount: item.str.length,
        })
      }
    }

    // --- Extract colors from page operators ---
    const opList = await page.getOperatorList()
    for (let j = 0; j < opList.fnArray.length; j++) {
      const fn = opList.fnArray[j]
      const args = opList.argsArray[j]

      // OPS.setFillRGBColor = 31, OPS.setStrokeRGBColor = 33
      // OPS.setFillGray = 35, OPS.setStrokeGray = 37
      // OPS.setFillCMYKColor = 39, OPS.setStrokeCMYKColor = 41
      if (fn === 31 || fn === 33) {
        // RGB color: args = [r, g, b] in 0-1 range
        if (args && args.length >= 3) {
          const hex = rgbToHex(
            Math.round(args[0] * 255),
            Math.round(args[1] * 255),
            Math.round(args[2] * 255)
          )
          colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
        }
      } else if (fn === 35 || fn === 37) {
        // Grayscale: args = [gray] in 0-1 range
        if (args && args.length >= 1) {
          const v = Math.round(args[0] * 255)
          const hex = rgbToHex(v, v, v)
          colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
        }
      } else if (fn === 39 || fn === 41) {
        // CMYK: args = [c, m, y, k] in 0-1 range
        if (args && args.length >= 4) {
          const [c, m, y, k] = args
          const r = Math.round(255 * (1 - c) * (1 - k))
          const g = Math.round(255 * (1 - m) * (1 - k))
          const b = Math.round(255 * (1 - y) * (1 - k))
          const hex = rgbToHex(r, g, b)
          colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
        }
      }
    }
  }

  // Convert maps to arrays
  colorCount.forEach((count, hex) => {
    colors.push({ value: hex, property: 'unknown', selector: '', count })
  })

  const fontEntries = Array.from(fontMap.values())

  return {
    colors: colors.sort((a, b) => b.count - a.count),
    fonts: fontEntries.sort((a, b) => b.charCount - a.charCount),
    spacing: [],
    cssVars: {},
    shadows: [],
    borderRadii: [],
    borderWidths: [],
    classNames: [],
    url: file.name,
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}

/**
 * Clean up PDF internal font names like "BCDEEE+Arial-BoldMT" → "Arial"
 */
function cleanPdfFontName(name: string): string {
  // Remove subset prefix (e.g., "BCDEEE+")
  let clean = name.replace(/^[A-Z]{6}\+/, '')
  // Remove style suffixes
  clean = clean.replace(/-(Bold|Italic|BoldItalic|Regular|Medium|Light|Thin|Black|SemiBold|ExtraBold|ExtraLight)?(MT|PS|IT)?$/i, '')
  // Common substitutions
  clean = clean.replace(/TimesNewRoman/i, 'Times New Roman')
  clean = clean.replace(/ArialMT/i, 'Arial')
  clean = clean.replace(/CourierNew/i, 'Courier New')
  return clean || name
}

import * as pdfjsLib from 'pdfjs-dist'
import { OPS } from 'pdfjs-dist'
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

  let pdf: pdfjsLib.PDFDocumentProxy
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    }).promise
  } catch (err) {
    // If worker-based loading fails, retry with worker disabled
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise
  }

  const colorCount = new Map<string, number>()
  const fontMap = new Map<string, RawFontData>()

  // Process up to 20 pages
  const pageCount = Math.min(pdf.numPages, 20)

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await pdf.getPage(i)

      // --- Extract text content for fonts ---
      try {
        const textContent = await page.getTextContent()
        const items = textContent.items ?? []
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx]
          if (!item || !('str' in item) || !item.str.trim()) continue

          const fontName = item.fontName || 'unknown'
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
      } catch {
        // Skip text extraction for this page if it fails
      }

      // --- Extract colors from page operators ---
      try {
        const opList = await page.getOperatorList()
        const fnArray = opList.fnArray
        const argsArray = opList.argsArray
        for (let j = 0; j < fnArray.length; j++) {
          const fn = fnArray[j]
          const args = argsArray[j]

          if (fn === OPS.setFillRGBColor || fn === OPS.setStrokeRGBColor) {
            if (args && args.length >= 3) {
              const hex = rgbToHex(
                Math.round(args[0] * 255),
                Math.round(args[1] * 255),
                Math.round(args[2] * 255)
              )
              colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
            }
          } else if (fn === OPS.setFillGray || fn === OPS.setStrokeGray) {
            if (args && args.length >= 1) {
              const v = Math.round(args[0] * 255)
              const hex = rgbToHex(v, v, v)
              colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
            }
          } else if (fn === OPS.setFillCMYKColor || fn === OPS.setStrokeCMYKColor) {
            if (args && args.length >= 4) {
              const c = args[0], m = args[1], y = args[2], k = args[3]
              const r = Math.round(255 * (1 - c) * (1 - k))
              const g = Math.round(255 * (1 - m) * (1 - k))
              const b = Math.round(255 * (1 - y) * (1 - k))
              const hex = rgbToHex(r, g, b)
              colorCount.set(hex, (colorCount.get(hex) || 0) + 1)
            }
          }
        }
      } catch {
        // Skip operator extraction for this page if it fails
      }
    } catch {
      // Skip entire page if getPage fails
    }
  }

  // Convert maps to arrays
  const colors: RawColorData[] = []
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
  let clean = name.replace(/^[A-Z]{6}\+/, '')
  clean = clean.replace(/-(Bold|Italic|BoldItalic|Regular|Medium|Light|Thin|Black|SemiBold|ExtraBold|ExtraLight)?(MT|PS|IT)?$/i, '')
  clean = clean.replace(/TimesNewRoman/i, 'Times New Roman')
  clean = clean.replace(/ArialMT/i, 'Arial')
  clean = clean.replace(/CourierNew/i, 'Courier New')
  return clean || name
}

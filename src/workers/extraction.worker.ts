import { extractFromSource } from '@/lib/extract-from-source'
import { runPipeline } from '@extractor/pipeline'

self.onmessage = (e: MessageEvent<{ html: string; css: string; url: string }>) => {
  try {
    const { html, css, url } = e.data
    const combined = html + '\n' + css
    const rawData = extractFromSource(combined, url)
    const { tokens, layersUsed } = runPipeline(rawData)
    self.postMessage({ tokens, layersUsed })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : 'Worker extraction failed' })
  }
}

import { useState, useCallback } from 'react'
import type { DesignTokens } from '@/types/tokens'
import type { RawExtractionData } from '@extractor/types'
import { runPipeline } from '@extractor/pipeline'
import { extractFromSource } from '@/lib/extract-from-source'
import ExtractionWorker from '@/workers/extraction.worker?worker'

type ExtractionStage = 'fetching' | 'parsing' | 'clustering' | 'detecting' | 'done' | null

interface ExtractionState {
  status: 'idle' | 'processing' | 'complete' | 'failed'
  tokens: DesignTokens | null
  error: string | null
  layers: string[]
  cached: boolean
  refining: boolean
  stage: ExtractionStage
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    status: 'idle',
    tokens: null,
    error: null,
    layers: [],
    cached: false,
    refining: false,
    stage: null,
  })

  const extractFromUrl = useCallback(async (url: string, skipCache = false) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false, stage: 'fetching' })

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

      setState(prev => ({ ...prev, stage: 'parsing' }))

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
          stage: 'done',
        })
        return
      }

      const { html, css, url: finalUrl } = data as {
        html: string
        css: string
        url: string
      }

      setState(prev => ({ ...prev, stage: 'clustering' }))

      // Try running extraction in a Web Worker to keep the main thread free
      let tokens: DesignTokens
      let layersUsed: string[]

      try {
        const result = await runExtractionInWorker(html, css, finalUrl)
        tokens = result.tokens
        layersUsed = result.layersUsed
      } catch {
        // Fall back to direct execution if worker fails
        const combined = html + '\n' + css
        const rawData = extractFromSource(combined, finalUrl)
        const pipelineResult = runPipeline(rawData)
        tokens = pipelineResult.tokens
        layersUsed = pipelineResult.layersUsed
      }

      setState(prev => ({ ...prev, stage: 'detecting' }))

      // Save to cache via Edge Function (fire-and-forget)
      saveToCache(url, tokens).catch(() => {})

      setState(prev => ({ ...prev, stage: 'done' }))
      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false, stage: 'done' })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'Extraction failed',
        layers: [],
        cached: false,
        refining: false,
        stage: null,
      })
    }
  }, [])

  const extractFromPdf = useCallback(async (file: File) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false, stage: 'parsing' })

    try {
      const { extractPdf } = await import('@/lib/pdf-extractor')
      const rawData = await extractPdf(file)

      setState(prev => ({ ...prev, stage: 'clustering' }))
      const { tokens, layersUsed } = runPipeline(rawData)
      tokens.metadata.sourceType = 'pdf'
      tokens.metadata.source = file.name

      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false, stage: 'done' })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'PDF extraction failed',
        layers: [],
        cached: false,
        refining: false,
        stage: null,
      })
    }
  }, [])

  const extractFromRawData = useCallback((data: RawExtractionData) => {
    setState({ status: 'processing', tokens: null, error: null, layers: [], cached: false, refining: false, stage: 'clustering' })
    try {
      const { tokens, layersUsed } = runPipeline(data)
      setState({ status: 'complete', tokens, error: null, layers: layersUsed, cached: false, refining: false, stage: 'done' })
    } catch (err) {
      setState({
        status: 'failed',
        tokens: null,
        error: err instanceof Error ? err.message : 'Pipeline failed',
        layers: [],
        cached: false,
        refining: false,
        stage: null,
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
    setState({ status: 'idle', tokens: null, error: null, layers: [], cached: false, refining: false, stage: null })
  }, [])

  return { ...state, extractFromUrl, extractFromPdf, extractFromRawData, refineWithAI, reset }
}

function runExtractionInWorker(
  html: string,
  css: string,
  url: string
): Promise<{ tokens: DesignTokens; layersUsed: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new ExtractionWorker()
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Worker timed out'))
    }, 30_000)

    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timeout)
      worker.terminate()
      if (e.data.error) {
        reject(new Error(e.data.error))
      } else {
        resolve({ tokens: e.data.tokens, layersUsed: e.data.layersUsed })
      }
    }

    worker.onerror = (err) => {
      clearTimeout(timeout)
      worker.terminate()
      reject(err)
    }

    worker.postMessage({ html, css, url })
  })
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

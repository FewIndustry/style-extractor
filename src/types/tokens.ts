export type { ColorToken, TypographyToken, TypeScaleEntry, SpacingScale } from '@extractor/types'
import type { DesignTokens } from '@extractor/types'
export type { DesignTokens }

// Frontend-only types stay here

export interface ExtractionJob {
  id: string
  user_id: string
  source_type: 'url' | 'pdf'
  source_url: string | null
  status: 'pending' | 'processing' | 'complete' | 'failed'
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface ExtractionResult {
  id: string
  job_id: string
  tokens: DesignTokens
  metadata: Record<string, unknown>
  screenshot_path: string | null
  created_at: string
}

export type ExportFormat = 'css' | 'tailwind' | 'json' | 'scss'

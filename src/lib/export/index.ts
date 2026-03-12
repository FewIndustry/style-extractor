import type { DesignTokens, ExportFormat } from '@/types/tokens'
import { generateCssVars } from './css-vars'
import { generateTailwindConfig } from './tailwind-config'
import { generateDesignTokensJson } from './design-tokens'
import { generateScss } from './scss'

export function exportTokens(tokens: DesignTokens, format: ExportFormat): string {
  switch (format) {
    case 'css': return generateCssVars(tokens)
    case 'tailwind': return generateTailwindConfig(tokens)
    case 'json': return generateDesignTokensJson(tokens)
    case 'scss': return generateScss(tokens)
  }
}

export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'css': return '.css'
    case 'tailwind': return '.js'
    case 'json': return '.json'
    case 'scss': return '.scss'
  }
}

export function getFileName(format: ExportFormat): string {
  switch (format) {
    case 'css': return 'tokens.css'
    case 'tailwind': return 'tailwind.config.js'
    case 'json': return 'design-tokens.json'
    case 'scss': return '_tokens.scss'
  }
}

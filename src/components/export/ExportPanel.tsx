import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import type { DesignTokens, ExportFormat } from '@/types/tokens'
import { exportTokens, getFileName } from '@/lib/export'

interface ExportPanelProps {
  tokens: DesignTokens
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'css', label: 'CSS Variables' },
  { value: 'tailwind', label: 'Tailwind Config' },
  { value: 'json', label: 'Design Tokens (W3C)' },
  { value: 'scss', label: 'SCSS' },
]

export function ExportPanel({ tokens }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('css')
  const output = exportTokens(tokens, format)

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getFileName(format)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
      {/* Format tabs */}
      <div className="flex border-b border-border">
        {FORMATS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFormat(value)}
            className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer
              ${format === value
                ? 'text-accent border-b-2 border-accent -mb-px'
                : 'text-text-muted hover:text-text'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Code preview */}
      <div className="relative">
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <CopyButton text={output} />
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download size={14} className="mr-1" />
            Download
          </Button>
        </div>
        <pre className="p-6 pt-14 overflow-x-auto text-sm text-text-muted font-mono max-h-[500px] overflow-y-auto">
          <code>{output}</code>
        </pre>
      </div>
    </div>
  )
}

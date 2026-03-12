import { useCallback } from 'react'
import { FileUp } from 'lucide-react'

interface PdfUploadProps {
  onFileSelect: (file: File) => void
  isLoading: boolean
}

export function PdfUpload({ onFileSelect, isLoading }: PdfUploadProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`w-full max-w-2xl border-2 border-dashed border-border rounded-xl p-10
        flex flex-col items-center gap-3 transition-colors cursor-pointer
        hover:border-border-hover hover:bg-bg-elevated/50
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <FileUp size={32} className="text-text-dim" />
      <p className="text-text-muted text-sm">
        Drag & drop a PDF, or{' '}
        <label className="text-accent hover:text-accent-hover cursor-pointer underline">
          browse
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleChange}
            disabled={isLoading}
          />
        </label>
      </p>
      <p className="text-text-dim text-xs">PDF files up to 20 pages</p>
    </div>
  )
}

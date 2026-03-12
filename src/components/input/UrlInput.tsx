import { useState } from 'react'
import { Globe, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface UrlInputProps {
  onSubmit: (url: string) => void
  isLoading: boolean
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let normalized = url.trim()
    if (!normalized) return

    // Add protocol if missing
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`
    }

    try {
      new URL(normalized)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onSubmit(normalized)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative flex items-center">
        <Globe size={18} className="absolute left-4 text-text-dim" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter a website URL (e.g. stripe.com)"
          className="w-full pl-11 pr-28 py-4 bg-bg-elevated border border-border rounded-xl
            text-text placeholder:text-text-dim focus:outline-none focus:border-accent
            transition-colors text-base"
          disabled={isLoading}
        />
        <div className="absolute right-2">
          <Button type="submit" disabled={isLoading || !url.trim()} size="md">
            {isLoading ? 'Extracting...' : (
              <>
                Extract <ArrowRight size={16} className="ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </form>
  )
}

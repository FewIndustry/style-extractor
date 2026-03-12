import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { DesignTokens } from '@/types/tokens'

interface ColorPaletteProps {
  colors: DesignTokens['colors']
}

function ColorSwatch({ hex, label, size = 'md' }: { hex: string; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [copied, setCopied] = useState(false)
  const sizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleCopy}
        className={`${sizes[size]} rounded-lg border border-white/10 shadow-sm cursor-pointer
          relative group transition-transform hover:scale-110 active:scale-95`}
        style={{ backgroundColor: hex }}
        title={`Click to copy ${hex}`}
      >
        <div className={`absolute inset-0 rounded-lg flex items-center justify-center
          bg-black/40 transition-opacity ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {copied ? (
            <Check size={size === 'lg' ? 18 : 14} className="text-white" />
          ) : (
            <Copy size={size === 'lg' ? 16 : 12} className="text-white" />
          )}
        </div>
      </button>
      {label && <span className="text-[10px] text-text-dim font-medium">{label}</span>}
      <span className={`text-[10px] font-mono transition-colors ${copied ? 'text-accent' : 'text-text-dim'}`}>
        {copied ? 'Copied!' : hex}
      </span>
    </div>
  )
}

export function ColorPalette({ colors }: ColorPaletteProps) {
  const roles = [
    { token: colors.primary, label: 'Primary' },
    { token: colors.secondary, label: 'Secondary' },
    { token: colors.accent, label: 'Accent' },
    { token: colors.background, label: 'Background' },
    { token: colors.text, label: 'Text' },
    { token: colors.semantic.success, label: 'Success' },
    { token: colors.semantic.error, label: 'Error' },
    { token: colors.semantic.warning, label: 'Warning' },
    { token: colors.semantic.info, label: 'Info' },
  ].filter(r => r.token)

  return (
    <div className="space-y-6">
      {roles.length === 0 && colors.palette.length === 0 && colors.neutrals.length === 0 && (
        <p className="text-text-muted py-10 text-center">No colors detected</p>
      )}

      {/* Semantic roles */}
      {roles.length > 0 && (
        <Card title="Color Roles">
          <div className="flex flex-wrap gap-5">
            {roles.map(({ token, label }) => (
              <ColorSwatch key={label} hex={token!.hex} label={label} size="lg" />
            ))}
          </div>
        </Card>
      )}

      {/* Full palette */}
      {colors.palette.length > 0 && (
        <Card title="Full Palette">
          <div className="flex flex-wrap gap-3">
            {colors.palette.map((c, i) => (
              <ColorSwatch key={i} hex={c.hex} size="md" />
            ))}
          </div>
        </Card>
      )}

      {/* Neutrals */}
      {colors.neutrals.length > 0 && (
        <Card title="Neutrals">
          <div className="flex gap-0">
            {colors.neutrals.map((n, i) => (
              <NeutralSwatch key={i} hex={n.hex} isFirst={i === 0} isLast={i === colors.neutrals.length - 1} />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-text-dim font-mono">
              {colors.neutrals[0]?.hex}
            </span>
            <span className="text-[10px] text-text-dim font-mono">
              {colors.neutrals[colors.neutrals.length - 1]?.hex}
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}

function NeutralSwatch({ hex, isFirst, isLast }: { hex: string; isFirst: boolean; isLast: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex-1 h-10 cursor-pointer relative group transition-opacity hover:opacity-80
        ${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
      style={{ backgroundColor: hex }}
      title={`Click to copy ${hex}`}
    >
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check size={14} className="text-white drop-shadow-md" />
        </div>
      )}
    </button>
  )
}

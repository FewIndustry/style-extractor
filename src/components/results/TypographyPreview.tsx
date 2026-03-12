import { Card } from '@/components/ui/Card'
import type { DesignTokens } from '@/types/tokens'

interface TypographyPreviewProps {
  typography: DesignTokens['typography']
}

export function TypographyPreview({ typography }: TypographyPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Font families */}
      <Card title="Font Families">
        <div className="space-y-4">
          {typography.fonts.map((font) => (
            <div key={font.family} className="flex items-baseline justify-between gap-4">
              <div>
                <p
                  className="text-2xl text-text"
                  style={{ fontFamily: font.family }}
                >
                  {font.family}
                </p>
                <p className="text-xs text-text-dim mt-1">
                  {font.role && <span className="text-accent mr-2">{font.role}</span>}
                  Weights: {font.weights.join(', ')}
                </p>
              </div>
              <p
                className="text-sm text-text-muted shrink-0"
                style={{ fontFamily: font.family }}
              >
                Aa Bb Cc 123
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Type scale */}
      {typography.scale.length > 0 && (
        <Card title="Type Scale">
          <div className="space-y-3">
            {typography.scale.slice().reverse().map((entry, i) => (
              <div key={i} className="flex items-baseline gap-4">
                <span className="text-xs text-text-dim font-mono w-16 shrink-0 text-right">
                  {entry.size}
                </span>
                <p
                  className="text-text truncate"
                  style={{
                    fontSize: entry.size,
                    lineHeight: entry.lineHeight,
                    fontWeight: entry.weight,
                  }}
                >
                  The quick brown fox
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

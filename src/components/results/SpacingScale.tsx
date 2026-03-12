import { Card } from '@/components/ui/Card'
import type { SpacingScale as SpacingScaleType } from '@/types/tokens'

interface SpacingScaleProps {
  spacing: SpacingScaleType
}

export function SpacingScale({ spacing }: SpacingScaleProps) {
  const maxValue = Math.max(...spacing.values)

  return (
    <Card title={`Spacing (${spacing.base}px base grid — ${Math.round(spacing.confidence * 100)}% confidence)`}>
      <div className="space-y-2">
        {spacing.values.map((value) => (
          <div key={value} className="flex items-center gap-3">
            <span className="text-xs text-text-dim font-mono w-12 text-right shrink-0">
              {value}px
            </span>
            <div
              className="h-4 rounded-sm bg-accent/30 border border-accent/50 transition-all"
              style={{ width: `${(value / maxValue) * 100}%`, minWidth: '4px' }}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

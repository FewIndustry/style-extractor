import { Card } from '@/components/ui/Card'

interface ShadowsAndRadiiProps {
  shadows: string[]
  radii: string[]
}

export function ShadowsAndRadii({ shadows, radii }: ShadowsAndRadiiProps) {
  return (
    <div className="space-y-6">
      {radii.length > 0 && (
        <Card title="Border Radius">
          <div className="flex flex-wrap gap-4">
            {radii.map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 bg-bg-hover border border-border"
                  style={{ borderRadius: r }}
                />
                <span className="text-[10px] text-text-dim font-mono">{r}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {shadows.length > 0 && (
        <Card title="Box Shadows">
          <div className="flex flex-wrap gap-6">
            {shadows.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 bg-bg-elevated rounded-lg"
                  style={{ boxShadow: s }}
                />
                <span className="text-[10px] text-text-dim font-mono max-w-24 truncate" title={s}>
                  shadow-{i + 1}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

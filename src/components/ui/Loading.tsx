import { Check, Loader2 } from 'lucide-react'

type Stage = 'fetching' | 'parsing' | 'clustering' | 'detecting' | 'done' | null

const steps: { key: Stage; label: string }[] = [
  { key: 'fetching', label: 'Fetching page...' },
  { key: 'parsing', label: 'Parsing stylesheets...' },
  { key: 'clustering', label: 'Clustering colors...' },
  { key: 'detecting', label: 'Detecting patterns...' },
  { key: 'done', label: 'Finalizing...' },
]

const stageOrder: Stage[] = ['fetching', 'parsing', 'clustering', 'detecting', 'done']

export function Loading({ stage = 'fetching' }: { stage?: Stage }) {
  const currentIndex = stage ? stageOrder.indexOf(stage) : -1

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="w-full max-w-xs space-y-3">
        {steps.map(({ key, label }) => {
          const stepIndex = stageOrder.indexOf(key)
          const isComplete = stepIndex < currentIndex
          const isCurrent = stepIndex === currentIndex
          const isFuture = stepIndex > currentIndex

          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {isComplete && (
                  <Check size={16} className="text-accent" />
                )}
                {isCurrent && (
                  <Loader2 size={16} className="text-accent animate-spin" />
                )}
                {isFuture && (
                  <div className="w-2 h-2 rounded-full bg-border" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isComplete
                    ? 'text-text-muted'
                    : isCurrent
                      ? 'text-text font-medium'
                      : 'text-text-dim'
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

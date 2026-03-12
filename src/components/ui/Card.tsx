import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`bg-bg-elevated border border-border rounded-xl p-6 ${className}`}>
      {title && (
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">{title}</h3>
      )}
      {children}
    </div>
  )
}

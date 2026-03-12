import { Component, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-text">Something went wrong</h2>
            <p className="text-sm text-text-muted max-w-md">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

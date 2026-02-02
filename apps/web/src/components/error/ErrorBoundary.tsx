import { Component, type ReactNode } from 'react'
import { CrashScreen } from './CrashScreen'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Key to reset the error boundary (usually route pathname) */
  resetKey?: string
  /** Optional fallback UI (defaults to CrashScreen) */
  fallback?: ReactNode
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Route-level Error Boundary.
 *
 * Features:
 * - Catches render errors in child components
 * - Resets automatically when resetKey changes (route navigation)
 * - Logs errors for debugging (future: Sentry integration)
 * - Shows minimal CrashScreen by default
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary resetKey={pathname}>
 *   <YourRoute />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)

    // TODO: Send to Sentry when integrated
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKey changes (e.g., route navigation)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise show CrashScreen
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <CrashScreen
          error={this.state.error ?? undefined}
          resetError={this.resetError}
        />
      )
    }

    return this.props.children
  }
}

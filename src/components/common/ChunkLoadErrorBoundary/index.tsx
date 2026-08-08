import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  isChunkError: boolean;
}

/**
 * Error Boundary component specifically designed to catch and handle
 * chunk load errors that occur after deployments.
 *
 * This boundary will:
 * 1. Detect chunk load errors (Failed to fetch dynamically imported module)
 * 2. Show a user-friendly message prompting them to reload
 * 3. Automatically reload the page if configured
 * 4. Allow custom error handling and fallback UI
 *
 * @example
 * ```tsx
 * <ChunkLoadErrorBoundary>
 *   <YourApp />
 * </ChunkLoadErrorBoundary>
 * ```
 */
class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a chunk load error
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'ChunkLoadError';

    return {
      hasError: true,
      error,
      isChunkError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('ChunkLoadErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // For chunk load errors, log additional context and try one automatic
    // reload before falling back to the manual "Update Available" prompt.
    // The timestamp guard prevents a reload loop if the error keeps recurring
    // (e.g. the dev server itself is down, not just a stale chunk reference).
    if (this.state.isChunkError) {
      console.warn(
        'A chunk load error occurred. This typically happens after a new deployment. ' +
        'The page should be reloaded to fetch the latest version.'
      );

      const lastAttempt = Number(window.sessionStorage.getItem('chunk-reload-attempted-at') || 0);
      const withinCooldown = Date.now() - lastAttempt < 10_000;

      if (!withinCooldown) {
        window.sessionStorage.setItem('chunk-reload-attempted-at', String(Date.now()));
        this.handleReload();
      }
    }
  }

  handleReload = () => {
    // Clear any stale session storage flags
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('retry-lazy-refresh-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => window.sessionStorage.removeItem(key));

    // Reload the page
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      isChunkError: false,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show chunk-specific error UI
      if (this.state.isChunkError) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-8 w-8 text-yellow-500" />
                <h2 className="text-2xl font-semibold text-foreground">
                  Update Available
                </h2>
              </div>

              <div className="space-y-2 text-muted-foreground">
                <p>
                  A new version of this application is available. Please reload the page
                  to get the latest updates.
                </p>
                <p className="text-sm">
                  This happens when the application is updated while you're using it.
                  Don't worry, your work is safe!
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reload Page</span>
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      }

      // Show generic error UI for non-chunk errors
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h2 className="text-2xl font-semibold text-foreground">
                Something went wrong
              </h2>
            </div>

            <p className="text-muted-foreground">
              An unexpected error occurred. Please try reloading the page or contact
              support if the problem persists.
            </p>

            <div className="flex space-x-3">
              <Button
                onClick={this.handleReload}
                variant="default"
                className="flex-1"
              >
                Reload Page
              </Button>
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1"
              >
                Try Again
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkLoadErrorBoundary;

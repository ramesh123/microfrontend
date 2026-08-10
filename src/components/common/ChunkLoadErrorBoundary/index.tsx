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
  isRecovering: boolean;
}

// Absolute URL Container's federation config uses for the workflow remote
// (see container/vite.config.ts `federation({ remotes: { workflow: ... } })`).
const WORKFLOW_REMOTE_ENTRY_URL = 'http://localhost:3001/assets/remoteEntry.js';

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
  // Instance flag, not state — guards against starting a second overlapping
  // poll loop if multiple lazy chunks fail around the same time.
  private isPolling = false;
  // Guards setState calls in the async poll loop if this boundary unmounts
  // mid-poll (e.g. its parent tree changes), avoiding a React warning about
  // updating state on an unmounted component.
  private isUnmounted = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isChunkError: false,
      isRecovering: false,
    };
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's specifically a module-loading error. Deliberately does
    // NOT match on a bare "Failed to fetch" — that substring also appears in
    // ordinary failed API calls, which would otherwise get misclassified as
    // a chunk-load error and trigger the remoteEntry.js poll/reload cycle,
    // masking an unrelated bug behind a confusing auto-reload.
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.name === 'ChunkLoadError';

    return {
      hasError: true,
      error,
      isChunkError,
      isRecovering: false,
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

    // For chunk load errors, log additional context and wait for the
    // workflow remote to actually be ready before reloading. A blind
    // immediate reload can land back on the same still-rebuilding server
    // and fail again (build:watch rebuilds take 60-90s on this app), so we
    // poll remoteEntry.js until it responds successfully first.
    if (this.state.isChunkError && !this.isPolling) {
      console.warn(
        'A chunk load error occurred. This typically happens when the workflow ' +
        'remote is mid-rebuild. Waiting for it to become ready before reloading.'
      );
      this.pollForRemoteAndReload();
    }
  }

  pollForRemoteAndReload = async () => {
    const MAX_ATTEMPTS = 20;
    const POLL_INTERVAL_MS = 1500;

    this.isPolling = true;
    if (!this.isUnmounted) this.setState({ isRecovering: true });

    // Deliberately does NOT bail out early if this instance unmounts mid-poll
    // (route re-renders here recreate element references often, which remounts
    // this boundary): a page reload is a global action independent of this
    // component's lifecycle, so the loop keeps running regardless — only the
    // setState calls below are guarded to avoid the unmounted-component warning.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(WORKFLOW_REMOTE_ENTRY_URL, { cache: 'no-store' });
        const contentType = res.headers.get('content-type') || '';
        // A rebuilding server can still return 200 with the SPA-fallback
        // HTML instead of the real bundle, so check content-type too.
        if (res.ok && contentType.includes('javascript')) {
          this.handleReload();
          return;
        }
      } catch {
        // Network error (server briefly down between rebuilds) — keep polling.
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Gave up waiting — leave the manual "Reload Page" card up instead of
    // retrying forever.
    this.isPolling = false;
    if (!this.isUnmounted) this.setState({ isRecovering: false });
  };

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
    this.isPolling = false;
    this.setState({
      hasError: false,
      error: undefined,
      isChunkError: false,
      isRecovering: false,
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
                {this.state.isRecovering ? (
                  <RefreshCw className="h-8 w-8 text-yellow-500 animate-spin" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                )}
                <h2 className="text-2xl font-semibold text-foreground">
                  {this.state.isRecovering ? 'Checking for Update…' : 'Update Available'}
                </h2>
              </div>

              <div className="space-y-2 text-muted-foreground">
                {this.state.isRecovering ? (
                  <p>
                    The workflow module is still updating. This page will reload
                    automatically as soon as it's ready.
                  </p>
                ) : (
                  <p>
                    A new version of this application is available. Please reload the page
                    to get the latest updates.
                  </p>
                )}
                <p className="text-sm">
                  This happens when the application is updated while you're using it.
                  Don't worry, your work is safe!
                </p>
              </div>

              {!this.state.isRecovering && (
                <div className="flex space-x-3">
                  <Button
                    onClick={this.handleReload}
                    className="flex-1 flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reload Page</span>
                  </Button>
                </div>
              )}

              {/* {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )} */}
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

            {/* {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                  // {this.state.error.message}
                  // {'\n\n'}
                  // {this.state.error.stack}
                </pre>
              </details>
            )} */}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkLoadErrorBoundary;

import type { ReactNode } from "react";
import { ErrorBoundary as SharedErrorBoundary } from "@micro-frontend/shared";

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <SharedErrorBoundary
      onError={(error, info) => console.error("[container-app] Uncaught error:", error, info)}
      fallback={(error, reset) => (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </SharedErrorBoundary>
  );
}

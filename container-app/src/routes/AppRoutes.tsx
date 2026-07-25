import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { RemoteWorkflowApp } from "@/federation/remotes";
import { MfeUnavailablePage } from "./MfeUnavailablePage";

export function AppRoutes() {
  return (
    <Routes>
      {/*
        Everything is delegated to the federated workflow-app remote, which
        already ships its own BrowserRouter, providers, auth/RBAC-driven
        routing, header and sidebar (see workflow-app/src/App.tsx and
        src/router.tsx). Mounting it full-bleed here avoids stacking a second
        header/sidebar on top of its own.
      */}
      <Route
        path="/*"
        element={
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label="Loading workflow app…" />}>
              <RemoteWorkflowApp />
            </Suspense>
          </ErrorBoundary>
        }
      />

      {/* Container-owned page, reachable directly — pattern for a future chrome-less remote. */}
      <Route element={<AppShellLayout />}>
        <Route path="/_mfe-unavailable" element={<MfeUnavailablePage />} />
      </Route>
    </Routes>
  );
}

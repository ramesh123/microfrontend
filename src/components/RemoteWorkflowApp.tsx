import { lazy, Suspense } from "react";
import ChunkLoadErrorBoundary from "@/components/common/ChunkLoadErrorBoundary";

// Loaded at runtime from the workflow remote via Module Federation
// (see container/vite.config.ts `remotes.workflow` and
// workflow/vite.config.ts `exposes["./WorkflowRoutes"]`).
const WorkflowRoutes = lazy(() => import("workflow/WorkflowRoutes"));

export default function RemoteWorkflowApp() {
  return (
    <ChunkLoadErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <WorkflowRoutes />
      </Suspense>
    </ChunkLoadErrorBoundary>
  );
}

import { lazy } from "react";
import "./types.d.ts";

/**
 * Typed lazy() wrappers around every module workflow-app exposes (see
 * workflow-app/vite.config.ts `exposes`). Adding a new remote later means
 * adding one entry here plus one route in routes/AppRoutes.tsx — nothing
 * else in this app changes.
 */
export const RemoteWorkflowApp = lazy(() => import("workflowApp/WorkflowApp"));
export const RemoteWorkflowHomePage = lazy(() => import("workflowApp/WorkflowHomePage"));
export const RemoteWorkflowDashboard = lazy(() => import("workflowApp/WorkflowDashboard"));

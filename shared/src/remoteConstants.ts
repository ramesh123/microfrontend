/**
 * Single documented contract for remote names / env var keys.
 * Vite configs evaluate standalone (no cross-package import at config-eval
 * time without extra tooling), so this file is the source of truth that
 * container-app's and workflow-app's vite.config.ts / .env files mirror by hand.
 */

export const WORKFLOW_REMOTE_NAME = "workflowApp";

export const WORKFLOW_REMOTE_ENV_VAR = "VITE_WORKFLOW_REMOTE_URL";

export const WORKFLOW_REMOTE_DEV_URL =
  "http://localhost:5317/assets/remoteEntry.js";

export const WORKFLOW_EXPOSED_MODULES = {
  app: "./WorkflowApp",
  routes: "./WorkflowRoutes",
  homePage: "./WorkflowHomePage",
  dashboard: "./WorkflowDashboard",
} as const;

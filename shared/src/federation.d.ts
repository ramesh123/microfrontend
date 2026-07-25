/**
 * Ambient module declarations for Module Federation remote imports so
 * TypeScript in the host app doesn't error on `import('workflowApp/...')`.
 * Each host that consumes a remote should reference this file (see
 * container-app/src/federation/types.d.ts) and narrow the declarations it
 * actually uses.
 */

declare module "workflowApp/WorkflowApp" {
  import type { ComponentType } from "react";
  const WorkflowApp: ComponentType;
  export default WorkflowApp;
}

declare module "workflowApp/WorkflowRoutes" {
  import type { ComponentType } from "react";
  export const RoutesApp: ComponentType;
  const WorkflowRoutes: ComponentType;
  export default WorkflowRoutes;
}

declare module "workflowApp/WorkflowHomePage" {
  import type { ComponentType } from "react";
  const WorkflowHomePage: ComponentType;
  export default WorkflowHomePage;
}

declare module "workflowApp/WorkflowDashboard" {
  import type { ComponentType } from "react";
  const WorkflowDashboard: ComponentType;
  export default WorkflowDashboard;
}

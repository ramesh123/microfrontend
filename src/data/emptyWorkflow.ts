import { Workflow } from "@/types/flow";

interface CreateWorkflowParams {
  type?: string;
  name: string;
  deploymentName: string;
  description?: string;
  org_id?: string[];
  project?: string;
  businessProcesses?: (string | number)[];
  process_id?: string;
  execution_engine?: string | null;
  target_output?: string | null;
  storage_engine?: string | null;
  cycle_wise?: boolean;
  perspective_ids?: string[];
  virtualdb_mode?: boolean;
  workflow_origin?: 'AI' | 'Manual';
}

// Generates a new, empty workflow object based on parameters from the creation form.
export const createEmptyWorkflow = (params: CreateWorkflowParams): Workflow => {
  const now = new Date().toISOString();
  const newWorkflowId = crypto.randomUUID();

  // Convert business process IDs to comma-separated string
  const businessProcessStr = params.businessProcesses && params.businessProcesses.length > 0
    ? params.businessProcesses.join(', ')
    : "";

  console.log('createEmptyWorkflow params:', params);
  console.log('cycle_wise in params:', params.cycle_wise);

  return {
    id: Date.now(),
    created_at: now,
    updated_at: now,
    entity_id: null,
    workflow_id: newWorkflowId,
    name: params.deploymentName, // Use flowName (deploymentName) for name
    description: params.description ?? '', // From form
    application_id: "",
    workflow_type: params.type ?? 'Data_Validation', // Default type
    flow_id: crypto.randomUUID(),
    deployment_id: crypto.randomUUID(),
    deployment_name: params.deploymentName, // From form
    data: {
      nodes: [],
      edges: [],
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    },
    icon: "",
    icon_bg_color: "",
    gradient: "",
    created_by: "UI",
    updated_by: "UI",
    display_name: params.deploymentName, // Use flowName (deploymentName) for display_name
    scheduler: {},
    locked: false,
    assigned_user: [],
    assigned_role: [],
    org_id: params.org_id || [],
    project: params.project || "",
    business_process: businessProcessStr,
    process_id: params.process_id || "",
    execution_engine: params.execution_engine || null,
    target_output: params.target_output || null,
    storage_engine: params.storage_engine || null,
    cycle_wise: params.cycle_wise || false,
    perspective_ids: params.perspective_ids || [],
    workflow_origin: params.workflow_origin || 'Manual',
    virtualdb_mode: params.virtualdb_mode ?? false,
  };
};
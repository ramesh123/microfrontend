// import useFlowStore from "@/stores/flowStore";
// import { FlowType } from "@/types/flow";
// import { createNewFlow } from "@/utils/reactflowUtils";
// import { useFlowsManagerStore } from "@/stores/flowManagerStore";
// import { useNodeStore } from "@/stores/nodeStore";



// const useAddFlow = () => {
//   const setFlows = useFlowsManagerStore((state) => state.setFlows);
//   const setNodes = useFlowStore((state) => state.setNodes);
//   const setEdges = useFlowStore((state) => state.setEdges);
//   const setSelectedNode = useNodeStore((state) => state.setSelectedNode);

//   const addFlow = async () => {
//     const flowData: any = {
//       nodes: [],
//       edges: [],
//       viewport: { zoom: 1, x: 0, y: 0 },
//     }

//     setNodes(flowData.nodes);
//     setEdges(flowData.edges);
//     setSelectedNode(null);
//     // const newFlowData = createNewFlow(flowData, workflowId!, flow)
//     setFlows(flowData);
//     // const response = await addFlowApi(params);
//     return flowData;
//   };

//   return addFlow;
// }

// export default useAddFlow








import { useState } from 'react';
import useFlowStore from '@/stores/flowStore';
import { createEmptyWorkflow } from '@/data/emptyWorkflow';
import api from '@/controllers/API/api';
import { toast } from 'sonner';

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

interface CreateDeploymentResponse {
  status: boolean;
  message: string;
  data: {
    flow_id: string;
    deployment_id: string;
  };
}

/**
 * A custom hook to encapsulate the logic for creating and loading a new workflow.
 * This provides a clean, reusable way to start a new flow from anywhere in the app.
 *
 * @returns An object containing the creation function and a loading state.
 */
export const useCreateNewWorkflow = () => {
  const [isCreating, setIsCreating] = useState(false);
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);

  // Call the create-deployment-from-flow API to get flow_id and deployment_id
  const createDeploymentFromFlow = async (flowName: string, deploymentName: string, workflowOrigin?: 'AI' | 'Manual') => {
    const response = await api.post<CreateDeploymentResponse>(
      '/flow-deployment/create-deployment-from-flow',
      {
        flow_name: flowName,
        deployment_name: deploymentName,
        workflow_origin: workflowOrigin ?? 'Manual',
      }
    );

    if (!(response.status >= 200 && response.status <= 299)) {
      throw new Error('Failed to create deployment');
    }

    return response.data;
  };

  const createAndLoadWorkflow = async (
    params: CreateWorkflowParams,
    onSuccess?: (flowId: string) => void
  ) => {
    setIsCreating(true);
    try {
      // 1. Call the API to create deployment and get flow_id and deployment_id
      console.log("Creating deployment with flow_name:", params.name, "deployment_name:", params.deploymentName);
      const deploymentResponse = await createDeploymentFromFlow(params.name, params.deploymentName, params.workflow_origin);

      if (!deploymentResponse.status) {
        throw new Error(deploymentResponse.message || 'Failed to create deployment');
      }

      const { flow_id, deployment_id } = deploymentResponse.data;
      console.log("Deployment created successfully. flow_id:", flow_id, "deployment_id:", deployment_id);

      // 2. Create the workflow object with flow_id and deployment_id
      const newWorkflow = createEmptyWorkflow(params);
      newWorkflow.flow_id = flow_id;
      newWorkflow.deployment_id = deployment_id;
      newWorkflow.deployment_name = params.deploymentName;

      console.log("New workflow created with flow_id:", newWorkflow);
      console.log("cycle_wise in newWorkflow:", newWorkflow.cycle_wise);

      // 3. Call create-draft-workflow API — same payload as flow-builder/create-workflow, plus draft_id; execution_engine, target_output, storage_engine as null
      const createWorkflowPayload = newWorkflow; // same object sent to flow-builder/create-workflow
      const draftPayload = {
        ...createWorkflowPayload,
        virtualdb_mode: params.virtualdb_mode ?? false,
        draft_id: "",
        version: 0,
        execution_engine: null,
        target_output: null,
        storage_engine: null,
        workflow_origin: params.workflow_origin ?? 'Manual',
      };
      console.log("Calling create-draft-workflow API with workflow data...");
      console.log("Full workflow object being sent to API:", JSON.stringify(draftPayload, null, 2));
      const createWorkflowResponse = await api.post('/draft-flow-builder/create-draft-workflow', draftPayload);

      if (!(createWorkflowResponse.status >= 200 && createWorkflowResponse.status <= 299)) {
        throw new Error('Failed to create draft workflow in database');
      }

      console.log("Draft workflow created in database:", createWorkflowResponse.data);

      // Update workflow with any data returned from the backend
      let savedWorkflow = createWorkflowResponse.data?.data || newWorkflow;

      // Preserve engine fields from the request if backend doesn't return them
      if (!savedWorkflow.storage_engine && newWorkflow.storage_engine) {
        savedWorkflow.storage_engine = newWorkflow.storage_engine;
      }
      if (!savedWorkflow.execution_engine && newWorkflow.execution_engine) {
        savedWorkflow.execution_engine = newWorkflow.execution_engine;
      }
      if (!savedWorkflow.target_output && newWorkflow.target_output) {
        savedWorkflow.target_output = newWorkflow.target_output;
      }
      if (!savedWorkflow.business_process && newWorkflow.business_process) {
        savedWorkflow.business_process = newWorkflow.business_process;
      }
      if (!savedWorkflow.project && newWorkflow.project) {
        savedWorkflow.project = newWorkflow.project;
      }
      if ((!savedWorkflow.org_id || savedWorkflow.org_id.length === 0) && newWorkflow.org_id && newWorkflow.org_id.length > 0) {
        savedWorkflow.org_id = newWorkflow.org_id;
      }
      // Always preserve process_id from what we sent, since backend may not return it correctly
      if (!savedWorkflow.process_id && newWorkflow.process_id) {
        savedWorkflow.process_id = newWorkflow.process_id;
      }
      // Always preserve cycle_wise from what we sent, since backend may not return it correctly
      if (newWorkflow.cycle_wise !== undefined) {
        savedWorkflow.cycle_wise = newWorkflow.cycle_wise;
      }
      // Always preserve perspective_ids from what we sent, since backend may not return it correctly
      if ((!savedWorkflow.perspective_ids || savedWorkflow.perspective_ids.length === 0) && newWorkflow.perspective_ids && newWorkflow.perspective_ids.length > 0) {
        savedWorkflow.perspective_ids = newWorkflow.perspective_ids;
      }
      // Always preserve virtualdb_mode from what we sent (sidebar uses it to show only Databases/Files/Ingestion)
      if (newWorkflow.virtualdb_mode !== undefined) {
        savedWorkflow.virtualdb_mode = newWorkflow.virtualdb_mode;
      }

      console.log("Workflow after preserving engine fields:", {
        storage_engine: savedWorkflow.storage_engine,
        execution_engine: savedWorkflow.execution_engine,
        target_output: savedWorkflow.target_output,
        business_process: savedWorkflow.business_process,
        process_id: savedWorkflow.process_id,
        cycle_wise: savedWorkflow.cycle_wise,
        perspective_ids: savedWorkflow.perspective_ids,
        virtualdb_mode: savedWorkflow.virtualdb_mode,
      });

      // 4. Load this new workflow into the central store
      console.log('[use-add-flow] Setting currentWorkflow in store. virtualdb_mode:', savedWorkflow.virtualdb_mode);
      setCurrentWorkflow(savedWorkflow);

      // 5. Trigger follow-up actions with database id (not flow_id)
      // Pass the database id so URL navigation uses id instead of flow_id UUID
      if (onSuccess) {
        onSuccess(savedWorkflow.id || flow_id);
      }

      toast.success('Workflow created successfully!');
      return savedWorkflow;
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error('Failed to create workflow. Please try again.');
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return { createAndLoadWorkflow, isCreating };
};

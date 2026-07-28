import { useMutation } from '@tanstack/react-query';
import { saveWorkflow } from '@/controllers/API';
import { Workflow } from '@/types/flow';
import useFlowStore from '@/stores/flowStore';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { prepareWorkflowForSave, fetchWorkflowNodeData, ensureWorkflowViewport } from '@/utils/workflowUtils';

export const useSaveWorkflow = () => {
  const reactFlowInstance = useFlowStore((state) => state.reactFlowInstance);
  const { currentWorkflow, onNodesChange, onEdgesChange, onConnect, addNode, setViewport } = useFlowStore();

  return useMutation({
    mutationFn: async ({ flowName, deploymentName, workflow, isRelease }: { flowName: string; deploymentName: string; workflow: Workflow; isRelease?: boolean }) => {
      // Use existing flow_id and deployment_id from workflow (skip create-deployment-from-flow)
      let workflowData: Workflow = {
        ...workflow,
        flow_id: workflow.flow_id,
        deployment_id: workflow.deployment_id,
        project: workflow.project || deploymentName,
        org_id: workflow.org_id || [],
      };


      // Strip data from nodes with unique_ids before saving
      const workflowToSave = prepareWorkflowForSave(workflowData);


      const promise = saveWorkflow(workflowToSave);

      promise.then(async (response: any) => {
        let res = response.data;

        // Preserve org_id and project from the request if backend doesn't return them
        if ((!res.org_id || res.org_id.length === 0) && workflowData.org_id && workflowData.org_id.length > 0) {
          res.org_id = workflowData.org_id;
        }
        if (!res.project && workflowData.project) {
          res.project = workflowData.project;
        }

        // Preserve engine fields from the request if backend doesn't return them
        if (!res.storage_engine && workflowData.storage_engine) {
          res.storage_engine = workflowData.storage_engine;
        }
        if (!res.execution_engine && workflowData.execution_engine) {
          res.execution_engine = workflowData.execution_engine;
        }
        if (!res.target_output && workflowData.target_output) {
          res.target_output = workflowData.target_output;
        }
        if (!res.business_process && workflowData.business_process) {
          res.business_process = workflowData.business_process;
        }
        // Always preserve process_id from what we sent, since backend may not return it correctly
        if (!res.process_id && workflowData.process_id) {
          res.process_id = workflowData.process_id;
        }
        // Always preserve cycle_wise from what we sent, since backend may not return it correctly
        if (workflowData.cycle_wise !== undefined) {
          res.cycle_wise = workflowData.cycle_wise;
        }
        // Always preserve perspective_ids from what we sent, since backend may not return it correctly
        if ((!res.perspective_ids || res.perspective_ids.length === 0) && workflowData.perspective_ids && workflowData.perspective_ids.length > 0) {
          res.perspective_ids = workflowData.perspective_ids;
        }

        console.log('Response after preserving org_id, project, and engine fields:', res);

        // When releasing (create-workflow + delete draft): skip fetchWorkflowNodeData (no id/node APIs)
        if (!isRelease) {
          const withVp = ensureWorkflowViewport(res);
          useFlowStore.getState().setCurrentWorkflow(withVp);
          console.log('Hydrating node payloads in background after save...');
          void fetchWorkflowNodeData(res, { executeSourceNodes: false })
            .then((workflowWithData) => {
              console.log('Workflow after fetching node data:', workflowWithData);
              useFlowStore.getState().setCurrentWorkflow(ensureWorkflowViewport(workflowWithData));
            })
            .catch((err) => console.error('Post-save node hydration failed:', err));
        }
        toast.success(isRelease ? 'Workflow released successfully!' : 'Workflow saved successfully!');
      }).catch((error) => {
        toast.error(getDisplayErrorMessage(error, 'Failed to save workflow.'));
        throw error;
      });

      return promise;
    },
  });
};



import { useEffect, useRef } from 'react';
import useFlowStore from '@/stores/flowStore';
import api from '@/controllers/API/api';
import { Workflow } from '@/types/flow';
import { prepareWorkflowForSave } from '@/utils/workflowUtils';

interface UseAutoSaveOptions {
  enabled: boolean; // Only enable after workflow is created
  interval?: number; // Interval in milliseconds (default: 5 minutes)
}

/**
 * Custom hook to auto-save workflow at regular intervals
 *
 * @param options - Configuration options for auto-save
 * @param options.enabled - Whether auto-save is enabled (should be true after workflow creation)
 * @param options.interval - Auto-save interval in milliseconds (default: 5 minutes = 300000ms)
 *
 * @example
 * ```tsx
 * // Enable auto-save after workflow is created (has id from backend)
 * useAutoSave({ enabled: !!currentWorkflow?.id });
 * ```
 */

export const useAutoSave = ({ enabled, interval = 2 * 60 * 1000 }: UseAutoSaveOptions) => {
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  const saveWorkflow = async (workflow: Workflow) => { 
    // Prevent concurrent saves
    if (isSavingRef.current) {
      console.log('Auto-save: Already saving, skipping...');
      return;
    }

    // Only save if workflow has required data (id from backend is required for update)
    if (!workflow?.id) {
      console.log('Auto-save: No id found, skipping save (workflow must be manually saved first)');
      return;
    }

    isSavingRef.current = true;

    try {
      console.log('Auto-save: Saving workflow...', {
        id: workflow.id,
        workflow_id: workflow.workflow_id,
        name: workflow.name,
        nodes: workflow.data?.nodes?.length || 0,
        edges: workflow.data?.edges?.length || 0,
      });

      // Strip data from nodes with unique_ids before saving
      const workflowToSave = prepareWorkflowForSave(workflow);

      // Do not JSON.stringify the full workflow here — large node.output.data can freeze the tab.

      // Use update-workflow API with updated_id field (same payload as create-workflow)
      // Remove 'id' field and use 'updated_id' instead
      const { id, ...workflowWithoutId } = workflowToSave;
      const payload = {
        ...workflowWithoutId,
        updated_id: String(workflow.id), // Convert number id to string for update-workflow API
      };

      const response = await api.post('/flow-builder/update-workflow', payload);

      if (response.status >= 200 && response.status <= 299) {
        console.log('Auto-save: Workflow saved successfully via update-workflow API');
      } else {
        throw new Error('Failed to auto-save workflow');
      }
    } catch (error) {
      console.error('Auto-save: Failed to save workflow:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only start auto-save if enabled and workflow exists with an id
    if (!enabled || !currentWorkflow?.id) {
      if (enabled && !currentWorkflow?.id) {
        console.log('Auto-save: Workflow not yet saved to backend (no id), auto-save disabled');
      }
      return;
    }

    console.log(`Auto-save: Starting auto-save with ${interval / 1000}s interval for workflow id: ${currentWorkflow.id}`);

    // Set up the interval
    intervalRef.current = setInterval(() => {
      if (currentWorkflow) {
        saveWorkflow(currentWorkflow);
      }
    }, interval);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        console.log('Auto-save: Cleaning up interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, currentWorkflow?.id, currentWorkflow?.data?.nodes, currentWorkflow?.data?.edges]);

  // Manual save function that can be called externally
  const triggerManualSave = () => {
    if (currentWorkflow) {
      saveWorkflow(currentWorkflow);
    }
  };

  return { triggerManualSave };
};

import { useState, useCallback } from 'react';
import { getNodeDataByUniqueIdApi } from '@/controllers/API';
import { toast } from 'sonner';

/**
 * Hook to load node data for a workflow
 * This fetches all node data when opening a workflow to populate output.data fields
 */
export function useWorkflowDataLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set());

  /**
   * Loads data for a single node if it has a unique_id
   * Returns the updated node with populated data
   */
  const loadNodeData = useCallback(async (
    node: any,
    flow_id: string
  ): Promise<{ node: any; success: boolean }> => {
    const uniqueId = node?.data?.node?.output?.unique_id;
    
    if (!uniqueId) {
      // No unique_id, return node as-is
      return { node, success: false };
    }

    try {
      const response = await getNodeDataByUniqueIdApi({
        flow_id,
        node_id: node.id,
        unique_id: uniqueId,
      });

      if (response.status && response.data) {
        // Create updated node with fetched data
        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            node: {
              ...node.data.node,
              output: {
                ...node.data.node.output,
                data: response.data, // Populate data from API
              },
            },
          },
        };
        
        return { node: updatedNode, success: true };
      }
      return { node, success: false };
    } catch (error) {
      console.error(`Failed to load data for node ${node.id}:`, error);
      return { node, success: false };
    }
  }, []);

  /**
   * Loads data for all nodes in a workflow that have unique_ids
   * Returns the workflow with all output.data fields populated
   */
  const loadWorkflowData = useCallback(async (workflow: any) => {
    if (!workflow?.data?.nodes || !workflow.flow_id) {
      return workflow;
    }

    setIsLoading(true);
    setLoadedNodeIds(new Set());

    const nodes = workflow.data.nodes;
    const flow_id = workflow.flow_id;
    
    // Filter nodes that have unique_id
    const nodesToLoad = nodes.filter(
      (node: any) => node?.data?.node?.output?.unique_id
    );

    if (nodesToLoad.length === 0) {
      setIsLoading(false);
      return workflow;
    }

    console.log(`Loading data for ${nodesToLoad.length} nodes with unique_ids...`);

    try {
      // Load all nodes in parallel
      const results = await Promise.allSettled(
        nodesToLoad.map((node: any) => loadNodeData(node, flow_id))
      );

      // Create a map of updated nodes
      const updatedNodesMap = new Map();
      let successCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { node: updatedNode, success } = result.value;
          updatedNodesMap.set(nodesToLoad[index].id, updatedNode);
          if (success) {
            successCount++;
            setLoadedNodeIds(prev => new Set(prev).add(nodesToLoad[index].id));
          }
        }
      });

      // Update all nodes with fetched data
      const updatedNodes = nodes.map((node: any) => {
        return updatedNodesMap.get(node.id) || node;
      });

      console.log(`Successfully loaded data for ${successCount}/${nodesToLoad.length} nodes`);

      // Return updated workflow with populated data
      const updatedWorkflow = {
        ...workflow,
        data: {
          ...workflow.data,
          nodes: updatedNodes,
        },
      };

      if (successCount > 0) {
        toast.success(`Loaded data for ${successCount} nodes`);
      }

      return updatedWorkflow;
    } catch (error) {
      console.error('Failed to load workflow data:', error);
      toast.error('Failed to load some node data');
      return workflow;
    } finally {
      setIsLoading(false);
    }
  }, [loadNodeData]);

  /**
   * Checks if a node's data has been loaded
   */
  const isNodeDataLoaded = useCallback((nodeId: string) => {
    return loadedNodeIds.has(nodeId);
  }, [loadedNodeIds]);

  /**
   * Clears the loaded nodes set
   */
  const clearLoadedNodes = useCallback(() => {
    setLoadedNodeIds(new Set());
  }, []);

  return {
    isLoading,
    loadNodeData,
    loadWorkflowData,
    isNodeDataLoaded,
    clearLoadedNodes,
    loadedNodeIds,
  };
}


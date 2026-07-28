import { useMemo } from "react";
import useFlowStore from "@/stores/flowStore";

const useSourceNodes = (nodeId?: string) => {
  const nodes = useFlowStore((state) => state.currentWorkflow?.data?.nodes);
  const edges = useFlowStore((state) => state.currentWorkflow?.data?.edges);
  const storeCurrentNodeId = useFlowStore((state) => state.current_node_id);
  const selectedNodeId = useFlowStore((state) =>
    state.currentWorkflow?.data?.nodes?.find((n) => n.selected)?.id
  );
  const getAllUpstreamNodes = useFlowStore((state) => state.getAllUpstreamNodes);

  const resolvedNodeId = nodeId ?? storeCurrentNodeId ?? selectedNodeId;

  return useMemo(() => {
    if (!resolvedNodeId) {
      return {
        sourceIds: [] as string[],
        sourceNodes: [] as NonNullable<typeof nodes>,
        targetIds: [] as string[],
        targetNodes: [] as NonNullable<typeof nodes>,
      };
    }

    const sourceNodes = getAllUpstreamNodes(resolvedNodeId) ?? [];
    const sourceIds = sourceNodes.map((n) => n.id);

    const incomingEdges = edges?.filter((edge) => edge.target === resolvedNodeId);
    const targetIds = incomingEdges?.map((edge) => edge.target) ?? [];
    const targetNodes = nodes?.filter((node) => targetIds.includes(node.id)) ?? [];

    return { sourceIds, sourceNodes, targetIds, targetNodes };
  }, [nodes, edges, resolvedNodeId, getAllUpstreamNodes]);
};

export default useSourceNodes;
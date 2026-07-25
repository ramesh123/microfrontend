import { ChartFormulator } from "@/pages/charts/ChartFormulator";
import useFlowStore from "@/stores/flowStore";
import { useMemo } from "react";

export function NodeChart() {
  const selectedNode = useFlowStore((state) => state.getSelectedNode());

  const upstreamNodes = useMemo(() => {
    if (!selectedNode) return [];
    return useFlowStore.getState().getUpstreamNodes(selectedNode.id);
  }, [selectedNode?.id]);

  return (
    <div className="w-full">
      <ChartFormulator upstreamNodes={upstreamNodes} />
    </div>
  );
}

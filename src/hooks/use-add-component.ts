import { getNodeDetailsApi } from "@/controllers/API";
import useFlowStore from "@/stores/flowStore";
import { AlgoNodeData } from "@/types/flow";
// import { AllNodeType, NodeResponse } from "@/types/flow";
import { getNodeId } from "@/utils/reactflowUtils";
import { useStoreApi } from "@xyflow/react";
import { useCallback } from "react";
import { toast } from "sonner";

export const NODE_WIDTH = 384;

export function useAddComponent() {

  const store = useStoreApi();
  // const paste = useFlowStore((state) => state.paste);

  const addComponent = useCallback(async (
    component: any,
    type: string,
    position?: { x: number; y: number }
  ) => {
    console.log("Component", component);
    const {
      height,
      width,
      transform: [transformX, transformY, zoomLevel],
    } = store.getState();

    // Clamp zoomLevel to a minimum value to prevent excessive zoomMultiplier
    const safeZoomLevel = Math.max(zoomLevel, 0.1);
    const zoomMultiplier = 1 / safeZoomLevel;

    let pos;
    if (position) {
      pos = position;
    } else {
      let centerX, centerY;

      centerX = -transformX * zoomMultiplier + (width * zoomMultiplier) / 2;
      centerY = -transformY * zoomMultiplier + (height * zoomMultiplier) / 2;

      const nodeOffset = NODE_WIDTH / 2;

      pos = {
        x: -nodeOffset,
        y: -nodeOffset,
        paneX: centerX,
        paneY: centerY,
      };
    }

    const newId = getNodeId(type);
    // if(!component?.node_id) {
    //   toast.error("Component is missing Node ID");
    //   return;
    // }
    const payload = {node_id: component?.data?.node_id};
    const nodeData = await getNodeDetailsApi(payload);

    const newNode: AlgoNodeData = {
      id: newId,
      type: type as "genericNode",
      position: pos,
      data: {
        ...nodeData.data,
        id: newId,
      },
    };

    // paste({ nodes: [newNode], edges: [] }, pos);

  }, []); // paste

  return addComponent
}
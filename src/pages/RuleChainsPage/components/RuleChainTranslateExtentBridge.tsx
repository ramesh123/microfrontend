import { useEffect } from "react";
import { useReactFlow, useStore, type CoordinateExtent } from "@xyflow/react";

import { ruleChainTranslateExtentFromBounds } from "../rule-node/ruleChainCanvasLogic";

/**
 * Recomputes pan boundaries from measured node bounds (must render inside `<ReactFlow>`).
 * Prevents scrolling past the diagram — ThingsBoard-style margin on all sides.
 */
export function RuleChainTranslateExtentBridge({
  onExtent,
}: {
  onExtent: (extent: CoordinateExtent) => void;
}) {
  const { getNodesBounds, getNodes } = useReactFlow();

  const layoutKey = useStore((s) => {
    let k = `${s.nodeLookup.size}:`;
    for (const n of s.nodeLookup.values()) {
      const p = n.internals.positionAbsolute;
      k += `${n.id}@${p.x},${p.y},${n.measured?.width ?? 0}x${n.measured?.height ?? 0};`;
    }
    return k;
  });

  useEffect(() => {
    const flowNodes = getNodes();
    if (flowNodes.length === 0) {
      onExtent(ruleChainTranslateExtentFromBounds({ x: 0, y: 0, width: 0, height: 0 }));
      return;
    }
    const bounds = getNodesBounds(flowNodes);
    onExtent(ruleChainTranslateExtentFromBounds(bounds));
  }, [layoutKey, getNodes, getNodesBounds, onExtent]);

  return null;
}

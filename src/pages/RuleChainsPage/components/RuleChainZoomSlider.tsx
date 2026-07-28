import { forwardRef } from "react";
import { useReactFlow, type PanelProps } from "@xyflow/react";

import { ZoomSlider, type ZoomSliderProps } from "@/components/zoom-slider";

import { fitViewOptionsForRuleChain } from "../rule-node/ruleChainCanvasLogic";
import { RULE_CHAIN_DEFAULT_ZOOM } from "../rule-node/ruleChainViewport";

/** Rule-chain zoom rail: fit-to-diagram uses TB-style options for compact vs large chains. */
export const RuleChainZoomSlider = forwardRef<HTMLDivElement, Omit<ZoomSliderProps, "onFitView">>(
  function RuleChainZoomSlider(props, ref) {
    const { fitView, getNodes } = useReactFlow();

    return (
      <ZoomSlider
        ref={ref}
        {...props}
        resetZoom={RULE_CHAIN_DEFAULT_ZOOM}
        onFitView={() => {
          fitView(fitViewOptionsForRuleChain(getNodes()));
        }}
      />
    );
  },
);

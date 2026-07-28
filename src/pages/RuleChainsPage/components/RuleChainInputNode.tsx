import { memo, useMemo, type CSSProperties } from "react";
import { Handle, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import { LogIn } from "lucide-react";

import { cn } from "@/lib/utils";

import { RuleChainNodeTooltipShell } from "./RuleChainNodeTooltipShell";
import { isRuleChainInputNode } from "../ruleChainTbAdapter";
import { RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID } from "../ruleChainHandles";
import { RULE_CHAIN_INPUT_CSS_VARS } from "../ruleChainNodeTheme";
import type { RuleChainFlowNodeData } from "./RuleChainFlowNode";

/**
 * Virtual chain input — Datafusion-style horizontal card; output on the right.
 */
function RuleChainInputNodeComponent({ data, selected }: NodeProps) {
  const d = data as RuleChainFlowNodeData;

  const ruleNodeCount = useStore(
    useMemo(
      () => (s) => {
        let c = 0;
        for (const n of s.nodeLookup.values()) {
          if (!isRuleChainInputNode(n as Node)) c += 1;
        }
        return c;
      },
      [],
    ),
  );

  const bodyStyle = useMemo<CSSProperties>(() => RULE_CHAIN_INPUT_CSS_VARS, []);

  return (
    <div className={cn("rule-chain-df-node algo-node relative select-none", selected && "opacity-95")}>
      <RuleChainNodeTooltipShell title={d.label} subtitle="Input - rule chain entry" segmentColor="#1e88e5">
        <div
          className={cn(
            "rule-chain-df-body algo-node-body rule-chain-node-body rule-chain-tb-node-body rule-chain-input-accent",
            selected && "selected",
          )}
          style={bodyStyle}
        >
          <div className="rule-chain-df-icon-col">
            <LogIn className="algo-node-icon rule-chain-df-icon rule-chain-df-icon-input !text-[22px] leading-none" aria-hidden />
            <span className="rule-chain-df-badge">IN</span>
          </div>
          <div className="rule-chain-df-label-col">
            <span className="rule-chain-df-label">{d.label}</span>
            <span className="rule-chain-df-subtitle tabular-nums">
              {ruleNodeCount} nodes
            </span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id={RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID}
            className="rule-chain-df-handle rule-chain-handle-source rule-chain-handle-source-out algo-handle react-flow__handle-source"
            style={{ top: "50%" }}
            aria-label="Output"
          />
        </div>
      </RuleChainNodeTooltipShell>
    </div>
  );
}

export const RuleChainInputNode = memo(RuleChainInputNodeComponent);

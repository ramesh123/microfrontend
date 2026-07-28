import {
  createContext,
  memo,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Ban, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { RuleChainNodeTooltipShell } from "./RuleChainNodeTooltipShell";
import { RuleNodeIcon } from "./RuleNodeIcon";
import { iotGatewayFlow } from "../iotGatewayUiLabels";
import { resolveVisibleOutputHandles, RULE_CHAIN_TARGET_HANDLE_ID } from "../ruleChainHandles";
import { ruleChainMaterialIconFallback } from "../ruleChainMaterialIcons";
import { ruleChainNodeCssVars, useRuleChainFlowColorMode } from "../ruleChainNodeTheme";
import { humanizeRuleNodeClazz } from "../ruleChainTbAdapter";
import { ruleChainNodeTooltipSubtitle } from "../rule-node/ruleChainNodeTooltip";

export type RuleChainFlowNodeData = {
  label: string;
  paletteSubtitle?: string;
  isRuleChainInput?: boolean;
  description?: string;
  disabled?: boolean;
  categoryCode: string;
  categoryColor: string;
  iconUrl?: string;
  iconName?: string;
  clazz?: string;
  type?: string;
  configuration?: Record<string, unknown>;
  tbEntityId?: string;
  configDirective?: string;
  relationTypes?: string[];
  tbPreserve?: {
    debugSettings?: unknown;
    singletonMode?: boolean;
    queueName?: unknown;
    configurationVersion?: number;
    createdTime?: number;
    externalId?: unknown;
  };
};

export type RuleChainNodeActions = {
  onEditNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
};

export const RuleChainNodeActionsContext = createContext<RuleChainNodeActions | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useRuleChainNodeActions(): RuleChainNodeActions | null {
  return useContext(RuleChainNodeActionsContext);
}

function RuleChainFlowNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as RuleChainFlowNodeData;
  const actions = useRuleChainNodeActions();
  const flowColorMode = useRuleChainFlowColorMode();
  const [isHovered, setIsHovered] = useState(false);
  const showToolbar = Boolean(actions && (isHovered || selected) && !d.isRuleChainInput);

  const outputHandles = useMemo(() => resolveVisibleOutputHandles(undefined, undefined, [], flowColorMode), [flowColorMode]);

  const bodyStyle: CSSProperties = useMemo(
    () => ruleChainNodeCssVars(d.categoryCode, d.categoryColor),
    [d.categoryCode, d.categoryColor],
  );

  const stopFlowPointer = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const templateSubtitle =
    d.paletteSubtitle?.trim() ||
    (d.clazz?.trim() ? humanizeRuleNodeClazz(d.clazz) : "") ||
    (d.type?.trim() ? d.type.trim() : "") ||
    "";

  const tooltipSubtitle = ruleChainNodeTooltipSubtitle(d);

  const onPlayClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    toast.message(`Run isn’t available for ${iotGatewayFlow} nodes on this canvas.`);
  };

  return (
    <div
      className={cn(
        "rule-chain-df-node algo-node relative transition-all duration-300 ease-in-out",
        d.disabled && "opacity-[0.82] saturate-[0.7]",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showToolbar ? (
        <div
          className="algo-node-actions rule-chain-node-toolbar"
          onPointerDown={stopFlowPointer}
          onMouseDown={stopFlowPointer}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="algo-node-action-button"
            aria-label="Run"
            onClick={onPlayClick}
          >
            <Play className="h-3 w-3 text-purple-500" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="algo-node-action-button"
            aria-label="Edit node"
            onClick={(e) => {
              e.stopPropagation();
              actions!.onEditNode(id);
            }}
          >
            <Pencil className="h-3 w-3 text-blue-500" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="algo-node-action-button text-red-500 hover:text-red-600"
            aria-label="Delete node"
            onClick={(e) => {
              e.stopPropagation();
              actions!.onDeleteNode(id);
            }}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="algo-node-action-button"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3 text-purple-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem onSelect={() => actions?.onEditNode(id)}>Edit configuration</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <RuleChainNodeTooltipShell
        title={d.label}
        subtitle={tooltipSubtitle || undefined}
        segmentColor={d.categoryColor}
      >
        <div
          className={cn(
            "rule-chain-df-body algo-node-body rule-chain-node-body rule-chain-tb-node-body cursor-pointer",
            selected && "selected",
          )}
          style={bodyStyle}
          onClick={(e) => {
            e.stopPropagation();
            actions?.onEditNode(id);
          }}
        >
        {d.disabled ? (
          <span
            className="absolute right-1 top-1 z-[4] flex items-center gap-0.5 rounded-md border border-rose-200/90 bg-rose-50 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-rose-800 shadow-sm dark:border-rose-900/70 dark:bg-rose-950/90 dark:text-rose-200"
            title="This rule node is disabled (inactive in ThingsBoard)."
          >
            <Ban className="h-2 w-2 shrink-0 stroke-[2.5]" aria-hidden />
            <span>Off</span>
          </span>
        ) : null}

        <div className="rule-chain-df-icon-col">
          <RuleNodeIcon
            iconUrl={d.iconUrl}
            iconName={d.iconName}
            fallbackMaterialIcon={ruleChainMaterialIconFallback(d.type)}
            className="algo-node-icon rule-chain-df-icon !text-[22px] leading-none"
            imgClassName="max-h-7 max-w-7 object-contain"
          />
          <span className="rule-chain-df-badge">{d.categoryCode}</span>
        </div>

        <div className="rule-chain-df-label-col">
          <span className="rule-chain-df-label">{d.label}</span>
          {templateSubtitle ? <span className="rule-chain-df-subtitle">{templateSubtitle}</span> : null}
        </div>

        <Handle
          type="target"
          position={Position.Left}
          id={RULE_CHAIN_TARGET_HANDLE_ID}
          className="rule-chain-df-handle rule-chain-handle-target rule-chain-handle-target-in algo-handle react-flow__handle-target"
          aria-label="Input"
        />

        <Handle
          type="source"
          position={Position.Right}
          id={outputHandles[0]!.id}
          className="rule-chain-df-handle rule-chain-handle-source rule-chain-handle-source-out algo-handle react-flow__handle-source"
          style={{
            top: "50%",
            ["--rc-port-color" as string]: outputHandles[0]!.color,
          }}
          title="Connect to next node"
          aria-label="Output"
        />
        </div>
      </RuleChainNodeTooltipShell>
    </div>
  );
}

export const RuleChainFlowNode = memo(RuleChainFlowNodeComponent);
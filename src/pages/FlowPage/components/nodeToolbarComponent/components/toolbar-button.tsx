import { Button } from "@/components/ui/button";
import { memo } from "react";

import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { cn } from "@/lib/utils";
import { AlgoNodeData } from "@/types/flow";
// import ShortcutDisplay from "../shortcutDisplay";

export const ToolbarButton = memo(
  ({
    onClick,
    icon,
    label,
    // shortcut,
    className,
    dataTestId,
    node,
  }: {
    onClick: (event: React.MouseEvent, node: AlgoNodeData) => void;
    icon: string;
    label?: string;
    // shortcut?: any;
    className?: string;
    dataTestId?: string;
    node?: AlgoNodeData;
  }) => (
    <ShadTooltip content={<span>shortcut</span>} side="top">
      <Button
        className={cn("node-toolbar-buttons hover:bg-primary/60 hover:text-primary-foreground", className)}
        variant="ghost"
        onClick={(event) => onClick(event, node)}
        size="node-toolbar"
        data-testid={dataTestId}
      >
        <ForwardedIconComponent strokeWidth={2} name={icon} className="h-4 w-4 font-bold" />
        {label && <span className="text-mmd font-medium">{label}</span>}
      </Button>
    </ShadTooltip>
  ),
);

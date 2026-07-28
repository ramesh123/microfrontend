import type { CSSProperties, ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RuleChainNodeTooltipShellProps = {
  title: string;
  subtitle?: string;
  /** Segment / category color — tooltip border and accents. */
  segmentColor?: string;
  children: ReactElement;
};

/** ThingsBoard-style node detail on hover: bold name + italic “Category - type”, right of node. */
export function RuleChainNodeTooltipShell({
  title,
  subtitle,
  segmentColor,
  children,
}: RuleChainNodeTooltipShellProps) {
  const tipTitle = title.trim();
  const tipSubtitle = subtitle?.trim();
  if (!tipTitle && !tipSubtitle) return children;

  const accent = segmentColor?.trim() || "#1e88e5";
  const tipStyle = {
    ["--rc-tip-accent" as string]: accent,
    borderColor: accent,
  } satisfies CSSProperties;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={14}
        avoidCollisions
        collisionPadding={12}
        style={tipStyle}
        className={cn(
          "rule-chain-node-detail-tooltip z-[60] max-w-[20rem] rounded-md border-2 px-3 py-2 shadow-lg",
          "bg-white text-slate-900",
          "dark:bg-slate-900 dark:text-slate-50",
        )}
      >
        {tipTitle ? <p className="text-sm font-bold leading-snug">{tipTitle}</p> : null}
        {tipSubtitle ? (
          <p
            className={cn(
              "rule-chain-node-detail-tooltip-subtitle text-xs leading-snug italic",
              tipTitle && "mt-0.5",
            )}
          >
            {tipSubtitle}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

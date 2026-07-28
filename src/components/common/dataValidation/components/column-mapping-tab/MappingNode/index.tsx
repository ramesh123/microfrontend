
import React from "react"
import { cn } from "@/lib/utils"

interface MappingNodeProps {
  columnName: string
  /** @deprecated Unused; kept for call-site compatibility. Styling is neutral like N-Way. */
  glowColor?: string
  onHandleClick: (handleType: "source" | "target") => void
  onDoubleClick: () => void
  isPendingSource: boolean
  isConnectedSource: boolean
  isConnectedTarget: boolean
  isReadOnly?: boolean
  /** Left stack: only right (source) handle — match N-Way / reference UI. */
  showSourceHandle?: boolean
  /** Right stack: only left (target) handle. */
  showTargetHandle?: boolean
  isSourceDataSource?: boolean
  isTargetDataSource?: boolean
}

const MappingNode = React.forwardRef<HTMLDivElement, MappingNodeProps>(
  (
    {
      columnName,
      onHandleClick,
      onDoubleClick,
      isPendingSource,
      isConnectedSource,
      isConnectedTarget,
      isReadOnly = false,
      showSourceHandle = true,
      showTargetHandle = true,
      isSourceDataSource = false,
      isTargetDataSource = false,
    },
    ref,
  ) => {
    const handleBaseClasses =
      "handle absolute top-1/2 z-[1] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-slate-300 bg-white transition-all dark:border-border dark:bg-background"

    const getInteractiveClasses = (handleType: "source" | "target") => {
      if (isReadOnly) return ""

      // For source data source (left side): only source handles (right side) should be clickable
      if (isSourceDataSource && handleType === "target") return "opacity-30 cursor-not-allowed"
      if (isSourceDataSource && handleType === "source") return "cursor-pointer hover:scale-125"

      // For target data source (right side): only target handles (left side) should be clickable
      if (isTargetDataSource && handleType === "source") return "opacity-30 cursor-not-allowed"
      if (isTargetDataSource && handleType === "target") return "cursor-pointer hover:scale-125"

      return "cursor-pointer hover:scale-125"
    }

    const getHandleStyle = (isConnected: boolean) =>
      isConnected
        ? {
            borderColor: "hsl(var(--primary))",
            boxShadow: "0 0 0 1px hsl(var(--primary) / 0.35)",
          }
        : {
            borderColor: "hsl(var(--muted-foreground) / 0.45)",
            boxShadow: "none",
          }

    const handleClick = (handleType: "source" | "target") => {
      if (isReadOnly) return

      // For source data source (left side): only allow source handle clicks
      if (isSourceDataSource && handleType === "target") return

      // For target data source (right side): only allow target handle clicks
      if (isTargetDataSource && handleType === "source") return

      onHandleClick(handleType)
    }

    return (
      <div
        ref={ref}
        className="relative flex min-h-[28px] items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50/80 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/40"
        onDoubleClick={onDoubleClick}
      >
        {showTargetHandle ? (
          <div
            data-handle-type="target"
            onClick={() => handleClick("target")}
            className={cn(handleBaseClasses, getInteractiveClasses("target"), "left-0 -translate-x-1/2")}
            style={getHandleStyle(isConnectedTarget)}
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate px-1 text-center font-mono text-[11px] leading-tight" title={columnName}>
          {columnName}
        </span>
        {showSourceHandle ? (
          <div
            data-handle-type="source"
            onClick={() => handleClick("source")}
            className={cn(
              handleBaseClasses,
              getInteractiveClasses("source"),
              "right-0 translate-x-1/2",
              isPendingSource && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
            )}
            style={getHandleStyle(isConnectedSource)}
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden />
        )}
      </div>
    )
  },
)

MappingNode.displayName = "MappingNode"

export default MappingNode

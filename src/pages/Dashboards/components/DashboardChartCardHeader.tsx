import { ArrowDown, ArrowUpRight, ExpandIcon, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import ShadTooltip from '@/components/common/shadTooltipComponent';

interface DashboardChartCardHeaderProps {
  title: string;
  hideTitle?: boolean;
  showExpandButton?: boolean;
  showDownloadButton?: boolean;
  expandDisabled?: boolean;
  onExpand?: () => void;
  expandTooltip?: string;
  onDownload?: () => void;
  showDrilldownButton?: boolean;
  showDrillThroughButton?: boolean;
  isDrilldownArmed?: boolean;
  isDrillThroughArmed?: boolean;
  onDrilldown?: () => void;
  onDrillThrough?: () => void;
  drilldownDisabled?: boolean;
  drillThroughDisabled?: boolean;
  drilldownTooltip?: string;
  drillThroughTooltip?: string;
  trailing?: React.ReactNode;
}

const toggleBtnClass =
  'inline-flex h-5 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

const toggleBtnActiveClass =
  'bg-background text-foreground shadow-sm ring-1 ring-border/60';

export function DashboardChartCardHeader({
  title,
  hideTitle = false,
  showExpandButton = false,
  showDownloadButton = false,
  expandDisabled = false,
  onExpand,
  expandTooltip = 'Expand',
  onDownload,
  showDrilldownButton = false,
  showDrillThroughButton = false,
  isDrilldownArmed = false,
  isDrillThroughArmed = false,
  onDrilldown,
  onDrillThrough,
  drilldownDisabled = false,
  drillThroughDisabled = false,
  drilldownTooltip = 'Drilldown',
  drillThroughTooltip = 'Drill Through',
  trailing,
}: DashboardChartCardHeaderProps) {
  const showChartActions =
    showExpandButton || showDownloadButton || showDrilldownButton || showDrillThroughButton;

  return (
    <div className="flex items-center gap-1.5 border-b border-border/50 bg-card px-2 py-1 min-h-[2rem] shrink-0">
      {!hideTitle ? (
        <h4
          className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground text-left"
          title={title}
        >
          {title}
        </h4>
      ) : (
        <div className="flex-1 min-w-0" aria-hidden />
      )}
      <div className={cn('flex items-center gap-1 shrink-0', hideTitle && 'w-full justify-end')}>
        {showChartActions && (
          <div className="flex h-6 items-center rounded-sm border border-border/50 bg-muted/20 p-0.5 gap-0.5">
            {showExpandButton && (
              <ShadTooltip content={expandTooltip}>
                <span className="inline-block pointer-events-auto">
                  <button
                    type="button"
                    title={expandTooltip}
                    disabled={expandDisabled}
                    className={toggleBtnClass}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand?.();
                    }}
                  >
                    <ExpandIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">{expandTooltip}</span>
                  </button>
                </span>
              </ShadTooltip>
            )}
            {showDownloadButton && (
              <ShadTooltip content="Download Image">
                <span className="inline-block pointer-events-auto">
                  <button
                    type="button"
                    title="Download Image"
                    className={toggleBtnClass}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload?.();
                    }}
                  >
                    <ArrowDown className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">Download Image</span>
                  </button>
                </span>
              </ShadTooltip>
            )}
            {showDrilldownButton && (
              <ShadTooltip content={drilldownTooltip}>
                <span className="inline-block pointer-events-auto">
                  <button
                    type="button"
                    title={drilldownTooltip}
                    aria-pressed={isDrilldownArmed}
                    disabled={drilldownDisabled}
                    className={cn(
                      toggleBtnClass,
                      isDrilldownArmed && toggleBtnActiveClass,
                      isDrilldownArmed && 'text-primary',
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrilldown?.();
                    }}
                  >
                    <Layers className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">{drilldownTooltip}</span>
                  </button>
                </span>
              </ShadTooltip>
            )}
            {showDrillThroughButton && (
              <ShadTooltip content={drillThroughTooltip}>
                <span className="inline-block pointer-events-auto">
                  <button
                    type="button"
                    title={drillThroughTooltip}
                    aria-pressed={isDrillThroughArmed}
                    disabled={drillThroughDisabled}
                    className={cn(
                      toggleBtnClass,
                      isDrillThroughArmed && toggleBtnActiveClass,
                      isDrillThroughArmed && 'text-primary',
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrillThrough?.();
                    }}
                  >
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">{drillThroughTooltip}</span>
                  </button>
                </span>
              </ShadTooltip>
            )}
          </div>
        )}
        {trailing}
      </div>
    </div>
  );
}

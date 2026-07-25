import { ExpandIcon, Pencil, X } from 'lucide-react';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { Button } from '@/components/ui/button';

interface DashboardChartHeaderActionsProps {
  chartTitle: string;
  onEdit?: () => void;
  onExpand?: () => void;
  expandDisabled?: boolean;
  expandTooltip?: string;
  onRemove?: () => void;
}

export function DashboardChartHeaderActions({
  chartTitle,
  onEdit,
  onExpand,
  expandDisabled = false,
  expandTooltip = 'Expand chart',
  onRemove,
}: DashboardChartHeaderActionsProps) {
  if (!onEdit && !onExpand && !onRemove) {
    return null;
  }

  return (
    <div
      className="dashboard-chart-no-drag flex items-center gap-0.5"
      data-dashboard-chart-action
      onMouseDown={(e) => e.stopPropagation()}
    >
      {onEdit && (
        <ShadTooltip content={`Edit ${chartTitle}`}>
          <span className="inline-block pointer-events-auto">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${chartTitle}`}
            >
              <Pencil className="!h-3.5 !w-3.5" />
            </Button>
          </span>
        </ShadTooltip>
      )}
      {onExpand && (
        <ShadTooltip content={expandTooltip}>
          <span className="inline-block pointer-events-auto">
            <Button
              size="icon"
              variant="ghost"
              disabled={expandDisabled}
              className="h-6 w-6 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              aria-label={expandTooltip}
            >
              <ExpandIcon className="!h-3.5 !w-3.5" />
            </Button>
          </span>
        </ShadTooltip>
      )}
      {onRemove && (
        <ShadTooltip content={`Remove ${chartTitle}`}>
          <span className="inline-block pointer-events-auto">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={`Remove ${chartTitle}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </span>
        </ShadTooltip>
      )}
    </div>
  );
}

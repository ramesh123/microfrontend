import { useState, type ReactNode } from 'react';
import { ExpandIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { ChartHoverActionButton, ChartHoverActionPill } from '@/pages/charts/components/ChartHoverActionPill';
import {
  AGING_CHART_EXPANDED_DIALOG_HEIGHT,
  AGING_CHART_EXPANDED_DIALOG_MIN_HEIGHT,
} from '../utils/agingAmChartScrollbar';

interface AgingChartExpandButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function AgingChartExpandButton({
  onClick,
  disabled,
  label = 'Expand chart',
  className,
}: AgingChartExpandButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className ?? 'h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground'}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <ExpandIcon className="!h-3.5 !w-3.5" />
    </Button>
  );
}

interface AgingChartExpandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  contentHeight?: number;
  contentMinHeight?: number;
  dialogClassName?: string;
  /** When true, chart area fills remaining dialog height instead of a fixed pixel height. */
  fillHeight?: boolean;
  /** Actions rendered on the right side of the dialog title row (e.g. chart toolbar). */
  headerTrailing?: ReactNode;
}

export function AgingChartExpandDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  contentHeight = AGING_CHART_EXPANDED_DIALOG_HEIGHT,
  contentMinHeight = AGING_CHART_EXPANDED_DIALOG_MIN_HEIGHT,
  dialogClassName,
  fillHeight = false,
  headerTrailing,
}: AgingChartExpandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          'flex max-h-[92vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-3 overflow-hidden p-4',
          dialogClassName,
        )}
      >
        <DialogHeader className="shrink-0 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="shrink-0">
              {headerTrailing ?? (
                  <ShadTooltip content="Minimize">
                    <span>
                      <ChartHoverActionButton title="Minimize" onClick={() => onOpenChange(false)}>
                        <Minimize2 className="h-5 w-5" />
                      </ChartHoverActionButton>
                    </span>
                  </ShadTooltip>
              )}
            </div>
          </div>
        </DialogHeader>
        <div
          className="relative flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden"
          style={
            fillHeight
              ? undefined
              : {
                  height: contentHeight,
                  minHeight: contentMinHeight,
                }
          }
        >
          {open ? children : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useAgingChartExpand(disabled = false) {
  const [open, setOpen] = useState(false);

  const expandButton = (
    <AgingChartExpandButton
      onClick={() => setOpen(true)}
      disabled={disabled}
    />
  );

  return { open, setOpen, expandButton };
}

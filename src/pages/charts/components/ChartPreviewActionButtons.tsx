import React from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, ExpandIcon, Layers, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { Button } from '@/components/ui/button';
import { ChartHoverActionButton, ChartHoverActionPill } from '@/pages/charts/components/ChartHoverActionPill';

export interface ChartPreviewActionButtonsProps {
  showChart: boolean;
  isViewOnly?: boolean;
  isDrilldownSupported?: boolean;
  isDrillThroughSupported?: boolean;
  isDrilldownArmed?: boolean;
  isDrillThroughArmed?: boolean;
  onArmDrilldown?: () => void;
  onArmDrillThrough?: () => void;
  onExpand?: () => void;
  canDrilldownBack?: boolean;
  onDrilldownBack?: () => void;
  className?: string;
  alwaysVisible?: boolean;
  /** Override pill placement; defaults to header when alwaysVisible, else overlay. */
  placement?: 'header' | 'overlay';
  hideExpand?: boolean;
  showMinimize?: boolean;
  onMinimize?: () => void;
  isBigNumberChart?: boolean;
  chartTitle?: string;
  isTableOrPivotChart?: boolean;
}

export function ChartPreviewActionButtons({
  showChart,
  isViewOnly,
  isDrilldownSupported = false,
  isDrillThroughSupported = false,
  isDrilldownArmed = false,
  isDrillThroughArmed = false,
  onArmDrilldown,
  onArmDrillThrough,
  onExpand,
  canDrilldownBack,
  onDrilldownBack,
  className,
  alwaysVisible = true,
  placement,
  hideExpand = false,
  showMinimize = false,
  onMinimize,
  isBigNumberChart = false,
  chartTitle = 'Big Number',
  isTableOrPivotChart = false,
}: ChartPreviewActionButtonsProps) {
  if (!showChart) return null;

  const drilldownDisabled = !!isViewOnly || !isDrilldownSupported;
  const drillThroughDisabled = !!isViewOnly || !isDrillThroughSupported;
  const resolvedPlacement = placement ?? (alwaysVisible ? 'header' : 'overlay');
  const pillAlwaysVisible =
    alwaysVisible ||
    (isDrilldownArmed && isDrilldownSupported) ||
    (isDrillThroughArmed && isDrillThroughSupported);

  const triggerDownload = (canvas: HTMLCanvasElement) => {
    const link = document.createElement('a');
    link.download = 'chart.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Chart downloaded successfully');
  };

  const handleDownloadImage = (event: React.MouseEvent) => {
    try {
      const container = event.currentTarget.closest('[role="dialog"], dialog, .DialogContent, .group, [data-chart-id]');

      if (isBigNumberChart) {
        const labelEl = container?.querySelector('.line-clamp-2');
        const valueEl = container?.querySelector('.tabular-nums');
        const bgOverlayEl = container?.querySelector('.pointer-events-none.absolute.inset-0') as HTMLElement | null;

        const labelText = labelEl?.textContent?.trim() || chartTitle || 'Big Number';
        const valueText = valueEl?.textContent?.trim() || 'N/A';

        let bgStyle = bgOverlayEl ? (bgOverlayEl.style.background || bgOverlayEl.style.backgroundColor) : '';
        if (!bgStyle && bgOverlayEl) {
          bgStyle = window.getComputedStyle(bgOverlayEl).background || window.getComputedStyle(bgOverlayEl).backgroundColor;
        }

        let valueColor = '#ffffff';
        let labelColor = 'rgba(255, 255, 255, 0.65)';

        if (valueEl) {
          valueColor = window.getComputedStyle(valueEl).color || '#ffffff';
        }
        if (labelEl) {
          labelColor = window.getComputedStyle(labelEl).color || 'rgba(255, 255, 255, 0.65)';
        }

        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const colors = bgStyle.match(/#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3}|rgba?\([^)]+\)/g);
          let fillStyle: string | CanvasGradient = '#0f172a';

          if (colors && colors.length >= 3) {
            const gradient = ctx.createLinearGradient(0, 0, 400, 200);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(0.48, colors[1]);
            gradient.addColorStop(1, colors[2]);
            fillStyle = gradient;
          } else if (colors && colors.length === 2) {
            const gradient = ctx.createLinearGradient(0, 0, 400, 200);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[1]);
            fillStyle = gradient;
          } else if (colors && colors.length === 1) {
            fillStyle = colors[0];
          } else if (bgStyle) {
            fillStyle = bgStyle;
          }

          ctx.fillStyle = fillStyle;
          ctx.fillRect(0, 0, 400, 200);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          if (valueColor !== '#ffffff' && !valueColor.includes('255')) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          }
          ctx.lineWidth = 1.5;
          ctx.strokeRect(1, 1, 398, 198);

          ctx.fillStyle = labelColor;
          ctx.font = '500 14px Inter, system-ui, sans-serif';
          ctx.fillText(labelText, 24, 52);

          ctx.fillStyle = valueColor;
          ctx.font = 'bold 44px Inter, system-ui, sans-serif';
          ctx.fillText(valueText, 24, 120);

          const link = document.createElement('a');
          link.download = `${labelText.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_bignumber.png`;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success('Chart image downloaded successfully');
          return;
        }
      }

      let canvas = container?.querySelector('canvas');
      if (!canvas) {
        canvas = document.querySelector('canvas');
      }
      if (!canvas) {
        toast.error('No chart canvas found to download');
        return;
      }
      triggerDownload(canvas);
    } catch (error) {
      console.error('Failed to download chart image:', error);
      toast.error('Failed to download chart image');
    }
  };

  return (
    <>
      {!alwaysVisible && canDrilldownBack && onDrilldownBack && (
        <ShadTooltip content="Back to previous view">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-20 h-7 w-7 rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-[0_2px_10px_rgba(15,23,42,0.14)] backdrop-blur-sm hover:bg-muted/70 hover:text-foreground"
            onClick={onDrilldownBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </ShadTooltip>
      )}
      <ChartHoverActionPill
        alwaysVisible={pillAlwaysVisible}
        placement={resolvedPlacement}
        className={resolvedPlacement === 'overlay' ? (className ?? 'top-2 right-2') : className}
      >
        {!isBigNumberChart && onExpand && !hideExpand && (
          <ShadTooltip content="Expand">
            <span>
              <ChartHoverActionButton title="Expand" onClick={onExpand}>
                <ExpandIcon className="h-3.5 w-3.5" />
              </ChartHoverActionButton>
            </span>
          </ShadTooltip>
        )}
        {!isBigNumberChart && !isTableOrPivotChart && (
          <ShadTooltip content="Download Image">
            <span className="inline-block pointer-events-auto">
              <ChartHoverActionButton title="Download Image" onClick={handleDownloadImage}>
                <ArrowDown className="h-3.5 w-3.5" />
              </ChartHoverActionButton>
            </span>
          </ShadTooltip>
        )}
        {isDrilldownSupported && (
          <ShadTooltip content="Drilldown">
            <span className="inline-block pointer-events-auto">
              <ChartHoverActionButton
                title="Drilldown"
                disabled={drilldownDisabled}
                active={isDrilldownArmed && !isViewOnly}
                onClick={onArmDrilldown}
              >
                <Layers className="h-3.5 w-3.5" />
              </ChartHoverActionButton>
            </span>
          </ShadTooltip>
        )}
        {isDrillThroughSupported && (
          <ShadTooltip content="Drill Through">
            <span className="inline-block pointer-events-auto">
              <ChartHoverActionButton
                title="Drill Through"
                disabled={drillThroughDisabled}
                active={isDrillThroughArmed && !isViewOnly}
                onClick={onArmDrillThrough}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </ChartHoverActionButton>
            </span>
          </ShadTooltip>
        )}
        {showMinimize && onMinimize && (
          <ShadTooltip content="Minimize">
            <span>
              <ChartHoverActionButton title="Minimize" onClick={onMinimize}>
                <Minimize2 className="h-3.5 w-3.5" />
              </ChartHoverActionButton>
            </span>
          </ShadTooltip>
        )}
      </ChartHoverActionPill>
    </>
  );
}

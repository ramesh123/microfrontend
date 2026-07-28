import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CHART_GAP, DASHBOARD_CANVAS_RIGHT_INSET } from '../dashboardConstants';

function DashboardWidgetCardSkeleton({
  className,
  bodyClassName,
  compact = false,
}: {
  className?: string;
  bodyClassName?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-3 py-2">
        <Skeleton className="h-3.5 w-28" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
        </div>
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col gap-2 p-3', bodyClassName)}>
        {compact ? (
          <>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <Skeleton className="min-h-[72px] w-full flex-1 rounded-md" />
            <div className="flex shrink-0 items-end justify-between gap-2 pt-1">
              <Skeleton className="h-2 w-[18%] rounded-full" />
              <Skeleton className="h-2 w-[22%] rounded-full" />
              <Skeleton className="h-2 w-[16%] rounded-full" />
              <Skeleton className="h-2 w-[24%] rounded-full" />
              <Skeleton className="h-2 w-[14%] rounded-full" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function DashboardChartContentSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full w-full flex-col gap-3 p-3', className)}>
      <Skeleton className="min-h-[96px] w-full flex-1 rounded-md" />
      <div className="flex shrink-0 items-end justify-between gap-2 px-0.5">
        <Skeleton className="h-2 w-[20%] rounded-full" />
        <Skeleton className="h-2 w-[28%] rounded-full" />
        <Skeleton className="h-2 w-[18%] rounded-full" />
        <Skeleton className="h-2 w-[24%] rounded-full" />
      </div>
    </div>
  );
}

type DashboardCanvasSkeletonProps = {
  className?: string;
  backgroundStyle?: CSSProperties;
  /** @deprecated Skeleton always spans the live canvas width. */
  layoutWidth?: number;
};

export function DashboardCanvasSkeleton({
  className,
  backgroundStyle,
}: DashboardCanvasSkeletonProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin dashboard-canvas-scroll',
        className,
      )}
      style={backgroundStyle}
    >
      <div
        className="relative min-h-full w-full max-w-full py-2"
        style={{
          paddingLeft: CHART_GAP,
          paddingRight: CHART_GAP + DASHBOARD_CANVAS_RIGHT_INSET,
          boxSizing: 'border-box',
          minHeight: 600,
        }}
      >
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-2 pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <DashboardWidgetCardSkeleton key={`kpi-${index}`} compact className="col-span-4 h-[72px]" />
          ))}
        </div>

        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-2 pb-2">
          <DashboardWidgetCardSkeleton className="col-span-8 h-[220px]" />
          <DashboardWidgetCardSkeleton className="col-span-8 h-[220px]" />
          <DashboardWidgetCardSkeleton className="col-span-8 h-[220px]" />
        </div>

        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-2">
          <DashboardWidgetCardSkeleton className="col-span-12 h-[240px]" />
          <DashboardWidgetCardSkeleton className="col-span-12 h-[240px]" />
        </div>
      </div>
    </div>
  );
}

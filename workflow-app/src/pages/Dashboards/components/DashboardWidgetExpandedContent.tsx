import * as React from 'react';
import type { Chart } from '../types';

export type DashboardWidgetExpandedContentProps = {
  scopeKey?: string;
  chart: Chart;
  renderChartPanel: () => React.ReactNode;
  /** Rendered above chart (e.g. drill level / filter toolbar). */
  toolbar?: React.ReactNode;
};

export function DashboardWidgetExpandedContent({
  renderChartPanel,
  toolbar,
}: DashboardWidgetExpandedContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-0">
      {toolbar ? <div className="shrink-0 border-b border-border/40 px-2 py-1">{toolbar}</div> : null}
      <div className="relative flex h-[min(70vh,720px)] min-h-[400px] w-full flex-1 flex-col overflow-hidden rounded-md pt-1">
        {renderChartPanel()}
      </div>
    </div>
  );
}

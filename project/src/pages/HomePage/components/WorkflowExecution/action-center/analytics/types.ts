import type { StreamChartDataSlice } from '@/pages/charts/components/charts/bigNumber';

/** Layout item shape for a single chart cell */
export interface AnalyticsChartLayoutItem {
  layoutItem: any;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalIndex: number;
}

export interface DrillFilterItem {
  column: string;
  value: any;
}

export type ChartDrilldownState = Record<
  number,
  {
    stack: Array<{
      chartData: any[];
      rawResponse?: any;
      drillFilter?: DrillFilterItem[];
    }>;
    currentChartData: any[];
    currentRawResponse?: any;
  }
>;

/** Props for a single chart cell – only this chart's slice of state drives re-renders when memoized. */
export interface AnalyticsChartCellProps {
  chartId: number;
  item: AnalyticsChartLayoutItem;
  chartInfo: any;
  chartDataMap: Record<number, any>;
  chartDrilldownState: ChartDrilldownState;
  loadingCharts: Set<number>;
  drilldownLoadingChartId: number | null;
  containerWidth: number;
  onDrilldownBack: (chartId: number, popCount?: number) => void;
  onChartDrilldown: (
    chartId: number,
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: DrillFilterItem[],
  ) => void;
  onOpenDrilldown: (chartId: number) => void;
  onOpenDataPreview: (chartId: number) => void;
  onArmDrillThrough: (chartId: number) => void;
  isDrilldownArmed?: boolean;
  isDrillThroughArmed?: boolean;
  flowId?: string;
  stmtDateForApi: string;
  onStreamChartDataUpdate: (chartId: number, merged: StreamChartDataSlice) => void;
}

export interface AnalyticsProps {
  flowId?: string;
  workflowName?: string;
  /** When `analytics-studio`, loads a single dashboard and uses database chart payloads (no statement date). */
  mode?: 'workflow' | 'analytics-studio';
  dashboardId?: string;
}


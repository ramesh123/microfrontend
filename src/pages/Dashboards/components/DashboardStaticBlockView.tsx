
import { memo, useMemo, type CSSProperties } from 'react';
import { Bell, Image, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chart } from '../types';
import {
  PANEL_GRID_CELL_MIN_HEIGHT,
  getPanelChartSnapshot,
  buildPanelGridStyle,
  getPanelBackgroundColor,
  computeSmartPanelLayouts,
  resolvePanelChartVizFromSources,
  getWidgetTitleSizeClass,
  getWidgetTitleAlignClass,
  getWidgetTitleAlignFlexClass,
  resolvePanelChartDisplayLayout,
} from '../layoutConstants';
import { PanelNestedChart, type PanelChartSnapshot } from './PanelNestedChartView';
import {
  getPanelEmbeddedWidgetShellClass,
  PANEL_EMBEDDED_CHART_SHELL_CLASS,
} from '../utils/dashboardWidgetTabs';
import './dashboardGrid.css';
import { DividerBlockView } from './DividerBlockView';

interface DashboardStaticBlockViewProps {
  chart: Chart;
}

export const DashboardStaticBlockView = memo(function DashboardStaticBlockView({
  chart,
}: DashboardStaticBlockViewProps) {
  const vizName = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();

  if (vizName === 'panel') {
    return <StaticPanelView chart={chart} />;
  }
  if (vizName === 'text') {
    return <StaticTextView chart={chart} />;
  }
  if (vizName === 'image') {
    return <StaticImageView chart={chart} />;
  }
  if (vizName === 'alert') {
    return <StaticAlertView chart={chart} />;
  }
  if (vizName === 'divider') {
    return <DividerBlockView params={chart.params} />;
  }

  return null;
});

const StaticPanelView = memo(function StaticPanelView({ chart }: { chart: Chart }) {
  const panelBg = getPanelBackgroundColor(chart.params);
  const showGridLines = chart.params?.panel_show_grid_lines !== false;
  const columns = chart.params?.panel_columns ?? 4;
  const items = chart.params?.panel_items || [];
  const panelChartsData = chart.params?.panel_charts_data || {};
  const chartItems = items.filter((item: any) => item.type === 'chart');
  const useAbsoluteLayout = chartItems.length > 0;
  const gapXPct = Math.min(6, Math.max(0, ((chart.params?.panel_gap_x ?? 4) / 5)));
  const gapYPct = Math.min(6, Math.max(0, ((chart.params?.panel_gap_y ?? 4) / 5)));

  const smartLayouts = useMemo(
    () =>
      computeSmartPanelLayouts(
        chartItems,
        (chartId) => resolvePanelChartVizFromSources(chartId, panelChartsData, []),
        columns,
        gapXPct,
        gapYPct,
      ),
    [chartItems, panelChartsData, columns, gapXPct, gapYPct],
  );

  const gridItemCount = Math.max(1, chartItems.length || items.length);

  const gridStyle: CSSProperties = buildPanelGridStyle(
    columns,
    gridItemCount,
    showGridLines,
    PANEL_GRID_CELL_MIN_HEIGHT,
    panelBg,
  );

  if (useAbsoluteLayout) {
    return (
      <div
        className={`h-full w-full flex flex-col min-h-0 overflow-hidden ${
          panelBg ? 'p-0.5 rounded-sm border border-muted/15' : 'p-0'
        }`}
        style={panelBg ? { backgroundColor: panelBg } : undefined}
      >
        <div className="panel-free-layout relative flex-1 min-h-0 h-full w-full">
          {chartItems.map((item: any, idx: number) => {
            const snapshot = getPanelChartSnapshot(panelChartsData, item.chartId) as PanelChartSnapshot | undefined;
            const layout = resolvePanelChartDisplayLayout(
              item,
              idx,
              chartItems.length,
              smartLayouts,
              columns,
              gapXPct,
              gapYPct,
              chart.params?.panel_resize_enabled === true,
            );
            const shellClass = snapshot?.chart
              ? getPanelEmbeddedWidgetShellClass(snapshot.chart)
              : PANEL_EMBEDDED_CHART_SHELL_CLASS;
            return (
              <div
                key={item.id || idx}
                className={`panel-chart-slot absolute overflow-hidden ${shellClass}`}
                style={{
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.w}%`,
                  height: `${layout.h}%`,
                }}
              >
                {snapshot?.chart ? (
                  <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
                    <PanelNestedChart snapshot={snapshot} />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center px-1">
                    <span className="text-[10px] text-muted-foreground">Chart data not saved</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full flex flex-col min-h-0 overflow-hidden ${
        panelBg ? 'p-0.5 rounded-sm border border-muted/15' : 'p-0'
      }`}
      style={panelBg ? { backgroundColor: panelBg } : undefined}
    >
      <div
        style={gridStyle}
        className={`flex-1 min-h-0 h-full ${showGridLines ? 'divide-x divide-y divide-muted/20 border border-muted/15 rounded-sm overflow-hidden' : ''}`}
      >
        {items.map((item: any, idx: number) => {
          const isChart = item.type === 'chart';

          if (isChart) {
            const snapshot = getPanelChartSnapshot(panelChartsData, item.chartId) as PanelChartSnapshot | undefined;
            const shellClass = snapshot?.chart
              ? getPanelEmbeddedWidgetShellClass(snapshot.chart)
              : PANEL_EMBEDDED_CHART_SHELL_CLASS;
            return (
              <div
                key={item.id || idx}
                className={cn('flex flex-col min-h-0 h-full overflow-hidden p-0.5', shellClass, showGridLines && 'border-r border-b border-muted/10')}
              >
                {snapshot?.chart ? (
                  <div className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
                    <div className="text-[9px] text-muted-foreground font-medium truncate text-center shrink-0 leading-none py-0.5">
                      {snapshot.chart.chart_name || item.label || 'Chart'}
                    </div>
                    <div className="flex-1 min-h-0 h-full w-full">
                      <PanelNestedChart snapshot={snapshot} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center px-1">
                    <span className="text-[10px] text-muted-foreground">Chart data not saved</span>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={item.id || idx}
              className={`flex flex-col justify-center min-h-0 h-full overflow-hidden px-1 py-0.5 ${showGridLines ? 'border-r border-b border-muted/10' : ''}`}
            >
              <span className="text-[10px] text-muted-foreground font-medium truncate leading-tight" title={item.label}>
                {item.label || 'Metric'}
              </span>
              <span
                className="text-xs font-semibold truncate leading-tight"
                style={{ color: item.value_color || '#0284c7' }}
                title={item.value}
              >
                {item.value || '—'}
              </span>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground/60 flex flex-col items-center justify-center gap-1">
            <LayoutGrid className="w-4 h-4 text-muted-foreground/35" />
            <span>No panel items configured</span>
          </div>
        )}
      </div>
    </div>
  );
});

const StaticTextView = memo(function StaticTextView({ chart }: { chart: Chart }) {
  const titleSizeClass = useMemo(() => getWidgetTitleSizeClass(chart.params), [chart.params]);
  const alignClass = useMemo(() => getWidgetTitleAlignClass(chart.params), [chart.params]);
  const flexAlignClass = useMemo(() => getWidgetTitleAlignFlexClass(chart.params), [chart.params]);
  const label = chart.chart_name || 'Label';

  return (
    <div className={`h-full w-full flex items-center px-1.5 py-0.5 min-h-0 ${flexAlignClass}`}>
      <span className={`font-semibold truncate leading-tight w-full ${titleSizeClass} ${alignClass}`}>
        {label}
      </span>
    </div>
  );
});

const StaticImageView = memo(function StaticImageView({ chart }: { chart: Chart }) {
  if (chart.params?.image_data) {
    return (
      <div className="h-full w-full overflow-hidden min-h-0">
        <img src={chart.params.image_data} alt="Dashboard content" className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-muted/10 border border-dashed border-muted-foreground/25 rounded-sm p-2">
      <Image className="w-6 h-6 text-muted-foreground/40 mb-1" />
      <span className="text-[10px] font-medium text-muted-foreground/70">Image not configured</span>
    </div>
  );
});

const StaticAlertView = memo(function StaticAlertView({ chart }: { chart: Chart }) {
  const bgColor = chart.params?.alert_bg_color ?? '#e6f4ea';
  const textColor = chart.params?.alert_text_color ?? '#137333';

  return (
    <div
      className="h-full w-full flex items-center gap-1.5 rounded-sm px-2 py-1 min-h-0"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: textColor }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold truncate leading-tight">{chart.params?.alert_title || 'Alert'}</p>
        <p className="text-[10px] leading-snug opacity-90 line-clamp-2">{chart.params?.alert_message || ''}</p>
      </div>
    </div>
  );
});
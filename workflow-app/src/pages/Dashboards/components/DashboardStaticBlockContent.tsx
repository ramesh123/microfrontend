


import { memo, useMemo, useState, useCallback, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Bell, Image, LayoutGrid } from 'lucide-react';
import type { Chart, DashboardChart } from '../types';
import {
  PANEL_GRID_CELL_MIN_HEIGHT,
  getPanelChartSnapshot,
  buildPanelGridStyle,
  getPanelBackgroundColor,
  getPanelCardZoneStyle,
  computeSmartPanelLayouts,
  applySmartPanelLayoutsToItems,
  resolvePanelChartVizFromSources,
  getWidgetTitleSizeClass,
  getWidgetTitleAlignClass,
  getWidgetTitleAlignFlexClass,
  resolvePanelChartDisplayLayout,
  clampPanelItemLayout,
  type PanelItemLayout,
} from '../layoutConstants';
import { PanelNestedChart, type PanelChartSnapshot } from './PanelNestedChartView';
import { PanelResizableItem } from './PanelResizableItem';
import { DividerBlockView } from './DividerBlockView';
import './dashboardGrid.css';
import {
  getPanelEmbeddedWidgetShellClass,
  isDashboardBigNumberChart,
  PANEL_EMBEDDED_CHART_SHELL_CLASS,
} from '../utils/dashboardWidgetTabs';

function panelSlotStyle(layout: PanelItemLayout): CSSProperties {
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.w}%`,
    height: `${layout.h}%`,
  };
}

interface DashboardStaticBlockContentProps {
  chart: Chart;
  dashboardChartId: string;
  vizName: string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  allCharts?: DashboardChart[];
}

function resolvePanelItemSnapshot(
  panelChartsData: Record<string | number, unknown>,
  item: { chartId?: number | string },
  allCharts: DashboardChart[],
): PanelChartSnapshot | undefined {
  const snapshot = getPanelChartSnapshot(panelChartsData, item.chartId) as PanelChartSnapshot | undefined;
  if (snapshot) return snapshot;

  const canvasChart = allCharts.find(
    (c) => c.chartId === item.chartId || c.chart.id === item.chartId,
  );
  if (!canvasChart) return undefined;

  return {
    chart: canvasChart.chart,
    chartData: canvasChart.chartData,
    chartColumns: canvasChart.chartColumns,
    rawResponse: canvasChart.rawResponse,
    isLoading: canvasChart.isLoading,
  };
}

// const StaticPanelWidget = memo(function StaticPanelWidget({
//   chart,
//   dashboardChartId,
//   onUpdateChart,
//   allCharts = [],
// }: {
//   chart: Chart;
//   dashboardChartId: string;
//   onUpdateChart?: (id: string, updatedParams: any) => void;
//   allCharts?: DashboardChart[];
// }) {
//   const panelBg = getPanelBackgroundColor(chart.params);
//   const panelBgImage = chart.params?.panel_bg_image;
//   const panelBgImageFit = chart.params?.panel_bg_image_fit !== 'contain' ? 'cover' : 'contain';
//   const showGridLines = chart.params?.panel_show_grid_lines !== false;
//   const columns = chart.params?.panel_columns ?? 4;
//   const items = chart.params?.panel_items || [];
//   const panelChartsData = chart.params?.panel_charts_data || {};
//   const chartItems = items.filter((item: any) => item.type === 'chart');
//   const gridItemCount = Math.max(1, chartItems.length || items.length);

//   const gridStyle: CSSProperties = buildPanelGridStyle(
//     columns,
//     gridItemCount,
//     showGridLines,
//     PANEL_GRID_CELL_MIN_HEIGHT,
//     panelBg,
//   );

//   return (
//     <div
//       className={`h-full w-full flex flex-col min-h-0 overflow-hidden ${
//         (panelBg || panelBgImage) ? 'p-0.5 rounded-sm border border-muted/15' : 'p-0'
//       }`}
//       style={{
//         ...(panelBg ? { backgroundColor: panelBg } : undefined),
//         ...(panelBgImage
//           ? {
//               backgroundImage: `url(${panelBgImage})`,
//               backgroundSize: panelBgImageFit,
//               backgroundPosition: 'center',
//               backgroundRepeat: 'no-repeat',
//             }
//           : undefined),
//       }}
//     >
//       <div
//         style={gridStyle}
//         className={`flex-1 min-h-0 h-full ${showGridLines ? 'divide-x divide-y divide-muted/20 border border-muted/15 rounded-sm overflow-hidden' : ''}`}
//       >
//         {items.map((item: any, idx: number) => {
//           const isChart = item.type === 'chart';

//           if (isChart) {
//             const snapshot = resolvePanelItemSnapshot(panelChartsData, item, allCharts);

//             return (
//               <div
//                 key={item.id || idx}
//                 className={`flex flex-col min-h-0 h-full overflow-hidden p-0.5 ${showGridLines ? 'border-r border-b border-muted/10' : ''}`}
//               >
//                 {snapshot?.chart ? (
//                   <div className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden relative">
//                     <div className="text-[9px] text-muted-foreground font-medium truncate text-center shrink-0 leading-none py-0.5">
//                       {snapshot.chart.chart_name || item.label || 'Chart'}
//                     </div>
//                     <div className="flex-1 min-h-0 h-full w-full">
//                       <PanelNestedChart snapshot={snapshot} />
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="flex items-center justify-center h-full text-center px-1">
//                     <span className="text-[10px] text-muted-foreground">Select a Chart</span>
//                   </div>
//                 )}
//               </div>
//             );
//           }

//           return (
//             <div
//               key={item.id || idx}
//               className={`flex flex-col justify-center min-h-0 h-full overflow-hidden px-1 py-0.5 ${showGridLines ? 'border-r border-b border-muted/10' : ''}`}
//             >
//               {onUpdateChart ? (
//                 <div className="space-y-1">
//                   <input
//                     type="text"
//                     value={item.label || ''}
//                     onChange={(e) => {
//                       const newItems = [...items];
//                       newItems[idx] = { ...newItems[idx], label: e.target.value };
//                       onUpdateChart(dashboardChartId, { panel_items: newItems });
//                     }}
//                     className="text-[11px] text-muted-foreground font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-1 -ml-1 w-full"
//                     placeholder="Metric Label"
//                   />
//                   <input
//                     type="text"
//                     value={item.value || ''}
//                     onChange={(e) => {
//                       const newItems = [...items];
//                       newItems[idx] = { ...newItems[idx], value: e.target.value };
//                       onUpdateChart(dashboardChartId, { panel_items: newItems });
//                     }}
//                     className="text-base font-bold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-1 -ml-1 w-full"
//                     style={{ color: item.value_color || '#0284c7' }}
//                     placeholder="Value"
//                   />
//                 </div>
//               ) : (
//                 <>
//                   <span className="text-[11px] text-muted-foreground font-medium truncate" title={item.label}>
//                     {item.label || 'Metric'}
//                   </span>
//                   <span
//                     className="text-base font-bold truncate mt-0.5"
//                     style={{ color: item.value_color || '#0284c7' }}
//                     title={item.value}
//                   >
//                     {item.value || '0'}
//                   </span>
//                 </>
//               )}
//             </div>
//           );
//         })}
//         {items.length === 0 && (
//           <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground/60 flex flex-col items-center justify-center gap-1">
//             <LayoutGrid className="w-4 h-4 text-muted-foreground/35" />
//             <span>Open customizer to add embedded charts</span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// });

function hexToRgbaLike(hex: string, alpha = 0.55): string {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const StaticPanelWidget = memo(function StaticPanelWidget({
  chart,
  dashboardChartId,
  onUpdateChart,
  allCharts = [],
}: {
  chart: Chart;
  dashboardChartId: string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  allCharts?: DashboardChart[];
}) {
  const panelBg = getPanelBackgroundColor(chart.params);
  const panelBgImage = chart.params?.panel_bg_image;
  const panelBgLayout = chart.params?.panel_bg_layout || 'full'; // 'full' | 'left' | 'right'
  const panelBgGutterPct = chart.params?.panel_bg_gutter_pct ?? 24;
  const panelBgBrightness = chart.params?.panel_bg_brightness ?? 100;
  const panelBgContrast = chart.params?.panel_bg_contrast ?? 100;
  const panelBgSaturate = chart.params?.panel_bg_saturate ?? 100;
  const panelBgOpacity = chart.params?.panel_bg_opacity ?? 100;
  const showGridLines = chart.params?.panel_show_grid_lines !== false;
  const columns = chart.params?.panel_columns ?? 4;
  const items = chart.params?.panel_items || [];
  const panelChartsData = chart.params?.panel_charts_data || {};
  const chartItems = items.filter((item: any) => item.type === 'chart');
  const editable = Boolean(onUpdateChart) && chart.params?.panel_resize_enabled === true;
  const useAbsoluteLayout = chartItems.length > 0;
  const panelGapX = chart.params?.panel_gap_x ?? 4;
  const panelGapY = chart.params?.panel_gap_y ?? 4;
  // Allow true zero gap when slider is 0; previously forced a 1.5% minimum.
  const gapXPct = Math.min(6, Math.max(0, panelGapX / 5));
  const gapYPct = Math.min(6, Math.max(0, panelGapY / 5));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const libraryCharts = useMemo(
    () => allCharts.map((dc) => dc.chart),
    [allCharts],
  );

  const smartLayouts = useMemo(
    () =>
      computeSmartPanelLayouts(
        chartItems,
        (chartId) => resolvePanelChartVizFromSources(chartId, panelChartsData, libraryCharts),
        columns,
        gapXPct,
        gapYPct,
      ),
    [chartItems, panelChartsData, libraryCharts, columns, gapXPct, gapYPct],
  );

  const updateItemLayout = useCallback((itemId: string, layout: PanelItemLayout) => {
    if (!onUpdateChart) return;
    const newItems = itemsRef.current.map((item: any) =>
      item.id === itemId ? { ...item, layout: clampPanelItemLayout(layout) } : item,
    );
    onUpdateChart(dashboardChartId, { panel_items: newItems });
  }, [dashboardChartId, onUpdateChart]);

  const removeItemFromPanel = useCallback((itemId: string) => {
    if (!onUpdateChart) return;
    const nextItems = items.filter((item: any) => item.id !== itemId);
    onUpdateChart(dashboardChartId, {
      panel_items: editable
        ? nextItems
        : applySmartPanelLayoutsToItems(
            nextItems,
            (chartId) => resolvePanelChartVizFromSources(chartId, panelChartsData, libraryCharts),
            columns,
            gapXPct,
            gapYPct,
          ),
    });
    if (selectedItemId === itemId) setSelectedItemId(null);
  }, [
    columns,
    dashboardChartId,
    gapXPct,
    gapYPct,
    items,
    libraryCharts,
    onUpdateChart,
    panelChartsData,
    selectedItemId,
    editable,
  ]);

  const resolveItemLayout = useCallback(
    (item: any, idx: number): PanelItemLayout =>
      resolvePanelChartDisplayLayout(
        item,
        idx,
        chartItems.length,
        smartLayouts,
        columns,
        gapXPct,
        gapYPct,
        editable,
      ),
    [chartItems.length, columns, gapXPct, gapYPct, smartLayouts, editable],
  );

  const renderChartCell = (item: any, idx: number, snapshot: PanelChartSnapshot | undefined) => {
    const layout = resolveItemLayout(item, idx);
    const isBigNumberViz = snapshot?.chart ? isDashboardBigNumberChart(snapshot.chart) : false;
    const shellClass = snapshot?.chart
      ? getPanelEmbeddedWidgetShellClass(snapshot.chart)
      : PANEL_EMBEDDED_CHART_SHELL_CLASS;
    const chartTitle = snapshot?.chart?.chart_name || 'Chart';

    const content = snapshot?.chart ? (
      <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
        <PanelNestedChart snapshot={snapshot} />
      </div>
    ) : (
      <div className="flex h-full items-center justify-center bg-muted/10 px-2 text-center">
        <span className="text-[10px] text-muted-foreground">Select a chart</span>
      </div>
    );

    if (useAbsoluteLayout) {
      if (editable) {
        return (
          <PanelResizableItem
            key={item.id || idx}
            layout={layout}
            editable
            selected={selectedItemId === item.id}
            chartTitle={chartTitle}
            isBigNumberViz={isBigNumberViz}
            onSelect={() => setSelectedItemId(item.id)}
            onLayoutChange={(next) => updateItemLayout(item.id, next)}
            onRemove={() => removeItemFromPanel(item.id)}
          >
            {content}
          </PanelResizableItem>
        );
      }

      return (
        <div
          key={item.id || idx}
          className={cn('panel-chart-slot absolute overflow-hidden', shellClass)}
          style={panelSlotStyle(layout)}
        >
          {content}
        </div>
      );
    }

    return (
      <div
        key={item.id || idx}
        className={cn(
          'flex flex-col min-h-0 h-full overflow-hidden p-0.5',
          shellClass,
          showGridLines && 'border-r border-b border-muted/10',
        )}
      >
        {content}
      </div>
    );
  };

  const gridItemCount = Math.max(1, chartItems.length || items.length);
  const gridStyle: CSSProperties = buildPanelGridStyle(
    columns,
    gridItemCount,
    showGridLines,
    PANEL_GRID_CELL_MIN_HEIGHT,
    panelBg,
    panelGapX,
    panelGapY,
  );

  // Card zone sits above the full-bleed photo; only this layer shifts for left/right placement.
  // Do NOT combine with Tailwind w-full — width:100% + left gutter overflows and clips the last column.
  const effectiveBgLayout = panelBgImage ? panelBgLayout : 'full';
  const cardZoneStyle: CSSProperties = {
    ...getPanelCardZoneStyle(effectiveBgLayout, panelBgGutterPct),
    ...(panelBgImage
      ? { transition: 'left 0.22s ease, right 0.22s ease, top 0.22s ease, bottom 0.22s ease' }
      : {}),
  };

  const gridContent = useAbsoluteLayout ? (
    <div
      className="panel-free-layout relative h-full w-full min-h-0"
      onMouseDown={editable ? (e) => {
        if (e.target === e.currentTarget) setSelectedItemId(null);
      } : undefined}
    >
      {chartItems.map((item: any, idx: number) => {
        const snapshot = resolvePanelItemSnapshot(panelChartsData, item, allCharts);
        return renderChartCell(item, idx, snapshot);
      })}
      {chartItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground/60">
          <LayoutGrid className="w-4 h-4 text-muted-foreground/35" />
          <span>Open customizer to add embedded charts</span>
        </div>
      )}
    </div>
  ) : (
    <div
      style={gridStyle}
      className={`flex-1 min-h-0 h-full ${showGridLines ? 'divide-x divide-y divide-muted/20 border border-muted/15 rounded-sm overflow-hidden' : ''}`}
    >
      {items.map((item: any, idx: number) => {
        const isChart = item.type === 'chart';

        if (isChart) {
          const snapshot = resolvePanelItemSnapshot(panelChartsData, item, allCharts);
          return renderChartCell(item, idx, snapshot);
        }

        return (
          <div
            key={item.id || idx}
            className={`flex flex-col justify-center min-h-0 h-full overflow-hidden px-1 py-0.5 ${showGridLines ? 'border-r border-b border-muted/10' : ''}`}
          >
            {onUpdateChart ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={item.label || ''}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], label: e.target.value };
                    onUpdateChart(dashboardChartId, { panel_items: newItems });
                  }}
                  className="text-[11px] text-muted-foreground font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-1 -ml-1 w-full"
                  placeholder="Metric Label"
                />
                <input
                  type="text"
                  value={item.value || ''}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], value: e.target.value };
                    onUpdateChart(dashboardChartId, { panel_items: newItems });
                  }}
                  className="text-base font-bold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-1 -ml-1 w-full"
                  style={{ color: item.value_color || '#0284c7' }}
                  placeholder="Value"
                />
              </div>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground font-medium truncate" title={item.label}>
                  {item.label || 'Metric'}
                </span>
                <span
                  className="text-base font-bold truncate mt-0.5"
                  style={{ color: item.value_color || '#0284c7' }}
                  title={item.value}
                >
                  {item.value || '0'}
                </span>
              </>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground/60 flex flex-col items-center justify-center gap-1">
          <LayoutGrid className="w-4 h-4 text-muted-foreground/35" />
          <span>Open customizer to add embedded charts</span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`relative h-full w-full flex flex-col min-h-0 overflow-hidden ${
        (panelBg || panelBgImage) ? 'rounded-sm border border-muted/15' : 'p-0'
      }`}
      style={!panelBgImage && panelBg ? { backgroundColor: panelBg } : undefined}
    >
      {/* Photo layer — always fills the ENTIRE panel, never repositioned or resized by card layout */}
      {panelBgImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${panelBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: panelBgOpacity / 100,
            filter: `brightness(${panelBgBrightness}%) contrast(${panelBgContrast}%) saturate(${panelBgSaturate}%)`,
          }}
        />
      )}

      {/* Optional color wash under the card-side content, so cards stay readable over the photo */}
      {panelBgImage && panelBg && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={
            panelBgLayout === 'left'
              ? { background: `linear-gradient(to right, transparent 0%, transparent ${panelBgGutterPct}%, ${panelBg} ${panelBgGutterPct}%)` }
              : panelBgLayout === 'right'
                ? { background: `linear-gradient(to left, transparent 0%, transparent ${panelBgGutterPct}%, ${panelBg} ${panelBgGutterPct}%)` }
                : { backgroundColor: hexToRgbaLike(panelBg) }
          }
        />
      )}

      {/* Card zone — widgets live here; shifts left/right while the photo stays fixed */}
      <div className="z-10 min-h-0 overflow-hidden" style={cardZoneStyle}>
        {gridContent}
      </div>
    </div>
  );
});
const StaticTextWidget = memo(function StaticTextWidget({ chart }: { chart: Chart }) {
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

const StaticAlertWidget = memo(function StaticAlertWidget({
  chart,
  dashboardChartId,
  onUpdateChart,
}: {
  chart: Chart;
  dashboardChartId: string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
}) {
  const alertTitle = chart.params?.alert_title ?? 'Status Update';
  const alertMessage = chart.params?.alert_message ?? 'All data ingestion jobs running healthy';
  const bgColor = chart.params?.alert_bg_color ?? '#e6f4ea';
  const textColor = chart.params?.alert_text_color ?? '#137333';

  return (
    <div
      className="h-full w-full flex items-center gap-1.5 rounded-sm px-2 py-1 min-h-0 select-none"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <Bell className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textColor }} />
      <div className="min-w-0 flex-1">
        {onUpdateChart ? (
          <div className="space-y-0.5 w-full flex flex-col min-h-0">
            <input
              type="text"
              value={alertTitle}
              onChange={(e) => onUpdateChart(dashboardChartId, { alert_title: e.target.value })}
              className="text-[11px] font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-0.5 w-full leading-tight"
              placeholder="Alert Title..."
              style={{ color: 'inherit' }}
            />
            <input
              type="text"
              value={alertMessage}
              onChange={(e) => onUpdateChart(dashboardChartId, { alert_message: e.target.value })}
              className="text-[10px] opacity-85 bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 focus:bg-background/80 rounded px-0.5 w-full truncate leading-snug"
              placeholder="Alert Message..."
              style={{ color: 'inherit' }}
            />
          </div>
        ) : (
          <>
            <div className="text-[11px] font-semibold leading-tight">{alertTitle}</div>
            <div className="text-[10px] opacity-85 truncate leading-snug">{alertMessage}</div>
          </>
        )}
      </div>
    </div>
  );
});

export const DashboardStaticBlockContent = memo(function DashboardStaticBlockContent({
  chart,
  dashboardChartId,
  vizName,
  onUpdateChart,
  allCharts = [],
}: DashboardStaticBlockContentProps) {
  if (vizName === 'panel') {
    return (
      <StaticPanelWidget
        chart={chart}
        dashboardChartId={dashboardChartId}
        onUpdateChart={onUpdateChart}
        allCharts={allCharts}
      />
    );
  }

  if (vizName === 'text') {
    return <StaticTextWidget chart={chart} />;
  }

  if (vizName === 'image') {
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUpdateChart) {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const base64 = uploadEvent.target?.result as string;
          if (base64) {
            onUpdateChart(dashboardChartId, { image_data: base64 });
          }
        };
        reader.readAsDataURL(file);
      }
    };

    if (chart.params?.image_data) {
      return (
        <div className="relative h-full w-full group/image overflow-hidden min-h-0">
          <img
            src={chart.params.image_data}
            alt="Uploaded content"
            className="w-full h-full object-contain"
          />
          {onUpdateChart && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
              <div className="pointer-events-auto flex gap-2">
                <label className="bg-background text-foreground px-2 py-1 rounded text-xs font-semibold cursor-pointer shadow hover:bg-muted transition-colors">
                  Change Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateChart(dashboardChartId, { image_data: undefined })}
                  className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold shadow hover:bg-destructive/90 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-muted/10 border border-dashed border-muted-foreground/25 rounded-sm p-2 hover:border-primary/40 transition-colors relative">
        {onUpdateChart ? (
          <label className="flex flex-col items-center cursor-pointer text-center select-none gap-0.5">
            <Image className="w-6 h-6 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-muted-foreground/75">Upload Image</span>
            <span className="text-[9px] text-muted-foreground/55">Click to choose file</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        ) : (
          <>
            <Image className="w-6 h-6 text-muted-foreground/40 mb-0.5" />
            <span className="text-[10px] font-medium text-muted-foreground/75">Dashboard Image Widget</span>
          </>
        )}
      </div>
    );
  }

  if (vizName === 'alert') {
    return (
      <StaticAlertWidget
        chart={chart}
        dashboardChartId={dashboardChartId}
        onUpdateChart={onUpdateChart}
      />
    );
  }

  if (vizName === 'divider') {
    return <DividerBlockView params={chart.params} />;
  }

  return null;
});
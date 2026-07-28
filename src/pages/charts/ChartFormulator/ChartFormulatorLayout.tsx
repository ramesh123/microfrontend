import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table2, Type, Hash, CalendarDays, Copy, Check, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { ChartPreviewActionButtons } from '@/pages/charts/components/ChartPreviewActionButtons';
import { DndContext, DragOverlay, useSensors, PointerSensor } from '@dnd-kit/core';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { ChartConfigurator, ChartType, Config } from '../components/ChartConfigurator';
import type { AnalyticsStudioChartInit } from './types';
import { AmChart } from '../components/AmChart';
import { PivotChart } from '../components/charts/pivot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DrilldownBreadcrumb } from '../components/DrilldownBreadcrumb';
import { DashboardView, SavedChart } from '../components/DashboardView';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChartFormulatorPreviewSkeleton, ChartFormulatorTableSkeleton } from './ChartFormulatorSkeletons';
import { ChartFormulatorHeader } from '../components/ChartFormulatorHeader';
import { ChartSelector } from '../components/ChartSelector';
import { DataFieldsSidebar } from '../components/DataFieldsSidebar';
import { UpstreamFieldsSidebar } from '@/components/common/charts/columnsdata';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { toast } from 'sonner';
import '@/pages/HomePage/components/WorkflowExecution/Reconcilationtab/Summary.css';
import type { ChartType as ChartTypeConfig } from '../components/ChartConfigurator';

export interface ChartFormulatorLayoutProps {
  isViewOnly: boolean;
  sensors: ReturnType<typeof useSensors>;
  onSelectChart: (chart: ChartTypeConfig & { uniqueId: string }) => Promise<void>;
  onChartDrilldown: (field: string, value: any) => void;
  onDragStart: (event: any) => void;
  onDragEnd: (event: any) => void;
  activeId: string | null;
  getActiveDraggable: () => React.ReactNode;
  view: 'dashboard' | 'formulator';
  setView: (v: 'dashboard' | 'formulator') => void;
  savedCharts: SavedChart[];
  threads: any[];
  dashboardCharts: SavedChart[];
  onRemoveChartFromDashboard: (chartId: string) => void;
  onMaximizeChart: (chart: SavedChart) => void;
  onDeleteSavedChart: (chartId: string) => void;
  isWorkflowPath: boolean;
  pathname: string;
  flowId: string;
  setFlowId: (v: string) => void;
  onLoadColumns: (flowIdOverride?: string, stmtDateOverride?: string) => Promise<void>;
  onSaveChart: () => void;
  isLoadingColumns: boolean;
  isSavingChart: boolean;
  editChartId: string | null;
  /** When set (workflow Charts node already saved a chart), merge with editChartId for update UI and APIs. */
  workflowPersistedChartId?: string | null;
  analyticsStudioInit?: AnalyticsStudioChartInit;
  upstreamNodes: any[];
  sources: any[];
  selectedSource: string | null;
  onSourceChange: (sourceName: string) => void;
  drilldownFilters: any[];
  /** Level-by-level drilldown config for breadcrumb (each level has drill_filters and drill_columns) */
  drilldownLevels?: Array<{ drill_filters: Array<{ column: string; value: any }>; drill_columns?: Array<{ column: string }> }>;
  /** Called when user reorders or edits base (first level) drilldown columns in configurator */
  onBaseDrilldownColumnsChange?: (columns: Array<{ column: string }>) => void;
  onNavigateDrilldown: (index: number) => void;
  selectedChart: ChartType | null;
  chartFormData: any;
  chartConfig: Config | null;
  setChartConfig: React.Dispatch<React.SetStateAction<Config | null>>;
  onClearChart: () => void;
  onUpdateChart: (overrideFormValues?: any) => Promise<void>;
  onGenerateChart: (opts?: { allowInView?: boolean }) => Promise<void>;
  isLoadingForm: boolean;
  isLoadingChart: boolean;
  editFormValues: Record<string, any> | undefined;
  customizationOptions: any;
  onCustomizationChange: (options: any) => void;
  editChartData: any;
  showEditChartData: boolean;
  setShowEditChartData: (v: boolean) => void;
  chartNameToSave: string;
  setChartNameToSave: (v: string) => void;
  copiedJson: boolean;
  setCopiedJson: (v: boolean) => void;
  chartData: any[];
  rawChartResponse: any;
  agTheme: ReturnType<typeof themeQuartz.withParams>;
  agGridRowData: any[];
  agGridColumnDefs: any[];
  isStreaming: boolean;
  streamedData: any[];
  currentFields: { name: string; type: string }[];
  threadToDelete: string | null;
  setThreadToDelete: (v: string | null) => void;
  onConfirmDeleteThread: () => void;
  isSaveChartNameDialogOpen: boolean;
  setIsSaveChartNameDialogOpen: (v: boolean) => void;
  onConfirmSaveChartWithName: () => Promise<void>;
  maximizedChart: SavedChart | null;
  maximizedChartThread: any;
  editingChartName: string;
  setEditingChartName: (v: string) => void;
  maximizedChartFilteredData: any[];
  isLegendVisible: boolean;
  setIsLegendVisible: (v: boolean) => void;
  onCloseMaximize: () => void;
  onUpdateChartName: () => void;
  currentFieldsForDrag?: { name: string; type: string }[];
  canDrilldownBack?: boolean;
  onDrilldownBack?: () => void;
  /** Fetches pivot drilldown data when a row is expanded. Used for nested PivotChart. */
  onPivotRowExpand?: (params: { dimension: string; value: string }) => Promise<any>;
  /** When in edit mode and user changes flow ID in header, switch to create mode (e.g. navigate to create route). */
  onSwitchToCreateMode?: () => void;
  isDrilldownSupported?: boolean;
  isDrillThroughSupported?: boolean;
  isDrilldownArmed?: boolean;
  isDrillThroughArmed?: boolean;
  onArmDrilldown?: () => void;
  onArmDrillThrough?: () => void;
  embedded?: boolean;
  onEmbeddedClose?: () => void;
}

export function ChartFormulatorLayout(props: ChartFormulatorLayoutProps) {
  const {
    isViewOnly,
    sensors,
    onSelectChart,
    onChartDrilldown,
    onDragStart,
    onDragEnd,
    activeId,
    getActiveDraggable,
    view,
    setView,
    savedCharts,
    threads,
    dashboardCharts,
    onRemoveChartFromDashboard,
    onMaximizeChart,
    onDeleteSavedChart,
    isWorkflowPath,
    pathname,
    flowId,
    setFlowId,
    onLoadColumns,
    onSaveChart,
    isLoadingColumns,
    isSavingChart,
    editChartId,
    workflowPersistedChartId = null,
    analyticsStudioInit,
    upstreamNodes,
    sources,
    selectedSource,
    onSourceChange,
    drilldownFilters,
    drilldownLevels = [],
    onBaseDrilldownColumnsChange,
    onNavigateDrilldown,
    selectedChart,
    chartFormData,
    chartConfig,
    setChartConfig,
    onClearChart,
    onUpdateChart,
    onGenerateChart,
    isLoadingForm,
    isLoadingChart,
    editFormValues,
    customizationOptions,
    onCustomizationChange,
    editChartData,
    showEditChartData,
    setShowEditChartData,
    chartNameToSave,
    setChartNameToSave,
    copiedJson,
    setCopiedJson,
    chartData,
    rawChartResponse,
    agTheme,
    agGridRowData,
    agGridColumnDefs,
    isStreaming,
    streamedData,
    currentFields,
    threadToDelete,
    setThreadToDelete,
    onConfirmDeleteThread,
    isSaveChartNameDialogOpen,
    setIsSaveChartNameDialogOpen,
    onConfirmSaveChartWithName,
    maximizedChart,
    maximizedChartThread,
    editingChartName,
    setEditingChartName,
    maximizedChartFilteredData,
    isLegendVisible,
    setIsLegendVisible,
    onCloseMaximize,
    onUpdateChartName,
    currentFieldsForDrag = [],
    canDrilldownBack = false,
    onDrilldownBack,
    onPivotRowExpand,
    onSwitchToCreateMode,
    isDrilldownSupported = false,
    isDrillThroughSupported = false,
    isDrilldownArmed = false,
    isDrillThroughArmed = false,
    onArmDrilldown,
    onArmDrillThrough,
    embedded = false,
    onEmbeddedClose,
  } = props;

  const chartIdForConfigurator =
    (editChartId && String(editChartId).trim()) ||
    (workflowPersistedChartId && String(workflowPersistedChartId).trim()) ||
    null;

  /** Persisted chart lives on the node; use ChartSelector "Update Chart" for save — form footer stays create/preview only. */
  const workflowFooterCreateOnly =
    !!(isWorkflowPath && workflowPersistedChartId && String(workflowPersistedChartId).trim());

  const currentFieldsForDragResolved = currentFieldsForDrag.length ? currentFieldsForDrag : currentFields;

  const chartNameLower = (selectedChart?.name || '').toLowerCase();
  const uniqueIdLower = (selectedChart?.uniqueId || '').toLowerCase();
  const isBigNumberChart =
    chartNameLower.includes('number') ||
    chartNameLower.includes('bignumber') ||
    chartNameLower.includes('big number') ||
    uniqueIdLower === 'number' ||
    uniqueIdLower === 'bignumber' ||
    uniqueIdLower === 'big_number_stream';

  const isTableOrPivot =
    chartNameLower.includes('table') ||
    chartNameLower.includes('pivot') ||
    uniqueIdLower === 'table' ||
    uniqueIdLower === 'pivot' ||
    uniqueIdLower === 'pivot_table';

  const previewChartPanelSize = isBigNumberChart ? 32 : 60;
  const previewTablePanelSize = isBigNumberChart ? 68 : 40;

  const chartTitle =
    editChartData?.chart_name ||
    editChartData?.chartName ||
    editChartData?.name ||
    editFormValues?.chart_name ||
    editFormValues?.name ||
    selectedChart?.name ||
    'Big Number';

  const emptyConfig = { x: null, y: null, operator: null, color: null, column: null, row: null } as Config;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Delay chart render in expand preview so container has final dimensions (fixes sunburst/grouped bar in dialog)
  const [previewChartReady, setPreviewChartReady] = useState(false);
  useEffect(() => {
    if (!isPreviewOpen) {
      setPreviewChartReady(false);
      return;
    }
    const id = setTimeout(() => setPreviewChartReady(true), 100);
    return () => clearTimeout(id);
  }, [isPreviewOpen]);
  // automatically generate chart when entering edit mode (only once)
  const _autoGenerateCalled = useRef(false);
  useEffect(() => {
    if (editChartId && !_autoGenerateCalled.current) {
      _autoGenerateCalled.current = true;
      // don't block UI; fire-and-forget
      try {
        // prefer allowing view generation when supported
        // onGenerateChart may return a Promise
        // guard against missing prop
        // If we're in edit mode, prefer calling the create/update chart API so the existing chart
        // is (re)created/validated on open. Fall back to onGenerateChart if onUpdateChart is not provided.
        if (typeof onUpdateChart === 'function') {
          // call update/create API (may accept overrideFormValues)
          onUpdateChart();
        } else if (typeof onGenerateChart === 'function') {
          onGenerateChart();
        }
      } catch (e) {
        // swallow - this is a best-effort convenience behavior
        // errors will surface through existing error handling
      }
    }
  }, [editChartId, onUpdateChart, onGenerateChart]);
  // Show sunburst debug button automatically during development or when explicitly enabled
  const showSunburstDebug = typeof window !== 'undefined' && (
    (window as any).__sunburstDebug === true || (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV)
  );

  // helper: convert pivot-shaped raw response into row objects for ag-Grid
  function pivotToRowData(raw?: any) {
    if (!raw || !raw.data || Array.isArray(raw.data)) return [];
    // rows can be provided as raw.rows or inferred from keys
    const rowKeys = Array.isArray(raw.rows) && raw.rows.length ? raw.rows : Object.keys(raw.data || {});
    // columns may be provided or inferred from first row
    const firstKey = rowKeys[0];
    const columns = Array.isArray(raw.columns) && raw.columns.length
      ? raw.columns
      : (firstKey && raw.data[firstKey] ? Object.keys(raw.data[firstKey]) : []);

    return rowKeys.map((r: any) => {
      const out: Record<string, any> = { __row__: r };
      columns.forEach((c: any) => {
        // handle nested numeric-keyed maps ("0","1") as well as normal keys
        const val = raw.data?.[r]?.[c];
        out[c] = val === undefined ? null : val;
      });
      return out;
    });
  }

  const computedAgGridRowData = useMemo(() => {
    if (agGridRowData && agGridRowData.length) return agGridRowData;
    if (streamedData && streamedData.length) return streamedData;
    if (chartData && chartData.length) return chartData;
    if (rawChartResponse) {
      if (Array.isArray(rawChartResponse.data)) return rawChartResponse.data;
      return pivotToRowData(rawChartResponse);
    }
    return [];
  }, [agGridRowData, streamedData, chartData, rawChartResponse]);

  const computedAgGridColumnDefs = useMemo(() => {
    if (agGridColumnDefs && agGridColumnDefs.length) return agGridColumnDefs;
    const first = computedAgGridRowData && computedAgGridRowData.length ? computedAgGridRowData[0] : {};
    const keys = Object.keys(first || {});
    if (!keys.length) return [];
    return keys.map((k) => ({
      headerName: k === '__row__' ? (rawChartResponse?.rows?.[0] || 'Row') : k,
      field: k,
      sortable: true,
      filter: true,
      resizable: true,
    }));
  }, [agGridColumnDefs, computedAgGridRowData, rawChartResponse]);

  return (
    <DndContext
      sensors={isViewOnly ? undefined : sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <DragOverlay>{activeId ? getActiveDraggable() : null}</DragOverlay>
      {view === 'dashboard' ? (
        <DashboardView
          charts={savedCharts}
          threads={threads}
          onNavigateToFormulator={() => setView('formulator')}
          dashboardCharts={dashboardCharts}
          onRemoveChart={onRemoveChartFromDashboard}
          onMaximizeChart={onMaximizeChart}
          onDeleteSavedChart={onDeleteSavedChart}
        />
      ) : (
        <div
          className={`flex flex-col bg-background text-sm overflow-hidden ${
            embedded ? 'h-full min-h-0' : isWorkflowPath ? 'h-[84vh]' : 'h-full'
          }`}
        >
          {!isWorkflowPath && (
            <ChartFormulatorHeader
              flowId={flowId}
              onFlowIdChange={setFlowId}
              onLoadColumns={onLoadColumns}
              onSaveChart={onSaveChart}
              isLoading={isLoadingColumns}
              isSaving={isSavingChart}
              isEditMode={!!editChartId}
              isViewOnly={isViewOnly}
              editChartId={editChartId}
              onSwitchToCreateMode={onSwitchToCreateMode}
              disableWorkflowAutoLoad={!!analyticsStudioInit}
              embedded={embedded}
              onEmbeddedClose={onEmbeddedClose}
            />
          )}

          <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <div className="flex items-center justify-between border-b bg-background px-2 py-1">
              <ChartSelector
                onSelectChart={onSelectChart}
                selectedChartId={selectedChart?.uniqueId}
                isViewOnly={isViewOnly}
              />
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={18} minSize={14}>
                  {pathname.startsWith('/workflows') ? (
                    <UpstreamFieldsSidebar upstreamNodes={upstreamNodes} isViewOnly={isViewOnly} />
                  ) : (
                    <DataFieldsSidebar
                      sources={sources}
                      selectedSource={selectedSource}
                      onSourceChange={onSourceChange}
                      isLoading={isLoadingColumns}
                      isViewOnly={isViewOnly}
                    />
                  )}
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={23} minSize={15}>
                  {selectedChart && chartFormData && (
                    <>
                      <DrilldownBreadcrumb filters={drilldownFilters} levels={drilldownLevels} onNavigate={onNavigateDrilldown} />
                      <ChartConfigurator
                        chart={selectedChart}
                        threadName="Fields"
                        fields={currentFieldsForDragResolved}
                        config={chartConfig || emptyConfig}
                        
                        setConfig={setChartConfig}
                        onClear={onClearChart}
                        onSave={
                          workflowFooterCreateOnly
                            ? onGenerateChart
                            : chartIdForConfigurator
                              ? onUpdateChart
                              : onGenerateChart
                        }
                        onGenerateChart={
                          workflowFooterCreateOnly
                            ? undefined
                            : chartIdForConfigurator
                              ? onGenerateChart
                              : undefined
                        }
                        chartFormData={chartFormData}
                        isLoadingForm={isLoadingForm}
                        isLoadingChart={isLoadingChart}
                        initialFormValues={editFormValues}
                        flowId={flowId}
                        analyticsStudioInit={analyticsStudioInit}
                        selectedSource={selectedSource}
                        sources={sources}
                        isEditMode={!!chartIdForConfigurator}
                        footerEditMode={workflowFooterCreateOnly ? false : undefined}
                        isViewOnly={isViewOnly}
                        customizationOptions={customizationOptions}
                        onCustomizationChange={onCustomizationChange}
                        baseDrilldownColumns={drilldownLevels.flatMap((l) => l.drill_columns ?? [])}
                        onBaseDrilldownColumnsChange={onBaseDrilldownColumnsChange}
                        rawChartColumns={rawChartResponse?.columns}
                      />
                    </>
                  )}

                  
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={52} minSize={30}>
                  {isWorkflowPath || isTableOrPivot ? (
                    <div className="group relative h-full w-full p-1">
                      <ChartPreviewActionButtons
                        showChart={!!selectedChart && (chartData.length > 0 || !!rawChartResponse)}
                        isViewOnly={isViewOnly}
                        isDrilldownSupported={isDrilldownSupported}
                        isDrillThroughSupported={isDrillThroughSupported}
                        isDrilldownArmed={isDrilldownArmed}
                        isDrillThroughArmed={isDrillThroughArmed}
                        onArmDrilldown={onArmDrilldown}
                        onArmDrillThrough={onArmDrillThrough}
                        onExpand={() => setIsPreviewOpen(true)}
                        canDrilldownBack={canDrilldownBack}
                        onDrilldownBack={onDrilldownBack}
                        alwaysVisible
                        placement="overlay"
                        isBigNumberChart={isBigNumberChart}
                        chartTitle={chartTitle}
                        isTableOrPivotChart={isTableOrPivot}
                      />

                      {chartData.length > 0 || rawChartResponse ? (
                        // Render PivotChart when pivot is selected; use API response when available (forceMock=false)
                        (selectedChart && ((selectedChart as any).uniqueId === 'pivot' || (selectedChart as any).uniqueId === 'pivot_table' || String(selectedChart).toLowerCase().includes('pivot'))) ? (
                          <PivotChart
                            data={chartData}
                            rawResponse={rawChartResponse}
                            forceMock={false}
                            mockResponse={typeof window !== 'undefined' ? (window as any).__mockPivotResponse : undefined}
                            onRowExpand={onPivotRowExpand}
                            config={customizationOptions}
                          />
                        ) : (
                          <AmChart
                            chart={selectedChart!}
                            data={chartData}
                            config={chartConfig || emptyConfig}
                            onChartInteraction={onChartDrilldown}
                            rawResponse={rawChartResponse}
                            chartParams={editChartData?.params}
                            customizationOptions={customizationOptions}
                            previewMode={isBigNumberChart ? 'compact' : 'full'}
                          />
                        )
                      ) : isLoadingChart ? (
                        <ChartFormulatorPreviewSkeleton className="h-full" />
                      ) : (
                        <p className="text-muted-foreground">
                          Configure the form and click &quot;Create Chart&quot; to view your visualization.
                        </p>
                      )}
                    </div>
                  ) : (
                    <ResizablePanelGroup direction="vertical" className="h-full">
                      <ResizablePanel defaultSize={previewChartPanelSize} minSize={25}>
                        <div className="group relative h-full w-full p-1">
                          <ChartPreviewActionButtons
                            showChart={!!selectedChart && (chartData.length > 0 || !!rawChartResponse)}
                            isViewOnly={isViewOnly}
                            isDrilldownSupported={isDrilldownSupported}
                            isDrillThroughSupported={isDrillThroughSupported}
                            isDrilldownArmed={isDrilldownArmed}
                            isDrillThroughArmed={isDrillThroughArmed}
                            onArmDrilldown={onArmDrilldown}
                            onArmDrillThrough={onArmDrillThrough}
                            onExpand={() => setIsPreviewOpen(true)}
                            canDrilldownBack={canDrilldownBack}
                            onDrilldownBack={onDrilldownBack}
                            alwaysVisible
                            placement="overlay"
                            isBigNumberChart={isBigNumberChart}
                            chartTitle={chartTitle}
                            isTableOrPivotChart={isTableOrPivot}
                          />

                          {chartData.length > 0 || rawChartResponse ? (
                            (selectedChart && ((selectedChart as any).uniqueId === 'pivot' || (selectedChart as any).uniqueId === 'pivot_table' || String(selectedChart).toLowerCase().includes('pivot'))) ? (
                              <PivotChart
                                data={chartData}
                                rawResponse={rawChartResponse}
                                forceMock={false}
                                mockResponse={typeof window !== 'undefined' ? (window as any).__mockPivotResponse : undefined}
                                onRowExpand={onPivotRowExpand}
                                config={customizationOptions}
                              />
                            ) : (
                              <AmChart
                                chart={selectedChart!}
                                data={chartData}
                                config={chartConfig || emptyConfig}
                                onChartInteraction={onChartDrilldown}
                                rawResponse={rawChartResponse}
                                chartParams={editChartData?.params}
                                customizationOptions={customizationOptions}
                                previewMode={isBigNumberChart ? 'compact' : 'full'}
                              />
                            )
                          ) : isLoadingChart ? (
                            <ChartFormulatorPreviewSkeleton className="h-full" />
                          ) : (
                            <p className="text-muted-foreground">
                              Configure the form and click &quot;Create Chart&quot; to view your visualization.
                            </p>
                          )}
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      <ResizablePanel defaultSize={previewTablePanelSize} minSize={20}>
                        {isLoadingChart || isStreaming ? (
                          <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                            <ChartFormulatorTableSkeleton className="flex-1" />
                            {isStreaming && streamedData.length > 0 && (
                              <p className="shrink-0 text-center text-xs text-muted-foreground">
                                {streamedData.length} records loaded
                              </p>
                            )}
                          </div>
                        ) : (streamedData.length > 0 || chartData.length > 0 || rawChartResponse) &&
                          !(selectedChart && ((selectedChart as any).uniqueId === 'pivot' || (selectedChart as any).uniqueId === 'pivot_table' || String(selectedChart).toLowerCase().includes('pivot'))) ? (
                          <div className="h-full w-full dashboard-grid-container ag-theme-quartz bg-background text-foreground">
                            <AgGridReact
                              rowHeight={30}
                              headerHeight={30}
                              theme={agTheme}
                              rowData={computedAgGridRowData}
                              columnDefs={computedAgGridColumnDefs}
                              defaultColDef={{ sortable: true, filter: true, resizable: true }}
                              pagination={true}
                              paginationPageSize={20}
                              paginationPageSizeSelector={[10, 20, 50, 100]}
                            />
                          </div>
                        ) : (streamedData.length > 0 || chartData.length > 0 || rawChartResponse) &&
                          selectedChart && ((selectedChart as any).uniqueId === 'pivot' || (selectedChart as any).uniqueId === 'pivot_table' || String(selectedChart).toLowerCase().includes('pivot')) ? (
                          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                            <Table2 className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">
                              Pivot table is displayed in the chart area above.
                            </p>
                          </div>
                        ) : selectedSource ? (
                          <div className="flex h-full flex-col items-center justify-center p-4">
                            <Table2 className="h-16 w-16 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">Data Preview</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Source: {selectedSource}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{currentFields.length} columns available</p>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center p-4">
                            <Table2 className="h-16 w-16 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No Source Selected</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Load columns and select a source to start.
                            </p>
                          </div>
                        )}
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </main>

          <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete the thread &quot;
                  {threads.find((t: any) => t.id === threadToDelete)?.name}&quot;. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirmDeleteThread} className={buttonVariants({ variant: 'destructive' })}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={isSaveChartNameDialogOpen} onOpenChange={setIsSaveChartNameDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save Chart</AlertDialogTitle>
                <AlertDialogDescription>Enter a name for your chart to save it.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="save-chart-name">Chart Name</Label>
                <Input
                  id="save-chart-name"
                  value={chartNameToSave}
                  onChange={(e) => setChartNameToSave(e.target.value)}
                  placeholder="e.g., Sales by Region"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chartNameToSave.trim()) onConfirmSaveChartWithName();
                  }}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setIsSaveChartNameDialogOpen(false);
                    setChartNameToSave('');
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onConfirmSaveChartWithName}
                  disabled={!chartNameToSave.trim() || isSavingChart}
                >
                  {isSavingChart ? 'Saving...' : 'Save'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <Dialog open={!!maximizedChart} onOpenChange={onCloseMaximize}>
        {maximizedChart && maximizedChartThread && (
          <DialogContent className="z-[1300] flex h-3/4 max-w-6xl flex-col">
            <DialogHeader>
              <DialogTitle>
                <Input
                  value={editingChartName}
                  onChange={(e) => setEditingChartName(e.target.value)}
                  className="text-lg font-semibold"
                />
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 w-full">
              <AmChart
                key={maximizedChart.id}
                chart={maximizedChart.chartType}
                data={maximizedChartFilteredData}
                config={maximizedChart.config}
                onChartInteraction={() => {}}
                showLegend={isLegendVisible}
                rawResponse={rawChartResponse}
              />
            </div>
            <DialogFooter>
              <div className="mr-auto flex items-center space-x-2">
                <Switch
                  id="legend-toggle"
                  checked={isLegendVisible}
                  onCheckedChange={setIsLegendVisible}
                />
                <Label htmlFor="legend-toggle">Show Legend</Label>
              </div>
              <Button variant="outline" onClick={onCloseMaximize}>
                Cancel
              </Button>
              <Button onClick={onUpdateChartName}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent hideCloseButton className="z-[1300] flex h-[85vh] max-w-6xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>Chart Preview</DialogTitle>
              <ChartPreviewActionButtons
                showChart={!!selectedChart && previewChartReady}
                isViewOnly={isViewOnly}
                isDrilldownSupported={isDrilldownSupported}
                isDrillThroughSupported={isDrillThroughSupported}
                isDrilldownArmed={isDrilldownArmed}
                isDrillThroughArmed={isDrillThroughArmed}
                onArmDrilldown={onArmDrilldown}
                onArmDrillThrough={onArmDrillThrough}
                alwaysVisible
                hideExpand
                showMinimize
                onMinimize={() => setIsPreviewOpen(false)}
                isBigNumberChart={isBigNumberChart}
                chartTitle={chartTitle}
                isTableOrPivotChart={isTableOrPivot}
              />
            </div>
          </DialogHeader>
          {canDrilldownBack && onDrilldownBack && previewChartReady && (
            <ShadTooltip content="Back to previous view">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-16 left-4 z-20 h-7 w-7 rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-[0_2px_10px_rgba(15,23,42,0.14)] backdrop-blur-sm hover:bg-muted/70 hover:text-foreground"
                onClick={onDrilldownBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </ShadTooltip>
          )}
          <div className="group relative min-h-0 flex-1 w-full max-w-full overflow-hidden">
            

            {selectedChart && previewChartReady && (
              (selectedChart && ((selectedChart as any).uniqueId === 'pivot' || (selectedChart as any).uniqueId === 'pivot_table' || String(selectedChart).toLowerCase().includes('pivot'))) ? (
                <PivotChart
                  key={`expand-preview-${isPreviewOpen}-${(selectedChart as any)?.uniqueId ?? selectedChart?.name}-${chartData?.length ?? 0}`}
                  data={chartData}
                  rawResponse={rawChartResponse}
                  forceMock={false}
                  mockResponse={typeof window !== 'undefined' ? (window as any).__mockPivotResponse : undefined}
                  onRowExpand={onPivotRowExpand}
                  config={customizationOptions}
                />
              ) : (
                <AmChart
                  key={`expand-preview-${isPreviewOpen}-${(selectedChart as any)?.uniqueId ?? selectedChart?.name}-${chartData?.length ?? 0}`}
                  chart={selectedChart}
                  data={chartData}
                  config={chartConfig || emptyConfig}
                  onChartInteraction={onChartDrilldown}
                  showLegend={isLegendVisible}
                  rawResponse={rawChartResponse}
                  chartParams={editChartData?.params}
                  customizationOptions={customizationOptions}
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

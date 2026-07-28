import { Loader2, BarChart3, Eye, Sparkles, Wand2, Table2 } from "lucide-react";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AmChart } from "@/pages/charts/components/AmChart";
import {
  ChartDiagramIcon,
  type ChartType,
  type Config,
  type Field,
} from "@/pages/charts/components/ChartConfigurator";
import WizardChartConfigurator from "../WizardChartConfigurator";
import { PivotChart } from "@/pages/charts/components/charts/pivot";
import { DataFieldsSidebar } from "@/pages/charts/components/DataFieldsSidebar";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import type { AnalyticsStudioCreateChartState } from "../../types";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import {
  buildFieldsFromSemanticMappings,
  buildFieldsByParamKey,
  buildSemanticBindingFieldGroups,
  hasSemanticMappingsForBinding,
} from "../buildFormValuesFromSemanticMappings";
import { inferFieldType, validateChartFormBinding, getBindingSummary, suggestChartBindings } from "../chartFormUtils";
import type { ChartWizardSource } from "../types";
import { useChartFormDragDrop } from "../useChartFormDragDrop";
import { useWizardChartPreview } from "../useWizardChartPreview";
import WizardChartPreviewGrid from "../WizardChartPreviewGrid";
import { wizardPreviewHasTableData } from "../buildWizardPreviewGridData";

interface DataBindingStepProps {
  routeState: AnalyticsStudioCreateChartState;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  onSelectSource: (sourceName: string) => void;
  selectedChartTypeId?: string;
  selectedChartName?: string;
  chartFormData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string } | null;
  isLoadingForm: boolean;
  formValues: Record<string, unknown>;
  bindingSeedValues: Record<string, unknown>;
  bindingRestoreKey: number;
  bindingSessionKey: number;
  onFormValuesChange: (values: Record<string, unknown>) => void;
  isViewOnly?: boolean;
  analyticsStudioInit?: AnalyticsStudioChartInit | null;
  payloadSource?: string | null;
}

const emptyConfig: Config = {
  x: null,
  y: null,
  operator: null,
  color: null,
  column: null,
  row: null,
};

const DATA_BINDING_RESIZE_HANDLE_CLASS = "data-binding-resize-handle";
const DATA_BINDING_PREVIEW_VERTICAL_HANDLE_CLASS = "data-binding-preview-vertical-handle";

function PreviewSkeleton() {
  return (
    <div className="flex h-full min-h-[200px] flex-col gap-3 rounded-lg border border-border/50 bg-muted/10 p-4">
      <div className="flex items-end justify-center gap-2 pt-6">
        {[40, 64, 48, 72, 56, 80, 44].map((height, index) => (
          <div
            key={index}
            className="w-6 animate-pulse rounded-t-md bg-gradient-to-t from-primary/20 to-primary/5"
            style={{ height }}
          />
        ))}
      </div>
      <div className="mx-auto h-2 w-2/3 animate-pulse rounded-full bg-muted/60" />
      <p className="text-center text-xs text-muted-foreground">Building your chart preview…</p>
    </div>
  );
}

export default function DataBindingStep({
  routeState,
  sources,
  selectedSourceName,
  onSelectSource,
  selectedChartTypeId,
  selectedChartName,
  chartFormData,
  isLoadingForm,
  formValues,
  bindingSeedValues,
  bindingRestoreKey,
  bindingSessionKey,
  onFormValuesChange,
  isViewOnly = false,
  analyticsStudioInit,
  payloadSource,
}: DataBindingStepProps) {
  const [chartConfig, setChartConfig] = useState<Config | null>(emptyConfig);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const bindingSeedSignature = useMemo(
    () => JSON.stringify(bindingSeedValues),
    [bindingSeedValues],
  );

  const initialFormValues = useMemo(() => {
    const seed =
      Object.keys(bindingSeedValues).length > 0 ? bindingSeedValues : formValues;
    return { ...seed };
  }, [bindingSeedSignature, bindingRestoreKey, bindingSessionKey]);

  const useSemanticMappings = hasSemanticMappingsForBinding(routeState);

  const sidebarSources = useMemo(
    () => sources.map((source) => ({ name: source.name, columns: source.columns })),
    [sources],
  );

  const fields = useMemo<Field[]>(() => {
    if (useSemanticMappings && routeState.semanticMappings) {
      return buildFieldsFromSemanticMappings(routeState.semanticMappings);
    }

    const activeSource =
      sources.find((source) => source.name === selectedSourceName) ?? sources[0];
    return (activeSource?.columns || []).map((column) => ({
      name: column,
      type: inferFieldType(column),
    }));
  }, [routeState.semanticMappings, selectedSourceName, sources, useSemanticMappings]);

  const fieldsByParamKey = useMemo<Record<string, Field[]> | undefined>(() => {
    if (!useSemanticMappings || !routeState.semanticMappings) return undefined;
    return buildFieldsByParamKey(buildSemanticBindingFieldGroups(routeState.semanticMappings));
  }, [routeState.semanticMappings, useSemanticMappings]);

  const selectedChart = useMemo<ChartType & { uniqueId: string } | null>(() => {
    if (!selectedChartTypeId) return null;
    const typeStr = selectedChartTypeId;
    return {
      name: selectedChartName || selectedChartTypeId,
      icon: (props: ComponentProps<typeof ChartDiagramIcon>) => (
        <ChartDiagramIcon type={typeStr} {...props} />
      ),
      uniqueId: selectedChartTypeId,
    };
  }, [selectedChartName, selectedChartTypeId]);

  const { activeId, handleDragStart, handleDragEnd, getActiveDraggable } = useChartFormDragDrop({
    chartFormData,
    fields,
  });

  const previewFormValues = useMemo(() => {
    if (validateChartFormBinding(formValues, chartFormData, selectedChartTypeId)) {
      return { ...formValues };
    }
    if (validateChartFormBinding(bindingSeedValues, chartFormData, selectedChartTypeId)) {
      return { ...bindingSeedValues };
    }
    return { ...formValues };
  }, [bindingSeedSignature, chartFormData, formValues, selectedChartTypeId]);

  const canPreview = useMemo(
    () => validateChartFormBinding(previewFormValues, chartFormData, selectedChartTypeId),
    [chartFormData, previewFormValues, selectedChartTypeId],
  );

  const { chartData, rawChartResponse, isLoading, error, isPivotChart } = useWizardChartPreview({
    enabled: canPreview,
    routeState,
    sources,
    selectedSourceName,
    selectedChartTypeId,
    selectedChartName,
    chartFormData,
    formValues: previewFormValues,
    analyticsStudioInit,
    payloadSource,
  });

  const hasPreview = chartData.length > 0 || !!rawChartResponse;
  const hasPreviewTableData = useMemo(
    () => wizardPreviewHasTableData({ chartData, rawResponse: rawChartResponse }),
    [chartData, rawChartResponse],
  );

  const bindingSummary = useMemo(
    () => getBindingSummary(previewFormValues),
    [previewFormValues],
  );

  const bindingProgress = useMemo(() => {
    const formParams = chartFormData?.parameters ?? [];
    const needsDimension = formParams.some(
      (param) => param.key === "dimensions" || param.key === "x-axis" || param.key === "X-axis",
    );
    const needsMetric = formParams.some((param) =>
      ["metric", "metrics", "mtric"].includes(param.key),
    );
    const steps: Array<{ label: string; done: boolean }> = [];
    if (needsDimension) {
      steps.push({ label: "Dimension", done: bindingSummary.dimensions.length > 0 });
    }
    if (needsMetric) {
      steps.push({ label: "Metric", done: bindingSummary.metrics.length > 0 });
    }
    const completed = steps.filter((step) => step.done).length;
    return { steps, completed, total: steps.length };
  }, [bindingSummary.dimensions.length, bindingSummary.metrics.length, chartFormData?.parameters]);

  const previewPointCount = useMemo(() => {
    if (Array.isArray(chartData) && chartData.length > 0) return chartData.length;
    const rows = rawChartResponse?.data;
    if (Array.isArray(rows)) return rows.length;
    return null;
  }, [chartData, rawChartResponse]);

  const boundFieldNames = useMemo(
    () => [...bindingSummary.dimensions, ...bindingSummary.metrics],
    [bindingSummary.dimensions, bindingSummary.metrics],
  );

  const bindingComplete =
    bindingProgress.total > 0 && bindingProgress.completed === bindingProgress.total;

  const coachMessage = useMemo(() => {
    if (isViewOnly) return "Review the bound fields and live preview for this chart.";
    const needsDimension = bindingProgress.steps.find((step) => step.label === "Dimension");
    const needsMetric = bindingProgress.steps.find((step) => step.label === "Metric");
    if (needsDimension && !needsDimension.done) {
      return "Start by dragging a text or date column into Dimensions — this becomes your chart categories.";
    }
    if (needsMetric && !needsMetric.done) {
      return "Now add a numeric column to Metric — this drives slice sizes, bar heights, or values.";
    }
    if (canPreview && hasPreview && !isLoading) {
      return "Bindings look great. Continue to Visualize to fine-tune colors, labels, and layout.";
    }
    if (canPreview && isLoading) {
      return "Hang tight — we're generating a live preview from your data.";
    }
    return "Complete the required slots to unlock the live chart preview on the right.";
  }, [bindingProgress.steps, canPreview, hasPreview, isLoading, isViewOnly]);

  const handleAutoSuggest = useCallback(() => {
    if (isViewOnly) return;
    const suggestions = suggestChartBindings(fields, chartFormData);
    const keys = Object.keys(suggestions);
    if (keys.length === 0) {
      toast.info("No suitable column suggestions found for this chart.");
      return;
    }

    const updater = (window as unknown as { __chartFormUpdate?: (key: string, value: unknown) => void })
      .__chartFormUpdate;

    if (updater) {
      keys.forEach((key) => {
        const value = suggestions[key];
        if (Array.isArray(value)) {
          value.forEach((field) => updater(key, field));
        } else if (value) {
          updater(key, value);
        }
      });
      toast.success("Suggested bindings applied — tweak them anytime.");
      return;
    }

    onFormValuesChange({ ...formValues, ...suggestions });
    toast.success("Suggested bindings applied — tweak them anytime.");
  }, [chartFormData, fields, formValues, isViewOnly, onFormValuesChange]);

  const renderPreviewChart = (className?: string) => {
    if (!selectedChart) return null;
    if (isPivotChart) {
      return (
        <div className={cn("h-full w-full", className)}>
          <PivotChart data={chartData} rawResponse={rawChartResponse} forceMock={false} />
        </div>
      );
    }
    return (
      <div className={cn("h-full w-full", className)}>
        <AmChart
          chart={selectedChart}
          data={chartData}
          config={chartConfig || emptyConfig}
          rawResponse={rawChartResponse as Parameters<typeof AmChart>[0]["rawResponse"]}
          showLegend={false}
        />
      </div>
    );
  };

  if (isLoadingForm) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10">
        <DatasetStepLoading message="Loading chart form..." size="lg" />
      </div>
    );
  }

  if (!selectedChart || !chartFormData) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 p-4 text-center">
        <p className="text-sm text-muted-foreground">Select a chart type to configure data binding.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={isViewOnly ? undefined : sensors}
      onDragStart={isViewOnly ? undefined : handleDragStart}
      onDragEnd={isViewOnly ? undefined : handleDragEnd}
    >
      <DragOverlay>{activeId ? getActiveDraggable() : null}</DragOverlay>
      <div className="data-binding-step flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <style>{`
          .data-binding-step .${DATA_BINDING_RESIZE_HANDLE_CLASS} {
            width: 3px;
            background-color: hsl(var(--border) / 0.55);
            transition: background-color 150ms ease;
          }

          .data-binding-step .${DATA_BINDING_RESIZE_HANDLE_CLASS}:hover {
            background-color: hsl(var(--border) / 0.85);
          }

          .data-binding-step .${DATA_BINDING_PREVIEW_VERTICAL_HANDLE_CLASS} {
            height: 3px;
            background-color: hsl(var(--border) / 0.55);
            transition: background-color 150ms ease;
          }

          .data-binding-step .${DATA_BINDING_PREVIEW_VERTICAL_HANDLE_CLASS}:hover {
            background-color: hsl(var(--border) / 0.85);
          }
        `}</style>
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 flex-1">
          {!useSemanticMappings ? (
            <>
              <ResizablePanel defaultSize={18} minSize={14} maxSize={24}>
                <div className="h-full min-h-0 min-w-0 overflow-hidden border-r border-border/40 bg-background">
                  <DataFieldsSidebar
                    sources={sidebarSources}
                    selectedSource={selectedSourceName ?? sources[0]?.name ?? null}
                    onSourceChange={onSelectSource}
                    isViewOnly={isViewOnly}
                    variant="wizard"
                    boundFieldNames={boundFieldNames}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className={DATA_BINDING_RESIZE_HANDLE_CLASS} />
            </>
          ) : null}

          <ResizablePanel
            defaultSize={useSemanticMappings ? 45 : 30}
            minSize={24}
            maxSize={useSemanticMappings ? 60 : 40}
          >
            <div className="h-full min-h-0 min-w-0 overflow-hidden bg-muted/50 px-2 py-2 mt-1">
              <WizardChartConfigurator
                  key={`${selectedChartTypeId}-${bindingSessionKey}`}
                  chart={selectedChart}
                  threadName={selectedSourceName || sources[0]?.name || "Data"}
                  fields={fields}
                  fieldsByParamKey={fieldsByParamKey}
                  config={chartConfig || emptyConfig}
                  setConfig={setChartConfig}
                  onClear={() => setChartConfig(emptyConfig)}
                  onSave={() => undefined}
                  chartFormData={chartFormData}
                  initialFormValues={initialFormValues}
                  isLoadingForm={false}
                  flowId={routeState.flowId ?? ""}
                  selectedSource={selectedSourceName ?? sources[0]?.name ?? null}
                  sources={sidebarSources}
                  onFormValuesChange={onFormValuesChange}
                  isViewOnly={isViewOnly}
                />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className={DATA_BINDING_RESIZE_HANDLE_CLASS} />

          <ResizablePanel defaultSize={57} minSize={34} maxSize={62}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/40 bg-muted/50 p-2 mt-1">
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-1 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Eye className="size-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-foreground tracking-tight">Live preview</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {selectedChartName || selectedChartTypeId}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canPreview && hasPreview && !isLoading ? (
                      <Badge
                        variant="outline"
                        className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                      >
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70 opacity-75" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                        </span>
                        Live
                      </Badge>
                    ) : null}
                    {previewPointCount != null && previewPointCount > 0 ? (
                      <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-medium">
                        {previewPointCount} points
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {(bindingSummary.dimensions.length > 0 || bindingSummary.metrics.length > 0) && (
                  <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border/40 px-1 py-2">
                    {bindingSummary.dimensions.map((name) => (
                      <Badge
                        key={`dim-${name}`}
                        variant="outline"
                        className="max-w-[140px] truncate rounded-md border-sky-500/25 bg-sky-500/5 px-2 py-0 text-[10px] font-medium text-sky-800 dark:text-sky-300"
                      >
                        <BarChart3 className="mr-1 inline size-3 shrink-0" />
                        {name}
                      </Badge>
                    ))}
                    {bindingSummary.metrics.map((name) => (
                      <Badge
                        key={`metric-${name}`}
                        variant="outline"
                        className="max-w-[140px] truncate rounded-md border-violet-500/25 bg-violet-500/5 px-2 py-0 text-[10px] font-medium text-violet-800 dark:text-violet-300"
                      >
                        <Sparkles className="mr-1 inline size-3 shrink-0" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="relative min-h-0 flex-1 pt-0 bg-background">
                  {!canPreview ? (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 text-center">
                      <div className="relative">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
                          <BarChart3 className="size-6 text-primary/70" />
                        </div>
                        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-primary ring-1 ring-border">
                          ?
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Preview waiting for data</p>
                        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                          Add a dimension and metric, or use Auto-suggest to get started instantly.
                        </p>
                      </div>
                      {!isViewOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-full text-xs"
                          onClick={handleAutoSuggest}
                        >
                          <Wand2 className="size-3.5" />
                          Try auto-suggest
                        </Button>
                      ) : null}
                    </div>
                  ) : isLoading ? (
                    <PreviewSkeleton />
                  ) : error ? (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 text-center">
                      <p className="text-xs font-medium text-destructive">Preview unavailable</p>
                      <p className="text-[11px] leading-snug text-destructive/80">{error}</p>
                    </div>
                  ) : hasPreview ? (
                    <ResizablePanelGroup
                      direction="vertical"
                      className={cn(
                        "h-full min-h-[200px] overflow-hidden",
                        bindingComplete && "rounded-lg ring-2 ring-emerald-500/20",
                      )}
                    >
                      <ResizablePanel defaultSize={60} minSize={45} maxSize={85}>
                        <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border/50 bg-gradient-to-b from-muted/20 to-background shadow-inner">
                          {renderPreviewChart("h-full w-full")}
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle className={DATA_BINDING_PREVIEW_VERTICAL_HANDLE_CLASS} />

                      <ResizablePanel defaultSize={40} minSize={15} maxSize={55}>
                        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm">
                          <div className="flex shrink-0 items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
                            <Table2 className="size-3 shrink-0 text-primary" />
                            <p className="text-[10px] font-bold uppercase tracking-tight text-foreground">
                              Chart data
                            </p>
                          </div>
                          <div className="min-h-0 flex-1 overflow-hidden">
                            {hasPreviewTableData ? (
                              <WizardChartPreviewGrid
                                chartData={chartData}
                                rawResponse={rawChartResponse}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">
                                No tabular data for this chart
                              </div>
                            )}
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-border/50 bg-muted/10">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        
      </div>

      <Dialog open={previewExpanded} onOpenChange={setPreviewExpanded}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Eye className="size-4 text-primary" />
              {selectedChartName || selectedChartTypeId} — full preview
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-[60vh] flex-1 bg-gradient-to-b from-muted/20 to-background p-4">
            {hasPreview ? renderPreviewChart("h-full min-h-[55vh] w-full") : <PreviewSkeleton />}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

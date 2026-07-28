import { Loader2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AmChart } from "@/pages/charts/components/AmChart";
import {
  ChartDiagramIcon,
  type ChartType,
  type Config,
  type Field,
} from "@/pages/charts/components/ChartConfigurator";
import WizardCustomizeConfigurator from "../WizardCustomizeConfigurator";
import WizardVisualisePreviewCard from "../WizardVisualisePreviewCard";
import { PivotChart } from "@/pages/charts/components/charts/pivot";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import {
  wizardPreviewHasTableData,
  buildWizardPreviewRows,
} from "../buildWizardPreviewGridData";
import type { DashboardChartViewMode } from "@/pages/Dashboards/components/dashboardChartTableData";
import type { AnalyticsStudioCreateChartState } from "../../types";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import { inferFieldType } from "../chartFormUtils";
import type { ChartWizardSource } from "../types";
import { useWizardChartPreview } from "../useWizardChartPreview";

interface VisualiseStepProps {
  routeState: AnalyticsStudioCreateChartState;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  selectedChartTypeId?: string;
  selectedChartName?: string;
  chartFormData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string } | null;
  formValues: Record<string, unknown>;
  customizationOptions?: ChartCustomizationOptions | null;
  onCustomizationChange: (options: ChartCustomizationOptions) => void;
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

const VISUALISE_RESIZE_HANDLE_CLASS = "visualise-resize-handle";

export default function VisualiseStep({
  routeState,
  sources,
  selectedSourceName,
  selectedChartTypeId,
  selectedChartName,
  chartFormData,
  formValues,
  customizationOptions,
  onCustomizationChange,
  isViewOnly = false,
  analyticsStudioInit: analyticsStudioInitOverride,
  payloadSource,
}: VisualiseStepProps) {
  const [chartConfig, setChartConfig] = useState<Config>(emptyConfig);
  const [previewViewMode, setPreviewViewMode] = useState<DashboardChartViewMode>("chart");
  const [customizeInitialFormValues] = useState(() => ({ ...formValues }));
  const noop = useCallback(() => undefined, []);

  const isTableChartType = useMemo(() => {
    const chartType = (selectedChartTypeId || "").toLowerCase();
    return chartType.includes("table") && !chartType.includes("pivot");
  }, [selectedChartTypeId]);

  useEffect(() => {
    setPreviewViewMode(isTableChartType ? "table" : "chart");
  }, [isTableChartType, selectedChartTypeId]);

  const { chartData, rawChartResponse, isLoading, error, analyticsStudioInit, isPivotChart } =
    useWizardChartPreview({
      enabled: true,
      routeState,
      sources,
      selectedSourceName,
      selectedChartTypeId,
      selectedChartName,
      chartFormData,
      formValues,
      analyticsStudioInit: analyticsStudioInitOverride,
      payloadSource,
    });

  const fields = useMemo<Field[]>(() => {
    const activeSource =
      sources.find((source) => source.name === selectedSourceName) ?? sources[0];
    return (activeSource?.columns || []).map((column) => ({
      name: column,
      type: inferFieldType(column),
    }));
  }, [selectedSourceName, sources]);

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

  const sidebarSources = useMemo(
    () => sources.map((source) => ({ name: source.name, columns: source.columns })),
    [sources],
  );

  const hasPreview = chartData.length > 0 || !!rawChartResponse;

  const tableRows = useMemo(
    () => buildWizardPreviewRows({ chartData, rawResponse: rawChartResponse }),
    [chartData, rawChartResponse],
  );

  const showTableToggle = wizardPreviewHasTableData({ chartData, rawResponse: rawChartResponse });

  const previewPointCount = useMemo(() => {
    if (tableRows.length > 0) return tableRows.length;
    if (Array.isArray(chartData) && chartData.length > 0) return chartData.length;
    return null;
  }, [chartData.length, tableRows.length]);

  const chartPreviewContent = useMemo(() => {
    if (isPivotChart) {
      return (
        <PivotChart
          data={chartData}
          rawResponse={rawChartResponse}
          chartName={selectedChartName}
          forceMock={false}
        />
      );
    }

    return (
      <AmChart
        chart={selectedChart!}
        data={chartData}
        config={chartConfig}
        rawResponse={rawChartResponse as Parameters<typeof AmChart>[0]["rawResponse"]}
        customizationOptions={customizationOptions}
      />
    );
  }, [
    chartConfig,
    chartData,
    customizationOptions,
    isPivotChart,
    rawChartResponse,
    selectedChart,
    selectedChartName,
  ]);

  if (!selectedChart || !chartFormData) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 p-4 text-center">
        <p className="text-sm text-muted-foreground">Complete data binding to preview your chart.</p>
      </div>
    );
  }

  return (
    <div className="visualise-step flex min-h-0 flex-1 overflow-hidden bg-muted/50">
      <style>{`
        .visualise-step .${VISUALISE_RESIZE_HANDLE_CLASS} {
          width: 3px;
          background-color: hsl(var(--border) / 0.55);
          transition: background-color 150ms ease;
        }

        .visualise-step .${VISUALISE_RESIZE_HANDLE_CLASS}:hover {
          background-color: hsl(var(--border) / 0.85);
        }

        .visualise-step .visualise-customize-panel [data-wizard-customize] > div > div:first-child {
          display: none;
        }
      `}</style>

      <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 flex-1">
        <ResizablePanel defaultSize={64} minSize={42}>
          <WizardVisualisePreviewCard
            title={selectedChartName || "Chart preview"}
            subtitle={selectedSourceName || sources[0]?.name}
            rowCount={previewPointCount}
            viewMode={previewViewMode}
            onViewModeChange={setPreviewViewMode}
            showTableToggle={showTableToggle}
            isLoading={isLoading}
            error={error}
            hasPreview={hasPreview}
            chartData={chartData}
            rawResponse={rawChartResponse}
            loadingContent={<DatasetStepLoading message="Generating chart preview..." size="lg" />}
            emptyContent={
              <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>Preparing chart preview...</p>
              </div>
            }
            chartContent={chartPreviewContent}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className={VISUALISE_RESIZE_HANDLE_CLASS} />

        <ResizablePanel defaultSize={36} minSize={26} maxSize={48}>
          <div className="visualise-customize-panel flex h-full min-h-0 flex-col overflow-hidden px-1 py-1">
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
              <div className="flex shrink-0 items-center gap-2.5 border-b border-border/40 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/15">
                  <Wand2 className="size-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-tight text-foreground">Chart options</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Colors, labels, legend &amp; formatting
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <WizardCustomizeConfigurator
                  key={`${selectedChartTypeId}-customize`}
                  chart={selectedChart}
                  threadName={selectedSourceName || sources[0]?.name || "Data"}
                  fields={fields}
                  config={chartConfig}
                  setConfig={setChartConfig}
                  onClear={noop}
                  onSave={noop}
                  chartFormData={chartFormData}
                  initialFormValues={customizeInitialFormValues}
                  flowId={routeState.flowId ?? ""}
                  analyticsStudioInit={analyticsStudioInit}
                  selectedSource={selectedSourceName ?? sources[0]?.name ?? null}
                  sources={sidebarSources}
                  customizationOptions={customizationOptions ?? undefined}
                  onCustomizationChange={onCustomizationChange}
                  isViewOnly={isViewOnly}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

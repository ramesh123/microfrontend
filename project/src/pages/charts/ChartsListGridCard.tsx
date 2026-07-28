import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, Edit, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AmChart } from "@/pages/charts/components/AmChart";
import { PivotChart } from "@/pages/charts/components/charts/pivot";
import { getChartPreviewIcon } from "@/pages/charts/components/ChartPreviewIcons";
import { getChartCustomizationFromChart } from "@/pages/charts/chartCustomizationsPayload";
import { CHART_TYPE_PREVIEWS } from "@/pages/analyticsstudio/createChart/chartTypeCatalog";
import {
  isPivotVisualization,
  isTableVisualization,
  loadChartsListPreview,
  resolveChartVisualizationName,
} from "@/pages/charts/chartsListPreview";

interface ChartsListGridCardProps {
  chart: Record<string, unknown>;
  chartId: string;
  chartName: string;
  description?: string;
  createdUser?: string;
  updatedAt?: string;
  analyticsStudio?: boolean;
  enableLivePreview?: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name?: string) => void;
}

const emptyConfig = {
  x: null,
  y: null,
  operator: null,
  color: null,
  column: null,
  row: null,
};

function resolvePreviewKey(chart: Record<string, unknown>): string {
  return resolveChartVisualizationName(chart).replace(/\s+/g, "_");
}

function StaticChartPreview({ previewKey, label }: { previewKey: string; label: string }) {
  const PreviewRenderer = CHART_TYPE_PREVIEWS[previewKey];
  const PreviewIcon = getChartPreviewIcon(previewKey, label);

  if (PreviewRenderer) {
    return <div className="text-primary">{PreviewRenderer({})}</div>;
  }

  if (PreviewIcon) {
    return <PreviewIcon className="size-10 shrink-0 text-primary" />;
  }

  return (
    <span className="text-[10px] font-semibold uppercase text-primary">
      {label.slice(0, 2)}
    </span>
  );
}

export default function ChartsListGridCard({
  chart,
  chartId,
  chartName,
  description,
  createdUser,
  updatedAt,
  analyticsStudio,
  enableLivePreview = false,
  onView,
  onEdit,
  onDelete,
}: ChartsListGridCardProps) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [chartData, setChartData] = useState<
    Array<{ category: string; value: number; originalData: Record<string, unknown> }>
  >([]);
  const [rawChartResponse, setRawChartResponse] = useState<Record<string, unknown> | null>(null);
  const [visualizationName, setVisualizationName] = useState(resolvePreviewKey(chart));

  const previewKey = useMemo(() => resolvePreviewKey(chart), [chart]);
  const chartTypeLabel = String(
    chart.charttype || chart.chart_type || chart.visualization_name || "Chart",
  );
  const cardDescription =
    description && description !== "N/A"
      ? description
      : String(chartTypeLabel).replace(/_/g, " ");

  useEffect(() => {
    if (!enableLivePreview) return;

    let cancelled = false;
    setIsLoadingPreview(true);
    setPreviewError(false);

    void loadChartsListPreview(chartId, analyticsStudio)
      .then((result) => {
        if (cancelled) return;
        setChartData(result.chartData);
        setRawChartResponse(result.rawChartResponse);
        setVisualizationName(result.visualizationName);
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analyticsStudio, chartId, enableLivePreview]);

  const selectedChart = useMemo(
    () => ({
      name: chartName,
      uniqueId: visualizationName,
      icon: () => null,
    }),
    [chartName, visualizationName],
  );

  const customizationOptions = useMemo(
    () => getChartCustomizationFromChart(chart as Parameters<typeof getChartCustomizationFromChart>[0]),
    [chart],
  );

  const hasLivePreview =
    enableLivePreview &&
    !previewError &&
    !isLoadingPreview &&
    (chartData.length > 0 || !!rawChartResponse);

  const previewContent = (() => {
    if (enableLivePreview && isLoadingPreview) {
      return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
    }

    if (hasLivePreview) {
      if (isPivotVisualization(visualizationName)) {
        return (
          <div className="h-full w-full min-h-0">
            <PivotChart
              data={chartData}
              rawResponse={rawChartResponse}
              chartName={chartName}
              forceMock={false}
              config={customizationOptions as any}
            />
          </div>
        );
      }

      if (isTableVisualization(visualizationName)) {
        return (
          <div className="flex h-full w-full items-center justify-center">
            <StaticChartPreview previewKey={previewKey} label={chartTypeLabel} />
          </div>
        );
      }

      return (
        <div className="pointer-events-none h-full min-h-0 w-full">
          <AmChart
            chart={selectedChart}
            data={chartData}
            config={emptyConfig}
            rawResponse={rawChartResponse as Parameters<typeof AmChart>[0]["rawResponse"]}
            customizationOptions={customizationOptions}
            useSavedCustomizationOnly
            showLegend={false}
          />
        </div>
      );
    }

    return <StaticChartPreview previewKey={previewKey} label={chartTypeLabel} />;
  })();

  return (
    <motion.div
      variants={{
        hidden: { y: 16, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 14 } },
      }}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      className="h-full"
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-lg border bg-background text-left shadow-sm transition-all",
          "hover:border-primary/40 hover:shadow-md",
        )}
      >
        <div className="relative flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-2 sm:h-32">
          {previewContent}
        </div>

        <div className="flex flex-1 flex-col px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold leading-tight text-foreground">
                {chartName}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {cardDescription}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1400]">
                <DropdownMenuItem onClick={() => onView(chartId)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(chartId)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(chartId, chartName)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{createdUser}</span>
            <span className="shrink-0">{updatedAt}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

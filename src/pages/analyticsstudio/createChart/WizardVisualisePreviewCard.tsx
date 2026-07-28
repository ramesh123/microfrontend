import { BarChart3, Eye, Table2 } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardChartViewMode } from "@/pages/Dashboards/components/dashboardChartTableData";
import WizardChartPreviewGrid from "./WizardChartPreviewGrid";
import {
  buildWizardPreviewRows,
  wizardPreviewHasTableData,
  type WizardPreviewGridInput,
} from "./buildWizardPreviewGridData";

interface WizardVisualisePreviewCardProps extends WizardPreviewGridInput {
  title: string;
  subtitle?: string;
  rowCount?: number | null;
  viewMode: DashboardChartViewMode;
  onViewModeChange: (mode: DashboardChartViewMode) => void;
  showTableToggle?: boolean;
  isLoading?: boolean;
  error?: string | null;
  hasPreview?: boolean;
  chartContent: ReactNode;
  loadingContent?: ReactNode;
  emptyContent?: ReactNode;
}

const viewToggleClass =
  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: DashboardChartViewMode;
  onViewModeChange: (mode: DashboardChartViewMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border/50 bg-muted/40 p-0.5"
      role="group"
      aria-label="Preview view"
    >
      <button
        type="button"
        aria-pressed={viewMode === "chart"}
        className={cn(
          viewToggleClass,
          viewMode === "chart"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onViewModeChange("chart")}
      >
        <BarChart3 className="size-3 shrink-0" aria-hidden />
        Chart
      </button>
      <button
        type="button"
        aria-pressed={viewMode === "table"}
        className={cn(
          viewToggleClass,
          viewMode === "table"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onViewModeChange("table")}
      >
        <Table2 className="size-3 shrink-0" aria-hidden />
        Table
      </button>
    </div>
  );
}

export default function WizardVisualisePreviewCard({
  title,
  subtitle,
  rowCount,
  viewMode,
  onViewModeChange,
  showTableToggle = true,
  isLoading = false,
  error = null,
  hasPreview = false,
  chartContent,
  chartData,
  rawResponse,
  loadingContent,
  emptyContent,
}: WizardVisualisePreviewCardProps) {
  const previewRows = useMemo(
    () => buildWizardPreviewRows({ chartData, rawResponse }),
    [chartData, rawResponse],
  );
  const showToggle = showTableToggle && wizardPreviewHasTableData({ chartData, rawResponse });
  const displayRowCount = rowCount ?? previewRows.length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-1 py-1">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
              <Eye className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-tight text-foreground">Chart preview</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {title}
                {subtitle ? ` · ${subtitle}` : ""}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasPreview && !isLoading && !error ? (
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
            {displayRowCount > 0 ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-medium">
                {displayRowCount.toLocaleString()} rows
              </Badge>
            ) : null}
            {showToggle ? (
              <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 p-3">
          <div
            className={cn(
              "relative flex h-full min-h-[360px] flex-1 items-stretch justify-center overflow-hidden rounded-lg border border-border/50 bg-gradient-to-b from-muted/15 to-background shadow-inner",
              hasPreview && !isLoading && !error && "ring-1 ring-border/30",
            )}
          >
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center p-8">
                {loadingContent ?? (
                  <p className="text-sm text-muted-foreground">Generating chart preview...</p>
                )}
              </div>
            ) : error ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-medium text-destructive">Preview unavailable</p>
                <p className="max-w-sm text-xs leading-relaxed text-destructive/80">{error}</p>
              </div>
            ) : !hasPreview ? (
              <div className="flex h-full w-full items-center justify-center p-8">
                {emptyContent ?? (
                  <p className="text-sm text-muted-foreground">Preparing chart preview...</p>
                )}
              </div>
            ) : viewMode === "table" ? (
              <div className="h-full min-h-0 w-full bg-background">
                <WizardChartPreviewGrid chartData={chartData} rawResponse={rawResponse} />
              </div>
            ) : (
              <div className="h-full min-h-0 w-full p-1">{chartContent}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

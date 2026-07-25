import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BarChart3,
  ChevronsUpDown,
  FileCode2,
  Info,
  Layers2,
  Loader2,
  Maximize2,
  MousePointerClick,
  Pencil,
  Table2,
  Trash2,
} from "lucide-react";
import AIimage from "@/assets/images/ai.png";
import BaseModal from "@/modals/baseModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ChartDetail, type DashboardCardTab, isDataQualityChartDetail } from "./chartTypes";
import { Am5MiniChart } from "./Am5MiniChart";
import { ChartDataTable } from "./ChartDataTable";
import {
  DqTableHeatmap,
  chartDetailUsesDataTable,
  chartDetailUsesTableHeatmap,
  chartPayloadDisplayColumns,
} from "./DqTableHeatmap";
import { DataTrustScorecardPanel, chartDetailUsesDataTrustScorecard } from "./DataTrustScorecard";
import {
  ValidationRuleFailuresPanel,
  chartDetailUsesValidationRuleFailures,
} from "./ValidationRuleFailuresPanel";
import { ChartDetailInfoTabContent } from "./ChartDetailInfoTab";
import { CorrelationHeatmapScaleLegend } from "./am5MiniChartCorrelationHeatmap";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  type ChartActionsBreadcrumbItem,
  type ChartActionsFilterField,
  type ChartActionsResponse,
  type ChartDrillDownBody,
  type ChartDrilldownAction,
  type PostChartFilterBody,
} from "@/controllers/API/agenticApi";
import { BsFiletypeSql } from "react-icons/bs";

/** Placeholder value for “no drill level selected” (Radix Select needs a value). */
const DRILL_LEVEL_NONE = "__drill_none__";

/** Am5 needs an explicit height when the chart tab is `h-auto` (data-quality dashboards). */
function dqDashboardAm5ChartHeight(compact: boolean): string {
  return compact ? "min(280px, 42vh)" : "min(380px, 52vh)";
}

function dqExpandedModalAm5ChartHeight(embedded: boolean): string {
  return embedded ? "min(300px, 44vh)" : "min(400px, 54vh)";
}

/** Pixel floor when the chart tab has not been measured yet (table opened first). */
export function dqTableTabMinHeightFallbackPx(opts: { compact?: boolean; embedded?: boolean }): number {
  if (opts.embedded != null) {
    return opts.embedded ? 300 : 400;
  }
  return opts.compact ? 280 : 380;
}

/**
 * Data-quality: chart-tab pane height is the table tab scroll cap — the table only uses the height
 * its rows need until that cap, then scrolls (avoids a tall empty panel for small payloads).
 */
export function useDqTableTabMinHeightStyle(
  enabled: boolean,
  activeTab: DashboardCardTab,
  chartScopeKey: string,
  fallbackPx: number,
): {
  chartPaneRef: React.RefObject<HTMLDivElement | null>;
  /** When on the table tab, max height (px) for the table scroll viewport (matches chart pane). */
  tableTabScrollCapPx: number | null;
} {
  const chartPaneRef = useRef<HTMLDivElement>(null);
  const [measuredPx, setMeasuredPx] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) setMeasuredPx(null);
  }, [enabled, chartScopeKey]);

  useLayoutEffect(() => {
    if (!enabled) return;
    if (activeTab !== "chart") return;
    const el = chartPaneRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setMeasuredPx(h);
    };
    measure();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled, activeTab, chartScopeKey]);

  const tableTabScrollCapPx =
    enabled && activeTab === "table" ? Math.max(measuredPx ?? 0, fallbackPx) : null;

  return { chartPaneRef, tableTabScrollCapPx };
}

function sortDrilldowns(actions: ChartDrilldownAction[]): ChartDrilldownAction[] {
  return [...actions].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/** One row per distinct target_level_id (first occurrence wins). */
function dedupeDrillTargets(actions: ChartDrilldownAction[]): ChartDrilldownAction[] {
  const seen = new Set<string>();
  const out: ChartDrilldownAction[] = [];
  for (const a of sortDrilldowns(actions)) {
    if (seen.has(a.target_level_id)) continue;
    seen.add(a.target_level_id);
    out.push(a);
  }
  return out;
}

function getSelectedDimension(
  actions: ChartActionsResponse | null,
  detail: ChartDetail,
): string {
  const dim = actions?.available_areas?.dimensions?.[0];
  if (dim) return dim;
  const path = actions?.available_areas?.drill_paths?.[0]?.current_level;
  if (path) return path;
  if (detail.category_column) return detail.category_column;
  return "";
}

/** Column used for category / x-axis labels in current chart rows. */
function getCategoryColumnForAxis(
  detail: ChartDetail,
  actions: ChartActionsResponse | null,
): string {
  const c = detail.category_column?.trim();
  const r0 = detail.chart_data?.[0];
  if (c && r0 && Object.prototype.hasOwnProperty.call(r0, c)) return c;
  const dim = getSelectedDimension(actions, detail);
  if (dim && r0 && Object.prototype.hasOwnProperty.call(r0, dim)) return dim;
  if (!r0) return "";
  const keys = Object.keys(r0);
  const strKey = keys.find((k) => {
    const v = r0[k];
    return v != null && (typeof v === "string" || typeof v === "number");
  });
  return strKey ?? "";
}

/** Distinct x-axis values from current chart data (for filter value picker). */
function uniqueSortedAxisValues(
  detail: ChartDetail,
  actions: ChartActionsResponse | null,
): string[] {
  const col = getCategoryColumnForAxis(detail, actions);
  const rows = detail.chart_data ?? [];
  if (!col || rows.length === 0) return [];
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[col];
    if (v == null) continue;
    set.add(String(v));
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Resolve filter dropdown options: `available_filters`, camelCase alias, or `available_areas.dimensions`.
 */
function resolveChartFilterFields(actions: ChartActionsResponse): ChartActionsFilterField[] {
  const direct = actions.available_filters;
  if (Array.isArray(direct) && direct.length > 0) {
    return direct.filter((f) => typeof f?.field === "string" && f.field.trim() !== "");
  }
  const rec = actions as unknown as Record<string, unknown>;
  const camel = rec.availableFilters;
  if (Array.isArray(camel) && camel.length > 0) {
    return (camel as ChartActionsFilterField[]).filter(
      (f) => typeof f?.field === "string" && f.field.trim() !== "",
    );
  }
  const dims =
    actions.available_areas?.dimensions?.filter(
      (d): d is string => typeof d === "string" && d.trim() !== "",
    ) ?? [];
  if (dims.length > 0) {
    return dims.map((field) => ({
      kind: "dimension",
      field: field.trim(),
      label: field
        .trim()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }
  return [];
}

function chartActionsHasFilters(
  actions: ChartActionsResponse | null | undefined,
  canApplyFilter: boolean,
): boolean {
  if (!actions || !canApplyFilter) return false;
  return resolveChartFilterFields(actions).length > 0;
}

/**
 * Drill-down crumbs must always stay visible as real “levels”; only filter-appends are hidden.
 */
function isDrillExplorationBreadcrumbCrumb(c: ChartActionsBreadcrumbItem): boolean {
  const it = String(c.interaction_type ?? "")
    .trim()
    .toLowerCase();
  if (it.includes("drill")) return true;
  return false;
}

/**
 * Bar/category drill often sends `selected_dimension` + `selected_value` without `filters_added`.
 * Treat that as drill, not as a filter-only append.
 */
function isBarSelectionDrillLikeBreadcrumbCrumb(c: ChartActionsBreadcrumbItem): boolean {
  const added = c.filters_added;
  if (Array.isArray(added) && added.length > 0) return false;
  return (
    typeof c.selected_value === "string" &&
    c.selected_value.trim() !== "" &&
    typeof c.selected_dimension === "string" &&
    c.selected_dimension.trim() !== ""
  );
}

/** True only for filter-appended crumbs (POST /filter), never for drill-down steps. */
function isFilterAppendBreadcrumbCrumb(c: ChartActionsBreadcrumbItem): boolean {
  if (isDrillExplorationBreadcrumbCrumb(c)) return false;
  if (isBarSelectionDrillLikeBreadcrumbCrumb(c)) return false;
  const added = c.filters_added;
  if (Array.isArray(added) && added.length > 0) return true;
  const it = String(c.interaction_type ?? "")
    .trim()
    .toLowerCase();
  return it === "filter" || it === "apply_filter" || it === "dimension_filter";
}

/**
 * Level: … / headline — drop every filter-append segment (POST /filter), never drill segments.
 * Needed when the path is e.g. … › filter › drill so the filter `level_id` is not shown in the middle.
 */
function breadcrumbTrailForLevelDisplay(
  crumbs: ChartActionsBreadcrumbItem[] | undefined | null,
): ChartActionsBreadcrumbItem[] {
  const list = crumbs ?? [];
  return list.filter((c) => !isFilterAppendBreadcrumbCrumb(c));
}

/**
 * Card header: when exploration has breadcrumbs, use the latest crumb title (else level_id)
 * so the headline matches the current view alongside the toolbar crumb line.
 */
export function getExplorationChartHeadline(
  actions: ChartActionsResponse | null | undefined,
  detail: ChartDetail,
): string {
  const crumbs = breadcrumbTrailForLevelDisplay(actions?.breadcrumb);
  if (crumbs.length === 0) {
    return detail.title?.trim() || detail.metric_name?.trim() || "";
  }
  const last = crumbs[crumbs.length - 1];
  const fromCrumb =
    (typeof last?.title === "string" && last.title.trim()) ||
    (typeof last?.level_id === "string" && last.level_id.trim()) ||
    "";
  return fromCrumb || detail.title?.trim() || detail.metric_name?.trim() || "";
}

export type ChartDrilldownUiHandlers = {
  /** `undefined` = not loaded yet (lazy fetch). */
  actions: ChartActionsResponse | null | undefined;
  loading?: boolean;
  lineageBusy?: boolean;
  /** Parent (Insights) filter API + chart poll in flight — dim chart like lineage back. */
  filterBusy?: boolean;
  onDrillDown: (payload: ChartDrillDownBody) => void | Promise<void>;
  onLineageBack: () => void | Promise<void>;
  /** POST /charts/{id}/filter */
  onApplyChartFilter?: (body: PostChartFilterBody) => void | Promise<void>;
  /** Parent loads GET /charts/{id}/actions on first open (lazy). */
  onExplorationOpen?: () => void | Promise<void>;
};

function ChartDrilldownToolbar({
  actions,
  detail,
  loading,
  lineageBusy,
  onLineageBack,
  drillBusy,
  targetLevelId,
  onDrillLevelChange,
  drillTargets,
  onApplyChartFilter,
}: {
  actions: ChartActionsResponse | null;
  detail: ChartDetail;
  loading?: boolean;
  lineageBusy?: boolean;
  onLineageBack: () => void;
  drillBusy?: boolean;
  /** Empty string = none selected (placeholder). */
  targetLevelId: string;
  /** Fires when user picks a level or clears to placeholder. */
  onDrillLevelChange: (targetLevelId: string) => void;
  drillTargets: ChartDrilldownAction[];
  onApplyChartFilter?: (body: PostChartFilterBody) => void | Promise<void>;
}) {
  const [valuePopoverOpen, setValuePopoverOpen] = useState(false);

  const axisValues = useMemo(
    () => (actions ? uniqueSortedAxisValues(detail, actions) : []),
    [detail, actions],
  );
  const filterFieldOptions = useMemo(
    () => (actions ? resolveChartFilterFields(actions) : []),
    [actions],
  );
  /** Prefer `zone` from actions; otherwise first filter field — no separate field dropdown. */
  const zoneFilterField = useMemo(() => {
    if (filterFieldOptions.length === 0) return { field: "", label: "" };
    const zone = filterFieldOptions.find((f) => f.field.toLowerCase() === "zone");
    if (zone) {
      return { field: zone.field, label: zone.label?.trim() || "Zone" };
    }
    const first = filterFieldOptions[0];
    return { field: first.field, label: first.label?.trim() || first.field };
  }, [filterFieldOptions]);

  useEffect(() => {
    setValuePopoverOpen(false);
  }, [actions?.chart_id, detail.chart_id]);

  if (loading) {
    return (
      <div className="mb-1 flex min-h-8 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground">Loading exploration options…</span>
      </div>
    );
  }

  if (actions == null) return null;

  const lineage = actions.lineage_summary;
  const canBack = !!lineage?.can_go_back;
  const crumbs = breadcrumbTrailForLevelDisplay(actions.breadcrumb);
  const depth = lineage?.depth ?? 0;
  const crumbSegments = crumbs
    .map((c) => {
      const id = c.level_id;
      if (id == null) return "";
      const t = String(id).trim();
      return t;
    })
    .filter(Boolean);
  const crumbLine =
    crumbSegments.length === 0 ? "Starting view" : crumbSegments.join(" › ");

  return (
    <div className="mb-1 rounded-lg from-primary/[0.06] to-muted/20">
      <div className="flex min-h-7 flex-wrap items-center gap-x-1 gap-y-1 px-1.5 py-0.5 sm:gap-x-1.5 sm:px-2">
      {canBack && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="!h-5 gap-0.5 w-4 text-[10px] mt-1"
              disabled={lineageBusy || drillBusy}
              onClick={() => onLineageBack()}
            >
              {/* {lineageBusy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null} */}
              <ArrowLeftIcon className="size-2" aria-hidden />
            </Button>
          )}
          
        {/* Breadcrumb — one truncated line */}
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-[14px] leading-tight",
            // crumbSegments.length === 0 ? "text-muted-foreground" : "text-foreground/90",
          )}
        >
          <span className="text-[12px] font-semibold"> Level: </span> <span className="text-[14px] leading-tight font-medium text-primary">{crumbLine}</span>
          {/* {crumbLine} */}
        </p>
        <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-1 sm:gap-1.5">
        {lineage != null && (
            <Badge
              variant="outline"
              className="!h-6 border-border/60 px-1.5 text-[9px] tabular-nums text-semibold"
            >
              L{depth}
            </Badge>
          )}
          {drillTargets.length > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-semibold"> Next Level:</span>
              <Select
                value={targetLevelId.trim() ? targetLevelId : DRILL_LEVEL_NONE}
                onValueChange={(v) => {
                  if (v === DRILL_LEVEL_NONE) {
                    onDrillLevelChange("");
                    return;
                  }
                  onDrillLevelChange(v);
                }}
                disabled={drillBusy}
              >
                <SelectTrigger
                  size="sm"
                  className="!h-6 w-[min(42vw,9.5rem)] min-w-[6.5rem] shrink-0 bg-background/90 px-1.5 text-[12px] leading-none shadow-sm"
                  aria-label="Next breakdown level"
                >
                  <SelectValue placeholder="Level…" />
                </SelectTrigger>
                <SelectContent align="end" className="min-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value={DRILL_LEVEL_NONE} className="text-[12px] !text-semibold">
                    Choose level…
                  </SelectItem>
                  {drillTargets.map((a) => (
                    <SelectItem
                      key={a.target_level_id}
                      value={a.target_level_id}
                      className="text-[12px]"
                    >
                      {a.label.replace(/\.\s*$/, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {filterFieldOptions.length > 0 &&
          onApplyChartFilter &&
          zoneFilterField.field ? (
            <div className="flex max-w-full flex-wrap items-center gap-1 border-l border-border/50 pl-1.5 sm:pl-2">
              <span className="text-[12px] font-semibold"> Filter:</span>
              <Popover open={valuePopoverOpen} onOpenChange={setValuePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!h-6 min-w-[6.25rem] max-w-[min(52vw,12rem)] shrink-0 justify-between gap-0.5 px-1.5 text-[12px] font-normal shadow-sm"
                    disabled={
                      lineageBusy || drillBusy || axisValues.length === 0
                    }
                    aria-label={`Choose ${zoneFilterField.label} value`}
                  >
                    <span className="truncate text-muted-foreground">
                      {zoneFilterField.field.toLowerCase() === "zone"
                        ? "Zone…"
                        : `${zoneFilterField.label}…`}
                    </span>
                    <ChevronsUpDown className="size-3 shrink-0 opacity-50" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(80vw,10rem)] p-0 z-[999]"
                  align="end"
                  sideOffset={4}
                >
                  <Command className="max-h-[min(52vh,260px)]">
                    <CommandInput placeholder="Search values…" className="!h-8 text-[10px]" />
                    <CommandList className="max-h-[200px] min-h-[72px] overflow-y-auto">
                      <CommandEmpty className="py-2 text-center text-[10px] text-muted-foreground">
                        No matching values
                      </CommandEmpty>
                      <CommandGroup>
                        {axisValues.map((v) => (
                          <CommandItem
                            key={v}
                            value={v}
                            className="text-[10px]"
                            onSelect={() => {
                              const field = zoneFilterField.field;
                              if (!field || !onApplyChartFilter) return;
                              void onApplyChartFilter({
                                filters: [{ field, operator: "=", value: v }],
                              });
                              setValuePopoverOpen(false);
                            }}
                          >
                            <span className="truncate">{v}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}

/** Shared drill / filter exploration state for dashboard chart cards and expanded modal. */
function useDashboardChartExploration(
  detail: ChartDetail,
  drilldownUi?: ChartDrilldownUiHandlers,
  /** Stable id for this chart slot; when set, drill/filter updates that change `detail.chart_id` do not reset exploration. */
  explorationScopeKey?: string,
  /** When true (expanded modal), drill mode starts on and `onExplorationOpen` runs when drill UI is available. */
  initialDrilldownOpen = false,
) {
  const [drilldownMode, setDrilldownMode] = useState(false);
  const [selectedTargetLevelId, setSelectedTargetLevelId] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const actions = drilldownUi?.actions;

  const drillTargetOptions = useMemo(
    () => dedupeDrillTargets(actions?.available_drilldowns ?? []),
    [actions?.available_drilldowns],
  );

  const explorationResetKey = explorationScopeKey ?? detail.chart_id;
  /** Boolean only — `drilldownUi` from parent is often a new object each render (e.g. Insights). */
  const drilldownPresent = !!drilldownUi;
  const drilldownUiRef = useRef(drilldownUi);
  drilldownUiRef.current = drilldownUi;

  const hasDrillLevels = drillTargetOptions.length > 0;
  const hasFilters = chartActionsHasFilters(actions, !!drilldownUi?.onApplyChartFilter);
  const actionsReady = actions != null && !drilldownUi?.loading;
  const filterOnlyExploration =
    drilldownPresent && actionsReady && !hasDrillLevels && hasFilters;

  /** Prefetch actions so we can show filter-only toolbar or enable drill when levels exist. */
  useEffect(() => {
    if (!drilldownPresent || actions !== undefined) return;
    void drilldownUiRef.current?.onExplorationOpen?.();
  }, [drilldownPresent, actions, explorationResetKey]);

  useEffect(() => {
    if (!drilldownPresent) {
      setDrilldownMode(false);
      setSelectedTargetLevelId("");
      return;
    }
    if (actions === undefined) return;
    if (actions === null) {
      setDrilldownMode(false);
      setSelectedTargetLevelId("");
      return;
    }
    const enableDrill = initialDrilldownOpen && hasDrillLevels;
    setDrilldownMode(enableDrill);
    if (!enableDrill) setSelectedTargetLevelId("");
  }, [explorationResetKey, initialDrilldownOpen, drilldownPresent, actions, hasDrillLevels]);

  /**
   * Each time `available_drilldowns` updates (new depth), show "Choose level…" unless the
   * current selection is still valid for the new list. No auto-pick of the first option.
   */
  useEffect(() => {
    if (!drillTargetOptions.length) {
      setSelectedTargetLevelId("");
      return;
    }
    setSelectedTargetLevelId((prev) => {
      const trimmed = prev.trim();
      const stillValid =
        !!trimmed &&
        drillTargetOptions.some((a) => a.target_level_id === trimmed);
      if (stillValid) return prev;
      return "";
    });
  }, [drillTargetOptions]);

  const runDrillDownApi = useCallback(
    async (targetLevelId: string, selectedValue: string) => {
      if (!drilldownUi || !targetLevelId.trim()) return;
      const dim = getSelectedDimension(actions, detail);
      if (!dim.trim()) {
        toast.error("Could not resolve dimension for drill-down");
        return;
      }
      setActionBusy(true);
      try {
        await drilldownUi.onDrillDown({
          target_level_id: targetLevelId.trim(),
          selected_dimension: dim,
          selected_value: selectedValue,
        });
      } finally {
        setActionBusy(false);
      }
    },
    [drilldownUi, actions, detail],
  );

  const handleDrillLevelChange = useCallback(
    (id: string) => {
      setSelectedTargetLevelId(id);
      if (!id.trim()) return;
      const action = drillTargetOptions.find((a) => a.target_level_id === id);
      const levelLabel = action?.label?.replace(/\.\s*$/, "") ?? id;
      toast.info(levelLabel, {
        description: "Click a bar below to open the next view for that category.",
      });
    },
    [drillTargetOptions],
  );

  const handleBarCategory = useCallback(
    (categoryLabel: string) => {
      if (!drilldownMode || !drilldownUi) return;
      if (!drillTargetOptions.length) return;
      if (!selectedTargetLevelId.trim()) {
        toast.info("Choose a drill level first");
        return;
      }
      const action = drillTargetOptions.find((a) => a.target_level_id === selectedTargetLevelId);
      const levelLabel = action?.label?.replace(/\.\s*$/, "") ?? selectedTargetLevelId;
      const dim = getSelectedDimension(actions, detail);
      toast.info(`Drill: ${categoryLabel}`, {
        description: [levelLabel && `Level: ${levelLabel}`, dim && `Dimension: ${dim}`]
          .filter(Boolean)
          .join(" · "),
      });
      queueMicrotask(() => {
        void runDrillDownApi(selectedTargetLevelId, categoryLabel);
      });
    },
    [
      drilldownMode,
      drilldownUi,
      drillTargetOptions,
      actions,
      detail,
      selectedTargetLevelId,
      runDrillDownApi,
    ],
  );

  const handleLineageBack = useCallback(async () => {
    if (!drilldownUi) return;
    setActionBusy(true);
    try {
      await drilldownUi.onLineageBack();
    } finally {
      setActionBusy(false);
    }
  }, [drilldownUi]);

  const handleApplyChartFilter = useCallback(
    async (body: PostChartFilterBody) => {
      if (!drilldownUi?.onApplyChartFilter) return;
      setActionBusy(true);
      try {
        await drilldownUi.onApplyChartFilter(body);
      } finally {
        setActionBusy(false);
      }
    },
    [drilldownUi],
  );

  const showDrillOnChart =
    drilldownMode &&
    !!drilldownUi &&
    hasDrillLevels &&
    !!selectedTargetLevelId.trim();

  /** Show drill toggle only when the API returned breakdown levels. */
  const showDrillToggle = actionsReady && hasDrillLevels;

  /** Toolbar: drill mode, or filter-only when no drill levels but filters exist. */
  const showExplorationToolbar =
    !!drilldownUi &&
    (drilldownMode || filterOnlyExploration || (!!drilldownUi.loading && drilldownPresent));

  const chartExplorationBusy =
    actionBusy ||
    !!drilldownUi?.lineageBusy ||
    !!drilldownUi?.filterBusy;

  return {
    drilldownMode,
    setDrilldownMode,
    selectedTargetLevelId,
    drillTargetOptions,
    handleDrillLevelChange,
    handleBarCategory,
    handleLineageBack,
    handleApplyChartFilter,
    showDrillOnChart,
    showDrillToggle,
    showExplorationToolbar,
    chartExplorationBusy,
    actions,
    actionBusy,
  };
}

/**
 * Full-width chart exploration for an expanded modal: Chart / Table / Query tabs plus drill UI
 * (same behavior as the inline card).
 */
export function DashboardChartExpandedModalContent({
  detail,
  drilldownUi,
  /** Dashboard spec chart id — keeps exploration + tab stable when drill/filter replaces `detail.chart_id`. */
  drilldownScopeKey,
  initialTab = "chart",
  /** Tighter chart/table heights for sidebars and narrow panels (e.g. workspace chart chat). */
  embedded = false,
  /** Correlation dashboards: Chart + Table only (no SQL, Insight, or drill). */
  hideSqlInsightDrill = false,
  dashboardEditMode = false,
  onSqlChange,
}: {
  detail: ChartDetail;
  drilldownUi?: ChartDrilldownUiHandlers;
  drilldownScopeKey?: string;
  initialTab?: DashboardCardTab;
  embedded?: boolean;
  hideSqlInsightDrill?: boolean;
  dashboardEditMode?: boolean;
  onSqlChange?: (sql: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<DashboardCardTab>(initialTab);

  const tabScopeKey = drilldownScopeKey ?? detail.chart_id;

  useEffect(() => {
    const dq = isDataQualityChartDetail(detail);
    let next: DashboardCardTab = initialTab;
    if ((dq || hideSqlInsightDrill) && (next === "query" || next === "info")) {
      next = "chart";
    }
    setActiveTab(next);
  }, [initialTab, tabScopeKey, detail, hideSqlInsightDrill]);

  const {
    drilldownMode,
    setDrilldownMode,
    selectedTargetLevelId,
    drillTargetOptions,
    handleDrillLevelChange,
    handleBarCategory,
    handleLineageBack,
    handleApplyChartFilter,
    showDrillOnChart,
    showDrillToggle,
    showExplorationToolbar,
    chartExplorationBusy,
    actions,
    actionBusy,
  } = useDashboardChartExploration(detail, drilldownUi, drilldownScopeKey, true);

  const dqChart = isDataQualityChartDetail(detail);
  const hideExtraTabs = dqChart || hideSqlInsightDrill;
  const { chartPaneRef: dqModalChartPaneRef, tableTabScrollCapPx: dqModalTableTabScrollCapPx } =
    useDqTableTabMinHeightStyle(
      dqChart,
      activeTab,
      tabScopeKey,
      dqTableTabMinHeightFallbackPx({ embedded }),
    );

  return (
    <Tabs
      key={tabScopeKey}
      value={activeTab}
      onValueChange={(v) => {
        const tab = v as DashboardCardTab;
        if (hideExtraTabs && (tab === "query" || tab === "info")) return;
        setActiveTab(tab);
      }}
      className="w-full gap-0"
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/20 px-1.5 py-1">
        <TabsList className="h-7 w-auto justify-start rounded-md border border-border/50 bg-muted/30 p-0.5 gap-0.5">
          <TabsTrigger value="chart" className="gap-1 px-2 h-6 text-xs" title="Chart">
            <BarChart3 className="size-3.5 shrink-0" aria-hidden />
            Chart
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1 px-2 h-6 text-xs" title="Table">
            <Table2 className="size-3.5 shrink-0" aria-hidden />
            Table
          </TabsTrigger>
          {!hideExtraTabs ? (
            <>
              <TabsTrigger value="query" className="gap-1 px-2 h-6 text-xs" title="SQL / query">
                <BsFiletypeSql className="size-3.5 shrink-0" aria-hidden />
                SQL
              </TabsTrigger>
              <TabsTrigger value="info" className="gap-1 px-2 h-6 text-xs" title="Insight & narrative">
                <Info className="size-3.5 shrink-0" aria-hidden />
                Insight
              </TabsTrigger>
            </>
          ) : null}
        </TabsList>

        {drilldownUi && !hideSqlInsightDrill && !dqChart && showDrillToggle ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (!drilldownMode) void drilldownUi.onExplorationOpen?.();
                  setDrilldownMode((m) => !m);
                }}
                aria-pressed={drilldownMode}
                className={cn(
                  "relative shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors inline-flex items-center gap-1",
                  drilldownMode
                    ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/25 hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/50",
                )}
              >
                <Layers2 className="size-3.5" aria-hidden />
                Drill down
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-[240px] text-xs">
              {drilldownMode
                ? "Drill down is on."
                : "Turn on drill."}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {showExplorationToolbar && drilldownUi && !hideSqlInsightDrill && !dqChart ? (
        <ChartDrilldownToolbar
          actions={actions ?? null}
          detail={detail}
          loading={drilldownUi.loading}
          lineageBusy={
            !!drilldownUi.lineageBusy ||
            !!drilldownUi.filterBusy ||
            actionBusy
          }
          drillBusy={actionBusy || !!drilldownUi.filterBusy}
          targetLevelId={selectedTargetLevelId}
          onDrillLevelChange={handleDrillLevelChange}
          drillTargets={drillTargetOptions}
          onLineageBack={() => void handleLineageBack()}
          onApplyChartFilter={
            drilldownUi.onApplyChartFilter ? handleApplyChartFilter : undefined
          }
        />
      ) : null}

      <TabsContent value="chart" className="mt-0 p-0 pt-1 focus-visible:outline-none">
        <div
          ref={dqChart ? dqModalChartPaneRef : undefined}
          className={cn(
            "flex w-full flex-col",
            dqChart
              ? embedded
                ? "h-auto min-h-0 max-h-[min(68vh,520px)] overflow-y-auto"
                : "h-auto min-h-0 max-h-[min(85vh,760px)] overflow-y-auto"
              : embedded
                ? "min-h-[200px] h-[min(38vh,340px)]"
                : "min-h-[400px] h-[min(70vh,720px)]",
          )}
        >
          <div
            {...(dqChart ? { "data-agentic-chart-preview": "" } : {})}
            className={cn(
              "relative rounded-md transition-[box-shadow] duration-200",
              !dqChart && "min-h-0 flex-1",
              showDrillOnChart &&
                "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
            )}
          >
            {chartDetailUsesDataTable(detail) ? (
              <div
                className={cn(
                  "flex min-h-0 flex-col p-1",
                  dqChart ? "h-auto w-full overflow-x-hidden" : "h-full overflow-hidden",
                )}
              >
                <ChartDataTable
                  rows={detail.chart_data ?? []}
                  displayColumns={chartPayloadDisplayColumns(detail)}
                  shrinkWrap={dqChart}
                  scrollHeightClass={
                    dqChart
                      ? embedded
                        ? "max-h-[min(32vh,280px)]"
                        : "max-h-[min(50vh,520px)]"
                      : embedded
                        ? "max-h-[min(36vh,300px)]"
                        : "max-h-[min(66vh,680px)]"
                  }
                />
              </div>
            ) : chartDetailUsesTableHeatmap(detail) ? (
              <div
                className={cn(
                  "flex min-h-0 flex-col p-1",
                  dqChart ? "h-auto w-full overflow-x-hidden" : "h-full overflow-hidden",
                )}
              >
                <DqTableHeatmap
                  detail={detail}
                  shrinkWrap={dqChart}
                  scrollHeightClass={
                    dqChart
                      ? embedded
                        ? "max-h-[min(28vh,240px)]"
                        : "max-h-[min(44vh,440px)]"
                      : embedded
                        ? "max-h-[min(32vh,260px)]"
                        : "max-h-[min(58vh,560px)]"
                  }
                />
              </div>
            ) : chartDetailUsesValidationRuleFailures(detail) ? (
              <div className="min-h-0 w-full overflow-x-hidden px-1 py-0.5">
                <ValidationRuleFailuresPanel detail={detail} compact={embedded} />
              </div>
            ) : chartDetailUsesDataTrustScorecard(detail) ? (
              <div className="min-h-0 w-full overflow-x-hidden px-1 py-0.5">
                <DataTrustScorecardPanel
                  detail={detail}
                  compact={embedded}
                  onDrilldownCategory={handleBarCategory}
                />
              </div>
            ) : (
              <>
                <Am5MiniChart
                  detail={detail}
                  height={dqChart ? dqExpandedModalAm5ChartHeight(embedded) : undefined}
                  drilldownEnabled={showDrillOnChart}
                  onDrilldownCategory={handleBarCategory}
                />
                {chartExplorationBusy ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]"
                    aria-busy="true"
                    aria-label={
                      drilldownUi?.filterBusy ? "Applying filter" : "Updating chart"
                    }
                  >
                    <Loader2 className="size-9 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : null}
              </>
            )}
          </div>
          <CorrelationHeatmapScaleLegend detail={detail} />
        </div>
      </TabsContent>

      <TabsContent value="table" className="mt-0 p-1 focus-visible:outline-none">
        <ChartDataTable
          rows={detail.chart_data ?? []}
          displayColumns={chartPayloadDisplayColumns(detail)}
          shrinkWrap
          scrollViewportMaxHeightPx={
            dqChart && activeTab === "table" && dqModalTableTabScrollCapPx != null
              ? dqModalTableTabScrollCapPx
              : undefined
          }
          scrollHeightClass={
            dqChart && activeTab === "table"
              ? ""
              : dqChart
                ? embedded
                  ? "max-h-[min(34vh,280px)]"
                  : "max-h-[min(52vh,560px)]"
                : embedded
                  ? "max-h-[min(40vh,280px)]"
                  : "max-h-[min(68vh,720px)]"
          }
        />
      </TabsContent>

      {!dqChart ? (
        <>
          <TabsContent value="query" className="mt-0 p-1 focus-visible:outline-none space-y-1">
            <ChartSqlTabContent
              sql={detail.sql ?? ""}
              dashboardEditMode={dashboardEditMode}
              onSqlChange={onSqlChange}
              embedded={embedded}
            />
          </TabsContent>

          <TabsContent value="info" className="mt-0 p-1 focus-visible:outline-none">
            <ChartDetailInfoTabContent detail={detail} />
          </TabsContent>
        </>
      ) : null}
    </Tabs>
  );
}

function TruncatedChartTitle({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, isTruncated]);

  const titleEl = (
    <p ref={ref} className="text-sm font-semibold truncate flex-1 min-w-0">
      {text}
    </p>
  );

  if (!isTruncated) return titleEl;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{titleEl}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-sm break-words">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ChartStatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

/** SQL tab body — read-only by default; editable when dashboard edit mode is on and user clicks the edit control. */
function ChartSqlTabContent({
  sql,
  dashboardEditMode = false,
  onSqlChange,
  compact = false,
  embedded = false,
}: {
  sql: string;
  dashboardEditMode?: boolean;
  onSqlChange?: (sql: string) => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [sqlFieldEditing, setSqlFieldEditing] = useState(false);
  const displaySql = sql?.trim() || "No SQL available for this chart.";

  useEffect(() => {
    if (!dashboardEditMode) setSqlFieldEditing(false);
  }, [dashboardEditMode]);

  const boxClass = cn(
    "font-mono bg-muted/30 rounded-md border border-border/40 overflow-x-auto whitespace-pre-wrap overflow-y-auto w-full",
    compact ? "text-[10px] p-1.5 max-h-[min(260px,40vh)]" : "text-xs p-2",
    !compact &&
      (embedded ? "max-h-[min(38vh,260px)]" : "max-h-[min(68vh,720px)]"),
  );

  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-1">
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          SQL
        </p>
        {dashboardEditMode ? (
          <button
            type="button"
            onClick={() => setSqlFieldEditing((on) => !on)}
            className={cn(
              "shrink-0 rounded p-0.5 transition-colors",
              sqlFieldEditing
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            title={sqlFieldEditing ? "Lock SQL" : "Edit SQL"}
            aria-pressed={sqlFieldEditing}
          >
            <Pencil className="size-3.5" aria-hidden />
            <span className="sr-only">{sqlFieldEditing ? "Lock SQL" : "Edit SQL"}</span>
          </button>
        ) : null}
      </div>
      {sqlFieldEditing && dashboardEditMode ? (
        <textarea
          className={cn(boxClass, "resize-y min-h-[4rem]")}
          value={sql}
          onChange={(e) => onSqlChange?.(e.target.value)}
          spellCheck={false}
          aria-label="Chart SQL query"
        />
      ) : (
        <pre className={boxClass}>{displaySql}</pre>
      )}
    </div>
  );
}


export function DashboardSingleChartCard({
  detail,
  onExpand,
  onCognitoClick,
  canDelete,
  deleting,
  onDelete,
  compact,
  /** Drag handle (e.g. sortable reorder) — rendered before the chart title, inside the card header. */
  dragHandle,
  /** Stable dashboard slot id (spec chart id); after drill, `detail.chart_id` may differ — used when expanding. */
  chartSlotId,
  /** Dashboard agent: GET /charts/{id}/actions + drill UI (Insights only). */
  drilldownUi,
  /** Correlation dashboards: Chart + Table only (no SQL, Insight, or drill). */
  hideSqlInsightDrill = false,
  dashboardEditMode = false,
  onSqlChange,
  className,
}: {
  detail: ChartDetail;
  onExpand?: (d: ChartDetail, tab: DashboardCardTab, slotChartId: string) => void;
  /** When set, shows Cognito AI control to open chart conversation. */
  onCognitoClick?: (d: ChartDetail) => void;
  /** When true and `onDelete` is set, show remove-from-dashboard control. */
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
  /** Shorter chart pane (e.g. dense grid / maximize modal). */
  compact?: boolean;
  dragHandle?: React.ReactNode;
  chartSlotId?: string;
  drilldownUi?: ChartDrilldownUiHandlers;
  hideSqlInsightDrill?: boolean;
  dashboardEditMode?: boolean;
  onSqlChange?: (sql: string) => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<DashboardCardTab>("chart");

  const cardSubtitle =
    detail.subtitle ||
    (typeof detail.chart_payload?.subtitle === "string"
      ? detail.chart_payload.subtitle
      : undefined);

  const {
    drilldownMode,
    setDrilldownMode,
    selectedTargetLevelId,
    drillTargetOptions,
    handleDrillLevelChange,
    handleBarCategory,
    handleLineageBack,
    handleApplyChartFilter,
    showDrillOnChart,
    showDrillToggle,
    showExplorationToolbar,
    chartExplorationBusy,
    actions,
    actionBusy,
  } = useDashboardChartExploration(detail, drilldownUi);

  const chartHeaderTitle = useMemo(
    () => getExplorationChartHeadline(actions, detail),
    [actions, detail],
  );

  const expandSlotId = chartSlotId ?? detail.chart_id;

  const isDataQualityCard = isDataQualityChartDetail(detail);
  const hideExtraTabs = isDataQualityCard || hideSqlInsightDrill;
  const dqCardScopeKey = String(detail.chart_id ?? "");
  const { chartPaneRef: dqCardChartPaneRef, tableTabScrollCapPx: dqCardTableTabScrollCapPx } =
    useDqTableTabMinHeightStyle(
      isDataQualityCard,
      activeTab,
      dqCardScopeKey,
      dqTableTabMinHeightFallbackPx({ compact: !!compact }),
    );

  useEffect(() => {
    if (!hideExtraTabs) return;
    if (activeTab === "query" || activeTab === "info") {
      setActiveTab("chart");
    }
  }, [hideExtraTabs, activeTab, detail.chart_id]);

  return (
    <div
      className={cn(
        "border rounded-sm overflow-hidden pt-0 pb-1 pl-1.5 pr-1.5",
        isDataQualityCard ? "bg-background" : "bg-card",
        dragHandle && "group/chart-card",
        className,
      )}
    >
      <Tabs
        key={detail.chart_id}
        value={activeTab}
        onValueChange={(v) => {
          const tab = v as DashboardCardTab;
          if (hideExtraTabs && (tab === "query" || tab === "info")) return;
          setActiveTab(tab);
        }}
        className="w-full gap-0"
      >
        <div
          className={cn(
            "px-1.5 py-1 border-b space-y-0",
            isDataQualityCard ? "bg-background" : "bg-muted/30",
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {dragHandle ? (
              <span className="inline-flex shrink-0 items-center self-center text-muted-foreground opacity-80 transition-opacity group-hover/chart-card:opacity-100">
                {dragHandle}
              </span>
            ) : null}
            <TruncatedChartTitle text={chartHeaderTitle} />
            <div className="flex items-center gap-1 shrink-0">
              <TabsList className="h-6 w-auto justify-start rounded-sm border border-border/50 bg-muted/20 p-0.5 gap-0.5">
                <TabsTrigger
                  value="chart"
                  className="gap-1 px-0 h-5 w-7"
                  title="Chart"
                >
                  <BarChart3 className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">Chart</span>
                </TabsTrigger>
                <TabsTrigger
                  value="table"
                  className="gap-1 px-0 h-5 w-7"
                  title="Table"
                >
                  <Table2 className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">Table</span>
                </TabsTrigger>
                {!hideExtraTabs ? (
                  <>
                    <TabsTrigger
                      value="query"
                      className="gap-1 px-0 h-5 w-7"
                      title="SQL"
                    >
                      <BsFiletypeSql className="size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">SQL</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="info"
                      className="gap-1 px-0 h-5 w-7"
                      title="Insight & narrative"
                    >
                      <Info className="size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">Insight & narrative</span>
                    </TabsTrigger>
                  </>
                ) : null}
              </TabsList>

              {drilldownUi && !hideSqlInsightDrill && !isDataQualityCard && showDrillToggle ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (!drilldownMode) void drilldownUi?.onExplorationOpen?.();
                        setDrilldownMode((m) => !m);
                      }}
                      aria-pressed={drilldownMode}
                      className={cn(
                        "relative shrink-0 rounded p-1 transition-colors",
                        drilldownMode
                          ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/25 hover:bg-primary/20"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                      title={
                        drilldownMode
                          ? "Exit chart exploration"
                          : "Open chart exploration"
                      }
                    >
                      <Layers2 className="size-3.5" aria-hidden />
                      <span className="sr-only">
                        {drilldownMode ? "Exit chart exploration" : "Open chart exploration"}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="relative max-w-[240px] rounded-md text-xs shadow-md px-2 py-1"
                  >
                    <p className="font-medium">
                      {drilldownMode
                        ? "Drill down is on — choose a level, then click a bar."
                        : "Turn on drill down to pick a level and click bars."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {onCognitoClick && (
                <button
                  type="button"
                  onClick={() => onCognitoClick(detail)}
                  className="shrink-0 p-0 !h-7 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  title="Ask Cognito about this chart"
                >
                  <img
                    src={AIimage}
                    alt=""
                    className="size-7 object-contain"
                    aria-hidden
                  />
                  <span className="sr-only">Ask Cognito about this chart</span>
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  disabled={deleting}
                  className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  title="Remove chart from dashboard"
                >
                  {deleting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  <span className="sr-only">Remove chart from dashboard</span>
                </button>
              )}
              {onExpand && (
                <button
                  type="button"
                  onClick={() => onExpand(detail, activeTab, expandSlotId)}
                  className="shrink-0 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground !h-6 !w-6"
                  title={
                    activeTab === "table"
                      ? "Expand table"
                      : activeTab === "query"
                        ? "Expand query"
                        : activeTab === "info"
                          ? "Expand insight & narrative"
                          : "Expand chart"
                  }
                >
                  <Maximize2 className="!size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {showExplorationToolbar && drilldownUi && !hideSqlInsightDrill && !isDataQualityCard ? (
          <ChartDrilldownToolbar
            actions={actions ?? null}
            detail={detail}
            loading={drilldownUi.loading}
            lineageBusy={
              !!drilldownUi.lineageBusy ||
              !!drilldownUi.filterBusy ||
              actionBusy
            }
            drillBusy={
              actionBusy || !!drilldownUi.filterBusy
            }
            targetLevelId={selectedTargetLevelId}
            onDrillLevelChange={handleDrillLevelChange}
            drillTargets={drillTargetOptions}
            onLineageBack={() => void handleLineageBack()}
            onApplyChartFilter={
              drilldownUi.onApplyChartFilter ? handleApplyChartFilter : undefined
            }
          />
        ) : null}

        <TabsContent value="chart" className="mt-0 p-0 focus-visible:outline-none">
          <div
            ref={isDataQualityCard ? dqCardChartPaneRef : undefined}
            className={cn(
              "flex w-full flex-col",
              isDataQualityCard
                ? compact
                  ? "h-auto min-h-0 max-h-[min(72vh,520px)] overflow-y-auto"
                  : "h-auto min-h-0 max-h-[min(88vh,720px)] overflow-y-auto"
                : compact
                  ? "h-[220px] min-h-[180px]"
                  : "h-[320px] min-h-[260px]",
            )}
          >
            <div
              {...(isDataQualityCard ? { "data-agentic-chart-preview": "" } : {})}
              className={cn(
                "relative rounded-md transition-[box-shadow] duration-200",
                !isDataQualityCard && "min-h-0 flex-1",
                showDrillOnChart &&
                  "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
              )}
            >
              {chartDetailUsesDataTable(detail) ? (
                <div
                  className={cn(
                    "flex min-h-0 flex-col p-1",
                    isDataQualityCard ? "h-auto w-full overflow-x-hidden" : "h-full overflow-hidden",
                  )}
                >
                  <ChartDataTable
                    rows={detail.chart_data ?? []}
                    displayColumns={chartPayloadDisplayColumns(detail)}
                    shrinkWrap={isDataQualityCard}
                    scrollHeightClass={
                      isDataQualityCard
                        ? compact
                          ? "max-h-[min(34vh,220px)]"
                          : "max-h-[min(48vh,380px)]"
                        : compact
                          ? "max-h-[180px]"
                          : "max-h-[280px]"
                    }
                  />
                </div>
              ) : chartDetailUsesTableHeatmap(detail) ? (
                <div
                  className={cn(
                    "flex min-h-0 flex-col p-1",
                    isDataQualityCard ? "h-auto w-full overflow-x-hidden" : "h-full overflow-hidden",
                  )}
                >
                  <DqTableHeatmap
                    detail={detail}
                    compact={compact}
                    shrinkWrap={isDataQualityCard}
                    scrollHeightClass={
                      isDataQualityCard
                        ? compact
                          ? "max-h-[min(30vh,190px)]"
                          : "max-h-[min(42vh,320px)]"
                        : compact
                          ? "max-h-[160px]"
                          : "max-h-[240px]"
                    }
                  />
                </div>
              ) : chartDetailUsesValidationRuleFailures(detail) ? (
                <div className="min-h-0 w-full overflow-x-hidden px-1 py-0.5">
                  <ValidationRuleFailuresPanel detail={detail} compact={compact} />
                </div>
              ) : chartDetailUsesDataTrustScorecard(detail) ? (
                <div className="min-h-0 w-full overflow-x-hidden px-1 py-0.5">
                  <DataTrustScorecardPanel
                    detail={detail}
                    compact={compact}
                    onDrilldownCategory={handleBarCategory}
                  />
                </div>
              ) : (
                <>
                  <Am5MiniChart
                    detail={detail}
                    height={
                      isDataQualityCard ? dqDashboardAm5ChartHeight(!!compact) : undefined
                    }
                    drilldownEnabled={showDrillOnChart}
                    onDrilldownCategory={handleBarCategory}
                  />
                  {chartExplorationBusy ? (
                    <div
                      className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]"
                      aria-busy="true"
                      aria-label={
                        drilldownUi?.filterBusy ? "Applying filter" : "Updating chart"
                      }
                    >
                      <Loader2
                        className={cn(
                          "animate-spin text-muted-foreground",
                          compact ? "size-7" : "size-9",
                        )}
                        aria-hidden
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <CorrelationHeatmapScaleLegend detail={detail} />
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-0 p-1 focus-visible:outline-none">
          <ChartDataTable
            rows={detail.chart_data ?? []}
            displayColumns={chartPayloadDisplayColumns(detail)}
            shrinkWrap
            scrollViewportMaxHeightPx={
              isDataQualityCard && activeTab === "table" && dqCardTableTabScrollCapPx != null
                ? dqCardTableTabScrollCapPx
                : undefined
            }
            scrollHeightClass={
              isDataQualityCard && activeTab === "table"
                ? ""
                : isDataQualityCard
                  ? compact
                    ? "max-h-[min(30vh,180px)]"
                    : "max-h-[min(36vh,220px)]"
                  : "max-h-[min(260px,40vh)]"
            }
          />
        </TabsContent>

        {!isDataQualityCard ? (
          <>
            <TabsContent value="query" className="mt-0 p-1 focus-visible:outline-none space-y-1">
              <ChartSqlTabContent
                sql={detail.sql ?? ""}
                dashboardEditMode={dashboardEditMode}
                onSqlChange={onSqlChange}
                compact
              />
            </TabsContent>

            <TabsContent value="info" className="mt-0 p-1 focus-visible:outline-none">
              <ChartDetailInfoTabContent detail={detail} compact />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

export function DashboardChartsTabs({
  chartsCount,
  viewsCount,
  chartDetails,
  onCognitoClick,
}: {
  chartsCount: number;
  viewsCount: number;
  chartDetails: ChartDetail[];
  onCognitoClick?: (d: ChartDetail) => void;
}) {
  const [expanded, setExpanded] = useState<{
    detail: ChartDetail;
    tab: DashboardCardTab;
    slotChartId: string;
  } | null>(null);

  const dataQualitySingleColumnGrid = useMemo(
    () => chartDetails.length > 0 && chartDetails.every((d) => isDataQualityChartDetail(d)),
    [chartDetails],
  );

  if (chartDetails.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <ChartStatRow label="Charts" value={chartsCount} />
        <ChartStatRow label="Views" value={viewsCount} />
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-2",
          !dataQualitySingleColumnGrid && "md:grid-cols-2",
        )}
      >
        {chartDetails.map((detail) => (
          <DashboardSingleChartCard
            key={detail.chart_id}
            detail={detail}
            chartSlotId={detail.chart_id}
            onExpand={(d, tab, slotId) =>
              setExpanded({ detail: d, tab, slotChartId: slotId })
            }
            onCognitoClick={onCognitoClick}
          />
        ))}
      </div>

      <BaseModal
        open={!!expanded}
        setOpen={(open) => {
          if (!open) setExpanded(null);
        }}
        size="x-large"
      >
        <BaseModal.Header description={expanded?.detail.intent ?? ""}>
          {expanded?.detail.metric_name ??
            expanded?.detail.title ??
            "Chart"}
        </BaseModal.Header>
        <BaseModal.Content>
          {expanded?.detail && expanded.slotChartId ? (
            <DashboardChartExpandedModalContent
              key={expanded.slotChartId}
              detail={expanded.detail}
              initialTab={expanded.tab}
            />
          ) : null}
        </BaseModal.Content>
      </BaseModal>
    </div>
  );
}

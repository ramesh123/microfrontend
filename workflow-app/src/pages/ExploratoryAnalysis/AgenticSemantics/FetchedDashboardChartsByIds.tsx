import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ChartDetail } from "./chartTypes";
import { DashboardChartsTabs } from "./DashboardChartCards";
import {
  chartStatusResponseToChartDetail,
  fetchChartUntilReady,
} from "./chartFetchUtils";

function isReadyStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "ready" || s === "complete" || s === "completed";
}

/**
 * Loads chart rows via GET /charts/{chart_id} (with polling until ready) and renders
 * the same tabs/grid as inline dashboard chart details — used in chat history when
 * artifacts only list `chart_ids` without `chart_details`.
 */
export function FetchedDashboardChartsByIds({
  chartIds,
  chartTitles,
  chartsCount,
  viewsCount,
  onCognitoClick,
  maxCharts,
}: {
  chartIds: string[];
  chartTitles?: string[];
  chartsCount: number;
  viewsCount: number;
  onCognitoClick?: (d: ChartDetail) => void;
  /** Optional cap on how many chart ids to fetch (default: all). */
  maxCharts?: number;
}) {
  const [details, setDetails] = useState<ChartDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredIds = chartIds.filter(Boolean);
  const ids =
    typeof maxCharts === "number" && maxCharts >= 0
      ? filteredIds.slice(0, maxCharts)
      : filteredIds;

  useEffect(() => {
    if (ids.length === 0) {
      setDetails([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const results = await Promise.all(
          ids.map(async (chartId, index) => {
            const res = await fetchChartUntilReady(chartId, {
              maxAttempts: 40,
              intervalMs: 400,
            });
            if (!isReadyStatus(res.status)) {
              const errMsg =
                typeof res.error_message === "string" && res.error_message.trim()
                  ? res.error_message
                  : `Chart ${res.status ?? "unknown"}`;
              return {
                chart_id: chartId,
                chart_type: "line",
                metric_name: chartTitles?.[index] ?? chartId,
                title: chartTitles?.[index] ?? chartId,
                chart_data: [] as Array<Record<string, unknown>>,
                intent: "dashboard",
                narrative: { summary: errMsg },
              } satisfies ChartDetail;
            }
            const d = chartStatusResponseToChartDetail(res);
            const t = chartTitles?.[index];
            if (t) {
              d.title = t;
            }
            return d;
          }),
        );
        if (!cancelled) {
          setDetails(results);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message || "Failed to load charts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chartIds, chartTitles, maxCharts]);

  if (ids.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
        <span>Loading charts from API…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500 py-2">{error}</p>;
  }

  if (details.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-2">No chart data returned.</p>
    );
  }

  return (
    <DashboardChartsTabs
      chartsCount={chartsCount}
      viewsCount={viewsCount}
      chartDetails={details}
      onCognitoClick={onCognitoClick}
    />
  );
}

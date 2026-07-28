import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchDashboardById,
  normalizeDashboardByIdResponse,
  type DashboardChartSpec,
} from "@/controllers/API/agenticApi";
import { dashboardChartSpecToChartDetail } from "./chartFetchUtils";
import { DashboardChartsTabs } from "./DashboardChartCards";
import type { ChartDetail } from "./chartTypes";

/**
 * Loads GET /dashboards/{id} (normalized spec/charts) and renders the same chart tabs as inline dashboard payloads.
 * Used when agent artifacts carry `dashboard_id` but no `chart_details` (e.g. DataQualityDashboardAgent).
 */
export function FetchedDashboardChartsByDashboardId({
  dashboardId,
  chartsCount,
  viewsCount,
  onCognitoClick,
}: {
  dashboardId: string;
  chartsCount?: number;
  viewsCount: number;
  onCognitoClick?: (d: ChartDetail) => void;
}) {
  const [details, setDetails] = useState<ChartDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = dashboardId.trim();
    if (!id) {
      setDetails([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const raw = await fetchDashboardById(id);
        const res = normalizeDashboardByIdResponse(raw);
        const specs = (res.spec?.charts ?? []) as DashboardChartSpec[];
        const mapped = specs.map((c) => dashboardChartSpecToChartDetail(c));
        if (!cancelled) {
          setDetails(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message || "Failed to load dashboard");
          setDetails([]);
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
  }, [dashboardId]);

  if (!dashboardId.trim()) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
        <span>Loading dashboard charts…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500 py-2">{error}</p>;
  }

  if (details.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-2">
        No charts returned for this dashboard yet.
      </p>
    );
  }

  const count = typeof chartsCount === "number" && chartsCount > 0 ? chartsCount : details.length;

  return (
    <DashboardChartsTabs
      chartsCount={count}
      viewsCount={viewsCount}
      chartDetails={details}
      onCognitoClick={onCognitoClick}
    />
  );
}

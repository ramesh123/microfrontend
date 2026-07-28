import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { AnalyticsStudioCreateChartState } from "../types";
import { buildAnalyticsStudioInitFromRouteState } from "./buildAnalyticsStudioInitFromRouteState";
import { buildWizardChartPayload } from "./buildWizardChartPayload";
import { executeWizardChartRequest } from "./executeWizardChartRequest";
import type { ChartWizardSource } from "./types";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";

interface UseWizardChartPreviewOptions {
  enabled: boolean;
  routeState: AnalyticsStudioCreateChartState;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  selectedChartTypeId?: string;
  selectedChartName?: string;
  chartFormData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string } | null;
  formValues: Record<string, unknown>;
  analyticsStudioInit?: AnalyticsStudioChartInit | null;
  payloadSource?: string | null;
}

function buildFetchSignature(
  chartTypeId: string | undefined,
  formValuesSignature: string,
): string {
  return `${chartTypeId ?? ""}::${formValuesSignature}`;
}

export function useWizardChartPreview({
  enabled,
  routeState,
  sources,
  selectedSourceName,
  selectedChartTypeId,
  selectedChartName,
  chartFormData,
  formValues,
  analyticsStudioInit: analyticsStudioInitOverride,
  payloadSource,
}: UseWizardChartPreviewOptions) {
  const [chartData, setChartData] = useState<
    Array<{ category: string; value: number; originalData: Record<string, unknown> }>
  >([]);
  const [rawChartResponse, setRawChartResponse] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchedSignatureRef = useRef<string | null>(null);

  const formValuesSignature = useMemo(() => JSON.stringify(formValues), [formValues]);

  const fetchSignature = useMemo(
    () => buildFetchSignature(selectedChartTypeId, formValuesSignature),
    [formValuesSignature, selectedChartTypeId],
  );

  const analyticsStudioInit = useMemo(() => {
    if (analyticsStudioInitOverride) return analyticsStudioInitOverride;
    return buildAnalyticsStudioInitFromRouteState(routeState, sources, selectedSourceName);
  }, [analyticsStudioInitOverride, routeState, selectedSourceName, sources]);

  useEffect(() => {
    if (!enabled || !selectedChartTypeId || !chartFormData) return;
    if (fetchSignature === lastFetchedSignatureRef.current) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const selectedChart = {
      name: selectedChartName || selectedChartTypeId || "Chart",
      uniqueId: selectedChartTypeId,
    };

    void (async () => {
      try {
        const payload = buildWizardChartPayload({
          flowId: routeState.flowId ?? analyticsStudioInit.flowId ?? "",
          formValues,
          chartFormData,
          selectedChart,
          selectedSource: payloadSource ?? selectedSourceName ?? null,
          analyticsStudioInit,
          customizationOptions: null,
          routeState,
        });

        if (!payload) {
          throw new Error("Unable to build chart payload");
        }

        const chartHint = selectedChart.uniqueId || selectedChart.name;
        const parsed = await executeWizardChartRequest(payload, chartHint);
        if (cancelled) return;

        lastFetchedSignatureRef.current = fetchSignature;
        setChartData(parsed.chartData);
        setRawChartResponse(parsed.rawChartResponse);
      } catch (err) {
        if (cancelled) return;
        const message = getDisplayErrorMessage(err, "Failed to generate chart preview");
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    analyticsStudioInit,
    chartFormData,
    enabled,
    fetchSignature,
    formValues,
    routeState.flowId,
    selectedChartName,
    selectedChartTypeId,
    selectedSourceName,
    payloadSource,
  ]);

  const isPivotChart =
    (selectedChartTypeId || "").toLowerCase().includes("pivot") ||
    selectedChartTypeId === "pivot_table";

  return {
    chartData,
    rawChartResponse,
    isLoading,
    error,
    analyticsStudioInit,
    isPivotChart,
  };
}

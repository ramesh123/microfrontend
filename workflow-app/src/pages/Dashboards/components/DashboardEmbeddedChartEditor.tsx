import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartFormulator } from '@/pages/charts/ChartFormulator';
import type { AnalyticsStudioChartInit } from '@/pages/charts/ChartFormulator/types';
import { getChartById } from '@/pages/Visualization/API/chartsApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import {
  buildAnalyticsStudioChartInitFromChart,
  isAnalyticsStudioDatabaseChart,
  type AnalyticsStudioChartRecord,
} from '@/pages/analyticsstudio/analyticsStudioChartUtils';

interface DashboardEmbeddedChartEditorProps {
  chartId: number;
  flowId?: string;
  isAnalyticsStudio?: boolean;
  onClose: () => void;
  onChartUpdated?: () => void;
}

export function DashboardEmbeddedChartEditor({
  chartId,
  flowId,
  isAnalyticsStudio = false,
  onClose,
  onChartUpdated,
}: DashboardEmbeddedChartEditorProps) {
  const [analyticsInit, setAnalyticsInit] = useState<AnalyticsStudioChartInit | null>(null);
  const [isLoading, setIsLoading] = useState(isAnalyticsStudio);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      delete (window as any).__chartCustomizationOptions;
    }
  }, [chartId]);

  useEffect(() => {
    if (!isAnalyticsStudio) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const chartResponse = (await getChartById(String(chartId))) as AnalyticsStudioChartRecord;
        if (!isAnalyticsStudioDatabaseChart(chartResponse)) {
          throw new Error('This chart is not an Analytics Studio database chart');
        }
        const init = await buildAnalyticsStudioChartInitFromChart(chartResponse);
        if (!cancelled) setAnalyticsInit(init);
      } catch (err) {
        if (!cancelled) {
          setError(getDisplayErrorMessage(err, 'Failed to load chart for editing'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [chartId, isAnalyticsStudio]);

  if (isAnalyticsStudio && isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading chart editor...</p>
      </div>
    );
  }

  if (isAnalyticsStudio && (error || !analyticsInit)) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">{error ?? 'Unable to load chart data'}</p>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ChartFormulator
        key={`dashboard-embedded-chart-${chartId}`}
        embedded
        embeddedChartId={chartId}
        embeddedFlowId={flowId}
        analyticsStudioInit={analyticsInit ?? undefined}
        onEmbeddedClose={onClose}
        onEmbeddedChartUpdated={onChartUpdated}
      />
    </div>
  );
}

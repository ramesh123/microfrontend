import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { fetchSimulationTrack } from '@/controllers/API/simulationTrackApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';

import { SimulationCharts } from './SimulationCharts';
import { SimulationDeviceTypeCharts } from './SimulationCharts/SimulationDeviceTypeCharts';
import { SimulationFilters } from './SimulationFilters';
import { SimulationLocationsTable } from './SimulationLocationsTable';
import { filterSimulationRunsByDate, pickLatestSimulationRun } from './simulationTrackDashboardUtils';
import type { SimulationFilter, SimulationPageData } from './types';

type StimulationComponentProps = {
  /** Pass API-shaped data directly; when omitted, the page loads via POST `/api/simulationtrack/simulationtrack`. */
  data?: SimulationPageData;
};

function toPageData(response: Awaited<ReturnType<typeof fetchSimulationTrack>>): SimulationPageData {
  return {
    success: response.success,
    total_runs: response.total_runs,
    runs: response.data,
  };
}

export const StimulationComponent: React.FC<StimulationComponentProps> = ({ data: externalData }) => {
  const [pageData, setPageData] = useState<SimulationPageData | null>(externalData ?? null);
  const [filters, setFilters] = useState<SimulationFilter>({ timeRange: 'all' });
  const [filterResetSignal, setFilterResetSignal] = useState(0);
  const [loading, setLoading] = useState(!externalData);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState('');

  const loadData = useCallback(async () => {
    if (externalData) {
      setPageData(externalData);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchSimulationTrack();
      setPageData(toPageData(response));
    } catch (err) {
      setPageData(null);
      setError(getDisplayErrorMessage(err, 'Failed to load Agent track data.'));
    } finally {
      setLoading(false);
    }
  }, [externalData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (externalData) {
      setPageData(externalData);
    }
  }, [externalData]);

  const handleFilterChange = useCallback((next: Partial<SimulationFilter>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handlePageReset = useCallback(() => {
    setFilters({ timeRange: 'all', dateRange: undefined });
    setFilterResetSignal((n) => n + 1);
    setSelectedRunId('');
    void loadData();
    toast.success('Reset to defaults');
  }, [loadData]);

  const filteredRuns = useMemo(() => {
    if (!pageData?.runs.length) return [];
    return filterSimulationRunsByDate(pageData.runs, filters);
  }, [filters, pageData?.runs]);

  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSelectedRunId('');
      return;
    }

    setSelectedRunId((current) => {
      if (current && filteredRuns.some((run) => run.run_info.run_id === current)) {
        return current;
      }
      return pickLatestSimulationRun(filteredRuns)?.run_info.run_id ?? filteredRuns[0].run_info.run_id;
    });
  }, [filteredRuns]);

  const selectedRun = useMemo(() => {
    if (!filteredRuns.length) return null;
    return (
      filteredRuns.find((run) => run.run_info.run_id === selectedRunId) ??
      pickLatestSimulationRun(filteredRuns)
    );
  }, [filteredRuns, selectedRunId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Agent track…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-full flex-col gap-4 px-4 py-4 sm:px-2 lg:px-2">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={() => void loadData()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!pageData?.success || !selectedRun) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        {pageData?.runs.length ? 'No simulation runs match the selected date range.' : 'No simulation runs available.'}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-full flex-col space-y-2 px-2 sm:px-1 lg:px-1">
      <header className="mb-2 flex flex-shrink-0 flex-col items-start justify-between gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-primary" />
          <h1 className="shrink-0 text-[16px] font-semibold text-foreground">Agent Track</h1>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:max-w-none">
          <div className="min-w-0 flex-1 sm:flex-initial">
            <SimulationFilters
              onFilterChange={handleFilterChange}
              filterResetSignal={filterResetSignal}
              isLoading={loading}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={handlePageReset}
            className="!px-2"
            aria-label="Reset filters and refresh"
          >
            <RefreshCw className={cn('!h-5 !w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <div className="space-y-2">
        <div className="w-full flex-shrink-0">
          <SimulationDeviceTypeCharts runId={selectedRunId} filters={filters} />
        </div>
        <div className="w-full flex-shrink-0">
          <SimulationCharts runs={filteredRuns} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SimulationLocationsTable
            runs={filteredRuns}
            selectedRunId={selectedRunId}
            onRunChange={setSelectedRunId}
          />
        </div>
      </div>
    </div>
  );
};

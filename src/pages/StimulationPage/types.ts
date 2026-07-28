import type { SimulationTrackRun } from '@/controllers/API/simulationTrackApi';
import type { TimeRange } from '@/types/jobs';

export type SimulationFilter = {
  timeRange?: TimeRange;
  dateRange?: {
    from: Date;
    to: Date;
  };
};

export type SimulationPageData = {
  success: boolean;
  total_runs: number;
  runs: SimulationTrackRun[];
};

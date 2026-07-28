import { useEffect, useRef, useState } from 'react';
import {
  FlowJobsDateFilter,
  type FlowDateFilterValue,
  getPresetDateRange,
} from '@/components/common/FlowJobsDateFilter';
import type { SimulationFilter } from '../types';

type SimulationFiltersProps = {
  onFilterChange: (filters: Partial<SimulationFilter>) => void;
  filterResetSignal?: number;
  isLoading?: boolean;
};

function toSimulationFilterPartial(value: FlowDateFilterValue): Partial<SimulationFilter> {
  if (value.mode === 'all') {
    return { timeRange: 'all', dateRange: undefined };
  }
  if (value.mode === 'custom') {
    return { timeRange: undefined, dateRange: { from: value.from, to: value.to } };
  }
  const range = getPresetDateRange(value.timeRange);
  return { timeRange: value.timeRange, dateRange: range };
}

const DEFAULT_FILTER: FlowDateFilterValue = { mode: 'all' };

export function SimulationFilters({
  onFilterChange,
  filterResetSignal = 0,
  isLoading = false,
}: SimulationFiltersProps) {
  const [dateFilter, setDateFilter] = useState<FlowDateFilterValue>(DEFAULT_FILTER);
  const lastFilterResetSignal = useRef(0);

  useEffect(() => {
    if (filterResetSignal === 0) return;
    if (filterResetSignal === lastFilterResetSignal.current) return;
    lastFilterResetSignal.current = filterResetSignal;
    setDateFilter(DEFAULT_FILTER);
  }, [filterResetSignal]);

  const handleDateFilterChange = (value: FlowDateFilterValue) => {
    setDateFilter(value);
    onFilterChange(toSimulationFilterPartial(value));
  };

  return (
    <FlowJobsDateFilter
      value={dateFilter}
      onChange={handleDateFilterChange}
      isLoading={isLoading}
      idPrefix="simulation-filter"
      className="w-full"
    />
  );
}

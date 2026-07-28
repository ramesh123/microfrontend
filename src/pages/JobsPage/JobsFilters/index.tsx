import React, { useState, useEffect, useRef } from 'react';
import { JobsFilter, TimeRange } from '@/types/jobs';
import {
  FlowJobsDateFilter,
  FlowDateFilterValue,
  getPresetDateRange,
} from '@/components/common/FlowJobsDateFilter';

interface JobsFiltersProps {
  onFilterChange: (filters: Partial<JobsFilter>) => void;
  filterResetSignal?: number;
  isLoading?: boolean;
}

function toJobsFilterPartial(value: FlowDateFilterValue): Partial<JobsFilter> {
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

export const JobsFilters: React.FC<JobsFiltersProps> = ({
  onFilterChange,
  filterResetSignal = 0,
  isLoading = false,
}) => {
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
    onFilterChange(toJobsFilterPartial(value));
  };

  return (
    <FlowJobsDateFilter
      value={dateFilter}
      onChange={handleDateFilterChange}
      isLoading={isLoading}
      idPrefix="jobs-filter"
      className="w-full"
    />
  );
};

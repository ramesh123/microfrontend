import React, { useState, useCallback } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { FlowJob, JobsFilter } from '@/types/jobs';
import { Button } from '@/components/ui/button';
import { FlowStatusChart } from './FlowStatusChart';
import { JobsFilters } from './JobsFilters';
import { TaskDetailView } from './TaskDetailView';
import { FlowTable } from './FlowTable';

export const JobsComponent: React.FC = () => {
  const [filters, setFilters] = useState<JobsFilter>({ timeRange: 'all' });
  const [selectedFlow, setSelectedFlow] = useState<FlowJob | null>(null);
  const [filterResetSignal, setFilterResetSignal] = useState(0);

  const handlePageReset = useCallback(() => {
    setFilters({
      timeRange: 'all',
      dateRange: undefined,
      status: undefined,
      deploymentName: undefined,
      taskName: undefined,
      searchText: undefined,
    });
    setSelectedFlow(null);
    setFilterResetSignal((n) => n + 1);
    toast.success('Reset to defaults');
  }, []);

  const handleFilterChange = useCallback((newFilters: Partial<JobsFilter>) => {
    setFilters((prev) => {
      const updatedFilters = { ...prev, ...newFilters };
      if (!newFilters.status) {
        setSelectedFlow(null);
      }
      return updatedFilters;
    });
  }, []);

  const handleStatusClick = useCallback((status: string | null) => {
    setFilters((prev) => ({ ...prev, status: status || undefined }));
  }, []);

  const handleFlowSelect = useCallback((flow: FlowJob | null) => {
    setSelectedFlow(flow);
  }, []);

  const handleBackToFlows = () => {
    setSelectedFlow(null);
    setFilters((prev) => ({ ...prev, status: undefined }));
  };

  return (
    <div className="h-full w-full mx-auto px-4 sm:px-2 lg:px-2 flex flex-col space-y-4">
      {selectedFlow ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskDetailView
            key={selectedFlow.id}
            flow={selectedFlow}
            onBack={handleBackToFlows}
          />
        </div>
      ) : (
        <>
          <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 flex-shrink-0 mb-2 ">
            <div className='flex items-center gap-2'>
              <ClipboardCheck className='h-4 w-4 text-primary'/>
              <h1 className="text-[16px] font-semibold text-foreground shrink-0">Job Runs</h1>

            </div>
            
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:max-w-none">
              <div className="min-w-0 flex-1 sm:flex-initial">
                <JobsFilters onFilterChange={handleFilterChange} filterResetSignal={filterResetSignal} />
              </div>
              <Button
                type="button"
                variant="primary"
                size="icon"
                onClick={handlePageReset}
                className="!px-2"
                aria-label="Reset filters and refresh"
              >
                <RefreshCw className="!h-5 w-4" />
              </Button>
            </div>
          </header>
          <div className='space-y-2'>
          <div className="flex-shrink-0 w-full max-w-9xl">
            <FlowStatusChart filters={filters} onStatusSelect={handleStatusClick} selectedStatus={filters.status} />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <FlowTable filters={filters} onRowClick={handleFlowSelect} filterResetSignal={filterResetSignal} />
          </div>
          </div>
        </>
      )}
    </div>
  );
};

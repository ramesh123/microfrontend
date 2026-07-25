import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Pagination } from '@/components/core/pagination';
import { Task } from '@/types/jobs';
import { toast } from 'sonner';
import { TaskCard } from '../TaskCard';
import { TaskRunsChart } from '../TaskRunsChart';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { jobsApi } from '@/controllers/API/jobsApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface TaskCardViewProps {
  flowRunId: string;
  flowName: string;
  deploymentName: string;
  timeGrain?: string;
  refreshkey: number;
}

/** 2 columns × 3 rows = 6 task cards visible; extra rows scroll inside this area */
const TASK_GRID_VISIBLE_ROWS = 3;
const TASK_CARD_ROW_HEIGHT_REM = 7.65;
const TASK_LIST_SCROLL_HEIGHT = `calc(${TASK_GRID_VISIBLE_ROWS} * ${TASK_CARD_ROW_HEIGHT_REM}rem + (${TASK_GRID_VISIBLE_ROWS} - 1) * 0.5rem)`;

export const TaskCardView: React.FC<TaskCardViewProps> = ({
  flowRunId,
  flowName,
  deploymentName,
  timeGrain,
  refreshkey,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const pendingRefreshResetRef = useRef(true);

  useLayoutEffect(() => {
    pendingRefreshResetRef.current = true;
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
    setPageSize(6);
  }, [refreshkey]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setCurrentPage(1);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [flowRunId]);

  useEffect(() => {
    if (pendingRefreshResetRef.current) {
      if (currentPage !== 1 || pageSize !== 6 || debouncedSearchTerm !== '') {
        return;
      }
      pendingRefreshResetRef.current = false;
    }

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const skip = currentPage - 1;
        const response = await jobsApi.getTasks({
          flow_run_id: flowRunId,
          skip,
          limit: pageSize,
          search_text: debouncedSearchTerm.trim(),
        });
        setTasks(response.data);
        setTotalCount(response.total);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to fetch tasks.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [flowRunId, currentPage, pageSize, debouncedSearchTerm, refreshkey]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <TaskRunsChart
        flowName={flowName}
        deploymentName={deploymentName}
        timeGrain={timeGrain}
        refreshKey={refreshkey}
      />
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalCount} tasks found</p>
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by task name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-9 pr-8 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <Select defaultValue="newest">
            <SelectTrigger className="w-[180px] !h-8">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest to oldest</SelectItem>
              <SelectItem value="oldest">Oldest to newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScrollArea
        className="shrink-0 rounded-md border border-border/60"
        style={{ height: TASK_LIST_SCROLL_HEIGHT, maxHeight: TASK_LIST_SCROLL_HEIGHT }}
      >
        {isLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            No tasks found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-1 md:grid-cols-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="shrink-0 pt-1">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={handlePageChange}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
};

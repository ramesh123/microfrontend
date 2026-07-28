import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, MoreVertical, Eye, ArrowLeft } from 'lucide-react';
import { Pagination } from '@/components/core/pagination';
import { formatDateTime, formatDuration } from '@/utils/formatters';
import { Task } from '@/types/jobs';
import { toast } from 'sonner';
import { ResizableCell, ResizableTable,ResizableColumn } from '@/components/core/ResizableTable/inde';
import { jobsApi } from '@/controllers/API/jobsApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';


interface TaskTableProps {
  flowRunId: string;
  flowRunName: string;
  onBack: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ flowRunId, flowRunName, onBack }) => {
  const [data, setData] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Column widths
  const [columnWidths, setColumnWidths] = useState({
    taskName: 200,
    taskId: 250,
    flowRunName: 150,
    flowRunId: 250,
    flowName: 150,
    flowId: 250,
    startTime: 180,
    endTime: 180,
    duration: 120,
    actions: 100,
  });

  const fetchTasks = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const skip = (currentPage - 1);
      const response = await jobsApi.getTasks({
        flow_run_id: flowRunId,
        skip,
        limit: pageSize,
        search_text: searchTerm,
      });

      setData(response.data);
      setTotalCount(response.total);
      setTotalPages(Math.max(1, Math.ceil(response.total / pageSize)));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch tasks. Please try again.'));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    fetchTasks(true);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchTasks();
  };

  const updateColumnWidth = (column: keyof typeof columnWidths, width: number) => {
    setColumnWidths(prev => ({ ...prev, [column]: width }));
  };

  useEffect(() => {
    fetchTasks();
  }, [currentPage, pageSize, flowRunId]);

  return (
    <Card className="p-1 max-w-[85.5rem]">
      <CardContent className="flex flex-col gap-4 py-0 px-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Tasks</h2>
              <p className="text-sm text-gray-600">Flow Run: {flowRunName}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-8.5 w-full sm:w-64"
              />
            </div>
            
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border max-h-[32rem] overflow-y-auto">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#d1d1d16e] hover:bg-[#d1d1d16e]">
                  <ResizableColumn
                    width={columnWidths.taskName}
                    onResize={(width) => updateColumnWidth('taskName', width)}
                    className="first:rounded-tl-xl"
                  >
                    Task Name
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.taskId}
                    onResize={(width) => updateColumnWidth('taskId', width)}
                  >
                    Task ID
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.flowRunName}
                    onResize={(width) => updateColumnWidth('flowRunName', width)}
                  >
                    Flow Run Name
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.flowRunId}
                    onResize={(width) => updateColumnWidth('flowRunId', width)}
                  >
                    Flow Run ID
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.flowName}
                    onResize={(width) => updateColumnWidth('flowName', width)}
                  >
                    Flow Name
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.flowId}
                    onResize={(width) => updateColumnWidth('flowId', width)}
                  >
                    Flow ID
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.startTime}
                    onResize={(width) => updateColumnWidth('startTime', width)}
                  >
                    Start Time
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.endTime}
                    onResize={(width) => updateColumnWidth('endTime', width)}
                  >
                    End Time
                  </ResizableColumn>
                  <ResizableColumn
                    width={columnWidths.duration}
                    onResize={(width) => updateColumnWidth('duration', width)}
                  >
                    Duration
                  </ResizableColumn>
                  <TableHead className="last:rounded-tr-xl sticky right-0 bg-[#d1d1d1] min-w-[100px] w-[100px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-blue-500">
                      {isLoading || isRefreshing
                        ? 'Loading...'
                        : searchTerm
                        ? 'No tasks found matching your search'
                        : 'No tasks found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((task) => (
                    <TableRow key={task.id}>
                      <ResizableCell width={columnWidths.taskName}>
                        <div className="flex items-center gap-2">
                          <span>{task.task_name}</span>
                          <Badge className={(task.task_state)}>
                            {task.task_state}
                          </Badge>
                        </div>
                      </ResizableCell>
                      <ResizableCell width={columnWidths.taskId}>
                        {task.task_id}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.flowRunName}>
                        {task.flow_run_name}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.flowRunId}>
                        {task.flow_run_id}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.flowName}>
                        {task.flow_name}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.flowId}>
                        {task.flow_id}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.startTime}>
                        {formatDateTime(task.start_time)}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.endTime}>
                        {formatDateTime(task.end_time)}
                      </ResizableCell>
                      <ResizableCell width={columnWidths.duration}>
                        {formatDuration(task.duration)}
                      </ResizableCell>
                      <TableCell className="sticky right-0 bg-white border-l border-gray-200">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </CardContent>
    </Card>
  );
};

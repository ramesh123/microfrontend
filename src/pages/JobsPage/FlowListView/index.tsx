import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Pagination } from '@/components/core/pagination';
import { FlowJob, JobsFilter } from '@/types/jobs';
import { toast } from 'sonner';
import { FlowRow } from '../FlowRow';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { jobsApi } from '@/controllers/API/jobsApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';


interface FlowListViewProps {
  filters: JobsFilter;
  onRowClick: (flow: FlowJob) => void;
}

export const FlowListView: React.FC<FlowListViewProps> = ({ filters, onRowClick }) => {
  const [data, setData] = useState<FlowJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchFlowJobs = async () => {
    setIsLoading(true);
    try {
      const skip = currentPage - 1;
      const queryParts: string[] = [];
      if (filters.status) {
        queryParts.push(`job_status='${filters.status}'`);
      }
      // Add other filters to queryParts here if needed

      const response = await jobsApi.getFlowJobs({
        skip,
        limit: pageSize,
        search_text: debouncedSearchTerm || filters.searchText,
        q: queryParts.join(' AND ') || undefined,
      });

      setData(response.data);
      setTotalCount(response.total);
    } catch (error) {
      console.error('Error fetching flow jobs:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch flow jobs.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to first page on filter change
    fetchFlowJobs();
  }, [pageSize, filters, debouncedSearchTerm]);

  useEffect(() => {
    fetchFlowJobs();
  }, [currentPage]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return ( 
    <Card className="bg-transparent p-0 dark:bg-transparent border-none shadow-none">
      <CardHeader className="p-0 px-2">
        <div className="flex items-center justify-between">
            <h3 className="text-l font-medium text-muted-foreground">{totalCount} Flows</h3>
            <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
                placeholder="Search flows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="min-w-full text-sm">
                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="p-2.5 font-semibold text-muted-foreground">Flow</div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={40} minSize={20}>
                    <div className="p-2.5 font-semibold text-muted-foreground">Details</div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={15} minSize={10}>
                    <div className="p-2.5 font-semibold text-muted-foreground">Status</div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={15} minSize={10}>
                    <div className="p-2.5 font-semibold text-muted-foreground">Last Run</div>
                </ResizablePanel>
            </ResizablePanelGroup>
            <div className="space-y-1">
                {isLoading ? (  
                <div className="h-24 text-center flex items-center justify-center">Loading...</div>
                ) : data.length === 0 ? (
                <div className="h-24 text-center flex items-center justify-center">No flows found.</div>
                ) : (
                data.map((job) => (
                    <FlowRow key={job.id} job={job} onRowClick={onRowClick} />
                ))
                )}
            </div>
        </div>
        <div className="pt-4">
            <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / pageSize)}
            onPageChange={handlePageChange}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            />
        </div>
      </CardContent>
    </Card>
  );
};

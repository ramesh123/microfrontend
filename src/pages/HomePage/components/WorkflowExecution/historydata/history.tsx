"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createColumns } from "./column_new";
import { jobsApi } from "@/controllers/API/jobsApi";
import { FlowJob } from "@/types/jobs";
import { RefreshCw } from "lucide-react";
import { TaskDetailView } from "@/pages/JobsPage/TaskDetailView";
import { useParams } from "react-router-dom";
import TableWithPagination from "@/common/tableWithPagination";
import {
  FlowJobsDateFilter,
  FlowDateFilterValue,
  resolveFlowDateFilterToYmd,
} from "@/components/common/FlowJobsDateFilter";

const DEFAULT_DATE_FILTER: FlowDateFilterValue = { mode: "all" };

export default function HistoryPage({ flowName }: { flowName?: string }) {
  const [flows, setFlows] = useState<FlowJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowJob | null>(null);
  useParams();

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<FlowDateFilterValue>(DEFAULT_DATE_FILTER);
  const [searchText] = useState("");

  const fetchFlows = useCallback(
    async (dateOverride?: FlowDateFilterValue) => {
      setLoading(true);
      const effectiveDateFilter = dateOverride ?? dateFilter;
      const { fromDate, toDate } = resolveFlowDateFilterToYmd(effectiveDateFilter);

      try {
        const conditions: string[] = [];
        if (flowName) {
          conditions.push(`flow_id='${flowName}'`);
        }

        if (jobStatusFilter !== "all") {
          conditions.push(`job_status='${jobStatusFilter.toUpperCase()}'`);
        }
        if (fromDate && toDate) {
          if (
            effectiveDateFilter.mode === "preset" &&
            (effectiveDateFilter.timeRange === "today" ||
              effectiveDateFilter.timeRange === "yesterday") &&
            fromDate === toDate
          ) {
            conditions.push(`DATE(created_at) = '${fromDate}'`);
          } else {
            conditions.push(`created_at BETWEEN '${fromDate}' AND '${toDate}'`);
          }
        }
        if (searchText) {
          conditions.push(`flow_name LIKE '%${searchText}%'`);
        }

        const response = await jobsApi.getFlowJobs({
          q: conditions.length ? conditions.join(" AND ") : undefined,
          skip: currentPage,
          limit: pageSize,
          sort: { created_at: "desc" },
        });

        setFlows(response.data || []);
        setTotalItems(response.total || 0);
      } catch (error) {
        console.error("Failed to fetch flows:", error);
        setFlows([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    },
    [flowName, jobStatusFilter, dateFilter, searchText, currentPage, pageSize],
  );

  useEffect(() => {
    void fetchFlows();
  }, [fetchFlows, currentPage, pageSize, dateFilter]);

  const handlePaginationChange = ({
    currentPage: nextPage,
    limit,
  }: {
    currentPage: number;
    limit: number;
  }) => {
    setCurrentPage(nextPage);
    setPageSize(limit);
  };

  const columns = useMemo(() => createColumns(setSelectedFlow), []);

  const handleStatusChange = (value: string) => {
    setJobStatusFilter(value);
    setCurrentPage(0);
  };

  const handleDateFilterChange = (value: FlowDateFilterValue) => {
    setDateFilter(value);
    setCurrentPage(0);
  };

  const handleBackToFlows = () => {
    setSelectedFlow(null);
  };

  if (selectedFlow) {
    return (
      <div className="h-full overflow-auto p-4">
        <TaskDetailView key={selectedFlow.id} flow={selectedFlow} onBack={handleBackToFlows} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between px-2 py-0">
        <header className="bg-background z-10 flex h-10 shrink-0 items-center justify-between p-0">
          <span className="text-lg font-semibold">History</span>
        </header>
        <div className="mb-0 flex flex-wrap items-center gap-2">
          <Select value={jobStatusFilter} onValueChange={handleStatusChange} disabled={loading}>
            <SelectTrigger className="text-primary w-[130px] flex-shrink-0 text-sm font-medium shadow-sm !h-7 !p-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["all", "pending", "running", "completed", "failed", "rolled_back"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FlowJobsDateFilter
            value={dateFilter}
            onChange={handleDateFilterChange}
            isLoading={loading}
            idPrefix="history-filter"
          />

          {!flowName && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => void fetchFlows()}
              disabled={loading}
              className="!h-6 !w-7"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 px-2">
        <TableWithPagination<FlowJob>
          data={flows}
          columns={columns}
          totalRows={totalItems}
          loading={loading}
          pagination={{
            steps: [10, 20, 30, 50, 100],
            currentPage,
            pageSize,
          }}
          scrollContainerClassName="max-h-[min(32rem,calc(100dvh-4rem))] w-full overflow-x-hidden overflow-y-auto"
          paginationSummary="range"
          onRowClick={(flow) => setSelectedFlow(flow)}
          onChangePagination={handlePaginationChange}
        />
      </div>
    </div>
  );
}

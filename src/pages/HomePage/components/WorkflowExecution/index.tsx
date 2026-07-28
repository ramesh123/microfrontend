import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { LayoutGrid, List, Search, FolderSearch, FilePlus, Loader, RefreshCw, Clock, CalendarClock, ClipboardCheck, SlidersHorizontal, TrendingUp, ChevronDown } from "lucide-react";
import { TbBrandGoogleAnalytics } from 'react-icons/tb';
import { motion, AnimatePresence } from "framer-motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import TableWithPagination from "@/common/tableWithPagination";
import { cn } from "@/lib/utils";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
} from "@/components/common/listPageTableStyles";
// import { WorkflowCard } from "./gridComponent";
// import { WorkflowListItem } from "./list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProjectsApi } from "@/controllers/API";
import useFlowStore from "@/stores/flowStore";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useRbacStore } from "@/stores/useRBACStore";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Lock } from "lucide-react";
import { useExecuteWorkflow } from "@/hooks/use-execute-flow";
import { useLocation } from "react-router-dom";
import { WorkflowCard } from "./grid";
import { ReconciliationWorkflowStatsCards } from "./ReconciliationWorkflowStatsCards";
import { ReconciliationTrendsPanel } from "./ReconciliationTrendsPanel";
import type { ReconciliationWorkflowItem } from "./reconciliationListStats";
import { getJobStatusColor, formatJobStatusLabel } from "@/utils/formatters";
// import { Workflow } from "@/types";

type ViewMode = "list" | "grid" |"Home";

type WorkflowRow = ReconciliationWorkflowItem & Record<string, unknown>;

const WORKFLOW_SORT_FIELD_MAP: Record<string, string> = {
  workflow: "name",
  execution_time: "updated_at",
  description: "description",
  status: "status",
  statement_date: "statement_date",
  business_process: "business_process",
};

const PAGINATION_STEPS = [10, 20, 50, 100];
const capitalizeLabel = (value?: string | null) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

interface WorkflowExecutionProps {
  onWorkflowClick?: (workflow: any) => void;
  workflowType?: "Data_Reconciliation" | "Data_Validation";
}

const WorkflowExecution = ({ onWorkflowClick, workflowType }: WorkflowExecutionProps = {}) => {
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [serverSort, setServerSort] = useState<{ field: string; dir: "asc" | "desc" }>({
    field: "updated_at",
    dir: "desc",
  });
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMountedRef = useRef(false);
  // FIX: Select each piece of state individually to avoid re-creating an object on every render.
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);

  // Get user's organization IDs and perspective info from RBAC store
  const { currentUser, currentOrganization, activePerspective } = useRbacStore();
  // Extract org_id array from currentUser
  // Check organizationIds (this is where we store it from session data)
  const userOrgIds = currentUser?.organizationIds || [];
 // Get active perspective ID (prefer perspective_id, fallback to id)
 const perspectiveIds = currentOrganization?.perspectiveIds || [];
 const activePerspectiveId = activePerspective?.perspective_id || activePerspective?.id;
  // Log for debugging
  console.log('Fetching projects for org_ids:', userOrgIds, 'User:', currentUser?.username);

  const handleCreateWorkflow = () => {
    navigate("/workflows/create");
  };
  const location = useLocation();
  const pathname = location.pathname || '';
  const workflow_type = workflowType ?? (pathname.includes("reconciliation")
    ? "Data_Reconciliation"
    : pathname.includes("data-validation")
    ? "Data_Validation"
    : "Data_Validation");

  const headerTitle = pathname.includes("reconciliation")
    ? "Reconciliation Workflows"
    : pathname.includes("data-validation")
    ? "Data Validation Workflows"
    : "Workflows";

  const isReconciliationListPage =
    workflow_type === "Data_Reconciliation" || pathname.includes("reconciliation");

  const isOperationsListPage = pathname === "/reconciliation/operations";
  const shouldRefreshListOnMount = isOperationsListPage || !!onWorkflowClick;

  const {
    data: projects,
    isLoading,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
    isStale,
  } = useQuery({
    queryKey: ["projects", userOrgIds.join(','), workflow_type, activePerspectiveId, debouncedSearchQuery, serverSort.field, serverSort.dir, currentPage, pageSize],
    queryFn: () => fetchProjectsApi({
      fields: ["name", "description", "updated_at", "deployment_name","deployment_id","statement_date", "locked" ,"workflow_type", "flow_id", "execution_number","process_cycle","environment","business_process","status","cycle_wise"],
      org_id: userOrgIds,
      q: `virtualdb_mode=false`,
      perspective_ids: activePerspectiveId ? [activePerspectiveId] : undefined,
      search_text: debouncedSearchQuery || undefined,
      skip: currentPage,
      limit: pageSize,
      sort: JSON.stringify({ [serverSort.field]: serverSort.dir }),
    }, currentUser?.role),
    // Enable once RBAC store has hydrated a user; fetch even if org list is empty
    enabled: !!currentUser,
    // Enhanced caching configuration for large dataset
    staleTime: 1000 * 60 * 30, // 30 minutes - data is considered fresh for 30 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep cached data in memory for 24 hours
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: shouldRefreshListOnMount ? "always" : true,
    refetchOnReconnect: false, // Don't refetch when internet reconnects
    // Only refetch if data is older than staleTime
    refetchInterval: false, // Disable automatic refetching
  });

  // Refetch workflow list whenever the Operations page is opened (avoids stale react-query cache)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (shouldRefreshListOnMount) {
      void refetch();
    }
  }, [shouldRefreshListOnMount, pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchQuery]);

  // Format the last updated time for display
  const getLastUpdatedTime = () => {
    if (!dataUpdatedAt || dataUpdatedAt === 0) return null;
    const date = new Date(dataUpdatedAt);
    // Check if the date is valid
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  // Manual refresh function
  
  const handleNavigateToAnalytics = useCallback((workflow: ReconciliationWorkflowItem) => {
    const idParam = workflow.id ?? workflow.flow_id;
    if (!idParam) {
      toast.error("Workflow ID not found");
      return;
    }
    navigate(`/reconciliation/operations/${idParam}?tab=analytics&view=recontab`, {
      state: { workflow, viewMode: "recontab" },
    });
  }, [navigate]);

  const handleRefresh = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    toast.info("Refreshing workflows data...");
    refetch();
    setPageSize(20); // reset pageSize to default value
    setCurrentPage(0); // reset currentPage to 0

  };

const handleSchedulersView = () => {
  navigate('/settings/schedulers');
};

// Navigate to Action Center view; pass workflow row (id, flow_id) in state so view uses it — no getWorkflowByIdApi.
const handleNavigateToActionCenter = useCallback((workflow: any) => {
  const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
  if (!idParam) {
    console.warn("handleNavigateToActionCenter: no id on workflow", workflow);
    return;
  }
  navigate(`/reconciliation/operations/${idParam}?tab=summary&view=recontab`, {
    state: { workflow, viewMode: "recontab" },
  });
}, [navigate]);

// Navigate to Recontab view; pass workflow row so view uses flow_id/id from list — no getWorkflowByIdApi.
const handleNavigateToRecontab = useCallback((workflow: any) => {
  const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
  if (!idParam) {
    console.warn("handleNavigateToRecontab: no id on workflow", workflow);
    return;
  }
  navigate(`/reconciliation/operations/${idParam}?tab=summary&view=recontab`, {
    state: { workflow, viewMode: "recontab" },
  });
}, [navigate]);

// Default navigation; pass workflow row in state for reconciliation/data-validation.
const handleNavigate = useCallback((
  workflow: any,
  preferredTarget: "data-validation" | "reconciliation" | null = null
) => {
  const target =
    preferredTarget ??
    (location.pathname.includes("reconciliation")
      ? "reconciliation"
      : location.pathname.includes("data-validation")
      ? "data-validation"
      : "data-validation");

  const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
  if (!idParam) {
    console.warn("handleNavigate: no id on workflow", workflow);
    return;
  }

  if (target === "reconciliation") {
    handleNavigateToRecontab(workflow);
  } else {
    navigate(`/${target}/${idParam}/basepage`, {
      state: { workflow, viewMode: "view" },
    });
  }
}, [location.pathname, handleNavigateToRecontab, navigate]);

// Centralized handler to open reconciliation operations with a sidebar param; pass workflow row in state.
const handleNavigateToSidebar = useCallback((workflow: any, sidebar: string) => {
  const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
  if (!idParam) return;
  const tab = sidebar === 'reports' ? 'report' : sidebar;
  navigate(`/reconciliation/operations/${idParam}?tab=${tab}&view=recontab`, {
    state: { workflow, viewMode: "recontab" },
  });
}, [navigate]);

  const filteredAndSortedWorkflows = useMemo(() => { 
    return projects?.data || [];
  }, [projects]);

  const totalRows = useMemo(() => {
    const raw = projects as { total?: number; total_count?: number; count?: number } | undefined;
    const n = Number(raw?.total ?? raw?.total_count ?? raw?.count ?? 0);
    return Number.isFinite(n) && n > 0 ? n : filteredAndSortedWorkflows.length;
  }, [projects, filteredAndSortedWorkflows.length]);

  const columns = useMemo<ColumnDef<WorkflowRow>[]>(() => {
    const isReconciliationWorkflow =
      workflow_type === "Data_Reconciliation" || location.pathname.includes("reconciliation");

    return [
      {
        id: "workflow",
        accessorKey: "name",
        header: "Workflow",
        size: 220,
        enableSorting: true,
        cell: ({ row }) => {
          const workflow = row.original;
          return (
            <div className="inline-flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onWorkflowClick) {
                    onWorkflowClick(workflow);
                  } else if (isReconciliationWorkflow) {
                    handleNavigateToActionCenter(workflow);
                  } else {
                    handleNavigate(workflow);
                  }
                }}
                className="inline-flex max-w-[200px] items-center gap-1 truncate text-left text-sm font-medium hover:text-primary/80 hover:underline decoration-1 underline-offset-2"
              >
                <span className="truncate">{capitalizeLabel(workflow.name as string)}</span>
                {workflow.locked ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
              </button>
            </div>
          );
        },
      },
      {
        id: "business_process",
        accessorKey: "business_process",
        header: "Business Process",
        size: 160,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="block max-w-[160px] truncate text-xs font-weight-medium">
            {capitalizeLabel(row.original.business_process as string) || "-"}
          </span>
        ),
      },
      {
        id: "description",
        accessorKey: "description",
        header: "Description",
        size: 280,
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate text-xs "
            title={String(row.original.description ?? "")}
          >
            {row.original.description
              ? capitalizeLabel(row.original.description as string)
              : "No description provided."}
          </span>
        ),
      },
      {
        id: "statement_date",
        accessorKey: "statement_date",
        header: "Statement Date",
        size: 130,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.statement_date
              ? new Date(row.original.statement_date as string).toISOString().split("T")[0]
              : "-"}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        size: 120,
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.status as string | undefined;
          if (!status?.trim()) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Badge
              variant="outline"
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
                getJobStatusColor(status),
              )}
            >
              <span>{formatJobStatusLabel(status)}</span>
            </Badge>
          );
        },
      },
      {
        id: "execution_time",
        accessorKey: "updated_at",
        header: "Execution Time",
        size: 140,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {timeAgo(row.original.updated_at as string)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>Actions</span>
          </div>
        ),
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const workflow = row.original;
          return (
            <div
              className="flex items-center justify-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ShadTooltip content="Open Operations">
                <Button
                  size="icon"
                  variant="ghost"
                  className="!h-7 !w-7 shrink-0"
                  onClick={() => {
                    const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
                    if (!idParam) {
                      toast.error("Workflow ID not found");
                      return;
                    }
                    navigate(`/reconciliation/operations/${idParam}?tab=operations&view=recontab`, {
                      state: { workflow, viewMode: "recontab" },
                    });
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4 " strokeWidth={2} />
                </Button>
              </ShadTooltip>
              <ShadTooltip content="Jobs">
                <Button
                  size="icon"
                  variant="ghost"
                  className="!h-7 !w-7 shrink-0"
                  onClick={() => {
                    const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
                    if (!idParam) {
                      toast.error("Workflow ID not found");
                      return;
                    }
                    navigate(`/reconciliation/operations/${idParam}?tab=jobs&view=recontab`, {
                      state: { workflow, viewMode: "recontab" },
                    });
                  }}
                >
                  <ClipboardCheck className="h-4 w-4" />
                </Button>
              </ShadTooltip>
              <ShadTooltip content="View Analytics">
                <Button
                  size="icon"
                  variant="ghost"
                  className="!h-7 !w-7 shrink-0"
                  onClick={() => {
                    const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
                    if (!idParam) {
                      toast.error("Workflow ID not found");
                      return;
                    }
                    navigate(`/reconciliation/operations/${idParam}?tab=analytics&view=recontab`, {
                      state: { workflow, viewMode: "recontab" },
                    });
                  }}
                >
                  <TbBrandGoogleAnalytics className="h-4 w-4 " />
                </Button>
              </ShadTooltip>
              <ShadTooltip content="Create Scheduler">
                <Button
                  size="icon"
                  variant="ghost"
                  className="!h-7 !w-7 shrink-0"
                  onClick={() => {
                    navigate("/scheduler/create", {
                      state: {
                        flowId: workflow.id || workflow.workflow_id || workflow.flow_id,
                        flowName: workflow.name,
                      },
                    });
                  }}
                >
                  <CalendarClock className="h-4 w-4 " />
                </Button>
              </ShadTooltip>
            </div>
          );
        },
      },
    ];
  }, [
    workflow_type,
    location.pathname,
    onWorkflowClick,
    handleNavigateToActionCenter,
    handleNavigate,
    navigate,
  ]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
    exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.1 } },
  };

  // if (!currentWorkflow) {
  //   return (
  //     <div className="w-full h-screen flex items-center justify-center bg-background">
  //       <div className="flex flex-col items-center gap-4">
  //         <Loader className="h-12 w-12 animate-spin text-primary" />
  //         <p className="text-lg text-muted-foreground">Loading Workflow...</p>
  //       </div>
  //     </div>
  //   );
  // }
  
  const executeMutation = useExecuteWorkflow();
  // Helper function to format time as "X days ago", "X hours ago", etc.
  // Takes a UTC timestamp (2025-12-23T12:41:47.476476), converts it to IST (UTC + 5:30),
  // and returns an accurate human-friendly time-ago string like '5m ago', '2h 11m ago', '3d 4h ago',
  // ensuring no double UTC offset is applied.
  function timeAgo(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      // Parse UTC timestamp explicitly (treat as UTC, not local time)
      // Handle format: "2025-12-23T12:41:47.476476" or "2025-12-23T12:41:47"
      let utcTimestamp: number;
      
      if (dateString.includes('T')) {
        // ISO format - parse as UTC explicitly
        // If it already has timezone info (Z, +, or -), use as is
        // Otherwise, append 'Z' to indicate UTC
        let isoString = dateString.trim();
        const hasTimezone = isoString.endsWith('Z') || 
                           isoString.includes('+') || 
                           isoString.match(/[+-]\d{2}:\d{2}$/);
        
        if (!hasTimezone) {
          // No timezone info - treat as UTC by appending 'Z'
          isoString = isoString + 'Z';
        }
        
        // Parse as UTC timestamp
        const utcDate = new Date(isoString);
        
        // Check if date is valid
        if (isNaN(utcDate.getTime())) {
          return 'N/A';
        }
        
        // Get UTC timestamp in milliseconds (Date.getTime() returns UTC milliseconds)
        // This is the UTC timestamp regardless of local timezone
        utcTimestamp = utcDate.getTime();
      } else {
        // Fallback for other formats - try parsing as UTC
        const utcDate = new Date(dateString + ' UTC');
        if (isNaN(utcDate.getTime())) {
          return 'N/A';
        }
        utcTimestamp = utcDate.getTime();
      }
      
      // Convert UTC to IST: UTC + 5 hours 30 minutes = 5.5 hours = 19800000 milliseconds
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5:30 in milliseconds
      const istTimestamp = utcTimestamp + IST_OFFSET_MS;
      
      // Get current UTC time and convert to IST
      const nowUTC = Date.now(); // Current UTC timestamp in milliseconds
      const nowIST = nowUTC + IST_OFFSET_MS;
      
      // Calculate difference in milliseconds (both in IST, so difference is correct)
      const diffMs = nowIST - istTimestamp;
      
      // Handle future dates
      if (diffMs < 0) {
        return 'Just now';
      }
  
      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
  
      if (years > 0) {
        const remMonths = months % 12;
        return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`;
      }
  
      if (months > 0) {
        const remDays = days % 30;
        return remDays > 0 ? `${months}mo ${remDays}d ago` : `${months}mo ago`;
      }
  
      if (days > 0) {
        const remHours = hours % 24;
        return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
      }
  
      if (hours > 0) {
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
      }
  
      if (minutes > 0) {
        return `${minutes}m ago`;
      }
  
      return 'Just now';
    } catch (error) {
      return 'N/A';
    }
  }
  
  
  return (
    <div className="w-full mx-auto py-0 px-2 md:px-2 relative">
      {isLoadingWorkflow && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2 mt-0">
        <div className="flex flex-col gap-0 self-start md:self-center">
          <div className="flex items-center ">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary"/>
              <h1 className="text-[16px] font-semibold">
                {headerTitle}
                {!isLoading && projects?.data && (
                <span className="ml-2 text-l text-muted-foreground">
                  ({totalRows})
                </span>
              )}
              </h1>
            </div>
            {(isLoading || isFetching) && (
              <div className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
          </div>
          {/* Cache status indicator */}
          {dataUpdatedAt && !isLoading && !isFetching && getLastUpdatedTime() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated: {getLastUpdatedTime()}</span>
              {isStale && (
                <span className="text-amber-600 dark:text-amber-400">(Data may be outdated)</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full border-border bg-background pl-10 pr-8 text-foreground placeholder:text-muted-foreground focus-visible:border-ring"
                />
                 {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}          
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)} disabled={isLoading || isFetching}>
              <SelectTrigger className="w-full flex-1 sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select> */}
            {/* <div className="bg-muted p-1 h-8 rounded-lg flex items-center">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => {
                  if (value === "Schedulers") {
                    handleSchedulersView();
                  } else if (value) {
                    setViewMode(value as ViewMode);
                  }
                }}
                aria-label="View mode"
                disabled={isLoading || isFetching}
                className="h-full flex items-center gap-1"
              >
                {[
                  { value: "Home", icon: HomeIcon, label: "Home" },
                  { value: "Jobs", icon: ClipboardCheckIcon, label: "Jobs" },
                  { value: "Clear", icon: Undo2Icon, label: "Clear" },
                  { value: "Schedulers", icon: CalendarClock, label: "Schedulers" },
                ].map(({ value, icon: Icon, label }) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={label}
                    className="
                      h-7 w-7
                      flex items-center justify-center
                      p-0
                      text-muted-foreground
                      data-[state=on]:bg-background
                      data-[state=on]:text-foreground
                      data-[state=on]:shadow-sm
                      rounded-md
                    "
                  >
                    <Icon className="h-4 w-4" />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div> */}

            <div className="bg-muted p-1 h-8 rounded-lg flex items-center">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as ViewMode)}
                aria-label="View mode"
                disabled={isLoading || isFetching}
                className="h-full flex items-center gap-1"
              >
                <ToggleGroupItem
                  value="list"
                  aria-label="List view"
                  className="h-7 w-7 p-0 flex items-center justify-center text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>

                <ToggleGroupItem
                  value="grid"
                  aria-label="Grid view"
                  className="h-7 w-7 p-0 flex items-center justify-center text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
                >
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {isReconciliationListPage ? (
              <Button
                onClick={() => setTrendsOpen((open) => !open)}
                variant={trendsOpen ? "secondary" : "outline"}
                aria-expanded={trendsOpen}
                className="w-full sm:w-auto !h-8 gap-1 !px-2"
                disabled={isLoading || isFetching}
                title={trendsOpen ? "Show workflows table" : "Show reconciliation trends"}
              >
                <TrendingUp className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Trends</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${trendsOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </Button>
            ) : null}

            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="w-full sm:w-auto !h-8 !p-2"
              disabled={isLoading || isFetching}
              title={`Refresh workflows data${isStale ? ' (data may be outdated)' : ''}`}
            >
              <RefreshCw className={`mr-0 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {/* Refresh */}
            </Button>
            {/* <Button onClick={handleCreateWorkflow} variant="outline" className="w-full sm:w-auto !h-9 !p-2">
              <FilePlus className="mr-0 h-4 w-4" />
              Workflow
            </Button> */}
          </div>
        </div>
      </div>

      {isReconciliationListPage && !isError ? (
        <ReconciliationWorkflowStatsCards
          workflows={filteredAndSortedWorkflows}
          listLoading={isLoading || isFetching}
        />
      ) : null}

      <AnimatePresence mode="wait">
        {isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            <FolderSearch className="h-24 w-24 text-red-500 mb-4" />
            <p className="text-lg font-semibold text-red-600 mb-2">Failed to Load Workflows</p>
            <p className="text-muted-foreground mb-6">
              {error?.message || "An error occurred while fetching workflows."}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </motion.div>
        ) : (isLoading || isLoadingWorkflow) && filteredAndSortedWorkflows.length === 0 ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            {/* <LoaderCircle className="h-16 w-16 text-primary animate-spin mb-4" /> */}
            <p className="text-lg font-semibold mb-2">
              {isLoadingWorkflow ? "Loading Workflows..." : "Loading Workflows..."}
            </p>
            <p className="text-muted-foreground">
              {isLoadingWorkflow
                ? "Loading workflow and fetching all node data..."
                : "This may take a few minutes to load all your workflows."}
            </p>
            
            {/* Show progress bar only for initial loading, not for refreshes */}
            {(isLoading || isLoadingWorkflow) && (
              <>
                <div className="w-64 h-2 bg-muted rounded-full mt-6 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: isLoadingWorkflow ? 10 : 40, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isLoadingWorkflow 
                    ? "Fetching node data using unique_ids and executing source nodes..."
                    : "Please wait while we fetch your workflow data..."}
                </p>
              </>
            )}
            
            {/* Cache info for refresh */}
            {isFetching && !isLoading && !isLoadingWorkflow && dataUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Cached data from: {getLastUpdatedTime()}
              </p>
            )}
          </motion.div>
        ) : filteredAndSortedWorkflows.length > 0 ? (
          trendsOpen && isReconciliationListPage ? (
            <motion.div
              key="trends"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-2"
            >
              <ReconciliationTrendsPanel
                workflows={filteredAndSortedWorkflows}
                onSelectRecon={handleNavigateToAnalytics}
              />
            </motion.div>
          ) : viewMode === "grid" ? (
            <ScrollArea className="overflow-y-auto h-screen">
              <motion.div
                key="grid"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
              >
                {filteredAndSortedWorkflows.map((workflow) => (
                  <motion.div key={workflow.id} >
                    <WorkflowCard workflow={workflow} isLoadingWorkflow={isLoadingWorkflow} onNavigateToSidebar={handleNavigateToSidebar} />
                  </motion.div>
                ))}
              </motion.div>
            </ScrollArea>
          ) : (
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex min-h-0 flex-1 flex-col gap-2"
            >
              <div className="w-full min-h-0 flex-1">
                <Card className={LIST_PAGE_CARD_CLASS}>
                  <CardContent className="p-0">
                    <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
                      <TableWithPagination<WorkflowRow>
                        key={`${debouncedSearchQuery}|${pageSize}|${serverSort.field}|${serverSort.dir}`}
                        data={filteredAndSortedWorkflows as WorkflowRow[]}
                        columns={columns}
                        totalRows={totalRows}
                        loading={isFetching || isLoading}
                        pagination={{
                          steps: PAGINATION_STEPS,
                          currentPage,
                          pageSize,
                        }}
                        paginationSummary="range"
                        scrollContainerClassName={cn(
                          "w-full overflow-auto",
                          isReconciliationListPage
                            ? "max-h-[calc(100vh-300px)]"
                            : "max-h-[calc(100vh-260px)]",
                        )}
                        onChangePagination={({ currentPage: nextPage, limit, sortedColumns }) => {
                          if (sortedColumns && Object.keys(sortedColumns).length > 0) {
                            const [columnId, dir] = Object.entries(sortedColumns)[0] as [
                              string,
                              "asc" | "desc",
                            ];
                            const apiField = WORKFLOW_SORT_FIELD_MAP[columnId];
                            if (apiField) {
                              setServerSort({ field: apiField, dir });
                              setCurrentPage(0);
                              return;
                            }
                          }
                          if (limit !== pageSize) {
                            setPageSize(limit);
                            setCurrentPage(0);
                            return;
                          }
                          setCurrentPage(nextPage);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Pagination Controls */}
              {/* <div className="flex items-center justify-between px-2 py-2 border-t bg-background text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Total: <strong>{projects?.total || 0}</strong></span>
                  <div className="flex items-center gap-2 border-l pl-4">
                    <span>Skip: <strong>{currentPage}</strong></span>
                    <span>Limit: <strong>{pageSize}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(0);
                      }}
                      className="bg-transparent border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {[10, 20, 50, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={currentPage === 0 || isLoading || isFetching}
                    >
                      Previous
                    </Button>
                    <span className="min-w-[60px] text-center">
                      Page <strong>{currentPage + 1}</strong>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={!projects?.total || (currentPage + 1) * pageSize >= projects.total || isLoading || isFetching}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div> */}
            </motion.div>
          )
        ) : (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            <FolderSearch className="h-24 w-24 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Workflows Found</p>
            <p className="text-muted-foreground mb-6">Try adjusting your search or create a new one.</p>
            <Button onClick={handleCreateWorkflow}>
              <FilePlus className="mr-2 h-4 w-4" />
              Create a Workflow
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default WorkflowExecution;

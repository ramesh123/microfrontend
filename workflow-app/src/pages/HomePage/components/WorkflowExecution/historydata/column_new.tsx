"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, GitMerge, Dot, CheckCircle, LoaderCircle, XCircle, Eye, Play, RotateCcw, CalendarClock, MoreVertical, Settings } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getJobStatusColor } from "@/utils/formatters"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNavigate, useLocation } from "react-router-dom"
import { FlowJob } from "@/types/jobs";
import { useState } from "react"
import { useExecuteWorkflow } from "@/hooks/use-execute-flow"
import { toast } from "sonner"
import ShadTooltip from "@/components/ui/shadTooltipComponent"
import { rollbackWorkflowApi } from "@/controllers/API"
import { ExecuteWorkflowDialog, ExecuteParams } from "@/pages/FlowPage/components/PageComponent/ExecuteWorkflowDialog"


const getStatusStyle = (status: string) => {
  switch (status) {
    case "completed":
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-700" />,
      };
    case "failed":
      return {
        icon: <XCircle className="h-4 w-4 text-red-700" />,
      };
    case "running":
      return {
        icon: (
          <LoaderCircle className="h-4 w-4 text-blue-700 animate-spin" />
        ),
      };
    case "rolled_back":
    case "rollback":
      return {
        icon: <RotateCcw className="h-4 w-4 text-violet-700 dark:text-violet-300" />,
      };
    default:
      return {
        icon: <LoaderCircle className="h-4 w-4 text-gray-600" />,
      };
  }
};
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
export const createColumns = (onFlowSelect?: (flow: FlowJob) => void): ColumnDef<FlowJob>[] => [
  {
    accessorKey: "flow_name",
    header: "Flow Name",
    size: 220,
    cell: ({ row }) => {
      const { flow_name, flow_id } = row.original;
      const navigate = useNavigate();
      const location = useLocation();

      const getReturnPath = () => {
        if (location.pathname.includes('/action-centre')) {
          // Ensure sidebar=jobs is in the return path to go back to jobs tab
          const url = new URL(location.pathname + location.search, window.location.origin);
          url.searchParams.set('sidebar', 'jobs');
          // Return pathname + search params (without origin)
          return url.pathname + url.search;
        }
        return null;
      };

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-3 cursor-pointer min-w-0 hover:text-blue-500 transition-colors "
              onClick={() => {
                // If onFlowSelect callback is provided, use it for inline view
                if (onFlowSelect) {
                  onFlowSelect(row.original);
                } else {
                  // Otherwise, navigate to separate page
                  const returnPath = getReturnPath();
                  navigate(`/history/${flow_id}/tasklist`, { 
                    state: { 
                      ...row.original, 
                      returnPath: returnPath 
                    } 
                  });
                }
              }}
            >
              <GitMerge className="h-4 w-4 text-gray-400" />
              <div className="truncate min-w-0">
                <div className=" !text-[11px] text-foreground font-medium truncate hover:underline hover:text-primary">{flow_name}</div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {flow_name}
          </TooltipContent>
        </Tooltip>
      );
    }

  },
  {
    accessorKey: "flow_run_name",
    header: "Run Name",
    size: 200,
    cell: ({ row }) => (
      <ShadTooltip content={row.original.flow_run_name} side="top">
        <div className="truncate max-w-[15rem] text-sm text-foreground">{row.original.flow_run_name}</div>
      </ShadTooltip>
    ),
  },

  {
    accessorKey: "created_at",
    header: "Last Run",
    size: 140,
    sortingFn: "datetime",
    cell: ({ row }) => (
      <ShadTooltip content={timeAgo(row.original.created_at)}>
          <div className="truncate max-w-[12rem] text-foreground !text-[11px]">
            {timeAgo(row.original.created_at)}
          </div>
      </ShadTooltip>
    ),
  },
  // {
  //   accessorKey: "stmt_date",
  //   header: "Statement Date",
  //   cell: ({ row }) => (
  //     <ShadTooltip content={row.original.stmt_date} side="top">
  //       <div className="truncate max-w-[12rem] font-normal text-sm">{row.original.stmt_date}</div>
  //     </ShadTooltip>
  //   ),
  //   },
  {
    accessorKey: "job_status",
    header: "Status",
    size: 130,
    cell: ({ row }) => {
      const status = row.original.job_status?.toLowerCase();
      const { icon, } = getStatusStyle(status);

      return (
        <Badge
          variant="outline"
          className={cn(
            "text-xs inline-flex items-center gap-1 px-2 1 py-0.5 rounded-md font-medium whitespace-nowrap",
            getJobStatusColor(row.original.job_status)
          )}
        // style={{ minWidth: "100px" }}
        >
           {/* {icon} */}
          <span className="capitalize">{status?.replace(/_/g, " ")}</span>
        </Badge>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: "actions",
    enableSorting: false,
    size: 160,
    header: () => (
      <div className="text-left w-full">Actions</div>
    ),
    cell: ({ row }
      
    ) => {
      const flow = row.original;
      const navigate = useNavigate();
      const location = useLocation();
      const executeMutation = useExecuteWorkflow();
      const [openExec, setOpenExec] = useState(false);
      const [isNavigatingToScheduler, setIsNavigatingToScheduler] = useState(false);
      const [isNavigatingToOperations, setIsNavigatingToOperations] = useState(false);
      const [isRollingBack, setIsRollingBack] = useState(false);
      
      const handleExecute = (params: ExecuteParams) => {
        const payload = {
          file_name: flow.flow_name,
          flow_name: flow.flow_name,
          flow_id: flow.flow_id,
          stmtdate: params.stmtdate,
          flow_run_id: "",
          process_cycle: params.process_cycle,
          execution_number: params.exec_number,
        };
        executeMutation.mutate(payload as any, {
          onSuccess: () => {
            toast.success("Execution triggered");
            setOpenExec(false);
          },
          onError: () => {
            toast.error("Failed to trigger execution");
          }
        });
      };

      // Check if we're coming from action-centre route and prepare return path
      const getReturnPath = () => {
        if (location.pathname.includes('/action-centre')) {
          // Ensure sidebar=jobs is in the return path to go back to jobs tab
          const url = new URL(location.pathname + location.search, window.location.origin);
          url.searchParams.set('sidebar', 'jobs');
          // Return pathname + search params (without origin)
          return url.pathname + url.search;
        }
        return null;
      };

      // Check if we're in action-centre route - disable all actions
      const isInActionCentre = location.pathname.includes('/action-centre');

      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <ShadTooltip content="View Details">
              <Button
                size="icon"
                variant="outline"
                className="!h-7 !w-7 border-none"
                disabled={isInActionCentre}
                onClick={isInActionCentre ? undefined : (e) => {
                  e.stopPropagation();
                  // If onFlowSelect callback is provided, use it for inline view
                  if (onFlowSelect) {
                    onFlowSelect(flow);
                  } else {
                    // Otherwise, navigate to separate page
                    const returnPath = getReturnPath();
                    navigate(`/history/${flow.flow_id}/tasklist`, { 
                      state: { 
                        ...flow, 
                        returnPath: returnPath 
                      } 
                    });
                  }
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </ShadTooltip>           
            <ShadTooltip content="Execute Flow">
              <Button
                size="icon"
                variant="outline"
                className="!h-7 !w-7 border-none"
                disabled={isInActionCentre}
                onClick={isInActionCentre ? undefined : (e) => {
                  e.stopPropagation();
                  setOpenExec(true);
                }}
              >
                <Play className="h-4 w-4" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Scheduler">
              <Button
                size="icon"
                variant="outline"
                className="!h-7 !w-7 border-none"
                disabled={isInActionCentre || isNavigatingToScheduler}
                onClick={isInActionCentre ? undefined : (e) => {
                  e.stopPropagation();
                  setIsNavigatingToScheduler(true);
                  // Get return path if coming from action-centre - ensure it goes back to jobs tab
                  const getReturnPath = () => {
                    if (location.pathname.includes('/action-centre')) {
                      const url = new URL(location.pathname + location.search, window.location.origin);
                      // Always set sidebar to jobs so back button returns to jobs table
                      url.searchParams.set('sidebar', 'jobs');
                      return url.pathname + url.search;
                    }
                    return null;
                  };
                  const returnPath = getReturnPath();
                  navigate('/scheduler/create', { 
                    state: { 
                      flowId: flow.flow_id, 
                      flowName: flow.flow_name,
                      returnPath: returnPath
                    },
                    replace: false
                  });
                  // Reset loading state after a short delay to allow navigation
                  setTimeout(() => setIsNavigatingToScheduler(false), 100);
                }}
              >
                {isNavigatingToScheduler ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Rollback">
              <Button
                size="icon"
                variant="outline"
                className="!h-7 !w-7 border-none"
                disabled={isInActionCentre || isRollingBack}
                onClick={isInActionCentre ? undefined : async (e) => {
                  e.stopPropagation();
                  try {
                    setIsRollingBack(true);
                    const res = await rollbackWorkflowApi(flow.flow_id);
                    toast.success((res && (res as any).message) || 'Rollback triggered');
                  } catch (err) {
                    console.error('Rollback error', err);
                    toast.error('Rollback failed');
                  } finally {
                    setIsRollingBack(false);
                  }
                }}
              >
                {isRollingBack ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </ShadTooltip>
            
            {/* Settings icon - Navigate to Operations tab when in action-centre */}
            {isInActionCentre && (
              <ShadTooltip content="Operations">
                <Button
                  size="icon"
                  variant="outline"
                  className="!h-7 !w-7 border-none"
                  disabled={isNavigatingToOperations}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsNavigatingToOperations(true);
                    // Navigate to operations tab - ensure sidebar=operations is set
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'operations');
                    const newSearch = currentSearch.toString();
                    // Get workflowName from URL if present
                    const workflowMatch = location.pathname.match(/\/action-centre\/([^/?]+)/);
                    const workflowId = workflowMatch ? workflowMatch[1] : null;
                    const newUrl = workflowId 
                      ? `/action-centre/${workflowId}?${newSearch}`
                      : `/action-centre?${newSearch}`;
                    // Navigate to ensure route changes
                    navigate(newUrl, { replace: false });
                    // Reset loading state after a short delay to allow navigation
                    setTimeout(() => setIsNavigatingToOperations(false), 100);
                  }}
                >
                  {isNavigatingToOperations ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                </Button>
              </ShadTooltip>
            )}
            </div>

          {/* EXECUTE FLOW MODAL */}
          <ExecuteWorkflowDialog
            open={openExec}
            onOpenChange={setOpenExec}
            onExecute={handleExecute}
            isExecuting={executeMutation.isPending}
          />
        </div>
      );

    },
  }
];

// Export default columns for backward compatibility (when no callback is needed)
export const columns = createColumns();
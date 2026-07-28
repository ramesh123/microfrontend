import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { RefreshCw, List, Grid3x3, Plus, Trash2, MoreHorizontal, Eye, Edit } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import CustomTableData from "@/components/ui/CustomTableData"
import SearchBar from "@/components/ui/SearchBar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { getDashboards, deleteDashboard, getDashboardById } from "../Visualization/API/dashboardApi"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConnectionTypeCell } from "@/pages/analyticsstudio/ConnectionTypeCell"

interface Dashboard {
  id: string
  [key: string]: any
}

type ViewMode = "list" | "grid"

interface DashboardsListPageProps {
  workflowName?: string;
  analyticsStudio?: boolean;
  onCreateNew?: () => void;
}

const DashboardsListPage = ({ workflowName, analyticsStudio, onCreateNew }: DashboardsListPageProps = {}) => {
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 100 })
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchDashboards = useCallback(async () => {
    setIsLoading(true)
    try {
      const skip = Math.max(0, pagination.currentPage - 1)
      const limit = pagination.limit

      const response = await getDashboards({
        skip,
        limit,
        analyticsStudio,
      })

      if (response) {
        const data = response?.data || response || []
        const total = response?.total || data.length || 0

        setDashboards(data)
        setTotalItems(total)
      }
    } catch (error) {
      console.error("API Error:", error)
      setDashboards([])
      setTotalItems(0)
    } finally {
      setIsLoading(false)
    }
  }, [pagination.currentPage, pagination.limit, analyticsStudio])

  // Reset to first page when search term changes
  useEffect(() => {
    setPagination((p) => {
      if (p.currentPage !== 1) {
        return { ...p, currentPage: 1 }
      }
      return p
    })
  }, [debouncedSearchTerm])

  // Fetch dashboards when pagination changes
  useEffect(() => {
    fetchDashboards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit])

  // Format date helper
  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "N/A"
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      return dateObj.toLocaleDateString("en-GB") + " " + dateObj.toLocaleTimeString("en-GB")
    } catch {
      return "N/A"
    }
  }

  // Filter dashboards based on search term
  const filteredDashboards = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return dashboards
    }

    const searchLower = debouncedSearchTerm.toLowerCase().trim()
    return dashboards.filter((dashboard) => {
      const searchFields = [
        dashboard.dashboard_title || dashboard.title || dashboard.name,
        dashboard.created_user || dashboard.createdUser,
        dashboard.flow_id || dashboard.flowid,
        dashboard.execution_id || dashboard.executionId,
        dashboard.source_type || dashboard.sourceType,
        dashboard.connection_type || dashboard.connectionType,
      ].filter(Boolean)

      return searchFields.some(field =>
        String(field).toLowerCase().includes(searchLower)
      )
    })
  }, [dashboards, debouncedSearchTerm])

  // Handle view action (Analytics Studio only — uses Analytics dashboard viewer)
  const handleView = useCallback((id: string) => {
    if (analyticsStudio) {
      navigate(`/analytic-studio/dashboards/view?dashboardId=${id}`)
    }
  }, [navigate, analyticsStudio])

  // Handle edit action
  const handleEdit = useCallback((id: string) => {
    if (analyticsStudio) {
      navigate(`/analytic-studio/dashboards/create?dashboardId=${id}`);
    } else if (workflowName) {
      navigate(`/reconciliation/operations/${workflowName}/dashboards/create?edit=${id}`);
    } else {
      navigate(`/visualization/dashboards/create?dashboardId=${id}`);
    }
  }, [navigate, workflowName, analyticsStudio])

  // Handle delete action
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDashboard(id)
      toast.success("Dashboard deleted successfully")
      // Refresh the dashboard list
      fetchDashboards()
    } catch (error) {
      // Error is already handled in the API function
      console.error("Failed to delete dashboard:", error)
    }
  }, [fetchDashboards])


  // Convert dashboards to CustomTableData format with specific columns
  const tableData = useMemo(() => {
    return filteredDashboards.map((dashboard) => {
      const dashboardId = dashboard.id || dashboard._id || Math.random().toString()
      return {
        id: dashboardId,
        dashboard_title: (
          <button
            type="button"
            className="text-left text-primary hover:underline font-medium truncate max-w-[240px]"
            onClick={() => handleView(dashboardId)}
            title={dashboard.dashboard_title || dashboard.title || dashboard.name || "N/A"}
          >
            {dashboard.dashboard_title || dashboard.title || dashboard.name || "N/A"}
          </button>
        ),
        created_user: dashboard.created_user || dashboard.createdUser || dashboard.created_by || "N/A",
        flow_id: dashboard.flow_id || dashboard.flowid || "N/A",
        execution_id: dashboard.execution_id || dashboard.executionId || "N/A",
        source_type: dashboard.source_type || dashboard.sourceType || "N/A",
        connection_type: (
          <ConnectionTypeCell
            connectionType={dashboard.connection_type || dashboard.connectionType}
          />
        ),
        created_at: formatDate(dashboard.created_at || dashboard.createdAt),
        updated_at: formatDate(dashboard.updated_at || dashboard.updatedAt),
        actions: (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="text-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1400]">
                <DropdownMenuItem onClick={() => handleView(dashboardId)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEdit(dashboardId)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(dashboardId)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      }
    })
  }, [filteredDashboards, handleDelete, handleView, handleEdit])

  // Define specific columns
  const columns = useMemo(() => [
    { key: "dashboard_title", header: "Dashboard Title", sortable: true },
    { key: "created_user", header: "Created User", sortable: true },
    ...(analyticsStudio
      ? [
          { key: "source_type", header: "Source Type", sortable: true },
          { key: "connection_type", header: "Connection Type", sortable: true },
        ]
      : [{ key: "execution_id", header: "Execution ID", sortable: true }]),
    { key: "created_at", header: "Created At", sortable: true },
    { key: "updated_at", header: "Updated At", sortable: true },
    { key: "actions", header: "Actions", sortable: false, align: "right" as const, colWidth: 120, colClassName: "fixed-actions-col" },
  ], [analyticsStudio])

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 20 } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.15 } },
  }

  return (
    <div className="w-full space-y-2 bg-background box-border px-2">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 w-full">
          <h2 className="text-[16px] font-semibold shrink-0">Dashboards</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap sm:justify-end flex-1">
            <div className="w-full sm:w-auto sm:max-w-[250px]">
              <SearchBar
                currentValue={searchTerm}
                onSearch={setSearchTerm}
                size="small"
              />
            </div>
            <TooltipProvider>
              <div className="flex items-center rounded-md border bg-muted px-1 py-0.5 gap-1 shadow-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className={`h-6 w-6 rounded-lg ${viewMode === "list"
                        ? "bg-background shadow-sm"
                        : "bg-transparent hover:bg-transparent"
                        }`}
                    >
                      <List className=" h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>List View</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewMode("grid")}
                      className={`h-6 w-6 rounded-lg ${viewMode === "grid"
                        ? "bg-background shadow-sm"
                        : "bg-transparent hover:bg-transparent"
                        }`}
                    >
                      <Grid3x3 className=" h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Grid View</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Button
              variant="default"
              className="!h-7"
              size="sm"
              onClick={() => {
                if (onCreateNew) {
                  onCreateNew();
                } else if (workflowName) {
                  navigate(`/reconciliation/operations/${workflowName}/dashboards/create`);
                } else {
                  navigate('/visualization/dashboards/create');
                }
              }}
            >
              <Plus className="h-4 w-4 mr-0" />
              Dashboard
            </Button>
            <Button
              variant="outline"
              className="!h-7 !w-7 bg-transparent"
              size="icon"
              onClick={() => fetchDashboards()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative w-full">
        {viewMode === "list" ? (
          <>
            <style>{`
              table td:last-child button svg,
              table td:last-child button {
                color: hsl(var(--foreground)) !important;
              }
              table td:last-child button:hover svg,
              table td:last-child button:hover {
                color: hsl(var(--foreground)) !important;
              }
            `}</style>
            <div className="w-full overflow-x-auto">
              <CustomTableData
                data={tableData}
                columns={columns}
                rowKey="id"
                scrollHeightClass="max-h-[550px]"
                emptyState={<div className="p-8 text-center text-slate-500">No dashboards found. Please adjust the search criteria.</div>}
                showSpinnerFlag={isLoading}
                spinnerLabel="Loading dashboards..."
                HorizontalScroll={true}
              />
            </div>
          </>
        ) : (
          <div className="w-full">
            {isLoading ? (
              <div className="flex items-center justify-center p-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground text-sm">Loading dashboards...</p>
                </div>
              </div>
            ) : filteredDashboards.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No dashboards found. Please adjust the search criteria.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredDashboards.map((dashboard) => {
                  const dashboardId = dashboard.id || dashboard._id || Math.random().toString()
                  const title = dashboard.dashboard_title || dashboard.title || dashboard.name || "Untitled Dashboard"
                  const createdUser = dashboard.created_user || dashboard.createdUser || dashboard.created_by || "N/A"
                  const updatedAt = formatDate(dashboard.updated_at || dashboard.updatedAt)

                  return (
                    <motion.div
                      key={dashboardId}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      whileHover={{ scale: 1.02 }}
                      className="min-w-0 rounded"
                    >
                      <Card className="min-w-0 overflow-hidden p-2 hover:shadow-md transition-all duration-200 border hover:border-primary/20">
                        <CardHeader className="min-w-0 overflow-hidden p-0 pb-2">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <CardTitle
                              className="min-w-0 flex-1 overflow-hidden text-base font-semibold leading-snug line-clamp-2 break-words cursor-pointer hover:text-primary"
                              title={title}
                              onClick={() => handleView(dashboardId)}
                            >
                              {title}
                            </CardTitle>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 -mt-1 -mr-1 text-foreground"
                                  aria-label="Dashboard actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[1400]">
                                <DropdownMenuItem onClick={() => handleView(dashboardId)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(dashboardId)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(dashboardId)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 space-y-0">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{createdUser}</span>
                            <span className="ml-2 flex-shrink-0">{updatedAt !== "N/A" ? updatedAt.split(" ")[0] : "N/A"}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 w-full">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, totalItems)} of {totalItems} results
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="!h-7.5 !px-1"
              onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
              disabled={pagination.currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="!h-7.5 !px-1"
              onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 py-1.5 text-sm text-foreground">
              Page {pagination.currentPage} of {Math.ceil(totalItems / pagination.limit) || 1}
            </span>

            <Button
              variant="outline"
              className="!h-7.5 !px-1"
              onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
              disabled={pagination.currentPage >= Math.ceil(totalItems / pagination.limit)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="!h-7.5 !px-1"
              onClick={() => setPagination(p => ({ ...p, currentPage: Math.ceil(totalItems / pagination.limit) }))}
              disabled={pagination.currentPage >= Math.ceil(totalItems / pagination.limit)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>

            <Select
              value={String(pagination.limit)}
              onValueChange={(value) => setPagination(p => ({ ...p, limit: Number(value), currentPage: 1 }))}
            >
              <SelectTrigger className="w-[75px] !h-7.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardsListPage

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, MoreHorizontal, Eye, Edit, List, Grid3x3, Plus, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { toast } from "sonner"
import CustomTableData from "@/components/ui/CustomTableData"
import SearchBar from "@/components/ui/SearchBar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useNavigate } from "react-router"
import { getCharts, deleteChart } from "../Visualization/API/chartsApi"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConnectionTypeCell } from "@/pages/analyticsstudio/ConnectionTypeCell"
import ChartsListGridCard from "@/pages/charts/ChartsListGridCard"

const GRID_PREVIEW_LIMIT = 10

function chartTypeLabel(chart: Chart): string {
  return String(chart.charttype || chart.chart_type || chart.visualization_name || "Chart")
}

interface Chart {
  id: string
  [key: string]: any
}

type ViewMode = "list" | "grid"

interface ChartsListPageProps {
  workflowName?: string;
  analyticsStudio?: boolean;
  onCreateNew?: () => void;
}

const ChartsListPage = ({ workflowName, analyticsStudio, onCreateNew }: ChartsListPageProps = {}) => {
  const navigate = useNavigate()
  const [charts, setCharts] = useState<Chart[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 100 })
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chartToDelete, setChartToDelete] = useState<string | null>(null)
  const [chartToDeleteName, setChartToDeleteName] = useState<string | null>(null)

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchCharts = useCallback(async () => {
    setIsLoading(true)
    try {
      const skip = Math.max(0, pagination.currentPage - 1)
      const limit = pagination.limit

      const response = await getCharts({
        skip,
        limit,
        analyticsStudio,
      })

      if (response) {
        const data = response?.data || response || []
        const total = response?.total || data.length || 0

        setCharts(data)
        setTotalItems(total)
      }
    } catch (error) {
      console.error("API Error:", error)
      setCharts([])
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

  // Fetch charts when pagination changes
  useEffect(() => {
    fetchCharts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit])

  // Convert UTC timestamp to IST and return relative time (e.g., 12m ago)
  const timeAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A"

    try {
      let utcTimestamp: number

      if (dateString.includes("T")) {
        let isoString = dateString.trim()
        const hasTimezone =
          isoString.endsWith("Z") ||
          isoString.includes("+") ||
          !!isoString.match(/[+-]\d{2}:\d{2}$/)

        if (!hasTimezone) {
          isoString = `${isoString}Z`
        }

        const utcDate = new Date(isoString)
        if (isNaN(utcDate.getTime())) return "N/A"
        utcTimestamp = utcDate.getTime()
      } else {
        const utcDate = new Date(`${dateString} UTC`)
        if (isNaN(utcDate.getTime())) return "N/A"
        utcTimestamp = utcDate.getTime()
      }

      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
      const istTimestamp = utcTimestamp + IST_OFFSET_MS
      const nowIST = Date.now() + IST_OFFSET_MS
      const diffMs = nowIST - istTimestamp

      if (diffMs < 0) return "Just now"

      const minutes = Math.floor(diffMs / (1000 * 60))
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      const months = Math.floor(days / 30)
      const years = Math.floor(days / 365)

      if (years > 0) {
        const remMonths = months % 12
        return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`
      }
      if (months > 0) {
        const remDays = days % 30
        return remDays > 0 ? `${months}mo ${remDays}d ago` : `${months}mo ago`
      }
      if (days > 0) {
        const remHours = hours % 24
        return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`
      }
      if (hours > 0) {
        const remMinutes = minutes % 60
        return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`
      }
      if (minutes > 0) return `${minutes}m ago`

      return "Just now"
    } catch {
      return "N/A"
    }
  }

  // Filter charts based on search term
  const filteredCharts = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return charts
    }

    const searchLower = debouncedSearchTerm.toLowerCase().trim()
    return charts.filter((chart) => {
      const searchFields = [
        chart.chartname || chart.chart_name || chart.name,
        chart.created_user || chart.createdUser,
        chart.flowid || chart.flow_id,
        chart.execution_id || chart.executionId,
        chart.charttype || chart.chart_type,
        chart.description,
        chart.source_type || chart.sourceType,
        chart.connection_type || chart.connectionType,
      ].filter(Boolean)

      return searchFields.some(field =>
        String(field).toLowerCase().includes(searchLower)
      )
    })
  }, [charts, debouncedSearchTerm])

  // Handle view action
  const handleView = useCallback((id: string) => {
    if (analyticsStudio) {
      navigate(`/analytic-studio/charts/${id}/edit?view=true`)
    } else if (workflowName) {
      navigate(`/reconciliation/operations/${workflowName}/charts/${id}?view=true`)
    } else {
      navigate(`/visualization/charts/${id}?view=true`)
    }
  }, [navigate, workflowName, analyticsStudio])

  // Handle edit action
  const handleEdit = useCallback((id: string) => {
    if (analyticsStudio) {
      navigate(`/analytic-studio/charts/${id}/edit`)
    } else if (workflowName) {
      navigate(`/reconciliation/operations/${workflowName}/charts/${id}/edit`)
    } else {
      navigate(`/visualization/charts/${id}/edit`)
    }
  }, [navigate, workflowName, analyticsStudio])

  const handleDelete = useCallback((id: string, chartName?: string) => {
    setChartToDelete(id)
    setChartToDeleteName(chartName || null)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!chartToDelete) return

    try {
      const response = await deleteChart({ chart_id: parseInt(chartToDelete) })
      if (response.status) {
        toast.success(response.message || "Chart deleted successfully")
        fetchCharts()
      } else {
        toast.error(response.message || "Failed to delete chart")
      }
    } catch (error) {
      console.error("Error deleting chart:", error)
      toast.error("Failed to delete chart")
    } finally {
      setDeleteDialogOpen(false)
      setChartToDelete(null)
      setChartToDeleteName(null)
    }
  }, [chartToDelete, fetchCharts])

  // Convert charts to CustomTableData format with specific columns
  const tableData = useMemo(() => {
    return filteredCharts.map((chart) => {
      const chartId = chart.id || chart._id || Math.random().toString()
      const description = chart.description || "N/A"
      const truncatedDescription = typeof description === 'string' && description.length > 50
        ? description.substring(0, 40) + '...'
        : description

      const chartName = chart.chartname || chart.chart_name || chart.name || "N/A"

      return {
        id: chartId,
        chartname: chartName,
        created_user: chart.created_user || chart.createdUser || chart.created_by || "N/A",
        flowid: chart.flowid || chart.flow_id || "N/A",
        execution_id: chart.execution_id || chart.executionId || "N/A",
        source_type: chart.source_type || chart.sourceType || "N/A",
        connection_type: (
          <ConnectionTypeCell
            connectionType={chart.connection_type || chart.connectionType}
          />
        ),
        charttype: chart.charttype || chart.chart_type || "N/A",
        created_at: timeAgo((chart.created_at || chart.createdAt || null) as string | null),
        updated_at: timeAgo((chart.updated_at || chart.updatedAt || null) as string | null),
        description: description !== "N/A" && typeof description === 'string' && description.length > 50 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default truncate block">{truncatedDescription}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p className="whitespace-pre-wrap break-words">{description}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span>{description}</span>
        ),
        actions: (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="text-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1400]">
                <DropdownMenuItem onClick={() => handleView(chartId)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEdit(chartId)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(chartId, chartName)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      }
    })
  }, [filteredCharts, handleView, handleEdit, handleDelete])

  // Define specific columns
  const columns = useMemo(() => [
    { key: "chartname", header: "Chart Name", sortable: true },
    { key: "created_user", header: "Created User", sortable: true },
    ...(analyticsStudio
      ? [
        { key: "source_type", header: "Source Type", sortable: true },
        { key: "connection_type", header: "Connection Type", sortable: true },
      ]
      : [{ key: "execution_id", header: "Execution ID", sortable: true }]),
    { key: "charttype", header: "Chart Type", sortable: true },
    { key: "created_at", header: "Created At", sortable: true },
    { key: "updated_at", header: "Updated At", sortable: true },
    { key: "description", header: "Description", sortable: true },
    { key: "actions", header: "Actions", sortable: false, align: "right" as const, colWidth: 100, colClassName: "fixed-actions-col" },
  ], [analyticsStudio])

  return (
    <div className="w-full space-y-2 bg-background px-2 box-border">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 w-full">
          <h2 className="text-[16px] font-semibold shrink-0">Charts</h2>
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
                        : "bg-transparent"
                        }`}
                    >
                      <List className="h-4 w-4" />
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
                        : "bg-transparent"
                        }`}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Grid View</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Button
              variant="outline"
              className="!h-7 !w-7 bg-transparent"
              size="icon"
              onClick={() => fetchCharts()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="default"
              className="!h-7 !pl-2"
              // size="icon"
              onClick={() => {
                if (onCreateNew) {
                  onCreateNew();
                } else if (workflowName) {
                  navigate(`/reconciliation/operations/${workflowName}/charts/create`);
                } else {
                  navigate("/visualization/charts/create");
                }
              }}
              title="Add Chart"
            >
              <Plus className="h-4 w-4" />
              chart
            </Button>
          </div>
        </div>
      </div>

      <div className="relative w-full">
        {viewMode === "list" ? (
          <>
            <style>{`
              /* Ensure action icons stay visible on dark backgrounds (list tables) */
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
                emptyState={<div className="p-8 text-center text-slate-500">No charts found. Please adjust the search criteria.</div>}
                showSpinnerFlag={isLoading}
                spinnerLabel="Loading charts..."
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
                  <p className="mt-2 text-muted-foreground text-sm">Loading charts...</p>
                </div>
              </div>
            ) : filteredCharts.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No charts found. Please adjust the search criteria.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredCharts.map((chart, index) => {
                  const chartId = chart.id || chart._id || Math.random().toString()
                  const chartName = chart.chartname || chart.chart_name || chart.name || "Untitled Chart"
                  const createdUser = chart.created_user || chart.createdUser || chart.created_by || "N/A"
                  const updatedAt = timeAgo((chart.updated_at || chart.updatedAt || null) as string | null)
                  const description = chart.description || chartTypeLabel(chart)

                  return (
                    <ChartsListGridCard
                      key={chartId}
                      chart={chart}
                      chartId={String(chartId)}
                      chartName={chartName}
                      description={description}
                      createdUser={createdUser}
                      updatedAt={updatedAt}
                      analyticsStudio={analyticsStudio}
                      enableLivePreview={index < GRID_PREVIEW_LIMIT}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 w-full">
          <div className="text-sm text-gray-600">
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              {chartToDeleteName ? (
                <span className="font-semibold"> "{chartToDeleteName}"</span>
              ) : (
                " the"
              )}{" "}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)
              setChartToDelete(null)
              setChartToDeleteName(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ChartsListPage


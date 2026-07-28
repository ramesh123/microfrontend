import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { AgGridReact } from "ag-grid-react"
import type { ColDef, ColGroupDef } from "ag-grid-community"
import dynamicConfig from "../../../../../json/dynamic-data-config.json"
import { ArrowLeft, Eye, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface ValidationField {
  [key: string]: any
}

interface ValidationDetails {
  [key: string]: any
}

interface RowData {
  [key: string]: any
}

interface DetailViewProps {
  data: RowData
  onBack: () => void
  config: any
}

interface DynamicConfig {
  detailViewConfig: {
    validationFields: Array<{
      key: string
      displayName: string
      type: string
      fontStyle?: string
      fontWeight?: string
      variant?: string
      align?: string
      defaultValue?: string
    }>
    headerConfig: Record<string, any>
    summaryConfig: Record<string, any>
    statsConfig: Record<string, any>
  }
  columnGroups: Record<string, any>
  standardColumns: Record<string, any>
  data: RowData[]
}

const DynamicFieldRenderer: React.FC<{ field: ValidationField; fieldConfig: any }> = ({ field, fieldConfig }) => {
  const value = field[fieldConfig.key] || fieldConfig.defaultValue || ""

  switch (fieldConfig.type) {
    case "badge":
      return (
        <Badge variant="outline" className="text-xs font-medium px-1 py-0">
          {value}
        </Badge>
      )
    case "status":
      return (
        <div className="flex items-center justify-center gap-1">
          {value === "Pass" ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-green-700 font-bold" />
              <span className="text-green-700 text-xs font-bold">Pass</span>
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-red-700 font-bold" />
              <span className="text-red-700 text-xs font-bold">Fail</span>
            </>
          )}
        </div>
      )
    case "text":
    default:
      const textClasses = [
        "text-xs",
        fieldConfig.fontStyle === "mono" ? "font-mono" : "",
        fieldConfig.fontWeight === "medium" ? "font-medium" : "",
        fieldConfig.fontWeight === "bold" ? "font-bold" : "",
      ]
        .filter(Boolean)
        .join(" ")
      return <span className={textClasses}>{value}</span>
  }
}

const DetailView: React.FC<DetailViewProps> = ({ data, onBack, config }) => {
  const { detailViewConfig } = config
  const validationDetails = data.validationDetails
  const overallResult = validationDetails.totalFailed > 0 ? "Fail" : "Pass"

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto space-y-2">
        <div className="mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to Table
          </button>
        </div>

        {/* Dynamic Header Card */}
        <Card className="border-gray-200 bg-white p-2">
          <CardHeader className="pb-1 pt-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
              <div className="space-y-0">
                <h2 className="text-base font-semibold text-gray-900">
                  {validationDetails[detailViewConfig.headerConfig.componentName.key]}
                </h2>
                <p className="text-xs text-gray-600">
                  {detailViewConfig.headerConfig.validationNumber.displayName}:{" "}
                  {validationDetails[detailViewConfig.headerConfig.validationNumber.key]}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-1 text-xs">
                <Badge variant="outline" className="justify-center px-1 py-0">
                  {detailViewConfig.headerConfig.cycle.displayName}:{" "}
                  {validationDetails[detailViewConfig.headerConfig.cycle.key]}
                </Badge>
                <Badge
                  variant="outline"
                  className={`justify-center px-1 py-0 ${overallResult === "Pass" ? "border-green-400 text-green-700 font-bold" : "border-red-400 text-red-700 font-bold"}`}
                >
                  {overallResult === "Pass" ? (
                    <CheckCircle2 className="w-3 h-3 mr-1 text-green-700 font-bold" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1 text-red-700 font-bold" />
                  )}
                  Result: {overallResult}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Dynamic Dataset Info Card */}
        <Card className="border-gray-200 bg-white">
          <CardContent className="pt-2 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {Object.entries(detailViewConfig.summaryConfig).map(([key, config]: [string, any]) => (
                <div key={key} className={config.colSpan || ""}>
                  <span className="font-medium text-gray-900">{config.displayName}:</span>
                  <span className="ml-1 text-gray-700">{validationDetails[config.key]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Stats Summary */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(detailViewConfig.statsConfig).map(([key, config]: [string, any]) => {
            const IconComponent = config.icon === "CheckCircle2" ? CheckCircle2 : XCircle
            return (
              <Badge key={key} variant="outline" className={`px-1 py-0 ${config.variant === "success" ? "border-green-300 text-green-700 font-bold" : "border-red-300 text-red-700 font-bold"}`}>
                <IconComponent className="w-3 h-3 mr-1" />
                {validationDetails[config.key]} {config.displayName}
              </Badge>
            )
          })}
        </div>

        {/* Dynamic Validation Results Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {detailViewConfig.validationFields.map((fieldConfig: any) => (
                      <TableHead
                        key={fieldConfig.key}
                        className={`font-semibold py-1 text-xs ${fieldConfig.align === "center" ? "text-center" : ""}`}
                      >
                        {fieldConfig.displayName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationDetails.fields.map((field: ValidationField, index: number) => (
                    <TableRow key={index} className={`hover:bg-gray-50 ${field.result === "Fail" ? "bg-gray-50" : ""}`}>
                      {detailViewConfig.validationFields.map((fieldConfig: any) => (
                        <TableCell
                          key={fieldConfig.key}
                          className={`py-1 ${fieldConfig.align === "center" ? "text-center" : ""}`}
                        >
                          <DynamicFieldRenderer field={field} fieldConfig={fieldConfig} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const ViewDataCellRenderer = ({ data, onViewDetail }: { data: RowData; onViewDetail: (data: RowData) => void }) => {
  const handleViewData = () => {
    onViewDetail(data)
  }

  return (
    <Button
      className="flex items-center !bg-transparent justify-center rounded hover:bg-gray-700 transition-colors"
      variant="ghost"
      size="sm"
      onClick={handleViewData}
      title="View Details"
    >
      <Eye size={12} />
    </Button>
  )
}

function DataValidationTable({ config }: { config: DynamicConfig }) {
  const [rowData, setRowData] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<"list" | "detail">("list")
  const [selectedData, setSelectedData] = useState<RowData | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        await new Promise((resolve) => setTimeout(resolve, 300))
        const dynamicData = config as DynamicConfig

        console.log("Dynamic Data", dynamicData)
        setRowData(dynamicData.data)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleViewDetail = (data: RowData) => {
    setSelectedData(data)
    setCurrentView("detail")
  }

  const handleBackToList = () => {
    setCurrentView("list")
    setSelectedData(null)
  }

  // Cell style functions
  const resultCellStyle = (params: any) => ({
    backgroundColor: params.value === "PASS" ? "#f9fafb" : "#f9fafb",
    color: params.value === "PASS" ? "green" : "red",
    fontWeight: "bold",
    borderRight: "1px solid #e5e7eb",
  })

  // Dynamic column generation from JSON configuration
  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    if (!config) return []

    const generatedColumns: (ColDef | ColGroupDef)[] = []

    // Generate column groups
    Object.values(config?.columnGroups).forEach((group: any) => {
      const groupDef: ColGroupDef = {
        headerName: group.headerName,
        headerClass: group.headerClass,
        children: [],
      }

      // Generate columns within the group
      Object.values(group.columns).forEach((column: any) => {
        const colDef: ColDef = {
          field: column.field,
          headerName: column.headerName,
          width: column.width,
          headerTooltip: column.headerTooltip,
          sortable: column.sortable,
          filter: column.filter,
          cellStyle: {
            backgroundColor: "#ffffff",
            borderRight: "1px solid #e5e7eb",
            padding: "2px",
          },
        }

        if (groupDef.children) {
          groupDef.children.push(colDef)
        }
      })

      generatedColumns.push(groupDef)
    })

    // Generate standard columns
    Object.entries(config.standardColumns).forEach(([key, column]: [string, any]) => {
      const colDef: ColDef = {
        headerName: column.headerName,
        width: column.width,
        headerClass: column.headerClass,
        headerTooltip: column.headerTooltip,
        sortable: column.sortable,
        filter: column.filter,
      }

      // Add field if it exists
      if (column.field) {
        colDef.field = column.field
      }

      // Add pinned if it exists
      if (column.pinned) {
        colDef.pinned = column.pinned as "left" | "right"
      }

      // Add cell style
      if (column.style) {
        colDef.cellStyle = {
          backgroundColor: "#ffffff",
          padding: "2px",
          justifyContent: "center",
        }
      }

      // Handle special cell renderers and styles
      if (column.cellStyleFunction === "resultCellStyle") {
        colDef.cellStyle = resultCellStyle
      }

      if (column.cellRenderer === "viewDataCellRenderer") {
        colDef.cellRenderer = (params: any) => (
          <ViewDataCellRenderer data={params.data} onViewDetail={handleViewDetail} />
        )
      }

      generatedColumns.push(colDef)
    })

    return generatedColumns
  }, [config])

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      flex: 0,
      tooltipShowDelay: 500,
    }),
    [],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading data...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700">Failed to load configuration</p>
        </div>
      </div>
    )
  }

  if (currentView === "detail" && selectedData) {
    return <DetailView data={selectedData} onBack={handleBackToList} config={config} />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-full mx-auto">
        <div className="mb-3">
          <div className="flex flex-wrap gap-1 mt-0 text-xs">
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-semibold">Total Records: {rowData.length}</span>
            <Badge className="bg-green-200 text-green-800 px-2 py-1 hover:bg-green-300 rounded">
              Passed: {rowData.filter((row) => row.Result === "PASS").length}
            </Badge>
            <Badge className="bg-red-200 text-red-800 px-2 py-1 hover:bg-red-300 rounded">
              Failed: {rowData.filter((row) => row.Result === "FAIL").length}
            </Badge>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="ag-theme-alpine" style={{ height: 500, width: "100%" }}>
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              enableRangeSelection={true}
              enableBrowserTooltips={true}
              animateRows={true}
              rowSelection="multiple"
              pagination={true}
              paginationPageSize={20}
              getRowId={(params) => params.data.id}
              suppressRowClickSelection={true}
              headerHeight={40}
              rowHeight={32}
              tooltipShowDelay={300}
              tooltipHideDelay={1000}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataValidationTable
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** When true, all rows in `data` are shown; pagination is handled by the parent (e.g. server-side). */
  serverPaginated?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  serverPaginated = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    ...(serverPaginated
      ? { manualPagination: true as const }
      : { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full space-y-1 " >
        <div className="flex items-center justify-between">
            {/* <h1 className="text-sm lg:text-sm font-bold tracking-tight">
                {table.getFilteredRowModel().rows.length} Flows
            </h1> */}
            <div className="flex items-center gap-2">
                <div className="relative">
                    {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search flows..."
                        value={(table.getColumn("flowName")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("flowName")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 w-64 lg:w-80"
                    /> */}
                </div>
                
            </div>
        </div>

        <div className="rounded-lg border bg-card p-0 m-0 ">
            <Table >
                <TableHeader className="font-bold">
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} >
                    {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort()
                        const sorted = header.column.getIsSorted()
                        return (
                        <TableHead key={header.id} className={canSort ? "select-none" : undefined}>
                            {header.isPlaceholder ? null : canSort ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="-ml-2 h-8 gap-1 px-2 font-semibold hover:bg-muted/80 data-[state=open]:bg-muted"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                {sorted === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                                ) : sorted === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" aria-hidden />
                                )}
                              </Button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )
                            )}
                        </TableHead>
                        )
                    })}
                    </TableRow>
                ))}
                </TableHeader>
                <TableBody  >
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                    <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                    >
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-xs font-normal text-gray-800" >
                            {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                            )}
                            
                        </TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell
                        colSpan={columns.length}
                        className="h-20 text-center"
                    >
                        No results.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
      
       
    </div>
  )
}

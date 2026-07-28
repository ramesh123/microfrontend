import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronsRight,
  ChevronRight,
  ChevronsLeft,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaginationProps = {
  steps: number[];
  currentPage: number;
  pageSize: number;
};

type SortedColumns = Record<string, "asc" | "desc">;

interface TableComponentProps<T extends object> {
  data: T[];
  columns: ColumnDef<T, any>[];
  totalRows: number;
  pagination: PaginationProps;
  loading: boolean;
  /** Override the table scroll region layout when parent controls height. */
  scrollContainerClassName?: string;
  /** Inline styles for the table body scroll container (e.g. dynamic min height). */
  scrollContainerStyle?: React.CSSProperties;
  /** Ref for the table body scroll container (e.g. scroll to top on refresh). */
  scrollContainerRef?: React.Ref<HTMLDivElement>;
  onChangePagination: (params: {
    currentPage: number;
    limit: number;
    sortedColumns?: SortedColumns;
  }) => void;
  /** Row click (ignores clicks on buttons, links, inputs, checkboxes). */
  onRowClick?: (row: T) => void;
  /** `range` → “1 - 10 of 2868” (ThingsBoard-style). Default `rows` → “N Rows”. */
  paginationSummary?: "rows" | "range";
  /** Whether to show explicit Skip and Limit values in the pagination summary. */
  showSkipLimit?: boolean;
  /** Column header text casing (default uppercase for legacy tables). */
  headerUppercase?: boolean;
}

const TableWithPagination = <T extends object>({
  data = [],
  columns = [],
  totalRows = 0,
  pagination = {
    steps: [20, 50, 100],
    currentPage: 1,
    pageSize: 20,
  },
  loading = false,
  scrollContainerClassName,
  scrollContainerStyle,
  scrollContainerRef,
  onChangePagination = () => {},
  onRowClick,
  paginationSummary = "rows",
  showSkipLimit = false,
  headerUppercase = true,
}: TableComponentProps<T>) => {
  const [columnFilters, setColumnFilters] = React.useState<any>([]);
  const internalScrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const setScrollContainerRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      internalScrollContainerRef.current = node;
      if (!scrollContainerRef) return;
      if (typeof scrollContainerRef === "function") {
        scrollContainerRef(node);
      } else {
        (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [scrollContainerRef],
  );

  const table = useReactTable({
    data,
    columns,
    filterFns: {},
    state: {
      columnFilters,
    },
    initialState: {
      pagination: {
        pageIndex: pagination.currentPage,
        pageSize: pagination.pageSize,
      },
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(1, Math.ceil(totalRows / pagination.pageSize) || 1),
    autoResetPageIndex: false,
    /** First click on a sortable column uses descending (then asc / clear per cycle). */
    sortDescFirst: true,
  });

  React.useEffect(() => {
    const { pageIndex, pageSize } = table.getState().pagination;
    const sorting = table.getState().sorting;

    const latestSort = sorting?.[sorting.length - 1];
    const sortedColumns: SortedColumns =
      latestSort && latestSort.id
        ? { [latestSort.id]: latestSort.desc ? "desc" : "asc" }
        : {};

    onChangePagination({
      currentPage: pageIndex,
      limit: pageSize,
      sortedColumns,
    });
  }, [
    table.getState().pagination.pageIndex,
    table.getState().pagination.pageSize,
    table.getState().sorting,
  ]);

  /** Keep table page in sync when parent resets page (e.g. filter change). */
  React.useEffect(() => {
    const { pageIndex } = table.getState().pagination;
    if (pageIndex !== pagination.currentPage) {
      table.setPageIndex(pagination.currentPage);
    }
  }, [pagination.currentPage, table]);

  React.useEffect(() => {
    const ps = table.getState().pagination.pageSize;
    if (ps !== pagination.pageSize) {
      table.setPageSize(pagination.pageSize);
    }
  }, [pagination.pageSize, table]);

  React.useEffect(() => {
    internalScrollContainerRef.current?.scrollTo({ top: 0, left: 0 });
  }, [data, pagination.currentPage, pagination.pageSize]);

  return (
    <div className="flex h-full w-full max-w-full flex-col">
      <div
        ref={setScrollContainerRefs}
        className={cn("max-h-[620px] w-full overflow-auto", scrollContainerClassName)}
        style={scrollContainerStyle}
      >
        <table className="w-full min-w-[1100px] border-collapse table-fixed text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/60 bg-muted">
                {headerGroup.headers.map((header, index) => {
                  const isLast = index === headerGroup.headers.length - 1;
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "sticky top-0 z-20 select-none bg-muted px-2 py-2.5 text-left text-xs font-semibold leading-snug tracking-wide text-muted-foreground",
                        headerUppercase && "uppercase",
                        header.column.getCanSort() && "cursor-pointer hover:bg-muted/80",
                        isLast && "right-0 border-0 shadow-none",
                      )}
                      style={{ width: `${header.column.columnDef.size || 120}px` }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {(() => {
                        const sortState = header.column.getIsSorted();
                        if (sortState === "asc") return " 🔼";
                        if (sortState === "desc") return " 🔽";
                        return null;
                      })()}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: pagination.pageSize }).map((_, i) => (
                <tr key={i} className="border-b bg-background">
                  {columns.map((col, j) => (
                    <td
                      key={j}
                      className="px-2 py-2.5 text-left align-middle"
                      style={{ width: `${(col as ColumnDef<T>).size || 120}px` }}
                    >
                      <div className="h-4 w-3/4 max-w-full animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const cells = row.getVisibleCells();
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "group border-b bg-background transition-colors hover:bg-muted/40",
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={(e) => {
                      if (!onRowClick) return;
                      const t = e.target as HTMLElement;
                      if (
                        t.closest(
                          "button,a,input,textarea,select,label,[role='checkbox'],[data-slot='checkbox']",
                        )
                      ) {
                        return;
                      }
                      onRowClick(row.original);
                    }}
                  >
                    {cells.map((cell, index) => {
                      const isLast = index === cells.length - 1;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-2 py-2.5 text-left align-middle",
                            isLast &&
                              "sticky right-0 z-10 border-0 bg-background shadow-none group-hover:bg-muted/40",
                          )}
                          style={{ width: `${cell.column.columnDef.size || 120}px` }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Data not found. Please adjust the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
  
      {paginationSummary === "range" ? (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-background px-1 py-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span>
              {totalRows === 0
                ? "0"
                : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} - ${Math.min(
                    totalRows,
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  )}`}{" "}
              of {totalRows}
            </span>
            {showSkipLimit && (
              <div className="flex items-center gap-2 border-l pl-2">
                <span>
                  Skip: <strong>{table.getState().pagination.pageIndex}</strong>
                </span>
                <span>
                  Limit: <strong>{table.getState().pagination.pageSize}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span>
              Page{" "}
              <span className="text-foreground">{table.getState().pagination.pageIndex + 1}</span> of{" "}
              {table.getPageCount()}
            </span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(val) => table.setPageSize(Number(val))}
            >
              <SelectTrigger className="!h-7 w-[4.5rem] text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {pagination.steps.map((step) => (
                  <SelectItem key={step} value={String(step)}>
                    {step}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-1 py-1 sm:flex-row sm:items-center sm:justify-end">
          <>
            <div className="text-sm text-muted-foreground tabular-nums">{totalRows} Rows</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Page</span>
              <strong>
                {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </strong>
              <span className="mx-2 hidden sm:inline">| Go to Page:</span>
              <Input
                type="number"
                min={1}
                max={table.getPageCount()}
                className="h-7 w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm sm:w-20"
                defaultValue={table.getState().pagination.pageIndex + 1}
                onBlur={(e) => {
                  const page = Number(e.target.value);
                  if (!isNaN(page) && page >= 1 && page <= table.getPageCount()) {
                    table.setPageIndex(page - 1);
                  }
                }}
              />
              <span className="hidden text-muted-foreground sm:inline">Items per page</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(val) => table.setPageSize(Number(val))}
              >
                <SelectTrigger className="w-[80px] sm:w-[100px] !h-7">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  {pagination.steps.map((step) => (
                    <SelectItem key={step} value={String(step)}>
                      {step}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        </div>
      )}
    </div>
  );
  
};

export default TableWithPagination;

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import ReactDOM from "react-dom";
import SpinnerV2 from "./SpinnerV2.tsx";
import { useTheme } from "@/context/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";
type SortDir = "asc" | "desc" | null;

interface Column {
    key: string;
    header: React.ReactNode;
    colWidth?: number | string;
    width?: number;
    align?: Align;
    sortable?: boolean;
    filterable?: boolean;
    TruncateData?: boolean;
    truncateAt?: number;
    sortKey?: string;
    filterKey?: string;
    truncateData?: boolean;
    colClassName?: string;
    shrink?: boolean;
    maxWidth?: number | string;
    variant?: string;
    /** When set, cell content is fully custom (e.g. multiline or buttons). */
    renderCell?: (row: Row) => React.ReactNode;
}

interface SortState {
    key: string | null;
    dir: SortDir;
}

interface ModalState {
    open: boolean;
    title: string;
    content: React.ReactNode;
}

type Row = Record<string, unknown>;

type PaginationConfig = {
    steps?: number[];
    /** 0-based page index. */
    currentPage: number;
    pageSize: number;
    totalRows: number;
    loading?: boolean;
    onChange: (params: { currentPage: number; limit: number }) => void;
};

type Props = {
    data?: Row[];
    columns?: Column[];
    rowKey?: string;
    scrollHeightClass?: string;
    emptyState?: React.ReactNode;
    truncateCharLimit?: number;
    showSpinnerFlag?: boolean;
    spinnerLabel?: string;
    HorizontalScroll?: boolean;
    /**
     * When true, the scroll viewport grows within a flex parent (min-h-0 / flex-1) instead of using
     * `scrollHeightClass` max-height caps — use with a parent that has a defined height.
     */
    scrollAreaFillsParent?: boolean;
    /**
     * When set, the scroll viewport uses this pixel max-height and scrolls after; table stays only as
     * tall as content up to this cap (use with shrink-wrap / h-auto parents).
     */
    scrollViewportMaxHeightPx?: number;
    onSortChange?: (key: string | null, dir: SortDir) => void;
    roundDecimals?: number;
    /**
     * When true, long text cells show the full value wrapped (with `title` tooltip) instead of
     * ellipsis + “View more” (e.g. chart / insight tables).
     */
    wrapLongCells?: boolean;
    /** Extra classes on body `<td>` cells. Default: `h-9`. */
    bodyCellClassName?: string;
    /** When false, last column header uses normal padding instead of `pl-10`. Default true. */
    lastColumnHeaderPadding?: boolean;
    /** TableWithPagination-style footer pagination. */
    pagination?: PaginationConfig;
};

type GetComparableOpts = { forFilter?: boolean };

const DEFAULT_BODY_CELL_CLASS = "h-9";

const getColSizeStyle = ( 
    val: number | string | undefined,
    { shrink = false, maxWidth }: { shrink?: boolean; maxWidth?: number | string } = {}
): React.CSSProperties | undefined => {
    if (val == null) return undefined;
    if (typeof val === "number") {
        return {
            width: `${val}px`,
            ...(shrink ? {} : { minWidth: `${val}px` }),
            ...(maxWidth ? { maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth } : {}),
        };
    }
    return {
        width: val,
        ...(shrink ? {} : { minWidth: val }),
        ...(maxWidth ? { maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth } : {}),
    };
};

export default function CustomTableData({
    data = [],
    columns = [],
    rowKey = "id",
    scrollHeightClass = "",
    emptyState = <div className="p-8 text-center text-slate-500 dark:text-slate-400">No data.</div>,
    truncateCharLimit = 28,
    showSpinnerFlag = false,
    spinnerLabel = "Loading...",
    HorizontalScroll = false,
    scrollAreaFillsParent = false,
    scrollViewportMaxHeightPx,
    onSortChange,
    roundDecimals,
    wrapLongCells = false,
    bodyCellClassName,
    lastColumnHeaderPadding = true,
    pagination,
}: Props) {
    const { theme } = useTheme();
    const [sort, setSort] = useState<SortState>({ key: null, dir: null });
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [modal, setModal] = useState<ModalState>({ open: false, title: "", content: "" });

    const theadRef = useRef<HTMLTableSectionElement | null>(null);
    const [theadHeight, setTheadHeight] = useState<number>(0);

    useEffect(() => {
        const update = () => {
            const h = theadRef.current?.getBoundingClientRect?.().height ?? 0;
            setTheadHeight(h);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    useEffect(() => {
        const h = theadRef.current?.getBoundingClientRect?.().height ?? 0;
        setTheadHeight(h);
    }, [columns, showSpinnerFlag]);

    // Force recalculation when theme changes to prevent overlapping
    useEffect(() => {
        // Small delay to ensure theme classes are applied
        const timer = setTimeout(() => {
            const h = theadRef.current?.getBoundingClientRect?.().height ?? 0;
            setTheadHeight(h);
            // Force a reflow to ensure proper rendering
            if (theadRef.current) {
                theadRef.current.offsetHeight;
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [theme]);

    const cols: Column[] = useMemo(
        () =>
            columns.map((c) => ({
                align: "left",
                ...c,
                TruncateData: c.TruncateData ?? c.truncateData ?? false,
                truncateAt: c.truncateAt ?? truncateCharLimit,
            })),
        [columns, truncateCharLimit]
    );

    /** Sticky right column (e.g. `colClassName: fixed-actions-col`) — theme-aware, avoids hardcoded white in dark mode */
    const hasStickyActionColumn = useMemo(
        () => cols.some((c) => (c.colClassName ?? "").includes("fixed-actions-col")),
        [cols]
    );

    const extractText = (node: unknown): string => {
        if (node == null) return "";
        if (typeof node === "boolean") return node ? "true" : "false";
        if (typeof node === "string" || typeof node === "number") return String(node);
        if (node instanceof Date && !Number.isNaN(node.getTime())) return node.toString();
        if (Array.isArray(node)) return node.map(extractText).join(" ");
        if (React.isValidElement(node)) {
            // @ts-expect-error children typing can be varied
            return extractText(node.props?.children);
        }
        return "";
    };

    const getComparable = (row: Row, col: Column, { forFilter = false }: GetComparableOpts = {}): string => {
        const accessor = forFilter ? col.filterKey : col.sortKey;
        const raw = accessor ? deepGet(row, accessor) : deepGet(row, col.key);
        return extractText(raw);
    };

    const normalizeText = (s: unknown): string => String(s).replace(/\s+/g, " ").trim();

    const filtered: Row[] = useMemo(() => {
        if (!Object.keys(filters).length) return data;
        return data.filter((r) =>
            Object.entries(filters).every(([key, query]) => {
                if (!query) return true;
                const col = cols.find((c) => c.key === key);
                if (!col) return true;
                const value = getComparable(r, col, { forFilter: true });
                return normalizeText(value).toLowerCase().includes(String(query).toLowerCase());
            })
        );
    }, [data, filters, cols]);

    const sorted: Row[] = useMemo(() => {
        if (!sort.key || !sort.dir) return filtered;
        const col = cols.find((c) => c.key === sort.key);
        if (!col) return filtered;
        const dir = sort.dir === "asc" ? 1 : -1;

        return [...filtered].sort((a, b) => {
            const av = normalizeText(getComparable(a, col)).toLowerCase();
            const bv = normalizeText(getComparable(b, col)).toLowerCase();
            return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * dir;
        });
    }, [filtered, sort, cols]);

    const toggleSort = (key: string): void => {
        setSort((prev: SortState) => {
            let next: SortState;
            if (prev.key !== key) next = { key, dir: "asc" };
            else if (prev.dir === "asc") next = { key, dir: "desc" };
            else next = { key: null, dir: null };
            try { onSortChange?.(next.key, next.dir); } catch { }
            return next;
        });
    };

    const capPx =
        scrollViewportMaxHeightPx != null &&
        Number.isFinite(scrollViewportMaxHeightPx) &&
        scrollViewportMaxHeightPx > 0
            ? scrollViewportMaxHeightPx
            : null;
    const scrollViewportStyle: React.CSSProperties | undefined =
        !scrollAreaFillsParent && capPx != null ? { maxHeight: capPx } : undefined;

    const scrollViewportClass = scrollAreaFillsParent
        ? [
              "relative",
              "min-h-0",
              "flex-1",
              showSpinnerFlag ? "overflow-y-hidden" : "overflow-y-auto",
              "overflow-x-auto",
          ].join(" ")
        : capPx != null
          ? [
                "relative",
                "min-h-0",
                showSpinnerFlag ? "overflow-y-hidden" : "overflow-y-auto",
                "overflow-x-auto",
            ].join(" ")
          : [
                "relative",
                scrollHeightClass,
                showSpinnerFlag ? "overflow-y-hidden" : "overflow-y-auto",
                "overflow-x-auto",
            ].join(" ");

    return (
        <div
            className={[
                "w-full",
                "custom-table-data",
                "relative",
                hasStickyActionColumn ? "custom-table-data--sticky-actions" : "",
                scrollAreaFillsParent ? "flex min-h-0 min-w-0 flex-1 flex-col" : "",
            ]
                .filter(Boolean)
                .join(" ")}
            aria-busy={showSpinnerFlag}
        >
            <style>{`
                /* border-separate: sticky thead works reliably vs border-collapse (WebKit) */
                .custom-table-data .custom-table-data-scroll > table {
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .custom-table-data .custom-table-data-scroll > table > thead > tr > th {
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    /* --muted / --border are oklch or hex in this app — do not wrap in hsl() */
                    background-color: var(--muted) !important;
                    background-clip: padding-box;
                    box-shadow: 0 1px 0 0 var(--border);
                }
                .custom-table-data .custom-table-data-scroll > table > thead > tr > th button {
                    background-color: var(--muted) !important;
                }
                .custom-table-data .custom-table-data-scroll > table > tbody {
                    position: relative;
                    z-index: 0;
                }
                .custom-table-data .custom-table-data-scroll > table > tbody > tr > td {
                    background-color: var(--background);
                    background-clip: padding-box;
                    border-bottom: 1px solid var(--border);
                }
                .custom-table-data .custom-table-data-scroll > table > tbody > tr:hover > td {
                    background-color: color-mix(in srgb, var(--muted) 50%, var(--background));
                }
                /* Fix button hover background in table cells */
                .custom-table-data table tbody td button,
                .custom-table-data table tbody td a {
                    background-color: transparent !important;
                }
                .custom-table-data table tbody td button:hover,
                .custom-table-data table tbody td a:hover {
                    background-color: transparent !important;
                    background: transparent !important;
                }
                .custom-table-data table tbody td button:focus,
                .custom-table-data table tbody td a:focus {
                    background-color: transparent !important;
                    background: transparent !important;
                }
                .custom-table-data table tbody td button:active,
                .custom-table-data table tbody td a:active {
                    background-color: transparent !important;
                    background: transparent !important;
                }
                /* Ensure icons maintain theme colors */
                .custom-table-data table tbody td button svg,
                .custom-table-data table tbody td a svg {
                    background-color: transparent !important;
                }
                .custom-table-data table tbody td button:hover svg,
                .custom-table-data table tbody td a:hover svg {
                    background-color: transparent !important;
                }
            `}</style>
            {hasStickyActionColumn ? (
                <style>{`
                .custom-table-data--sticky-actions table th.fixed-actions-col,
                .custom-table-data--sticky-actions table td.fixed-actions-col {
                    position: sticky !important;
                    right: 0 !important;
                    z-index: 10 !important;
                }
                .custom-table-data--sticky-actions table thead th.fixed-actions-col {
                    top: 0 !important;
                    right: 0 !important;
                    z-index: 25 !important;
                }
                .custom-table-data--sticky-actions table tbody td.fixed-actions-col {
                    background-color: var(--background) !important;
                    box-shadow: -8px 0 12px -10px color-mix(in srgb, var(--foreground) 14%, transparent);
                }
                .custom-table-data--sticky-actions table thead th.fixed-actions-col {
                    background-color: var(--muted) !important;
                }
                .custom-table-data--sticky-actions table tbody tr:hover td.fixed-actions-col {
                    background-color: color-mix(in srgb, var(--muted) 50%, var(--background)) !important;
                }
            `}</style>
            ) : null}
            <div
                className={
                    scrollAreaFillsParent
                        ? "relative flex min-h-0 min-w-0 flex-1 flex-col"
                        : ""
                }
            >
                <div
                    className={[scrollViewportClass, "custom-table-data-scroll isolate"].filter(Boolean).join(" ")}
                    style={scrollViewportStyle}
                >
                    <table className={["w-full", "border-1"].join(" ")} style={{ tableLayout: 'auto', width: '100%', minWidth: 'max-content' }}>
                        <colgroup>
                            {cols.map((c) => {
                                const hasExplicitWidth = c.colWidth != null || c.width != null;
                                return (
                                    <col
                                        key={c.key}
                                        className={c.colClassName}
                                        style={
                                            c.colClassName
                                                ? undefined
                                                : hasExplicitWidth
                                                    ? getColSizeStyle(c.colWidth ?? c.width, { shrink: c.shrink, maxWidth: c.maxWidth })
                                                    : { width: 'auto' }
                                        }
                                    />
                                );
                            })}
                        </colgroup>
                        <thead ref={theadRef}>
                            <tr className="border-b border-border/60 text-left text-sm">
                                {cols.map((c, colIndex) => {
                                    const sortableEnabled = !!c.sortable;
                                    const isFilterActive = !!(filters[c.key] ?? "").trim();
                                    const isLastCol = colIndex === cols.length - 1;
                                    const headerAlignClass = isLastCol
                                        ? (lastColumnHeaderPadding ? "!text-lefts !pl-10" : "text-left")
                                        : (c.align === "center" ? "text-center" : c.align === "right" ? "text-right" : "text-left");
                                    return (
                                        <th
                                            key={c.key}
                                            className={cn(
                                                "select-none bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                                                sortableEnabled && "cursor-pointer",
                                                isFilterActive ? "border-b-2 border-primary" : "border-b border-border/60",
                                                headerAlignClass,
                                                c.colClassName,
                                            )}
                                            style={{
                                                minWidth: 0,
                                                whiteSpace: "nowrap",
                                                backgroundColor: "var(--muted)",
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    className={`inline-flex items-center gap-1 bg-muted ${sortableEnabled ? "cursor-pointer select-none" : "cursor-default"
                                                        }`}
                                                    style={{ backgroundColor: "var(--muted)" }}
                                                    onClick={sortableEnabled ? () => toggleSort(c.key) : undefined}
                                                >
                                                    <span>{c.header}</span>
                                                    {sortableEnabled && <SortIcon state={sort.key === c.key ? sort.dir : null} />}
                                                </button>
                                                {c.filterable && (
                                                    <FilterPopover
                                                        value={filters[c.key] ?? ""}
                                                        onChange={(v: string) => setFilters((prev) => ({ ...prev, [c.key]: v }))}
                                                    />
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {sorted.length === 0 ? (
                                <tr>
                                    <td colSpan={cols.length}>{emptyState}</td>
                                </tr>
                            ) : (
                                sorted.map((row, i) => {
                                    const isConfiguring = (row as any).isConfiguring
                                    return (
                                        <tr
                                            key={(row[rowKey] as React.Key) ?? i}
                                            className="transition-colors"
                                        >
                                            {cols.map((c, cellIndex) => {
                                                const cell = deepGet(row, c.key);
                                                const rawPrimitive = typeof cell === "string" || typeof cell === "number" ? String(cell) : null;
                                                const primitive = rawPrimitive != null && roundDecimals != null && isFiniteNum(rawPrimitive) && rawPrimitive.includes('.')
                                                    ? Number(rawPrimitive).toFixed(roundDecimals)
                                                    : rawPrimitive;
                                                const shouldTruncate =
                                                    !!c.TruncateData && !!primitive && primitive.length > (c.truncateAt ?? truncateCharLimit);
                                                const isLastCol = cellIndex === cols.length - 1;
                                                const alignClass = isLastCol ? "text-left" : (c.align === "center" ? "text-center" : c.align === "right" ? "text-right" : "text-left");
                                                const isStatusBadge = c.variant === "badge" || c.key?.toLowerCase?.() === "status";

                                                // Add rounded corners to first and last cells when configuring
                                                const isFirstCell = cellIndex === 0
                                                const isLastCell = cellIndex === cols.length - 1
                                                const roundClass = isConfiguring
                                                    ? isFirstCell
                                                        ? 'rounded-l-lg'
                                                        : isLastCell
                                                            ? 'rounded-r-lg'
                                                            : ''
                                                    : ''

                                                const isConfigRow = (row as any).isConfigRow

                                                return (
                                                    <td
                                                        key={c.key}
                                                        colSpan={isConfigRow && cellIndex === 0 ? cols.length : undefined}
                                                        className={cn(
                                                            "border-b px-4 align-middle font-medium text-foreground",
                                                            bodyCellClassName ?? DEFAULT_BODY_CELL_CLASS,
                                                            alignClass,
                                                            c.colClassName,
                                                            isConfiguring && `bg-purple-50 dark:bg-purple-900/20 ${roundClass}`,
                                                        )}
                                                        style={{
                                                            minWidth: 0
                                                        }}
                                                    >
                                                        {isConfigRow && cellIndex === 0 ? (
                                                            // For configuration rows, render the cell content
                                                            <>{cell as React.ReactNode}</>
                                                        ) : isConfigRow ? (
                                                            // Empty cell for other columns in config row
                                                            null
                                                        ) : c.renderCell ? (
                                                            <div className="min-w-0 max-w-[40rem] font-normal text-foreground">
                                                                {c.renderCell(row)}
                                                            </div>
                                                        ) : isStatusBadge && primitive ? (
                                                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                                                                {primitive}
                                                            </span>
                                                        ) : shouldTruncate && wrapLongCells ? (
                                                            <span
                                                                className="block max-w-[min(36rem,85vw)] whitespace-pre-wrap break-words text-left align-top font-normal text-foreground"
                                                                title={primitive!}
                                                            >
                                                                {primitive}
                                                            </span>
                                                        ) : shouldTruncate ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {primitive!.slice(0, c.truncateAt ?? truncateCharLimit)}…
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="text-blue-600 cursor-pointer text-nowrap text-xs underline underline-offset-2"
                                                                    onClick={() =>
                                                                        setModal({
                                                                            open: true,
                                                                            title: String(c.header ?? ""),
                                                                            content: primitive!,
                                                                        })
                                                                    }
                                                                >
                                                                    View more
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ whiteSpace: 'nowrap' }}>{primitive ?? (cell as React.ReactNode) ?? "-"}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>

                    {showSpinnerFlag && (
                        <div
                            className="absolute z-40 flex items-center justify-center bg-background"
                            style={{ top: theadHeight, left: 0, right: 0, bottom: 0 }}
                            role="presentation"
                        >
                            <SpinnerV2 label={spinnerLabel} />
                        </div>
                    )}
                </div>
            </div>

            {pagination ? (
                <TableFooterPagination
                    steps={pagination.steps}
                    currentPage={pagination.currentPage}
                    pageSize={pagination.pageSize}
                    totalRows={pagination.totalRows}
                    loading={pagination.loading}
                    onChange={pagination.onChange}
                />
            ) : null}

            <Modal
                open={modal.open}
                title={modal.title}
                onClose={() => setModal({ open: false, title: "", content: "" })}
            >
                <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-foreground">
                    {modal.content}
                </div>
            </Modal>
        </div>
    );
}

/* ---------------- UI bits ---------------- */

type TableFooterPaginationProps = {
    steps?: number[];
    currentPage: number;
    pageSize: number;
    totalRows: number;
    loading?: boolean;
    onChange: (params: { currentPage: number; limit: number }) => void;
};

function TableFooterPagination({
    steps = [10, 20, 50, 100],
    currentPage,
    pageSize,
    totalRows,
    loading = false,
    onChange,
}: TableFooterPaginationProps) {
    const safeTotal = Math.max(0, Math.trunc(Number(totalRows) || 0));
    const safeLimit = Math.max(1, Math.trunc(Number(pageSize) || 10));
    const pageCount = Math.max(1, Math.ceil(safeTotal / safeLimit));
    const safePage = Math.min(pageCount - 1, Math.max(0, Math.trunc(Number(currentPage) || 0)));

    const start = safeTotal === 0 ? 0 : safePage * safeLimit + 1;
    const end = Math.min(safeTotal, (safePage + 1) * safeLimit);

    const canPrev = safePage > 0 && !loading;
    const canNext = safePage < pageCount - 1 && !loading;

    return (
        <div className="flex flex-col gap-1.5 border-t border-border bg-background px-1 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[11px]  tabular-nums">
                <span>{safeTotal === 0 ? "0" : `${start} - ${end}`} of {safeTotal}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]  sm:justify-end">
                <span>
                    Page <strong className="text-foreground">{safePage + 1}</strong> of {pageCount}
                </span>

                <span className="mx-2 hidden sm:inline">| Go to Page:</span>
                <Input
                    type="number"
                    min={1}
                    max={pageCount}
                    disabled={loading}
                    className="!h-7 w-16 rounded-md border border-input bg-background px-2 py-1.5 text-[10px] shadow-sm sm:w-20"
                    defaultValue={safePage + 1}
                    onBlur={(e) => {
                        const page = Number(e.target.value);
                        if (!Number.isNaN(page) && page >= 1 && page <= pageCount) {
                            onChange({ currentPage: page - 1, limit: safeLimit });
                        }
                    }}
                />

                <Select
                    value={String(safeLimit)}
                    onValueChange={(val) => onChange({ currentPage: 0, limit: Number(val) })}
                    disabled={loading}
                >
                    <SelectTrigger className="!h-7 w-[4.5rem] text-[13px]">
                        <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                        {steps.map((step) => (
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
                        onClick={() => onChange({ currentPage: 0, limit: safeLimit })}
                        disabled={!canPrev}
                    >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onChange({ currentPage: safePage - 1, limit: safeLimit })}
                        disabled={!canPrev}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onChange({ currentPage: safePage + 1, limit: safeLimit })}
                        disabled={!canNext}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onChange({ currentPage: pageCount - 1, limit: safeLimit })}
                        disabled={!canNext}
                    >
                        <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

type SortIconProps = { state: SortDir };
function SortIcon({ state }: SortIconProps) {
    return (
        <span className="inline-flex h-4 w-4 items-center justify-center">
            {state === "asc" ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-80">
                    <path d="M10 6l5 6H5l5-6z" transform="rotate(180 10 10)" />
                </svg>
            ) : state === "desc" ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-80">
                    <path d="M10 6l5 6H5l5-6z" />
                </svg>
            ) : (
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-40">
                    <path d="M6 7h8l-4-4-4 4zm8 6H6l4 4 4-4z" />
                </svg>
            )}
        </span>
    );
}

type FilterPopoverProps = {
    value: string;
    onChange: (v: string) => void;
};

function eventTargetElement(target: EventTarget | null): Element | null {
    if (target == null) return null;
    if (target instanceof Element) return target;
    // mousedown/click can target a Text node (e.g. label inside "Clear"); those have no .closest()
    const node = target as Node;
    return node.parentElement;
}

function FilterPopover({ value, onChange }: FilterPopoverProps) {
    const [open, setOpen] = useState<boolean>(false);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const hasFilter = value.trim().length > 0;

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!open) return;
            const el = eventTargetElement(e.target);
            if (!el) return;
            if (btnRef.current?.contains(el)) return;
            if (panelRef.current?.contains(el)) return;
            setOpen(false);
        }

        function onEsc(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }

        document.addEventListener("mousedown", onDoc);
        document.addEventListener("pointerdown", onDoc);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("pointerdown", onDoc);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open]);

    // useLayoutEffect so position is correct before paint — otherwise the panel briefly
    // renders at (0,0) and clicks hit elements "behind" it, firing outside-close.
    useLayoutEffect(() => {
        if (!open) return;
        const calc = () => {
            const r = btnRef.current?.getBoundingClientRect();
            if (!r) return;
            const dropdownWidthRem = 14; // Tailwind w-56 = 14rem
            const dropdownWidthPx =
                dropdownWidthRem * parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
            // Center the dropdown relative to the button
            const left = Math.max(8, Math.min(window.innerWidth - dropdownWidthPx - 8, r.left + r.width / 2 - dropdownWidthPx / 2));
            const top = Math.min(window.innerHeight - 8, r.bottom + 8);
            setCoords({ top, left, width: dropdownWidthPx });
        };
        calc();
        window.addEventListener("resize", calc);
        window.addEventListener("scroll", calc, true);
        return () => {
            window.removeEventListener("resize", calc);
            window.removeEventListener("scroll", calc, true);
        };
    }, [open]);

    const filterBtnClass = [
        "relative rounded p-1 transition-colors",
        open
            ? "bg-primary/20 text-primary ring-1 ring-primary/50"
            : hasFilter
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
    ].join(" ");

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={filterBtnClass}
                title={hasFilter ? `Filter active: "${value}"` : "Filter"}
                aria-label={hasFilter ? `Filter active: ${value}` : "Filter column"}
                aria-pressed={hasFilter || open}
                aria-expanded={open}
            >
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                    <path d="M3 4h14l-5 6v5l-4 2v-7L3 4z" />
                </svg>
                {/* {hasFilter ? (
                    <span
                        className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background"
                        aria-hidden
                    />
                ) : null} */}
            </button>

            {open &&
                ReactDOM.createPortal(
                    <div
                        ref={panelRef}
                        data-popover="filter"
                        className="z-[9999] fixed rounded-lg border border-border bg-popover p-3 shadow-lg w-56"
                        style={{ top: coords.top, left: coords.left }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <input
                            type="text"
                            value={value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Type to filter…"
                        />
                        <div className="mt-2 text-right">
                            <button
                                className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => onChange("")}
                                type="button"
                            >
                                Clear
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}

type ModalProps = {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
};

function Modal({ open, title, children, onClose }: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
            <div className="relative z-50 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl border border-border">
                <div className="mb-4 flex items-start justify-between gap-6">
                    <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
                    <button
                        onClick={onClose}
                        className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                        type="button"
                    >
                        <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                            <path d="M14.348 5.652a.5.5 0 0 0-.707 0L10 9.293 6.36 5.652a.5.5 0 1 0-.707.707L9.293 10l-3.64 3.64a.5.5 0 1 0 .707.707L10 10.707l3.64 3.64a.5.5 0 1 0 .707-.707L10.707 10l3.64-3.64a.5.5 0 0 0 0-.708z" />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

/* -------------------- utils -------------------- */

function deepGet(obj: unknown, path?: string | null): unknown {
    if (!path) return undefined;
    return String(path)
        .split(".")
        .reduce((acc, k) => (acc == null ? acc : acc[k]), obj as any);
}

function isFiniteNum(v: unknown): boolean {
    return v !== null && v !== "" && !Number.isNaN(Number(v));
}

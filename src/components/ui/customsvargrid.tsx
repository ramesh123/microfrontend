import React, { useRef, useState, useEffect, useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import PivotPanel from "./custompivottable";

// No @material/web data-table component exists (MD3 doesn't define one) —
// this is a plain native <table>, matching the pattern already used by
// common/tableWithPagination (that component was never MUI-based either).

// ---------- Helper cell for expand / collapse ----------
const GroupToggleCell = ({ row, onaction }: any) => {
  if (!row.__group) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onaction &&
      onaction({
        action: "toggle-group",
        data: { path: row.__path },
      });
  };

  return (
    <span
      style={{ cursor: "pointer", fontSize: 14, userSelect: "none" }}
      onClick={handleClick}
    >
      {row.expanded ? "^" : ">"}
    </span>
  );
};

interface SVGGridProps {
  width?: number | string;
  height?: number | string;
  data?: Array<Record<string, any>>;
  columns?: any[];
}

type SortState = { id: string; dir: "asc" | "desc" } | null;

// ---------- Multi-level grouping helpers ----------
const buildGroupedFlatData = (
  rows: any[],
  groupFields: string[],
  level = 0,
  parentPath = ""
): any[] => {
  if (!groupFields.length || level >= groupFields.length) {
    return rows.map((r) => ({
      ...r,
      __leaf: true,
      __path: parentPath,
    }));
  }

  const field = groupFields[level];
  const groupMap: Record<string, any[]> = {};

  rows.forEach((row) => {
    const raw = row[field];
    const key =
      raw === null || raw === undefined || raw === "" ? "(Blanks)" : String(raw);
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(row);
  });

  const flat: any[] = [];

  Object.entries(groupMap).forEach(([key, childRows]) => {
    const path = parentPath ? `${parentPath}||${key}` : key;

    const groupRow: any = {
      __group: true,
      __level: level,
      __path: path,
      groupField: field,
      groupKey: key,
      expanded: false, // IMPORTANT: default collapsed
      count: childRows.length,
    };

    flat.push(groupRow);
    flat.push(...buildGroupedFlatData(childRows, groupFields, level + 1, path));
  });

  return flat;
};

const isRowVisible = (row: any, flat: any[]): boolean => {
  // Non-group rows with no path → always visible
  if (!row.__group && !row.__leaf && !row.__path) return true;

  const path = row.__group ? row.__path : row.__path;
  if (!path) return true;

  const segments = path.split("||");
  if (segments.length === 1) return true;

  let current = "";
  for (let i = 0; i < segments.length - 1; i++) {
    current = i === 0 ? segments[0] : `${current}||${segments[i]}`;
    const ancestor = flat.find((r) => r.__group && r.__path === current);
    if (!ancestor || !ancestor.expanded) return false;
  }
  return true;
};

const renderCellContent = (col: any, row: any, onaction: (ev: any) => void) => {
  if (col.cellRenderer) return col.cellRenderer(row);
  if (col.cell) {
    const CellComp = col.cell;
    return <CellComp row={row} onaction={onaction} />;
  }
  return row[col.id] ?? "";
};

// ---------- MAIN COMPONENT ----------
const CustomSVAGrid: React.FC<SVGGridProps> = ({
  width = "100%",
  height = 400,
  data = [],
  columns: customColumns = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [pivotMode, setPivotMode] = useState(false);
  const [rowGroups, setRowGroups] = useState<string[]>([]);
  const [gridColumns, setGridColumns] = useState<any[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [groupedFlat, setGroupedFlat] = useState<any[]>([]);
  const [sortState, setSortState] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // build base columns from data
  useEffect(() => {
    if (data.length) {
      const cols =
        customColumns.length > 0
          ? customColumns
          : Object.keys(data[0]).map((key) => ({
              id: key,
              header: key.toUpperCase(),
              width: 160,
            }));
      setGridColumns(cols);

      // initialize visibleColumns to all column ids (only once or when column list changes)
      setVisibleColumns((prev) => {
        const ids = cols.map((c: any) => c.id);
        // if prev already non-empty and matches ids, keep prev; otherwise set to ids
        if (prev.length && prev.every((p) => ids.includes(p))) return prev;
        return ids;
      });
    } else {
      setGridColumns([]);
      setVisibleColumns([]);
    }
  }, [data, customColumns]);

  // build grouped flat data when groups or data change
  useEffect(() => {
    if (!rowGroups.length) {
      setGroupedFlat([]);
      return;
    }
    const flat = buildGroupedFlatData(data, rowGroups);
    setGroupedFlat(flat);
  }, [data, rowGroups]);

  // toggle expand / collapse from custom cell
  const handleToggleGroup = (ev: any) => {
    const path = ev?.data?.path;
    if (!path) return;

    setGroupedFlat((prev) =>
      prev.map((row) =>
        row.__group && row.__path === path ? { ...row, expanded: !row.expanded } : row
      )
    );
  };

  // visibility toggling for columns (called by PivotPanel checkboxes)
  const toggleColumnVisibility = (col: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col);
      return [...prev, col];
    });
  };

  // add/remove row group (drag/drop)
  const addRowGroup = (col: string) => {
    if (!rowGroups.includes(col)) setRowGroups((s) => [...s, col]);
  };
  const removeRowGroup = (col: string) => {
    setRowGroups((s) => s.filter((c) => c !== col));
  };

  const handleSort = (id: string) => {
    setSortState((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "asc" };
      if (prev.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

  const handleFilterChange = (id: string, value: string) => {
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  // filtering + sorting only apply in flat (non-grouped) mode, since grouping relies on
  // a stable flattened ancestor list (isRowVisible) that filtering/sorting would break.
  const flatColumns = useMemo(
    () => gridColumns.filter((c) => visibleColumns.includes(c.id)),
    [gridColumns, visibleColumns]
  );

  const processedData = useMemo(() => {
    if (rowGroups.length > 0) return data;

    let rows = data;
    const activeFilters = Object.entries(filters).filter(([, v]) => v);
    if (activeFilters.length) {
      rows = rows.filter((row) =>
        activeFilters.every(([id, v]) =>
          String(row[id] ?? "").toLowerCase().includes(v.toLowerCase())
        )
      );
    }

    if (sortState) {
      const { id, dir } = sortState;
      rows = [...rows].sort((a, b) => {
        const av = a[id];
        const bv = b[id];
        if (av == null && bv == null) return 0;
        if (av == null) return dir === "asc" ? -1 : 1;
        if (bv == null) return dir === "asc" ? 1 : -1;
        if (typeof av === "number" && typeof bv === "number") {
          return dir === "asc" ? av - bv : bv - av;
        }
        return dir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    return rows;
  }, [data, filters, sortState, rowGroups.length]);

  // final visible rows (consider ancestors' expanded state)
  const finalData =
    rowGroups.length === 0
      ? processedData
      : groupedFlat.filter((r) => isRowVisible(r, groupedFlat));

  const columnsWithGroupToggle =
    rowGroups.length === 0
      ? flatColumns
      : [
          {
            id: "__group_toggle",
            header: "",
            width: 40,
            cell: GroupToggleCell,
          },
          {
            id: "__group_label",
            header: rowGroups.join(" → "),
            width: 250,
            cellRenderer: (row: any) => {
              if (row.__group) {
                return (
                  " ".repeat(row.__level * 4) +
                  `${row.groupKey} (${row.count})`
                );
              }
              return "";
            },
          },
          ...flatColumns.map((col) => ({
            ...col,
            cellRenderer: (row: any) => {
              if (row.__group) return "";
              return row[col.id] ?? "";
            },
          })),
        ];

  const hasFilterableColumn =
    rowGroups.length === 0 && flatColumns.some((c) => c.filter);

  // sizes
  const dynamicHeight = typeof height === "number" ? `${height}px` : height;
  const dynamicWidth = typeof width === "number" ? `${width}px` : width;

  return (
    <div
      ref={containerRef}
      style={{
        width: dynamicWidth,
        height: dynamicHeight,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f8fafc",
          flexShrink: 0,
        }}
      >
        <label className="flex justify-end gap-2 cursor-pointer select-none">
        {/* Toggle */}
        <div
            onClick={() => setPivotMode((prev) => !prev)}
            className={`
            relative w-10 h-5 rounded-full transition-all duration-200
            ${pivotMode
                ? "bg-primary"
                : "bg-muted dark:bg-muted/6 "}
            `}
        >
            <div
            className={`
                absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-all duration-200
                ${pivotMode ? "translate-x-5" : ""}
            `}
            />
        </div>
        <span className="text-sm font-medium text-foreground">
            Pivot Mode
        </span>
        </label>

      </div>

      {/* Panel + Grid */}
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

        <div style={{ flex: 1, height: "100%", overflow: "auto" }}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columnsWithGroupToggle.map((col) => (
                  <th
                    key={col.id}
                    className="sticky top-0 z-10 border-b bg-muted px-2 py-1.5 text-left font-medium"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.sortable && rowGroups.length === 0 ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort(col.id)}
                      >
                        {col.header}
                        {sortState?.id === col.id ? (
                          sortState.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
              {hasFilterableColumn && (
                <tr>
                  {columnsWithGroupToggle.map((col) => (
                    <th key={`filter-${col.id}`} className="sticky top-7 z-10 border-b bg-muted px-2 py-1" style={{ width: col.width }}>
                      {col.filter ? (
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={filters[col.id] ?? ""}
                          onChange={(e) => handleFilterChange(col.id, e.target.value)}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-xs font-normal outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {finalData.map((row, index) => (
                <tr key={row.__path ? `${row.__path}-${index}` : row.id ?? index} className="hover:bg-muted/50">
                  {columnsWithGroupToggle.map((col) => (
                    <td key={col.id} className="border-b px-2 py-1.5" style={{ width: col.width }}>
                      {renderCellContent(col, row, handleToggleGroup)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pivotMode && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <PivotPanel
              columns={gridColumns.map((c) => c.id)}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumnVisibility}
              rowGroups={rowGroups}
              onAddRowGroup={addRowGroup}
              onRemoveRowGroup={removeRowGroup}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomSVAGrid;

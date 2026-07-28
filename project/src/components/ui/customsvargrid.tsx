import React, { useRef, useState, useEffect } from "react";
import { Grid } from "@svar-ui/react-grid";
import "@svar-ui/react-grid/all.css";
import PivotPanel from "./custompivottable";

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

  // final visible rows (consider ancestors' expanded state)
  const finalData = rowGroups.length === 0 ? data : groupedFlat.filter((r) => isRowVisible(r, groupedFlat));

  const columnsWithGroupToggle =
  rowGroups.length === 0
    ? gridColumns.filter((c) => visibleColumns.includes(c.id))
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
          cellRenderer: (row) => {
            if (row.__group) {
              return (
                " ".repeat(row.__level * 4) +
                `${row.groupKey} (${row.count})`
              );
            }
            return "";
          },
        },
        ...gridColumns
          .filter((c) => visibleColumns.includes(c.id))
          .map((col) => ({
            ...col,
             sortable: true,     // enables sorting
            filter: true,       //  enables filtering
            cellRenderer: (row) => {
              if (row.__group) return "";
              return row[col.id] ?? "";
            },
          })),
      ];

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
      {/* local style to hide the group-label for leaf rows (so child rows show real columns cleanly) */}
      <style>
        {`
          /* If you need to target actual svar grid classes, adjust selectors.
             Here we hide the second cell for rows that we tag as leaves via __leaf flag */
          .svar-grid-row[data-leaf="true"] .svar-grid-cell:nth-child(2) {
            display: none !important;
          }
        `}
      </style>

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
          <Grid
            data={finalData.map((row) => {
              // we add a data attribute so the CSS above can hide the second cell for leaf rows.
              if (row.__group) return row;
              return { __leaf: true, ...row };
            })}
            columns={columnsWithGroupToggle}
            // handle custom action from GroupToggleCell; svar-grid may need a specific prop name.
            // We're using a dumb prop name "onaction" in GroupToggleCell that calls this handler.
            onToggleGroup={(ev: any) => handleToggleGroup(ev)}
          />
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

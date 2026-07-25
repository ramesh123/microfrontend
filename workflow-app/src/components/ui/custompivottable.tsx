import React from "react";
import DropArea from "./customdroparea";

interface PivotPanelProps {
  columns: string[]; // list of column ids
  visibleColumns: string[]; // which columns are currently visible
  onToggleColumn: (col: string) => void;
  rowGroups: string[];
  onAddRowGroup: (col: string) => void;
  onRemoveRowGroup: (col: string) => void;
}

const PivotPanel: React.FC<PivotPanelProps> = ({
  columns,
  visibleColumns,
  onToggleColumn,
  rowGroups,
  onAddRowGroup,
  onRemoveRowGroup,
}) => {
  return (
    <div
      style={{
        width: 260,
        background: "#f1f5f9",
        borderRight: "1px solid #e2e8f0",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontSize: 13,
        height: "100%",
      }}
    >
      {/* COLUMN LIST WITH CHECKBOXES */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Columns</div>

        <div style={{ maxHeight: 250, overflowY: "auto" }}>
          {columns.map((col) => (
            <label
              key={col}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 4px",
                cursor: "default",
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("colId", col)}
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(col)}
                className="h-4 w-4 rounded border border-input checked:bg-background checked:border-background checked:text-primary "
                onChange={() => onToggleColumn(col)}
              />
              <span style={{ cursor: "grab" }} className="font-semibold">::</span>
              <span className="text-sm whitespace-normal break-words max-w-[175px] leading-tight">{col}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ROW GROUPS */}
      <div>
        <DropArea
          title="Row Groups"
          items={rowGroups}
          onDropItem={onAddRowGroup}
          onRemove={onRemoveRowGroup}
        />
      </div>
    </div>
  );
};

export default PivotPanel;

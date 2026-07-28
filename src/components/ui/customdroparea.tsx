import React from "react";

const DropArea = ({ title, items, onDropItem, onRemove }) => {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{title}</div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const colId = e.dataTransfer.getData("colId");
          onDropItem(colId);
        }}
        style={{
          border: "1px dashed #94a3b8",
          padding: 10,
          borderRadius: 6,
          minHeight: 50,
          background: "#f8fafc",
          marginTop: 6,
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {items.length === 0 ? (
          <span style={{ color: "#6b7280" }}>Drag here</span>
        ) : (
          items.map((item) => (
            <div
              key={item}
              style={{
                padding: "4px 8px",
                background: "#e2e8f0",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              {item}
              <span
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => onRemove(item)}
              >
                ×
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DropArea;

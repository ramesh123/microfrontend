import { useDroppable } from '@dnd-kit/core';

interface GridRowProps {
  row: number;
  rowTop: number;
  rowHeight: number;
  containerWidth: number;
  isOver: boolean;
  onDrop?: (y: number) => void;
  hasChart?: boolean;
}

export function GridRow({
  row,
  rowTop,
  rowHeight,
  containerWidth,
  isOver,
  onDrop,
  hasChart = false
}: GridRowProps) {
  const { setNodeRef, isOver: isRowOver } = useDroppable({
    id: `grid-row-${row}`,
  });

  const y = rowTop;

  return (
    <div
      ref={setNodeRef}
      className={`absolute border transition-all duration-200 ${isRowOver
        ? 'border-primary/60 bg-primary/10 shadow-inner z-20'
        : hasChart
          ? 'border-muted-foreground/20 bg-muted/3'
          : 'border-muted-foreground/30 bg-transparent hover:border-primary/40 hover:bg-primary/5'
        }`}
      style={{
        left: '0px',
        top: `${y}px`,
        width: `${containerWidth}px`,
        height: `${rowHeight}px`,
        pointerEvents: 'auto',
        borderStyle: 'solid',
        borderRadius: '8px',
      }}
      onClick={() => onDrop?.(y)}
    >
      {/* Grid row label for visual reference when dragging */}
      {isRowOver && (
        <div className="absolute top-2 left-2 text-xs font-semibold text-primary bg-primary/25 px-2 py-1 rounded-md shadow-sm">
          Drop in Row {row + 1}
        </div>
      )}
      {/* Show row number in corner when not dragging */}
      {!isRowOver && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground/40 font-medium">
          Row {row + 1}
        </div>
      )}
    </div>
  );
}

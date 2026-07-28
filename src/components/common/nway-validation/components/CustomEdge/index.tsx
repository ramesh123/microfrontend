import { EdgeProps, getBezierPath, BaseEdge } from '@xyflow/react';
import { X } from 'lucide-react';

// Define the custom data type for your edge
interface CustomEdgeData {
  onRemoveConnection: (id: string) => void;
  isHighlighted?: boolean;
}

// Extend EdgeProps to include your custom data type
interface CustomEdgeProps extends Omit<EdgeProps, 'data'> {
  data?: CustomEdgeData;
}

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: CustomEdgeProps) => {
  const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onRemoveConnection) {
      data.onRemoveConnection(id);
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: data?.isHighlighted ? '#ef4444' : '#a1a1aa',
          strokeWidth: data?.isHighlighted ? 2 : 1.5,
          strokeDasharray: data?.isHighlighted ? '5 5' : 'none',
          animation: data?.isHighlighted ? 'dashdraw 0.5s linear infinite' : 'none',
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {data?.isHighlighted && (
        <foreignObject
          width={20}
          height={20}
          x={edgeCenterX - 10}
          y={edgeCenterY - 10}
          className="overflow-visible"
        >
          <button
            onClick={handleRemove}
            className="flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-all"
            title={`Remove connection`}
          >
            <X className="w-3 h-3" />
          </button>
        </foreignObject>
      )}
    </>
  );
};
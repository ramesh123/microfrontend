// import React from "react";
// import { EdgeProps, getBezierPath } from "@xyflow/react";
// import { Button } from "@/components/ui/button";
// import ForwardedIconComponent from "@/components/common/genericIconComponent";

// interface CustomEdgeWithRemoveProps extends EdgeProps {
//   onRemove?: (edgeId: string) => void;
// }

// const CustomEdgeWithRemove: React.FC<CustomEdgeWithRemoveProps> = (props) => {
//   const { id, sourceX, sourceY, targetX, targetY, style, markerEnd, data } = props;
//   const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
//   const [hovered, setHovered] = React.useState(false);

//   const handleRemove = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     if (data && typeof data.onRemove === 'function') {
//       data.onRemove(id);
//     }
//   };

//   return (
//     <g
//       onMouseEnter={() => setHovered(true)}
//       onMouseLeave={() => setHovered(false)}
//       style={{ pointerEvents: 'all' }}
//     >
//       <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
//       <foreignObject x={labelX - 20} y={labelY - 20} width={40} height={40} style={{ overflow: 'visible', pointerEvents: 'none' }}>
//         <div
//           style={{
//             width: 40,
//             height: 40,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             pointerEvents: 'all',
//             background: 'transparent',
//           }}
//         >
//           <Button
//             onClick={handleRemove}
//             className="h-5 w-5 rounded-md cursor-pointer hover:!bg-red-400 hover:text-white"
//             style={{
//               display: hovered ? 'flex' : 'none',
//               alignItems: 'center',
//               justifyContent: 'center',
//               transition: 'opacity 0.2s',
//             //   opacity: hovered ? 1 : 0,
//               pointerEvents: hovered ? 'all' : 'none',
//               position: 'absolute',
//               left: '50%',
//               top: '50%',
//               transform: 'translate(-50%, -50%)',
//             }}
//             title="Remove edge"
//             variant="secondary"
//             size="icon"
//           >
//             <ForwardedIconComponent name="x" className="h-4 w-4" />
//           </Button>
//         </div>
//       </foreignObject>
//     </g>
//   );
// };

// export default CustomEdgeWithRemove;



// import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
// import { data } from 'react-router';
 
// const CustomEdgeWithRemove = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, ...props }) => {
//   const [edgePath, labelX, labelY] = getBezierPath({
//     sourceX,
//     sourceY,
//     sourcePosition,
//     targetX,
//     targetY,
//     targetPosition,
//   });
 
//   const { label, labelStyle, markerStart, markerEnd, interactionWidth } = props;

//   const handleRemove = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     if (data && typeof data === 'function') {
//       data(id);
//     }
//   };
 
//   return (
//     <>
//       <BaseEdge
//         id={id}
//         path={edgePath}
//         label={label}
//         labelStyle={labelStyle}
//         markerEnd={markerEnd}
//         markerStart={markerStart}
//         interactionWidth={interactionWidth}
//       />

//       <EdgeLabelRenderer>
//         <div
//           className="button-edge__label nodrag nopan"
//           style={{
//             transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
//           }}
//         >
//           <button className="button-edge__button" onClick={handleRemove}>
//             ×
//           </button>
//         </div>
//       </EdgeLabelRenderer>
//     </>
//   );
// }

// export default CustomEdgeWithRemove;

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';

export const CustomEdgeWithRemove: React.FC<EdgeProps> = ({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style: initialStyle = {},
  selected,
}) => {
  // Use the official useReactFlow hook for safe access to instance methods
  const { setEdges, getNode } = useReactFlow();
  const { theme } = useTheme();
  const isDark = isThemeDarkAppearance(theme);

  // Safely get the source node. This is more robust than useStore.
  const sourceNode = getNode(source);
  const sourceNodeData = sourceNode?.data;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  // The styling logic is now self-contained within the edge component.
  const status: any = sourceNodeData?.status || 'idle';
  const colors = {
    success: '#22c55e', // green-500
    error: '#ef4444', // red-500
    running: '#8b5cf6', // purple-500
    // Dark: theme foreground so edges read on dark canvas; light: slate so edges stay visible on light canvas
    idle: isDark ? 'var(--foreground)' : '#64748b',
  };
  const glowColors = {
    success: 'rgba(34, 197, 94, 0.7)',
    error: 'rgba(239, 68, 68, 0.7)',
    running: 'rgba(139, 92, 246, 0.7)',
    idle: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(100, 116, 139, 0.55)',
  };
  const glowColorsFaded = {
    success: 'rgba(34, 197, 94, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)',
    running: 'rgba(139, 92, 246, 0.3)',
    idle: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(100, 116, 139, 0.28)',
  };

  const color = colors[status] || colors.idle;
  const glow = glowColors[status] || glowColors.idle;
  const glowFaded = glowColorsFaded[status] || glowColorsFaded.idle;

  const dynamicStyle: React.CSSProperties = {
    ...initialStyle,
    stroke: color,
    strokeWidth: selected ? 1 : 1, // Reduce width on selection
    filter: `drop-shadow(0 0 3px ${glow}) drop-shadow(0 0 8px ${glowFaded})`,
    transition: 'stroke-width 0.2s ease-in-out', // Add a smooth transition
  };

  if (status === 'running') {
    dynamicStyle.strokeDasharray = '10, 10';
    dynamicStyle.animation = 'marching-ants 1s linear infinite';
  }

  const dynamicMarkerEnd: any = { type: MarkerType.ArrowClosed, width: 10, height: 10, color };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={dynamicMarkerEnd} style={dynamicStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {selected && (
            <Button
              size="icon"
              variant="destructive"
              className="w-6 h-6 rounded-full shadow-lg"
              onClick={onEdgeClick}
              title="Delete connection"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

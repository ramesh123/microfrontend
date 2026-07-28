import React from 'react';

interface ConnectionLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  isPending?: boolean;
  /** Solid connection stroke (mapped columns). */
  strokeColor?: string;
  /** Pending drag line stroke. */
  pendingColor?: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  from,
  to,
  isPending = false,
  strokeColor = "#9CA3AF",
  pendingColor = "#3b82f6",
}) => {
  const midX = (from.x + to.x) / 2;
  const controlPoint1 = { x: midX, y: from.y };
  const controlPoint2 = { x: midX, y: to.y };

  const pathData = `M ${from.x} ${from.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${to.x} ${to.y}`;

  const stroke = isPending ? pendingColor : strokeColor;

  return (
    <g>
      <path
        d={pathData}
        stroke={stroke}
        strokeWidth={isPending ? 2 : 1.5}
        fill="none"
        strokeDasharray={isPending ? "4,4" : "none"}
        opacity={isPending ? 0.7 : 0.75}
      />
      {!isPending && (
        <circle
          cx={to.x}
          cy={to.y}
          r="2"
          fill={strokeColor}
          opacity={0.85}
        />
      )}
    </g>
  );
};

export default ConnectionLine;

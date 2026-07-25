import { useCallback, useRef, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { BigNumberKpiIcon } from './BigNumberKpiIcon';

type BigNumberDraggableKpiIconProps = {
  source: string;
  color?: string;
  sizePx: number;
  x: number;
  y: number;
  draggable?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onPositionChange?: (x: number, y: number) => void;
  className?: string;
  alt?: string;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function BigNumberDraggableKpiIcon({
  source,
  color,
  sizePx,
  x,
  y,
  draggable = false,
  containerRef,
  onPositionChange,
  className,
  alt,
}: BigNumberDraggableKpiIconProps) {
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const updatePositionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const dragState = dragStateRef.current;
      const container = containerRef.current;
      if (!dragState || !container || !onPositionChange) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((clientX - dragState.startX) / rect.width) * 100;
      const deltaY = ((clientY - dragState.startY) / rect.height) * 100;
      onPositionChange(
        clampPercent(dragState.originX + deltaX),
        clampPercent(dragState.originY + deltaY),
      );
    },
    [containerRef, onPositionChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || !onPositionChange) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    updatePositionFromPointer(event.clientX, event.clientY);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={cn(
        'absolute z-[3] select-none',
        draggable && 'cursor-grab touch-none active:cursor-grabbing',
        className,
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-hidden={!alt}
    >
      <BigNumberKpiIcon
        source={source}
        color={color}
        sizePx={sizePx}
        alt={alt}
        className={cn(draggable && 'pointer-events-none')}
      />
    </div>
  );
}

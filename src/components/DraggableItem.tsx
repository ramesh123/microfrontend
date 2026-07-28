import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DraggableItemProps {
  id: string;
  data: any;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DraggableItem({
  id,
  data,
  children,
  className,
  disabled = false,
}: DraggableItemProps) {
  const draggable = !disabled
    ? useDraggable({ id, data })
    : null;

  const attributes = draggable ? draggable.attributes : undefined;
  const listeners = draggable ? draggable.listeners : undefined;
  const setNodeRef = draggable ? draggable.setNodeRef : undefined;
  const transform = draggable ? draggable.transform : undefined;
  const isDragging = draggable ? draggable.isDragging : false;
    

  // Don't apply transform when dragging - let DragOverlay handle the visual feedback
  const style = transform && !isDragging
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef as any}
      style={style}
      {...(attributes || {})}
      {...(listeners || {})}
      className={cn(
        isDragging && 'opacity-50 cursor-grabbing',
        !isDragging && !disabled && 'cursor-grab',
        disabled && 'cursor-default',
        className
      )}
    >
      {children}
    </div>
  );
}


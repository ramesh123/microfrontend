import React, { useCallback, useRef } from 'react';
import { NodeItem as NodeItemType } from '@/types/nodeSideBar';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { cn } from '@/lib/utils';

interface NodeItemProps {
  item: NodeItemType;
  onDragEnd?: () => void;
}

export const DraggableNodeItem: React.FC<NodeItemProps> = ({ item, onDragEnd }) => { //item, onDragEnd
  const dragImageRef = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const crt = e.currentTarget.cloneNode(true) as HTMLElement;
    crt.style.position = "absolute";
    crt.style.top = "-1000px";
    crt.style.width = `${e.currentTarget.offsetWidth}px`;
    crt.style.backgroundColor = 'var(--card)';
    crt.style.padding = '8px';
    crt.style.borderRadius = '12px';
    crt.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    crt.style.zIndex = '1000';
    document.body.appendChild(crt);
    dragImageRef.current = crt;
    e.dataTransfer.setDragImage(crt, 20, 20);

    const nodeData = {
      type: 'genericNode',
      data: {
        name: item.display_name,
        icon: item.icon,
        status: 'idle',
        type: 'genericNode',
        ...item,
      },
    };
    e.dataTransfer.setData('genericNode', JSON.stringify(nodeData));
    e.dataTransfer.effectAllowed = 'move';
  }, [item]);

  const handleDragEnd = useCallback(() => {
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    if (onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  const isDraggable = item?.enabled ?? false;

  return ( 
    <div 
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group flex items-center gap-3 p-1 rounded-lg transition-colors ml-[-0.27rem]",
        isDraggable ? "cursor-grab hover:bg-gray-200 hover:dark:bg-gray-800" : "opacity-50 cursor-not-allowed"
      )}
      title={item?.display_name}
    >
      <div className="icon-well icon-well-sm icon-well--round flex-shrink-0">
        <ForwardedIconComponent
          name={item?.icon}
          className="h-5 w-5 text-foreground/75 dark:text-foreground/80"
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-xs font-medium text-foreground truncate">{item?.display_name}</h3>
      </div>
    </div>
  );
};

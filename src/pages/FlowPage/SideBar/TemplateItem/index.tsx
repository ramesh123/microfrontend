import React, { useCallback, useRef } from 'react';
import { Template } from '@/types/nodeSideBar';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { cn } from '@/lib/utils';

interface TemplateItemProps {
  item: Template;
  onDragEnd?: () => void;
}

export const DraggableTemplateItem: React.FC<TemplateItemProps> = ({ item, onDragEnd }) => {
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

    const templateData = {
      type: 'templateNode',
      data: {
        name: item.name,
        icon: item.icon,
        status: 'idle',
        type: 'templateNode',
        ...item,
      },
    };
    e.dataTransfer.setData('templateNode', JSON.stringify(templateData));
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
        "group flex items-center gap-3 p-2 rounded-lg transition-colors bg-muted/40",
        isDraggable ? "cursor-grab hover:bg-accent" : "opacity-50 cursor-not-allowed"
      )}
      title={item?.name}
    >
      <div className="w-9 h-9 bg-muted rounded-full flex-shrink-0 flex items-center justify-center">
        <ForwardedIconComponent name={item?.icon} className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">{item?.name}</h3>
      </div>
    </div>
  );
};

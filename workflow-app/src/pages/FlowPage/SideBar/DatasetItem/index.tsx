import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Dataset } from '@/types/nodeSideBar';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DatasetItemProps {
  item: Dataset;
  iconFile?: any;
  onDragEnd?: () => void;
}

export const DraggableDatasetItem: React.FC<DatasetItemProps> = ({ item, iconFile, onDragEnd }) => {
  const dragImageRef = useRef<HTMLElement | null>(null);
  const displayType = iconFile?.file_name ?? item.type;
  const nodePayload = (item as any).node?.payload;
  const fileName = iconFile?.file_name || nodePayload?.file_name || item.payload?.file_name;
  const uniqueId = iconFile?.value || iconFile?.unique_id || nodePayload?.icon_unique_id || nodePayload?.unique_id || item.payload?.icon_unique_id || item.payload?.unique_id;
  const imageUrl = 
    fileName && uniqueId 
      ? `/user-uploads/${uniqueId}/${fileName}` 
      : null;

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

    const datasetData = {
      type: 'genericNode',
      data: {
        isDataset: true,
        name: item.name,
        icon: item.type,
        status: 'idle',
        type: 'genericNode',
        ...item,
      },
    };
    e.dataTransfer.setData('genericNode', JSON.stringify(datasetData));
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
        "group flex items-center gap-3 p-1 rounded-lg transition-colors bg-muted/40",
        isDraggable ? "cursor-grab hover:bg-gray-200 hover:dark:bg-gray-800" : "opacity-50 cursor-not-allowed"
      )}
      title={item?.name}
    >
      <div className="w-9 h-9 bg-muted rounded-full flex-shrink-0 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={iconFile?.file_name || "icon"} className="h-5 w-5 object-contain" />
        ) : (
          <ForwardedIconComponent name={item?.type} className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">{item?.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{displayType}</p>
      </div>
    </div>
  );
};

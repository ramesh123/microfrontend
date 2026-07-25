import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResizableTableProps {
  children: React.ReactNode;
  className?: string;
}

interface ResizableColumnProps {
  children: React.ReactNode;
  className?: string;
  width?: number;
  minWidth?: number;
  onResize?: (width: number) => void;
}

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };


export const ResizableTable: React.FC<ResizableTableProps> = ({ children, className }) => {
  return (
    <div className={cn('overflow-auto border rounded-lg', className)}>
      <table className="w-full border-collapse">
        {children}
      </table>
    </div>
  );
};

export const ResizableColumn: React.FC<ResizableColumnProps> = ({
  children,
  className,
  width = 150,
  minWidth = 100,
  onResize,
}) => {
  const [columnWidth, setColumnWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const columnRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidth;
  };

  useEffect(() => {

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + deltaX);
      setColumnWidth(newWidth);
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

  }, [isResizing, minWidth, onResize]);

  return (
    <th
      ref={columnRef}
      className={cn('relative border-r border-gray-200 bg-gray-50 p-3 text-left', className)}
      style={{ width: columnWidth, minWidth }}
    >
      <div className="flex items-center justify-between">
        <div className="truncate" style={{ maxWidth: columnWidth - 20 }}>
          {children}
        </div>
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
          onMouseDown={handleMouseDown}
        />
      </div>
    </th>
  );
};

export const ResizableCell: React.FC<{ children: React.ReactNode; className?: string; width?: number }> = ({
  children,
  className,
  width,
}) => {
  return (
    <td
      className={cn('border-r border-gray-200 p-1', className)}
      style={{ width, minWidth: width }}
    >
      <div className="truncate" style={{ maxWidth: width ? width - 20 : undefined }}>
        {children}
      </div>
    </td>
  );
};
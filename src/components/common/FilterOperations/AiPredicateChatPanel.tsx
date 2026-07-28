/**
 * AiPredicateChatPanel - Floating panel version of AI chat for PREDICATE mode
 * This component renders as a draggable floating panel WITHOUT using Dialog,
 * so it can work properly on top of Sheet components without interference
 */

import React from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiChatDialog } from '@/pages/FlowPage/Aichatbox';
import type { TableContext } from './aiPredicateApi';

interface AiPredicateChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeGenerated?: (code: string) => void;
  tableContext?: TableContext;
  className?: string;
  // For handling needs_clarification from HorizontalAiPanel
  initialQuestion?: string;
  initialOptions?: { [key: string]: string[] };
  initialMissingColumns?: string[];
  initialConversationId?: string;
  initialEventId?: string;
  initialUserRequest?: string;
}

export const AiPredicateChatPanel: React.FC<AiPredicateChatPanelProps> = ({
  isOpen,
  onClose,
  onCodeGenerated,
  tableContext,
  className,
  initialQuestion,
  initialOptions,
  initialMissingColumns,
  initialConversationId,
  initialEventId,
  initialUserRequest,
}) => {
  const [position, setPosition] = React.useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset position when opened
  React.useEffect(() => {
    if (isOpen) {
      // Center the panel on screen
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      setPosition({
        x: Math.max(50, (windowWidth - 600) / 2),
        y: Math.max(50, (windowHeight - 700) / 2),
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - semi-transparent, doesn't close on click */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[95]"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Floating Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed bg-background rounded-xl border shadow-2xl flex flex-col z-[100]",
          "transition-shadow duration-200",
          isDragging ? "shadow-3xl cursor-grabbing" : "shadow-2xl",
          className
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '600px',
          maxWidth: 'calc(100vw - 100px)',
          height: '700px',
          maxHeight: 'calc(100vh - 100px)',
          pointerEvents: 'auto',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Drag Handle Header */}
        <div className="drag-handle flex items-center gap-2 px-4 py-3 border-b bg-muted/30 rounded-t-xl cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold flex-1">AI Filter Assistant</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chat Content - Render AiChatDialog content directly without Dialog wrapper */}
        <div className="flex-1 overflow-hidden">
          <AiChatDialog
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            mode="PREDICATE"
            onCodeGenerated={onCodeGenerated}
            tableContext={tableContext}
            initialQuestion={initialQuestion}
            initialOptions={initialOptions}
            initialMissingColumns={initialMissingColumns}
            initialUserRequest={initialUserRequest}
            initialConversationId={initialConversationId}
            initialEventId={initialEventId}
          />
        </div>
      </div>
    </>
  );
};

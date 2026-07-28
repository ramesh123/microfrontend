import { useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { LayoutDashboard, MousePointerClick, Move, Maximize2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { DashboardGridOverlay } from './DashboardGridOverlay';
import { CHART_GAP, DASHBOARD_CANVAS_RIGHT_INSET } from '../dashboardConstants';
import './dashboardGrid.css';

interface DroppableCanvasProps {
  children: React.ReactNode;
  isEmpty: boolean;
  isOver: boolean;
  containerWidth?: number;
  gridContentMinHeight?: number;
  isDropHighlighted?: boolean;
  /** When set, parent updates drop highlight via ref (avoids re-rendering chart children). */
  dropSurfaceRef?: React.RefObject<HTMLDivElement | null>;
  canvasBackgroundStyle?: CSSProperties;
  className?: string;
}

const EMPTY_STATE_STEPS = [
  { icon: MousePointerClick, label: 'Pick a chart from the library' },
  { icon: Move, label: 'Drag it onto the canvas' },
  { icon: Maximize2, label: 'Resize and arrange freely' },
] as const;

export function DroppableCanvas({
  children,
  isEmpty,
  isOver,
  containerWidth = 0,
  gridContentMinHeight = 400,
  isDropHighlighted = false,
  dropSurfaceRef,
  canvasBackgroundStyle,
  className,
}: DroppableCanvasProps) {
  const { setNodeRef } = useDroppable({
    id: 'dashboard-canvas',
  });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when dragging over edges
  useEffect(() => {
    if (!isOver || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const scrollMargin = 50;
      const scrollSpeed = 10;

      if (e.clientY < rect.top + scrollMargin) {
        container.scrollTop -= scrollSpeed;
      } else if (e.clientY > rect.bottom - scrollMargin) {
        container.scrollTop += scrollSpeed;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOver]);

  const useExternalDropHighlight = !!dropSurfaceRef;
  const showGridHighlight = isDropHighlighted || (!useExternalDropHighlight && isOver);
  const emptyTitle = useExternalDropHighlight
    ? isDropHighlighted
      ? 'Drop to add your first chart'
      : 'Start building your dashboard'
    : isOver
      ? 'Drop to add your first chart'
      : 'Start building your dashboard';

  const canvasStyle: CSSProperties = {
    ...(useExternalDropHighlight && canvasBackgroundStyle
      ? canvasBackgroundStyle
      : { backgroundColor: 'hsl(var(--background))' }),
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (node) canvasContainerRef.current = node;
        if (dropSurfaceRef) {
          (dropSurfaceRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      data-dashboard-canvas-surface
      className={`dashboard-canvas-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-0 transition-all duration-200 relative scrollbar-thin ${className ?? ''}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        flex: '1 1 0%',
        ...canvasStyle,
      }}
    >
      <div
        className={`relative z-[1] w-full ${isEmpty ? 'min-h-full' : 'min-h-full pb-12'}`}
        style={
          !isEmpty
            ? {
                minHeight: `max(${Math.max(400, gridContentMinHeight)}px, 100%)`,
                paddingLeft: CHART_GAP,
                paddingRight: CHART_GAP + DASHBOARD_CANVAS_RIGHT_INSET,
                boxSizing: 'border-box',
              }
            : undefined
        }
      >
        <DashboardGridOverlay
          containerWidth={containerWidth}
          highlighted={showGridHighlight}
          fillParent
        />

        {isEmpty ? (
          <div
            data-dashboard-empty-drop
            className="dashboard-empty-state flex justify-center px-6 pb-10 pt-[22vh] sm:px-10"
          >
            <div className="w-full max-w-lg text-center">
              <div
                data-dashboard-empty-icon
                className={`mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-2xl border transition-all duration-300 ${
                  showGridHighlight
                    ? 'scale-105 border-primary/30 bg-primary/15 shadow-lg shadow-primary/10'
                    : 'border-primary/15 bg-gradient-to-br from-primary/12 to-primary/5'
                }`}
              >
                <LayoutDashboard
                  data-dashboard-empty-icon-svg
                  className={`h-10 w-10 transition-all duration-300 ${
                    showGridHighlight ? 'text-primary' : 'text-primary/70'
                  }`}
                />
              </div>

              <h3
                data-dashboard-empty-title
                className={`mb-2 text-xl font-semibold tracking-tight transition-colors duration-200 ${
                  showGridHighlight ? 'text-primary' : 'text-foreground'
                }`}
              >
                {emptyTitle}
              </h3>

              <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Drag charts from the library on the right, or click a chart to add it to your layout.
              </p>

              <div className="mx-auto grid max-w-md grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                {EMPTY_STATE_STEPS.map(({ icon: Icon, label }, index) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-lg border border-border/50 bg-background/70 px-3 py-3 text-center shadow-sm backdrop-blur-sm"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <Icon className="h-4 w-4 text-primary/70" aria-hidden />
                    <span className="text-[11px] leading-snug text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}



import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  clampPanelItemLayout,
  type PanelItemLayout,
  PANEL_ITEM_LAYOUT_MIN,
} from '../layoutConstants';
import {
  DASHBOARD_BIG_NUMBER_WIDGET_CLASS,
  PANEL_EMBEDDED_CHART_SHELL_CLASS,
} from '../utils/dashboardWidgetTabs';
import { DashboardChartHeaderActions } from './DashboardChartHeaderActions';
import './dashboardGrid.css';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';

interface PanelResizableItemProps {
  layout: PanelItemLayout;
  editable?: boolean;
  selected?: boolean;
  chartTitle?: string;
  isBigNumberViz?: boolean;
  onLayoutChange?: (layout: PanelItemLayout) => void;
  onSelect?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
}

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  move: 'grabbing',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

function computeLayoutFromPointer(
  start: {
    dir: ResizeDir;
    pointerX: number;
    pointerY: number;
    layout: PanelItemLayout;
    parentW: number;
    parentH: number;
  },
  clientX: number,
  clientY: number,
): PanelItemLayout {
  const dxPct = ((clientX - start.pointerX) / start.parentW) * 100;
  const dyPct = ((clientY - start.pointerY) / start.parentH) * 100;
  let { x, y, w, h } = start.layout;

  switch (start.dir) {
    case 'move':
      x += dxPct;
      y += dyPct;
      break;
    case 'e':
      w += dxPct;
      break;
    case 'w':
      x += dxPct;
      w -= dxPct;
      break;
    case 's':
      h += dyPct;
      break;
    case 'n':
      y += dyPct;
      h -= dyPct;
      break;
    case 'ne':
      y += dyPct;
      h -= dyPct;
      w += dxPct;
      break;
    case 'nw':
      x += dxPct;
      w -= dxPct;
      y += dyPct;
      h -= dyPct;
      break;
    case 'se':
      w += dxPct;
      h += dyPct;
      break;
    case 'sw':
      x += dxPct;
      w -= dxPct;
      h += dyPct;
      break;
    default:
      break;
  }

  if (w < PANEL_ITEM_LAYOUT_MIN) {
    if (start.dir.includes('w')) x = start.layout.x + start.layout.w - PANEL_ITEM_LAYOUT_MIN;
    w = PANEL_ITEM_LAYOUT_MIN;
  }
  if (h < PANEL_ITEM_LAYOUT_MIN) {
    if (start.dir.includes('n')) y = start.layout.y + start.layout.h - PANEL_ITEM_LAYOUT_MIN;
    h = PANEL_ITEM_LAYOUT_MIN;
  }

  return clampPanelItemLayout({ x, y, w, h });
}

export const PanelResizableItem = memo(function PanelResizableItem({
  layout,
  editable = false,
  selected = false,
  chartTitle = 'Chart',
  isBigNumberViz = false,
  onLayoutChange,
  onSelect,
  onRemove,
  children,
  className = '',
}: PanelResizableItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [activeDir, setActiveDir] = useState<ResizeDir | null>(null);
  const [draftLayout, setDraftLayout] = useState<PanelItemLayout | null>(null);
  const startRef = useRef<{
    dir: ResizeDir;
    pointerX: number;
    pointerY: number;
    layout: PanelItemLayout;
    parentW: number;
    parentH: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingLayoutRef = useRef<PanelItemLayout | null>(null);

  const displayLayout = draftLayout ?? layout;
  const isActive = activeDir != null;
  const shellClass = isBigNumberViz ? DASHBOARD_BIG_NUMBER_WIDGET_CLASS : PANEL_EMBEDDED_CHART_SHELL_CLASS;

  const beginInteraction = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    if (!editable || !onLayoutChange) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
    const parent = itemRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    if (parentRect.width <= 0 || parentRect.height <= 0) return;
    const baseLayout = draftLayout ?? layout;
    startRef.current = {
      dir,
      pointerX: e.clientX,
      pointerY: e.clientY,
      layout: { ...baseLayout },
      parentW: parentRect.width,
      parentH: parentRect.height,
    };
    setActiveDir(dir);
    setDraftLayout({ ...baseLayout });
  }, [draftLayout, editable, layout, onLayoutChange, onSelect]);

  useEffect(() => {
    if (!activeDir) return;

    const handleMove = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;

      pendingLayoutRef.current = computeLayoutFromPointer(start, e.clientX, e.clientY);
      if (rafRef.current != null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingLayoutRef.current) {
          setDraftLayout(pendingLayoutRef.current);
        }
      });
    };

    const handleUp = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const finalLayout = pendingLayoutRef.current ?? startRef.current?.layout;
      if (finalLayout && onLayoutChange) {
        onLayoutChange(finalLayout);
      }

      pendingLayoutRef.current = null;
      startRef.current = null;
      setDraftLayout(null);
      setActiveDir(null);
    };

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = RESIZE_CURSORS[activeDir];

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeDir, onLayoutChange]);

  useEffect(() => {
    if (!activeDir) {
      setDraftLayout(null);
    }
  }, [layout, activeDir]);

  return (
    <div
      ref={itemRef}
      className={cn('panel-resizable-item group/panel-chart absolute', className)}
      style={{
        left: `${displayLayout.x}%`,
        top: `${displayLayout.y}%`,
        width: `${displayLayout.w}%`,
        height: `${displayLayout.h}%`,
        zIndex: isActive ? 40 : selected ? 30 : undefined,
        transition: isActive ? 'none' : undefined,
      }}
      onMouseDown={editable ? (e) => {
        if ((e.target as HTMLElement).closest('[data-panel-handle], [data-dashboard-chart-action]')) return;
        beginInteraction(e, 'move');
      } : undefined}
    >
      {editable && onRemove && (
        <div className="dashboard-chart-no-drag pointer-events-none absolute right-0.5 top-0.5 z-[40] flex items-center rounded-md bg-background/95 px-0.5 shadow-sm ring-1 ring-border/40 opacity-0 transition-opacity group-hover/panel-chart:opacity-100 group-hover/panel-chart:pointer-events-auto">
          <DashboardChartHeaderActions
            chartTitle={chartTitle}
            onRemove={onRemove}
          />
        </div>
      )}

      <div
        className={cn(
          shellClass,
          'panel-resizable-item__frame relative h-full w-full',
          editable && !isActive && 'cursor-grab',
          isActive && 'panel-resizable-item__frame--active cursor-grabbing',
        )}
      >
        <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>

        {editable && (
          <>
            <div data-panel-handle="n" onMouseDown={(e) => beginInteraction(e, 'n')} className="panel-resizable-handle panel-resizable-handle--n" />
            <div data-panel-handle="s" onMouseDown={(e) => beginInteraction(e, 's')} className="panel-resizable-handle panel-resizable-handle--s" />
            <div data-panel-handle="w" onMouseDown={(e) => beginInteraction(e, 'w')} className="panel-resizable-handle panel-resizable-handle--w" />
            <div data-panel-handle="e" onMouseDown={(e) => beginInteraction(e, 'e')} className="panel-resizable-handle panel-resizable-handle--e" />
            <div data-panel-handle="nw" onMouseDown={(e) => beginInteraction(e, 'nw')} className="panel-resizable-handle panel-resizable-handle--nw" />
            <div data-panel-handle="ne" onMouseDown={(e) => beginInteraction(e, 'ne')} className="panel-resizable-handle panel-resizable-handle--ne" />
            <div data-panel-handle="sw" onMouseDown={(e) => beginInteraction(e, 'sw')} className="panel-resizable-handle panel-resizable-handle--sw" />
            <div data-panel-handle="se" onMouseDown={(e) => beginInteraction(e, 'se')} className="panel-resizable-handle panel-resizable-handle--se" />
          </>
        )}
      </div>
    </div>
  );
});

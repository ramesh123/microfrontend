import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Loader2,
  Pencil,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Table,
  Activity,
  FileText,
  AreaChart,
  LayoutGrid,
  Type,
  Image,
  Bell,
  Minus,
  Trash2,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Chart } from '../types';
import { getChartTypeImage, getChartTypeImageAlt } from '../utils/chartTypeAssets';

const getChartTypeIcon = (vizName?: string) => {
  const name = (vizName || '').toLowerCase();
  if (name.includes('line') || name.includes('sparkline')) return LineChart;
  if (name.includes('bar') || name.includes('column')) return BarChart2;
  if (name.includes('pie') || name.includes('donut') || name.includes('radial') || name.includes('semi')) return PieChart;
  if (name.includes('area')) return AreaChart;
  if (name.includes('table') || name.includes('pivot')) return Table;
  if (name.includes('big') && (name.includes('number') || name.includes('bignumber') || name.includes('big_number'))) return Hash;
  if (name.includes('kpi') || name.includes('stat')) return Activity;
  if (name.includes('panel')) return LayoutGrid;
  if (name.includes('text') || name.includes('label')) return Type;
  if (name.includes('image')) return Image;
  if (name.includes('alert')) return Bell;
  if (name.includes('divider')) return Minus;
  return FileText;
};

interface ChartTypeVisualProps {
  vizName?: string;
  isBlockItem: boolean;
  isAdded: boolean;
  size?: 'sm' | 'md';
}

function ChartTypeVisual({ vizName, isBlockItem, isAdded, size = 'md' }: ChartTypeVisualProps) {
  const VizIcon = getChartTypeIcon(vizName);
  const pngSrc = !isBlockItem ? getChartTypeImage(vizName) : null;
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-4 w-4';

  if (pngSrc) {
    const thumbColClass = size === 'sm' ? 'w-10' : 'w-[3.25rem]';
    const imgClass = size === 'sm' ? 'h-10 w-10' : 'h-[3.25rem] w-[3.25rem]';

    return (
      <div className={`${thumbColClass} shrink-0 flex items-center justify-center self-stretch`}>
        <img
          src={pngSrc}
          alt={getChartTypeImageAlt(vizName)}
          className={`${imgClass} object-contain object-center bg-transparent contrast-[1.1] saturate-[1.2] ${isAdded ? 'opacity-55' : ''}`}
          draggable={false}
        />
      </div>
    );
  }

  const iconBoxClass = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';

  return (
    <div
      className={`flex items-center justify-center rounded-md shrink-0 self-center border transition-colors ${iconBoxClass} ${isAdded
        ? 'bg-muted border-border text-muted-foreground'
        : 'bg-background border-border text-muted-foreground group-hover:border-primary/40 group-hover:bg-primary/5'
        }`}
    >
      <VizIcon className={`${iconClass} ${!isAdded ? 'group-hover:text-primary' : ''}`} />
    </div>
  );
}

interface DraggableChartItemProps {
  chart: Chart;
  formatVisualizationName: (name: string) => string;
  getRelativeTime: (dateString: string) => string;
  isAdded?: boolean;
  showReadyToAddLabel?: boolean;
  dragMode?: 'dnd-kit' | 'none';
  onAddClick?: (chart: Chart) => void;
  onEdit?: (chart: Chart) => void;
  onDelete?: (chart: Chart) => void;
  isDeleting?: boolean;
  showActions?: boolean;
  layout?: 'list' | 'compact';
  onAddToCanvas?: (chart: Chart) => void;
  /** Remove from panel (not library delete). Shown when item is already added. */
  onRemove?: () => void;
}

export function DraggableChartItem({
  chart,
  formatVisualizationName,
  getRelativeTime,
  isAdded = false,
  showReadyToAddLabel = false,
  dragMode = 'dnd-kit',
  onAddClick,
  onEdit,
  onDelete,
  isDeleting = false,
  showActions = true,
  layout = 'list',
  onAddToCanvas,
  onRemove,
}: DraggableChartItemProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const disabled = Boolean(isAdded);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `chart-${chart.id}`,
    disabled: disabled || dragMode !== 'dnd-kit',
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      opacity: isDragging ? 0.9 : 1,
      zIndex: isDragging ? 1000 : 1,
    }
    : undefined;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleEdit = (e: React.SyntheticEvent) => {
    stop(e);
    onEdit?.(chart);
  };

  const vizName = chart.visualization_name || chart.chart_type || '';
  const isBlockItem = Boolean(chart.description);
  const isCompact = layout === 'compact' && isBlockItem;

  const dragProps = isAdded ? {} : { ...attributes, ...listeners };
  const baseCard = `rounded-md border transition-all duration-150 ${isAdded
    ? 'border-border bg-card cursor-default'
    : 'border-border bg-card cursor-grab active:cursor-grabbing'
    } ${isDragging ? 'shadow-md border-primary/50 ring-1 ring-primary/30 bg-card' : ''}`;

  const deleteButton = showActions && onDelete && !isAdded ? (
    <Popover open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="!h-6 !w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-500/10"
          title="Delete chart"
          disabled={isDeleting}
          onPointerDown={stop}
          onClick={stop}
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 py-2 px-4" align="end" side="top" onPointerDown={stop} onClick={stop}>
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Delete Chart</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Delete "{chart.chart_name}"? It will be removed from the library and from this dashboard canvas.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setIsConfirmOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => { setIsConfirmOpen(false); await onDelete?.(chart); }}
              className="h-8 text-xs font-semibold"
            >
              Delete
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  const removeFromPanelButton = showActions && onRemove && isAdded ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="!h-6 !w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 !opacity-100"
      title="Remove from panel"
      onPointerDown={stop}
      onClick={(e) => {
        stop(e);
        onRemove();
      }}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  ) : null;

  const draggedRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true;
    }
  }, [isDragging]);

  const handleAdd = onAddClick ?? onAddToCanvas;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isAdded || !handleAdd) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (e.target instanceof Element && e.target.closest('button, [data-no-add]')) return;
    handleAdd(chart);
  };

  const interactiveCard = !isAdded
    ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.99]'
    : '';

  if (isCompact) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...dragProps}
        onClick={handleCardClick}
        title={!isAdded && handleAdd ? 'Click or drag to add to dashboard' : undefined}
        className={`${baseCard} p-2 group ${interactiveCard}`}
      >
        <div className="flex items-center gap-2">
          <ChartTypeVisual vizName={vizName} isBlockItem={isBlockItem} isAdded={isAdded} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground leading-tight truncate">{chart.chart_name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{chart.description}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...dragProps}
      onClick={handleCardClick}
      title={!isAdded && handleAdd ? 'Click or drag to add to dashboard' : undefined}
      className={`${baseCard} py-1.5 pl-2 pr-2 group ${interactiveCard}`}
    >
      <div className="flex items-stretch gap-2 min-h-[3.25rem]">
        <ChartTypeVisual vizName={vizName} isBlockItem={isBlockItem} isAdded={isAdded} />

        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onPointerDown={stop}
              onClick={handleEdit}
              className={`text-left text-xs font-semibold leading-snug line-clamp-2 text-foreground min-w-0 ${onEdit ? 'group-hover:text-primary hover:text-primary cursor-pointer' : 'cursor-default'}`}
              disabled={!onEdit}
              title={onEdit ? `Edit ${chart.chart_name}` : undefined}
            >
              {chart.chart_name}
            </button>

            <div className="flex items-center gap-0.5 shrink-0" onPointerDown={stop} onClick={stop}>
              {!isAdded && showReadyToAddLabel && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  Click to add
                </span>
              )}
              {isAdded && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                  <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                  Added
                </span>
              )}
              {showActions && onEdit && !isAdded && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="!h-6 !w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10"
                  title={`Edit ${chart.chart_name}`}
                  onClick={handleEdit}
                  onPointerDown={stop}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {removeFromPanelButton}
              {deleteButton}
            </div>
          </div>

          {chart.description ? (
            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{chart.description}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
              <span className="font-medium text-primary">{formatVisualizationName(chart.visualization_name)}</span>
              <span className="mx-1 text-muted-foreground/50">·</span>
              <span>{getRelativeTime(chart.updated_at)}</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
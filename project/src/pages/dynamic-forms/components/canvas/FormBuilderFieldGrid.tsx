import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../../styles/form-builder-grid.css';
import {
  ensureFieldLayout,
  FIELD_GRID_COLS,
  FIELD_GRID_DEFAULTS,
  getMinGridWidth,
  getMinGridHeight,
  gridUnitsToWidth,
} from '../../lib/grid/form-builder-grid.utils';
import type { FormBuilderField } from '../../types';
import { CanvasFieldItem } from './CanvasFieldItem';

const { rowHeight: GRID_ROW_HEIGHT, margin: GRID_MARGIN } = FIELD_GRID_DEFAULTS;

function applyLayoutToFields(fields: FormBuilderField[], newLayout: Layout): FormBuilderField[] {
  const layoutMap = new Map(newLayout.map((item) => [item.i, item]));

  return fields.map((field, index) => {
    const item = layoutMap.get(field.id);
    if (!item) return field;

    const fieldMinW = getMinGridWidth(field.type);
    const fieldMinH = getMinGridHeight(field.type);
    const layout = {
      x: item.x,
      y: item.y,
      w: Math.max(fieldMinW, item.w),
      h: Math.max(fieldMinH, item.h),
    };

    return {
      ...field,
      layout,
      width: gridUnitsToWidth(layout.w),
      position: index,
    };
  });
}

function fieldsToLayout(visibleFields: FormBuilderField[]): Layout {
  return visibleFields.map((field, index) => {
    const layout = ensureFieldLayout(field, index, visibleFields);
    return {
      i: field.id,
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      minW: getMinGridWidth(field.type),
      minH: getMinGridHeight(field.type),
    };
  });
}

function getContentMinHeight(visibleFields: FormBuilderField[]): number {
  if (visibleFields.length === 0) return 280;
  const marginY = GRID_MARGIN[1];
  const maxBottom = visibleFields.reduce((max, field, index) => {
    const layout = ensureFieldLayout(field, index, visibleFields);
    const bottom = (layout.y + layout.h) * GRID_ROW_HEIGHT + layout.y * marginY;
    return Math.max(max, bottom);
  }, 0);
  return Math.max(280, maxBottom + GRID_MARGIN[1]);
}

function sortFieldsByLayout(fields: FormBuilderField[]): FormBuilderField[] {
  const visible = fields.filter((field) => field.visible);
  return [...fields].sort((a, b) => {
    const indexA = visible.findIndex((field) => field.id === a.id);
    const indexB = visible.findIndex((field) => field.id === b.id);
    const layoutA = ensureFieldLayout(a, indexA >= 0 ? indexA : 0, visible);
    const layoutB = ensureFieldLayout(b, indexB >= 0 ? indexB : 0, visible);
    if (layoutA.y !== layoutB.y) return layoutA.y - layoutB.y;
    return layoutA.x - layoutB.x;
  });
}

interface FormBuilderFieldGridProps {
  fields: FormBuilderField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onMoveField?: (id: string, direction: 'up' | 'down') => void;
  onLayoutChange: (fields: FormBuilderField[]) => void;
}

export const FormBuilderFieldGrid = memo(function FormBuilderFieldGrid({
  fields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  onMoveField,
  onLayoutChange,
}: FormBuilderFieldGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const skipInitialLayoutChangeRef = useRef(true);
  const skipLayoutChangesCountRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);

  const visibleFields = useMemo(() => fields.filter((field) => field.visible), [fields]);
  const orderedVisibleFields = useMemo(() => sortFieldsByLayout(visibleFields), [visibleFields]);
  const layout = useMemo(() => fieldsToLayout(visibleFields), [visibleFields]);
  const contentMinHeight = useMemo(() => getContentMinHeight(visibleFields), [visibleFields]);
  const fieldIdsKey = useMemo(() => visibleFields.map((field) => field.id).join('|'), [visibleFields]);
  const gridWidth = Math.max(280, containerWidth);

  // Bump skip counters during render (before RGL's sync onLayoutChange) so newly
  // added fields keep their intended w/h instead of being overwritten.
  const prevFieldIdsKeyRef = useRef(fieldIdsKey);
  if (prevFieldIdsKeyRef.current !== fieldIdsKey) {
    prevFieldIdsKeyRef.current = fieldIdsKey;
    skipInitialLayoutChangeRef.current = true;
    skipLayoutChangesCountRef.current = 6;
  }

  const prevGridWidthRef = useRef(gridWidth);
  if (prevGridWidthRef.current !== gridWidth) {
    prevGridWidthRef.current = gridWidth;
    skipLayoutChangesCountRef.current += 2;
  }

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => setContainerWidth(Math.max(280, node.clientWidth));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const applyLayout = useCallback(
    (newLayout: Layout) => {
      onLayoutChange(applyLayoutToFields(fields, newLayout));
    },
    [fields, onLayoutChange],
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (isDraggingRef.current || isResizingRef.current) return;

      if (skipLayoutChangesCountRef.current > 0) {
        skipLayoutChangesCountRef.current -= 1;
        return;
      }

      if (skipInitialLayoutChangeRef.current) {
        skipInitialLayoutChangeRef.current = false;
        return;
      }

      applyLayout(newLayout);
    },
    [applyLayout],
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragStop = useCallback(
    (currentLayout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      isDraggingRef.current = false;
      if (!newItem) return;
      skipInitialLayoutChangeRef.current = false;
      skipLayoutChangesCountRef.current = 2;
      applyLayout(currentLayout);
    },
    [applyLayout],
  );

  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true;
  }, []);

  const handleResizeStop = useCallback(
    (currentLayout: Layout) => {
      isResizingRef.current = false;
      skipLayoutChangesCountRef.current = 2;
      applyLayout(currentLayout);
    },
    [applyLayout],
  );

  return (
    <div
      ref={containerRef}
      className="form-builder-grid-canvas w-full"
      style={{ minHeight: contentMinHeight, height: contentMinHeight }}
    >
      <GridLayout
        className="layout"
        layout={layout}
        cols={FIELD_GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        width={gridWidth}
        margin={GRID_MARGIN}
        containerPadding={[0, 0]}
        compactType={null}
        preventCollision={false}
        allowOverlap={false}
        useCSSTransforms
        draggableHandle=".form-builder-grid-drag-handle"
        resizeHandles={['se', 's', 'e']}
        isDraggable
        isResizable
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
      >
        {visibleFields.map((field) => {
          const orderIndex = orderedVisibleFields.findIndex((item) => item.id === field.id);
          return (
            <div
              key={field.id}
              className={
                field.type === 'big_number'
                  ? 'form-builder-grid-item form-builder-grid-item--fill'
                  : 'form-builder-grid-item'
              }
            >
              <CanvasFieldItem
                field={field}
                isSelected={selectedFieldId === field.id}
                onSelect={onSelectField}
                onRemove={onRemoveField}
                onMoveUp={onMoveField ? (id) => onMoveField(id, 'up') : undefined}
                onMoveDown={onMoveField ? (id) => onMoveField(id, 'down') : undefined}
                canMoveUp={orderIndex > 0}
                canMoveDown={orderIndex >= 0 && orderIndex < orderedVisibleFields.length - 1}
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
});

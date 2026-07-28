import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import useFlowStore from '@/stores/flowStore';

const DATA_TYPE_OPTIONS = [
  { value: 'str', label: 'String (str)' },
  { value: 'int', label: 'Integer (int)' },
  { value: 'float', label: 'Float (float)' },
  { value: 'datetime', label: 'Datetime (datetime)' },
  { value: 'bool', label: 'Boolean (bool)' },
  { value: 'array', label: 'Array (array)' },
  { value: 'object', label: 'Object (object)' },
  { value: 'date', label: 'Date (date)' },
  { value: 'time', label: 'Time (time)' },
  { value: 'timestamp', label: 'Timestamp (timestamp)' },
];

const mapBackendDtypeToFrontend = (dtype: string): string => {
  const mapping: Record<string, string> = {
    Int64: 'int',
    Int32: 'int',
    Int16: 'int',
    Int8: 'int',
    UInt64: 'int',
    UInt32: 'int',
    UInt16: 'int',
    UInt8: 'int',
    Float64: 'float',
    Float32: 'float',
    String: 'str',
    Object: 'object',
    Boolean: 'bool',
    Bool: 'bool',
    DateTime: 'datetime',
    Datetime64: 'datetime',
    Date: 'date',
    Time: 'time',
    Timestamp: 'timestamp',
  };
  return mapping[dtype] || dtype?.toLowerCase() || 'str';
};

export type VirtualDbPropertyRow = {
  id: string;
  name: string;
  display_name: string;
  type: string;
  isSelected: boolean;
};

function formatSummaryValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function nonEmptySummaryString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length > 0 ? s : null;
}

function columnNameFromEntry(col: unknown): string {
  if (typeof col === 'string' || typeof col === 'number') return String(col);
  if (col && typeof col === 'object') {
    const o = col as Record<string, unknown>;
    const n =
      o.name ??
      o.column_name ??
      o.field ??
      o.column ??
      o.key ??
      o.title;
    if (n !== undefined && n !== null) return String(n);
  }
  return String(col);
}

function dtypeFromColumnEntry(col: unknown): string | undefined {
  if (col && typeof col === 'object') {
    const o = col as Record<string, unknown>;
    const d = o.dtype ?? o.type ?? o.data_type ?? o.dataType;
    if (d !== undefined && d !== null) return String(d);
  }
  return undefined;
}

/** Prefer explicit `properties`, then any column-like array on the payload (or nested output). */
function collectColumnArray(payload: Record<string, unknown>): unknown[] | null {
  const direct = payload.columns;
  if (Array.isArray(direct) && direct.length > 0) return direct;
  const out = payload.output;
  if (out && typeof out === 'object' && !Array.isArray(out)) {
    const oc = (out as Record<string, unknown>).columns;
    if (Array.isArray(oc) && oc.length > 0) return oc;
    const od = (out as Record<string, unknown>).data;
    if (od && typeof od === 'object' && !Array.isArray(od)) {
      const odc = (od as Record<string, unknown>).columns;
      if (Array.isArray(odc) && odc.length > 0) return odc;
    }
  }
  const schema = payload.schema;
  if (Array.isArray(schema) && schema.length > 0) return schema;
  const fields = payload.fields;
  if (Array.isArray(fields) && fields.length > 0) return fields;
  return null;
}

/**
 * Execution preview on `node.data.node.output`: columns array and/or row objects (infer keys from first row).
 */
function collectColumnArrayFromNodeOutput(output: unknown): unknown[] | null {
  if (output == null || typeof output !== 'object' || Array.isArray(output)) return null;
  const o = output as Record<string, unknown>;
  const cols = o.columns;
  if (Array.isArray(cols) && cols.length > 0) return cols;
  let data = o.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const innerCols = d.columns;
    if (Array.isArray(innerCols) && innerCols.length > 0) return innerCols;
    const innerData = d.data;
    if (Array.isArray(innerData) && innerData.length > 0 && innerData[0] && typeof innerData[0] === 'object') {
      return Object.keys(innerData[0] as object).map((name) => ({ name }));
    }
  }
  if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
    return Object.keys(data[0] as object).map((name) => ({ name }));
  }
  return null;
}

export function buildPropertiesFromPayload(
  payload: Record<string, unknown>,
  nodeOutput?: unknown
): VirtualDbPropertyRow[] {
  const existing = payload.properties as unknown;
  if (Array.isArray(existing) && existing.length > 0 && typeof existing[0] === 'object') {
    return (existing as any[]).map((p: any, i: number) => ({
      id: p.id || `${p.name}-${i}`,
      name: p.name || '',
      display_name: p.display_name ?? p.name ?? '',
      type: p.type || 'str',
      isSelected: p.isSelected !== false,
    }));
  }
  let cols = collectColumnArray(payload);
  if (!Array.isArray(cols) || cols.length === 0) {
    const fromOut = collectColumnArrayFromNodeOutput(nodeOutput);
    if (fromOut) cols = fromOut;
  }
  if (!Array.isArray(cols) || cols.length === 0) return [];
  const columnMapping = (payload.column_mapping as { column_name?: string; dtype?: string }[]) || [];
  return cols.map((col: unknown, index: number) => {
    const colName = columnNameFromEntry(col);
    const mappingEntry = columnMapping.find((m) => m.column_name === colName);
    const backendDtype = mappingEntry?.dtype ?? dtypeFromColumnEntry(col) ?? 'str';
    return {
      id: `${colName}-${index}`,
      name: colName,
      display_name: colName,
      type: mapBackendDtypeToFrontend(backendDtype),
      isSelected: true,
    };
  });
}

function SortablePropertyRow({
  prop,
  onPropertyChange,
  onToggle,
  readOnly,
}: {
  prop: VirtualDbPropertyRow;
  onPropertyChange: (id: string, key: string, value: unknown) => void;
  onToggle: (id: string, checked: boolean | 'indeterminate') => void;
  readOnly: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-2 items-center p-1 rounded-md hover:bg-muted/80">
      <div className="col-span-1 flex items-center gap-1">
        {!readOnly && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 cursor-grab shrink-0" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </Button>
        )}
        <Checkbox checked={prop.isSelected} onCheckedChange={(c) => onToggle(prop.id, c)} disabled={readOnly} />
      </div>
      <div className="col-span-3">
        <Input value={prop.name} readOnly disabled className="h-8 text-xs bg-muted/50" />
      </div>
      <div className="col-span-4">
        <Input
          value={prop.display_name || ''}
          onChange={(e) => onPropertyChange(prop.id, 'display_name', e.target.value)}
          placeholder="Display name"
          className="h-8 text-xs"
          readOnly={readOnly}
          disabled={readOnly}
        />
      </div>
      <div className="col-span-4">
        <Select value={prop.type} onValueChange={(v) => onPropertyChange(prop.id, 'type', v)} disabled={readOnly}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type VirtualDbSourceDetailProps = {
  canvasNodeId: string;
  /** Snapshot for pipeline inner nodes (read-only). */
  payload: Record<string, unknown>;
  readOnly: boolean;
  /** Connector node_id — shown first in configuration summary. */
  summaryNodeId?: string;
  /** Workflow id (canvas or referenced pipeline). */
  summaryFlowId?: string;
  /** Virtual DB connector category — shown as `connector` in the summary when set. */
  virtualDbTypeLabel?: string;
  /** Snapshot of `node.output` for read-only pipeline inner rows (execution preview columns). */
  detailOutput?: unknown;
};

export function VirtualDbSourceDetail({
  canvasNodeId,
  payload,
  readOnly,
  summaryNodeId,
  summaryFlowId,
  virtualDbTypeLabel,
  detailOutput,
}: VirtualDbSourceDetailProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const getNode = useFlowStore((s) => s.getNode);

  const nodeOutputFromStore = useFlowStore((state) => {
    const n = state.currentWorkflow?.data?.nodes?.find((x) => x.id === canvasNodeId);
    return n?.data?.node?.output;
  });

  const livePayload = useMemo(() => {
    if (readOnly) return payload;
    const n = getNode(canvasNodeId);
    const p = n?.data?.node?.payload;
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : payload;
  }, [canvasNodeId, getNode, payload, readOnly]);

  const liveNodeOutput = useMemo(() => {
    if (readOnly) return detailOutput;
    return nodeOutputFromStore;
  }, [readOnly, detailOutput, nodeOutputFromStore]);

  const [properties, setProperties] = useState<VirtualDbPropertyRow[]>(() =>
    buildPropertiesFromPayload(livePayload, liveNodeOutput)
  );

  useEffect(() => {
    setProperties(buildPropertiesFromPayload(livePayload, liveNodeOutput));
  }, [livePayload, liveNodeOutput, canvasNodeId]);

  const persist = useCallback(
    (next: VirtualDbPropertyRow[]) => {
      if (readOnly) return;
      const node = getNode(canvasNodeId);
      if (!node?.data?.node) return;
      updateNodeData(canvasNodeId, {
        node: {
          ...node.data.node,
          payload: {
            ...node.data.node.payload,
            properties: next,
          },
        },
      } as any);
    },
    [canvasNodeId, getNode, readOnly, updateNodeData]
  );

  const handlePropertyChange = useCallback(
    (id: string, key: string, value: unknown) => {
      const next = properties.map((p) => (p.id === id ? { ...p, [key]: value } : p));
      persist(next);
    },
    [properties, persist]
  );

  const handleToggle = useCallback(
    (id: string, isChecked: boolean | 'indeterminate') => {
      const next = properties.map((p) => (p.id === id ? { ...p, isSelected: !!isChecked } : p));
      persist(next);
    },
    [properties, persist]
  );

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setProperties((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return items;
        const next = arrayMove(items, oldIndex, newIndex);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const summaryEntries = useMemo(() => {
    const entries: [string, string][] = [];
    const nid = nonEmptySummaryString(summaryNodeId);
    if (nid) entries.push(['node_id', nid]);
    const fid = nonEmptySummaryString(summaryFlowId);
    if (fid) entries.push(['flow_id', fid]);
    const nodeKlass = !readOnly ? getNode(canvasNodeId)?.data?.klass_name : undefined;
    const connector =
      nonEmptySummaryString(livePayload.connector) ||
      nonEmptySummaryString(livePayload.connector_name) ||
      nonEmptySummaryString(livePayload.klass_name) ||
      nonEmptySummaryString(nodeKlass) ||
      nonEmptySummaryString(virtualDbTypeLabel);
    if (connector) entries.push(['connector', connector]);
    const actions = livePayload.actions;
    if (actions !== undefined && actions !== null && actions !== '') {
      entries.push(['actions', formatSummaryValue(actions)]);
    }
    return entries;
  }, [livePayload, summaryNodeId, summaryFlowId, virtualDbTypeLabel, canvasNodeId, getNode, readOnly]);

  const includesPreviewColumns = useMemo(() => {
    const fromPayload = collectColumnArray(livePayload);
    if (Array.isArray(fromPayload) && fromPayload.length > 0) return false;
    const existing = livePayload.properties as unknown;
    if (Array.isArray(existing) && existing.length > 0) return false;
    return Boolean(collectColumnArrayFromNodeOutput(liveNodeOutput)?.length);
  }, [livePayload, liveNodeOutput]);

  const selectedCount = properties.filter((p) => p.isSelected).length;

  return (
    <div className="mt-3 grid grid-cols-12 gap-2 border rounded-lg p-2 bg-muted/20">
      <div className="col-span-12 sm:col-span-4 min-h-[180px]">
        <Card className="h-full flex flex-col py-2 shadow-sm">
          <CardHeader className="p-2 pb-1">
            <CardTitle className="text-sm">Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[min(40vh,280px)] space-y-2 text-xs px-2">
            {summaryEntries.length === 0 ? (
              <p className="text-muted-foreground">No configuration fields to show.</p>
            ) : (
              summaryEntries.map(([key, val]) => (
                <div key={key} className="flex justify-between gap-2 border-t border-border/60 first:border-0 first:pt-0 pt-2">
                  <span className="font-medium text-muted-foreground shrink-0">{key}:</span>
                  <span className="text-right break-all font-medium">{val}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="col-span-12 sm:col-span-8 min-h-[180px]">
        <Card className="h-full flex flex-col py-2 shadow-sm">
          <CardHeader className="p-2 pb-1 flex-shrink-0">
            <CardTitle className="text-sm">Schema Properties</CardTitle>
            <CardDescription className="text-xs">
              {properties.length === 0
                ? 'No columns on this source. Configure the node on the canvas and save, or execute the node to preview columns.'
                : `${selectedCount} of ${properties.length} columns selected${
                    includesPreviewColumns ? ' · Column names from last execution preview' : ''
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden px-1 min-h-0">
            {properties.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">No schema columns.</div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b flex-shrink-0">
                  <div className="col-span-1" />
                  <div className="col-span-3">Name</div>
                  <div className="col-span-4">Display Name</div>
                  <div className="col-span-4">Type</div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[min(40vh,320px)] min-h-[8rem]">
                  {readOnly ? (
                    <div className="space-y-1 p-1">
                      {properties.map((prop) => (
                        <div key={prop.id} className="grid grid-cols-12 gap-2 items-center p-1 rounded-md bg-muted/30">
                          <div className="col-span-1 flex justify-center">
                            <Checkbox checked={prop.isSelected} disabled />
                          </div>
                          <div className="col-span-3">
                            <Input value={prop.name} readOnly className="h-8 text-xs bg-muted/50" />
                          </div>
                          <div className="col-span-4">
                            <Input value={prop.display_name || ''} readOnly className="h-8 text-xs bg-muted/50" />
                          </div>
                          <div className="col-span-4">
                            <Input value={DATA_TYPE_OPTIONS.find((o) => o.value === prop.type)?.label ?? prop.type} readOnly className="h-8 text-xs bg-muted/50" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1 p-1">
                          {properties.map((prop) => (
                            <SortablePropertyRow
                              key={prop.id}
                              prop={prop}
                              onPropertyChange={handlePropertyChange}
                              onToggle={handleToggle}
                              readOnly={false}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </>
            )}
            {readOnly && (
              <p className="text-xs text-muted-foreground px-2 pt-2 border-t">Pipeline inner node — edit in the source workflow if needed.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

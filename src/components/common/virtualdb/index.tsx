import React, { useEffect, useState, useMemo } from 'react';
import useFlowStore from '@/stores/flowStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Loader2 } from 'lucide-react';
import api from '@/controllers/API/api';
import { getWorkflowByIdApi } from '@/controllers/API';
import { getVirtualDbTypeForNodeData } from '@/utils/virtualDatasetPayload';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { VirtualDbSourceDetail } from './VirtualDbSourceDetail';

/** List row + payload snapshot for the detail panel */
interface VirtualSourceRow extends Record<string, unknown> {
  id: string;
  sourceType: string;
  displayName: string;
  virtualDbTypeLabel: string;
  identifier: string;
  type: string;
  location: string;
  objectName: string;
  /** Canvas node to update (pipeline reference node for inner rows). */
  canvasNodeId: string;
  /** Inner pipeline workflow node — detail is read-only from snapshot. */
  isPipelineInner: boolean;
  /** Payload for Configuration Summary + Schema (snapshot for pipeline inner). */
  detailPayload: Record<string, unknown>;
  /** Shown in configuration summary (connector node_id). */
  summaryNodeId?: string;
  /** Workflow id for this source (canvas flow_id, or referenced pipeline id for inner nodes). */
  summaryFlowId?: string;
  /** Placeholder row while pipeline workflows are fetched. */
  isPipelineLoadingPlaceholder?: boolean;
  /** Snapshot of inner node's `node.output` for schema preview (pipeline rows). */
  detailOutput?: unknown;
}

function cloneNodeOutputSnapshot(output: unknown): unknown | undefined {
  if (output == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(output));
  } catch {
    return undefined;
  }
}

type ColumnDef = { key: string; header: string; sortable?: boolean };

const SECTION_ORDER = ['DATABASE', 'FILES', 'DataSet', 'API', 'PIPELINE', 'Node'] as const;

const SECTION_TITLES: Record<string, string> = {
  DATABASE: 'Database sources',
  FILES: 'File sources',
  DataSet: 'Dataset sources',
  API: 'API sources',
  PIPELINE: 'Pipeline sources',
  Node: 'Other sources',
};

const SECTION_COLUMNS: Record<string, ColumnDef[]> = {
  DATABASE: [
    { key: 'displayName', header: 'Display name', sortable: true },
    { key: 'identifier', header: 'Connection', sortable: true },
    { key: 'type', header: 'Engine / database', sortable: true },
    { key: 'location', header: 'Schema', sortable: true },
    { key: 'objectName', header: 'Table / object', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
  FILES: [
    { key: 'displayName', header: 'Display name', sortable: true },
    { key: 'type', header: 'File type', sortable: true },
    { key: 'location', header: 'Path', sortable: true },
    { key: 'objectName', header: 'File name', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
  DataSet: [
    { key: 'displayName', header: 'Display name', sortable: true },
    { key: 'identifier', header: 'Dataset kind', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'location', header: 'Source', sortable: true },
    { key: 'objectName', header: 'Identifier', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
  API: [
    { key: 'displayName', header: 'Display name', sortable: true },
    { key: 'identifier', header: 'Connection', sortable: true },
    { key: 'type', header: 'Method / type', sortable: true },
    { key: 'location', header: 'URL / endpoint', sortable: true },
    { key: 'objectName', header: 'Name', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
  PIPELINE: [
    { key: 'displayName', header: 'Inner node', sortable: true },
    { key: 'type', header: 'Connector', sortable: true },
    { key: 'location', header: 'Pipeline node', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
  Node: [
    { key: 'displayName', header: 'Display name', sortable: true },
    { key: 'identifier', header: 'Identifier', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'location', header: 'Location', sortable: true },
    { key: 'objectName', header: 'Object', sortable: true },
    { key: 'virtualDbTypeLabel', header: 'Virtual DB type', sortable: true },
  ],
};

/** Returns true if the node is a source type (database, files, dataset, API, pipeline) that can feed Virtual DB. */
function isSourceTypeNode(node: any): boolean {
  if (!node?.data) return false;
  const nodeId = (node?.data?.node_id ?? '').toLowerCase();
  const group = (node?.data?.group ?? '').toLowerCase();
  if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId)) return true;
  if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId)) return true;
  if (node?.data?.isDataset || /dataset/i.test(nodeId)) return true;
  if (/api|webhook|http/i.test(nodeId)) return true;
  if (nodeId === 'pipeline_reference') return true;
  return false;
}

interface VirtualDBProps {
  onBack?: () => void;
  onNext?: () => void;
  mode?: 'view' | 'edit';
  onlyVirtualDbEnabled?: boolean;
}

function VirtualDB({ onNext, onlyVirtualDbEnabled = false }: VirtualDBProps) {
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const [connectionsMap, setConnectionsMap] = useState<Record<string, string>>({});
  const [pipelineSourceRows, setPipelineSourceRows] = useState<VirtualSourceRow[]>([]);
  const [pipelineSourcesLoading, setPipelineSourcesLoading] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  /** All source nodes on the canvas (optionally only virtualDbEnabled). Do not exclude the selected node — users must see the row for the node they are editing. */
  const upstreamNodes = useMemo(() => {
    if (!currentWorkflow?.data?.nodes) return [];
    const allNodes = currentWorkflow.data.nodes as any[];
    return allNodes.filter(
      (n) =>
        isSourceTypeNode(n) &&
        (!onlyVirtualDbEnabled || n?.data?.virtualDbEnabled === true)
    );
  }, [currentWorkflow?.data?.nodes, onlyVirtualDbEnabled]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await api.post('/databases/get-connections', {
          connection_id: '',
          group_type: 'databases',
        });
        const result = res.data;
        if (result?.status && result?.data) {
          const map: Record<string, string> = {};
          result.data.forEach((c: { id?: number | string; name?: string; display_name?: string }) => {
            const id = c.id?.toString() ?? '';
            map[id] = (c.name ?? c.display_name ?? id) || '-';
          });
          setConnectionsMap(map);
        }
      } catch (err) {
        console.error('Failed to fetch connections', err);
      }
    };
    fetchConnections();
  }, []);

  const directRows: VirtualSourceRow[] = useMemo(() => {
    if (!upstreamNodes?.length) return [];
    return upstreamNodes
      .filter((node: any) => node?.data?.node_id !== 'pipeline_reference')
      .map((node: any) => {
      const payload = (node?.data?.node?.payload ?? {}) as Record<string, unknown>;
      const nodeId = node?.data?.node_id ?? '';
      const group = (node?.data?.group ?? '').toLowerCase();
      const displayName = node?.data?.display_name ?? payload?.name ?? payload?.datasetName ?? node.id;
      const vdb = getVirtualDbTypeForNodeData(node.data);

      const connectionId = (payload?.connection_id ?? payload?.connection ?? '')?.toString();
      const connectionLabel = connectionId ? (connectionsMap[connectionId] ?? connectionId) : '';

      let sourceType = 'Node';
      let identifier = '';
      let type = '';
      let location = '';
      let objectName = '';

      if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId)) {
        sourceType = 'DATABASE';
        identifier = connectionLabel || connectionId || '-';
        type = (payload?.database as string) ?? nodeId ?? 'Database';
        location = (payload?.schema as string) ?? '-';
        objectName = (payload?.table as string) ?? '-';
      } else if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId)) {
        sourceType = 'FILES';
        identifier = (payload?.file_type as string) ?? (payload?.fileType as string) ?? nodeId ?? 'File';
        type = (payload?.file_type as string) ?? (payload?.fileType as string) ?? '-';
        location = (payload?.file_path as string) ?? (payload?.filePath as string) ?? (payload?.path as string) ?? '-';
        objectName = (payload?.file_name as string) ?? (payload?.fileName as string) ?? (payload?.name as string) ?? '-';
      } else if (node?.data?.isDataset || /dataset/i.test(nodeId)) {
        sourceType = 'DataSet';
        identifier = (payload?.dataset_type as string) ?? (payload?.type as string) ?? 'Dataset';
        type = (payload?.dataset_type as string) ?? (payload?.type as string) ?? '-';
        location = (payload?.dataset_source as string) ?? (payload?.source as string) ?? '-';
        objectName = (payload?.dataset_id as string) ?? (payload?.id as string) ?? (displayName as string) ?? '-';
      } else if (/api|webhook|http/i.test(nodeId)) {
        sourceType = 'API';
        identifier = connectionLabel || connectionId || '-';
        type = (payload?.method as string) ?? 'API';
        location = (payload?.url as string) ?? (payload?.endpoint as string) ?? '-';
        objectName = (payload?.method as string) ?? '-';
      } else {
        sourceType = 'Node';
        identifier = displayName ?? node.id;
        type = nodeId || '-';
        location = (payload?.workflow_id as string) ?? (payload?.flow_id as string) ?? '-';
        objectName = displayName ?? node.id;
      }

      const detailPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

      return {
        id: node.id,
        displayName: displayName || '-',
        sourceType,
        virtualDbTypeLabel: vdb,
        identifier: identifier || '-',
        type: type || '-',
        location: location || '-',
        objectName: objectName || '-',
        canvasNodeId: node.id,
        isPipelineInner: false,
        detailPayload,
        summaryNodeId: nodeId || '-',
        summaryFlowId: currentWorkflow?.flow_id ? String(currentWorkflow.flow_id) : '',
      };
    });
  }, [upstreamNodes, connectionsMap, currentWorkflow?.flow_id]);

  useEffect(() => {
    const pipelineNodes = upstreamNodes?.filter((n: any) => n?.data?.node_id === 'pipeline_reference') ?? [];
    if (pipelineNodes.length === 0) {
      setPipelineSourceRows([]);
      setPipelineSourcesLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setPipelineSourcesLoading(true);
      const rows: VirtualSourceRow[] = [];
      try {
        for (const node of pipelineNodes) {
          const payload = node?.data?.node?.payload ?? node?.data ?? {};
          const workflowId = payload?.pipeline_workflow_id ?? node?.data?.pipeline_workflow_id ?? '';
          const selectedIds: string[] = payload?.selectedWorkflowNodeIds ?? [];
          if (!workflowId || selectedIds.length === 0) continue;
          try {
            const res = await getWorkflowByIdApi({ id: workflowId });
            const workflowNodes = res?.data?.nodes ?? [];
            const pipelineLabel = node?.data?.display_name ?? 'Pipeline';
            workflowNodes
              .filter((wn: any) => selectedIds.includes(wn.id))
              .forEach((wn: any, idx: number) => {
                const wnData = wn?.data ?? {};
                const displayName = wnData?.display_name ?? wn.id;
                const vdb = getVirtualDbTypeForNodeData(wnData);
                const innerPayload = (wnData?.node?.payload ?? wnData) as Record<string, unknown>;
                const detailPayload = JSON.parse(JSON.stringify(innerPayload)) as Record<string, unknown>;
                rows.push({
                  id: `pipeline-${node.id}-${wn.id}-${idx}`,
                  displayName: displayName || '-',
                  sourceType: 'PIPELINE',
                  virtualDbTypeLabel: vdb,
                  identifier: displayName || '-',
                  type: wnData?.node_id ?? '-',
                  location: pipelineLabel,
                  objectName: displayName || '-',
                  canvasNodeId: node.id,
                  isPipelineInner: true,
                  detailPayload,
                  detailOutput: cloneNodeOutputSnapshot(wnData?.node?.output),
                  summaryNodeId: (wnData?.node_id as string) ?? '-',
                  summaryFlowId: String(workflowId),
                });
              });
          } catch (e) {
            console.error('Virtual DB: failed to load pipeline workflow', workflowId, e);
          }
        }
        if (!cancelled) setPipelineSourceRows(rows);
      } finally {
        if (!cancelled) setPipelineSourcesLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [upstreamNodes]);

  const hasPipelineReferenceNodes = useMemo(
    () => upstreamNodes.some((n: any) => n?.data?.node_id === 'pipeline_reference'),
    [upstreamNodes]
  );

  const unifiedRows = useMemo(() => {
    const base = [...directRows, ...pipelineSourceRows];
    if (
      pipelineSourcesLoading &&
      hasPipelineReferenceNodes &&
      pipelineSourceRows.length === 0
    ) {
      return [
        ...base,
        {
          id: '__pipeline-sources-loading__',
          displayName: 'Loading pipeline sources…',
          sourceType: 'PIPELINE',
          virtualDbTypeLabel: '',
          identifier: '-',
          type: '-',
          location: '-',
          objectName: '-',
          canvasNodeId: '',
          isPipelineInner: true,
          detailPayload: {},
          isPipelineLoadingPlaceholder: true,
        } as VirtualSourceRow,
      ];
    }
    return base;
  }, [directRows, pipelineSourceRows, pipelineSourcesLoading, hasPipelineReferenceNodes]);

  const selectableRows = useMemo(
    () => unifiedRows.filter((r) => !r.isPipelineLoadingPlaceholder),
    [unifiedRows]
  );

  const sectionsToRender = useMemo(() => {
    const byType = new Map<string, VirtualSourceRow[]>();
    for (const r of unifiedRows) {
      const k = r.sourceType;
      if (!byType.has(k)) byType.set(k, []);
      byType.get(k)!.push(r);
    }
    const keys = new Set(byType.keys());
    const ordered: string[] = [];
    for (const k of SECTION_ORDER) {
      if (keys.has(k)) ordered.push(k);
    }
    const orderSet = new Set<string>(SECTION_ORDER as unknown as string[]);
    for (const k of keys) {
      if (!orderSet.has(k)) ordered.push(k);
    }
    return ordered.map((sourceType) => ({
      sourceType,
      title: SECTION_TITLES[sourceType] ?? sourceType,
      rows: byType.get(sourceType) ?? [],
      columns: SECTION_COLUMNS[sourceType] ?? SECTION_COLUMNS.Node,
    }));
  }, [unifiedRows]);

  const firstSectionValue = sectionsToRender[0]?.sourceType;

  const rowIdsSignature = useMemo(() => selectableRows.map((r) => r.id).join('|'), [selectableRows]);

  useEffect(() => {
    if (selectableRows.length === 0) {
      setSelectedRowId(null);
      return;
    }
    setSelectedRowId((prev) => {
      if (prev && selectableRows.some((r) => r.id === prev)) return prev;
      for (const st of SECTION_ORDER) {
        const hit = selectableRows.find((r) => r.sourceType === st);
        if (hit) return hit.id;
      }
      return selectableRows[0]?.id ?? null;
    });
  }, [rowIdsSignature, selectableRows]);

  const selectedRow = useMemo(
    () => (selectedRowId ? selectableRows.find((r) => r.id === selectedRowId) : undefined),
    [selectedRowId, selectableRows]
  );

  if (!currentWorkflow) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">
            <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            No workflow loaded
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Open a workflow to see Virtual DB tables from database, dataset, file, API and pipeline nodes on the canvas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground min-h-0">

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {unifiedRows.length === 0 ? (
            <Card className="!py-1">
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground text-center py-8">
                  {onlyVirtualDbEnabled
                    ? 'No nodes enabled for Virtual DB yet. Use the database icon on each source node on the canvas to include it, then open this panel again.'
                    : 'No source nodes on the canvas. Drag and drop database, dataset, file, API or pipeline nodes onto the canvas to see their tables here (no connection lines required).'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion
              type="single"
              collapsible
              defaultValue={firstSectionValue}
              className="w-full rounded-lg border"
            >
              {sectionsToRender.map(({ sourceType, title, rows, columns }) => (
                <AccordionItem key={sourceType} value={sourceType} className="border-b last:border-b-0 px-2">
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      {title}
                      <span className="text-xs font-normal text-muted-foreground">({rows.length})</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            {columns.map((c) => (
                              <th key={c.key} className="text-left font-medium px-2 py-2 whitespace-nowrap">
                                {c.header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) =>
                            row.isPipelineLoadingPlaceholder ? (
                              <tr key={row.id} className="border-b border-border/50">
                                <td colSpan={columns.length} className="px-2 py-4">
                                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                                    <span>Loading pipeline sources…</span>
                                  </span>
                                </td>
                              </tr>
                            ) : (
                              <tr
                                key={row.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedRowId(row.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedRowId(row.id);
                                  }
                                }}
                                className={cn(
                                  'border-b border-border/50 cursor-pointer transition-colors',
                                  selectedRowId === row.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                                )}
                              >
                                {columns.map((c) => (
                                  <td key={c.key} className="px-2 py-2 max-w-[12rem] truncate">
                                    {String((row as any)[c.key] ?? '-')}
                                  </td>
                                ))}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                    {selectedRow &&
                    !selectedRow.isPipelineLoadingPlaceholder &&
                    rows.some((r) => r.id === selectedRow.id) ? (
                      <VirtualDbSourceDetail
                        key={selectedRow.id}
                        canvasNodeId={selectedRow.canvasNodeId}
                        payload={selectedRow.detailPayload}
                        readOnly={selectedRow.isPipelineInner}
                        summaryNodeId={selectedRow.summaryNodeId}
                        summaryFlowId={selectedRow.summaryFlowId}
                        virtualDbTypeLabel={selectedRow.virtualDbTypeLabel}
                        detailOutput={selectedRow.detailOutput}
                      />
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </ScrollArea>

      <footer className="flex-shrink-0 flex justify-end gap-2 p-2 border-t">
        {onNext && (
          <Button onClick={onNext} className="h-8 px-3 text-xs">
            Next
          </Button>
        )}
      </footer>
    </div>
  );
}

export default VirtualDB;

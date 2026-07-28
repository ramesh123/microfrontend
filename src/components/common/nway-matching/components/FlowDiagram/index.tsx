import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  MiniMap,
  NodeTypes,
} from '@xyflow/react';
import { Source, Connection as AppConnection } from '@/types';
import { CustomControls } from '../CustomControls';
import { ColumnNode } from '../ColumnNode';
import { CustomEdge } from '../CustomEdge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import '@xyflow/react/dist/style.css';

type ConnectionType = 'key' | 'validation' | 'aggregation';

const ID_SEPARATOR = '::';

interface ColumnNodeData extends Record<string, unknown> {
  label: string;
  isKey?: boolean;
  isValidation?: boolean;
  isAggregation?: boolean;
}

interface FlowDiagramProps {
  sources: Source[];
  connections: AppConnection[];
  onAddConnection: (connection: AppConnection) => void;
  onRemoveConnection: (connectionId: string) => void;
  connectionTypes: Map<string, ConnectionType>;
}

const nodeTypes: NodeTypes = {
  columnNode: ColumnNode as any,
};

const edgeTypes = {
  custom: CustomEdge,
};

const SOURCE_SPACING = 320;
const COLUMN_HEIGHT = 64;
const TITLE_HEIGHT = 50;

const SearchPanel = ({ sources, filteredSources, searchQueries, setSearchQueries }: {
  sources: Source[];
  filteredSources: Source[];
  searchQueries: Record<string, string>;
  setSearchQueries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex gap-2 p-4" style={{ paddingLeft: '120px' }}>
        {sources.map((source, index) => {
          const hasSearch = searchQueries[source.id] && searchQueries[source.id].length > 0;
          const filteredSource = filteredSources.find(s => s.id === source.id);
          return (
            <div
              key={source.id}
              className="pointer-events-auto"
              style={{
                width: `220px`,
                marginLeft: index === 0 ? '0' : `${60}px`
              }}
            >
              <div className="relative mb-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="text"
                  placeholder="Search columns..."
                  value={searchQueries[source.id] || ''}
                  onChange={(e) =>
                    setSearchQueries((prev) => ({
                      ...prev,
                      [source.id]: e.target.value,
                    }))
                  }
                  className="pl-8 h-8 text-xs bg-background border-border"
                />
              </div>
              {hasSearch && (
                <div className="text-xs text-muted-foreground text-center bg-background/80 rounded px-2 py-1">
                  {filteredSource?.columns.length || 0} of {source.columns.length} columns
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FlowCanvas = ({
  sources,
  connections,
  onAddConnection,
  onRemoveConnection,
  connectionTypes
}: FlowDiagramProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ColumnNodeData | Record<string, unknown>>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const { setViewport } = useReactFlow();

  // Filter sources based on search queries
  const filteredSources = useMemo(() => {
    return sources.map((source) => {
      const query = searchQueries[source.id]?.toLowerCase() || '';
      if (!query) return source;

      return {
        ...source,
        columns: source.columns.filter((col) => col.name.toLowerCase().includes(query)),
      };
    });
  }, [sources, searchQueries]);

  const columnIdToType = useMemo(() => {
    const map = new Map<string, ConnectionType>();
    connections.forEach(conn => {
      const type = connectionTypes.get(conn.id);
      if (type) {
        map.set(`${conn.sourceId}${ID_SEPARATOR}${conn.sourceColumn}`, type);
        map.set(`${conn.targetId}${ID_SEPARATOR}${conn.targetColumn}`, type);
      }
    });
    return map;
  }, [connections, connectionTypes]);

  useEffect(() => {
    const newNodes: Node<ColumnNodeData | Record<string, unknown>>[] = [];
    filteredSources.forEach((source, sourceIndex) => {
      // Add title node
      newNodes.push({
        id: `title-${source.id}`,
        type: 'default',
        position: { x: sourceIndex * SOURCE_SPACING, y: 0 },
        data: { label: source.name },
        draggable: false,
        selectable: false,
        connectable: false,
        style: {
          width: `${SOURCE_SPACING - 40}px`,
          textAlign: 'center',
          fontSize: '1.1rem',
          fontWeight: '600',
          color: 'hsl(var(--foreground))',
          background: 'transparent',
          border: 'none',
          padding: '0',
          minHeight: 'auto',
        },
        sourcePosition: undefined,
        targetPosition: undefined,
      });

      source.columns.forEach((column, columnIndex) => {
        const globalColumnId = `${source.id}${ID_SEPARATOR}${column.id}`;
        const type = columnIdToType.get(globalColumnId);
        newNodes.push({
          id: globalColumnId,
          type: 'columnNode',
          position: {
            x: (sourceIndex * SOURCE_SPACING) + 30,
            y: (columnIndex * COLUMN_HEIGHT) + TITLE_HEIGHT + 10
          },
          data: {
            label: column.name,
            isKey: type === 'key',
            isValidation: type === 'validation',
            isAggregation: type === 'aggregation',
          } as ColumnNodeData,
          draggable: false,
        });
      });
    });
    setNodes(newNodes);
  }, [filteredSources, sources, setNodes, columnIdToType]);

  useEffect(() => {
    if (sources.length > 0) {
      const timer = setTimeout(() => {
        setViewport({ x: 100, y: 30, zoom: 0.9 }, { duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sources, setViewport]);

  useEffect(() => {
    const newEdges: Edge[] = connections
      .filter(conn => sources.some(s => s.id === conn.sourceId || s.id === conn.sourceId.replace('_right', '')) && sources.some(s => s.id === conn.targetId || s.id === conn.targetId.replace('_right', '')))
      .map(conn => ({
        id: conn.id,
        type: 'custom',
        source: `${conn.sourceId}${ID_SEPARATOR}${conn.sourceColumn}`,
        target: `${conn.targetId}${ID_SEPARATOR}${conn.targetColumn}`,
        data: {
          isHighlighted: conn.id === selectedEdgeId,
          onRemoveConnection: onRemoveConnection,
        },
      }));
    setEdges(newEdges);
  }, [connections, sources, setEdges, selectedEdgeId, onRemoveConnection]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach(edge => onRemoveConnection(edge.id));
  }, [onRemoveConnection]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(prevId => (prevId === edge.id ? null : edge.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const isValidConnection = useCallback((connection: Connection): boolean => {
    if (!connection.source || !connection.target) return false;
    
    const sourceId = connection.source.split(ID_SEPARATOR)[0];
    const targetId = connection.target.split(ID_SEPARATOR)[0];
    
    return sourceId !== targetId;
  }, []);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    
    const [sourceId, sourceColumnId] = params.source.split(ID_SEPARATOR);
    const [targetId, targetColumnId] = params.target.split(ID_SEPARATOR);

    const sourceObj = sources.find(s => s.id === sourceId);
    const targetObj = sources.find(s => s.id === targetId);
    
    if (!sourceObj || !targetObj || !sourceColumnId || !targetColumnId) return;
    
    onAddConnection({
      id: `${params.source}${ID_SEPARATOR}${params.target}`,
      sourceId,
      targetId,
      sourceColumn: sourceColumnId,
      targetColumn: targetColumnId,
      sourceTag: sourceObj.tag,
      targetTag: targetObj.tag,
    });
  }, [sources, onAddConnection]);

  return (
    <>
      <SearchPanel
        sources={sources}
        filteredSources={filteredSources}
        searchQueries={searchQueries}
        setSearchQueries={setSearchQueries}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={onEdgesDelete}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
      >
        <MiniMap pannable zoomable />
        <style>{`
          .react-flow__node[data-id^="title-"] .react-flow__handle {
            display: none !important;
          }
        `}</style>
      </ReactFlow>
    </>
  );
};

export const FlowDiagram = (props: FlowDiagramProps) => {
  return (
    <div className="h-full w-full border rounded-lg bg-background relative">
      <ReactFlowProvider>
        <FlowCanvas {...props} />
        <CustomControls />
      </ReactFlowProvider>
    </div>
  );
};
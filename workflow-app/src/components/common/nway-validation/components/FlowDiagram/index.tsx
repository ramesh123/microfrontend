import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Source, Connection as AppConnection } from '@/types';
import { PILL_COLORS } from '@/constants/constants';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type ConnectionType = 'key' | 'validation' | 'aggregation';

const CONNECTION_COLORS = {
  key: '#F59E0B',
  validation: '#10B981', 
  aggregation: '#3B82F6',
};

interface FlowDiagramProps {
  sources: Source[];
  connections: AppConnection[];
  onAddConnection: (connection: AppConnection) => void;
  onRemoveConnection: (connectionId: string) => void;
  connectionTypes: Map<string, ConnectionType>;
  
}

interface PillRef {
  el: HTMLDivElement;
  sourceHandle: HTMLDivElement;
  targetHandle: HTMLDivElement;
}

const MappingNode = React.forwardRef<HTMLDivElement, {
  columnName: string;
  glowColor: string;
  onHandleClick: (handleType: 'source' | 'target') => void;
  onDoubleClick: () => void;
  isPendingSource: boolean;
  isConnectedSource: boolean;
  isConnectedTarget: boolean;
  connectionType?: ConnectionType;
}>(
  (
    {
      columnName,
      glowColor,
      onHandleClick,
      onDoubleClick,
      isPendingSource,
      isConnectedSource,
      isConnectedTarget,
      connectionType,
    },
    ref
  ) => {
    const handleBaseClasses =
      'handle absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-gray-300 transition-all cursor-pointer hover:scale-110';

    const getHandleStyle = (isConnected: boolean) => ({
      borderColor: isConnected ? '#6b7280' : '#d1d5db',
      backgroundColor: isConnected ? '#f3f4f6' : '#ffffff',
    });

    const getTypeIndicator = () => {
      if (connectionType === 'key') return '🔑';
      if (connectionType === 'validation') {
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-600">
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      }
      if (connectionType === 'aggregation') {
        return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-600 font-bold">
              <text x="12" y="16" textAnchor="middle" fontSize="20" fontWeight="bold" fill="currentColor">Σ</text>
            </svg>
        );
      }
      return null;
    };

    return (
      <div
        ref={ref}
        className="relative flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-gray-50 border border-gray-200 hover:bg-gray-100 shadow-sm text-gray-700"
        onDoubleClick={onDoubleClick}
      >
        <div
          data-handle-type="target"
          onClick={() => onHandleClick('target')}
          className={cn(handleBaseClasses, 'left-0 -translate-x-1/2')}
          style={getHandleStyle(isConnectedTarget)}
        />
        <span className="truncate px-3 flex items-center gap-2" title={columnName}>
          {connectionType && <span className="flex items-center">{getTypeIndicator()}</span>}
          {columnName}
        </span>
        <div
          data-handle-type="source"
          onClick={() => onHandleClick('source')}
          className={cn(
            handleBaseClasses,
            'right-0 translate-x-1/2',
            isPendingSource && 'ring-2 ring-blue-300 ring-offset-2'
          )}
          style={getHandleStyle(isConnectedSource)}
        />
      </div>
    );
    
  }
);

MappingNode.displayName = 'MappingNode';

const ConnectionLine: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  isPending?: boolean;
  color?: string;
}> = ({ from, to, isPending = false, color = '#9CA3AF' }) => {
  const midX = (from.x + to.x) / 2;
  const controlPoint1 = { x: midX, y: from.y };
  const controlPoint2 = { x: midX, y: to.y };

  const pathData = `M ${from.x} ${from.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${to.x} ${to.y}`;

  return (
    <g>
      <path
        d={pathData}
        stroke={isPending ? '#3b82f6' : '#9CA3AF'}
        strokeWidth={isPending ? '2' : '1.5'}
        fill="none"
        strokeDasharray={isPending ? '4,4' : 'none'}
        opacity={isPending ? 0.7 : 0.6}
      />
      {!isPending && (
        <circle
          cx={to.x}
          cy={to.y}
          r="2"
          fill="#9CA3AF"
          opacity="0.8"
        />
      )}
    </g>
  );
};

export const FlowDiagram: React.FC<FlowDiagramProps> = ({
  sources, 
  connections, 
  onAddConnection, 
  onRemoveConnection,
  connectionTypes,
}) => {
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    columnId: string;
  } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [stableConnections, setStableConnections] = useState<
    Record<string, { from: { x: number; y: number }; to: { x: number; y: number } }>
  >({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const pillRefs = useRef<Record<string, PillRef | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const cardColors = ['card-subtle-blue', 'card-subtle-green', 'card-subtle-purple', 'card-subtle-orange', 'card-subtle-pink'];

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

  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const newStableConnections: Record<
      string,
      { from: { x: number; y: number }; to: { x: number; y: number } }
    > = {};

    connections.forEach((connection) => {
      const sourceKey = `${connection.sourceId}-${connection.sourceColumn}`;
      const targetKey = `${connection.targetId}-${connection.targetColumn}`;
      const sourcePillRef = pillRefs.current[sourceKey];
      const targetPillRef = pillRefs.current[targetKey];

      if (sourcePillRef?.el.isConnected && targetPillRef?.el.isConnected) {
        const fromRect = sourcePillRef.sourceHandle.getBoundingClientRect();
        const toRect = targetPillRef.targetHandle.getBoundingClientRect();
        
        // Get the content element (the one with the actual content)
        const contentElement = containerRef.current?.querySelector('.flex.justify-start.gap-16');
        if (!contentElement) return;
        
        const contentRect = contentElement.getBoundingClientRect();
        
        // Calculate positions relative to the content element (not the scrollable container)
        // This ensures lines stay fixed to nodes regardless of scrolling
        const fromX = fromRect.left - contentRect.left + fromRect.width / 2;
        const fromY = fromRect.top - contentRect.top + fromRect.height / 2;
        const toX = toRect.left - contentRect.left + toRect.width / 2;
        const toY = toRect.top - contentRect.top + toRect.height / 2;
        
        newStableConnections[connection.id] = {
          from: { x: fromX, y: fromY },
          to: { x: toX, y: toY },
        };
      }
    });
    
    // Only update if positions have actually changed to prevent unnecessary re-renders and flickering
    const hasChanges = Object.keys(newStableConnections).length !== Object.keys(stableConnections).length ||
      Object.entries(newStableConnections).some(([id, pos]) => {
        const oldPos = stableConnections[id];
        return !oldPos || 
          Math.abs(oldPos.from.x - pos.from.x) > 0.5 || 
          Math.abs(oldPos.from.y - pos.from.y) > 0.5 ||
          Math.abs(oldPos.to.x - pos.to.x) > 0.5 || 
          Math.abs(oldPos.to.y - pos.to.y) > 0.5;
      });
    
    if (hasChanges) {
      setStableConnections(newStableConnections);
    }
  }, [connections, stableConnections]);

  // Debounced update function for better performance
  const debouncedUpdatePositions = useCallback(() => {
    const timeoutId = setTimeout(updatePositions, 16); // ~60fps
    return () => clearTimeout(timeoutId);
  }, [updatePositions]);

  useEffect(() => {
    const observer = new ResizeObserver(updatePositions);
    const container = containerRef.current;
    let handleScroll: (() => void) | null = null;
    
    if (container) {
      observer.observe(container);
      // Add scroll listener with requestAnimationFrame for smooth updates
      handleScroll = () => {
        requestAnimationFrame(updatePositions);
      };
      container.addEventListener('scroll', handleScroll, { passive: true });
      
      // Also observe the content element for better responsiveness
      const contentElement = container.querySelector('.flex.justify-start.gap-16');
      if (contentElement) {
        observer.observe(contentElement);
      }
    }
    updatePositions();
    return () => {
      if (container) {
        observer.unobserve(container);
        if (handleScroll) {
          container.removeEventListener('scroll', handleScroll);
        }
        
        const contentElement = container.querySelector('.flex.justify-start.gap-16');
        if (contentElement) {
          observer.unobserve(contentElement);
        }
      }
    };
  }, [sources, connections, updatePositions, filteredSources]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      // Calculate mouse position relative to the content element (not the scrollable container)
      const contentElement = containerRef.current.querySelector('.flex.justify-start.gap-16');
      if (!contentElement) return;
      
      const contentRect = contentElement.getBoundingClientRect();
      const newPosition = { 
        x: e.clientX - contentRect.left, 
        y: e.clientY - contentRect.top
      };
      
      // Only update if position has changed significantly to prevent unnecessary re-renders
      if (!mousePosition || 
          Math.abs(mousePosition.x - newPosition.x) > 1 || 
          Math.abs(mousePosition.y - newPosition.y) > 1) {
        setMousePosition(newPosition);
      }
    };
    
    const container = containerRef.current;
    if (container && pendingConnection) {
      container.addEventListener('mousemove', handleMouseMove, { passive: true });
    }
    return () => {
      if (container) container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [pendingConnection, mousePosition]);

  const handlePillClick = (sourceId: string, columnId: string, handleType: 'source' | 'target') => {
    if (handleType === 'source') {
      if (pendingConnection?.sourceId === sourceId && pendingConnection?.columnId === columnId) {
        setPendingConnection(null);
      } else {
        setPendingConnection({ sourceId, columnId });
      }
    } else if (handleType === 'target' && pendingConnection) {
      const { sourceId: sourceSourceId, columnId: sourceColumnId } = pendingConnection;

      // Prevent self-connection
      if (sourceSourceId === sourceId) {
        setPendingConnection(null);
        return;
      }

      const sourceObj = sources.find((s) => s.id === sourceSourceId);
      const targetObj = sources.find((s) => s.id === sourceId);

      if (sourceObj && targetObj) {
    onAddConnection({
          id: `${sourceSourceId}-${sourceColumnId}-${sourceId}-${columnId}`,
          sourceId: sourceSourceId,
          targetId: sourceId,
      sourceColumn: sourceColumnId,
          targetColumn: columnId,
      sourceTag: sourceObj.tag,
      targetTag: targetObj.tag,
    });
      }

      setPendingConnection(null);
    }
  };

  const handleNodeDoubleClick = (sourceId: string, columnId: string) => {
    const connectionsToRemove = connections.filter(
      (c) =>
        (c.sourceId === sourceId && c.sourceColumn === columnId) ||
        (c.targetId === sourceId && c.targetColumn === columnId)
    );

    connectionsToRemove.forEach((c) => onRemoveConnection(c.id));
  };

  const getConnectionType = (sourceId: string, columnId: string): ConnectionType | undefined => {
    const connection = connections.find(
      (c) =>
        (c.sourceId === sourceId && c.sourceColumn === columnId) ||
        (c.targetId === sourceId && c.targetColumn === columnId)
    );
    return connection ? connectionTypes.get(connection.id) : undefined;
  };

  if (sources.length === 0) {
    return (
      <div className="border-dashed border-2 rounded-xl h-full flex items-center justify-center bg-black/20">
        <div className="text-center text-muted-foreground p-4">
          <p>No sources available. Please select sources to begin mapping.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col border rounded-lg bg-background">
      {/* Scrollable Content Area - Everything Together */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={containerRef} 
          className="h-full w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: '#9CA3AF #E5E7EB'
          }}
        >
          {/* Content with Fixed Width and SVG Layer */}
          <div className="relative flex justify-start gap-16 min-w-max p-4" style={{ minWidth: `${filteredSources.length * 320}px` }}>
            {/* SVG Connections Layer - Positioned relative to content */}
            <svg
              className="absolute top-0 left-0 z-10"
              style={{
                width: '100%',
                height: '100%',
                minWidth: `${filteredSources.length * 320}px`,
                pointerEvents: 'none'
              }}
            >
              {/* Stable Connections */}
              {Object.entries(stableConnections).map(([connectionId, positions]) => {
                const connection = connections.find((c) => c.id === connectionId);
                if (!connection) return null;

                const connectionType = connectionTypes.get(connectionId);
                const strokeColor = connectionType
                  ? CONNECTION_COLORS[connectionType]
                  : '#9CA3AF';

                return (
                  <ConnectionLine
                    key={connectionId}
                    from={positions.from}
                    to={positions.to}
                    color={strokeColor}
                  />
                );
              })}

              {/* Pending Connection */}
              {pendingConnection && mousePosition && (() => {
                const sourceKey = `${pendingConnection.sourceId}-${pendingConnection.columnId}`;
                const sourcePillRef = pillRefs.current[sourceKey];
                if (!sourcePillRef?.el.isConnected) return null;

                // Calculate position relative to the content element
                const contentElement = containerRef.current?.querySelector('.flex.justify-start.gap-16');
                if (!contentElement) return null;
                
                const contentRect = contentElement.getBoundingClientRect();
                const sourceRect = sourcePillRef.sourceHandle.getBoundingClientRect();

                const from = {
                  x: sourceRect.left - contentRect.left + sourceRect.width / 2,
                  y: sourceRect.top - contentRect.top + sourceRect.height / 2,
                };

                return (
                  <ConnectionLine
                    from={from}
                    to={mousePosition}
                    color="#9CA3AF"
                    isPending={true}
                  />
                );
              })()}
            </svg>
            {filteredSources.map((source, sourceIndex) => {
              const originalSource = sources.find((s) => s.id === source.id);
              const hasSearch = searchQueries[source.id] && searchQueries[source.id].length > 0;
              
              return (
                <div
                  key={source.id}
                  className={cn(  
                    'w-72 flex-shrink-0',
                    cardColors[sourceIndex % cardColors.length]
                  )}
                >
                  {/* Source Header */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-center text-foreground p-2 rounded-md bg-background/80 backdrop-blur-sm">
                      {source.name}
                    </h3>
                  </div>
                  
                  {/* Search Input */}
                  <div className="px-2 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
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
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                    {hasSearch && (
                      <div className="text-xs text-muted-foreground mt-1 px-1">
                        {source.columns.length} of {originalSource?.columns.length || 0} columns
                      </div>
                    )}
                  </div>
                  
                  {/* Column Pills */}
                  <div className="space-y-3 px-2 pb-2">
                    {source.columns.length === 0 && hasSearch ? (
                      <div className="text-center text-sm text-muted-foreground py-4">
                        No columns match your search
                      </div>
                    ) : (
                      source.columns.map((col, colIndex) => {
                        const globalColumnKey = `${source.id}-${col.id}`;
                        const isPending =
                          pendingConnection?.sourceId === source.id &&
                          pendingConnection?.columnId === col.id;

                        const isConnectedSource = connections.some(
                          (c) => c.sourceId === source.id && c.sourceColumn === col.id
                        );
                        const isConnectedTarget = connections.some(
                          (c) => c.targetId === source.id && c.targetColumn === col.id
                        );

                        const relevantConnection = connections.find(
                          (c) =>
                            (c.sourceId === source.id && c.sourceColumn === col.id) ||
                            (c.targetId === source.id && c.targetColumn === col.id)
                        );

                        let nodeColor: string;
                        if (relevantConnection) {
                          const colorIndex = connections.indexOf(relevantConnection);
                          nodeColor = PILL_COLORS[colorIndex % PILL_COLORS.length].svg;
                        } else {
                          nodeColor = PILL_COLORS[colIndex % PILL_COLORS.length].svg;
                        }

                        const connectionType = getConnectionType(source.id, col.id);

                        return (
                          <MappingNode
                            key={globalColumnKey}
                            ref={(node) => {
                              if (node) {
                                pillRefs.current[globalColumnKey] = {
                                  el: node,
                                  sourceHandle: node.querySelector('[data-handle-type="source"]')!,
                                  targetHandle: node.querySelector('[data-handle-type="target"]')!,
                                };
                              } else {
                                delete pillRefs.current[globalColumnKey];
                              }
                            }}
                            columnName={col.name}
                            glowColor={nodeColor}
                            onHandleClick={(handleType) => handlePillClick(source.id, col.id, handleType)}
                            onDoubleClick={() => handleNodeDoubleClick(source.id, col.id)}
                            isPendingSource={isPending}
                            isConnectedSource={isConnectedSource}
                            isConnectedTarget={isConnectedTarget}
                            connectionType={connectionType}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
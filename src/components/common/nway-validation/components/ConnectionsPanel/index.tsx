import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Link2, Trash2 } from 'lucide-react';
import { Source, Connection, AggregationRule, AggregationType } from '@/types';
import { cn } from '@/lib/utils';

type ConnectionType = 'key' | 'validation' | 'aggregation';

interface ConnectionsPanelProps {
  sources: Source[];
  connections: Connection[];
  connectionTypes: Map<string, ConnectionType>;
  aggregationRules: AggregationRule[];
  onSetConnectionType: (connectionId: string, type: ConnectionType) => void;
  onUpdateAggregationRule: (rule: Partial<AggregationRule> & { connectionId: string }) => void;
  onRemoveConnection?: (connectionId: string) => void;
}

const TruncatedBadgeWithTooltip = ({ name }: { name: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="font-mono flex-1 text-center justify-center truncate bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
          {name}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{name}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const ConnectionItem = ({
  conn,
  getShortName,
  type,
  onSetType,
  onRemoveConnection,
}: {
  conn: Connection;
  getShortName: (sourceId: string, columnId: string) => string;
  type?: ConnectionType;
  onSetType: (type: ConnectionType) => void;
  onRemoveConnection?: (connectionId: string) => void;
}) => (
  <div className="flex items-center gap-1.5 justify-between bg-muted/40 p-1.5 rounded-md text-xs">
    <TruncatedBadgeWithTooltip name={getShortName(conn.sourceId, conn.sourceColumn)} />
    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
    <TruncatedBadgeWithTooltip name={getShortName(conn.targetId, conn.targetColumn)} />
   <div className="flex gap-1 ml-2">
  <Button
    size="icon"
    variant="outline"
    className={cn(
      "h-5 w-5 text-[10px] p-0",
      type === 'key' && "bg-yellow-600 text-white hover:bg-yellow-700 border-none"
    )}
    onClick={() => onSetType('key')}
    title="Set as Key"
  >
    K
  </Button>
  <Button
    size="icon"
    variant="outline"
    className={cn(
      "h-5 w-5 text-[10px] p-0",
      type === 'validation' && "bg-green-600 text-white hover:bg-green-700 border-none"
    )}
    onClick={() => onSetType('validation')}
    title="Set as Validation"
  >
    V
  </Button>
  <Button
    size="icon"
    variant="outline"
    className={cn(
      "h-5 w-5 text-[10px] p-0",
      type === 'aggregation' && "bg-blue-600 text-white hover:bg-blue-700 border-none"
    )}
    onClick={() => onSetType('aggregation')}
    title="Set as Aggregation"
  >
    A
  </Button>
  
  <Button
    size="icon"
    variant="ghost"
    className="h-5 w-5 text-[10px] p-0 text-red-600 hover:text-red-700"
    onClick={() => onRemoveConnection?.(conn.id)}
    title="Remove Connection"
  >
    <Trash2 className="h-3 w-3" />
  </Button>
</div>

  </div>
);


export const ConnectionsPanel = ({ 
  sources, 
  connections, 
  connectionTypes,
  aggregationRules,
  onSetConnectionType,
  onUpdateAggregationRule,
  onRemoveConnection,
}: ConnectionsPanelProps) => {

  const getShortName = (sourceId: string, columnId: string) => {
    const source = sources.find(s => s.id === sourceId);
    const column = source?.columns.find(c => c.id === columnId);
    return column ? `${source?.name}.${column.name}` : "??";
  };

  const aggregationOptions: { value: AggregationType | 'none', label: string }[] = [
    { value: 'none', label: 'None' }, { value: 'sum', label: 'Sum' }, { value: 'count', label: 'Count' },
    { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' }, { value: 'agg', label: 'Aggregate' },
  ];

  const handleAggregationChange = (value: string, connectionId: string) => {
    const newAgg = value === 'none' ? undefined : value as AggregationType;
    onUpdateAggregationRule({ 
        connectionId,
        sourceColumnAggregation: newAgg,
        targetColumnAggregation: newAgg,
    });
  };

  const { keyConnections, validationConnections, aggregationConnections, unmappedConnections } = useMemo(() => {
    const keys: Connection[] = [];
    const validations: Connection[] = [];
    const aggregations: Connection[] = [];
    const unmapped: Connection[] = [];

    connections.forEach(conn => {
      const type = connectionTypes.get(conn.id);
      if (type === 'key') keys.push(conn);
      else if (type === 'validation') validations.push(conn);
      else if (type === 'aggregation') aggregations.push(conn);
      else unmapped.push(conn);
    });

    return { keyConnections: keys, validationConnections: validations, aggregationConnections: aggregations, unmappedConnections: unmapped };
  }, [connections, connectionTypes]);

  const renderConnectionList = (conns: Connection[], listType?: ConnectionType) => {
    return conns.map(conn => (
      <ConnectionItem
        key={conn.id}
        conn={conn}
        getShortName={getShortName}
        type={connectionTypes.get(conn.id) || listType}
        onSetType={(type) => onSetConnectionType(conn.id, type)}
        onRemoveConnection={onRemoveConnection}
      />
    ));
  };
  
  return (
    <Card className="p-0 gap-2 flex flex-col h-full">
      <CardHeader className="p-2 border-b [.border-b]:pb-1"><CardTitle className="text-base pb-0">Connections & Rules</CardTitle></CardHeader>
      <CardContent className="p-3 pt-2 flex-1 min-h-0 overflow-y-auto">
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground">
            <Link2 className="h-8 w-8" /><p className="text-sm mt-2">No connections made.</p>
            <p className="text-xs">Draw lines between columns to create connections.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {unmappedConnections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">New Mappings ({unmappedConnections.length})</h4>
                <div className="space-y-1.5 border border-dashed rounded-lg p-2">{renderConnectionList(unmappedConnections)}</div>
              </div>
            )}
            {keyConnections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">Key Mappings ({keyConnections.length})</h4>
                <div className="space-y-1.5">{renderConnectionList(keyConnections, 'key')}</div>
              </div>
            )}
            {validationConnections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">Validation Mappings ({validationConnections.length})</h4>
                <div className="space-y-1.5">{renderConnectionList(validationConnections, 'validation')}</div>
              </div>
            )}
            {aggregationConnections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">Aggregation Rules ({aggregationConnections.length})</h4>
                <div className="space-y-2">
                  {aggregationConnections.map(conn => {
                    const rule = aggregationRules.find(r => r.connectionId === conn.id);
                    if (!rule) return null;
                    return (
                      <div key={conn.id} className="bg-muted/50 p-2 rounded-lg text-xs space-y-2">
                        <ConnectionItem conn={conn} getShortName={getShortName} type="aggregation" onSetType={(type) => onSetConnectionType(conn.id, type)} onRemoveConnection={onRemoveConnection} />
                        <div className="flex items-center gap-2 justify-between pl-1 pt-2 border-t border-dashed">
                          <span className="text-xs font-semibold">Function:</span>
                          <Select value={rule.sourceColumnAggregation || 'none'} onValueChange={(v) => handleAggregationChange(v, conn.id)}>
                            <SelectTrigger className="h-7 text-xs w-40 flex-shrink-0"><SelectValue /></SelectTrigger>
                            <SelectContent>{aggregationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

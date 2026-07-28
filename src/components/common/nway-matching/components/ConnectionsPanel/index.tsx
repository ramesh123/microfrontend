import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Link2, Settings, Trash2 } from 'lucide-react';
import { Source, Connection, AggregationRule, AggregationType } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface ConnectionsPanelProps {
  sources: Source[];
  connections: Connection[];
  aggregationRules: AggregationRule[];
  onUpdateAggregationRule: (rule: Partial<AggregationRule> & { connectionId: string }) => void;
  onToggleAggregation: (connectionId: string) => void;
  onRemoveConnection: (connectionId: string) => void;
}
const TruncatedBadgeWithTooltip = ({ name }: { name: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="font-mono flex-1 text-center justify-center truncate bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs">
          {name}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{name}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
export const ConnectionsPanel = ({
  sources,
  connections,
  aggregationRules,
  onUpdateAggregationRule,
  onToggleAggregation,
  onRemoveConnection,
}: ConnectionsPanelProps) => {
  const getShortName = (sourceId: string, columnId: string) => {
    const isRightSource = sourceId.endsWith('_right');
    const baseSourceId = isRightSource ? sourceId.slice(0, -6) : sourceId;
    const source = sources.find(s => s.id === baseSourceId);
    const column = source?.columns.find(c => c.id === columnId);
    if (!column || !source) return "??";
    const sourceName = isRightSource ? `${source.name} (Right)` : source.name;
    return `${sourceName}.${column.name}`;
  };
  const aggregationOptions: { value: AggregationType | 'none', label: string }[] = [
    { value: 'none', label: 'Equal' }, { value: 'sum', label: 'Sum' }, { value: 'count', label: 'Count' },
    { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' }, { value: 'agg', label: 'Aggregate' },
  ];
  const handleAggregationChange = (value: string, connectionId: string) => {
    const newAgg = value === 'none' ? 'none' : value as AggregationType;
    onUpdateAggregationRule({
      connectionId,
      sourceColumnAggregation: newAgg,
      targetColumnAggregation: newAgg,
    });
  };
  return (
    <Card className="p-0 gap-2 flex flex-col h-full">
      <CardHeader className="p-3 border-b">
        <CardTitle className="text-base">Connections & Rules</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2 flex-1 min-h-0 overflow-y-auto">
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground">
            <Link2 className="h-8 w-8 mb-2" />
            <p className="text-sm font-semibold">No connections made.</p>
            <p className="text-xs">Draw lines between columns to create connections.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Column Mappings ({connections.length})</h4>
              <div className="space-y-2">
                {connections.map(conn => {
                  const aggregationRule = aggregationRules.find(r => r.connectionId === conn.id);
                  const isAggregationActive = !!aggregationRule;
                  return (
                    <div key={conn.id} className="border bg-background p-2 rounded-lg text-xs space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
                          <TruncatedBadgeWithTooltip name={getShortName(conn.sourceId, conn.sourceColumn)} />
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <TruncatedBadgeWithTooltip name={getShortName(conn.targetId, conn.targetColumn)} />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    "h-6 w-6 text-xs p-0 font-bold",
                                    isAggregationActive && "bg-foreground text-white hover:bg-foreground/90"
                                  )}
                                  onClick={() => onToggleAggregation(conn.id)}
                                >
                                  A
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Toggle Aggregation</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                  <Settings className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Configure Connection</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => onRemoveConnection(conn.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Remove Connection</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      {isAggregationActive && (
                        <div className="flex items-center gap-2 justify-between pl-1 pt-2 border-t border-dashed">
                          <span className="text-xs font-semibold">Function:</span>
                          <Select value={aggregationRule?.sourceColumnAggregation || 'none'} onValueChange={(v) => handleAggregationChange(v, conn.id)}>
                            <SelectTrigger className="h-7 text-xs w-32 flex-shrink-0"><SelectValue /></SelectTrigger>
                            <SelectContent>{aggregationOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
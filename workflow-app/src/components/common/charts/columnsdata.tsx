import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { GripVertical, Search, X, Type, Hash, CalendarDays } from 'lucide-react';
import { DraggableItem } from '@/components/DraggableItem';
import { getUpstreamNodeFieldColumns } from '@/pages/charts/ChartFormulator/utils';

const FieldIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'string':
      return <Type className="h-3 w-3 text-muted-foreground" />;
    case 'number':
      return <Hash className="h-3 w-3 text-muted-foreground" />;
    case 'date':
      return <CalendarDays className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Type className="h-3 w-3 text-muted-foreground" />;
  }
};

const inferFieldType = (columnName: string): 'string' | 'number' | 'date' => {
  const name = columnName.toLowerCase();

  const datePatterns = [
    'date', 'time', 'timestamp', 'created', 'updated', 'modified',
    'start', 'end', 'birth', 'join', 'expire', 'valid', 'since',
    'day', 'month', 'year', 'hour', 'minute', 'second'
  ];

  if (datePatterns.some(pattern => name.includes(pattern))) {
    return 'date';
  }

  const numberPatterns = [
    'count', 'sum', 'total', 'amount', 'price', 'cost', 'value',
    'quantity', 'qty', 'num', 'number', 'id', 'score', 'rate',
    'percent', 'percentage', 'ratio', 'avg', 'average', 'max', 'min',
    'netwr', 'txn', 'txns', 'amount', 'balance', 'revenue', 'profit',
    'loss', 'income', 'expense', 'fee', 'charge', 'discount'
  ];

  if (numberPatterns.some(pattern => name.includes(pattern))) {
    return 'number';
  }

  return 'string';
};

const formatFieldName = (name: string) => {
  let formatted = String(name || '').replace(/_/g, ' ');
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
  return formatted.trim();
};

const firstcaps = (str?: string) => {
  const s = String(str || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

interface UpstreamFieldsSidebarProps {
  upstreamNodes: any[];
  isViewOnly?: boolean;
}

export function UpstreamFieldsSidebar({ upstreamNodes, isViewOnly = false }: UpstreamFieldsSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<Record<string, string>>({});

  const toggle = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const clearSearch = (id: string) =>
    setSearch((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });

  return (
    <div className="flex h-full flex-col border-l border-border/60 bg-muted/90 overflow-hidden">
      <div className="p-3 pb-2">
        <h2 className="text-base font-semibold">Upstream Fields</h2>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0 ">
        <div className="p-2 space-y-2">
          {upstreamNodes.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No upstream nodes
            </div>
          ) : (
            upstreamNodes.map((node) => {
              const cols = getUpstreamNodeFieldColumns(node);
              const term = search[node.id] || '';

              const filtered = cols.filter((c: string) =>
                c.toLowerCase().includes(term.toLowerCase())
              );

              return (
                <div
                  key={node.id}
                  className="border border-border/60 rounded-md bg-background"
                >
                  <button
                    className="w-full px-3 py-2 flex justify-between items-center hover:bg-accent"
                    onClick={() => toggle(node.id)}
                  >
                    <span className="flex items-center min-w-0 flex-1 gap-2">
                      <span className="text-sm font-medium truncate" title={
                        node.data?.display_name || node.data?.node?.name || node.data?.label || node.name || node.id
                      }>
                        {firstcaps(
                          node.data?.display_name || node.data?.node?.name || node.data?.label || node.name || node.id
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {cols.length} cols
                    </span>
                  </button>

                  {expanded[node.id] && (
                    <div className="px-2 py-2 space-y-2 w-full min-w-0">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={term}
                          onChange={(e) =>
                            setSearch((p) => ({
                              ...p,
                              [node.id]: e.target.value,
                            }))
                          }
                          placeholder="Search columns..."
                          className="w-full h-7 pl-8 pr-8 text-xs placeholder:text-sm"
                        />
                        {term && (
                          <button
                            onClick={() => clearSearch(node.id)}
                            className="absolute right-2 top-2 text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Fields */}
                      {filtered.map((col: string) => {
                        const type = inferFieldType(col);
                        return (
                          <DraggableItem
                            key={`${node.id}-${col}`}
                            id={`field-${node.id}-${col}`}
                            data={{
                                type: 'field',
                                field: { name: col, type, source: node.id },
                            }}
                            disabled={isViewOnly}
                          >
                            <div className={`group flex ${isViewOnly ? 'cursor-default opacity-100' : 'cursor-grab'} items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-1 transition-colors ${isViewOnly ? '' : 'hover:border-primary hover:bg-accent'}`}>
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                              <FieldIcon type={type} />
                              <span className="flex-1 text-xs font-medium min-w-0 truncate">{(col)}</span>
                            </div>
                          </DraggableItem>
                        );
                      })}

                      {filtered.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          No matching columns
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

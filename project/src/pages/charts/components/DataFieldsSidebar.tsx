import { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Type,
  Hash,
  CalendarDays,
  GripVertical,
  Search,
  X,
  Loader2,
  Columns3,
  Hand,
  CheckCircle2,
} from 'lucide-react';
import { DraggableItem } from '@/components/DraggableItem';
import { cn } from '@/lib/utils';



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

export interface Source {
  name: string;
  columns: string[];
}

interface DataFieldsSidebarProps {
  sources: Source[];
  selectedSource: string | null;
  onSourceChange: (sourceName: string) => void;
  isLoading?: boolean;
  isViewOnly?: boolean;
  variant?: 'default' | 'wizard';
  boundFieldNames?: string[];
}

const formatFieldName = (name: string) => {
  // Replace underscores with spaces
  let formatted = String(name || '').replace(/_/g, ' ');

  // Add space before capital letters only if preceded by lowercase (word boundaries)
  // This prevents adding spaces between consecutive capitals (e.g., "VBELN" stays "VBELN")
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Capitalize first letter and lowercase the rest
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();

  return formatted.trim();
};

const inferFieldType = (columnName: string): 'string' | 'number' | 'date' => {
  const name = columnName.toLowerCase();

  // Date patterns
  const datePatterns = [
    'date', 'time', 'timestamp', 'created', 'updated', 'modified',
    'start', 'end', 'birth', 'join', 'expire', 'valid', 'since',
    'day', 'month', 'year', 'hour', 'minute', 'second'
  ];

  if (datePatterns.some(pattern => name.includes(pattern))) {
    return 'date';
  }

  // Number patterns
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

  // Default to string
  return 'string';
};

export function DataFieldsSidebar({
  sources,
  selectedSource,
  onSourceChange,
  isLoading = false,
  isViewOnly = false,
  variant = 'default',
  boundFieldNames = [],
}: DataFieldsSidebarProps) {
  const isWizard = variant === 'wizard';
  const [isFieldsOpen, setIsFieldsOpen] = useState(true);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [globalSearch, setGlobalSearch] = useState('');

  const boundFieldSet = useMemo(
    () => new Set(boundFieldNames.map((name) => name.toLowerCase())),
    [boundFieldNames],
  );

  useEffect(() => {
    const sourceToExpand = selectedSource ?? sources[0]?.name;
    if (!sourceToExpand) return;
    setExpandedSources((prev) => ({ ...prev, [sourceToExpand]: true }));
  }, [selectedSource, sources]);

  const totalColumns = sources.reduce((sum, source) => sum + source.columns.length, 0);

  const toggleSource = (name: string) => {
    // Only expand/collapse; do not force switching selected source.
    setExpandedSources((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSearchChange = (sourceName: string, value: string) => {
    setSearchTerms((prev) => ({ ...prev, [sourceName]: value }));
  };

  const clearSearch = (sourceName: string) => {
    setSearchTerms((prev) => {
      const updated = { ...prev };
      delete updated[sourceName];
      return updated;
    });
  };
  const firstcaps = (str: string) => {
    const s = String(str || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden',
        isWizard ? 'min-w-0 border-0 bg-muted/50' : 'border-l border-border/60 bg-muted/50',
      )}
    >
      <div className={cn('pb-2', isWizard ? 'px-3 pt-3' : 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {isWizard ? (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Columns3 className="size-3.5 text-primary" />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className={cn("text-sm font-semibold", isWizard ? 'text-xs font-bold uppercase text-foreground tracking-tight' : 'text-muted-foreground')}>Data fields</h2>
              {isWizard ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {isViewOnly ? 'Available columns' : 'Drag onto chart slots →'}
                </p>
              ) : null}
            </div>
          </div>
          {isWizard && totalColumns > 0 ? (
            <Badge variant="secondary" className="shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold">
              {totalColumns}
            </Badge>
          ) : null}
        </div>
      </div>
      <Separator className={isWizard ? 'bg-border/50' : 'bg-border/90'} />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* <div className="flex-shrink-0 p-2 pt-2">
          <Badge
            variant="secondary"
            className="w-full justify-start px-2 py-1.5 text-sm font-normal cursor-pointer"
            onClick={() => setIsFieldsOpen(!isFieldsOpen)}
          >
            Data Sources
          </Badge>
        </div> */}
        {isFieldsOpen && (
          <ScrollArea className={cn('min-h-0 flex-1', isWizard ? 'min-w-0' : 'overflow-hidden')}>
            <div className={cn('pb-2', isWizard ? 'min-w-0 px-2 pt-2' : 'p-2 pt-2')}>
              {isLoading ? (
                <div className="py-6 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mb-2" />
                  Loading sources...
                </div>
              ) : sources.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No sources loaded
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => {
                    const isExpanded = !!expandedSources[source.name];
                    const searchTerm = globalSearch || searchTerms[source.name] || '';

                    // Filter columns based on search term
                    const filteredColumns = source.columns.filter((col) => {
                      if (!searchTerm) return true;
                      const searchLower = searchTerm.toLowerCase();
                      const colLower = col.toLowerCase();
                      const formattedName = formatFieldName(col).toLowerCase();
                      return colLower.includes(searchLower) || formattedName.includes(searchLower);
                    });

                    const sourceFields = filteredColumns.map((col) => ({
                      name: col,
                      type: inferFieldType(col),
                    }));

                    return (
                      <div
                        key={source.name}
                        className={cn(
                          'rounded-lg border bg-background',
                          isWizard ? 'w-full min-w-0 border-border/50 shadow-sm' : 'border-border/60 rounded-md',
                        )}
                      >
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                            isWizard ? 'rounded-t-lg hover:bg-muted/40' : 'rounded-md hover:bg-accent',
                          )}
                          onClick={() => toggleSource(source.name)}
                        >
                          <span
                            className={cn(
                              'flex min-w-0 items-center gap-2',
                              isWizard ? 'flex-1' : 'max-w-50 flex-1',
                            )}
                          >
                            <span className="truncate text-sm font-semibold" title={source.name}>
                              {firstcaps(source.name)}
                            </span>
                          </span>
                          <Badge
                            variant="outline"
                            className="h-5 shrink-0 rounded-full px-2 text-[10px] font-medium"
                          >
                            {source.columns.length}
                          </Badge>
                        </button>
                        {isExpanded && (
                          <div
                            className={cn(
                              'space-y-2 border-t border-border/40 px-2 py-2',
                              isWizard ? 'w-full min-w-0' : 'max-w-68',
                            )}
                          >
                            {/* Search bar for this source */}
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder="Search columns..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(source.name, e.target.value)}
                                className="h-7 pl-8 pr-8 text-xs placeholder:text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {searchTerm && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearSearch(source.name);
                                  }}
                                  className="absolute right-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {sourceFields.length > 0 ? (
                              <div
                              className={cn(
                                "space-y-1.5 overflow-y-auto pr-0.5",
                                isWizard
                                  ? "max-h-[calc(100vh-22rem)]"
                                  : "max-h-[calc(100vh-22rem)]"
                              )}
                            >
                                {sourceFields.map((field) => {
                                  const isBound = boundFieldSet.has(field.name.toLowerCase());
                                  return (
                                  <DraggableItem
                                    key={`${source.name}-${field.name}`}
                                    id={`field-${source.name}-${field.name}`}
                                    data={{ type: 'field', field: { name: field.name, type: field.type, source: source.name } }}
                                    disabled={isViewOnly}
                                  >
                                    <div
                                      className={cn(
                                        'group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all',
                                        isViewOnly
                                          ? 'cursor-default border-border/40 bg-muted/20'
                                          : 'cursor-grab border-border/50 bg-background hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm',
                                        field.type === 'number' && 'border-l-2 border-l-amber-500/60',
                                        field.type === 'date' && 'border-l-2 border-l-sky-500/60',
                                        field.type === 'string' && 'border-l-2 border-l-violet-500/40',
                                        isBound && 'border-emerald-500/30 bg-emerald-500/[0.04] opacity-80',
                                      )}
                                    >
                                      {!isViewOnly ? (
                                        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/70 group-hover:text-primary/70" />
                                      ) : null}
                                      <div className="!font-semibold text-xs">
                                        <FieldIcon type={field.type} />
                                      </div>
                                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                                        {field.name}
                                      </span>
                                      {isBound ? (
                                        <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                      ) : null}
                                    </div>
                                  </DraggableItem>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="py-3 text-center text-xs text-muted-foreground">
                                {searchTerm ? 'No columns match your search' : 'No columns available'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
      {isWizard ? (
        <div className="shrink-0 border-t border-border/40 bg-muted/15 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Field types
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-violet-500/70" />
              Text
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500/70" />
              Number
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-sky-500/70" />
              Date
            </span>
            {boundFieldNames.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-600" />
                In use
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}


import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Source, SourceFilter, CustomFilter } from "@/types";
import { Plus, X, Menu, Filter, MessageSquare } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { HorizontalAiPanel } from '@/components/common/FilterOperations/HorizontalAiPanel';
import { AiPredicateChatDialog } from '@/components/common/FilterOperations/AiPredicateChatDialog';
import type { TableContext } from '@/components/common/FilterOperations/aiPredicateApi';
import AiIcon from "@/assets/images/icons8-ai-64.png";
import { useState, useCallback } from 'react';

interface SortableFilterItemProps {
    filter: CustomFilter;
    onRemove: (filterId: string) => void;
    onChange: (filterId: string, value: string) => void;
}

const SortableFilterItem = ({ filter, onRemove, onChange }: SortableFilterItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: filter.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("flex items-center gap-2", isDragging && "opacity-50 z-50 shadow-lg")}
        >
            <Button {...attributes} {...listeners} variant="ghost" size="icon" className="cursor-grab h-9 w-9">
                <Menu className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Input
                className="h-9 text-sm"
                placeholder="Enter filter expression... (e.g., amount > 1000)"
                value={filter.user_request || filter.value}
                onChange={(e) => onChange(filter.id, e.target.value)}
                readOnly={!!filter.user_request}
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => onRemove(filter.id)}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
};

interface SourceFiltersProps {
  sources: Source[];
  sourceFilters: Record<string, SourceFilter>;
  onUpdateFilter: (sourceId: string, settings: Partial<SourceFilter>) => void;
  getSourceTableContext?: (sourceId: string) => TableContext | undefined;
}

export function SourceFilters({ sources, sourceFilters = {}, onUpdateFilter, getSourceTableContext }: SourceFiltersProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  
  // State for AI panels per source
  const [sourceAiPanels, setSourceAiPanels] = useState<Record<string, boolean>>({});
  const [sourceChatDialogs, setSourceChatDialogs] = useState<Record<string, boolean>>({});
  const [sourceChatDialogData, setSourceChatDialogData] = useState<Record<string, {
    question?: string;
    options?: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }>>({});

  const handleDragEnd = (event: DragEndEvent, sourceId: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const sourceFilter = sourceFilters[sourceId];
        if (!sourceFilter) return;

        const oldIndex = sourceFilter.customFilters.findIndex((f) => f.id === active.id);
        const newIndex = sourceFilter.customFilters.findIndex((f) => f.id === over.id);

        const reorderedFilters = arrayMove(sourceFilter.customFilters, oldIndex, newIndex);
        onUpdateFilter(sourceId, { customFilters: reorderedFilters });
    }
  };

  const handleCustomFilterChange = (sourceId: string, filterId: string, value: string) => {
    const sourceFilter = sourceFilters[sourceId];
    if (!sourceFilter) return;
    const updatedFilters = sourceFilter.customFilters.map(f =>
      f.id === filterId ? { ...f, value } : f
    );
    onUpdateFilter(sourceId, { customFilters: updatedFilters });
  };

  const addCustomFilter = (sourceId: string) => {
    const sourceFilter = sourceFilters[sourceId];
    if (!sourceFilter) return;
    const newFilter: CustomFilter = {
      id: `filter-${Date.now()}`,
      value: '',
    };
    onUpdateFilter(sourceId, { customFilters: [...sourceFilter.customFilters, newFilter] });
  };

  const removeCustomFilter = (sourceId: string, filterId: string) => {
    const sourceFilter = sourceFilters[sourceId];
    if (!sourceFilter) return;
    onUpdateFilter(sourceId, { customFilters: sourceFilter.customFilters.filter(f => f.id !== filterId) });
  };

  // AI handlers for each source
  const handleSourceAiApply = useCallback((sourceId: string, filter: string, userRequest?: string) => {
    const sourceFilter = sourceFilters[sourceId] || { dropDuplicates: false, duplicateColumns: [], customFilters: [] };
    const newFilter: CustomFilter = {
      id: `ai-filter-${Date.now()}`,
      value: filter,
      user_request: userRequest
    };
    onUpdateFilter(sourceId, {
      ...sourceFilter,
      customFilters: [...sourceFilter.customFilters, newFilter]
    });
    setSourceAiPanels(prev => ({ ...prev, [sourceId]: false }));
  }, [sourceFilters, onUpdateFilter]);

  const handleSourceAiDiscard = useCallback((sourceId: string) => {
    setSourceAiPanels(prev => ({ ...prev, [sourceId]: false }));
  }, []);

  const handleOpenSourceChatDialog = useCallback((sourceId: string, initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => {
    setSourceChatDialogData(prev => ({ ...prev, [sourceId]: initialData }));
    setSourceChatDialogs(prev => ({ ...prev, [sourceId]: true }));
    setSourceAiPanels(prev => ({ ...prev, [sourceId]: false }));
  }, []);

  const handleSourceAiChatCodeGenerated = useCallback((sourceId: string, code: string) => {
    const sourceFilter = sourceFilters[sourceId] || { dropDuplicates: false, duplicateColumns: [], customFilters: [] };
    const newFilter: CustomFilter = {
      id: `ai-chat-filter-${Date.now()}`,
      value: code
    };
    onUpdateFilter(sourceId, {
      ...sourceFilter,
      customFilters: [...sourceFilter.customFilters, newFilter]
    });
  }, [sourceFilters, onUpdateFilter]);

  if (sources.length === 0) {
    return <div className="text-sm text-muted-foreground p-4 text-center">Select sources to configure filters.</div>;
  }

  return (
    <div className="w-full">
        <h3 className="text-base font-semibold mb-2">Rule Filters</h3>
        <Accordion type="multiple" className="w-full space-y-3">
            {sources.map(source => {
                const filters = sourceFilters[source.id] || { dropDuplicates: false, duplicateColumns: [], customFilters: [] };
                const selectedColumnName = filters.duplicateColumns[0] || '';
                
                return (
                    <AccordionItem value={source.id} key={source.id} className="border rounded-md px-4 py-1 overflow-visible">
                        <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-primary" />
                                <span>{source.name} Filters</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`drop-dup-${source.id}`}
                                        checked={filters.dropDuplicates}
                                        onCheckedChange={(checked) => onUpdateFilter(source.id, { dropDuplicates: !!checked, duplicateColumns: [] })}
                                    />
                                    <Label htmlFor={`drop-dup-${source.id}`} className="font-normal text-sm whitespace-nowrap">Drop Duplicates</Label>
                                </div>
                                {filters.dropDuplicates && (
                                    <Select
                                        value={selectedColumnName}
                                        onValueChange={(value) => onUpdateFilter(source.id, { duplicateColumns: value ? [value] : [] })}
                                    >
                                        <SelectTrigger id={`select-dup-col-${source.id}`} className="w-48 h-9 text-xs">
                                            <SelectValue placeholder="Select column..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {(source.columns || []).map(opt => (
                                            <SelectItem key={opt.name} value={opt.name} className="text-xs">
                                            {opt.name}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <div className="flex items-center gap-2">
                                    <Label htmlFor={`selected-dup-${source.id}`} className="text-sm font-normal whitespace-nowrap">
                                        Selected Drop Duplicates:
                                    </Label>
                                    <Input 
                                        id={`selected-dup-${source.id}`}
                                        readOnly 
                                        value={filters.dropDuplicates ? selectedColumnName : ''}
                                        placeholder="None"
                                        className="h-9 text-sm w-48 bg-muted/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-4">
                                <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">Custom Filters:</h4>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => addCustomFilter(source.id)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                                {/* AI Icons - Beside Custom Filters heading */}
                                {getSourceTableContext && (
                                  <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                                    <Button
                                      onClick={() => setSourceChatDialogs(prev => ({ ...prev, [source.id]: true }))}
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7 border-purple-300 hover:bg-purple-50 shadow-sm flex-shrink-0"
                                      title="AI Chat with History"
                                      disabled={!getSourceTableContext(source.id)}
                                    >
                                      <MessageSquare className="h-3.5 w-3.5 text-purple-600" />
                                    </Button>
                                    <Button
                                      onClick={() => setSourceAiPanels(prev => ({ ...prev, [source.id]: !prev[source.id] }))}
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7 border-primary/30 hover:bg-primary/10 shadow-sm flex-shrink-0"
                                      title="AI Generate Filter (Quick)"
                                      disabled={!getSourceTableContext(source.id)}
                                    >
                                      <img src={AiIcon} alt="AI" className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                                </div>
                                
                                {/* Source AI Panel - Below Custom Filters heading */}
                                {sourceAiPanels[source.id] && getSourceTableContext && getSourceTableContext(source.id) && (
                                  <div className="mb-2">
                                    <HorizontalAiPanel
                                      onApply={(filter, userRequest) => handleSourceAiApply(source.id, filter, userRequest)}
                                      onDiscard={() => handleSourceAiDiscard(source.id)}
                                      context={getSourceTableContext(source.id)!}
                                      showExecuteButton={false}
                                      onOpenChatDialog={(initialData) => handleOpenSourceChatDialog(source.id, initialData)}
                                    />
                                  </div>
                                )}
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(e) => handleDragEnd(e, source.id)}
                                >
                                    <SortableContext items={filters.customFilters} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2 pt-2">
                                            {filters.customFilters.map((filter) => (
                                                <SortableFilterItem
                                                    key={filter.id}
                                                    filter={filter}
                                                    onChange={(filterId, value) => handleCustomFilterChange(source.id, filterId, value)}
                                                    onRemove={(filterId) => removeCustomFilter(source.id, filterId)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                                {filters.customFilters.length === 0 && (
                                    <p className="text-xs text-muted-foreground pl-12">No custom filters added.</p>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
        
        {/* AI Chat Dialogs for each source */}
        {getSourceTableContext && sources.map(source => (
          sourceChatDialogs[source.id] && getSourceTableContext(source.id) && (
            <AiPredicateChatDialog
              key={`chat-${source.id}`}
              isOpen={sourceChatDialogs[source.id]}
              onClose={() => {
                setSourceChatDialogs(prev => ({ ...prev, [source.id]: false }));
                setSourceChatDialogData(prev => ({ ...prev, [source.id]: {} }));
              }}
              onCodeGenerated={(code) => handleSourceAiChatCodeGenerated(source.id, code)}
              tableContext={getSourceTableContext(source.id)}
              initialQuestion={sourceChatDialogData[source.id]?.question}
              initialOptions={sourceChatDialogData[source.id]?.options}
              initialConversationId={sourceChatDialogData[source.id]?.conversationId}
              initialEventId={sourceChatDialogData[source.id]?.eventId}
              initialUserRequest={sourceChatDialogData[source.id]?.userRequest}
            />
          )
        ))}
    </div>
  );
}

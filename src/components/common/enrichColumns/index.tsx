import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, GripVertical, Link, Database, Search, ArrowRight, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useSourceNodes from '@/hooks/use-source-nodes';
import { cn } from '@/lib/utils';
import useFlowStore from '@/stores/flowStore';
import { HorizontalAiPanel } from '@/components/common/FilterOperations/HorizontalAiPanel';
import { AiPredicateChatDialog } from '@/components/common/FilterOperations/AiPredicateChatDialog';
import type { TableContext } from '@/components/common/FilterOperations/aiPredicateApi';
import { toast } from 'sonner';
import AiIcon from '@/assets/images/icons8-ai-64.png';
import { JoinAiPanel } from './JoinAiPanel';
import { JoinAiChatDialog } from './JoinAiChatDialog';
import type { TableContext as JoinTableContext, SuccessResponse as JoinSuccessResponse } from './joinRequestApi';
import { useRbacStore } from '@/stores/useRBACStore';
// Helper types
interface FilterItem { id: string; value: string; user_request?: string; }
interface KeyPair { source_column: string; lookup_column: string; }
interface SourceNode {
  id: string;
  data: {
    display_name?: string;
    node: {
      output: {
        columns: string[];
      };
    };
  };
}

interface NodeDataType {
  id: string;
  name: string;
  display_name: string;
}
interface FormData {
  name: string;
  mergeType: { label: string; value: string; options: Array<{ label: string; value: string }> };
}
interface NodeData {
  data: {
    saved_node?: boolean;
    node: {
      payload?: {
        source_name?: string;
        target_name?: string;
        how?: string;
        target_key_columns?: string[];
        source_key_columns?: string[];
        source_extra_columns?: string[];
        target_filter?: string[];
        source_filter?: string[];
      };
    };
  };
}
interface EnrichColumnsProps {
  formData: FormData;
  nodeData: NodeData;
  onSave: (data: any) => void;
  onCancel: () => void;
  mode?: "view" | "edit";
}
const CONNECTION_COLORS = [
  { border: 'border-sky-500', bg: 'bg-sky-500' },
  { border: 'border-emerald-500', bg: 'bg-emerald-500' },
  { border: 'border-amber-500', bg: 'bg-amber-500' },
  { border: 'border-rose-500', bg: 'bg-rose-500' },
  { border: 'border-indigo-500', bg: 'bg-indigo-500' },
  { border: 'border-lime-500', bg: 'bg-lime-500' },
  { border: 'border-fuchsia-500', bg: 'bg-fuchsia-500' },
  { border: 'border-cyan-500', bg: 'bg-cyan-500' },
];
const SortableFilterItem: React.FC<{
  filter: FilterItem;
  index: number;
  handleFilterChange: (index: number, value: string) => void;
  removeFilterRow: (index: number) => void;
}> = ({ filter, index, handleFilterChange, removeFilterRow }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: filter.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2 border border-slate-200 dark:border-gray-700 rounded-md p-1 pl-0 bg-white dark:bg-gray-800">
        <button {...attributes} {...listeners} className="cursor-grab p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors active:cursor-grabbing">
          <GripVertical size={16} />
        </button>
        <div className="text-xs text-gray-500 dark:text-gray-400 w-5 text-center font-mono">{index + 1}</div>
        <Input
          value={filter.user_request || filter.value}
          onChange={(e) => handleFilterChange(index, e.target.value)}
          placeholder="Enter filter condition"
          className="flex-1 border-none shadow-none focus-visible:ring-0 px-2 py-1 h-auto text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          readOnly={!!filter.user_request}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFilterRow(index)}>
          <X size={14} className="text-gray-500 dark:text-gray-400" />
        </Button>
      </div>
    </div>
  );
};
export default function EnrichColumns({ formData, nodeData, onSave, onCancel, mode = "edit", // default
}: EnrichColumnsProps) {
  const payload = nodeData?.data?.saved_node ? nodeData.data.node.payload : null;
  // const { sourceNodes: allNodes } = useSourceNodes();
  const [allNodes, setAllNodes] = useState<any>([]);
  const selectedNode = useFlowStore.getState().getSelectedNode();
  // State
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(payload?.target_name || null);
  const [mergeType, setMergeType] = useState(() => payload?.how || formData.mergeType.value || 'left');
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>(() => {
    if (payload) {
      const targetKeys = payload.target_key_columns.includes("{{target_key_columns}}") ? [] : payload.target_key_columns;
      const sourceKeys = payload.source_key_columns.includes("{{source_key_columns}}") ? [] : payload.source_key_columns;
      return targetKeys.map((targetKey, index) => ({
        source_column: targetKey,
        lookup_column: sourceKeys[index] || ''
      }));
    }
    return [];
  });
  const [enrichColumns, setEnrichColumns] = useState<string[]>(() => {
    const sourceExtra = payload?.source_extra_columns;
    if (Array.isArray(sourceExtra) && !sourceExtra.includes("{{source_extra_columns}}")) {
      return sourceExtra;
    }
    return [];
  });
  const [dataFieldFilters, setDataFieldFilters] = useState<FilterItem[]>(() => {
    if (payload?.target_filter && Array.isArray(payload.target_filter)) {
      const filters = payload.target_filter.includes("{{target_filter}}") ? [''] : payload.target_filter;
      return filters.map((val: string, index: number) => ({ id: `dff_${Date.now()}_${index}`, value: val }));
    }
    return [];
  });
  const [lookupFieldFilters, setLookupFieldFilters] = useState<FilterItem[]>(() => {
    if (payload?.source_filter && Array.isArray(payload.source_filter)) {
      const filters = payload.source_filter.includes("{{source_filter}}") ? [''] : payload.source_filter;
      return filters.map((val: string, index: number) => ({ id: `lff_${Date.now()}_${index}`, value: val }));
    }
    return [];
  });
  const [selectedSourceColumn, setSelectedSourceColumn] = useState<string | null>(null);
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const [lookupSearchTerm, setLookupSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSourceAiPanel, setShowSourceAiPanel] = useState(false);
  const [showLookupAiPanel, setShowLookupAiPanel] = useState(false);
  const [showSourceAiChatDialog, setShowSourceAiChatDialog] = useState(false);
  const [showLookupAiChatDialog, setShowLookupAiChatDialog] = useState(false);
  const [sourceChatDialogInitialData, setSourceChatDialogInitialData] = useState<{
    question?: string;
    options?: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }>({});
  const [lookupChatDialogInitialData, setLookupChatDialogInitialData] = useState<{
    question?: string;
    options?: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }>({});

  // Join AI Panel state
  const [showJoinAiPanel, setShowJoinAiPanel] = useState(false);
  const [showJoinAiChatDialog, setShowJoinAiChatDialog] = useState(false);
  const [joinChatDialogInitialData, setJoinChatDialogInitialData] = useState<{
    question?: string;
    options?: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }>({});

  const currentUser = useRbacStore((state) => state.currentUser);

  // Memos
  const lookupNodeId = useMemo(() => {
    if (!sourceNodeId || allNodes.length !== 2) return null;
    const otherNode = allNodes.find(n => n.id !== sourceNodeId);
    return otherNode?.id || null;
  }, [sourceNodeId, allNodes]);

  function isSourceNode(node: any): node is SourceNode {
    return (
      node &&
      typeof node.id === 'string' &&
      node.data &&
      typeof node.data === 'object' &&
      'node' in node.data &&
      node.data.node &&
      typeof node.data.node === 'object' &&
      node.data.node.output &&
      Array.isArray(node.data.node.output.columns)
    );
  }

  useEffect(() => {
    const allNodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id);
    setAllNodes(allNodes);
  }, []);

  const sourceNode = useMemo<SourceNode | undefined>(
    () => {
      const found = allNodes.find(n => n.id === sourceNodeId);
      return isSourceNode(found) ? found : undefined;
    },
    [sourceNodeId, allNodes]
  );
  const lookupNode = useMemo<SourceNode | undefined>(
    () => {
      const found = allNodes.find(n => n.id === lookupNodeId);
      return isSourceNode(found) ? found : undefined;
    },
    [lookupNodeId, allNodes]
  );

  const sourceNodeColumns = useMemo(() => sourceNode?.data.node.output.columns || [], [sourceNode]);
  const lookupNodeColumns = useMemo(() => lookupNode?.data.node.output.columns || [], [lookupNode]);

  // Reset enrichColumns when lookupNode changes or keyPairs are modified
  useEffect(() => {
    if (lookupNodeId) {
      // Only keep enrich columns that still exist in the current lookup node
      setEnrichColumns(prev => Array.isArray(prev) ? prev.filter(col => lookupNodeColumns.includes(col)) : []);
    }
  }, [lookupNodeId, lookupNodeColumns]);

  const filteredSourceColumns = useMemo(() => {
    return sourceNodeColumns.filter(col => col.toLowerCase().includes(sourceSearchTerm.toLowerCase()));
  }, [sourceNodeColumns, sourceSearchTerm]);
  const filteredLookupColumns = useMemo(() => {
    return lookupNodeColumns.filter(col => col.toLowerCase().includes(lookupSearchTerm.toLowerCase()));
  }, [lookupNodeColumns, lookupSearchTerm]);

  const sourceColumnToColorMap = useMemo(() => {
    const map = new Map<string, string>();
    keyPairs.forEach((pair, index) => {
      const color = CONNECTION_COLORS[index % CONNECTION_COLORS.length].border;
      if (pair.source_column) map.set(pair.source_column, color);
    });
    return map;
  }, [keyPairs]);

  const lookupColumnToColorMap = useMemo(() => {
    const map = new Map<string, string>();
    keyPairs.forEach((pair, index) => {
      const color = CONNECTION_COLORS[index % CONNECTION_COLORS.length].border;
      if (pair.lookup_column) map.set(pair.lookup_column, color);
    });
    return map;
  }, [keyPairs]);

  // Handlers
  const handleRoleSelect = (clickedNodeId: string, role: 'S' | 'L') => {
    const newSourceId = role === 'S'
      ? clickedNodeId
      : allNodes.find(n => n.id !== clickedNodeId)?.id || null;

    if (sourceNodeId === newSourceId) {
      setSourceNodeId(null);
    } else {
      setSourceNodeId(newSourceId);
    }

    setKeyPairs([]);
    setSelectedSourceColumn(null);
    setEnrichColumns([]);
  };

  const handleSourceColumnClick = (columnName: string) => {
    if (keyPairs.some(p => p.source_column === columnName)) return;
    setSelectedSourceColumn(columnName);
  };
  const handleLookupColumnClick = (columnName: string) => {
    if (!selectedSourceColumn || keyPairs.some(p => p.lookup_column === columnName)) return;
    setKeyPairs(prev => [...prev, { source_column: selectedSourceColumn, lookup_column: columnName }]);
    setSelectedSourceColumn(null);
  };
  const removeKeyPair = (index: number) => {
    setKeyPairs(prev => prev.filter((_, i) => i !== index));
  };
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saveData = {
        target_name: sourceNodeId,
        source_name: lookupNodeId,
        target_key_columns: keyPairs.map(p => p.source_column),
        source_key_columns: keyPairs.map(p => p.lookup_column),
        source_extra_columns: enrichColumns,
        target_filter: dataFieldFilters.filter(f => f.value.trim() !== '').map(f => f.value),
        source_filter: lookupFieldFilters.filter(f => f.value.trim() !== '').map(f => f.value),
        how: mergeType,
      };
      console.log('Saving enrich columns data:', saveData);
      console.log('enrichColumns state:', enrichColumns);
      await onSave(saveData);
    } catch (error) {
      console.error('Error saving enrich columns:', error);
    } finally {
      setIsSaving(false);
    }
  };
  // Filter Drag and Drop Logic
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragEnd = (event: any, setter: React.Dispatch<React.SetStateAction<FilterItem[]>>) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setter((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  const addFilterRow = (setter: React.Dispatch<React.SetStateAction<FilterItem[]>>, prefix: string) => setter(prev => [...prev, { id: `${prefix}_${Date.now()}`, value: '' }]);
  const removeFilterRow = (setter: React.Dispatch<React.SetStateAction<FilterItem[]>>, index: number) => setter(prev => prev.filter((_, i) => i !== index));
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<FilterItem[]>>, index: number, value: string) => {
    setter(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], value };
      return newItems;
    });
  };

  // Helper function to detect data type
  const detectType = useCallback((value: any): string => {
    if (value === null || value === undefined) return 'Utf8';

    const valueType = typeof value;
    if (valueType === 'number') {
      return Number.isInteger(value) ? 'Int64' : 'Float64';
    }
    if (valueType === 'boolean') return 'Boolean';

    // Check if it's a date string
    const dateStr = String(value);
    if (!isNaN(Date.parse(dateStr)) && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'Datetime';
    }

    return 'Utf8';
  }, []);

  // Get table context for Source node AI panel
  const getSourceTableContext = useCallback((): TableContext | undefined => {
    const sourceNodeAny = sourceNode as any;

    if (!sourceNodeAny?.data?.node?.output) {
      return undefined;
    }

    let data: any[] = [];
    let columns: string[] = [];

    if (sourceNodeAny.data.node.output.data) {
      data = sourceNodeAny.data.node.output.data;
      columns = sourceNodeAny.data.node.output.columns || [];
    }

    // If no data, return undefined
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    // If no columns provided, extract from first data row
    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    }

    // Prepare sample row for type detection
    const sampleRow = data[0] || {};

    // Build schema with proper type detection
    const schema = columns.map((column: string) => ({
      column: column,
      type: detectType(sampleRow[column]),
      description: ''
    }));

    return {
      schema,
      data: [sampleRow] // Send first row as sample
    };
  }, [sourceNode, detectType]);

  // Get table context for Lookup node AI panel
  const getLookupTableContext = useCallback((): TableContext | undefined => {
    const lookupNodeAny = lookupNode as any;

    if (!lookupNodeAny?.data?.node?.output) {
      return undefined;
    }

    let data: any[] = [];
    let columns: string[] = [];

    if (lookupNodeAny.data.node.output.data) {
      data = lookupNodeAny.data.node.output.data;
      columns = lookupNodeAny.data.node.output.columns || [];
    }

    // If no data, return undefined
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    // If no columns provided, extract from first data row
    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    }

    // Prepare sample row for type detection
    const sampleRow = data[0] || {};

    // Build schema with proper type detection
    const schema = columns.map((column: string) => ({
      column: column,
      type: detectType(sampleRow[column]),
      description: ''
    }));

    return {
      schema,
      data: [sampleRow] // Send first row as sample
    };
  }, [lookupNode, detectType]);

  // Source AI Panel handlers
  const handleSourceAiApply = useCallback(async (filter: string, userRequest?: string) => {
    // Add the AI-generated filter to the source filters (dataFieldFilters)
    const newFilter: FilterItem = {
      id: `ai-source-${Date.now()}`,
      value: filter,
      user_request: userRequest,
    };
    setDataFieldFilters(prev => [...prev, newFilter]);
    toast.success("AI-generated source filter added successfully");
    setShowSourceAiPanel(false);
  }, []);

  const handleSourceAiDiscard = useCallback(() => {
    setShowSourceAiPanel(false);
  }, []);

  const handleOpenSourceChatDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => {
    setSourceChatDialogInitialData(initialData);
    setShowSourceAiChatDialog(true);
    setShowSourceAiPanel(false); // Close the horizontal panel
  }, []);

  const handleSourceAiChatCodeGenerated = useCallback(async (code: string) => {
    // Add the AI-generated filter from chat dialog to the source filters
    const newFilter: FilterItem = {
      id: `ai-source-chat-${Date.now()}`,
      value: code
    };
    setDataFieldFilters(prev => [...prev, newFilter]);
    toast.success("AI-generated source filter added successfully");
    // Keep chat dialog open for further interactions
  }, []);

  // Lookup AI Panel handlers
  const handleLookupAiApply = useCallback(async (filter: string, userRequest?: string) => {
    // Add the AI-generated filter to the lookup filters (lookupFieldFilters)
    const newFilter: FilterItem = {
      id: `ai-lookup-${Date.now()}`,
      value: filter,
      user_request: userRequest,
    };
    setLookupFieldFilters(prev => [...prev, newFilter]);
    toast.success("AI-generated lookup filter added successfully");
    setShowLookupAiPanel(false);
  }, []);

  const handleLookupAiDiscard = useCallback(() => {
    setShowLookupAiPanel(false);
  }, []);

  const handleOpenLookupChatDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => {
    setLookupChatDialogInitialData(initialData);
    setShowLookupAiChatDialog(true);
    setShowLookupAiPanel(false); // Close the horizontal panel
  }, []);

  const handleLookupAiChatCodeGenerated = useCallback(async (code: string) => {
    // Add the AI-generated filter from chat dialog to the lookup filters
    const newFilter: FilterItem = {
      id: `ai-lookup-chat-${Date.now()}`,
      value: code
    };
    setLookupFieldFilters(prev => [...prev, newFilter]);
    toast.success("AI-generated lookup filter added successfully");
    // Keep chat dialog open for further interactions
  }, []);

  // Get table context for Join AI - Source
  const getJoinSourceContext = useCallback((): JoinTableContext | undefined => {
    const sourceNodeAny = sourceNode as any;

    if (!sourceNodeAny?.data?.node?.output) {
      return undefined;
    }

    let data: any[] = [];
    let columns: string[] = [];

    if (sourceNodeAny.data.node.output.data) {
      data = sourceNodeAny.data.node.output.data;
      columns = sourceNodeAny.data.node.output.columns || [];
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    }

    const sampleRow = data[0] || {};

    const schema = columns.map((column: string) => ({
      column: column,
      type: detectType(sampleRow[column])
    }));

    return {
      table_name: sourceNodeAny.data.display_name || sourceNodeAny.id || 'source',
      schema,
      data: [sampleRow]
    };
  }, [sourceNode, detectType]);

  // Get table context for Join AI - Target (Lookup)
  const getJoinTargetContext = useCallback((): JoinTableContext | undefined => {
    const lookupNodeAny = lookupNode as any;

    if (!lookupNodeAny?.data?.node?.output) {
      return undefined;
    }

    let data: any[] = [];
    let columns: string[] = [];

    if (lookupNodeAny.data.node.output.data) {
      data = lookupNodeAny.data.node.output.data;
      columns = lookupNodeAny.data.node.output.columns || [];
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    }

    const sampleRow = data[0] || {};

    const schema = columns.map((column: string) => ({
      column: column,
      type: detectType(sampleRow[column])
    }));

    return {
      table_name: lookupNodeAny.data.display_name || lookupNodeAny.id || 'lookup',
      schema,
      data: [sampleRow]
    };
  }, [lookupNode, detectType]);

  // Join AI Panel handlers
  const handleJoinAiApply = useCallback((result: JoinSuccessResponse) => {
    // Apply the AI-generated join configuration to the UI
    const { source_key_columns, target_key_columns, source_extra_columns, source_filter, target_filter } = result;

    // Set key pairs
    // Note: API returns source_key_columns (lookup node) and target_key_columns (data source node)
    // UI's KeyPair uses: source_column (data source) and lookup_column (lookup node)
    const newKeyPairs: KeyPair[] = target_key_columns.map((targetCol, index) => ({
      source_column: targetCol,
      lookup_column: source_key_columns[index] || ''
    }));
    setKeyPairs(newKeyPairs);

    // Set enrich columns (with null check)
    setEnrichColumns(source_extra_columns || []);

    // Set filters
    if (target_filter && target_filter.length > 0) {
      const newDataFilters = target_filter.map((val, index) => ({
        id: `ai-data-filter-${Date.now()}-${index}`,
        value: val
      }));
      setDataFieldFilters(prev => [...prev, ...newDataFilters]);
    }

    if (source_filter && source_filter.length > 0) {
      const newLookupFilters = source_filter.map((val, index) => ({
        id: `ai-lookup-filter-${Date.now()}-${index}`,
        value: val
      }));
      setLookupFieldFilters(prev => [...prev, ...newLookupFilters]);
    }

    toast.success("Join configuration applied successfully");
    setShowJoinAiPanel(false);
  }, []);

  const handleJoinAiDiscard = useCallback(() => {
    setShowJoinAiPanel(false);
  }, []);

  const handleOpenJoinClarificationDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId: string;
    eventId: string;
    userRequest: string;
  }) => {
    setJoinChatDialogInitialData({
      question: initialData.question,
      options: initialData.options,
      conversationId: initialData.conversationId,
      eventId: initialData.eventId,
      userRequest: initialData.userRequest
    });
    setShowJoinAiChatDialog(true);
    setShowJoinAiPanel(false);
  }, []);

  const handleJoinClarificationSuccess = useCallback((result: JoinSuccessResponse) => {
    handleJoinAiApply(result);
    setShowJoinAiChatDialog(false);
    setJoinChatDialogInitialData({});
  }, [handleJoinAiApply]);

  return (
    <TooltipProvider>
      <div className="w-full mx-auto p-1 min-h-[600px] min-w-full overflow-y-auto">
        <div className="space-y-2 min-h-[600px]">
          {/* Source Selection & Actions */}
          <div className="p-2 bg-white dark:bg-stone-900 border border-slate-200 dark:border-gray-800 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-md font-semibold text-gray-900 dark:text-gray-100 mr-2">Select Sources :</h2>
                {allNodes.length > 0 ? (
                  allNodes.map(node => (
                    <div key={node.id} className="flex items-center gap-1 px-1.5 py-0.5 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800">
                      <Database size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{(node.data as any).display_name || node.id}</span>
                      <ToggleGroup type="single" value={sourceNodeId === node.id ? 'S' : lookupNodeId === node.id ? 'L' : ''} onValueChange={(val) => val && handleRoleSelect(node.id, val as 'S' | 'L')}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ToggleGroupItem value="S" aria-label="Set as Source" className="h-6 w-6 text-xs font-bold border-1 data-[state=on]:border-primary data-[state=on]:text-primary data-[state=off]:border-slate-300 dark:data-[state=off]:border-gray-600 data-[state=off]:text-slate-600 dark:data-[state=off]:text-slate-400">S</ToggleGroupItem>
                          </TooltipTrigger>
                          <TooltipContent>Source</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ToggleGroupItem value="L" aria-label="Set as Lookup" className="h-6 w-6 text-xs font-bold border-1 data-[state=on]:border-primary data-[state=on]:text-primary data-[state=off]:border-slate-300 dark:data-[state=off]:border-gray-600 data-[state=off]:text-slate-600 dark:data-[state=off]:text-slate-400">L</ToggleGroupItem>
                          </TooltipTrigger>
                          <TooltipContent>Lookup</TooltipContent>
                        </Tooltip>
                      </ToggleGroup>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Connect the sources from previous nodes</p>
                )}
                {/* AI Buttons - After source selection */}
                {sourceNodeId && lookupNodeId && (
                  <div className="flex items-center gap-1 pl-2 flex-shrink-0">
                    <Button
                      onClick={() => setShowJoinAiChatDialog(true)}
                      variant="outline"
                      size="icon"
                      className="border-purple-300 hover:bg-purple-50 shadow-sm w-10 h-7"
                      title="AI Chat with History"
                    >
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </Button>
                    <Button
                      onClick={() => setShowJoinAiPanel(!showJoinAiPanel)}
                      variant="outline"
                      size="icon"
                      className="border-primary/30 hover:bg-primary/10 shadow-sm w-10 h-7"
                      title="AI Join Configuration (Quick)"
                    >
                      <img src={AiIcon} alt="AI" className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-sm font-medium text-slate-700 dark:text-white whitespace-nowrap">{formData.mergeType.label}:</label>
                  <Select onValueChange={setMergeType} defaultValue={mergeType}>
                    <SelectTrigger className="w-36 h-9 flex-shrink-0 bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{formData.mergeType.options.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-gray-700 pl-2 flex-shrink-0">
                  <Button variant="outline" onClick={onCancel} disabled={isSaving} className="flex-shrink-0">Cancel</Button>
                  <Button onClick={handleSave} disabled={!sourceNodeId || !lookupNodeId || keyPairs.length === 0 || mode == 'view'} className='disabled:cursor-not-allowed flex-shrink-0'>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Join AI Panel - Below Select Sources */}
          {showJoinAiPanel && sourceNodeId && lookupNodeId && getJoinSourceContext() && getJoinTargetContext() && (
            <div className="p-0 bg-white dark:bg-stone-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <JoinAiPanel
                onApply={handleJoinAiApply}
                onDiscard={handleJoinAiDiscard}
                sourceContext={getJoinSourceContext()}
                targetContext={getJoinTargetContext()}
                onOpenChatDialog={handleOpenJoinClarificationDialog}
              />
            </div>
          )}

          {/* Combined Mapping & Review Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 items-stretch min-h-[400px]">
            {/* Column Mapping */}
            <div className="p-2 bg-white dark:bg-black border border-slate-200 dark:border-gray-800 rounded-lg xl:col-span-2 min-h-[400px]">
              <h2 className="text-md font-semibold text-gray-900 dark:text-gray-100">Create Connections</h2>
              <div className="grid grid-cols-2 gap-8 items-start min-h-[350px]">
                <ColumnList
                  title="Key Source"
                  node={sourceNode}
                  columns={filteredSourceColumns}
                  onColumnClick={handleSourceColumnClick}
                  selectedColumn={selectedSourceColumn}
                  colorMap={sourceColumnToColorMap}
                  isDisabled={false}
                  searchTerm={sourceSearchTerm}
                  onSearchChange={setSourceSearchTerm}
                />
                <ColumnList
                  title="Lookup Source"
                  node={lookupNode}
                  columns={filteredLookupColumns}
                  onColumnClick={handleLookupColumnClick}
                  colorMap={lookupColumnToColorMap}
                  isDisabled={!selectedSourceColumn}
                  searchTerm={lookupSearchTerm}
                  onSearchChange={setLookupSearchTerm}
                />
              </div>
            </div>

            {/* Review & Enrich Tabs */}
            <div className="xl:col-span-1 flex flex-col h-full">
              <Tabs defaultValue="review" className="w-full flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="review">Review Connections</TabsTrigger>
                  <TabsTrigger value="enrich">Enrich Columns</TabsTrigger>
                </TabsList>
                <TabsContent value="review" className="flex-1 mt-0">
                  <div className="p-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    {/* fixed-height scrollable content area */}
                    <div className="h-[400px] overflow-y-auto">
                      {keyPairs.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 px-0">
                          {keyPairs.map((pair, index) => (
                            <div key={index} className="flex items-center gap-1.5 px-1.5 py-0.5 text-sm rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", CONNECTION_COLORS[index % CONNECTION_COLORS.length].bg)}></span>
                              <Tooltip delayDuration={100}><TooltipTrigger asChild><span className="font-medium text-slate-700 dark:text-white flex-1 truncate">{pair.source_column}</span></TooltipTrigger><TooltipContent><p>{pair.source_column}</p></TooltipContent></Tooltip>
                              <ArrowRight size={14} className="text-slate-900 dark:text-white shrink-0" />
                              <Tooltip delayDuration={100}><TooltipTrigger asChild><span className="ml-2 font-medium text-slate-700 dark:text-white flex-1 truncate">{pair.lookup_column}</span></TooltipTrigger><TooltipContent><p>{pair.lookup_column}</p></TooltipContent></Tooltip>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:bg-black/10 dark:hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); removeKeyPair(index); }}><X size={12} /></Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[400px] text-sm text-slate-500 dark:text-slate-400"><p>No key connections made yet.</p></div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="enrich" className="flex-1 mt-0">
                  <div className="p-2 bg-white dark:bg-black border border-slate-200 dark:border-gray-800 rounded-lg">
                    <div className="space-y-1 overflow-y-auto h-[400px] pr-1">
                      {lookupNodeColumns.length > 0 ? lookupNodeColumns.map(col => (
                        <div key={col} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-lg">
                          <Checkbox id={`enrich-${col}`} checked={enrichColumns.includes(col)} onCheckedChange={(checked) => {
                            setEnrichColumns(prev => checked ? [...prev, col] : prev.filter(c => c !== col));
                          }} />
                          <label htmlFor={`enrich-${col}`} className="text-sm font-medium cursor-pointer text-slate-700 dark:text-white flex-1">{col}</label>
                        </div>
                      )) : <p className="flex items-center justify-center h-[400px] text-sm text-slate-500 dark:text-slate-400">Select a lookup node to see columns</p>}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Filters Section */}
          <div className="p-2 border border-slate-200 dark:border-gray-800 rounded-lg">
            <h2 className="text-md font-semibold text-gray-900 dark:text-gray-100">Data Filters</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm text-slate-700 dark:text-slate-200">Source Filters ({sourceNode?.data.display_name || sourceNode?.id || 'N/A'})</h4>
                  {/* AI Icons - Beside Source Filters heading */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      onClick={() => setShowSourceAiChatDialog(true)}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 shadow-sm flex-shrink-0"
                      title="AI Chat with History"
                      disabled={!sourceNode}
                    >
                      <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </Button>
                    <Button
                      onClick={() => setShowSourceAiPanel(!showSourceAiPanel)}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-primary/30 hover:bg-primary/10 shadow-sm flex-shrink-0"
                      title="AI Generate Filter (Quick)"
                      disabled={!sourceNode}
                    >
                      <img src={AiIcon} alt="AI" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Source AI Panel - Below buttons */}
                {showSourceAiPanel && getSourceTableContext() && (
                  <div className="mb-2">
                    <HorizontalAiPanel
                      onApply={handleSourceAiApply}
                      onDiscard={handleSourceAiDiscard}
                      context={getSourceTableContext()}
                      showExecuteButton={false}
                      onOpenChatDialog={handleOpenSourceChatDialog}
                    />
                  </div>
                )}

                <div className="flex-1 max-h-[300px] overflow-y-auto pr-1 mb-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, setDataFieldFilters)}>
                    <SortableContext items={dataFieldFilters} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2"><SortableFilterList filters={dataFieldFilters} setter={setDataFieldFilters} /></div>
                    </SortableContext>
                  </DndContext>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => addFilterRow(setDataFieldFilters, 'dff')}><Plus size={14} className="mr-2" />Add Source Filter</Button>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm text-slate-700 dark:text-slate-200">Lookup Filters ({lookupNode?.data.display_name || lookupNode?.id || 'N/A'})</h4>
                  {/* AI Icons - Beside Lookup Filters heading */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      onClick={() => setShowLookupAiChatDialog(true)}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 shadow-sm flex-shrink-0"
                      title="AI Chat with History"
                      disabled={!lookupNode}
                    >
                      <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </Button>
                    <Button
                      onClick={() => setShowLookupAiPanel(!showLookupAiPanel)}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-primary/30 hover:bg-primary/10 shadow-sm flex-shrink-0"
                      title="AI Generate Filter (Quick)"
                      disabled={!lookupNode}
                    >
                      <img src={AiIcon} alt="AI" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Lookup AI Panel - Below buttons */}
                {showLookupAiPanel && getLookupTableContext() && (
                  <div className="mb-2">
                    <HorizontalAiPanel
                      onApply={handleLookupAiApply}
                      onDiscard={handleLookupAiDiscard}
                      context={getLookupTableContext()}
                      showExecuteButton={false}
                      onOpenChatDialog={handleOpenLookupChatDialog}
                    />
                  </div>
                )}

                <div className="flex-1 max-h-[300px] overflow-y-auto pr-1 mb-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, setLookupFieldFilters)}>
                    <SortableContext items={lookupFieldFilters} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2"><SortableFilterList filters={lookupFieldFilters} setter={setLookupFieldFilters} /></div>
                    </SortableContext>
                  </DndContext>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => addFilterRow(setLookupFieldFilters, 'lff')}><Plus size={14} className="mr-2" />Add Lookup Filter</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Source AI Chat Dialog */}
        <AiPredicateChatDialog
          isOpen={showSourceAiChatDialog}
          onClose={() => {
            setShowSourceAiChatDialog(false);
            setSourceChatDialogInitialData({});
          }}
          onCodeGenerated={handleSourceAiChatCodeGenerated}
          tableContext={getSourceTableContext()}
          initialQuestion={sourceChatDialogInitialData.question}
          initialOptions={sourceChatDialogInitialData.options}
          initialConversationId={sourceChatDialogInitialData.conversationId}
          initialEventId={sourceChatDialogInitialData.eventId}
          initialUserRequest={sourceChatDialogInitialData.userRequest}
        />

        {/* Lookup AI Chat Dialog */}
        <AiPredicateChatDialog
          isOpen={showLookupAiChatDialog}
          onClose={() => {
            setShowLookupAiChatDialog(false);
            setLookupChatDialogInitialData({});
          }}
          onCodeGenerated={handleLookupAiChatCodeGenerated}
          tableContext={getLookupTableContext()}
          initialQuestion={lookupChatDialogInitialData.question}
          initialOptions={lookupChatDialogInitialData.options}
          initialConversationId={lookupChatDialogInitialData.conversationId}
          initialEventId={lookupChatDialogInitialData.eventId}
          initialUserRequest={lookupChatDialogInitialData.userRequest}
        />

        {/* Join AI Chat Dialog */}
        <JoinAiChatDialog
          isOpen={showJoinAiChatDialog}
          onClose={() => {
            setShowJoinAiChatDialog(false);
            setJoinChatDialogInitialData({});
          }}
          onSuccess={handleJoinClarificationSuccess}
          sourceContext={getJoinSourceContext()}
          targetContext={getJoinTargetContext()}
          initialQuestion={joinChatDialogInitialData.question}
          initialOptions={joinChatDialogInitialData.options}
          initialConversationId={joinChatDialogInitialData.conversationId}
          initialEventId={joinChatDialogInitialData.eventId}
          initialUserRequest={joinChatDialogInitialData.userRequest}
        />
      </div>
    </TooltipProvider>
  );
}
const ColumnList = ({ title, node, columns, onColumnClick, selectedColumn, colorMap, isDisabled, searchTerm, onSearchChange }: {
  title: string;
  node: SourceNode | undefined;
  columns: string[];
  onColumnClick: (col: string) => void;
  selectedColumn?: string | null;
  colorMap: Map<string, string>;
  isDisabled: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm text-slate-700 dark:text-slate-200">
        {title}: <span className="text-sm font-medium">{node?.data.display_name || node?.id || 'None'}</span>
      </h3>
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400" />
        <Input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-40 pl-7 pr-7 text-xs border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        {searchTerm && (
          <Button
            onClick={() => onSearchChange('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-primary"
            aria-label="Clear search"
            size="icon"
            variant="ghost"
          >
            <X size={14} className="" />
          </Button>
        )}
      </div>
    </div>
    <div className="flex flex-col gap-1.5 max-h-96 min-h-[300px] overflow-y-auto p-1 rounded-lg">
      {node ? (
        columns.length > 0 ? (
          columns.map(col => (
            <button key={col} onClick={() => onColumnClick(col)}
              disabled={isDisabled || !!colorMap.get(col)}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md border border-primary disabled:cursor-not-allowed disabled:opacity-70 transition-all",
                "bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700",
                "text-primary dark:text-primary",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                selectedColumn === col && "ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20",
                colorMap.get(col) ? `border-l-4 ${colorMap.get(col)}` : 'border-l-4 dark:border-gray-700 border-gray-200'
              )}>
              <span className="flex-1 text-slate-900 dark:text-slate-100">{col}</span>
            </button>
          ))
        ) : (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-center text-slate-500 dark:text-slate-400">No matching columns</p>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-center text-slate-500 dark:text-slate-400">Select a {title.toLowerCase()} node</p>
        </div>
      )}
    </div>
  </div>
);
const SortableFilterList = ({ filters, setter }: {
  filters: FilterItem[];
  setter: React.Dispatch<React.SetStateAction<FilterItem[]>>;
}) => (
  <>
    {filters.map((filter, index) => (
      <SortableFilterItem key={filter.id} filter={filter} index={index}
        handleFilterChange={(i, v) => {
          const newItems = [...filters];
          newItems[i] = { ...newItems[i], value: v };
          setter(newItems);
        }}
        removeFilterRow={(i) => setter(filters.filter((_, idx) => idx !== i))}
      />
    ))}
  </>
);

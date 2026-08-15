import React, { useState, useMemo, useEffect } from 'react';
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
import { Plus, X, GripVertical, Database, Search, ArrowRight, Loader2, XCircle, Trash2 } from 'lucide-react';
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
import useFlowStore from '@/stores/flowStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlternativeSelect } from '@/components/ui/alternative-select';

// Helper types
interface FilterItem { id: string; value: string; }
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
        // added optional fields for indicator/tolerance
        indicator?: boolean;
        // new flag requested
        isToleranceVlookup?: boolean;
        source_tol_column?: string;
        target_tol_column?: string;
        toleranceValue?: number | string;
        // advanced options support (groupby etc.)
        advanced_options?: any;
        // new optional strategy field
        strategy?: string;
      };
    };
  };
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
      <div className="flex flex-1 items-center gap-2 border rounded-md p-1 pl-0 bg-background">
        <button {...attributes} {...listeners} className="cursor-grab p-2 text-gray-400 hover:bg-gray-100 rounded-md transition-colors active:cursor-grabbing">
          <GripVertical size={16} />
        </button>
        <div className="text-xs text-gray-500 w-5 text-center font-mono">{index + 1}</div>
        <Input
          value={filter.value}
          onChange={(e) => handleFilterChange(index, e.target.value)}
          placeholder="Enter filter condition"
          className="flex-1 border-none shadow-none focus-visible:ring-0 px-2 py-1 h-auto text-sm"
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFilterRow(index)}>
          <X size={14} className="text-gray-500" />
        </Button>
      </div>
    </div>
  );
};

export default function AdvancedVLookup({ formData, nodeData, onSave, onCancel, mode = "edit" }: {
  formData: FormData;
  nodeData: NodeData;
  onSave: (data: any) => void;
  onCancel: () => void;
  mode?: "view" | "edit";
}) {
  const payload = nodeData?.data?.saved_node ? nodeData.data.node.payload : null;

  // helper to treat "{{...}}" placeholders as empty
  const isPlaceholder = (v: any) => typeof v === 'string' && /^\s*\{\{.*\}\}\s*$/.test(v);

  const [allNodes, setAllNodes] = useState<any>([]);
  const selectedNode = useFlowStore.getState().getSelectedNode();

  const [sourceNodeId, setSourceNodeId] = useState<string | null>(payload?.target_name || null);
  const [mergeType, setMergeType] = useState(() => payload?.how || formData.mergeType.value || 'left');
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>(() => {
    if (payload) {
      const targetKeys = payload.target_key_columns && !payload.target_key_columns.includes("{{target_key_columns}}") ? payload.target_key_columns : [];
      const sourceKeys = payload.source_key_columns && !payload.source_key_columns.includes("{{source_key_columns}}") ? payload.source_key_columns : [];
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

  // new tolerance-related states (replaced `indicator` with isToleranceVlookup; preserve legacy indicator in payload)
  const [isToleranceVlookup, setIsToleranceVlookup] = useState<boolean>(() => {
    const v = payload?.isToleranceVlookup;
    if (typeof v === 'string' && isPlaceholder(v)) return false;
    return !!v;
  });

  // preserve legacy `indicator` flag in payload as an independent checkbox
  const [indicator, setIndicator] = useState<boolean>(() => {
    const v = payload?.indicator;
    if (typeof v === 'string' && isPlaceholder(v)) return false;
    return !!v;
  });

  const [sourceTolColumn, setSourceTolColumn] = useState<string | null>(() => {
    // Swap back: payload.target_tol_column contains the UI's sourceTolColumn value
    const v = payload?.target_tol_column;
    return isPlaceholder(v) ? null : (v ?? null);
  });
  const [targetTolColumn, setTargetTolColumn] = useState<string | null>(() => {
    // Swap back: payload.source_tol_column contains the UI's targetTolColumn value
    const v = payload?.source_tol_column;
    return isPlaceholder(v) ? null : (v ?? null);
  });
  const [toleranceValue, setToleranceValue] = useState<string>(() => {
    const v = payload?.toleranceValue;
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && isPlaceholder(v)) return '';
    return String(v);
  });

  // new strategy state: default to payload.strategy if present and not a placeholder, otherwise 'nearest'
  const [strategyType, setStrategyType] = useState<string>(() => {
    const v = payload?.strategy;
    if (typeof v === 'string' && isPlaceholder(v)) return 'nearest';
    return (v && String(v).trim()) || 'nearest';
  });

  // Group-by aggregation state (advanced options)
  const [groupbyEnabled, setGroupbyEnabled] = useState<boolean>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return !!adv?.enabled;
    } catch { return false; }
  });
  // advanced dropdown selection (controls which advanced feature is active)
  const [advancedDropdownOpen, setAdvancedDropdownOpen] = useState<boolean>(false);
  const [advancedSelection, setAdvancedSelection] = useState<string>(() => {
    try {
      const has = !!payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup);
      return has ? 'groupby_vlookup' : 'none';
    } catch { return 'none'; }
  });

  // when user selects the advanced option, enable/disable the groupby UI
  useEffect(() => {
    setGroupbyEnabled(advancedSelection === 'groupby_vlookup');
  }, [advancedSelection]);

  const [groupbyApplyOn, setGroupbyApplyOn] = useState<string>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return adv?.apply_on || 'target';
    } catch { return 'target'; }
  });
  const [groupbyReturnLevel, setGroupbyReturnLevel] = useState<string>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return adv?.return_level || 'row';
    } catch { return 'row'; }
  });

  // columns chosen for group-by on target & source
  const [groupbyTargetColumns, setGroupbyTargetColumns] = useState<string[]>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return Array.isArray(adv?.source?.groupby_columns) ? adv.source.groupby_columns : [];
    } catch { return []; }
  });
  const [groupbySourceColumns, setGroupbySourceColumns] = useState<string[]>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return Array.isArray(adv?.target?.groupby_columns) ? adv.target.groupby_columns : [];
    } catch { return []; }
  });

  // Aggregations: arrays of { column, function, output_target: { mode } }
  type AggRow = { column: string | null; func: string | null; output_mode: string | null; id: string };
  const makeAggFromPayload = (arr: any[] | undefined) => {
    if (!Array.isArray(arr)) return [] as AggRow[];
    return arr.map((a, i) => ({ id: `agg_${Date.now()}_${i}`, column: a.column || null, func: (a.function || a.func || null), output_mode: a.output_target?.mode || null }));
  };
  const [targetAggs, setTargetAggs] = useState<AggRow[]>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return makeAggFromPayload(adv?.source?.aggregations);
    } catch { return []; }
  });
  const [sourceAggs, setSourceAggs] = useState<AggRow[]>(() => {
    try {
      const adv = payload?.advanced_options?.find?.((o: any) => o.groupby_vlookup)?.groupby_vlookup;
      return makeAggFromPayload(adv?.target?.aggregations);
    } catch { return []; }
  });

  // aggregation helper functions (ensure these exist for UI handlers)
  const addTargetAgg = () => {
    setTargetAggs(prev => [...prev, { id: `agg_${Date.now()}`, column: null, func: 'SUM', output_mode: 'inplace' }]);
  };
  const removeTargetAgg = (id: string) => {
    setTargetAggs(prev => prev.filter(a => a.id !== id));
  };
  const updateTargetAgg = (id: string, patch: Partial<AggRow>) => {
    setTargetAggs(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const addSourceAgg = () => {
    setSourceAggs(prev => [...prev, { id: `agg_${Date.now()}`, column: null, func: 'SUM', output_mode: 'inplace' }]);
  };
  const removeSourceAgg = (id: string) => {
    setSourceAggs(prev => prev.filter(a => a.id !== id));
  };
  const updateSourceAgg = (id: string, patch: Partial<AggRow>) => {
    setSourceAggs(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  // reset/clear current VLookup settings (called by the "X" clear button)
  const resetVlookupSettings = () => {
    // key mappings & enrich
    setKeyPairs([]);
    setEnrichColumns([]);
    // filters
    setDataFieldFilters([]);
    setLookupFieldFilters([]);
    // tolerance
    setIsToleranceVlookup(false);
    setSourceTolColumn(null);
    setTargetTolColumn(null);
    setToleranceValue('');
    // reset strategy back to default nearest
    setStrategyType('nearest');
    // advanced / groupby
    setGroupbySourceColumns([]);
    setGroupbyTargetColumns([]);
    setSourceAggs([]);
    setTargetAggs([]);
    setGroupbyEnabled(false);
    setAdvancedSelection('none');
    setAdvancedDropdownOpen(false);
    setIndicator(false);
    // notify user
    toast.success('Cleared current VLookup settings');
  };

  // reset/clear only groupby settings (called by the trash button in Advanced VLookup settings)
  const resetGroupbySettings = () => {
    // advanced / groupby only
    setGroupbySourceColumns([]);
    setGroupbyTargetColumns([]);
    setSourceAggs([]);
    setTargetAggs([]);
    setGroupbyEnabled(false);
    setAdvancedSelection('none');
    setAdvancedDropdownOpen(false);
    // notify user
    toast.success('Cleared GroupBy VLookup settings');
  };

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
    const nodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id);
    setAllNodes(nodes);
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

  useEffect(() => {
    if (lookupNodeId) {
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
      // When Tolerance Vlookup is enabled, require tolerance columns and a positive tolerance value.
      if (isToleranceVlookup) {
        if (!sourceTolColumn) {
          toast.error('Please select a Source Tolerance Column.');
          setIsSaving(false);
          return;
        }
        if (!targetTolColumn) {
          toast.error('Please select a Target Tolerance Column.');
          setIsSaving(false);
          return;
        }
        if (toleranceValue === '') {
          toast.error('Please enter a Tolerance Value (positive).');
          setIsSaving(false);
          return;
        }
        const tolNum = Number(toleranceValue);
        if (Number.isNaN(tolNum) || tolNum <= 0) {
          toast.error('Tolerance Value must be a positive number.');
          setIsSaving(false);
          return;
        }
      }
      // Validation: when tolerance vlookup + groupby enabled, require aggregations for selected datasets
      if (isToleranceVlookup && groupbyEnabled) {
        const requireTarget = groupbyApplyOn === 'target' || groupbyApplyOn === 'both';
        const requireSource = groupbyApplyOn === 'source' || groupbyApplyOn === 'both';

        if (requireTarget) {
          if (!targetAggs || targetAggs.length === 0) {
            toast.error('GroupBy VLookup (target) requires at least one Target aggregation when Tolerance VLookup is enabled.');
            setIsSaving(false);
            return;
          }
          for (const a of targetAggs) {
            if (!a.column || !a.func) {
              toast.error('All Target aggregations must have both a column and a function.');
              setIsSaving(false);
              return;
            }
          }
        }

        if (requireSource) {
          if (!sourceAggs || sourceAggs.length === 0) {
            toast.error('GroupBy VLookup (source) requires at least one Source aggregation when Tolerance VLookup is enabled.');
            setIsSaving(false);
            return;
          }
          for (const a of sourceAggs) {
            if (!a.column || !a.func) {
              toast.error('All Source aggregations must have both a column and a function.');
              setIsSaving(false);
              return;
            }
          }
        }
      }

      const saveData: any = {
        target_name: sourceNodeId,
        source_name: lookupNodeId,
        target_key_columns: keyPairs.map(p => p.source_column),
        source_key_columns: keyPairs.map(p => p.lookup_column),
        source_extra_columns: enrichColumns,
        target_filter: dataFieldFilters.filter(f => f.value.trim() !== '').map(f => f.value),
        source_filter: lookupFieldFilters.filter(f => f.value.trim() !== '').map(f => f.value),
        how: mergeType,
      };

      // include tolerance fields and flag; preserve legacy `indicator` for backward compatibility
      saveData.isToleranceVlookup = !!isToleranceVlookup;
      saveData.indicator = !!indicator;
      if (isToleranceVlookup) {
        // only send actual selected columns (or empty string) — avoid placeholder tokens
        // Swap: source_tol_column gets targetTolColumn, target_tol_column gets sourceTolColumn
        saveData.source_tol_column = targetTolColumn || "";
        saveData.target_tol_column = sourceTolColumn || "";
        // toleranceValue validated earlier; convert to number (fallback 0)
        saveData.toleranceValue = toleranceValue !== '' ? Number(toleranceValue) : 0;
        // include strategy when tolerance enabled — default to 'nearest' if nothing selected
        saveData.strategy = strategyType && strategyType.trim() !== '' ? strategyType : 'nearest';
      } else {
        // explicitly clear tolerance fields when feature is unchecked
        saveData.source_tol_column = "";
        saveData.target_tol_column = "";
        saveData.toleranceValue = 0;
        saveData.strategy = "";
        // keep indicator as the user's choice (already set above)
      }

      // advanced options: groupby_vlookup
      // Swap: target gets source data, source gets target data
      const groupbyObj: any = {
        enabled: !!groupbyEnabled,
        apply_on: groupbyApplyOn,
        return_level: groupbyReturnLevel,
        target: {
          groupby_columns: Array.isArray(groupbySourceColumns) ? groupbySourceColumns : [],
          aggregations: sourceAggs.map(a => ({
            column: a.column || '',
            function: (a.func || '')?.toString().toUpperCase(),
            output_target: { mode: a.output_mode || 'inplace' }
          }))
        },
        source: {
          groupby_columns: Array.isArray(groupbyTargetColumns) ? groupbyTargetColumns : [],
          aggregations: targetAggs.map(a => ({
            column: a.column || '',
            function: (a.func || '')?.toString().toUpperCase(),
            output_target: { mode: a.output_mode || 'inplace' }
          }))
        }
      };
      // attach as advanced_options:
      // - if user selected "none" (advancedSelection === 'none') or groupby not enabled -> send empty string
      // - otherwise send existing groupby_vlookup object
      if (advancedSelection === 'none' || !groupbyEnabled) {
        saveData.advanced_options = [''];
      } else {
        saveData.advanced_options = [{ groupby_vlookup: groupbyObj }];
      }

      await onSave(saveData);
    } catch (error) {
      console.error('Error saving advanced vlookup:', error);
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <TooltipProvider>
      <div className="w-full mx-auto p-1 min-h-[600px] min-w-full overflow-y-auto">
        <div className="space-y-2 min-h-[600px]">
          {/* Source Selection & Actions */}
          <div className="p-2 bg-background dark:bg-stone-900 border border-slate-200 dark:border-gray-800 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold mr-2">Select Sources for VLookup:</h3>
                {allNodes.map(node => (
                  <div key={node.id} className="flex items-center gap-1 px-1.5 py-0.5 border rounded-lg shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                    <Database size={14} className="text-slate-500" />
                    <span className="text-xs font-semibold">{(node.data as any).display_name || node.id}</span>
                    <ToggleGroup type="single" value={sourceNodeId === node.id ? 'S' : lookupNodeId === node.id ? 'L' : ''} onValueChange={(val) => val && handleRoleSelect(node.id, val as 'S' | 'L')}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ToggleGroupItem value="S" aria-label="Set as Source" className="h-6 w-6 text-xs font-bold border-2 data-[state=on]:border-primary data-[state=on]:text-primary data-[state=off]:border-slate-300 data-[state=off]:text-slate-600">S</ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent>Source</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ToggleGroupItem value="L" aria-label="Set as Lookup" className="h-6 w-6 text-xs font-bold border-2 data-[state=on]:border-primary data-[state=on]:text-primary data-[state=off]:border-slate-300 data-[state=off]:text-slate-600">L</ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent>Lookup</TooltipContent>
                      </Tooltip>
                    </ToggleGroup>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className='gap-7 flex'>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-white mr-2">Indicator</label>
                      <Checkbox id="indicator" checked={indicator} onCheckedChange={(c) => setIndicator(!!c)} />
                    </div>

                    {/* isToleranceVlookup checkbox */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-white">isToleranceVlookup</label>
                      <Checkbox id="isToleranceVlookup" checked={isToleranceVlookup} onCheckedChange={(c) => setIsToleranceVlookup(!!c)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-white">{formData.mergeType.label}:</label>
                    <Select onValueChange={setMergeType} defaultValue={mergeType}>
                      <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{formData.mergeType.options.map(opt => (<SelectItem key={opt.value} value={opt.value} className="bg-white">{opt.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
                    <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={
                      !sourceNodeId ||
                      !lookupNodeId ||
                      keyPairs.length === 0 ||
                      mode == 'view' ||
                      // disable save when tolerance is enabled and tolerance controls invalid
                      (isToleranceVlookup && (!sourceTolColumn || !targetTolColumn || Number(toleranceValue) <= 0))
                    } className='disabled:cursor-not-allowed'>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save VLookup'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Combined Mapping & Review Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 items-stretch min-h-[400px]">
            {/* Column Mapping */}
            <div className="p-2 bg-background dark:bg-black border border-slate-200 dark:border-gray-800 rounded-lg xl:col-span-2 min-h-[400px]">
              <h3 className="text-base font-semibold mb-2">Create VLookup Connections</h3>
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
                  <TabsTrigger value="enrich">Select VLookup Columns</TabsTrigger>
                </TabsList>
                <TabsContent value="review" className="flex-1 mt-0">
                  {/* make container a column so tolerance controls stay below list; min-h-0 enables child scrolling */}
                  <div className="p-2 border border-slate-200 dark:border-gray-800 rounded-lg flex flex-col min-h-0">
                    {/* Connections list: this flex child grows, then scrolls once it reaches max height */}
                    <div className="flex-1 min-h-0 overflow-y-auto max-h-[170px]">
                      {keyPairs.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 px-0">
                          {keyPairs.map((pair, index) => (
                            <div key={index} className="flex items-center gap-1.5 px-1.5 py-0.5 text-sm rounded-md border border-slate-200 dark:border-gray-800">
                              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", CONNECTION_COLORS[index % CONNECTION_COLORS.length].bg)}></span>
                              <Tooltip delayDuration={100}><TooltipTrigger asChild><span className="font-medium text-slate-700 dark:text-white flex-1 truncate">{pair.source_column}</span></TooltipTrigger><TooltipContent><p>{pair.source_column}</p></TooltipContent></Tooltip>
                              <ArrowRight size={14} className="text-slate-900 dark:text-white shrink-0" />
                              <Tooltip delayDuration={100}><TooltipTrigger asChild><span className="ml-2 font-medium text-slate-700 dark:text-white flex-1 truncate">{pair.lookup_column}</span></TooltipTrigger><TooltipContent><p>{pair.lookup_column}</p></TooltipContent></Tooltip>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:bg-black/10 rounded-full" onClick={(e) => { e.stopPropagation(); removeKeyPair(index); }}><X size={12} /></Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-sm text-slate-500 p-6"><p>No key connections made yet.</p></div>
                      )}
                    </div>

                    {/* Tolerance controls - shown when isToleranceVlookup is checked (outside the scrollable list) */}
                    {isToleranceVlookup && (
                      <div className="mt-3 p-2 border-t border-slate-100 dark:border-gray-800">
                        <h4 className="font-semibold text-sm mb-2">Tolerance Settings</h4>
                        <Tabs defaultValue="sourceTol" className="mb-2">
                          <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="sourceTol">Source Tolerance Column </TabsTrigger>
                            <TabsTrigger value="targetTol">Target Tolerance Column</TabsTrigger>
                          </TabsList>
                          <TabsContent value="sourceTol" className="mt-2">
                            <div className="flex items-center gap-2">
                              <AlternativeSelect
                                options={(sourceNodeColumns || []).map(c => ({ label: c, value: c }))}
                                value={sourceTolColumn || undefined}
                                onChange={(v) => setSourceTolColumn(String(v))}
                                placeholder="Select source column"
                                searchPlaceholder="Search source columns..."
                                emptyText="No source columns"
                                allowCustomValue={false}
                              />
                            </div>
                          </TabsContent>
                          <TabsContent value="targetTol" className="mt-2">
                            <div className="flex items-center gap-2">
                              <AlternativeSelect
                                options={(lookupNodeColumns || []).map(c => ({ label: c, value: c }))}
                                value={targetTolColumn || undefined}
                                onChange={(v) => setTargetTolColumn(String(v))}
                                placeholder="Select target column"
                                searchPlaceholder="Search target columns..."
                                emptyText="No target columns"
                                allowCustomValue={false}
                              />
                            </div>
                          </TabsContent>
                        </Tabs>

                        <div className="mt-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-white block mb-1">Tolerance Value (positive)</label>
                          <Input
                            type="number"
                            min={0.0000001}
                            step="any"
                            value={toleranceValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setToleranceValue(''); return; }
                              const num = Number(val);
                              if (!Number.isNaN(num) && num > 0) setToleranceValue(String(val));
                            }}
                            placeholder="Enter positive tolerance"
                            className="w-full bg-background "
                          />
                        </div>

                        {/* Strategy Type - shown when tolerance vlookup is enabled */}
                        <div className="mt-3">
                          <label className="text-sm font-medium text-slate-700 dark:text-white block mb-1">Strategy Type</label>
                          <Select onValueChange={(v) => setStrategyType(String(v))} value={strategyType} defaultValue={strategyType}>
                            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Select strategy" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="backward">Backward</SelectItem>
                              <SelectItem value="forward">Forward</SelectItem>
                              <SelectItem value="nearest">Nearest</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="enrich" className="flex-1 mt-0">
                  <div className="p-2 bg-background dark:bg-black border border-slate-200 dark:border-gray-800 rounded-lg">
                    <div className="space-y-1 overflow-y-auto h-[200px] pr-1">
                      {lookupNodeColumns.length > 0 ? lookupNodeColumns.map(col => (
                        <div key={col} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-lg">
                          <Checkbox id={`enrich-${col}`} checked={enrichColumns.includes(col)} onCheckedChange={(checked) => {
                            setEnrichColumns(prev => checked ? [...prev, col] : prev.filter(c => c !== col));
                          }} />
                          <label htmlFor={`enrich-${col}`} className="text-sm font-medium cursor-pointer text-slate-700 dark:text-white flex-1">{col}</label>
                        </div>
                      )) : <p className="text-sm text-center text-slate-500 p-4">Select a lookup node to see columns</p>}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Filters Section */}
          <div className="p-2 border border-slate-200 dark:border-gray-800 rounded-lg">
            <h3 className="text-base font-semibold mb-2">Data Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col">
                <h4 className="font-semibold text-sm mb-2">Source Filters ({sourceNode?.data.display_name || sourceNode?.id || 'N/A'})</h4>
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
                <h4 className="font-semibold text-sm mb-2">Lookup Filters ({lookupNode?.data.display_name || lookupNode?.id || 'N/A'})</h4>
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

          {/* Advanced VLookup settings: sentence that toggles a dropdown. Dropdown currently offers "GroupBy VLookup" */}
          <div className="p-2 border border-slate-200 dark:border-gray-800 rounded-lg bg-background dark:bg-black">
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                className="text-sm text-primary decoration-primary dark:text-slate-200 "
                onClick={() => setAdvancedDropdownOpen(prev => !prev)}
              >
                Advanced VLookup settings
              </button>
              <div>
                <Select value={advancedSelection} onValueChange={setAdvancedSelection}>
                  <SelectTrigger className="w-44 h-9"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="groupby_vlookup">GroupBy VLookup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="!h-6 !w-6 !bg-transparent"
                  onClick={resetGroupbySettings}
                >
                  <Trash2 className='text-red-600' />
                </Button>
              </div>
            </div>
          </div>

          {groupbyEnabled && (
            <div className="space-y-3 bg-background dark:bg-black p-2 border border-slate-200 dark:border-gray-800 rounded-lg">
              <div className="flex flex-wrap gap-4">
                {/* Apply on dataset */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Apply On Dataset:</label>
                  <Select onValueChange={(v) => setGroupbyApplyOn(v)} defaultValue={groupbyApplyOn}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Select dataset" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="target">Target Dataset</SelectItem>
                      <SelectItem value="source">Source Dataset</SelectItem>
                      <SelectItem value="both">Both Datasets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Return level */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Result Level:</label>
                  <Select onValueChange={(v) => setGroupbyReturnLevel(v)} defaultValue={groupbyReturnLevel}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Return level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="row">Row Level</SelectItem>
                      <SelectItem value="group">Group Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Conditionally render Source panel */}
                {(groupbyApplyOn === 'source' || groupbyApplyOn === 'both') && (
                  <div className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Source Dataset Columns ({sourceNode?.data.display_name || sourceNode?.id || 'N/A'})</h4>
                      <Button size="sm" variant="outline" onClick={() => setGroupbySourceColumns(prev => [...prev, ''])}>+ Add Column</Button>
                    </div>
                    <div className="space-y-2">
                      {groupbySourceColumns.length > 0 ? groupbySourceColumns.map((col, idx) => (
                        <div key={`scol_${idx}`} className="flex items-center gap-2">
                          <AlternativeSelect
                            options={(sourceNodeColumns || []).map(c => ({ label: c, value: c }))}
                            value={col || undefined}
                            onChange={(v) => setGroupbySourceColumns(prev => prev.map((p, i) => i === idx ? String(v) : p))}
                            placeholder="Select column"
                            searchPlaceholder="Search..."
                            emptyText="No columns"
                            allowCustomValue={false}
                          />
                          <Button size="icon" variant="ghost" onClick={() => setGroupbySourceColumns(prev => prev.filter((_, i) => i !== idx))}><X size={14} /></Button>
                        </div>
                      )) : <p className="text-sm text-slate-500">No source columns selected</p>}
                    </div>
                  </div>
                )}

                {/* Conditionally render Target panel */}
                {(groupbyApplyOn === 'target' || groupbyApplyOn === 'both') && (
                  <div className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Target Dataset Columns ({lookupNode?.data.display_name || lookupNode?.id || 'N/A'})</h4>
                      <Button size="sm" variant="outline" onClick={() => setGroupbyTargetColumns(prev => [...prev, ''])}>+ Add Column</Button>
                    </div>
                    <div className="space-y-2">
                      {groupbyTargetColumns.length > 0 ? groupbyTargetColumns.map((col, idx) => (
                        <div key={`tcol_${idx}`} className="flex items-center gap-2">
                          <AlternativeSelect
                            options={(lookupNodeColumns || []).map(c => ({ label: c, value: c }))}
                            value={col || undefined}
                            onChange={(v) => setGroupbyTargetColumns(prev => prev.map((p, i) => i === idx ? String(v) : p))}
                            placeholder="Select column"
                            searchPlaceholder="Search..."
                            emptyText="No columns"
                            allowCustomValue={false}
                          />
                          <Button size="icon" variant="ghost" onClick={() => setGroupbyTargetColumns(prev => prev.filter((_, i) => i !== idx))}><X size={14} /></Button>
                        </div>
                      )) : <p className="text-sm text-slate-500">No target columns selected</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Aggregations panels (conditionally rendered) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(groupbyApplyOn === 'source' || groupbyApplyOn === 'both') && (
                  <div className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Source Dataset Aggregations ({sourceNode?.data.display_name || sourceNode?.id || 'N/A'})</h4>
                      <Button size="sm" variant="outline" onClick={addSourceAgg}>+ Add Aggregation</Button>
                    </div>
                    <div className="space-y-2">
                      {sourceAggs.length === 0 && <p className="text-sm text-slate-500">No aggregations</p>}
                      {sourceAggs.map(agg => (
                        <div key={agg.id} className="flex gap-2 items-center">
                          <AlternativeSelect
                            options={(sourceNodeColumns || []).map(c => ({ label: c, value: c }))}
                            value={agg.column || undefined}
                            onChange={(v) => updateSourceAgg(agg.id, { column: String(v) })}
                            placeholder="Column"
                            searchPlaceholder="Search..."
                            emptyText="No columns"
                            allowCustomValue={false}
                          />
                          <Select onValueChange={(v) => updateSourceAgg(agg.id, { func: v })} defaultValue={agg.func || 'SUM'}>
                            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Function" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUM">SUM</SelectItem>
                              <SelectItem value="FIRST">FIRST</SelectItem>
                              <SelectItem value="LAST">LAST</SelectItem>
                              <SelectItem value="AVG">AVG</SelectItem>
                              <SelectItem value="MIN">MIN</SelectItem>
                              <SelectItem value="MAX">MAX</SelectItem>
                              <SelectItem value="COUNT">COUNT</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select onValueChange={(v) => updateSourceAgg(agg.id, { output_mode: v })} defaultValue={agg.output_mode || 'inplace'}>
                            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Output Mode" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inplace">In-place</SelectItem>
                              <SelectItem value="new_column">New Column</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => removeSourceAgg(agg.id)}><X size={14} /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(groupbyApplyOn === 'target' || groupbyApplyOn === 'both') && (
                  <div className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Target Dataset Aggregations({lookupNode?.data.display_name || lookupNode?.id || 'N/A'})</h4>
                      <Button size="sm" variant="outline" onClick={addTargetAgg}>+ Add Aggregation</Button>
                    </div>
                    <div className="space-y-2">
                      {targetAggs.length === 0 && <p className="text-sm text-slate-500">No aggregations</p>}
                      {targetAggs.map(agg => (
                        <div key={agg.id} className="flex gap-2 items-center">
                          <AlternativeSelect
                            options={(lookupNodeColumns || []).map(c => ({ label: c, value: c }))}
                            value={agg.column || undefined}
                            onChange={(v) => updateTargetAgg(agg.id, { column: String(v) })}
                            placeholder="Column"
                            searchPlaceholder="Search..."
                            emptyText="No columns"
                            allowCustomValue={false}
                          />
                          <Select onValueChange={(v) => updateTargetAgg(agg.id, { func: v })} defaultValue={agg.func || 'SUM'}>
                            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Function" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUM">SUM</SelectItem>
                              <SelectItem value="FIRST">FIRST</SelectItem>
                              <SelectItem value="AVG">AVG</SelectItem>
                              <SelectItem value="COUNT">COUNT</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select onValueChange={(v) => updateTargetAgg(agg.id, { output_mode: v })} defaultValue={agg.output_mode || 'inplace'}>
                            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Output Mode" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inplace">In-place</SelectItem>
                              <SelectItem value="new_column">New Column</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => removeTargetAgg(agg.id)}><X size={14} /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
      <h3 className="text-sm font-semibold text-primary">
        {title}: <span className="font-bold text-primary">{node?.data.display_name || node?.id || 'None'}</span>
      </h3>
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        <Input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-40 pl-7 pr-7 text-xs border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-100"
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
                "flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md border border-primary disabled:cursor-not-allowed disabled:opacity-70 transition-all text-primary",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                selectedColumn === col && "ring-2 ring-blue-500 border-blue-500",
                colorMap.get(col) ? `border-l-4 ${colorMap.get(col)}` : 'border-l-4 dark:border-gray-700 border-gray-200'
              )}>
              <span className="flex-1">{col}</span>
            </button>
          ))
        ) : (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-center text-slate-500">No matching columns</p>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-center text-slate-500">Select a {title.toLowerCase()} node</p>
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


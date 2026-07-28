import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { X, Plus, Trash2, Save, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { DataSource } from './types/mapping';
import useFlowStore from '@/stores/flowStore';
import { mapFilterDataToPayload } from '@/utils/filterUtils';

interface FilterNode {
  id: string;
  type: 'filter' | 'group';
  field?: string;
  operator?: string;
  value?: string | null;
  value1?: string | null;
  logic?: 'AND' | 'OR';
  children?: FilterNode[];
  // Logic operator that connects this node to the previous one (for mixed logic in groups)
  connectLogic?: 'AND' | 'OR';
}

interface ColumnInfo {
  name: string;
  type: string;
  table?: string;
  isSource: boolean;
  isTarget: boolean;
}

interface FiltersConfigurationProps {
  connections: any[];
  selectedColumn?: ColumnInfo | null;
  dataSources?: DataSource[];
  onFiltersChange?: (filters: Record<string, FilterNode> | { sourceName: string; column_filters: any }) => void;
  onColumnSelect?: (column: ColumnInfo | null) => void;
  sourceName?: string; // Source name to display instead of "selected column"
  storedColumnFilters?: any; // Stored column filters from validation store
  onFilterSave?: (filterType?: string, data?: any, sourceId?: string) => Promise<void>; // For calling the API
}

const FIELD_OPTIONS: { name: string; type: string }[] = [
  { name: 'OrderNumber', type: 'string' },
  { name: 'Customer', type: 'string' },
  { name: 'OrderAmount', type: 'number' },
  { name: 'CreatedDate', type: 'date' },
  { name: 'Status', type: 'string' },
];

const OPERATORS = [
  'equals',
  'not_equals',
  '>',
  '<',
  '>=',
  '<=',
  'in',
  'not_in',
  'like',
  'between'
];

function uid(prefix = 'id'): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function createFilter(): FilterNode {
  return {
    id: uid('f_'),
    type: 'filter',
    field: '',
    operator: 'equals',
    value: null,
    value1: null
  };
}

function createGroup(): FilterNode {
  return {
    id: uid('g_'),
    type: 'group',
    logic: 'AND',
    children: [createFilter()]
  };
}

export const FiltersConfiguration: React.FC<FiltersConfigurationProps> = ({
  connections,
  selectedColumn,
  dataSources = [],
  onFiltersChange,
  onColumnSelect,
  sourceName,
  storedColumnFilters,
  onFilterSave
}) => {
  // Store filters per column - load from store if available
  const [filtersByColumn, setFiltersByColumn] = useState<Record<string, FilterNode>>({});
  const [showPreview, setShowPreview] = useState(false);
  
  // Get current node to load filters from payload
  const currentNode = useFlowStore((state) => state.getSelectedNode());

  // Convert JSON back to FilterNode structure
  // Supports both old format (type/children) and new format (logic/conditions)
  const jsonToFilterNode = (json: any): FilterNode | null => {
    if (!json || typeof json !== 'object') return null;
    
    // New format: has logic and conditions array
    if (json.logic && Array.isArray(json.conditions)) {
      return {
        id: json.id || uid('g_'),
        type: 'group',
        logic: json.logic || 'AND',
        children: json.conditions.map((condition: any) => {
          // If condition has logic and conditions, it's a nested group
          if (condition.logic && Array.isArray(condition.conditions)) {
            return jsonToFilterNode(condition);
          }
          // Otherwise, it's a filter
          return {
            id: condition.id || uid('f_'),
            type: 'filter' as const,
            field: condition.field || '',
            operator: condition.operator || 'equals',
            value: condition.value || null,
            value1: condition.value1 || null,
            connectLogic: condition.connectLogic || undefined
          };
        }).filter(Boolean) as FilterNode[]
      };
    }
    
    // Old format: has type and id (FilterNode structure)
    if (json.type === 'group' && json.logic) {
      return {
        id: json.id || uid('g_'),
        type: 'group',
        logic: json.logic || 'AND',
        children: (json.children || []).map((child: any) => {
          if (child.type === 'filter') {
            return {
              id: child.id || uid('f_'),
              type: 'filter',
              field: child.field || '',
              operator: child.operator || 'equals',
              value: child.value || null,
              value1: child.value1 || null,
              connectLogic: child.connectLogic || undefined
            };
          } else if (child.type === 'group') {
            return jsonToFilterNode(child);
          } else {
            // Single filter object
            return {
              id: child.id || uid('f_'),
              type: 'filter',
              field: child.field || '',
              operator: child.operator || 'equals',
              value: child.value || null,
              value1: child.value1 || null,
              connectLogic: child.connectLogic || undefined
            };
          }
        }).filter(Boolean) as FilterNode[]
      };
    } else if (json.type === 'filter') {
      return {
        id: json.id || uid('f_'),
        type: 'filter',
        field: json.field || '',
        operator: json.operator || 'equals',
        value: json.value || null,
        value1: json.value1 || null,
        connectLogic: json.connectLogic || undefined
      };
    } else if (json.logic && json.children) {
      // Has logic and children but no type - treat as group
      return {
        id: uid('g_'),
        type: 'group',
        logic: json.logic || 'AND',
        children: (json.children || []).map((child: any) => jsonToFilterNode(child)).filter(Boolean) as FilterNode[]
      };
    } else if (json.field || json.operator) {
      // Single filter object (has field or operator)
      return {
        id: json.id || uid('f_'),
        type: 'filter',
        field: json.field || '',
        operator: json.operator || 'equals',
        value: json.value || null,
        value1: json.value1 || null,
        connectLogic: json.connectLogic || undefined
      };
    }
    
    return null;
  };
  
  // Load filters from store when component mounts or sourceName/storedColumnFilters changes
  useEffect(() => {
    // First try to load from storedColumnFilters (validation store)
    // Then try to load from payload if not found
    const nodePayload = currentNode?.data?.node?.payload || {};
    
    // Try to load filters for the current sourceName
    if (sourceName) {
      // First check storedColumnFilters
      let storedFilters: any = null;
      let matchingKey: string | null = null;
      
      if (storedColumnFilters) {
        // Try multiple keys: sourceName, source ID, table name, etc.
        const possibleKeys = [
          sourceName,
          ...(dataSources.find(ds => ds.name === sourceName || ds.id === sourceName)?.tables.map(t => t.name) || []),
          ...(dataSources.find(ds => ds.name === sourceName || ds.id === sourceName)?.id ? [dataSources.find(ds => ds.name === sourceName || ds.id === sourceName)!.id] : [])
        ];
        
        // Find the first matching key in storedColumnFilters
        for (const key of possibleKeys) {
          if (storedColumnFilters[key]) {
            storedFilters = storedColumnFilters[key];
            matchingKey = key;
            break;
          }
        }
        
        // Also check all keys in storedColumnFilters for partial matches
        if (!storedFilters) {
          Object.keys(storedColumnFilters).forEach(key => {
            if (key.includes(sourceName) || sourceName.includes(key)) {
              storedFilters = storedColumnFilters[key];
              matchingKey = key;
            }
          });
        }
        
        if (storedFilters && matchingKey) {
          const columnKey = `source_${sourceName}`;
          
          const filterNode = jsonToFilterNode(storedFilters);
          if (filterNode) {
            setFiltersByColumn(prev => ({
              ...prev,
              [columnKey]: filterNode
            }));
          } else if (storedFilters && typeof storedFilters === 'object') {
            // If conversion fails, try to create a default group with the stored data
            const wrappedFilter: FilterNode = {
              id: uid('g_'),
              type: 'group',
              logic: 'AND',
              children: Array.isArray(storedFilters) 
                ? storedFilters.map((f: any) => ({
                    id: uid('f_'),
                    type: 'filter' as const,
                    field: f?.field || '',
                    operator: f?.operator || 'equals',
                    value: f?.value || null,
                    value1: f?.value1 || null
                  }))
                : [{
                    id: uid('f_'),
                    type: 'filter' as const,
                    field: storedFilters?.field || '',
                    operator: storedFilters?.operator || 'equals',
                    value: storedFilters?.value || null,
                    value1: storedFilters?.value1 || null
                  }]
            };
            setFiltersByColumn(prev => ({
              ...prev,
              [columnKey]: wrappedFilter
            }));
          }
        }
      }
      
      // If not found in storedColumnFilters, try to load from payload
      // Only load from payload if we didn't find filters in storedColumnFilters
      if (!storedFilters && nodePayload) {
        const columnKey = `source_${sourceName}`;
        
        // Check inside rule dictionaries for column_filters
        Object.keys(nodePayload).forEach(key => {
          const ruleData = nodePayload[key];
          if (ruleData && typeof ruleData === 'object' && !Array.isArray(ruleData)) {
            // Check each key in the rule data for source keys
            Object.keys(ruleData).forEach(sourceKey => {
              // Skip known rule-level keys
              if (['datasets', 'field_rules', 'rule_configuration'].includes(sourceKey)) {
                return;
              }
              
              // Check if this source key matches our sourceName
              if (sourceKey === sourceName || sourceKey.includes(sourceName) || sourceName.includes(sourceKey)) {
                const sourceData = ruleData[sourceKey];
                if (sourceData && typeof sourceData === 'object' && sourceData.column_filters) {
                  const filterNode = jsonToFilterNode(sourceData.column_filters);
                  if (filterNode) {
                    setFiltersByColumn(prev => {
                      // Only set if not already present
                      if (!prev[columnKey]) {
                        return {
                          ...prev,
                          [columnKey]: filterNode
                        };
                      }
                      return prev;
                    });
                  }
                }
              }
            });
          }
        });
      }
    }
    
    // Also load filters for all columns from connections if no sourceName
    if (!sourceName && storedColumnFilters && Object.keys(storedColumnFilters).length > 0) {
      const loadedFilters: Record<string, FilterNode> = {};
      
      Object.keys(storedColumnFilters).forEach(key => {
        const storedFilters = storedColumnFilters[key];
        // Try to determine column key from the stored key
        const columnKey = key.startsWith('source_') || key.startsWith('target_') 
          ? key 
          : `source_${key}`;
        
        const filterNode = jsonToFilterNode(storedFilters);
        if (filterNode) {
          loadedFilters[columnKey] = filterNode;
        }
      });
      
      if (Object.keys(loadedFilters).length > 0) {
        setFiltersByColumn(prev => ({
          ...prev,
          ...loadedFilters
        }));
      }
    }
  }, [sourceName, storedColumnFilters, dataSources, currentNode?.data?.node?.payload]);

  // Get all unique columns from connections
  const availableColumns = useMemo(() => {
    const columns = new Map<string, ColumnInfo>();
    
    connections.forEach(conn => {
      // Source column
      if (conn.sourceColumn?.name) {
        const key = `source_${conn.sourceColumn.name}`;
        if (!columns.has(key)) {
          columns.set(key, {
            name: conn.sourceColumn.name,
            type: conn.sourceColumn.type || 'string',
            table: conn.sourceColumn.table,
            isSource: true,
            isTarget: false
          });
        }
      }
      
      // Target column (if not single rule)
      if (!conn.singleRule && conn.targetColumn?.name) {
        const key = `target_${conn.targetColumn.name}`;
        if (!columns.has(key)) {
          columns.set(key, {
            name: conn.targetColumn.name,
            type: conn.targetColumn.type || 'string',
            table: conn.targetColumn.table,
            isSource: false,
            isTarget: true
          });
        }
      }
    });
    
    return Array.from(columns.values());
  }, [connections]);

  // Get filter root for selected column
  const getFilterRoot = (columnKey: string): FilterNode => {
    if (!filtersByColumn[columnKey]) {
      const newRoot = createGroup();
      setFiltersByColumn(prev => ({
        ...prev,
        [columnKey]: newRoot
      }));
      return newRoot;
    }
    return filtersByColumn[columnKey];
  };

  // Get field options based on sourceName or selectedColumn
  const getFieldOptions = useMemo((): { name: string; type: string }[] => {
    const allColumns: { name: string; type: string }[] = [];
    
    // If sourceName is provided, get all columns from all tables in that source
    if (sourceName) {
      const source = dataSources.find(ds => ds.name === sourceName || ds.id === sourceName);
      if (source) {
        // Get all columns from all tables in this source
        source.tables.forEach(table => {
          table.columns.forEach(col => {
            allColumns.push({
              name: col.name,
              type: col.type || 'string'
            });
          });
        });
      }
    } else if (selectedColumn && selectedColumn.table) {
      // If selectedColumn is provided, get columns from that specific table
      dataSources.forEach(source => {
        source.tables.forEach(table => {
          if (table.name === selectedColumn.table) {
            // Add all columns from this table
            table.columns.forEach(col => {
              allColumns.push({
                name: col.name,
                type: col.type || 'string'
              });
            });
          }
        });
      });
      
      // If no columns found in dataSources, fall back to availableColumns from connections
      if (allColumns.length === 0) {
        const filteredColumns = availableColumns.filter(col => 
          col.table === selectedColumn.table
        );
        return filteredColumns.map(col => ({
          name: col.name,
          type: col.type || 'string'
        }));
      }
    }
    
    // Remove duplicates based on column name
    const uniqueColumns = new Map<string, { name: string; type: string }>();
    allColumns.forEach(col => {
      if (!uniqueColumns.has(col.name)) {
        uniqueColumns.set(col.name, col);
      }
    });
    
    return Array.from(uniqueColumns.values());
  }, [dataSources, availableColumns, selectedColumn, sourceName]);

  // Convert fieldOptions to Combobox format (with value and label)
  const fieldOptionsForCombobox = useMemo(() => {
    return getFieldOptions.map(f => ({
      value: f.name,
      label: `${f.name} (${f.type})`
    }));
  }, [getFieldOptions]);

  const fieldOptions = getFieldOptions;

  // Update filter root
  const updateFilterRoot = (columnKey: string, newRoot: FilterNode) => {
    setFiltersByColumn(prev => {
      const updated = {
        ...prev,
        [columnKey]: JSON.parse(JSON.stringify(newRoot)) // Deep clone
      };
      
      if (onFiltersChange) {
        onFiltersChange(updated);
      }
      
      return updated;
    });
  };

  // Remove node from tree
  const removeNode = (node: FilterNode, targetId: string): boolean => {
    if (!node.children) return false;
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      if (node.children[i].id === targetId) {
        node.children.splice(i, 1);
        return true;
      }
      if (node.children[i].type === 'group') {
        if (removeNode(node.children[i], targetId)) return true;
      }
    }
    return false;
  };

  // Render filter row
  const renderFilterRow = (filter: FilterNode, parentGroup: FilterNode, columnKey: string) => {
    const updateFilterField = (value: string) => {
      const root = getFilterRoot(columnKey);
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === filter.id) {
          return { ...node, field: value };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const updateFilterOperator = (value: string) => {
      const root = getFilterRoot(columnKey);
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === filter.id) {
          return { ...node, operator: value };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const updateFilterValue = (value: string) => {
      const root = getFilterRoot(columnKey);
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === filter.id) {
          return { ...node, value };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const updateFilterValue1 = (value: string) => {
      const root = getFilterRoot(columnKey);
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === filter.id) {
          return { ...node, value1: value };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const removeFilter = () => {
      const root = getFilterRoot(columnKey);
      if (root && root.children) {
        const newRoot = { ...root, children: root.children.filter(c => c.id !== filter.id) };
        // Also recursively remove from nested groups
        const removeFromChildren = (node: FilterNode): FilterNode => {
          if (node.children) {
            return { ...node, children: node.children.filter(c => c.id !== filter.id).map(removeFromChildren) };
          }
          return node;
        };
        updateFilterRoot(columnKey, removeFromChildren(newRoot));
      }
    };

    return (
      <div key={filter.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          <Combobox
            options={fieldOptionsForCombobox}
            value={filter.field || ''}
            onChange={updateFilterField}
            placeholder="Select field"
            searchPlaceholder="Search fields..."
            emptyText="No field found"
            className="h-9 min-w-[160px]"
          />

          <Select value={filter.operator || 'equals'} onValueChange={updateFilterOperator}>
            <SelectTrigger className="h-9 min-w-[130px] border-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map(op => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filter.operator === 'between' ? (
            <>
              <Input
                type="text"
                placeholder="Value"
                value={filter.value || ''}
                onChange={(e) => updateFilterValue(e.target.value)}
                className="h-9 min-w-[140px] border-slate-300"
              />
              <span className="text-slate-500 text-sm">and</span>
              <Input
                type="text"
                placeholder="Value 1"
                value={filter.value1 || ''}
                onChange={(e) => updateFilterValue1(e.target.value)}
                className="h-9 min-w-[140px] border-slate-300"
              />
            </>
          ) : filter.operator === 'in' || filter.operator === 'not_in' ? (
            <Input
              type="text"
              placeholder="Comma separated values"
              value={filter.value || ''}
              onChange={(e) => updateFilterValue(e.target.value)}
              className="h-9 min-w-[200px] border-slate-300"
            />
          ) : filter.operator === 'like' ? (
            <Input
              type="text"
              placeholder="%pattern%"
              value={filter.value || ''}
              onChange={(e) => updateFilterValue(e.target.value)}
              className="h-9 min-w-[180px] border-slate-300"
            />
          ) : (
            <Input
              type="text"
              placeholder="Value"
              value={filter.value || ''}
              onChange={(e) => updateFilterValue(e.target.value)}
              className="h-9 min-w-[160px] border-slate-300"
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={removeFilter}
          className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          title="Remove filter"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // Render group
  const renderGroup = (group: FilterNode, columnKey: string, depth = 0): React.ReactNode => {
    const updateGroupLogic = (logic: 'AND' | 'OR') => {
      const root = getFilterRoot(columnKey);
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === group.id) {
          return { ...node, logic: logic as 'AND' | 'OR' };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const addFilter = () => {
      const root = getFilterRoot(columnKey);
      const newFilter = createFilter();
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === group.id) {
          return { ...node, children: [...(node.children || []), newFilter] };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const addGroup = () => {
      const root = getFilterRoot(columnKey);
      const newGroup = createGroup();
      const updateNode = (node: FilterNode): FilterNode => {
        if (node.id === group.id) {
          return { ...node, children: [...(node.children || []), newGroup] };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };
      updateFilterRoot(columnKey, updateNode(root));
    };

    const removeGroup = () => {
      const root = getFilterRoot(columnKey);
      if (root.id === group.id) {
        // Reset root to new group
        updateFilterRoot(columnKey, createGroup());
      } else {
        const removeFromChildren = (node: FilterNode): FilterNode => {
          if (node.children) {
            return {
              ...node,
              children: node.children
                .filter(c => c.id !== group.id)
                .map(removeFromChildren)
            };
          }
          return node;
        };
        updateFilterRoot(columnKey, removeFromChildren(root));
      }
    };

    return (
      <div
        key={group.id}
        className="border border-dashed border-blue-300 rounded-xl p-3 mb-2 bg-blue-50/30"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-slate-300">
              <strong className="text-xs font-semibold text-slate-700">Group</strong>
              <Select value={group.logic || 'AND'} onValueChange={updateGroupLogic}>
                <SelectTrigger className="h-7 w-20 text-xs border-slate-300 rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {depth > 0 && (
              <span className="text-xs text-slate-500 italic">
                (Nested level {depth + 1})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addFilter}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addGroup}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Group
            </Button>
            {depth > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={removeGroup}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3 mt-2">
          {group.children && group.children.length > 0 ? (
            group.children.map((child, index) => {
              const updateConnectLogic = (logic: 'AND' | 'OR') => {
                const root = getFilterRoot(columnKey);
                const updateNode = (node: FilterNode): FilterNode => {
                  if (node.id === child.id) {
                    return { ...node, connectLogic: logic };
                  }
                  if (node.children) {
                    return { ...node, children: node.children.map(updateNode) };
                  }
                  return node;
                };
                updateFilterRoot(columnKey, updateNode(root));
              };

              return (
                <div key={child.id || index} className="relative">
                  {index > 0 && (
                    <div className="flex items-center justify-center mb-2 -mt-1">
                      <Select 
                        value={child.connectLogic || group.logic || 'AND'} 
                        onValueChange={(value: 'AND' | 'OR') => updateConnectLogic(value)}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs border-slate-300 rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {child.type === 'filter'
                    ? renderFilterRow(child, group, columnKey)
                    : renderGroup(child, columnKey, depth + 1)
                  }
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-300 rounded">
              No conditions in this group. Click "+ Filter" or "+ Group" to add.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Build expression string
  const buildExpression = (node: FilterNode): string => {
    if (node.type === 'filter') {
      const op = node.operator || 'equals';
      const field = node.field || '';
      const value = node.value || '';
      
      if (op === 'between') {
        return `${field} BETWEEN ${value} AND ${node.value1 || ''}`;
      }
      if (op === 'in') return `${field} IN (${value})`;
      if (op === 'not_in') return `${field} NOT IN (${value})`;
      if (op === 'like') return `${field} LIKE '${value}'`;
      return `${field} ${op} '${value}'`;
    }
    
    if (!node.children || node.children.length === 0) return '';
    const parts: string[] = [];
    node.children.forEach((child, index) => {
      const childExpr = buildExpression(child);
      if (childExpr) {
        if (index > 0) {
          // Use connectLogic if available, otherwise use group logic
          const logic = child.connectLogic || node.logic || 'AND';
          parts.push(logic);
        }
        parts.push(childExpr);
      }
    });
    return parts.length ? `(${parts.join(' ')})` : '';
  };

  // Build JSON in the new format (logic/conditions structure)
  const buildJSON = (node: FilterNode): any => {
    if (node.type === 'filter') {
      // Single filter condition
      return {
        id: node.id,
        field: node.field,
        operator: node.operator,
        value: node.value || null,
        ...(node.operator === 'between' && node.value1 !== null && { value1: node.value1 })
      };
    }
    
    // Group with conditions array
    // When building conditions, preserve connectLogic for mixed logic
    const conditions: any[] = [];
    (node.children || []).forEach((child, index) => {
      const childJson = buildJSON(child);
      // If this is not the first child and has a connectLogic, include it
      if (index > 0 && child.connectLogic) {
        // For mixed logic, we need to structure it differently
        // Store the logic operator with the condition
        childJson.connectLogic = child.connectLogic;
      }
      conditions.push(childJson);
    });
    
    // Build description based on logic and conditions
    const buildDescription = (logic: string, conditions: any[]): string => {
      if (conditions.length === 0) return '';
      if (conditions.length === 1) {
        const cond = conditions[0];
        if (cond.field) {
          return `${cond.field} ${cond.operator} ${cond.value}`;
        }
        return `Group with ${cond.conditions?.length || 0} conditions`;
      }
      
      // Build description showing the logic pattern
      const logicPattern = conditions.map((cond, idx) => {
        if (idx === 0) return '';
        const connectLogic = cond.connectLogic || logic;
        return connectLogic;
      }).filter(Boolean).join(' ');
      
      return `Group with ${conditions.length} conditions (${logicPattern})`;
    };
    
    return {
      logic: node.logic || 'AND',
      description: buildDescription(node.logic || 'AND', conditions),
      conditions: conditions
    };
  };

  // Handle save
  const handleSave = async () => {
    const columnKey = selectedColumn 
      ? `${selectedColumn.isSource ? 'source' : 'target'}_${selectedColumn.name}`
      : (sourceName ? `source_${sourceName}` : 'default');
    const root = filtersByColumn[columnKey];
    
    if (!root) {
      toast.error('No filters defined');
      return;
    }
    
    const columnFilterPayload = buildJSON(root);
    
    // Get sourceId from sourceName or selectedColumn
    let sourceId: string | undefined = undefined;
    if (sourceName) {
      // Try to find sourceId from dataSources
      const source = dataSources?.find(s => s.name === sourceName || s.tables.some(t => t.name === sourceName));
      sourceId = source?.id || sourceName;
    } else if (selectedColumn?.table) {
      // Try to find sourceId from selectedColumn's table
      const source = dataSources?.find(s => s.tables.some(t => t.name === selectedColumn.table));
      sourceId = source?.id || selectedColumn.table;
    }
    
    // Create column filter data with filter_type inside column_filters
    const columnFilterId = `column_filter_${Date.now()}`;
    const columnFilterData = {
      id: columnFilterId,
      column_filters: {
        ...columnFilterPayload,
        filter_type: "column_filter"
      },
      filter_type: "column_filter"
    };
    
    // If onFilterSave is provided, call the API (same as derive column)
    if (onFilterSave) {
      try {
        // Call the API through onFilterSave - pass columnFilterData directly
        // The useFilterSave hook will handle the mapping internally
        await onFilterSave("column_filter", columnFilterData, sourceId);
        
        // Also call onFiltersChange with the JSON and sourceName for storage in validation store
        if (onFiltersChange && sourceName) {
          onFiltersChange({
            sourceName: sourceName,
            column_filters: columnFilterPayload
          });
        }
        
        toast.success('Column filters saved and filter generated successfully');
      } catch (error) {
        console.error('Failed to save column filters:', error);
        if (!(error instanceof ApiRequestError)) {
          toast.error(getDisplayErrorMessage(error, 'Failed to save column filters'));
        }
      }
    } else {
      // Fallback: just call onFiltersChange if no API handler
      if (onFiltersChange && sourceName) {
        onFiltersChange({
          sourceName: sourceName,
          column_filters: columnFilterPayload
        });
        toast.success('Column filters saved successfully');
      } else {
        // Fallback: copy to clipboard if no sourceName
        try {
          await navigator.clipboard.writeText(JSON.stringify(columnFilterPayload, null, 2));
          toast.success('JSON copied to clipboard');
        } catch (e) {
          toast.error('Failed to copy to clipboard');
        }
      }
    }
  };

  // Handle clear
  const handleClear = () => {
    const columnKey = selectedColumn 
      ? `${selectedColumn.isSource ? 'source' : 'target'}_${selectedColumn.name}`
      : (sourceName ? `source_${sourceName}` : 'default');
    updateFilterRoot(columnKey, createGroup());
    toast.success('Filters cleared');
  };

  // If sourceName is provided, show filters by default (no need for selectedColumn)
  // Otherwise, require selectedColumn
  if (!sourceName && !selectedColumn) {
    return (
      <div className="flex items-center justify-center h-full p-12 bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-2">Select a column to configure filters</p>
          <p className="text-xs text-slate-400">
            Click on a column name in the connections list to start
          </p>
        </div>
      </div>
    );
  }

  // Use sourceName if provided, otherwise use selectedColumn
  const displayName = sourceName || (selectedColumn ? `${selectedColumn.name} (${selectedColumn.type})` : '');
  const columnKey = selectedColumn 
    ? `${selectedColumn.isSource ? 'source' : 'target'}_${selectedColumn.name}`
    : (sourceName ? `source_${sourceName}` : 'default');
  const root = getFilterRoot(columnKey);
  const expression = buildExpression(root) || '(no filters)';
  const jsonOutput = JSON.stringify(buildJSON(root), null, 2);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Actions and Source Info */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          {/* Source/Column Info */}
          {displayName && (
            <div>
              <p className="text-sm text-slate-600">
                <span className="font-medium">{sourceName ? 'Source:' : 'Selected Column:'}</span> {displayName}
              </p>
            </div>
          )}
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const root = getFilterRoot(columnKey);
                const newGroup = createGroup();
                const updatedRoot = {
                  ...root,
                  children: [...(root.children || []), newGroup]
                };
                updateFilterRoot(columnKey, updatedRoot);
              }}
              className="h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Group
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const root = getFilterRoot(columnKey);
                const newFilter = createFilter();
                const updatedRoot = {
                  ...root,
                  children: [...(root.children || []), newFilter]
                };
                updateFilterRoot(columnKey, updatedRoot);
              }}
              className="h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Left - Builder, Right - Preview & JSON */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Side - Builder Area (Left-aligned) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="pr-2">
            {renderGroup(root, columnKey)}
            {(!root.children || root.children.length === 0) && (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-300 rounded-lg">
                <p className="text-sm">No filters defined. Click "+ Add Filter" to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Preview & JSON Panel */}
        <div className="w-96 flex flex-col border-l border-slate-200 pl-4">
          {/* Preview Toggle Button */}
          <div className="mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full h-8 text-xs justify-between"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3" />
                <span>Preview & JSON</span>
              </div>
              {showPreview ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Preview Content */}
          {showPreview && (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-sm">Preview</strong>
                </div>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm whitespace-pre-wrap break-words">
                  {expression}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <strong className="text-sm">JSON</strong>
                </div>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96">
                  {jsonOutput}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Tip: Click "Save" to copy the JSON to clipboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

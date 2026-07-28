import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRuleConfigurationStore } from '@/stores/ruleConfigurationStore';

interface FilterCondition {
  column_name?: string;
  operator?: string;
  value?: any;
  logic_operator?: 'AND' | 'OR';
}

interface FiltersDisplayPanelProps {
  columnFiltersBySource: Record<string, any>;
  validationRulesMap: Record<string, any>;
  activeRuleName?: string | null;
  currentNode?: any;
  dataSources?: any[];
}

export const FiltersDisplayPanel: React.FC<FiltersDisplayPanelProps> = ({
  columnFiltersBySource,
  validationRulesMap,
  activeRuleName,
  currentNode,
  dataSources = [],
}) => {
  const [selectedRule, setSelectedRule] = useState<string | null>(activeRuleName || null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Get saved payload from store
  const savedRulePayload = useRuleConfigurationStore((state) =>
    currentNode?.id && state.nodeId === currentNode.id ? state.savedPayload : null
  );

  // Get all available rules from both validationRulesMap and savedPayload
  const availableRules = React.useMemo(() => {
    const rulesSet = new Set<string>();

    // Add rules from validationRulesMap (runtime state)
    if (validationRulesMap) {
      Object.keys(validationRulesMap).forEach(rule => rulesSet.add(rule));
    }

    // Add rules from savedPayload (persisted state)
    if (savedRulePayload?.rules) {
      Object.keys(savedRulePayload.rules).forEach(rule => rulesSet.add(rule));
    }

    return Array.from(rulesSet);
  }, [validationRulesMap, savedRulePayload]);

  // Set first rule as selected by default
  React.useEffect(() => {
    if (!selectedRule && availableRules.length > 0) {
      setSelectedRule(availableRules[0]);
    }
  }, [availableRules, selectedRule]);

  // Get filters for the selected rule from both validationRulesMap and savedPayload
  const getRuleFilters = React.useMemo(() => {
    if (!selectedRule) {
      return {};
    }

    const filters: Record<string, FilterCondition[]> = {};

    // First, try to get filters from validationRulesMap (runtime state)
    if (validationRulesMap && validationRulesMap[selectedRule]) {
      const ruleData = validationRulesMap[selectedRule];
      if (ruleData && typeof ruleData === 'object') {
        Object.entries(ruleData).forEach(([key, value]) => {
          if (value && typeof value === 'object' && 'filter_conditions' in value) {
            const filterConditions = (value as any).filter_conditions;
            if (Array.isArray(filterConditions) && filterConditions.length > 0) {
              filters[key] = filterConditions;
            }
          }
        });
      }
    }

    // Also check savedRulePayload for persisted filters (when editing saved node)
    if (savedRulePayload) {
      const ruleEntry =
        (savedRulePayload?.rules && savedRulePayload.rules[selectedRule]) ||
        savedRulePayload?.[selectedRule];

      if (ruleEntry && typeof ruleEntry === 'object') {
        Object.entries(ruleEntry).forEach(([key, value]) => {
          if (value && typeof value === 'object' && 'filter_conditions' in value) {
            const filterConditions = (value as any).filter_conditions;
            if (Array.isArray(filterConditions) && filterConditions.length > 0) {
              // Merge with existing filters (runtime state takes precedence)
              if (!filters[key]) {
                filters[key] = filterConditions;
              }
            }
          }
        });
      }
    }

    return filters;
  }, [selectedRule, validationRulesMap, savedRulePayload]);

  // Helper function to resolve sourceId to table name
  const resolveTableName = React.useCallback((sourceIdOrKey: string): string | null => {
    // Skip if it looks like a rule name (contains "_VS_" or "rule")
    if (sourceIdOrKey.includes('_VS_') || sourceIdOrKey.toLowerCase().includes('rule')) {
      return null;
    }

    // Try to find the data source by ID
    const dataSource = dataSources.find((ds: any) => ds.id === sourceIdOrKey);

    if (dataSource && dataSource.tables && dataSource.tables.length > 0) {
      // Return the first table name from this data source
      return dataSource.tables[0].name;
    }

    // If not found in dataSources, it might already be a table name
    return sourceIdOrKey;
  }, [dataSources]);

  // Get all available tables from filters
  const availableTables = React.useMemo(() => {
    const tablesMap = new Map<string, string>(); // Map of sourceId -> table name

    // Add tables from column filters
    Object.keys(columnFiltersBySource || {}).forEach(key => {
      const tableName = resolveTableName(key);
      if (tableName) {
        tablesMap.set(key, tableName);
      }
    });

    // Add tables from rule filters
    Object.keys(getRuleFilters).forEach(key => {
      const tableName = resolveTableName(key);
      if (tableName && !tablesMap.has(key)) {
        tablesMap.set(key, tableName);
      }
    });

    return tablesMap;
  }, [columnFiltersBySource, getRuleFilters, resolveTableName]);

  // Set first table as selected by default
  React.useEffect(() => {
    if (!selectedTable && availableTables.size > 0) {
      const firstKey = Array.from(availableTables.keys())[0];
      setSelectedTable(firstKey);
    }
  }, [availableTables, selectedTable]);

  // Get filters for selected table
  const getFiltersForSelectedTable = React.useMemo(() => {
    if (!selectedTable) return [];

    const filters: FilterCondition[] = [];

    // Add column filters for this table
    if (columnFiltersBySource && columnFiltersBySource[selectedTable]) {
      const columnFilters = columnFiltersBySource[selectedTable];
      if (Array.isArray(columnFilters)) {
        console.log('📊 Column filters for', selectedTable, ':', columnFilters);
        filters.push(...columnFilters);
      }
    }

    // Add rule filters for this table
    if (getRuleFilters[selectedTable]) {
      const ruleFilters = getRuleFilters[selectedTable];
      if (Array.isArray(ruleFilters)) {
        console.log('📊 Rule filters for', selectedTable, ':', ruleFilters);
        filters.push(...ruleFilters);
      }
    }

    console.log('📊 Total filters for', selectedTable, ':', filters);
    return filters;
  }, [selectedTable, columnFiltersBySource, getRuleFilters]);

  // Parse filter expression to extract column name and operation
  const parseFilterExpression = (filterExpr: string) => {
    // Example: 'df = df.with_columns((pl.col("ERNAM").str.to_uppercase()).alias("ERNAM"))'
    const columnMatch = filterExpr.match(/pl\.col\("([^"]+)"\)/);
    const columnName = columnMatch ? columnMatch[1] : 'Unknown';

    // Extract operation type
    let operation = 'transform';
    if (filterExpr.includes('.str.to_uppercase()')) operation = 'to_uppercase';
    else if (filterExpr.includes('.str.to_lowercase()')) operation = 'to_lowercase';
    else if (filterExpr.includes('.str.strip()')) operation = 'strip';
    else if (filterExpr.includes('.fill_null(')) operation = 'fill_null';
    else if (filterExpr.includes('.cast(')) operation = 'cast';

    return { columnName, operation, fullExpr: filterExpr };
  };

  const renderFilterConditions = (conditions: FilterCondition[]) => {
    // Ensure conditions is an array
    const conditionsArray = Array.isArray(conditions) ? conditions : [];

    if (!conditionsArray || conditionsArray.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="h-5 w-5 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">No filters applied</p>
        </div>
      );
    }

    return (  
      <div className="space-y-1.5">
        {conditionsArray.map((condition: any, index) => {
          // Handle filter expression format
          let columnName = 'Unknown';
          let operation = '';
          let displayValue = '';

          if (condition.filter) {
            const parsed = parseFilterExpression(condition.filter);
            columnName = parsed.columnName;
            operation = parsed.operation;
            displayValue = parsed.fullExpr;
          } else { 
            // Handle standard filter format
            columnName = condition.column_name || condition.column || condition.field || 'Unknown';
            operation = condition.operator || condition.op || '=';
            displayValue = condition.value ?? condition.val ?? condition.filter_value ?? 'N/A';
          }

          const logicOp = condition.logic_operator || condition.logic || condition.logical_operator;

          return (
            <div key={condition.id || index}>
              {index > 0 && logicOp && ( 
                <div className="flex items-center justify-center my-1">
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      logicOp === 'AND'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                  >
                    {logicOp}
                  </Badge>
                </div>
              )}
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {columnName}
                  </span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {operation}
                  </Badge>
                </div>
                {condition.filter && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900 p-1 rounded overflow-x-auto">
                    {displayValue}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="h-full p-0 gap-0 flex flex-col overflow-hidden">
      <CardHeader className="p-2 border-b flex-shrink-0">
        <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center p-0 m-0 gap-2">
          <Filter className="h-4 w-4" />
          Applied Filters
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2">
        {/* Rule Selection Buttons */}
        {availableRules.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Rules</label>
            <div className="flex flex-wrap gap-1">
              {availableRules.map((rule) => (
                <Button
                  key={rule}
                  variant={selectedRule === rule ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRule(rule)}
                  className="h-7 text-xs px-2"
                >
                  {rule.split('_VS_')[0]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Table Selection */}
        {availableTables.size > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Table</label>
            <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(availableTables.entries()).map(([sourceId, tableName]) => (
                  <SelectItem key={sourceId} value={sourceId} className="text-xs">
                    {tableName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Filters for Selected Table */}
        {selectedTable && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Filters</label>
              {getFiltersForSelectedTable.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {getFiltersForSelectedTable.length}
                </Badge>
              )}
            </div>
            {renderFilterConditions(getFiltersForSelectedTable)}
          </div>
        )}

        {/* Empty State */}
        {availableRules.length === 0 && availableTables.size === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-5 w-5 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">
              No filters applied yet
            </p>
          </div>
        )}
      </CardContent>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </Card>
  );
};

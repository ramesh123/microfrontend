import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MultiRowDynamicForm from '@/components/common/multi-row-dynamic-field';
import { DataSource } from '../types/mapping';
import { useRuleConfigurationStore } from '@/stores/ruleConfigurationStore';
import { useValidationStore } from '@/stores/validationStore';

interface FilterNodeViewProps {
  onBack: () => void;
  currentNode: any;
  sourcesToShow: DataSource[];
  selectedSourceTab: string;
  onSourceTabChange: (sourceId: string) => void;
  onFilterSave: (filterType?: string, data?: any, sourceId?: string) => Promise<void>;
  filterConditionsBySource: Record<string, any[]>;
  activeRuleName?: string | null;
  activeRuleId: string | null;
  validationRulesMap?: Record<string, any>;
  connections?: any[];
  dataSources?: DataSource[];
  connectionKeyStates?: any;
  getConnectionKeyState?: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  onColumnSelect?: (column: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null) => void;
  onFiltersChange?: (filters: any) => void;
  storedColumnFilters?: any;
}

export const FilterNodeView: React.FC<FilterNodeViewProps> = (props) => {
  const {
    onBack,
    currentNode,
    sourcesToShow,
    selectedSourceTab,
    onSourceTabChange,
    onFilterSave,
    filterConditionsBySource,
    activeRuleName,
    activeRuleId,
    validationRulesMap,
    connections = [],
    dataSources = [],
    connectionKeyStates = {},
    getConnectionKeyState = () => ({ isPrimaryKey: false, isValidationKey: false }),
    onColumnSelect = () => {},
    onFiltersChange = () => {},
    storedColumnFilters,
  } = props;
  const savedRulePayload = useRuleConfigurationStore((state) =>
    currentNode?.id && state.nodeId === currentNode.id ? state.savedPayload : null
  );
  const columnFiltersBySource = useValidationStore((state) => state.columnFiltersBySource);

  // CRITICAL: Calculate ruleStore inside buildSystemFilters or ensure it updates with activeRuleName
  // This ensures filters are correctly isolated per rule
  const ruleStore = React.useMemo(() => {
    if (!activeRuleName || !validationRulesMap) {
      return undefined;
    }
    return validationRulesMap[activeRuleName];
  }, [activeRuleName, validationRulesMap]);

  const getStoreFiltersForSource = React.useCallback(
    (source: DataSource) => {
      if (!savedRulePayload || !activeRuleName) {
        return [];
      }

      const ruleEntry =
        (savedRulePayload?.rules && savedRulePayload.rules[activeRuleName]) ||
        savedRulePayload?.[activeRuleName];

      if (!ruleEntry || typeof ruleEntry !== 'object') {
        return [];
      }

      const candidateKeys = new Set<string>();
      if (source.id) candidateKeys.add(source.id);
      if (source.name) candidateKeys.add(source.name);
      source.tables?.forEach((table) => {
        if (table?.name) {
          candidateKeys.add(table.name);
        }
      });

      const findFilterConditions = (entrySource: any) => {
        if (
          entrySource &&
          Array.isArray(entrySource.filter_conditions) &&
          entrySource.filter_conditions.length > 0
        ) {
          return entrySource.filter_conditions;
        }
        return [];
      };

      for (const key of candidateKeys) {
        const entrySource = ruleEntry[key];
        const conditions = findFilterConditions(entrySource);
        if (conditions.length > 0) {
          return conditions.map((condition: any) => ({
            ...condition,
            sourceId: source.id || condition?.sourceId,
          }));
        }
      }

      // CRITICAL: Do NOT check top-level filter_conditions_by_source or filter_conditions
      // These are shared across all rules and would cause cross-rule contamination
      // Only use rule-specific entries from savedRulePayload.rules[activeRuleName][sourceId]
      // The top-level filter_conditions_by_source and filter_conditions are for backward compatibility
      // and should only be used when we can't find rule-specific data, but we should prioritize
      // rule-specific data from validationRulesMap (ruleStore) and columnFiltersBySource instead
      
      // Note: We skip top-level filter_conditions_by_source and filter_conditions here to ensure
      // per-rule isolation. If filters are needed, they should come from:
      // 1. ruleStore (validationRulesMap[activeRuleName][sourceId]) - already checked above
      // 2. columnFiltersBySource[rule_${activeRuleId}][sourceId] - already checked above
      // 3. filterConditionsBySource[${activeRuleId}:${sourceId}] - checked above
      
      // Top-level savedRulePayload.filter_conditions_by_source and filter_conditions
      // may contain filters from ALL rules, so we avoid them for rule-specific display

      return [];
    },
    [savedRulePayload, activeRuleName]
  );


  const buildSystemFilters = React.useCallback(
    (source: DataSource) => {
      // CRITICAL: Debug logging to ensure rule-specific filter retrieval
      console.log(`🔍 buildSystemFilters for rule: ${activeRuleName} (${activeRuleId}), source: ${source.id}`, {
        ruleStore: ruleStore ? Object.keys(ruleStore) : null,
        ruleKey: activeRuleId ? `rule_${activeRuleId}` : null,
        hasRuleStore: !!ruleStore,
      });
      
      const editorEntries: any[] = [];
      const seen = new Set<string>();

      const pushEntry = (entry: any) => {
        if (!entry) return;
        // CRITICAL: Only add entry if its sourceId matches the current source.id
        const entrySourceId = entry.sourceId;
        if (entrySourceId && entrySourceId !== source.id) {
          return; // Skip filters that don't belong to this source
        }
        // Ensure entry has the correct sourceId
        const entryWithSourceId = { ...entry, sourceId: source.id };
        // CRITICAL: Include ruleId/ruleName in fingerprint to ensure filters are unique per rule
        // This prevents cross-rule contamination when same source exists in multiple rules
        const ruleIdentifier = activeRuleId || activeRuleName || 'default';
        const fingerprint = `${ruleIdentifier}::${entryWithSourceId.sourceId}::${entryWithSourceId.filter_type || 'auto'}::${entryWithSourceId.id || entryWithSourceId.filter || ''}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        editorEntries.push(entryWithSourceId);
      };

      // CRITICAL: Only check source.id as the primary key for strict per-source isolation
      // This ensures filters from one source don't appear in another source's tab
      if (ruleStore && typeof ruleStore === 'object' && source.id) {
        // CRITICAL: Only check the source.id key (not source.name or table names)
        // This prevents cross-contamination between sources
        const entry = ruleStore[source.id];
        if (entry && typeof entry === 'object' && Array.isArray(entry.filters)) {
          entry.filters.forEach((filter: any, index: number) => {
            if (
              filter &&
              typeof filter.filter === 'string' &&
              filter.filter.trim().length > 0
            ) {
              // CRITICAL: Only include if sourceId matches the current source.id
              const filterSourceId = filter.sourceId || source.id;
              if (filterSourceId === source.id) {
                pushEntry({
                  id: filter.id || `store-filter-${source.id}-${index}`,
                  filter: filter.filter,
                  filter_type: filter.filter_type || 'auto',
                  sourceId: source.id, // Always use source.id to ensure consistency
                });
              }
            }
          });
        }

        if (entry && typeof entry === 'object' && Array.isArray(entry.filter_conditions)) {
          entry.filter_conditions.forEach((condition: any, index: number) => {
            if (
              condition &&
              typeof condition.filter === 'string' &&
              condition.filter.trim().length > 0
            ) {
              // CRITICAL: Only include if sourceId matches the current source.id
              const conditionSourceId = condition.sourceId || source.id;
              if (conditionSourceId === source.id) {
                pushEntry({
                  id: condition.id || `store-condition-${source.id}-${index}`,
                  filter: condition.filter,
                  filter_type: condition.filter_type || 'auto',
                  sourceId: source.id, // Always use source.id to ensure consistency
                });
              }
            }
          });
        }
      }

      // Get filters from validation store (columnFiltersBySource) - these are previously saved filters
      if (activeRuleId && columnFiltersBySource && typeof columnFiltersBySource === 'object') {
        const ruleKey = `rule_${activeRuleId}`;
        const ruleFilters = columnFiltersBySource[ruleKey];
        if (ruleFilters && typeof ruleFilters === 'object' && source.id) {
          const sourceFilters = ruleFilters[source.id];
          if (Array.isArray(sourceFilters) && sourceFilters.length > 0) {
            sourceFilters.forEach((filter: any, index: number) => {
              if (
                filter &&
                typeof filter.filter === 'string' &&
                filter.filter.trim().length > 0
              ) {
                const filterSourceId = filter.sourceId || source.id;
                // CRITICAL: Only include if sourceId matches the current source
                if (filterSourceId === source.id) {
                  pushEntry({
                    id: filter.id || `store-column-filter-${source.id}-${index}`,
                    filter: filter.filter,
                    filter_type: filter.filter_type || 'auto',
                    sourceId: source.id,
                  });
                }
              }
            });
          }
        }
      }

      // Get filters from store (saved payload from API) - ONLY for active rule
      // This ensures filters are rule-specific
      const storeFilters = getStoreFiltersForSource(source);
      if (Array.isArray(storeFilters) && storeFilters.length > 0) {
        // CRITICAL: Also filter by rule name to ensure per-rule isolation
        // This prevents filters from other rules with the same source from appearing
        const filteredStoreFilters = activeRuleName
          ? storeFilters.filter((filter: any) => {
              // Only include filters that belong to this rule or have no rule property (legacy)
              return filter?.rule === activeRuleName || !filter?.rule;
            })
          : storeFilters.filter((filter: any) => !filter?.rule);  // If no rule name, only include filters without rule property
        filteredStoreFilters.forEach((filter) => pushEntry(filter));
      }

      // Get filters from current state (filterConditionsBySource) - these are newly added filters
      // CRITICAL: Only use rule-specific keys when activeRuleId is present to ensure per-rule isolation
      if (activeRuleId) {
        // Use rule-specific key: "ruleId:sourceId"
        const stateKey = `${activeRuleId}:${source.id}`;
        const currentStateFilters = filterConditionsBySource[stateKey];
        
        if (Array.isArray(currentStateFilters) && currentStateFilters.length > 0) {
          currentStateFilters.forEach((condition: any, index: number) => {
            if (
              condition &&
              typeof condition.filter === 'string' &&
              condition.filter.trim().length > 0
            ) {
              const conditionSourceId = condition.sourceId || source.id;
              // CRITICAL: Only include if sourceId matches the current source
              if (conditionSourceId === source.id) {
                pushEntry({
                  id: condition.id || `state-filter-${source.id}-${index}`,
                  filter: condition.filter,
                  filter_type: condition.filter_type || 'auto',
                  sourceId: source.id, // Always use source.id to ensure consistency
                });
              }
            }
          });
        }
      } else {
        // Only use non-rule-specific fallback if no activeRuleId (backward compatibility)
        // This should rarely happen in validation node context
        const stateKey = source.id;
        const currentStateFilters = filterConditionsBySource[stateKey];
        
        if (Array.isArray(currentStateFilters) && currentStateFilters.length > 0) {
          currentStateFilters.forEach((condition: any, index: number) => {
            if (
              condition &&
              typeof condition.filter === 'string' &&
              condition.filter.trim().length > 0
            ) {
              const conditionSourceId = condition.sourceId || source.id;
              // CRITICAL: Only include if sourceId matches the current source
              if (conditionSourceId === source.id) {
                pushEntry({
                  id: condition.id || `state-filter-${source.id}-${index}`,
                  filter: condition.filter,
                  filter_type: condition.filter_type || 'auto',
                  sourceId: source.id, // Always use source.id to ensure consistency
                });
              }
            }
          });
        }
      }
      
      // CRITICAL: REMOVED fallback to filterConditionsBySource[source.id] when activeRuleId is present
      // This prevents cross-rule contamination - filters must be stored with ruleId:sourceId key

      console.log(`✅ buildSystemFilters returned ${editorEntries.length} filters for rule: ${activeRuleName} (${activeRuleId}), source: ${source.id}`, {
        filterIds: editorEntries.map(e => e.id),
      });

      return editorEntries;
    },
    // CRITICAL: Include activeRuleName to ensure rule-specific filters are retrieved correctly
    // When activeRuleName changes, ruleStore changes, which should trigger recalculation
    [filterConditionsBySource, ruleStore, getStoreFiltersForSource, activeRuleId, activeRuleName, columnFiltersBySource]
  );

  return (
    <div className="h-full overflow-hidden">
      <div className="min-h-screen bg-background p-4 h-full overflow-y-auto">
        <div className="mx-auto max-w-[1800px]">
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-600">
            <button onClick={onBack} className="hover:text-slate-900 underline">
              Back
            </button>
            <span>/</span>
            <span className="text-slate-900 font-medium">Filter Configuration</span>
          </div>

          {sourcesToShow.length > 0 ? (
            <Tabs value={selectedSourceTab} onValueChange={onSourceTabChange} className="h-[calc(100vh-120px)] flex flex-col">
              <TabsList className="mb-4">
                {sourcesToShow.map((source) => (
                  <TabsTrigger key={source.id} value={source.id}>
                    {source.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {sourcesToShow.map((source) => {
                const nodeTemplate = currentNode?.data?.node?.template || {};
                const systemFilters = buildSystemFilters(source);

                return (
                  <TabsContent key={source.id} value={source.id} className="flex-1 min-h-0 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      <MultiRowDynamicForm
                        key={`filter-form-${source.id}`}
                        template={nodeTemplate}
                        onFormChange={() => {}}
                        data={[]}
                        onClickSave={(filterType?: string, data?: any, sourceId?: string) =>
                          onFilterSave(filterType, data, source.id)
                        }
                        systemFilters={systemFilters}
                        connections={connections}
                        dataSources={dataSources}
                        connectionKeyStates={connectionKeyStates}
                        getConnectionKeyState={getConnectionKeyState}
                        onColumnSelect={onColumnSelect}
                        onFiltersChange={onFiltersChange}
                        sourceId={source.id}
                        activeRuleId={activeRuleId}
                        activeRuleName={activeRuleName}
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
};
import { useState, useCallback, useEffect } from 'react';
import { MatchRule, Connection, Source, AggregationRule, ConnectionType, SourceFilter, CustomFilter, MatchCriterion, AggregationType } from '@/types';

const parseFromRichRulesPayload = (payload: any, sources: Source[]): MatchRule[] => {
  try {
    const rulesPayload = payload.rules || [];
    const globalMatchCriteria = payload.match_criteria || {};

    const getSourceIdByName = (name: string) => sources.find(s => s.name === name)?.id || name;

    const allParsedCriteria: MatchCriterion[] = [];
    const processedPairs = new Set<string>();

    for (const source1Name in globalMatchCriteria) {
      const source1Id = getSourceIdByName(source1Name);
      const criteriaData = globalMatchCriteria[source1Name];

      if (criteriaData && Array.isArray(criteriaData.cond)) {
        criteriaData.cond.forEach((condItem: any) => {
          const source2Id = getSourceIdByName(condItem.source);

          // 🔑 Use full signature (direction + condition + matchType)
          const pairKey = `${source1Id}--${source2Id}--${condItem.match?.toUpperCase()}--${condItem.condition?.toUpperCase()}`;

          if (!processedPairs.has(pairKey)) {
            allParsedCriteria.push({
              id: `mc-loaded-${source1Id}-${source2Id}-${Date.now()}`,
              source1Id,
              source2Id,
              matchType: condItem.match?.toUpperCase(),
              condition: condItem.condition?.toUpperCase() || undefined,
            });

            processedPairs.add(pairKey);
          }
        });
      }
    }

    return rulesPayload.map((payloadRule: any): MatchRule | null => {
      const uiState = payloadRule.uiState;
      if (!uiState || !uiState.id) {
        console.warn("Skipping rule with missing or invalid uiState:", payloadRule);
        return null;
      }

      const connectionTypesMap = new Map<string, ConnectionType>();
      if (uiState.connectionTypes && typeof uiState.connectionTypes === 'object') {
        for (const [key, value] of Object.entries(uiState.connectionTypes)) {
          if (value === 'key' || value === 'validation' || value === 'aggregation') {
            connectionTypesMap.set(key, value as ConnectionType);
          }
        }
      }

      const sourceFilters: Record<string, SourceFilter> = {};
      (payloadRule.sources || []).forEach((s: any) => {
        const sourceInfo = sources.find(src => src.name === s.source);
        if (sourceInfo) {
          const customFilters: CustomFilter[] = (s.ruleFilters || []).map((filter: any, index: number) => {
            if (typeof filter === 'string') {
              return { id: `filter-${index}-${Date.now()}`, value: filter };
            }
            if (typeof filter === 'object' && filter.column && filter.operator && filter.value) {
              return { id: filter.id || `filter-${index}-${Date.now()}`, value: `${filter.column} ${filter.operator} ${filter.value}` };
            }
            return null;
          }).filter((f): f is CustomFilter => f !== null);

          sourceFilters[sourceInfo.id] = {
            dropDuplicates: s.dropDuplicates ?? false,
            duplicateColumns: s.dropDuplicatedColumns || s.columns?.duplicateColumns || [],
            customFilters: customFilters,
          };
        }
      });

      let selfMatchDebitCreditColumn: string | undefined;
      if (uiState.isSelfMatch && uiState.selfMatchSourceId) {
        const selfMatchSourceInfo = sources.find(s => s.id === uiState.selfMatchSourceId);
        if (selfMatchSourceInfo) {
          const sourcePayload = (payloadRule.sources || []).find((s: any) => s.source === selfMatchSourceInfo.name);
          if (sourcePayload && sourcePayload.columns?.debitCreditColumn?.length > 0) {
            selfMatchDebitCreditColumn = sourcePayload.columns.debitCreditColumn[0];
          }
        }
      }

      const newRule: MatchRule = {
        id: uiState.id,
        name: uiState.name,
        connections: uiState.connections || [],
        aggregationRules: uiState.aggregationRules || [],
        connectionTypes: connectionTypesMap,
        mapAndCompare: uiState.mapAndCompare ?? false,
        processAllRecords: payloadRule.process_all_records ?? uiState.processAllRecords ?? false,
        toleranceMatch: payloadRule.is_tolerance_match ?? uiState.toleranceMatch ?? false,
        toleranceValue: payloadRule.tolerance_value?.toString() ?? uiState.toleranceValue ?? '',
        bucketMatch: payloadRule.is_bucket_match ?? uiState.bucketMatch ?? false,
        bucketSourceSide: payloadRule.bucket_side?.toUpperCase() || uiState.bucketSourceSide || 'LEFT',
        matchDuplicate: payloadRule.duplicate_match ?? uiState.matchDuplicate ?? false,
        isSelfMatch: uiState.isSelfMatch ?? false,
        selfMatchSourceId: uiState.selfMatchSourceId,
        selfMatchDebitCreditColumn: selfMatchDebitCreditColumn || uiState.selfMatchDebitCreditColumn,
        sourceFilters: uiState.sourceFilters || sourceFilters,
        matchCriteria: allParsedCriteria,
        dropDuplicates: false,
        roundTo: 0
      };

      return newRule;
    }).filter((rule): rule is MatchRule => rule !== null);
  } catch (error) {
    console.error("Failed to parse rules from rich payload:", error);
    return [];
  }
};

export const useNWayValidationRules = (initialPayload: any, sources: Source[], inputSourceIds: string[]) => {

  console.log("initialPayload", initialPayload);
  const [rules, setRules] = useState<MatchRule[]>(() => {
    if (initialPayload?.rules) {
      return parseFromRichRulesPayload(initialPayload, sources);
    }
    return [];
  });

  const [activeRuleId, setActiveRuleId] = useState<string | null>(
    rules.length > 0 ? rules[0].id : null
  );

  const getDefaultSourceFilters = useCallback(() => {
    const filters: Record<string, SourceFilter> = {};
    sources.forEach(source => {
      filters[source.id] = {
        dropDuplicates: false,
        duplicateColumns: [],
        customFilters: [],
      };
    });
    return filters;
  }, [sources]);

  useEffect(() => {
    const activeRuleExists = rules.some(r => r.id === activeRuleId);
    if (!activeRuleExists && rules.length > 0) {
      setActiveRuleId(rules[0].id);
    } else if (rules.length === 0) {
      setActiveRuleId(null);
    }
  }, [rules, activeRuleId]);

  const setConnectionType = useCallback((ruleId: string, connectionId: string, type: ConnectionType) => {
    setRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const newConnectionTypes = new Map(rule.connectionTypes);
      newConnectionTypes.set(connectionId, type);
      return { ...rule, connectionTypes: newConnectionTypes };
    }));
  }, []);

  const toggleAggregation = useCallback((ruleId: string, connectionId: string) => {
    setRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const isAggregationActive = rule.aggregationRules.some(ar => ar.connectionId === connectionId);
      const newAggregationRules = isAggregationActive
        ? rule.aggregationRules.filter(ar => ar.connectionId !== connectionId)
        : [...rule.aggregationRules, {
          connectionId,
          sourceColumnAggregation: 'sum' as AggregationType,
          targetColumnAggregation: 'sum' as AggregationType,
          tolerance: ''
        }];
      return { ...rule, aggregationRules: newAggregationRules };
    }));
  }, []);

  const addRule = useCallback((name: string, isSelfMatch: boolean, selfMatchSourceId?: string, selfMatchDebitCreditColumn?: string) => {
    const newRule: MatchRule = {
      id: `rule-${Date.now()}`,
      name,
      isSelfMatch,
      selfMatchSourceId,
      selfMatchDebitCreditColumn,
      connections: [],
      connectionTypes: new Map(),
      aggregationRules: [],
      processAllRecords: false,
      toleranceMatch: false,
      toleranceValue: '',
      bucketMatch: false,
      bucketSourceSide: 'LEFT',
      matchDuplicate: false,
      mapAndCompare: false,
      sourceFilters: getDefaultSourceFilters(),
      matchCriteria: [],
      dropDuplicates: false,
      roundTo: 0
    };
    setRules(prev => {
      const newRules = [...prev, newRule];
      if (prev.length === 0) {
        setActiveRuleId(newRule.id);
      }
      return newRules;
    });
    setActiveRuleId(newRule.id);
  }, [getDefaultSourceFilters]);

  const removeRule = useCallback((ruleId: string) => {
    setRules(prevRules => prevRules.filter(r => r.id !== ruleId));
  }, []);

  const reorderRules = useCallback((reorderedRules: MatchRule[]) => {
    setRules(reorderedRules);
  }, []);

  const updateRuleSettings = useCallback((ruleId: string, settings: Partial<Omit<MatchRule, 'id' | 'connections' | 'connectionTypes' | 'aggregationRules'>>) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, ...settings } : rule
    ));
  }, []);

  const updateSourceFilter = useCallback((ruleId: string, sourceId: string, settings: Partial<SourceFilter>) => {
    setRules(prevRules => prevRules.map(rule => {
      if (rule.id !== ruleId) return rule;

      const updatedRule = { ...rule };
      const sourceFilters = updatedRule.sourceFilters || {};
      const specificFilter = sourceFilters[sourceId] || {
        dropDuplicates: false,
        duplicateColumns: [],
        customFilters: [],
      };

      sourceFilters[sourceId] = { ...specificFilter, ...settings };
      updatedRule.sourceFilters = sourceFilters;

      return updatedRule;
    }));
  }, []);

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() => {
    // Always default to all sources selected
    if (sources.length > 0) {
      return sources.map(s => s.id);
    }
    // Fallback to inputSourceIds if sources not available yet
    return inputSourceIds;
  });

  // Always ensure all sources are selected by default when sources change
  useEffect(() => {
    if (sources.length > 0) {
      const allSourceIds = sources.map(s => s.id);
      setSelectedSourceIds(prev => {
        // If no sources are currently selected, select all
        if (prev.length === 0) {
          return allSourceIds;
        }
        // Add any new sources that weren't in the previous selection
        const newSourceIds = allSourceIds.filter(id => !prev.includes(id));
        if (newSourceIds.length > 0) {
          return [...prev, ...newSourceIds];
        }
        // If sources were removed, filter them out
        const validSourceIds = prev.filter(id => allSourceIds.includes(id));
        if (validSourceIds.length !== prev.length) {
          return validSourceIds;
        }
        return prev;
      });
    } else {
      // If no sources, clear selection
      setSelectedSourceIds([]);
    }
  }, [sources]);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSourceIds(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
    setRules(prevRules => prevRules.map(rule => ({
      ...rule,
      connections: rule.connections.filter(c => c.sourceId !== sourceId && c.targetId !== sourceId),
      aggregationRules: rule.aggregationRules.filter(ar => !rule.connections.find(c => c.id === ar.connectionId && (c.sourceId === sourceId || c.targetId === sourceId)))
    })));
  }, []);

  const addConnection = useCallback((ruleId: string, connection: Connection) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId
        ? { ...rule, connections: [...rule.connections, connection] }
        : rule
    ));
  }, []);

  const removeConnection = useCallback((ruleId: string, connectionId: string) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId
        ? {
          ...rule,
          connections: rule.connections.filter(c => c.id !== connectionId),
          aggregationRules: rule.aggregationRules.filter(ar => ar.connectionId !== connectionId)
        }
        : rule
    ));
  }, []);

  const updateAggregationRule = useCallback((ruleId: string, aggRule: Partial<AggregationRule> & { connectionId: string }) => {
    setRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const existingIndex = rule.aggregationRules.findIndex(ar => ar.connectionId === aggRule.connectionId);
      const newAggregationRules = [...rule.aggregationRules];
      if (existingIndex >= 0) {
        newAggregationRules[existingIndex] = { ...newAggregationRules[existingIndex], ...aggRule };
      } else {
        const newCompleteAggRule: AggregationRule = {
          connectionId: aggRule.connectionId,
          sourceColumnAggregation: aggRule.sourceColumnAggregation ?? 'none',
          targetColumnAggregation: aggRule.targetColumnAggregation ?? 'none',
          tolerance: aggRule.tolerance ?? ''
        };
        newAggregationRules.push(newCompleteAggRule);
      }
      return { ...rule, aggregationRules: newAggregationRules };
    }));
  }, []);

  return {
    rules,
    activeRuleId,
    selectedSourceIds,
    addRule,
    removeRule,
    reorderRules,
    setActiveRuleId,
    updateRuleSettings,
    updateSourceFilter,
    toggleSource,
    addConnection,
    removeConnection,
    setConnectionType,
    updateAggregationRule,
    toggleAggregation,
    setRules, // Allow external setting of rules for AI automation
  };
};

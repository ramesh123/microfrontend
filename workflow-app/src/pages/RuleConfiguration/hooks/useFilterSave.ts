import { useState } from 'react';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import useFlowStore from '@/stores/flowStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import { mapFilterDataToPayload } from '@/utils/filterUtils';
import { sanitizeFilters } from '@/utils/utils';
import { compressPayloadData, compressDataString } from '@/utils/compressionUtils';
import api from '@/controllers/API/api';
import { getNodeOutputData } from '@/utils/nodeDataUtils';
import { useValidationStore } from '@/stores/validationStore';

export const useFilterSave = (currentNode: any, activeRuleId?: string, rules?: Array<{ id: string; name: string }>) => {
  // Store filters per rule: key format is "ruleId:sourceId" or just "sourceId" if no rule
  const [filterConditionsBySource, setFilterConditionsBySource] = useState<Record<string, any[]>>({});
  const { upsertValidationRule, validationRulesMap, columnFiltersBySource, setColumnFiltersBySource } = useValidationStore();

  // Get rule name from activeRuleId
  const getRuleName = (): string | undefined => {
    if (!activeRuleId || !rules) return undefined;
    const rule = rules.find(r => r.id === activeRuleId);
    return rule?.name;
  };

  const handleFilterSave = async (filterType?: string, data?: any, sourceId?: string) => {
    try {
      let filterData: any[] = [];
      
      if (filterType === "filter") {
        if (!data || data.length === 0) {
          toast.info("Please filter data to perform filter action");
          return;
        }
        filterData = mapFilterDataToPayload(data, filterType);
      } else if (filterType === "derive_column") {
        if (!data) {
          toast.info("Please select a Column to perform derive column action");
          return;
        }
        filterData = mapFilterDataToPayload(
          [{ filters: [{ id: data.id, custom_derived_columns: data }] }],
          filterType
        );
      } else if (filterType === "column_filter") {
        if (!data) {
          toast.info("Please configure column filters before saving");
          return;
        }
        // For column_filter, data should already have column_filters key with filter_type inside
        filterData = mapFilterDataToPayload(
          [{ filters: [data] }],
          filterType
        );
      } else if (filterType === "custom_column") {
        if (!data) {
          toast.info("Please select a transformation to perform custom column action");
          return;
        }
        filterData = mapFilterDataToPayload([{ filters: [data] }], filterType);
      } else if (filterType === "conditional_column") {
        if (!data) {
          toast.info("Please add conditional filters to perform this action");
          return;
        }
        filterData = mapFilterDataToPayload(
          [{ filters: [{ id: data.id, ...data }] }],
          filterType
        );
      }

      // Get current payload
      const previousPayload = currentNode?.data?.node?.payload || {};
      
      // Get existing filters - filter by sourceId if provided (for per-source isolation)
      let existingFilters = Array.isArray(previousPayload.filters)
        ? previousPayload.filters
        : [];
      
      // If sourceId is provided, only get filters for this source
      if (sourceId) {
        existingFilters = existingFilters.filter((filter: any) => {
          // Only include filters that match this sourceId
          return filter?.sourceId === sourceId;
        });
      }
      
      const sanitizedExisting = sanitizeFilters(existingFilters);

      // Merge filters - remove duplicates by id
      const mergedFilters = sanitizedExisting.filter(
        (existing: any) =>
          !filterData.some(
            (incoming: any) => incoming.id && incoming.id === existing.id
          )
      );
      
      // Get rule name for tagging filters
      const ruleName = getRuleName();
      
      // Tag new filter data with sourceId and rule name
      const taggedFilterData = filterData.map((filter: any) => ({
        ...filter,
        ...(sourceId && { sourceId: sourceId }),
        ...(ruleName && { rule: ruleName })
      }));
      
      // Combine existing filters for this source with new filters
      const allFiltersForSource = [...mergedFilters, ...taggedFilterData];
      
      // Get all filters from other sources (to preserve them)
      const otherSourcesFilters = sourceId && Array.isArray(previousPayload.filters)
        ? previousPayload.filters.filter((filter: any) => filter?.sourceId !== sourceId)
        : [];
      
      // Combine: filters from other sources + filters for this source
      const allFilters = [...otherSourcesFilters, ...allFiltersForSource];

      // Get dataframe from node output or upstream nodes
      let dataframeData: any = null;
      const flow_id = useFlowStore.getState().currentWorkflow?.flow_id;
      
      // Try to get dataframe from current node output first
      if (currentNode?.data?.node?.output?.data && currentNode.data.node.output.data.length > 0) {
        dataframeData = currentNode.data.node.output.data;
      } else {
        // Get dataframe from upstream nodes
        const upstreamNodes = useFlowStore.getState().getUpstreamNodes(currentNode?.id || '');
        if (upstreamNodes.length > 0 && flow_id) {
          try {
            dataframeData = await getNodeOutputData(upstreamNodes[0], flow_id);
          } catch (error) {
            console.error('Failed to get node output data:', error);
          }
        }
      }

      // Compress dataframe if available
      let compressedDataframe = '';
      if (dataframeData) {
        // Compress dataframe using gzip+base64 (same as filter node)
        const dataframeString = JSON.stringify(dataframeData);
        compressedDataframe = compressDataString(dataframeString);
      }

      // Build payload in the exact format for transformations-actions API
      // Only send filters for the current sourceId (for per-source isolation)
      const filtersForApi = sourceId 
        ? allFiltersForSource  // Only filters for this source
        : allFilters;  // All filters if no sourceId
      
      // Get existing filter_conditions for this source only
      let existingFilterConditions = Array.isArray(previousPayload.filter_conditions) 
        ? previousPayload.filter_conditions 
        : [];
      
      // If sourceId is provided, only get filter_conditions for this source
      if (sourceId) {
        existingFilterConditions = existingFilterConditions.filter((filter: any) => {
          return filter?.sourceId === sourceId;
        });
      }
      
      const payload = {
        key: "on-submit",
        records: {},
        stmtDate: new Date().toISOString().split('T')[0],
        actions: "filter_generator",
        filters: filtersForApi,
        dataframe: compressedDataframe,
        is_pandas: false,
        is_polars: true,
        data_fields: [
          {
            key: "dataframe",
            type: "node-input",
            required: true,
            display_name: "Input Datasets"
          }
        ],
        filter_conditions: existingFilterConditions,
        node_id: currentNode?.id,
        current_node_id: currentNode?.id,
        flow_id: currentNode?.data?.flow_id || useFlowStore.getState().currentWorkflow?.flow_id,
      };

      // Call transformations-actions API endpoint
      const response = await api.post('/transformations/transformations-actions', { payload });

      // The API response format: { status: true, message: "...", data: [{ id, index, filter, filter_type }], unique_id: "..." }
      // filter_conditions are in response.data.data array
      const responseData = response?.data || {};
      const generatedFilterConditions = Array.isArray(responseData.data) 
        ? responseData.data 
        : (Array.isArray(responseData.filter_conditions) 
            ? responseData.filter_conditions 
            : []);
      
      if (Array.isArray(generatedFilterConditions) && generatedFilterConditions.length > 0) {
        
        // Tag each filter condition with sourceId and rule name for per-source and per-rule isolation
        const taggedFilterConditions = generatedFilterConditions.map((filter: any) => ({
          ...filter,
          ...(sourceId && { sourceId: sourceId }),
          ...(ruleName && { rule: ruleName })
        }));

        // Also update columnFiltersBySource in validation store for this rule and source
        if (activeRuleId && sourceId && setColumnFiltersBySource) {
          const ruleKey = `rule_${activeRuleId}`;
          const currentStoreFilters = columnFiltersBySource || {};
          const currentRuleFilters = currentStoreFilters[ruleKey] || {};
          
          // Get existing filters for this source from the store
          const existingSourceFilters = Array.isArray(currentRuleFilters[sourceId]) 
            ? currentRuleFilters[sourceId] 
            : [];
          
          // Also get existing filters from payload for this source (in case they're not in store yet)
          const existingPayloadFilters = Array.isArray(previousPayload.filter_conditions)
            ? previousPayload.filter_conditions.filter((filter: any) => filter?.sourceId === sourceId)
            : [];
          
          // Combine all existing filters (from store and payload), removing duplicates
          const allExistingFilters = [...existingSourceFilters];
          existingPayloadFilters.forEach((payloadFilter: any) => {
            if (!allExistingFilters.some((existing: any) => existing.id && existing.id === payloadFilter.id)) {
              allExistingFilters.push(payloadFilter);
            }
          });
          
          // Remove duplicates by id and merge with new filters
          const mergedSourceFilters = [
            ...allExistingFilters.filter((existing: any) => 
              !taggedFilterConditions.some((newFilter: any) => 
                newFilter.id && newFilter.id === existing.id
              )
            ),
            ...taggedFilterConditions
          ];
          
          setColumnFiltersBySource({
            ...currentStoreFilters,
            [ruleKey]: {
              ...currentRuleFilters,
              [sourceId]: mergedSourceFilters,
            },
          });
        }
        
        // Get existing filter_conditions from other sources (to preserve them)
        // CRITICAL: Also filter by rule to ensure per-rule isolation
        // ruleName is already declared above, reuse it
        const otherSourcesFilterConditions = sourceId && Array.isArray(previousPayload.filter_conditions)
          ? previousPayload.filter_conditions.filter((filter: any) => {
              const matchesSource = filter?.sourceId !== sourceId;
              // CRITICAL: Also check rule property - only include filters from other sources that belong to this rule
              const matchesRule = ruleName 
                ? (filter?.rule === ruleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
                : !filter?.rule;  // If no rule name, only include filters without rule property
              return matchesSource && matchesRule;
            })
          : [];
        
        // Get existing filter_conditions for THIS source from store and payload, then merge with new ones
        let existingFilterConditionsForThisSource: any[] = [];
        
        // First, get from store (columnFiltersBySource)
        if (activeRuleId && sourceId && columnFiltersBySource) {
          const ruleKey = `rule_${activeRuleId}`;
          const ruleFilters = columnFiltersBySource[ruleKey];
          if (ruleFilters && typeof ruleFilters === 'object') {
            const storeFilters = ruleFilters[sourceId];
            if (Array.isArray(storeFilters) && storeFilters.length > 0) {
              // Check if these are filter_conditions (have 'filter' property)
              const areFilterConditions = storeFilters.some((f: any) => 
                f && typeof f === 'object' && typeof f.filter === 'string' && f.filter.trim().length > 0
              );
              if (areFilterConditions) {
                existingFilterConditionsForThisSource = [...storeFilters];
              }
            }
          }
        }
        
        // Also get from payload (in case they're not in store yet)
        // CRITICAL: Filter by both sourceId AND rule name to ensure per-rule isolation
        // ruleName is already declared above, reuse it
        if (sourceId && Array.isArray(previousPayload.filter_conditions)) {
          const payloadFiltersForThisSource = previousPayload.filter_conditions.filter((filter: any) => {
            const matchesSource = filter?.sourceId === sourceId;
            // CRITICAL: Also check rule property to ensure filters belong to this rule
            // If rule property exists, it must match; if it doesn't exist, we only include if no rule name is set
            const matchesRule = ruleName 
              ? (filter?.rule === ruleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
              : !filter?.rule;  // If no rule name, only include filters without rule property
            return matchesSource && matchesRule;
          });
          // Merge with store filters, removing duplicates by id
          payloadFiltersForThisSource.forEach((payloadFilter: any) => {
            if (!existingFilterConditionsForThisSource.some((existing: any) => 
              existing.id && existing.id === payloadFilter.id
            )) {
              existingFilterConditionsForThisSource.push(payloadFilter);
            }
          });
        }
        
        // Merge existing filter_conditions for this source with new ones, removing duplicates by id
        const mergedFilterConditionsForThisSource = [
          ...existingFilterConditionsForThisSource.filter((existing: any) =>
            !taggedFilterConditions.some(
              (newFilter: any) => newFilter.id && newFilter.id === existing.id
            )
          ),
          ...taggedFilterConditions,
        ];

        if (ruleName && sourceId) {
          const existingRule = validationRulesMap?.[ruleName] || {};
          const existingSourceEntry = existingRule[sourceId] || {};
          upsertValidationRule(ruleName, {
            [sourceId]: {
              ...existingSourceEntry,
              filters: allFiltersForSource,
              filter_conditions: mergedFilterConditionsForThisSource,
            },
          });
        }

        // Combine: filter_conditions from other sources + merged filter_conditions for this source
        // CRITICAL: Preserve ALL filters from other rules, not just from the current rule
        // When combining, we need to:
        // 1. Keep all filters from OTHER rules (different rule name)
        // 2. Keep filters from OTHER sources within the current rule (otherSourcesFilterConditions)
        // 3. Add/update filters for the current source+rule combination (mergedFilterConditionsForThisSource)
        const filtersFromOtherRules = ruleName && Array.isArray(previousPayload.filter_conditions)
          ? previousPayload.filter_conditions.filter((filter: any) => {
              // Only include filters that belong to OTHER rules (have a different rule property)
              return filter?.rule && filter?.rule !== ruleName;
            })
          : [];
        
        const allFilterConditions = [
          ...filtersFromOtherRules,  // Preserve filters from other rules
          ...otherSourcesFilterConditions,  // Filters from other sources in current rule
          ...mergedFilterConditionsForThisSource  // Current source filters for current rule
        ];
        
        // Update local node data - preserve ALL existing payload keys
        const updatedPayload = {
          ...previousPayload,  // Preserve all existing keys (datasets, field_rules, rule_configuration, etc.)
          filters: allFilters,  // All filters (from all sources)
          filter_conditions: allFilterConditions,  // All filter_conditions (from all sources AND all rules)
        };

        // Store filter_conditions_by_source in payload for per-source isolation
        if (sourceId) {
          updatedPayload.filter_conditions_by_source = {
            ...(previousPayload.filter_conditions_by_source || {}),
            [sourceId]: mergedFilterConditionsForThisSource  // Merged filter_conditions for this source (existing + new)
          };
        }

        currentNode.data.node.payload = updatedPayload;
        useFlowStore.getState().updateNodeData(currentNode.id, currentNode.data);
        
        // Update local state to trigger CodeEditor refresh for this source
        // CRITICAL: Store filters per rule using "ruleId:sourceId" as key ONLY
        // Do NOT store by sourceId alone to prevent cross-rule contamination
        if (sourceId && activeRuleId) {
          const stateKey = `${activeRuleId}:${sourceId}`;
          setFilterConditionsBySource(prev => ({
            ...prev,
            [stateKey]: mergedFilterConditionsForThisSource,  // Use merged filter conditions (existing + new)
            // REMOVED: [sourceId]: mergedFilterConditionsForThisSource
            // Do not store by sourceId alone to ensure per-rule isolation
          }));
        } else if (sourceId) {
          // Only use sourceId key if no activeRuleId (should rarely happen in validation context)
          setFilterConditionsBySource(prev => ({
            ...prev,
            [sourceId]: mergedFilterConditionsForThisSource  // Use merged filter conditions (existing + new)
          }));
        }
        
        toast.success("Filter generated successfully");
      } else {
        // Even if no filter code was generated, still save the filters to preserve them
        // Get existing filter_conditions from other sources (to preserve them)
        // CRITICAL: Also filter by rule to ensure per-rule isolation
        // ruleName is already declared above, reuse it
        const otherSourcesFilterConditions = sourceId && Array.isArray(previousPayload.filter_conditions)
          ? previousPayload.filter_conditions.filter((filter: any) => {
              const matchesSource = filter?.sourceId !== sourceId;
              // CRITICAL: Also check rule property - only include filters from other sources that belong to this rule
              const matchesRule = ruleName 
                ? (filter?.rule === ruleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
                : !filter?.rule;  // If no rule name, only include filters without rule property
              return matchesSource && matchesRule;
            })
          : [];
        
        // Get existing filter_conditions for THIS source from store and payload
        let existingFilterConditionsForThisSource: any[] = [];
        
        // First, get from store (columnFiltersBySource)
        if (activeRuleId && sourceId && columnFiltersBySource) {
          const ruleKey = `rule_${activeRuleId}`;
          const ruleFilters = columnFiltersBySource[ruleKey];
          if (ruleFilters && typeof ruleFilters === 'object') {
            const storeFilters = ruleFilters[sourceId];
            if (Array.isArray(storeFilters) && storeFilters.length > 0) {
              // Check if these are filter_conditions (have 'filter' property)
              const areFilterConditions = storeFilters.some((f: any) => 
                f && typeof f === 'object' && typeof f.filter === 'string' && f.filter.trim().length > 0
              );
              if (areFilterConditions) {
                existingFilterConditionsForThisSource = [...storeFilters];
              }
            }
          }
        }
        
        // Also get from payload (in case they're not in store yet)
        // CRITICAL: Filter by both sourceId AND rule name to ensure per-rule isolation
        // ruleName is already declared above, reuse it
        if (sourceId && Array.isArray(previousPayload.filter_conditions)) {
          const payloadFiltersForThisSource = previousPayload.filter_conditions.filter((filter: any) => {
            const matchesSource = filter?.sourceId === sourceId;
            // CRITICAL: Also check rule property to ensure filters belong to this rule
            // If rule property exists, it must match; if it doesn't exist, we only include if no rule name is set
            const matchesRule = ruleName 
              ? (filter?.rule === ruleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
              : !filter?.rule;  // If no rule name, only include filters without rule property
            return matchesSource && matchesRule;
          });
          // Merge with store filters, removing duplicates by id
          payloadFiltersForThisSource.forEach((payloadFilter: any) => {
            if (!existingFilterConditionsForThisSource.some((existing: any) => 
              existing.id && existing.id === payloadFilter.id
            )) {
              existingFilterConditionsForThisSource.push(payloadFilter);
            }
          });
        }
        
        // Combine: filter_conditions from other sources + existing filter_conditions for this source
        // CRITICAL: Preserve ALL filters from other rules, not just from the current rule
        // When combining, we need to:
        // 1. Keep all filters from OTHER rules (different rule name)
        // 2. Keep filters from OTHER sources within the current rule (otherSourcesFilterConditions)
        // 3. Keep filters for the current source+rule combination (existingFilterConditionsForThisSource)
        const filtersFromOtherRules = ruleName && Array.isArray(previousPayload.filter_conditions)
          ? previousPayload.filter_conditions.filter((filter: any) => {
              // Only include filters that belong to OTHER rules (have a different rule property)
              return filter?.rule && filter?.rule !== ruleName;
            })
          : [];
        
        const allFilterConditions = [
          ...filtersFromOtherRules,  // Preserve filters from other rules
          ...otherSourcesFilterConditions,  // Filters from other sources in current rule
          ...existingFilterConditionsForThisSource  // Current source filters for current rule
        ];
        
        // Update local node data - preserve ALL existing payload keys
        const updatedPayload = {
          ...previousPayload,  // Preserve all existing keys (datasets, field_rules, rule_configuration, etc.)
          filters: allFilters,  // All filters (from all sources)
          filter_conditions: allFilterConditions,  // All filter_conditions (from all sources AND all rules)
        };

        // Preserve filter_conditions_by_source if it exists, and update for this source
        if (sourceId) {
          updatedPayload.filter_conditions_by_source = {
            ...(previousPayload.filter_conditions_by_source || {}),
            [sourceId]: existingFilterConditionsForThisSource  // Existing filter_conditions for this source
          };
        } else if (previousPayload.filter_conditions_by_source) {
          updatedPayload.filter_conditions_by_source = previousPayload.filter_conditions_by_source;
        }

        currentNode.data.node.payload = updatedPayload;
        useFlowStore.getState().updateNodeData(currentNode.id, currentNode.data);

        if (ruleName && sourceId) {
          const existingRule = validationRulesMap?.[ruleName] || {};
          const existingSourceEntry = existingRule[sourceId] || {};
          upsertValidationRule(ruleName, {
            [sourceId]: {
              ...existingSourceEntry,
              filters: allFiltersForSource,
              filter_conditions: existingFilterConditionsForThisSource,  // Use existing filter conditions for this source
            },
          });
        }

        // Also update columnFiltersBySource in validation store for this rule and source
        // Even if no filter code was generated, we still want to preserve the filters
        if (activeRuleId && sourceId && setColumnFiltersBySource) {
          const ruleKey = `rule_${activeRuleId}`;
          const currentStoreFilters = columnFiltersBySource || {};
          const currentRuleFilters = currentStoreFilters[ruleKey] || {};
          
          // Get existing filter conditions for this source (filter by sourceId)
          const existingSourceFilterConditions = Array.isArray(existingFilterConditions)
            ? existingFilterConditions.filter((filter: any) => filter?.sourceId === sourceId)
            : [];
          
          // Merge existing filters for this source with any new ones
          const existingSourceFilters = Array.isArray(currentRuleFilters[sourceId]) 
            ? currentRuleFilters[sourceId] 
            : [];
          
          // Remove duplicates by id and merge
          const mergedSourceFilters = [
            ...existingSourceFilters.filter((existing: any) => 
              !existingSourceFilterConditions.some((newFilter: any) => 
                newFilter.id && newFilter.id === existing.id
              )
            ),
            ...existingSourceFilterConditions
          ];
          
          setColumnFiltersBySource({
            ...currentStoreFilters,
            [ruleKey]: {
              ...currentRuleFilters,
              [sourceId]: mergedSourceFilters,
            },
          });
        }
        
        toast.success(`${filterType || 'Filter'} configuration saved, but no filter code was generated`);
      }
    } catch (error) {
      console.error('Failed to save filter:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, `Failed to save ${filterType || 'filter'} configuration`));
      }
    }
  };

  return {
    handleFilterSave,
    filterConditionsBySource,
    setFilterConditionsBySource,
  };
};


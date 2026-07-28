import { useMemo, useState, useCallback } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import useFlowStore from '@/stores/flowStore';
import useSourceNodes from '@/hooks/use-source-nodes';
import { Source, Column, FlowNode as IFlowNode, MatchRule, MatchCriterion, AggregationType } from '@/types';

const isAggregatedColumnType = (aggType?: AggregationType) =>
  !!aggType && aggType !== 'none' && aggType !== 'equal';
import { ManageRulesHeader } from './components/ManageRulesHeader';
import { AddRuleDialog } from './components/AddRuleDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { saveNodeDetailsApi } from '@/controllers/API';
import { OrderRulesDialog } from './OrderRulesDialog';
import { ColumnMappingComponent } from './components/column-mapping-component';
import { useNWayValidationRules } from '@/hooks/useNWayMatchingRules';
import { MatchCriteriaDialog } from './components/MatchCriteriaDialog';
import { RuleFiltersDialog } from './components/RuleFiltersDialog';
import type { TableContext } from '@/components/common/FilterOperations/aiPredicateApi';
import { NwayMatchAiPanel } from './NwayMatchAiPanel';
import { NwayMatchAiChatDialog } from './NwayMatchAiChatDialog';
import type { SuccessResponse as NwayMatchSuccessResponse } from './nwayMatchRequestApi';
import { convertAiNwayMatchResponseToUiFormat } from './aiResponseConverter';


function NWayMatching(mode?: { mode?: 'view' | 'edit' }) {
  // const { nodes, currentNodeId, setNodes: setFlowNodes } = useFlowStore(
  //   useShallow((state) => ({
  //     nodes: state.nodes,
  //     currentNodeId: state.current_node_id,
  //     setNodes: state.setNodes,
  //   }))
  // );
  const currentNode = useFlowStore((state) => state.getSelectedNode());
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const edges = useFlowStore((state) => state.currentWorkflow?.data?.edges);

  const [isAddRuleDialogOpen, setAddRuleDialogOpen] = useState(false);
  const [isOrderDialogOpen, setOrderDialogOpen] = useState(false);
  const [isMatchCriteriaOpen, setMatchCriteriaOpen] = useState(false);
  const [isRuleFiltersOpen, setIsRuleFiltersOpen] = useState(false);
  const [isRuleFiltersDialogOpen, setIsRuleFiltersDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAiChatDialog, setShowAiChatDialog] = useState(false);
  const [chatDialogInitialData, setChatDialogInitialData] = useState<{
    question?: string;
    options?: { [key: string]: any };
    missingFields?: Array<{ rule_id: string; match_id: string; field: string }>;
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }>({});

  // Subscribe to workflow graph so upstream outputs refresh after execution (not only when selection changes).
  const { sourceNodes } = useSourceNodes(currentNode?.id);

  /** Immediate parents only (direct edges into this node), not the full upstream chain. */
  const directParentIds = useMemo(() => {
    if (!currentNode?.id) return new Set<string>();
    return new Set(
      (edges ?? [])
        .filter((e) => e.target === currentNode.id)
        .map((e) => e.source)
    );
  }, [currentNode?.id, edges]);

  const connectedSourceNodes = useMemo(
    () => sourceNodes.filter((n) => directParentIds.has(n.id)),
    [sourceNodes, directParentIds]
  );

  // Upstream row data is hydrated by sheet-component when the node sheet opens (config tab).
  const allSources = useMemo<Source[]>(() => {
    return (connectedSourceNodes as IFlowNode[]).map((node: IFlowNode, index: number) => {
      const output = node.data?.node?.output;
      const data = Array.isArray(output?.data) ? output.data : [];
      let colNames = Array.isArray(output?.columns) ? output.columns : [];
      if (!colNames.length && data.length > 0 && data[0] && typeof data[0] === 'object') {
        colNames = Object.keys(data[0]);
      }
      const columns: Column[] = colNames.map((colName: string) => ({
        id: colName,
        name: colName,
        type: 'string',
        sourceId: node.id,
      }));

      return {
        id: node.id,
        name: node.data.node?.payload?.table || node.data.display_name || node.id,
        tag: node.data.node?.payload?.tag || `tag${index + 1}`,
        selected: true,
        data,
        columns,
      };
    });
  }, [connectedSourceNodes]);

  const {
    rules, activeRuleId,
    addRule, removeRule, reorderRules, setActiveRuleId, updateRuleSettings,
    updateSourceFilter,
    toggleSource, addConnection, removeConnection, setConnectionType, updateAggregationRule,
    toggleAggregation,
    selectedSourceIds,
    setRules
  } = useNWayValidationRules(
    currentNode?.data?.node?.payload,
    allSources,
    connectedSourceNodes.map((s) => s.id)
  );

  const activeRule = useMemo(() => rules.find(r => r.id === activeRuleId), [rules, activeRuleId]);
  console.log("Active Rule", activeRule);

  const sourcesForActiveRule = useMemo(() => {
    if (activeRule?.isSelfMatch && activeRule.selfMatchSourceId) {
      return allSources.filter(s => s.id === activeRule.selfMatchSourceId);
    }
    return allSources.filter(s => s.id !== currentNode?.id);
  }, [activeRule, allSources, currentNode]);

  // Get table context for AI panel
  const getTableContext = useCallback((): TableContext | undefined => {
    // Helper function to detect data type
    const detectType = (value: any): string => {
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
    };

    if (allSources.length === 0) return undefined;

    const firstSource = allSources[0];
    const data = firstSource.data || [];
    if (!Array.isArray(data) || data.length === 0) return undefined;

    let columns = (firstSource.columns || []).map((c) => c.name);
    if (columns.length === 0 && data[0] && typeof data[0] === 'object') {
      columns = Object.keys(data[0]);
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
  }, [allSources]);

  // AI Panel handlers
  const handleAiApply = useCallback(async (filter: string) => {
    // For nway matching, add the filter to the active rule's source filters as a custom filter
    if (activeRule && sourcesForActiveRule.length > 0) {
      // Add filter to the first source's custom filters
      const firstSourceId = sourcesForActiveRule[0].id;
      const sourceFilter = activeRule.sourceFilters?.[firstSourceId] || { dropDuplicates: false, duplicateColumns: [], customFilters: [] };
      
      const newFilter = {
        id: `ai-filter-${Date.now()}`,
        value: filter
      };
      
      updateSourceFilter(activeRule.id, firstSourceId, {
        ...sourceFilter,
        customFilters: [...sourceFilter.customFilters, newFilter]
      });
      
      toast.success("AI-generated filter added successfully");
      setShowAiPanel(false);
    } else {
      toast.info("Please select a rule and ensure sources are available");
    }
  }, [activeRule, sourcesForActiveRule, updateSourceFilter]);

  const handleAiDiscard = useCallback(() => {
    setShowAiPanel(false);
  }, []);

  const handleOpenChatDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => {
    setChatDialogInitialData(initialData);
    setShowAiChatDialog(true);
    setShowAiPanel(false); // Close the horizontal panel
  }, []);

  const handleAiChatCodeGenerated = useCallback(async (code: string) => {
    // Add the AI-generated filter from chat dialog as a custom filter
    if (activeRule && sourcesForActiveRule.length > 0) {
      const firstSourceId = sourcesForActiveRule[0].id;
      const sourceFilter = activeRule.sourceFilters?.[firstSourceId] || { dropDuplicates: false, duplicateColumns: [], customFilters: [] };

      const newFilter = {
        id: `ai-chat-filter-${Date.now()}`,
        value: code
      };

      updateSourceFilter(activeRule.id, firstSourceId, {
        ...sourceFilter,
        customFilters: [...sourceFilter.customFilters, newFilter]
      });

      toast.success("AI-generated filter added successfully");
      // Keep chat dialog open for further interactions
    } else {
      toast.info("Please select a rule and ensure sources are available");
    }
  }, [activeRule, sourcesForActiveRule, updateSourceFilter]);

  // N-way Match AI handlers
  const handleNwayMatchAiApply = useCallback((result: NwayMatchSuccessResponse) => {
    console.log('[NWAY APPLY] handleNwayMatchAiApply called');
    console.log('[NWAY APPLY] Result:', result);
    console.log('[NWAY APPLY] allSources:', allSources);
    console.log('[NWAY APPLY] allSources length:', allSources.length);

    try {
      // Convert the AI response to UI format
      console.log('[NWAY APPLY] Calling convertAiNwayMatchResponseToUiFormat');
      const { rules: convertedRules } = convertAiNwayMatchResponseToUiFormat(result, allSources);
      console.log('[NWAY APPLY] Converted rules:', convertedRules);
      console.log('[NWAY APPLY] Converted rules length:', convertedRules.length);

      if (convertedRules.length === 0) {
        console.error('[NWAY APPLY] No rules converted!');
        toast.error('Failed to parse AI-generated configuration');
        return;
      }

      // Apply the converted rules to the UI using setRules
      console.log('[NWAY APPLY] Calling setRules with convertedRules');
      setRules(convertedRules);

      // Set the first rule as active
      if (convertedRules.length > 0) {
        console.log('[NWAY APPLY] Setting active rule to:', convertedRules[0].id);
        setActiveRuleId(convertedRules[0].id);
      }

      toast.success(`Applied ${convertedRules.length} rule(s) from AI configuration`);
      setShowAiPanel(false);

      console.log('[NWAY APPLY] Successfully applied rules:', convertedRules);
    } catch (error) {
      console.error('[NWAY APPLY] Error applying AI configuration:', error);
      toast.error('Failed to apply AI-generated configuration');
    }
  }, [allSources, setRules, setActiveRuleId]);

  const handleNwayMatchAiDiscard = useCallback(() => {
    setShowAiPanel(false);
  }, []);

  const handleOpenNwayMatchChatDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: any };
    missingFields: Array<{ rule_id: string; match_id: string; field: string }>;
    conversationId: string;
    eventId: string;
    userRequest: string;
  }) => {
    setChatDialogInitialData({
      question: initialData.question,
      options: initialData.options,
      missingFields: initialData.missingFields,
      conversationId: initialData.conversationId,
      eventId: initialData.eventId,
      userRequest: initialData.userRequest
    });
    setShowAiChatDialog(true);
    setShowAiPanel(false);
  }, []);

  const handleNwayMatchClarificationSuccess = useCallback((result: NwayMatchSuccessResponse) => {
    console.log('[NWAY CLARIFICATION SUCCESS] handleNwayMatchClarificationSuccess called');
    console.log('[NWAY CLARIFICATION SUCCESS] Result:', result);
    handleNwayMatchAiApply(result);
    console.log('[NWAY CLARIFICATION SUCCESS] Closing chat dialog');
    setShowAiChatDialog(false);
    setChatDialogInitialData({});
    console.log('[NWAY CLARIFICATION SUCCESS] Done');
  }, [handleNwayMatchAiApply]);

  const buildPayload = useCallback(() => {
    if (!currentNode) return null;

    const flowId =
      useFlowStore.getState().currentWorkflow?.flow_id || currentNode.data.flow_id;

    const findColumnDetails = (sourceId: string, columnId: string): { source: Source; column: Column } | undefined => {
      const baseSourceId = sourceId.replace('_right', '');
      const source = allSources.find(s => s.id === baseSourceId);
      if (!source) return undefined;
      const column = source.columns.find(c => c.id === columnId);
      return source && column ? { source, column } : undefined;
    };

    // Match execute-time wiring: source name → upstream node id (not row data).
    const records: { [key: string]: string } = {};
    const upstreamNodes = useFlowStore.getState().getUpstreamNodes(currentNode.id);
    for (const upstream of upstreamNodes) {
      const sourceName =
        (upstream.data as any)?.node?.payload?.table ||
        (upstream.data as any)?.display_name ||
        upstream.id;
      records[sourceName] = upstream.id;
    }
    if (Object.keys(records).length === 0) {
      allSources
        .filter((s) => s.id !== currentNode.id)
        .forEach((source) => {
          records[source.name] = source.id;
        });
    }

    const getSourceNameById = (id: string) => allSources.find(s => s.id === id)?.name || id;
    const globalMatchCriteria: Record<string, { cond: any[], filters: any[] }> = {};

    rules.forEach(rule => {
      rule.matchCriteria.forEach(criterion => {
        const source1Name = getSourceNameById(criterion.source1Id);
        const source2Name = getSourceNameById(criterion.source2Id);
        const condition = criterion.condition ? criterion.condition.toLowerCase() : "";
        const matchType = criterion.matchType.toLowerCase();

        if (!globalMatchCriteria[source1Name]) {
          globalMatchCriteria[source1Name] = { cond: [], filters: [] };
        }
        if (!globalMatchCriteria[source1Name].cond.some(c => c.source === source2Name)) {
          globalMatchCriteria[source1Name].cond.push({
            match: matchType,
            source: source2Name,
            condition: condition,
          });
        }
      });
    });

    const rulePayloads = rules.map((rule: MatchRule) => {
      const sourceConfigs = new Map<string, { aggregatedColumns: Set<string>, remainingColumns: Set<string>, debitCreditColumn: string[] }>();

      const ensureSourceConfig = (sourceId: string) => {
        const baseSourceId = sourceId.replace('_right', '');
        if (!sourceConfigs.has(baseSourceId)) {
          sourceConfigs.set(baseSourceId, {
            aggregatedColumns: new Set(),
            remainingColumns: new Set(),
            debitCreditColumn: [],
          });
        }
        return sourceConfigs.get(baseSourceId)!;
      };

      rule.connections.forEach(conn => {
        const aggregationRule = rule.aggregationRules.find(ar => ar.connectionId === conn.id);

        const sourceDetails = findColumnDetails(conn.sourceId, conn.sourceColumn);
        const targetDetails = findColumnDetails(conn.targetId, conn.targetColumn);

        if (sourceDetails) {
          const config = ensureSourceConfig(conn.sourceId);
          const aggType = aggregationRule?.sourceColumnAggregation;
          if (aggregationRule && isAggregatedColumnType(aggType)) {
            config.aggregatedColumns.add(sourceDetails.column.name);
          } else {
            config.remainingColumns.add(sourceDetails.column.name);
          }
        }

        if (targetDetails) {
          const config = ensureSourceConfig(conn.targetId);
          const aggType = aggregationRule?.targetColumnAggregation;
          if (aggregationRule && isAggregatedColumnType(aggType)) {
            config.aggregatedColumns.add(targetDetails.column.name);
          } else {
            config.remainingColumns.add(targetDetails.column.name);
          }
        }
      });

      if (rule.isSelfMatch && rule.selfMatchSourceId && rule.selfMatchDebitCreditColumn) {
        const config = ensureSourceConfig(rule.selfMatchSourceId);
        config.debitCreditColumn.push(rule.selfMatchDebitCreditColumn);
      }

      const formattedSources = Array.from(sourceConfigs.entries()).map(([sourceId, config]) => {
        const sourceInfo = allSources.find(s => s.id === sourceId);
        const sourceFilter = rule.sourceFilters[sourceId];

        const hasAggregation = config.aggregatedColumns.size > 0;

        const sourcePayload: any = {
          source: sourceInfo?.name || sourceId,
          columns: {
            sumColumns: hasAggregation ? Array.from(config.remainingColumns) : [],
            matchColumns: hasAggregation
              ? Array.from(config.aggregatedColumns)
              : Array.from(config.remainingColumns),
            debitCreditColumn: Array.from(config.debitCreditColumn),
          },
          ruleFilters: sourceFilter?.customFilters.map(f => f.value).filter(v => v) || [],
          dropDuplicates: sourceFilter?.dropDuplicates || false,
        };

        if (sourceInfo?.tag) {
          sourcePayload.sourceTag = sourceInfo.tag;
        }

        if (sourcePayload.dropDuplicates) {
          sourcePayload.dropDuplicatedColumns = sourceFilter?.duplicateColumns || [];
        }

        return sourcePayload;
      });

      const ruleSpecificPayload: any = {  
        records,
        custom_filters: null,
        output_format: "json",
        is_polars: false,
        is_pandas: false,
        response_type: "json",
        key: "on-submit",
        ruleName: rule.name,
        sources: formattedSources,
        process_all_records: rule.processAllRecords,
        is_tolerance_match: rule.toleranceMatch,
        is_bucket_match: rule.bucketMatch,
        bucket_side: rule.bucketSourceSide ? rule.bucketSourceSide.toLowerCase() : null,
        duplicate_match: rule.matchDuplicate,
        tolerance_value: rule.toleranceValue ? parseFloat(rule.toleranceValue) : 0,
        node_id: currentNode.id,
        flow_id: flowId,
        uiState: {
          ...rule,
          matchCriteria: rule.matchCriteria,
          connectionTypes: Object.fromEntries(rule.connectionTypes),
        }
      };

      if (rule.isSelfMatch) {
        ruleSpecificPayload.self_match = true;
      }

      if (rule.bucketMatch) {
        ruleSpecificPayload.bucket_side = rule.bucketSourceSide ? rule.bucketSourceSide.toLowerCase() : null;
      }

      return ruleSpecificPayload;
    });

    const finalData = JSON.parse(JSON.stringify(currentNode.data));
    console.log("Global Match Criteria:", globalMatchCriteria);
    finalData.node.payload = {
      actions: "nway_match_rule_wise",
      actions_write: "write_data",
      rules: rulePayloads,
      match_criteria: globalMatchCriteria,
    };
    
    finalData.current_node_id = currentNode.id;
    finalData.flow_id = flowId;

    return finalData;
  }, [allSources, rules, currentNode]);

  const handleSave = async () => {
    const saveEndpointConfig = currentNode?.data?.node?.save_node;
    if (!saveEndpointConfig?.module || !saveEndpointConfig?.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }

    setIsLoading(true);
    try {
      const nodePayload = buildPayload();
      console.log("Node Payload", nodePayload);
      
      // if (!nodePayload) throw new Error("Could not build payload.");

      // const updatedNodesForStore = nodes.map((node) =>
      //   node.id === currentNode?.id ? { ...node, data: nodePayload } : node
      // );
      // setFlowNodes(updatedNodesForStore);
      // useFlowStore.getState().updateNodeData(currentNode?.id, nodePayload);

      const apiPayload = nodePayload;

      // console.log("Final API Payload:", JSON.stringify(apiPayload, null, 2));

      const response = await saveNodeDetailsApi(saveEndpointConfig, apiPayload);

      const flowId =
        useFlowStore.getState().currentWorkflow?.flow_id || currentNode.data.flow_id;
      const updatedData = {
        ...response,
        flow_id: response?.flow_id ?? flowId,
        saved_node: true,
        node: response?.node
          ? {
              ...response.node,
              payload: nodePayload?.node?.payload ?? response.node.payload,
            }
          : response?.node,
      };

      console.log("Updated Node After API:", updatedData);
      useFlowStore.getState().updateNodeData(currentNode?.id, updatedData);

      toast.success("Configuration saved successfully!");
    } catch (error) {
      const errorMessage = getDisplayErrorMessage(error, 'An unknown error occurred.');
      toast.error(`Failed to save configuration: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentNode) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-foreground">No Data Validation Node Found</h3>
          <p className="text-sm text-muted-foreground max-w-md">Please select a "Data Validation" node in the flow to configure it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
      <ManageRulesHeader
        onAddRule={() => setAddRuleDialogOpen(true)}
        onOrderRule={() => setOrderDialogOpen(true)}
        onOpenMatchCriteria={() => setMatchCriteriaOpen(true)}
        onOpenRuleFilters={() => setIsRuleFiltersDialogOpen(true)}
        onToggleRuleFilters={() => setIsRuleFiltersOpen(!isRuleFiltersOpen)}
        isRuleFiltersOpen={isRuleFiltersOpen}
        onSave={handleSave}
        isSaving={isLoading}
        mode={mode?.mode}
        onOpenAiChat={() => setShowAiChatDialog(true)}
        onToggleAiPanel={() => setShowAiPanel(!showAiPanel)}
      />

      {/* N-way Match AI Panel - Below ManageRulesHeader */}
      {showAiPanel && allSources.length >= 2 && (
        <div className="flex-shrink-0">
          <NwayMatchAiPanel
            onApply={handleNwayMatchAiApply}
            onDiscard={handleNwayMatchAiDiscard}
            sources={allSources}
            onOpenChatDialog={handleOpenNwayMatchChatDialog}
          />
        </div>
      )}

      <Tabs value={activeRuleId || ""} onValueChange={setActiveRuleId} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="m-2 flex-shrink-0 overflow-hidden">
          <div className={`overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
            rules.length > 7 ? '' : 'overflow-x-hidden'
          }`}>
            <TabsList className="inline-flex w-max">
              {rules.map(rule => (
                <TabsTrigger 
                  key={rule.id} 
                  value={rule.id} 
                  className="relative group whitespace-nowrap flex-shrink-0 min-w-[120px] max-w-[200px]"
                >
                  <span className="truncate block">{rule.name}</span>
                  <span
                    role="button"
                    aria-label={`Remove rule ${rule.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeRule(rule.id);
                    }}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity z-10"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {rules.map(rule => (
          <TabsContent key={rule.id} value={rule.id} className="flex-1 min-h-0 -mt-2">
            {activeRuleId === rule.id && activeRule && (
              <ColumnMappingComponent
                rule={activeRule}
                sources={sourcesForActiveRule}
                selectedSourceIds={selectedSourceIds}
                onToggleSource={toggleSource}
                onAddConnection={(connection) => addConnection(rule.id, connection)}
                onRemoveConnection={(connectionId) => removeConnection(rule.id, connectionId)}
                onSetConnectionType={(connectionId, type) => setConnectionType(rule.id, connectionId, type)}
                onUpdateAggregationRule={(aggRule) => updateAggregationRule(rule.id, aggRule)}
                onUpdateRuleSettings={(settings) => updateRuleSettings(rule.id, settings)}
                onUpdateSourceFilter={(sourceId, settings) => updateSourceFilter(rule.id, sourceId, settings)}
                onToggleAggregation={(connectionId) => toggleAggregation(rule.id, connectionId)}
                isRuleFiltersOpen={isRuleFiltersOpen}
              />
            )}
          </TabsContent>
        ))}
        {rules.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No Matching Rules</p>
              <p className="text-sm">Click "Add Match Rule" to get started.</p>
            </div>
          </div>
        )}
      </Tabs>

      <AddRuleDialog
        open={isAddRuleDialogOpen}
        onOpenChange={setAddRuleDialogOpen}
        onAddRule={addRule}
        sources={allSources}
      />

      <OrderRulesDialog
        open={isOrderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        rules={rules}
        onSaveOrder={reorderRules}
      />

      {activeRule && (
        <MatchCriteriaDialog
          open={isMatchCriteriaOpen}
          onOpenChange={setMatchCriteriaOpen}
          sources={sourcesForActiveRule}
          rule={activeRule}
          onSave={(criteria: MatchCriterion[]) => {
            updateRuleSettings(activeRule.id, { matchCriteria: criteria });
          }}
        />
      )}

      {activeRule && (
        <RuleFiltersDialog
          open={isRuleFiltersDialogOpen}
          onOpenChange={setIsRuleFiltersDialogOpen}
          sources={sourcesForActiveRule}
          selectedSourceIds={selectedSourceIds}
          rule={activeRule}
          onUpdateSourceFilter={(sourceId, settings) => updateSourceFilter(activeRule.id, sourceId, settings)}
        />
      )}

      {/* N-way Match AI Chat Dialog */}
      <NwayMatchAiChatDialog
        isOpen={showAiChatDialog}
        onClose={() => {
          setShowAiChatDialog(false);
          setChatDialogInitialData({});
        }}
        onSuccess={handleNwayMatchClarificationSuccess}
        sources={allSources}
        sourceNodes={connectedSourceNodes}
        initialQuestion={chatDialogInitialData.question}
        initialOptions={chatDialogInitialData.options}
        initialMissingFields={chatDialogInitialData.missingFields}
        initialConversationId={chatDialogInitialData.conversationId}
        initialEventId={chatDialogInitialData.eventId}
        initialUserRequest={chatDialogInitialData.userRequest}
      />
    </div>
  );
}

export default NWayMatching;

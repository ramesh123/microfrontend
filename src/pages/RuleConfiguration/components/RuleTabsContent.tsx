import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { ConnectionsPage } from '../ConnectionsPage';
import { FilterNodeView } from './FilterNodeView';
import { FiltersPageView } from './FiltersPageView';
import { DefaultRuleView } from './DefaultRuleView';
import { DataSource } from '../types/mapping';
import { RuleViewState } from '../hooks/useRuleManagement';

interface RuleTabsContentProps {
  rule: { id: string; name: string; connections: any[] };
  activeRuleId: string | null;
  ruleViewState: RuleViewState;
  onSetRuleViewState: (updates: Partial<RuleViewState>) => void;
  activeRuleConnections: any[];
  connectionKeyStates: any;
  getConnectionKeyState: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  onSubmitRules: (rules: any) => void;
  onClose?: () => void;
  currentNode: any;
  sourcesToShow: DataSource[];
  selectedSourceTab: string;
  onSourceTabChange: (sourceId: string) => void;
  onFilterSave: (filterType?: string, data?: any, sourceId?: string) => Promise<void>;
  filterConditionsBySource: Record<string, any[]>;
  selectedColumnForFilter: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null;
  onColumnSelect: (column: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null) => void;
  onFiltersChange: (filters: any) => void;
  storedColumnFilters?: any;
  validationRulesMap?: Record<string, any>;
  dataSources: DataSource[];
  // DefaultRuleView props
  selectedTables: string[];
  onTableToggle: (tableName: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onShowFiltersPanel: () => void; // Opens Filters Panel (FiltersPageView)
  onShowDataGrid: (mapping: any) => void;
  onCloseDataGrid: () => void;
  onSelectionChange: (selectedData: { sourceRow: any; targetRow: any; mapping: any }) => void;
  selectedMappingForPreview: any | null;
  validationResults: any;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionAdd: (sourceColumn: any, targetColumn: any, ruleContext?: { ruleId?: string; ruleName?: string }) => void;
  onDataSourceUpdate: (sourceId: string, updatedSource: DataSource) => void;
  onAddSource: (newSource: Omit<DataSource, 'id'>) => void;
  onColumnSelected: (columns: { application: string; table: string; column: string; type: string }[]) => void;
  sourceRestrictedTables: Set<string>;
  validationRestrictedTables: Set<string>;
  onDropZoneTablesChange: (leftTables: Set<string>, rightTables: Set<string>) => void;
  onKeyButtonClick: (connectionId: string, keyType: 'primary' | 'validation') => void;
  savedNode: boolean;
  upstreamNodes: any[];
}

export const RuleTabsContent: React.FC<RuleTabsContentProps> = ({
  rule,
  activeRuleId,
  ruleViewState,
  onSetRuleViewState,
  activeRuleConnections,
  connectionKeyStates,
  getConnectionKeyState,
  onSubmitRules,
  onClose,
  currentNode,
  sourcesToShow: parentSourcesToShow, // Rename to avoid confusion
  selectedSourceTab,
  onSourceTabChange,
  onFilterSave,
  filterConditionsBySource,
  selectedColumnForFilter,
  onColumnSelect,
  onFiltersChange,
  storedColumnFilters,
  validationRulesMap,
  dataSources,
  selectedTables,
  onTableToggle,
  onSave,
  onCancel,
  onShowFiltersPanel,
  onShowDataGrid,
  onCloseDataGrid,
  onSelectionChange,
  selectedMappingForPreview,
  validationResults,
  onConnectionRemove,
  onConnectionAdd,
  onDataSourceUpdate,
  onAddSource,
  onColumnSelected,
  sourceRestrictedTables,
  validationRestrictedTables,
  onDropZoneTablesChange,
  onKeyButtonClick,
  savedNode,
  upstreamNodes,
}) => {
  if (activeRuleId !== rule.id) return null;

  // CRITICAL: Calculate sourcesToShow per rule based on this rule's connections
  // This ensures each rule shows only its own source tabs, not all sources
  const ruleSourcesToShow = React.useMemo(() => {
    // Since this component only renders when activeRuleId === rule.id,
    // activeRuleConnections should already be filtered for this rule.
    // However, we should still verify and use rule-specific connections if available.
    let ruleConnections = rule.connections;
    
    // If rule.connections is not available or empty, use activeRuleConnections
    // but ensure they belong to this rule by filtering
    if (!ruleConnections || ruleConnections.length === 0) {
      // Filter activeRuleConnections to ensure they belong to this rule
      if (activeRuleConnections && activeRuleConnections.length > 0) {
        ruleConnections = activeRuleConnections.filter((conn: any) => {
          // Check if connection belongs to this rule by ruleId or ruleName
          if (conn.ruleId && conn.ruleId === rule.id) {
            return true;
          }
          
          // Check by ruleName match
          const sourceTable = conn?.sourceColumn?.table || 'SOURCE';
          const targetTable = conn?.targetColumn?.table || conn?.sourceColumn?.table || 'TARGET';
          const derivedRuleName = conn?.ruleName
            ? conn.ruleName
            : conn?.singleRule
            ? `${sourceTable}_VS_${sourceTable}`
            : `${sourceTable}_VS_${targetTable}`;
          
          return derivedRuleName === rule.name;
        });
      }
    }
    
    if (!ruleConnections || ruleConnections.length === 0) {
      // If still no connections for this rule, return all dataSources or parent's sourcesToShow
      return parentSourcesToShow.length > 0 ? parentSourcesToShow : dataSources;
    }
    
    // Extract table names from this rule's connections
    const tableNamesSet = new Set<string>();
    ruleConnections.forEach((conn: any) => {
      if (conn.sourceColumn?.table) {
        tableNamesSet.add(conn.sourceColumn.table);
      }
      if (conn.targetColumn?.table) {
        tableNamesSet.add(conn.targetColumn.table);
      }
    });
    
    // Find sources that have tables matching this rule's connections
    const matchingSources: DataSource[] = [];
    dataSources.forEach((source) => {
      const hasMatchingTable = source.tables.some((table) =>
        tableNamesSet.has(table.name)
      );
      if (hasMatchingTable) {
        matchingSources.push(source);
      }
    });
    
    // Return matching sources or all dataSources if no matches
    return matchingSources.length > 0 ? matchingSources : dataSources;
  }, [rule.id, rule.name, rule.connections, activeRuleConnections, dataSources, parentSourcesToShow]);

  return (
    <TabsContent key={rule.id} value={rule.id} className="flex-1 min-h-0 -mt-2 overflow-hidden">
      <div className="h-full overflow-hidden">
        {/* Show Filter Node (MultiRowDynamicForm) inside rule */}
        {ruleViewState.showFilterNode ? (
          <FilterNodeView
            onBack={() => onSetRuleViewState({ showFilterNode: false })}
            currentNode={currentNode}
            sourcesToShow={ruleSourcesToShow}
            selectedSourceTab={selectedSourceTab}
            onSourceTabChange={onSourceTabChange}
            onFilterSave={onFilterSave}
            filterConditionsBySource={filterConditionsBySource}
            activeRuleId={activeRuleId}
            activeRuleName={rule.name}
            validationRulesMap={validationRulesMap}
            connections={activeRuleConnections}
            dataSources={dataSources}
            connectionKeyStates={connectionKeyStates}
            getConnectionKeyState={getConnectionKeyState}
            onColumnSelect={onColumnSelect}
            onFiltersChange={onFiltersChange}
            storedColumnFilters={storedColumnFilters}
          />
        ) : ruleViewState.showFiltersPage ? (
          <FiltersPageView
            onBack={() => onSetRuleViewState({ showFiltersPage: false, showConnectionsPage: false })}
            onClose={onClose}
            connections={activeRuleConnections}
            selectedColumnForFilter={selectedColumnForFilter}
            onColumnSelect={onColumnSelect}
            onFiltersChange={onFiltersChange}
            dataSources={dataSources}
            connectionKeyStates={connectionKeyStates}
            getConnectionKeyState={getConnectionKeyState}
            storedColumnFilters={storedColumnFilters}
            onFilterSave={onFilterSave}
            sourcesToShow={ruleSourcesToShow}
            selectedSourceTab={selectedSourceTab}
            onSourceTabChange={onSourceTabChange}
          />
        ) : ruleViewState.showConnectionsPage ? (
          <div className="h-full overflow-hidden">
            <div className="min-h-screen bg-background p-0 h-full overflow-y-auto">
              <ConnectionsPage
                connections={activeRuleConnections}
                onBack={() => onSetRuleViewState({ showConnectionsPage: false })}
                onClose={onClose}
                onSubmitRules={onSubmitRules}
                connectionKeyStates={connectionKeyStates}
                getConnectionKeyState={getConnectionKeyState}
              />
            </div>
          </div>
        ) : (
          <DefaultRuleView
            dataSources={dataSources}
            selectedTables={selectedTables}
            currentNode={currentNode}
            onTableToggle={onTableToggle}
            onSave={onSave}
            onCancel={onCancel}
            onFilter={() => onSetRuleViewState({ showFilterNode: true })}
            onShowFiltersPanel={() => onSetRuleViewState({ showFiltersPage: true })}
            onNext={() => onSetRuleViewState({ showConnectionsPage: true })}
            onShowDataGrid={onShowDataGrid}
            onCloseDataGrid={onCloseDataGrid}
            onSelectionChange={onSelectionChange}
            selectedMappingForPreview={selectedMappingForPreview}
            validationResults={validationResults}
            activeRuleConnections={activeRuleConnections}
            onConnectionRemove={onConnectionRemove}
            onConnectionAdd={(sourceColumn, targetColumn) =>
              onConnectionAdd(sourceColumn, targetColumn, {
                ruleId: rule.id,
                ruleName: rule.name,
              })
            }
            onDataSourceUpdate={onDataSourceUpdate}
            onAddSource={onAddSource}
            onColumnSelected={onColumnSelected}
            sourceRestrictedTables={sourceRestrictedTables}
            validationRestrictedTables={validationRestrictedTables}
            onDropZoneTablesChange={onDropZoneTablesChange}
            onKeyButtonClick={onKeyButtonClick}
            getConnectionKeyState={getConnectionKeyState}
            savedNode={savedNode}
            upstreamNodes={upstreamNodes}
            ruleId={rule.id}
            ruleName={rule.name}
          />
        )}
      </div>
    </TabsContent>
  );
};


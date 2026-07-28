import React from 'react';
import { SelectSources } from '../SelectSources';
import { TableListPanel } from '../TableListPanel';
import { NewConnectionsPanel } from '../NewConnectionsPanel';
import { DataGridPreview } from '../DataGridPreview';
import { FiltersDisplayPanel } from '../FiltersDisplayPanel';
import { DataSource } from '../types/mapping';
import BaseModal from '@/modals/baseModal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { useValidationStore } from '@/stores/validationStore';

interface DefaultRuleViewProps {
  dataSources: DataSource[];
  selectedTables: string[];
  currentNode?: any;
  onTableToggle: (tableName: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onFilter: () => void; // Opens Filter Node (MultiRowDynamicForm)
  onShowFiltersPanel: () => void; // Opens Filters Panel (FiltersPageView)
  onNext: () => void;
  onShowDataGrid: (mapping: any) => void;
  onCloseDataGrid: () => void;
  onSelectionChange: (selectedData: { sourceRow: any; targetRow: any; mapping: any }) => void;
  selectedMappingForPreview: any | null;
  validationResults: any;
  activeRuleConnections: any[];
  onConnectionRemove: (connectionId: string) => void;
  onConnectionAdd: (sourceColumn: any, targetColumn: any, ruleContext?: { ruleId?: string; ruleName?: string }) => void;
  onDataSourceUpdate: (sourceId: string, updatedSource: DataSource) => void;
  onAddSource: (newSource: Omit<DataSource, 'id'>) => void;
  onColumnSelected: (columns: { application: string; table: string; column: string; type: string }[]) => void;
  sourceRestrictedTables: Set<string>;
  validationRestrictedTables: Set<string>;
  onDropZoneTablesChange: (leftTables: Set<string>, rightTables: Set<string>) => void;
  onKeyButtonClick: (connectionId: string, keyType: 'primary' | 'validation') => void;
  getConnectionKeyState: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  savedNode: boolean;
  upstreamNodes: any[];
  ruleId: string;
  ruleName: string;
}

export const DefaultRuleView: React.FC<DefaultRuleViewProps> = ({
  dataSources,
  selectedTables,
  currentNode,
  onTableToggle,
  onSave,
  onCancel,
  onFilter,
  onShowFiltersPanel,
  onNext,
  onShowDataGrid,
  onCloseDataGrid,
  onSelectionChange,
  selectedMappingForPreview,
  validationResults,
  activeRuleConnections,
  onConnectionRemove,
  onConnectionAdd,
  onDataSourceUpdate,
  onAddSource,
  onColumnSelected,
  sourceRestrictedTables,
  validationRestrictedTables,
  onDropZoneTablesChange,
  onKeyButtonClick,
  getConnectionKeyState,
  savedNode,
  upstreamNodes,
  ruleId,
  ruleName,
}: DefaultRuleViewProps) => {
  // Get filters from validation store
  const columnFiltersBySource = useValidationStore((state) => state.columnFiltersBySource);
  const validationRulesMap = useValidationStore((state) => state.validationRulesMap);

  const getFilteredDataSources = () => {
    return dataSources.filter(source => {
      if (selectedTables.length === 0) return true;
      return source.tables.some(table => selectedTables.includes(table.name));
    });
  };

  return (   
    <div className="bg-background p-0 h-[300px]">
      <div className="mx-auto max-w-[1600px]">
        {/* Select Sources Section - Always Visible */}
        <SelectSources
          dataSources={dataSources}
          selectedTables={selectedTables}
          onTableToggle={onTableToggle}
          onSave={onSave}
          onCancel={onCancel}
          onFilter={onFilter}
          onNext={onNext}
        />

        {/* Three Column Layout: Left (Data Objects Accordion) + Middle (Connections Panel) + Right (Filters Display) */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 pb-0">
            {/* Left Side - Accordion with Source and Validation Data Objects */}
            <div className="lg:col-span-2">
              <Card className="h-full p-0">
                <Accordion type="single" collapsible defaultValue="source" className="w-full">
                  {/* Source Data Objects Accordion Item */}
                  <AccordionItem value="source" className="border-b">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <span className="text-sm font-semibold">Source Data Objects</span>
                    </AccordionTrigger>
                    <AccordionContent className="p-2 pt-0">
                      <TableListPanel
                        title=""
                        dataSources={getFilteredDataSources()}
                        onDataSourceUpdate={onDataSourceUpdate}
                        onAddSource={onAddSource}
                        onColumnSelected={onColumnSelected}
                        panelSide="left"
                        restrictedTables={sourceRestrictedTables}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Validation Data Objects Accordion Item */}
                  <AccordionItem value="validation" className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <span className="text-sm font-semibold">Validation Data Objects</span>
                    </AccordionTrigger>
                    <AccordionContent className="p-2 pt-0">
                      <TableListPanel
                        title=""
                        dataSources={getFilteredDataSources()}
                        onDataSourceUpdate={onDataSourceUpdate}
                        onAddSource={onAddSource}
                        onColumnSelected={onColumnSelected}
                        panelSide="right"
                        restrictedTables={validationRestrictedTables}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </div>

            {/* Middle - Connections Panel */}
            <div className="lg:col-span-3">
              <NewConnectionsPanel
                connections={activeRuleConnections as any}
                onConnectionRemove={onConnectionRemove}
                onConnectionAdd={onConnectionAdd}
                dataSources={dataSources}
                selectedTables={selectedTables}
                onShowDataGrid={onShowDataGrid}
                upstreamNodes={upstreamNodes}
                onShowFilters={onShowFiltersPanel}
                onDropZoneTablesChange={onDropZoneTablesChange}
                onKeyButtonClick={onKeyButtonClick}
                getConnectionKeyState={getConnectionKeyState}
                useStoreConnections={savedNode}
                ruleId={ruleId}
                ruleName={ruleName}
              />
            </div>

            {/* Right Side - Filters Display Panel */}
            <div className="lg:col-span-2">
              <FiltersDisplayPanel
                columnFiltersBySource={columnFiltersBySource}
                validationRulesMap={validationRulesMap}
                activeRuleName={ruleName}
                currentNode={currentNode}
                dataSources={dataSources}
              />
            </div>
          </div>

          {/* Data Grid Preview - Show in Modal Dialog when Execute is clicked */}
          <BaseModal
            open={!!selectedMappingForPreview}
            setOpen={(open) => {
              if (!open) {
                onCloseDataGrid();
              }
            }}
            size="x-large"
            className="p-0"
          >
            <BaseModal.Content className="p-0 max-h-[60vh] overflow-hidden flex flex-col">
              {selectedMappingForPreview && (
                <div className="flex-1 overflow-hidden">
                  <DataGridPreview
                    mapping={selectedMappingForPreview}
                    onClose={onCloseDataGrid}
                    onSelectionChange={onSelectionChange}
                    validationResults={validationResults}
                  />
                </div>
              )}
            </BaseModal.Content>
          </BaseModal>
        </div>
      </div>
    </div>
  );
};


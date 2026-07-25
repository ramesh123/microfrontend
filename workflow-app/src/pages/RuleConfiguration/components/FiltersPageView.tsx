import React, { useState } from 'react';
import { FiltersConfiguration } from '../FiltersConfiguration';
import { DataSource } from '../types/mapping';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FiltersPageViewProps {
  onBack: () => void;
  onClose?: () => void;
  connections: any[];
  selectedColumnForFilter: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null;
  onColumnSelect: (column: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null) => void;
  onFiltersChange: (filters: any) => void;
  dataSources: DataSource[];
  connectionKeyStates: any;
  getConnectionKeyState: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  sourceName?: string; // Source name to display instead of "selected column"
  storedColumnFilters?: any; // Stored column filters from validation store
  onFilterSave?: (filterType?: string, data?: any, sourceId?: string) => Promise<void>; // For calling the API
  sourcesToShow?: DataSource[]; // Sources to show in tabs
  selectedSourceTab?: string; // Currently selected source tab
  onSourceTabChange?: (sourceId: string) => void; // Handler for source tab change
}

export const FiltersPageView: React.FC<FiltersPageViewProps> = ({
  onBack,
  onClose,
  connections,
  selectedColumnForFilter,
  onColumnSelect,
  onFiltersChange,
  dataSources,
  connectionKeyStates,
  getConnectionKeyState,
  sourceName,
  storedColumnFilters,
  onFilterSave,
  sourcesToShow = [],
  selectedSourceTab,
  onSourceTabChange,
}) => {
  // If we have sources to show, use tabs; otherwise use single view
  const hasMultipleSources = sourcesToShow.length > 0;
  const [localSelectedTab, setLocalSelectedTab] = useState<string>(selectedSourceTab || sourcesToShow[0]?.id || '');
  
  const currentSourceTab = selectedSourceTab || localSelectedTab;
  const handleTabChange = (sourceId: string) => {
    if (onSourceTabChange) {
      onSourceTabChange(sourceId);
    } else {
      setLocalSelectedTab(sourceId);
    }
  };

  // Get filters for the current source
  const getFiltersForSource = (sourceId: string) => {
    if (!storedColumnFilters || typeof storedColumnFilters !== 'object') return {};
    
    const source = sourcesToShow.find(s => s.id === sourceId);
    if (!source) return {};
    
    // Try to find filters by source ID, name, or table names
    const candidateKeys = [sourceId, source.name];
    source.tables?.forEach((table) => {
      if (table.name) candidateKeys.push(table.name);
    });
    
    for (const key of candidateKeys) {
      if (storedColumnFilters[key]) {
        return { [key]: storedColumnFilters[key] };
      }
    }
    
    return {};
  };

  const currentSourceFilters = hasMultipleSources 
    ? getFiltersForSource(currentSourceTab)
    : storedColumnFilters || {};

  const currentSource = hasMultipleSources 
    ? sourcesToShow.find(s => s.id === currentSourceTab)
    : dataSources.find(ds => ds.name === sourceName);

  const renderFiltersConfig = (sourceId?: string, source?: DataSource) => {
    const filtersForThisSource = sourceId 
      ? getFiltersForSource(sourceId)
      : currentSourceFilters;
    
    const sourceNameToDisplay = source?.name || sourceName || 'Selected Source';

    return (
      <div className="h-full bg-white border border-slate-200 rounded-lg p-4 overflow-y-auto flex flex-col">
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-slate-800">Filters Configuration</h3>
          <p className="text-sm text-slate-500 mt-0.5">Configure filters for {sourceNameToDisplay}</p>
        </div>
        <div className="flex-1 min-h-0">
          <FiltersConfiguration
            connections={connections}
            selectedColumn={selectedColumnForFilter}
            dataSources={dataSources}
            onFiltersChange={onFiltersChange}
            onColumnSelect={onColumnSelect}
            sourceName={sourceNameToDisplay}
            storedColumnFilters={filtersForThisSource}
            onFilterSave={async (filterType?: string, data?: any, sourceIdParam?: string) => {
              // Use the sourceId from the current tab if not provided
              const finalSourceId = sourceIdParam || sourceId || currentSourceTab;
              if (onFilterSave) {
                await onFilterSave(filterType, data, finalSourceId);
              }
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full bg-background overflow-y-auto">
        <div className="min-h-screen bg-background p-4 h-full overflow-y-auto">
          <div className="mx-auto max-w-[1800px]">
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-600">
              <button onClick={onBack} className="hover:text-slate-900 underline">
                Back
              </button>
              <span>/</span>
              <span className="text-slate-900 font-medium">Column Filters Configuration</span>
            </div>

            {hasMultipleSources ? (
              <Tabs value={currentSourceTab} onValueChange={handleTabChange} className="h-[calc(100vh-120px)] flex flex-col">
                <TabsList className="mb-4">
                  {sourcesToShow.map((source) => (
                    <TabsTrigger key={source.id} value={source.id}>
                      {source.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {sourcesToShow.map((source) => (
                  <TabsContent key={source.id} value={source.id} className="flex-1 min-h-0 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      {renderFiltersConfig(source.id, source)}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              renderFiltersConfig()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


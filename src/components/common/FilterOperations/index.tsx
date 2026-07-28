

import { useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { HorizontalAiPanel } from './HorizontalAiPanel';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import DeriveColumn from '../deriveColumn';
import DataFilters, { DataFiltersRef } from '../DataFilters';

export interface FilterOperationsRef {
  getCurrentConfig: () => any;
  reset: () => void;
  getOperationType: () => 'derive_column' | 'data_filter' | null;
  setOperationType: (type: 'derive_column' | 'data_filter' | null) => void;
}

interface FilterOperationsProps {
  onConfigChange?: (config: any) => void;
  previewData?: {
    columns?: string[];
    sampleData?: any[];
  };
  initialConfig?: any;
  showAiPanel?: boolean;
  onAiPanelClose?: () => void;
  existingFilters?: any[]; // Existing filters to determine next index
}

const FilterOperations = forwardRef<FilterOperationsRef, FilterOperationsProps>(
  ({ onConfigChange, previewData, initialConfig, showAiPanel = false, onAiPanelClose, existingFilters = [] }, ref) => {
    const [operationType, setOperationType] = useState<'derive_column' | 'data_filter' | null>(null);
    const [appliedFilter, setAppliedFilter] = useState<string | null>(null);
    const [deriveColumnConfig, setDeriveColumnConfig] = useState<any>(null);
    const [key, setKey] = useState(0); // Force re-render key

    const dataFiltersRef = useRef<DataFiltersRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      getCurrentConfig: () => {
        if (operationType === 'derive_column') {
          return {
            ...deriveColumnConfig,
            ai_filter: appliedFilter
          };
        } else if (operationType === 'data_filter') {
          return {
            ...dataFiltersRef.current?.getCurrentConfig(),
            ai_filter: appliedFilter
          };
        }
        return null;
      },
      reset: () => {
        setOperationType(null);
        setAppliedFilter(null);
        setDeriveColumnConfig(null);
      },
      getOperationType: () => operationType,
      setOperationType: (type) => {
        setOperationType(type);
        setKey(prev => prev + 1); // Force re-render
      }
    }));

    const handleAiExecute = (filter: string) => {
      console.log('Executing filter:', filter);
      toast.info('Filter executed - showing sample output');
      // TODO: Implement filter execution to show sample output
    };

    const handleAiApply = (filter: string, userRequest?: string) => {
      setAppliedFilter(filter);

      // Calculate the next index based on existing filters
      const nextIndex = existingFilters && existingFilters.length > 0
        ? Math.max(...existingFilters.map((f: any) => f.index || 0)) + 1
        : 0;

      // Prepare the filter object with ai_generated type
      const aiFilterObject = {
        id: `ai-filter-${Date.now()}`,
        filter: filter,
        filter_type: 'ai_generated',
        index: nextIndex,
        user_request: userRequest,
      };

      // Call onConfigChange to update parent with the AI filter
      onConfigChange?.(aiFilterObject);

      onAiPanelClose?.();
      // Toast is shown by parent onConfigChange handler
    };

    const handleAiDiscard = () => {
      onAiPanelClose?.();
      toast.info('AI-generated filter discarded');
    };

    // Prepare AI context with table schema and sample data
    const prepareAiContext = () => {
      if (!previewData?.columns || !previewData?.sampleData) {
        return undefined;
      }

      // Detect data type for each column based on sample data
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

      const sampleRow = previewData.sampleData?.[0] || {};

      const schema = previewData.columns.map((column) => ({
        column: column,
        type: detectType(sampleRow[column]),
        description: ''
      }));

      return {
        schema,
        data: [sampleRow]
      };
    };

    return (
      <div ref={containerRef} className="flex flex-col h-full overflow-auto">
        {/* Horizontal AI Panel */}
        <AnimatePresence>
          {showAiPanel && (
            <HorizontalAiPanel
              onExecute={handleAiExecute}
              onApply={handleAiApply}
              onDiscard={handleAiDiscard}
              context={prepareAiContext()}
            />
          )}
        </AnimatePresence>

        {/* Main Content - Full DeriveColumn or DataFilters */}
        <div className="flex-1 relative">
          {operationType === 'derive_column' && (
            <div key={`derive-${key}`} className="h-full relative">
              <DeriveColumn
                onClickSave={(config) => {
                  setDeriveColumnConfig(config);
                  onConfigChange?.(config);
                }}
                previewDeriveData={initialConfig || {}}
                showResultDisplay={true}
                showAiPanel={false}
                onAiButtonClick={() => {}}
                onAiAccept={() => {}}
                onAiDiscard={() => {}}
                prepareAiContext={() => ({})}
              />

              {/* Applied AI Filter Indicator */}
              {appliedFilter && (
                <div className="absolute top-2 right-2 z-10 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  AI Filter Applied
                </div>
              )}
            </div>
          )}

          {operationType === 'data_filter' && (
            <div key={`filter-${key}`} className="h-full relative">
              <DataFilters
                ref={dataFiltersRef}
                onClickSave={(config) => {
                  onConfigChange?.(config);
                }}
                previewData={initialConfig || {}}
              />

              {/* Applied AI Filter Indicator */}
              {appliedFilter && (
                <div className="absolute top-2 right-2 z-10 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  AI Filter Applied
                </div>
              )}
            </div>
          )}

          {!operationType && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select an operation type to begin
            </div>
          )}
        </div>
      </div>
    );
  }
);

FilterOperations.displayName = 'FilterOperations';

export default FilterOperations;
export { FilterOperations };

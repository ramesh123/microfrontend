import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Source, MatchRule, SourceFilter } from '@/types';
import { SourceFilters } from '../SourceFilters';
import type { TableContext } from '@/components/common/FilterOperations/aiPredicateApi';
import useFlowStore from '@/stores/flowStore';

interface RuleFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: MatchRule;
  sources: Source[];
  selectedSourceIds?: string[];
  onUpdateSourceFilter: (sourceId: string, settings: Partial<SourceFilter>) => void;
}

export const RuleFiltersDialog = ({ 
  open, 
  onOpenChange, 
  rule, 
  sources, 
  selectedSourceIds = [],
  onUpdateSourceFilter
}: RuleFiltersDialogProps) => {
  const selectedNode = useFlowStore.getState().getSelectedNode();
  const sourceNodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');

  // Filter sources based on rule configuration (matching ColumnMappingComponent logic)
  const flowSources = React.useMemo(() => {
    if (rule.isSelfMatch && rule.selfMatchSourceId) {
      return sources.filter(s => s.id === rule.selfMatchSourceId);
    }
    return sources.filter(s => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds, rule.isSelfMatch, rule.selfMatchSourceId]);

  // Helper function to detect data type
  const detectType = useCallback((value: any): string => {
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
  }, []);

  // Get table context for a specific source
  const getSourceTableContext = useCallback((sourceId: string): TableContext | undefined => {
    const sourceNodeAny = sourceNodes.find(s => s.id === sourceId) as any;
    
    if (!sourceNodeAny?.data?.node?.output) {
      return undefined;
    }

    let data: any[] = [];
    let columns: string[] = [];

    if (sourceNodeAny.data.node.output.data) {
      data = sourceNodeAny.data.node.output.data;
      columns = sourceNodeAny.data.node.output.columns || [];
    }

    // If no data, return undefined
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    // If no columns provided, extract from first data row
    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
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
  }, [sourceNodes, detectType]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <div>
              <DialogTitle>Rule Filters</DialogTitle>
              <DialogDescription>
                Configure filters for sources in the matching rule "{rule.name}".
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="mt-4 flex-1 overflow-y-auto min-h-0">
            <div className="pr-4 pb-4 pl-1">
              <SourceFilters
                sources={flowSources}
                sourceFilters={rule.sourceFilters}
                onUpdateFilter={onUpdateSourceFilter}
                getSourceTableContext={getSourceTableContext}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};


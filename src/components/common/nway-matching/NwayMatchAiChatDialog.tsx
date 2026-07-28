/**
 * NwayMatchAiChatDialog - Wrapper for AiChatDialog in NWAY_MATCH mode
 * This component handles N-way matching request clarifications within the chat dialog
 */

import React from 'react';
import { AiChatDialog } from '@/pages/FlowPage/Aichatbox';
import type { SuccessResponse } from './nwayMatchRequestApi';

interface NwayMatchAiChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: SuccessResponse) => void;
  sources?: any[]; // Array of Source objects (for table context)
  sourceNodes?: any[]; // Array of raw source nodes (for API request)
  // For handling needs_clarification from NwayMatchAiPanel
  initialQuestion?: string;
  initialOptions?: { [key: string]: any };
  initialMissingFields?: Array<{ rule_id: string; match_id: string; field: string }>;
  initialConversationId?: string;
  initialEventId?: string;
  initialUserRequest?: string;
}

export const NwayMatchAiChatDialog: React.FC<NwayMatchAiChatDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sources,
  sourceNodes,
  initialQuestion,
  initialOptions,
  initialMissingFields,
  initialConversationId,
  initialEventId,
  initialUserRequest,
}) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

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

  // Convert source contexts to the format expected by AiChatDialog
  // Combine all sources into a single context for table schema
  const combinedTableContext = React.useMemo(() => {
    if (!sources || sources.length === 0) return undefined;

    // Combine schemas from all sources with prefixed column names
    const combinedSchema: any[] = [];
    const combinedData: any[] = [];

    sources.forEach(source => {
      const columns = source.columns || [];
      const data = source.data || [];
      const sampleRow = data.length > 0 ? data[0] : {};

      // Add columns from this source
      columns.forEach((col: any) => {
        const columnName = col.name || col;
        combinedSchema.push({
          column: `${source.name}.${columnName}`,
          type: detectType(sampleRow[columnName]),
          description: ''
        });
      });

      // Add sample data from this source (first row only)
      if (data.length > 0) {
        const prefixedData: any = {};
        Object.entries(sampleRow).forEach(([key, value]) => {
          prefixedData[`${source.name}.${key}`] = value;
        });
        combinedData.push(prefixedData);
      }
    });

    return {
      schema: combinedSchema,
      data: combinedData
    };
  }, [sources]);

  return (
    <AiChatDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      mode="NWAY_MATCH"
      onCodeGenerated={(code) => {
        console.log('[NWAY CHAT DIALOG] onCodeGenerated callback triggered');
        console.log('[NWAY CHAT DIALOG] code received:', code);
        console.log('[NWAY CHAT DIALOG] onSuccess callback exists:', !!onSuccess);

        // For NWAY_MATCH mode, we'll receive the configuration as "code"
        // Parse it and call onSuccess if provided
        if (onSuccess) {
          try {
            const result = JSON.parse(code);
            console.log('[NWAY CHAT DIALOG] Parsed result:', result);
            console.log('[NWAY CHAT DIALOG] Calling onSuccess with result');
            onSuccess(result);
            console.log('[NWAY CHAT DIALOG] onSuccess called successfully');
          } catch (error) {
            console.error('[NWAY CHAT DIALOG] Failed to parse N-way match result:', error);
          }
        } else {
          console.warn('[NWAY CHAT DIALOG] onSuccess callback is not defined!');
        }
      }}
      tableContext={combinedTableContext}
      sources={sourceNodes}
      initialQuestion={initialQuestion}
      initialOptions={initialOptions}
      initialMissingFields={initialMissingFields}
      initialConversationId={initialConversationId}
      initialEventId={initialEventId}
      initialUserRequest={initialUserRequest}
    />
  );
};

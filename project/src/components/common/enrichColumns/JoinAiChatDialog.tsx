/**
 * JoinAiChatDialog - Wrapper for AiChatDialog in JOIN mode
 * This component handles join request clarifications within the chat dialog
 */

import React from 'react';
import { AiChatDialog } from '@/pages/FlowPage/Aichatbox';
import type { TableContext as JoinTableContext, SuccessResponse as JoinSuccessResponse } from './joinRequestApi';

interface JoinAiChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: JoinSuccessResponse) => void;
  sourceContext?: JoinTableContext;
  targetContext?: JoinTableContext;
  // For handling needs_clarification from JoinAiPanel
  initialQuestion?: string;
  initialOptions?: { [key: string]: string[] };
  initialConversationId?: string;
  initialEventId?: string;
  initialUserRequest?: string;
}

export const JoinAiChatDialog: React.FC<JoinAiChatDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sourceContext,
  targetContext,
  initialQuestion,
  initialOptions,
  initialConversationId,
  initialEventId,
  initialUserRequest,
}) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Convert join table contexts to the format expected by AiChatDialog
  // We'll pass both contexts as a combined context for now
  const combinedTableContext = React.useMemo(() => {
    if (!sourceContext || !targetContext) return undefined;

    // Combine schemas from both tables with prefixed column names
    const combinedSchema = [
      ...sourceContext.schema.map(col => ({
        column: `${sourceContext.table_name}.${col.column}`,
        type: col.type,
        description: ''
      })),
      ...targetContext.schema.map(col => ({
        column: `${targetContext.table_name}.${col.column}`,
        type: col.type,
        description: ''
      }))
    ];

    // Combine sample data
    const combinedData = [
      ...sourceContext.data.map(row => ({
        ...Object.fromEntries(
          Object.entries(row).map(([key, value]) => [`${sourceContext.table_name}.${key}`, value])
        )
      })),
      ...targetContext.data.map(row => ({
        ...Object.fromEntries(
          Object.entries(row).map(([key, value]) => [`${targetContext.table_name}.${key}`, value])
        )
      }))
    ];

    return {
      schema: combinedSchema,
      data: combinedData
    };
  }, [sourceContext, targetContext]);

  return (
    <AiChatDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      mode="JOIN"
      onCodeGenerated={(code) => {
        // For JOIN mode, we'll receive the join configuration as "code"
        // Parse it and call onSuccess if provided
        if (onSuccess) {
          try {
            const result = JSON.parse(code);
            onSuccess(result);
          } catch (error) {
            console.error('Failed to parse join result:', error);
          }
        }
      }}
      tableContext={combinedTableContext}
      initialQuestion={initialQuestion}
      initialOptions={initialOptions}
      initialConversationId={initialConversationId}
      initialEventId={initialEventId}
      initialUserRequest={initialUserRequest}
    />
  );
};

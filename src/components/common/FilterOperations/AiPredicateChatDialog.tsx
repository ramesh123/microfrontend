/**
 * AiPredicateChatDialog - Wrapper for AiChatDialog in PREDICATE mode
 * Uses SheetOverlay to render on top of Sheet components without interference
 */

import React from 'react';
import { AiChatDialog } from '@/pages/FlowPage/Aichatbox';
import type { TableContext } from './aiPredicateApi';

interface AiPredicateChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeGenerated?: (code: string) => void;
  tableContext?: TableContext;
  className?: string;
  // For handling needs_clarification from HorizontalAiPanel
  initialQuestion?: string;
  initialOptions?: { [key: string]: string[] };
  initialMissingColumns?: string[];
  initialConversationId?: string;
  initialEventId?: string;
  initialUserRequest?: string;
}

export const AiPredicateChatDialog: React.FC<AiPredicateChatDialogProps> = ({
  isOpen,
  onClose,
  onCodeGenerated,
  tableContext,
  className,
  initialQuestion,
  initialOptions,
  initialMissingColumns,
  initialConversationId,
  initialEventId,
  initialUserRequest,
}) => {
  // Use React.useEffect to initialize conversation state when initial data is provided
  React.useEffect(() => {
    if (isOpen && initialConversationId && initialEventId && initialQuestion && initialOptions) {
      console.log('AiPredicateChatDialog initialized with:', {
        initialConversationId,
        initialEventId,
        initialQuestion,
        initialOptions,
        initialUserRequest
      });
    }
  }, [isOpen, initialConversationId, initialEventId, initialQuestion, initialOptions, initialUserRequest]);

  return (
    <AiChatDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      mode="PREDICATE"
      onCodeGenerated={onCodeGenerated}
      tableContext={tableContext}
      initialQuestion={initialQuestion}
      initialOptions={initialOptions}
      initialMissingColumns={initialMissingColumns}
      initialUserRequest={initialUserRequest}
      initialConversationId={initialConversationId}
      initialEventId={initialEventId}
    />
  );
};

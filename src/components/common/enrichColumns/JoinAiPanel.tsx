
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, SendHorizontal } from 'lucide-react';
import {
  compileJoinRequest,
  isSuccessResponse,
  isClarificationResponse,
  type TableContext,
  type SuccessResponse
} from './joinRequestApi';
import { MentionTextarea } from '../FilterOperations/MentionTextarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import AiIcon from '@/assets/images/icons8-ai-64.png';
import useFlowStore from '@/stores/flowStore';
import { useRbacStore } from '@/stores/useRBACStore';

interface JoinAiPanelProps {
  onApply: (result: SuccessResponse) => void;
  onDiscard: () => void;
  sourceContext?: TableContext;
  targetContext?: TableContext;
  onOpenChatDialog?: (initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId: string;
    eventId: string;
    userRequest: string;
  }) => void;
}

export const JoinAiPanel: React.FC<JoinAiPanelProps> = ({
  onApply,
  onDiscard,
  sourceContext,
  targetContext,
  onOpenChatDialog,
}) => {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const currentUser = useRbacStore((state) => state.currentUser);

  // Combine columns from both contexts for mention suggestions
  const allColumns = React.useMemo(() => {
    const sourceColumns = sourceContext?.schema || [];
    const targetColumns = targetContext?.schema || [];
    
    return [
      ...sourceColumns.map(col => ({ 
        column: `${sourceContext?.table_name}.${col.column}`, 
        type: col.type 
      })),
      ...targetColumns.map(col => ({ 
        column: `${targetContext?.table_name}.${col.column}`, 
        type: col.type 
      }))
    ];
  }, [sourceContext, targetContext]);

  const handleGenerate = async () => {
    if (!sourceContext || !targetContext) {
      toast.error('Both source and target tables must be selected.');
      return;
    }

    if (!currentUser?.email) {
      toast.error('User email not found. Please log in again.');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await compileJoinRequest({
        conversation_id: '',
        user_request: query,
        flow_id: currentWorkflow?.flow_id || '',
        source_context: sourceContext,
        target_context: targetContext,
        execute: true,
        user_name: currentUser.email,
        max_rows: 10
      });

      // Handle clarification response - open chat dialog
      if (isClarificationResponse(response)) {
        setIsGenerating(false);

        // If onOpenChatDialog callback is provided, use it to open the chat dialog
        if (onOpenChatDialog && response.question && response.options) {
          onOpenChatDialog({
            question: response.question,
            options: response.options,
            conversationId: response.conversation_id,
            eventId: response.event_id,
            userRequest: query
          });
          toast.info('AI needs clarification to configure the join');
        } else {
          // Fallback: show error if no callback provided
          toast.error('Clarification needed but chat dialog not available');
        }
        return;
      }

      // Handle success response
      if (isSuccessResponse(response)) {
        toast.success('Join configuration generated successfully');
        onApply(response);
      }
    } catch (error: unknown) {
      console.error('Failed to generate join configuration:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to generate join configuration. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-primary/[0.02] to-primary/[0.04] dark:from-primary/[0.02] dark:to-primary/[0.04] border-b border-primary/20 dark:border-primary/30"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <img src={AiIcon} alt="AI" className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-primary">AI Join Configuration</h3>
          </div>
          <div className="flex-1 relative">
            <MentionTextarea
              value={query}
              onChange={setQuery}
              columns={allColumns}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && query.trim() && !isGenerating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Describe your join in natural language (e.g., Join customers and orders on customer_id and filter orders after 2024-01-01). Type @ to select columns."
              className="resize-none pr-12 border-input text-sm"
              minHeight="60px"
              disabled={isGenerating}
              variant="textarea"
            />
            <Button
              onClick={handleGenerate}
              disabled={!query.trim() || isGenerating}
              size="icon"
              variant="ghost"
              className="absolute bottom-[0.70rem] right-2 h-10 w-10 hover:bg-primary/10 text-primary disabled:opacity-30"
              title="Generate"
            >
              {isGenerating ? (
                <Loader2 className="w-[4rem] h-[4rem] animate-spin" />
              ) : (
                <SendHorizontal className="w-[4rem] h-[4rem]" />
              )}
            </Button>
          </div>

          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card p-4 rounded-md border border-primary/20"
              >
                <div className="flex items-center gap-3">
                  {/* Animated Thinking Orbs */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-primary to-primary/70"
                        animate={{
                          scale: [1, 1.4, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.2,
                        }}
                        style={{
                          boxShadow: "0 0 8px rgba(var(--primary), 0.4)",
                        }}
                      />
                    ))}
                  </div>

                  {/* Thinking Text with Animated Dots */}
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-foreground">
                      Thinking
                    </span>
                    <div className="flex items-baseline gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="text-sm font-medium text-foreground"
                          animate={{
                            opacity: [0, 1, 0],
                          }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.2,
                          }}
                        >
                          .
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

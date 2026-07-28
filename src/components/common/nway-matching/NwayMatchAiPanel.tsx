
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, SendHorizontal } from 'lucide-react';
import {
  compileNwayMatchRequest,
  isSuccessResponse,
  isClarificationResponse,
  type SuccessResponse
} from './nwayMatchRequestApi';
import { MentionTextarea } from '../FilterOperations/MentionTextarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import AiIcon from '@/assets/images/icons8-ai-64.png';
import useFlowStore from '@/stores/flowStore';
import { useRbacStore } from '@/stores/useRBACStore';

interface NwayMatchAiPanelProps {
  onApply: (result: SuccessResponse) => void;
  onDiscard: () => void;
  sources: any[]; // Array of source node contexts
  onOpenChatDialog?: (initialData: {
    question: string;
    options: { [key: string]: any };
    missingFields: Array<{ rule_id: string; match_id: string; field: string }>;
    conversationId: string;
    eventId: string;
    userRequest: string;
  }) => void;
}

export const NwayMatchAiPanel: React.FC<NwayMatchAiPanelProps> = ({
  onApply,
  onDiscard,
  sources,
  onOpenChatDialog,
}) => {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const currentUser = useRbacStore((state) => state.currentUser);

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

  // Combine columns from all sources for mention suggestions
  const allColumns = useMemo(() => {
    const columns: any[] = [];

    sources.forEach(source => {
      const sourceColumns = source.columns || [];
      sourceColumns.forEach((col: any) => {
        columns.push({
          column: `${source.name}.${col.name || col}`,
          type: col.type || 'Utf8'
        });
      });
    });

    return columns;
  }, [sources]);

  // Prepare source contexts for API request (similar to enrichColumns)
  const prepareSourceContexts = () => {
    console.log('[NWAY PANEL DEBUG] prepareSourceContexts called');
    console.log('[NWAY PANEL DEBUG] sources:', sources);
    console.log('[NWAY PANEL DEBUG] sources length:', sources?.length);
    
    return sources.map((source, index) => {
      const sourceAny = source as any;

      // Source shape from N-way matching (hydrated upstream data)
      if (Array.isArray(sourceAny.data) && sourceAny.name && Array.isArray(sourceAny.columns)) {
        const data = sourceAny.data;
        if (data.length === 0) {
          console.warn(`[NWAY PANEL DEBUG] Source ${index} has no data`);
          return null;
        }
        let columns = sourceAny.columns.map((c: any) => c.name || c.id).filter(Boolean);
        const sampleRow = data[0] || {};
        if (columns.length === 0) {
          columns = Object.keys(sampleRow);
        }
        const schema = columns.map((column: string) => ({
          column: column,
          type: detectType(sampleRow[column])
        }));
        return {
          source_name: sourceAny.name,
          schema,
          data: [sampleRow]
        };
      }

      // Legacy: raw flow node
      const sourceNode = sourceAny;
      console.log(`[NWAY PANEL DEBUG] Processing source ${index}:`, sourceNode);

      if (!sourceNode?.data?.node?.output) {
        console.warn(`[NWAY PANEL DEBUG] Source ${index} missing data.node.output`);
        return null;
      }

      let data: any[] = [];
      let columns: string[] = [];

      if (sourceNode.data.node.output.data) {
        data = sourceNode.data.node.output.data;
        columns = sourceNode.data.node.output.columns || [];
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn(`[NWAY PANEL DEBUG] Source ${index} has no data`);
        return null;
      }

      if (!columns || columns.length === 0) {
        const firstRow = data[0];
        columns = firstRow ? Object.keys(firstRow) : [];
      }

      const sampleRow = data[0] || {};

      const schema = columns.map((column: string) => ({
        column: column,
        type: detectType(sampleRow[column])
      }));

      const result = {
        source_name: sourceNode.data.node?.payload?.table || sourceNode.data.display_name || sourceNode.id,
        schema,
        data: [sampleRow]
      };

      console.log(`[NWAY PANEL DEBUG] Source ${index} prepared:`, result);
      return result;
    }).filter(Boolean);
  };

  const handleGenerate = async () => {
    if (!currentUser?.email) {
      toast.error('User email not found. Please log in again.');
      return;
    }

    if (sources.length < 2) {
      toast.error('At least 2 sources are required for N-way matching.');
      return;
    }

    setIsGenerating(true);

    try {
      const sourceContexts = prepareSourceContexts();
      console.log('[NWAY PANEL DEBUG] Final sourceContexts:', sourceContexts);
      console.log('[NWAY PANEL DEBUG] Sending request with payload:', {
        conversation_id: '',
        user_request: query,
        flow_id: currentWorkflow?.flow_id || '',
        sources: sourceContexts,
        execute: true,
        user_name: currentUser.email,
        max_rows: 10
      });

      const response = await compileNwayMatchRequest({
        conversation_id: '',
        user_request: query,
        flow_id: currentWorkflow?.flow_id || '',
        sources: sourceContexts,
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
            missingFields: response.missing_fields || [],
            conversationId: response.conversation_id,
            eventId: response.event_id,
            userRequest: query
          });
          toast.info('AI needs clarification to configure N-way matching');
        } else {
          // Fallback: show error if no callback provided
          toast.error('Clarification needed but chat dialog not available');
        }
        return;
      }

      // Handle success response
      if (isSuccessResponse(response)) {
        toast.success('N-way matching configuration generated successfully');
        onApply(response);
      }
    } catch (error: unknown) {
      console.error('Failed to generate N-way matching configuration:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to generate N-way matching configuration. Please try again.'));
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
            <h3 className="text-sm font-semibold text-primary">AI N-way Match Configuration</h3>
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
              placeholder="Describe your N-way matching in natural language (e.g., Match invoices, payments, and bank ledger by amount with tolerance 0.5). Type @ to select columns."
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

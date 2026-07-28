
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, SendHorizontal, Play, Edit2 } from 'lucide-react';
import {
  generateAiPredicate,
  resumeAiPredicate,
  isSuccessResponse,
  isClarificationResponse,
  type TableContext,
  type ConversationState
} from './aiPredicateApi';
import { MentionTextarea } from './MentionTextarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import AiIcon from '@/assets/images/icons8-ai-64.png';
import useFlowStore from '@/stores/flowStore';

interface HorizontalAiPanelProps {
  onExecute?: (filter: string, userRequest?: string) => void;
  onApply: (filter: string, userRequest?: string) => void;
  onDiscard: () => void;
  context?: TableContext;
  showExecuteButton?: boolean;
  onOpenChatDialog?: (initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => void;
}

export const HorizontalAiPanel: React.FC<HorizontalAiPanelProps> = ({
  onExecute,
  onApply,
  onDiscard,
  context,
  showExecuteButton = true,
  onOpenChatDialog,
}) => {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [displayedFilter, setDisplayedFilter] = useState('');
  const [generatedFilter, setGeneratedFilter] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [typingIndex, setTypingIndex] = useState(0);
  const [editedFilter, setEditedFilter] = useState('');

  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);

  useEffect(() => { 
    if (generatedFilter && typeof generatedFilter === 'string' && typingIndex < generatedFilter.length) {
      const timeout = setTimeout(() => {
        setDisplayedFilter(generatedFilter.slice(0, typingIndex + 1));
        setTypingIndex(typingIndex + 1);
      }, 20); // Typing speed: 20ms per character

      return () => clearTimeout(timeout);
    } else if (generatedFilter && typeof generatedFilter === 'string' && typingIndex >= generatedFilter.length) {
      setShowActions(true);
    }
  }, [generatedFilter, typingIndex]);

  const handleGenerate = async () => {
    if (!context || !context.schema || context.schema.length === 0) {
      toast.error('No table context available. Please ensure data is loaded.');
      return;
    }

    setIsGenerating(true);
    setDisplayedFilter('');
    setGeneratedFilter('');
    setShowActions(false);
    setTypingIndex(0);

    try {
      const response = await generateAiPredicate({
        table_context: context,
        conversation_id: null,
        user_request: query,
        flow_id: currentWorkflow?.flow_id || '',
        execute: true,
        max_rows: 10
      });

      // Handle clarification response - open AiChatDialog instead
      if (isClarificationResponse(response)) {
        setIsGenerating(false);

        // If onOpenChatDialog callback is provided, use it to open the chat dialog
        if (onOpenChatDialog && response.question && response.options) {
          onOpenChatDialog({
            question: response.question,
            options: response.options,
            conversationId: response.conversation_id,
            eventId: response.event_id,
            userRequest: query // Pass the user's original request
          });
          toast.info('AI needs clarification to generate the filter');
        } else {
          // Fallback: show error if no callback provided
          toast.error('Clarification needed but chat dialog not available');
        }
        return;
      }

      // Handle success response
      if (isSuccessResponse(response)) {
        if (response.code && typeof response.code === 'string') {
          setGeneratedFilter(response.code);
          setEditedFilter(response.code);
          toast.success('Filter generated successfully');
        } else {
          throw new Error('Invalid response: code is missing or not a string');
        }
      }
    } catch (error: unknown) {
      console.error('Failed to generate AI filter:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to generate filter. Please try again.'));
      setGeneratedFilter('');
      setDisplayedFilter('');
      setShowActions(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecute = () => { 
    if (editedFilter || generatedFilter) {
      onExecute?.(editedFilter || generatedFilter, query);
    }
  };

  const handleApply = () => {
    if (editedFilter || generatedFilter) {
      onApply(editedFilter || generatedFilter, query);
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
            <h3 className="text-sm font-semibold text-primary">AI Predicate Generator</h3>
          </div>
          <div className="flex-1 relative">
            <MentionTextarea
              value={query}
              onChange={setQuery}
              columns={context?.schema || []}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && query.trim() && !isGenerating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Describe your filter in natural language (e.g., amount > 1000 and date is last month). Type @ to select columns."
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
            {isGenerating && !displayedFilter && (
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

            {(displayedFilter || isGenerating) && displayedFilter && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card p-3 rounded-md border space-y-2"
              >
                <div className="text-xs text-muted-foreground font-medium">
                  Here is the filter based on your query {showActions && '(click to edit)'}:
                </div>
                <div className="relative">
                  <Textarea
                    value={displayedFilter}
                    onChange={(e) => {
                      if (showActions) { 
                        setEditedFilter(e.target.value);
                        setDisplayedFilter(e.target.value);
                      }
                    }}
                    className="min-h-[80px] resize-none text-sm font-mono bg-muted border-input"
                    placeholder="Edit your filter..."
                    readOnly={!showActions}
                    style={{ cursor: showActions ? 'text' : 'default' }}
                  />
                  {typingIndex < generatedFilter.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="absolute bottom-3 right-3 inline-block w-1.5 h-4 bg-primary pointer-events-none"
                    />
                  )}
                </div>
                {showActions && (
                  <div className="flex gap-2 pt-1">
                    {showExecuteButton && (
                      <Button
                        onClick={handleExecute}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Execute
                      </Button>
                    )}
                    <Button
                      onClick={handleApply}
                      size="sm"
                      variant="default"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      onClick={onDiscard}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Discard
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

    </>
  );
};

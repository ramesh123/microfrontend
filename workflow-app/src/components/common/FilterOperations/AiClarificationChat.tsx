import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import AiIcon from '@/assets/images/icons8-ai-64.png';
import { MentionTextarea } from './MentionTextarea';

interface TableSchema {
  column: string;
  type: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'error';
  content: string;
  timestamp: string;
  data?: {
    type: 'options' | 'success' | 'error';
    options?: string[];
    fieldName?: string;
    errorMessage?: string;
  };
}

interface AiClarificationChatProps {
  isOpen: boolean;
  onClose: () => void;
  question?: string;
  options?: { [key: string]: string[] };
  missingColumns?: string[];
  onSubmitAnswer: (answer: { columns: { [key: string]: string } }) => void;
  isLoading?: boolean;
  className?: string;
  issueType?: string;
  executionError?: string;
  columns?: TableSchema[];
}

export const AiClarificationChat: React.FC<AiClarificationChatProps> = ({
  isOpen,
  onClose,
  question,
  options = {},
  missingColumns = [],
  onSubmitAnswer,
  isLoading = false,
  className,
  issueType,
  executionError,
  columns = [],
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string }>({});
  const [customInput, setCustomInput] = useState('');
  const [currentSelection, setCurrentSelection] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset chat when closed
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setCurrentFieldIndex(0);
      setSelectedOptions({});
      setCustomInput('');
      setCurrentSelection('');
    }
  }, [isOpen]);

  // Initialize chat with the first question or error
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Handle execution error
      if (issueType === 'execution_error' && executionError) {
        addMessage('error', 'Oops! Please review the error below and try again with a different approach.', {
          type: 'error',
          errorMessage: executionError,
        });
        return;
      }

      // Handle normal clarification
      if (missingColumns.length > 0) {
        const firstField = missingColumns[0];
        const fieldOptions = options[firstField] || [];

        addMessage('ai', `${question || `Which column should be used for '${firstField}'?`}`, {
          type: 'options',
          options: fieldOptions,
          fieldName: firstField,
        });
      }
    }
  }, [isOpen, missingColumns, question, options, issueType, executionError, messages.length]);

  const addMessage = (type: 'user' | 'ai' | 'system' | 'error', content: string, data?: any) => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      data,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleOptionSelect = (value: string) => {
    setCurrentSelection(value);
    if (value !== 'custom') {
      setCustomInput('');
    }
  };

  const handleSubmitSelection = () => {
    const currentField = missingColumns[currentFieldIndex];
    let selectedValue = currentSelection;

    if (currentSelection === 'custom') {
      if (!customInput.trim()) {
        return;
      }
      selectedValue = customInput.trim();
    }

    if (!selectedValue) {
      return;
    }

    // Add user message
    addMessage('user', selectedValue);

    // Update selected options
    const updatedOptions = {
      ...selectedOptions,
      [currentField]: selectedValue,
    };
    setSelectedOptions(updatedOptions);

    // Move to next field or submit
    if (currentFieldIndex < missingColumns.length - 1) {
      const nextFieldIndex = currentFieldIndex + 1;
      const nextField = missingColumns[nextFieldIndex];
      const nextFieldOptions = options[nextField] || [];

      setCurrentFieldIndex(nextFieldIndex);
      setCurrentSelection('');
      setCustomInput('');

      // Add next question
      setTimeout(() => {
        addMessage('ai', `Which column should be used for '${nextField}'?`, {
          type: 'options',
          options: nextFieldOptions,
          fieldName: nextField,
        });
      }, 300);
    } else {
      // All fields answered, submit
      onSubmitAnswer({ columns: updatedOptions });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentSelection === 'custom' && customInput.trim()) {
        handleSubmitSelection();
      }
    }
  };

  return (  
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-[100] backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background shadow-2xl z-[101] flex flex-col border-l',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg">
              <img src={AiIcon} alt="AI" className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI Assistance</h2>
              <p className="text-xs text-muted-foreground">Help me understand your request</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-primary/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30 space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex',
                message.type === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                  message.type === 'user'
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground'
                    : message.type === 'system'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
                    : message.type === 'error'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400'
                    : 'bg-card border text-foreground'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                {/* Error Message Display */}
                {message.data?.type === 'error' && message.data.errorMessage && (
                  <div className="mt-3 p-3 bg-white/10 rounded-lg border border-white/20">
                    <p className="text-xs font-semibold mb-1">Error Details:</p>
                    <p className="text-xs font-mono break-words">{message.data.errorMessage}</p>
                  </div>
                )}

                {/* Options UI */}
                {message.data?.type === 'options' && message.data.options && (
                  <div className="mt-3 space-y-2">
                    <RadioGroup
                      value={currentSelection}
                      onValueChange={handleOptionSelect}
                      className="space-y-2"
                    >
                      {message.data.options.map((option: string) => (
                        <div
                          key={option}
                          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer"
                        >
                          <RadioGroupItem value={option} id={option} />
                          <Label
                            htmlFor={option}
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer">
                        <RadioGroupItem value="custom" id="custom" />
                        <Label
                          htmlFor="custom"
                          className="flex-1 cursor-pointer text-sm font-medium"
                        >
                          Custom value
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Custom Input */}
                    {currentSelection === 'custom' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-2 mt-2"
                      >
                        <MentionTextarea
                          value={customInput}
                          onChange={setCustomInput}
                          columns={columns}
                          onKeyDown={handleKeyDown}
                          placeholder="Enter custom column name or type @ to select from list..."
                          className="flex-1 h-9 text-sm bg-background"
                          variant="input"
                        />
                        <Button
                          onClick={handleSubmitSelection}
                          disabled={!customInput.trim()}
                          size="sm"
                          className="h-9 w-9 p-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    )}

                    {/* Submit Button for Options */}
                    {currentSelection && currentSelection !== 'custom' && (
                      <Button
                        onClick={handleSubmitSelection}
                        className="w-full h-9 text-sm mt-2 bg-primary hover:bg-primary/90"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Submit
                      </Button>
                    )}
                  </div>
                )}

                {/* Success indicator */}
                {message.data?.type === 'success' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}

                <p className="text-xs opacity-70 mt-2">{message.timestamp}</p>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="w-3 h-3" />
            <span>
              Question {currentFieldIndex + 1} of {missingColumns.length}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
};

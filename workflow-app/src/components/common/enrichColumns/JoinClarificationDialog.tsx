/**
 * JoinClarificationDialog - Dialog for handling join request clarifications
 * This component handles the needs_clarification response from the join API
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import {
  resumeJoinRequest,
  isSuccessResponse,
  isClarificationResponse,
  type SuccessResponse
} from './joinRequestApi';

interface JoinClarificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: SuccessResponse) => void;
  initialQuestion: string;
  initialOptions: { [key: string]: string[] };
  conversationId: string;
  eventId: string;
}

export const JoinClarificationDialog: React.FC<JoinClarificationDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialQuestion,
  initialOptions,
  conversationId,
  eventId,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string[] }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(eventId);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setSelectedOptions({});
      setCurrentEventId(eventId);
    }
  }, [isOpen, eventId]);

  // Parse the options to determine source and target keys
  const sourceKey = Object.keys(initialOptions).find(key => key.includes('source.join_key'));
  const targetKey = Object.keys(initialOptions).find(key => key.includes('target.join_key'));

  const sourceColumns = sourceKey ? initialOptions[sourceKey] : [];
  const targetColumns = targetKey ? initialOptions[targetKey] : [];

  const handleSourceSelect = (column: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [sourceKey!]: [column]
    }));
  };

  const handleTargetSelect = (column: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [targetKey!]: [column]
    }));
  };

  const handleSubmit = async () => {
    // Validate that both source and target are selected
    if (!sourceKey || !targetKey || !selectedOptions[sourceKey] || !selectedOptions[targetKey]) {
      toast.error('Please select both source and target join columns');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resumeJoinRequest({
        conversation_id: conversationId,
        event_id: currentEventId,
        answers: {
          columns: selectedOptions
        }
      });

      // Handle another clarification (recursive)
      if (isClarificationResponse(response)) {
        toast.info('AI needs more clarification');
        // Update the current event ID for the next iteration
        setCurrentEventId(response.event_id);
        // Reset selections for new clarification
        setSelectedOptions({});
        // Note: In a production app, you might want to handle multiple rounds of clarification
        // For now, we'll just show an error
        toast.error('Multiple clarifications not yet supported. Please try a different request.');
        return;
      }

      // Handle success
      if (isSuccessResponse(response)) {
        toast.success('Join configuration completed successfully');
        onSuccess(response);
        onClose();
      }
    } catch (error: unknown) {
      console.error('Failed to resume join request:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to process clarification'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Join Column Selection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{initialQuestion}</p>

          <div className="grid grid-cols-2 gap-6">
            {/* Source Columns */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Source Join Key</h3>
              <RadioGroup
                value={selectedOptions[sourceKey!]?.[0] || ''}
                onValueChange={handleSourceSelect}
              >
                <div className="space-y-2">
                  {sourceColumns.map((column) => (
                    <div key={column} className="flex items-center space-x-2">
                      <RadioGroupItem value={column} id={`source-${column}`} />
                      <Label
                        htmlFor={`source-${column}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {column}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Target Columns */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Target Join Key</h3>
              <RadioGroup
                value={selectedOptions[targetKey!]?.[0] || ''}
                onValueChange={handleTargetSelect}
              >
                <div className="space-y-2">
                  {targetColumns.map((column) => (
                    <div key={column} className="flex items-center space-x-2">
                      <RadioGroupItem value={column} id={`target-${column}`} />
                      <Label
                        htmlFor={`target-${column}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {column}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedOptions[sourceKey!] || !selectedOptions[targetKey!]}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

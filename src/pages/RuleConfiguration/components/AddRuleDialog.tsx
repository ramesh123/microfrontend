import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface AddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  onAdd: (name: string) => void;
  existingRuleNames?: string[]; // Optional: pass existing rule names for validation
}

export const AddRuleDialog: React.FC<AddRuleDialogProps> = ({
  open,
  onOpenChange,
  ruleName,
  onRuleNameChange,
  onAdd,
  existingRuleNames = [],
}) => {
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleRuleNameChange = (value: string) => {
    onRuleNameChange(value);
    // Clear error when user starts typing
    if (errorMessage) {
      setErrorMessage('');
    }
    
    // Check for duplicates in real-time (optional - can be removed if too aggressive)
    const trimmedName = value.trim();
    if (trimmedName && existingRuleNames.length > 0) {
      const isDuplicate = existingRuleNames.some(
        (existingName) => existingName.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        setErrorMessage(`Rule "${trimmedName}" already exists`);
      }
    }
  };

  const handleAdd = () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) {
      setErrorMessage('Rule name cannot be empty');
      return;
    }
    
    // Final duplicate check before adding
    if (existingRuleNames.length > 0) {
      const isDuplicate = existingRuleNames.some(
        (existingName) => existingName.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        setErrorMessage(`Rule "${trimmedName}" already exists. Please choose a different name.`);
        return;
      }
    }
    
    // Clear error and proceed
    setErrorMessage('');
    onAdd(trimmedName);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      // Reset state when dialog closes
      onRuleNameChange('');
      setErrorMessage('');
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Validation Rule</DialogTitle>
          <DialogDescription>
            Give your new validation rule a unique name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rule-name" className="text-right">
              Rule Name
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="rule-name"
                value={ruleName}
                onChange={(e) => handleRuleNameChange(e.target.value)}
                className={errorMessage ? 'border-destructive' : ''}
                placeholder="e.g., Paytm_Voucher_sap"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ruleName.trim() && !errorMessage) {
                    handleAdd();
                  }
                }}
              />
              {errorMessage && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleAdd} 
            disabled={!ruleName.trim() || !!errorMessage}
          >
            Add Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddRuleDialogProps {
  isOpen: boolean;
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddRuleDialog({
  isOpen,
  ruleName,
  onRuleNameChange,
  onAdd,
  onClose,
}: AddRuleDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Rule</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Enter rule name"
          value={ruleName}
          onChange={(e) => onRuleNameChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') onAdd();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onAdd}>Add Rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

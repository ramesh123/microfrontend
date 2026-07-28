import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Source } from '@/types';

interface AddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRule: (name: string, isSelfMatch: boolean, selfMatchSourceId?: string, selfMatchDebitCreditColumn?: string) => void;
  sources: Source[];
}

export const AddRuleDialog = ({ open, onOpenChange, onAddRule, sources }: AddRuleDialogProps) => {
  const [ruleName, setRuleName] = useState('');
  const [isSelfMatch, setIsSelfMatch] = useState(false);
  const [selfMatchSourceId, setSelfMatchSourceId] = useState<string | undefined>();
  const [debitCreditColumn, setDebitCreditColumn] = useState<string | undefined>();

  const selectedSource = useMemo(() => {
    return sources.find(s => s.id === selfMatchSourceId);
  }, [sources, selfMatchSourceId]);

  useEffect(() => {
    if (selfMatchSourceId && !sources.some((s) => s.id === selfMatchSourceId)) {
      setSelfMatchSourceId(undefined);
      setDebitCreditColumn(undefined);
    }
  }, [sources, selfMatchSourceId]);

  const handleAdd = () => {
    if (ruleName.trim()) {
      onAddRule(ruleName.trim(), isSelfMatch, selfMatchSourceId, debitCreditColumn);
      setRuleName('');
      setIsSelfMatch(false);
      setSelfMatchSourceId(undefined);
      setDebitCreditColumn(undefined);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setRuleName('');
      setIsSelfMatch(false);
      setSelfMatchSourceId(undefined);
      setDebitCreditColumn(undefined);
    }
    onOpenChange(isOpen);
  };

  const handleSourceChange = (sourceId: string) => {
    setSelfMatchSourceId(sourceId);
    setDebitCreditColumn(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add New Matching Rule</DialogTitle>
          <DialogDescription>
            Give your new matching rule a unique name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-8">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rule-name" className="text-right">
              Rule Name
            </Label>
            <Input
              id="rule-name"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Strict Match"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="self-match" className="text-right">
              Reversal Match
            </Label>
            <div className="col-span-3 flex items-center">
              <Checkbox
                id="self-match"
                checked={isSelfMatch}
                onCheckedChange={(checked) => {
                  const on = !!checked;
                  setIsSelfMatch(on);
                  if (!on) {
                    setSelfMatchSourceId(undefined);
                    setDebitCreditColumn(undefined);
                  }
                }}
              />
            </div>
          </div>
          {isSelfMatch && (
            <div className="grid grid-cols-4 items-center gap-4">
              <div /> {/* This empty div keeps the indentation consistent with the rest of the form */}
              <div className="col-span-3 flex items-center gap-x-4">
                <div className="flex-1 flex items-center gap-2">
                  <Label htmlFor="source-select" className="whitespace-nowrap">
                    Source
                  </Label>
                  <Select value={selfMatchSourceId} onValueChange={handleSourceChange}>
                    <SelectTrigger id="source-select">
                      <SelectValue placeholder="Select Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map(source => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Label htmlFor="debit-credit-select" className="whitespace-nowrap">
                    Debit/Credit
                  </Label>
                  <Select value={debitCreditColumn} onValueChange={setDebitCreditColumn} disabled={!selectedSource}>
                    <SelectTrigger id="debit-credit-select">
                      <SelectValue placeholder="Select Column" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSource?.columns
                        .filter(col => col.name && col.name.trim() !== "") // Filter out empty or whitespace-only names
                        .map(col => (
                          <SelectItem key={col.id} value={col.name}>
                            {col.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!ruleName.trim() || (isSelfMatch && (!selfMatchSourceId || !debitCreditColumn))}>Add Rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

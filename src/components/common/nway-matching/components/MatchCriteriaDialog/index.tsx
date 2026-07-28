import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Source, MatchRule, MatchCriterion } from '@/types';
import { PlusCircle, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MatchCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: MatchRule;
  sources: Source[];
  onSave: (criteria: MatchCriterion[]) => void;
}

interface BuilderState {
  source2Id?: string;
  matchType?: 'MATCHED' | 'UNMATCHED';
  condition?: 'AND' | 'OR';
}

export const MatchCriteriaDialog = ({ open, onOpenChange, rule, sources, onSave }: MatchCriteriaDialogProps) => {
  
  console.log("Rule Match Criteria", rule.matchCriteria);
  
  const [localCriteria, setLocalCriteria] = useState<MatchCriterion[]>([]);
  const [builderStates, setBuilderStates] = useState<Record<string, BuilderState>>({});

  useEffect(() => {
    if (open) {
      setLocalCriteria(rule.matchCriteria || []);
      const initialStates: Record<string, BuilderState> = {};
      sources.forEach(source => {
        initialStates[source.id] = {};
      });
      setBuilderStates(initialStates);
    }
  }, [open, rule.matchCriteria, sources]);

  // Fixed: Proper grouping logic
  const groupedCriteria = useMemo(() => {
    const groups = new Map<string, MatchCriterion[]>();
  
    localCriteria.forEach((criterion) => {
      if (!groups.has(criterion.source1Id)) {
        groups.set(criterion.source1Id, []);
      }
      groups.get(criterion.source1Id)!.push(criterion);
    });
  
    // 🔑 Sort criteria so they display in proper chain order
    groups.forEach((criteria, key) => {
      groups.set(
        key,
        [...criteria].sort((a, b) => {
          // Put criteria with conditions (AND/OR) first in the chain
          if (a.condition && !b.condition) return -1;
          if (!a.condition && b.condition) return 1;
          return 0;
        })
      );
    });
  
    return groups;
  }, [localCriteria]);
  

  const updateBuilderState = (source1Id: string, update: Partial<BuilderState>) => {
    setBuilderStates(prev => ({
      ...prev,
      [source1Id]: { ...prev[source1Id], ...update },
    }));
  };

  const handleAddCriterion = (source1Id: string) => {
    const builderState = builderStates[source1Id];

    if (!builderState?.source2Id || !builderState?.matchType) {
      toast.error("Please select a source to compare with and a match type.");
      return;
    }

    const newCriterion: MatchCriterion = {
      id: `mc-${Date.now()}`,
      source1Id: source1Id,
      source2Id: builderState.source2Id,
      matchType: builderState.matchType,
      condition: builderState.condition,
    };

    setLocalCriteria(prev => {
      const updated = [...prev, newCriterion];
      return updated;
    });
    
    setBuilderStates(prev => ({
      ...prev,
      [source1Id]: {},
    }));
  };

  const handleRemoveCriterion = (idToRemove: string) => {
    setLocalCriteria(prev => {
      const updated = prev.filter(c => c.id !== idToRemove);
      return updated;
    });
  };

  const handleSave = () => {
    onSave(localCriteria);
    onOpenChange(false);
  };

  const getSourceName = (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId || s.id === sourceId.replace('_right', ''));
    return source?.name || sourceId;
  };

  const badgeClass = (type: 'source' | 'match' | 'condition', value?: string) => {
    if (type === 'source') return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
    if (type === 'condition') return 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300';
    if (type === 'match') {
      return value === 'MATCHED'
        ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300'
        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl lg:max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Match Criteria for "{rule.name}"</DialogTitle>
          <DialogDescription>
            Build conditional logic by comparing the match status between sources.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden py-4">
          <div className="space-y-2 px-1 overflow-y-auto max-h-[40vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <h4 className="text-sm font-medium sticky top-0 bg-background pb-2 z-10">Criteria Builder</h4>
            {sources.map((source1) => {
              const builderState = builderStates[source1.id] || {};
              const availableSource2 = rule.isSelfMatch ? sources : sources.filter(s => s.id !== source1.id);
              const isAddable = builderState.source2Id && builderState.matchType;

              return (
                <div key={source1.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                  <Select value={source1.id} disabled>
                    <SelectTrigger className="w-40 bg-background font-medium">
                      <SelectValue>{getSourceName(source1.id)}</SelectValue>
                    </SelectTrigger>
                  </Select>

                  <div className="w-40">
                    <Select
                      value={builderState.source2Id || ''}
                      onValueChange={(value) => {
                        const finalValue = value === '__RESET__' ? undefined : value;
                        updateBuilderState(source1.id, { source2Id: finalValue });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Compare with..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__RESET__" className="text-muted-foreground italic">Compare with...</SelectItem>
                        {availableSource2.map(s => <SelectItem key={s.id} value={s.id}>{getSourceName(s.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-40">
                    <Select
                      value={builderState.matchType || ''}
                      onValueChange={(value) => {
                        const finalValue = value === '__RESET__' ? undefined : (value as 'MATCHED' | 'UNMATCHED');
                        updateBuilderState(source1.id, { matchType: finalValue });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Match Type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__RESET__" className="text-muted-foreground italic">Match Type...</SelectItem>
                        <SelectItem value="MATCHED">Matched</SelectItem>
                        <SelectItem value="UNMATCHED">Unmatched</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="w-32">
                    <Select
                      value={builderState.condition || ''}
                      onValueChange={(value) => {
                        const finalValue = value === '__RESET__' ? undefined : (value as 'AND' | 'OR');
                        updateBuilderState(source1.id, { condition: finalValue });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Condition..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__RESET__" className="text-muted-foreground italic">Condition...</SelectItem>
                        <SelectItem value="AND">AND</SelectItem>
                        <SelectItem value="OR">OR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={() => handleAddCriterion(source1.id)} size="sm" disabled={!isAddable} className="ml-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex-1 border rounded-md overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 min-h-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Source</TableHead>
                  <TableHead>Criteria Chain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localCriteria.length > 0 ? (
                  (() => {
                    const entries = Array.from(groupedCriteria.entries());
                    
                    return entries.map(([source1Id, criteriaList], rowIndex) => {
                      
                      return (
                        <TableRow key={source1Id}>
                          <TableCell className="font-medium align-top pt-4">
                             <Badge variant="outline" className={cn('font-semibold text-base p-2', badgeClass('source'))}>
                               {getSourceName(source1Id)}
                             </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
                              {criteriaList.map((criterion, index) => {
                                return (
                                  <React.Fragment key={criterion.id}>
                                    {index > 0 && <ArrowRight className="h-5 w-5 text-muted-foreground" />}
                                    
                                    <div className="flex items-center gap-2 p-1.5 border rounded-md bg-background shadow-sm">
                                      <Badge variant="outline" className={cn('font-semibold', badgeClass('match', criterion.matchType))}>
                                        {criterion.matchType}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">with</span>
                                      <Badge variant="outline" className={cn('font-semibold', badgeClass('source'))}>
                                        {getSourceName(criterion.source2Id)}
                                      </Badge>
                                      {criterion.condition && (
                                        <>
                                          <div className="w-px h-4 bg-border mx-1"></div>
                                          <Badge variant="outline" className={cn('font-semibold', badgeClass('condition'))}>
                                            {criterion.condition}
                                          </Badge>
                                        </>
                                      )}
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRemoveCriterion(criterion.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                      No match criteria defined for this rule.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
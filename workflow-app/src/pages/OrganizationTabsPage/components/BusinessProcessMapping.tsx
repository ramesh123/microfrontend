import { useState, useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from 'lucide-react';
import { MappedProcess } from '../data/mockData';

interface BusinessProcessMappingProps {
  data: MappedProcess[];
}

export function BusinessProcessMapping({ data }: BusinessProcessMappingProps) { 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allTransactionIds = useMemo(() => new Map(data.flatMap(p => p.subProcesses.flatMap(sp => sp.transactions.map(t => [t.id, { parentSubProcessId: sp.id, parentProcessId: p.id }])))), [data]);
  const allSubProcessIds = useMemo(() => new Map(data.flatMap(p => p.subProcesses.map(sp => [sp.id, { parentProcessId: p.id, childTransactionIds: sp.transactions.map(t => t.id) }]))), [data]);
  const allProcessIds = useMemo(() => new Map(data.map(p => [p.id, { childSubProcessIds: p.subProcesses.map(sp => sp.id), childTransactionIds: p.subProcesses.flatMap(sp => sp.transactions.map(t => t.id)) }])), [data]);

  const toggleSelection = (id: string, type: 'process' | 'subprocess' | 'transaction') => {
    const newSelectedIds = new Set(selectedIds);
    let idsToToggle: string[] = [];
    let isCurrentlySelectedOrIndeterminate = false;
    if (type === 'process') {
      idsToToggle = allProcessIds.get(id)?.childTransactionIds || [];
      isCurrentlySelectedOrIndeterminate = getCheckedState(idsToToggle).state !== false;
    } else if (type === 'subprocess') {
      idsToToggle = allSubProcessIds.get(id)?.childTransactionIds || [];
      isCurrentlySelectedOrIndeterminate = getCheckedState(idsToToggle).state !== false;
    } else {
      idsToToggle = [id];
      isCurrentlySelectedOrIndeterminate = newSelectedIds.has(id);
    }

    if (isCurrentlySelectedOrIndeterminate) {
      idsToToggle.forEach(childId => newSelectedIds.delete(childId));
    } else {
      idsToToggle.forEach(childId => newSelectedIds.add(childId));
    }

    setSelectedIds(newSelectedIds);
  };

  const getCheckedState = (childTransactionIds: string[]): { state: boolean | 'indeterminate' } => {
    if (childTransactionIds.length === 0) return { state: false };
    const selectedCount = childTransactionIds.filter(id => selectedIds.has(id)).length;
    if (selectedCount === 0) return { state: false };
    if (selectedCount === childTransactionIds.length) return { state: true };
    return { state: 'indeterminate' };
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Business Process Mapping</h3>
      {data.map(process => {
        const processInfo = allProcessIds.get(process.id)!;
        const processCheckedState = getCheckedState(processInfo.childTransactionIds);

        return (
          <Collapsible key={process.id} defaultOpen className="group">
            <div className="flex items-center space-x-2 p-2 bg-muted/60 rounded-lg">
              <Checkbox
                id={`process-${process.id}`}
                checked={processCheckedState.state}
                onCheckedChange={() => toggleSelection(process.id, 'process')}
              />
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between flex-1 cursor-pointer">
                  <label htmlFor={`process-${process.id}`} className="font-semibold text-foreground">{process.name}</label>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              {process.subProcesses.map(subProcess => {
                const subProcessInfo = allSubProcessIds.get(subProcess.id)!;
                const subProcessCheckedState = getCheckedState(subProcessInfo.childTransactionIds);

                return (
                  <Collapsible key={subProcess.id} defaultOpen className="group/sub">
                    <div className="flex items-center space-x-2 p-2 bg-muted/80 rounded-lg">
                      <Checkbox
                        id={`subprocess-${subProcess.id}`}
                        checked={subProcessCheckedState.state}
                        onCheckedChange={() => toggleSelection(subProcess.id, 'subprocess')}
                      />
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between flex-1 cursor-pointer">
                          <label htmlFor={`subprocess-${subProcess.id}`} className="font-medium text-foreground">{subProcess.name}</label>
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="pl-6 pt-2">
                      <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                        <h4 className="font-semibold text-primary">Transactions</h4>
                        <p className="text-sm text-muted-foreground">SAP</p>
                        <div className="space-y-1">
                          {subProcess.transactions.map(transaction => (
                            <div key={transaction.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`transaction-${transaction.id}`}
                                checked={selectedIds.has(transaction.id)}
                                onCheckedChange={() => toggleSelection(transaction.id, 'transaction')}
                              />
                              <label htmlFor={`transaction-${transaction.id}`} className="text-sm text-foreground">
                                {transaction.name} ({transaction.code})
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

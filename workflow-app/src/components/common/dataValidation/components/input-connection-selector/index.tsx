import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import useSourceNodes from '@/hooks/use-source-nodes';

export interface InputConnection {
    id: string;
    name: string;
    columns: { id: string; name: string; type: string }[];
}

interface ConnectionSelectorProps {
    selectedSourceId: string | null;
    selectedTargetId: string | null;
    onSourceSelect: (sourceId: string | null) => void;
    onTargetSelect: (targetId: string | null) => void;
    sourceLabel?: string;
    targetLabel?: string;
    className?: string;
}

const ConnectionSelector: React.FC<ConnectionSelectorProps> = ({
    selectedSourceId,
    selectedTargetId,
    onSourceSelect,
    onTargetSelect,
    sourceLabel = "Source",
    targetLabel = "Target",
    className,
}) => {
    const [sourceOpen, setSourceOpen] = useState(false);
    const [targetOpen, setTargetOpen] = useState(false);
    const { sourceNodes } = useSourceNodes();

    const getNodeLabel = (node: any) =>
        node?.data?.display_name ||
        node?.data?.node?.title ||
        node?.data?.name ||
        node?.id ||
        'Unnamed Node';

    const getColumnsFromNode = (node: any) => {
        const columnNames = node.data?.node?.output?.columns || node.data?.columns || [];
        return columnNames.map((col: string, index: number) => ({
            id: `${node.id}_col_${index}`,
            name: col,
            type: 'VARCHAR'
        }));
    };

    const availableConnections: InputConnection[] = sourceNodes.map(node => ({
        id: node.id,
        name: getNodeLabel(node),
        columns: getColumnsFromNode(node)
    }));

    if (availableConnections.length === 0) {
        return (
            <div className={cn("w-full max-w-xl rounded-md border border-dashed border-border bg-muted/20 p-2 text-center text-sm", className)}>
                <div className="text-center text-muted-foreground">
                    No data source connections available in the flow.
                </div>
            </div>
        );
    }

    const selectedSource = availableConnections.find(c => c.id === selectedSourceId);
    const selectedTarget = availableConnections.find(c => c.id === selectedTargetId);

    return (
        <div className={cn("w-full max-w-xl rounded-md border border-border/60 bg-muted/10 px-2 py-1.5", className)}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="min-w-0 space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{sourceLabel}</label>
                    <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={sourceOpen} className="h-8 w-full justify-between text-sm">
                                {selectedSource ? <span className="truncate">{selectedSource.name}</span> : "Select connection..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search connections..." />
                                <CommandList>
                                    <CommandEmpty>No connections found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { onSourceSelect(null); setSourceOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", !selectedSourceId ? "opacity-100" : "opacity-0")} />
                                            None
                                        </CommandItem>
                                        {availableConnections
                                            .filter(connection => connection.id !== selectedTargetId)
                                            .map((connection) => (
                                                <CommandItem key={connection.id} onSelect={() => { onSourceSelect(connection.id); setSourceOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", selectedSourceId === connection.id ? "opacity-100" : "opacity-0")} />
                                                    {connection.name}
                                                </CommandItem>
                                            ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="min-w-0 space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{targetLabel}</label>
                    <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={targetOpen} className="h-8 w-full justify-between text-sm">
                                {selectedTarget ? <span className="truncate">{selectedTarget.name}</span> : "Select connection..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search connections..." />
                                <CommandList>
                                    <CommandEmpty>No connections found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { onTargetSelect(null); setTargetOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", !selectedTargetId ? "opacity-100" : "opacity-0")} />
                                            None
                                        </CommandItem>
                                        {availableConnections
                                            .filter(connection => connection.id !== selectedSourceId)
                                            .map((connection) => (
                                                <CommandItem key={connection.id} onSelect={() => { onTargetSelect(connection.id); setTargetOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", selectedTargetId === connection.id ? "opacity-100" : "opacity-0")} />
                                                    {connection.name}
                                                </CommandItem>
                                            ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
};

export default ConnectionSelector;

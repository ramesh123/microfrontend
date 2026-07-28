import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STRING_OPERATIONS } from '@/types/deriveColumn';

interface OperationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  operationsSet?: any[];
}
import {
  Command,
  CommandInput,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { AlternativeSelect } from '@/components/ui/alternative-select';

export const OperationSelector: React.FC<OperationSelectorProps> = ({ value, onChange, operationsSet = STRING_OPERATIONS }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Operation</label>
      {/* <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full !h-auto">
          <SelectValue placeholder="Choose an Operation" />
        </SelectTrigger>
        <SelectContent>
          {operationsSet.map((op) => (
            <SelectItem key={op.name} value={op.name}>
              <div className="flex flex-col py-1">
                <span className="font-medium">{op.display_name}</span>
                <span className="text-xs text-muted-foreground whitespace-normal max-w-[300px]">
                  {op.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select> */}
      <AlternativeSelect 
        value={value}
        onChange={onChange}
        options={operationsSet.map(op => ({
          label: op.display_name,
          value: op.name,
          description: op.description

        }))}
        className="w-[350px]" 
      />
    </div>
  );
};

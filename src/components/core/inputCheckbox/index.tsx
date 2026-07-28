import React from 'react';
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface InputCheckboxProps {
  name: string;
  displayName: string;
  required?: boolean;
  info?: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
}

const InputCheckbox: React.FC<InputCheckboxProps> = ({
  name,
  displayName,
  required = false,
  info,
  checked = false,
  onChange
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-start space-x-2">
        <Checkbox
          id={name}
          checked={checked}
          onCheckedChange={onChange}
          required={required}
        />
        <div className="flex items-center gap-1">
          <Label htmlFor={name} className="cursor-pointer">
            {displayName} {required && <span className="text-slate-700">*</span>}
          </Label>
          {info && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{info}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
};

export default InputCheckbox;
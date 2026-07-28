import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface InputNumberProps {
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: number | string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputNumber: React.FC<InputNumberProps> = ({
  name,
  displayName,
  placeholder = "",
  required = false,
  info,
  value = "",
  min,
  max,
  step = 1,
  onChange
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={name}>
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
      <Input
        type="number"
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    </div>
  );
};

export default InputNumber;
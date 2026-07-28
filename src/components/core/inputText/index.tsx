import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { cn } from '@/lib/utils';

interface InputTextProps {
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: any;
  id?: string;
  className?: string;
  position?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * A single-line text input component, with a label and optional tooltip.
 *
 * @param name The name of the input element.
 * @param displayName The display name of the input element.
 * @param placeholder An optional placeholder string.
 * @param required If the input element is required.
 * @param info An optional tooltip string.
 * @param value The current value of the input element.
 * @param id An optional ID for the input element.
 * @param className An optional class name for the input element.
 * @param onChange A callback function to handle changes to the input element.
 */
const InputText: React.FC<InputTextProps> = ({
  name,
  displayName,
  placeholder = "",
  required = false,
  info,
  value,
  id,
  className,
  position,
  onChange
}) => {
  return ( 
    <div className="space-y-2">
      <div className="flex items-center gap-1 mb-0">
        <Label htmlFor={name} className="text-sm font-medium text-gray-700 cursor-help inline-flex items-center gap-1">
          {displayName} {required && <span className="text-red-600">*</span>}
        </Label>
        {info && ( 
          <ShadTooltip content={info}>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </ShadTooltip>
        )}
      </div>
      <Input
        type="text"
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        value={value || ""}
        onChange={onChange}
        className={cn(className, "w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary")}
      />
    </div>
  );
};

export default InputText;
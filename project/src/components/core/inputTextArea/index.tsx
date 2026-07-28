import React from 'react';
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ShadTooltip from "@/components/common/shadTooltipComponent";

interface InputTextAreaProps {
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: any;
  position?: number;
  id?: string;
  className?: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const InputTextArea: React.FC<InputTextAreaProps> = ({
  name,
  displayName,
  placeholder = "",
  required = false,
  info,
  value = "",
  position,
  id,
  className,
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
      <Textarea
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        className={cn("text-sm border border-gray-300 rounded-md px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary", className)}
      />
    </div>
  );
};

export default InputTextArea;
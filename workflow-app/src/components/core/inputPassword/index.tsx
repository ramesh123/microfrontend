import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Eye, EyeOff, EyeOffIcon, EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

interface InputPasswordProps { 
  id: string;
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: any;
  position?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const InputPassword: React.FC<InputPasswordProps> = ({ 
  id,
  name,
  displayName,
  placeholder = "",
  required = false,
  info,
  value = "",
  position,
  onChange,
  className
}) => { 
  const [showPassword, setShowPassword] = useState(false);
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
      
      <div className="relative flex items-center rounded-md border focus-within:ring-1 focus-within:ring-ring px-2">
        <Input
          type={showPassword ? "text" : "password"}
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          className={cn(className, "w-full text-sm border-0 py-2 focus:outline-none focus-visible:ring-0 shadow-none")}
        />
        <button type="button" className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <EyeOffIcon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <EyeIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
};

export default InputPassword;
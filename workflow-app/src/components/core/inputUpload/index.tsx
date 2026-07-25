import React, { useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus, Info, X } from "lucide-react";

interface InputUploadProps {
  name: string;
  displayName?: string;
  required?: boolean;
  info?: string;
  accept?: string;
  multiple?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  initialFileName?: string; // Pre-uploaded file name from dataset
}

const InputUpload: React.FC<InputUploadProps> = ({
  name,
  displayName,
  required = false,
  info,
  accept,
  multiple = false,
  onChange,
  initialFileName
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>(initialFileName || '');

  // Update fileName when initialFileName changes (e.g., when reopening the form)
  React.useEffect(() => {
    if (initialFileName) {
      setFileName(initialFileName);
    }
  }, [initialFileName]);

  const handleButtonClick = () => {
    // Trigger the hidden file input click event
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : '');
    // Propagate the original event to the parent form
    onChange(e);
  };
  
  const handleClearFile = () => {
    setFileName('');
    if (inputRef.current) {
      inputRef.current.value = ''; // Clear the input's value
    }
    // Simulate a change event with no files to clear the state in the parent form
    const emptyEvent = {
      target: { files: null, name },
      currentTarget: { files: null, name }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChange(emptyEvent);
  };

  return (
    <div className="space-y-1">
      {displayName && (
        <div className="flex items-center gap-1">
          <Label htmlFor={name}>
            {displayName} {required && <span className="text-slate-700">*</span>}
          </Label>
        </div>
      )}

      {/* Hidden file input that we control via a ref */}
      <Input
        type="file"
        id={name}
        name={name}
        ref={inputRef}
        required={required}
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden" // Visually hide the default input
      />

      <div className="flex items-center gap-2">
        {/* The styled button that users will click */}
        <Button
          type="button" // Important to prevent form submission
          onClick={handleButtonClick}
          variant="default"
          className="h-7 px-2.5 text-xs"
          size="sm"
        >
          <Plus
            aria-hidden="false"
            className="h-3.5 w-3.5"
          />
          <span className="whitespace-nowrap font-medium ml-1.5">
            Upload
          </span>
        </Button>

        {/* Display the selected file name */}
        {fileName && (
          <div className="flex items-center gap-1.5 text-xs border px-2 py-1 rounded-md bg-muted/50 max-w-[200px]">
            <span className="text-foreground truncate">{fileName}</span>
            {initialFileName && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">(Uploaded)</span>
            )}
            {!initialFileName && (
              <Button variant="ghost" size="icon" className="h-4 w-4 flex-shrink-0" onClick={handleClearFile}>
                  <X className="h-3 w-3"/>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InputUpload;
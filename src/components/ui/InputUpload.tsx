import React, { useRef, useState } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { uploadFileApi } from '@/controllers/API/apiService';
import { Loader2, Upload, File as FileIcon } from 'lucide-react';

interface InputUploadProps {
  name: string;
  displayName: string;
  required?: boolean;
  info?: string;
}

export const InputUpload: React.FC<InputUploadProps> = ({ name, displayName, required, info }) => {
  const { setValue, getValues } = useFormContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(getValues('file_name') || null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await uploadFileApi(formData);

      if (response && response.unique_id) {
        setValue('encrypted_file_key', response.encrypted_file_key, { shouldDirty: true });
        setValue('file_name', response.file_name, { shouldDirty: true });
        setValue('size', response.size, { shouldDirty: true });
        setValue(name, response.unique_id, { shouldDirty: true });
        setValue('source_path', response.unique_id, { shouldDirty: true });

        toast.success(response.message || 'File uploaded successfully');
      } else {
        throw new Error(response.message || 'Invalid response from server');
      }
    } catch (error) {
      const errorMessage = getDisplayErrorMessage(error, 'File upload failed');
      toast.error(errorMessage);
      setFileName(null); // Clear file name on error
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
        {displayName}
        {required && <span className="text-red-500 text-base ml-1">*</span>}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={name}
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
        <Button type="button" variant="outline" onClick={handleButtonClick} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {uploading ? 'Uploading...' : 'Choose File'}
        </Button>
        {fileName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2 flex-grow">
            <FileIcon className="h-4 w-4" />
            <span className="truncate">{fileName}</span>
          </div>
        )}
      </div>
      {info && <p className="text-xs text-muted-foreground mt-1">{info}</p>}
    </div>
  );
};
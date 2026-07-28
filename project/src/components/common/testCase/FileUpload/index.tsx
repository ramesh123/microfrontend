import React, { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Search } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isUploading?: boolean;
  onSearch?: (searchTerm: string) => void;
  mode?: 'view' | 'edit';
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  isUploading = false,
  onSearch ,
  mode = 'edit'
}) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(event.target.value);
    }
  }, [onSearch]);

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      {/* Search Box - Left Side */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search test cases..."
            className="pl-10 border border-gray-300 rounded-md h-10"
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Upload Button - Right Side */}
      <div className="flex items-center gap-2">
        <Input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".json,.csv,.xlsx,.xml"
          disabled={isUploading}
        />
        <Button
          variant="default"
          disabled={isUploading || mode === 'view'}
          onClick={() => document.getElementById('file-upload')?.click()}
          className="flex items-center gap-2 disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload Report'}
        </Button>
      </div>
    </div>
  );
};

import * as React from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';

const MAX_BACKGROUND_IMAGE_BYTES = 3 * 1024 * 1024;
const BACKGROUND_IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

function isBackgroundImageFile(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type);
}

export function BigNumberCardBackgroundImageSection({
  options,
  onOptionsChange,
}: {
  options: BigNumberCustomizationOptions;
  onOptionsChange: (next: BigNumberCustomizationOptions) => void;
}) {
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const imageUrl = options.cardBackgroundImage?.trim() ?? '';

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setUploadError(null);
    if (!file) return;

    if (!isBackgroundImageFile(file)) {
      setUploadError('Upload PNG, JPG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      setUploadError('Image must be 3 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setUploadError('Could not read image file.');
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        setUploadError('Invalid image file.');
        return;
      }
      onOptionsChange({ ...(options || {}), cardBackgroundImage: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <input
        ref={inputRef}
        type="file"
        accept={BACKGROUND_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleUpload}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7 gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload background
        </Button>
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!h-7 gap-1.5 text-muted-foreground"
            onClick={() => onOptionsChange({ ...(options || {}), cardBackgroundImage: '' })}
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      {imageUrl ? (
        <div
          className="h-16 w-full overflow-hidden rounded-md border border-border/70 bg-muted/20 bg-cover bg-center"
          style={{ backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` }}
          role="img"
          aria-label="Card background preview"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Optional image behind the card colour gradient (PNG, JPG, WebP, GIF).
        </p>
      )}
    </div>
  );
}

import { useRef } from 'react';
import type { FormApiLogicStep, FormBuilderField, FormFieldValue } from '../../types';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isFormButtonType, isDisplayFieldType } from '../../lib/field/field.utils';
import { FormDateRangePicker } from './FormDateRangePicker';
import { FormBigNumber } from './FormBigNumber';
import { FormDataTable } from './FormDataTable';
import { LocationPicker } from './LocationPicker';
import { SignaturePad } from './SignaturePad';

import { SectionDivider } from './SectionDivider';

interface FormFieldRendererProps {
  field: FormBuilderField;
  value: FormFieldValue;
  interactive: boolean;
  onChange: (name: string, value: FormFieldValue) => void;
  variant?: 'default' | 'canvas' | 'runtime';
  onCancel?: () => void;
  apiSteps?: FormApiLogicStep[];
  /** Stretch display widgets (e.g. big number) to the grid cell height from resize. */
  fillHeight?: boolean;
}

function FieldLabel({ field, variant }: { field: FormBuilderField; variant?: 'default' | 'canvas' | 'runtime' }) {
  if (field.type === 'checkbox' || field.type === 'switch' || field.type === 'section_divider' || isFormButtonType(field.type) || isDisplayFieldType(field.type)) {
    return null;
  }
  return (
    <Label
      className={cn(
        'text-sm',
        variant === 'runtime' && 'text-xs font-medium',
        variant === 'canvas' && 'text-[11px] font-medium leading-none',
      )}
    >
      {field.displayName}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );
}

function UploadField({
  field,
  value,
  interactive,
  multiple,
  accept,
  onChange,
  variant,
}: {
  field: FormBuilderField;
  value: FormFieldValue;
  interactive: boolean;
  multiple?: boolean;
  accept?: string;
  onChange: (name: string, value: FormFieldValue) => void;
  variant?: 'default' | 'canvas' | 'runtime';
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedFiles = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];

  const selectedLabel =
    multiple && selectedFiles.length > 1
      ? `${selectedFiles.length} files selected`
      : selectedFiles.length > 0
        ? selectedFiles.join(', ')
        : null;

  const openFilePicker = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (interactive) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (multiple) {
      const existing = Array.isArray(value) ? value : [];
      const nextNames = files.map((file) => file.name);
      onChange(field.name, [...existing, ...nextNames.filter((name) => !existing.includes(name))]);
    } else {
      onChange(field.name, files[0]?.name ?? '');
    }

    event.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openFilePicker(event);
        }
      }}
      className={cn(
        'flex w-full flex-col items-center justify-center rounded-md border border-dashed border-gray-border bg-gray-panel-muted px-3 py-4 text-center',
        variant === 'canvas' ? 'min-h-[64px] py-3' : 'min-h-[80px]',
        interactive
          ? 'cursor-pointer hover:border-primary/40 hover:bg-gray-surface-hover'
          : 'cursor-default opacity-90',
      )}
    >
      <Upload className={cn('mb-1.5 text-gray-text-muted', variant === 'canvas' ? 'h-4 w-4' : 'h-5 w-5')} />
      {selectedLabel ? (
        <>
          <p className="max-w-full truncate text-xs font-medium text-gray-text">{selectedLabel}</p>
          {multiple && selectedFiles.length > 0 && (
            <p className="mt-1 max-w-full truncate text-[10px] text-gray-text-muted">{selectedFiles.join(', ')}</p>
          )}
        </>
      ) : (
        <>
          <p className={cn('text-gray-text-muted', variant === 'canvas' ? 'text-[11px]' : 'text-sm')}>
            {multiple ? 'Drop files here or ' : 'Drop a file here or '}
            <span className="text-primary">browse</span>
          </p>
          <p className="mt-0.5 text-[10px] text-gray-text-muted">
            {multiple
              ? 'Hold Ctrl/Cmd to select multiple files'
              : accept?.includes('image')
                ? 'Image file'
                : 'Single file upload'}
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple === true}
        className="hidden"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onChange={handleFileChange}
      />
    </div>
  );
}

export function FormFieldRenderer({
  field,
  value,
  interactive,
  onChange,
  variant = 'default',
  onCancel,
  apiSteps = [],
  fillHeight = false,
}: FormFieldRendererProps) {
  const stringValue = typeof value === 'string' ? value : '';
  const arrayValue = Array.isArray(value) ? value : [];
  const boolValue = typeof value === 'boolean' ? value : false;

  if (field.type === 'section_divider') {
    return <SectionDivider field={field} variant={variant} />;
  }

  if (field.type === 'big_number') {
    return (
      <FormBigNumber
        field={field}
        value={stringValue}
        variant={variant}
        fillHeight={fillHeight || variant === 'canvas' || variant === 'runtime'}
      />
    );
  }

  if (field.type === 'data_table') {
    return (
      <FormDataTable
        field={field}
        value={value}
        variant={variant}
        apiSteps={apiSteps}
      />
    );
  }

  if (field.type === 'submit_button' || field.type === 'cancel_button') {
    const isSubmit = field.type === 'submit_button';
    return (
      <div className={cn('flex w-full', variant === 'canvas' && 'pt-1')}>
        <Button
          type={isSubmit && interactive ? 'submit' : 'button'}
          variant={isSubmit ? 'default' : 'outline'}
          disabled={!interactive && variant !== 'canvas'}
          className={cn(
            'w-full',
            variant === 'canvas' && '!h-7.5 text-xs !px-2',
            !isSubmit && interactive && 'pointer-events-auto',
          )}
          onClick={
            !isSubmit && interactive
              ? (event) => {
                  event.preventDefault();
                  onCancel?.();
                }
              : undefined
          }
        >
          {field.displayName || (isSubmit ? 'Submit' : 'Cancel')}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full min-w-0',
        variant === 'canvas' && 'space-y-1',
        variant === 'runtime' && 'space-y-1',
        variant !== 'canvas' && variant !== 'runtime' && 'space-y-1.5',
      )}
    >
      <FieldLabel field={field} variant={variant} />

      {(field.type === 'text' ||
        field.type === 'password' ||
        field.type === 'number' ||
        field.type === 'address') && (
        <Input
          type={
            field.type === 'password'
              ? 'password'
              : field.type === 'number'
                ? 'number'
                : 'text'
          }
          placeholder={field.placeholder}
          disabled={!interactive}
          value={stringValue}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cn('h-8', variant === 'canvas' && 'h-7 text-xs')}
        />
      )}

      {field.type === 'date' && (
        <FormDateRangePicker
          value={stringValue}
          disabled={!interactive}
          variant={variant}
          idPrefix={`${field.id}-date`}
          presets={field.datePresets}
          allowCustomRange={field.allowCustomRange ?? true}
          datePickerColor={field.datePickerColor}
          onChange={(next) => onChange(field.name, next)}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          placeholder={field.placeholder}
          disabled={!interactive}
          rows={3}
          value={stringValue}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )}

      {(field.type === 'select' || field.type === 'country' || field.type === 'state' || field.type === 'city') && (
        <Select
          disabled={!interactive}
          value={stringValue || undefined}
          onValueChange={(next) => onChange(field.name, next)}
        >
          <SelectTrigger className={cn('h-8 w-full max-w-full', variant === 'canvas' && 'h-7 text-xs')}>
            <SelectValue placeholder={field.placeholder ?? 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'multi_select' && (
        <MultiSelectCombobox
          options={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          value={arrayValue}
          onChange={(next) => onChange(field.name, next.map(String))}
          placeholder={field.placeholder ?? 'Select options'}
          disabled={!interactive}
        />
      )}

      {field.type === 'radio' && (
        <RadioGroup
          disabled={!interactive}
          value={stringValue}
          onValueChange={(next) => onChange(field.name, next)}
          className="gap-2"
        >
          {(field.options ?? []).map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={`${field.id}-${option.value}`} />
              <Label htmlFor={`${field.id}-${option.value}`} className="text-sm font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {field.type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <Checkbox
            disabled={!interactive}
            checked={boolValue}
            onCheckedChange={(checked) => onChange(field.name, checked === true)}
          />
          <Label className="text-sm">
            {field.displayName}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
        </div>
      )}

      {field.type === 'checkbox_group' && (
        <div className="space-y-2 rounded-md border border-gray-border p-3">
          {(field.options ?? []).map((option) => {
            const checked = arrayValue.includes(option.value);
            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  disabled={!interactive}
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    const next = nextChecked
                      ? [...arrayValue, option.value]
                      : arrayValue.filter((v) => v !== option.value);
                    onChange(field.name, next);
                  }}
                />
                <Label className="text-sm font-normal">{option.label}</Label>
              </div>
            );
          })}
        </div>
      )}

      {field.type === 'switch' && (
        <div className="flex items-center gap-3">
          <Switch
            disabled={!interactive}
            checked={boolValue}
            onCheckedChange={(checked) => onChange(field.name, checked)}
          />
          <Label className="text-sm">
            {field.displayName}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
        </div>
      )}

      {field.type === 'segmented' && (
        <ToggleGroup
          type="single"
          value={stringValue}
          onValueChange={(next) => next && onChange(field.name, next)}
          className="w-full flex-wrap justify-start"
          disabled={!interactive}
        >
          {(field.options ?? []).map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="px-3 text-xs">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {field.type === 'file_upload' && (
        <UploadField
          field={field}
          value={stringValue}
          interactive={interactive}
          onChange={onChange}
          variant={variant}
        />
      )}

      {field.type === 'image_upload' && (
        <UploadField
          field={field}
          value={stringValue}
          interactive={interactive}
          accept="image/*"
          onChange={onChange}
          variant={variant}
        />
      )}

      {field.type === 'multiple_file_upload' && (
        <UploadField
          field={field}
          value={arrayValue}
          interactive={interactive}
          multiple
          onChange={onChange}
          variant={variant}
        />
      )}

      {field.type === 'signature_pad' && (
        <SignaturePad
          value={stringValue}
          disabled={!interactive}
          variant={variant}
          onChange={(next) => onChange(field.name, next)}
        />
      )}

      {field.type === 'google_maps_location' && (
        <LocationPicker
          value={stringValue}
          disabled={!interactive}
          placeholder={field.placeholder ?? 'Search city, address, or place'}
          variant={variant}
          onChange={(next) => onChange(field.name, next)}
        />
      )}
    </div>
  );
}

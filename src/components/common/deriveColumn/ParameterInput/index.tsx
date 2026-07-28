
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Parameter, ConcatPart, ColumnSourceConfig, Column } from '@/types/deriveColumn';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ParameterInputProps {
  parameter: Parameter;
  value: any;
  onChange: (value: any) => void;
  availableColumns?: Column[];
  selectedRowIndex?: number;
  selectedColumn?: Column | null;
}

const ColumnSourceInput: React.FC<{
  config: ColumnSourceConfig | undefined;
  onChange: (config: ColumnSourceConfig) => void;
  availableColumns: Column[];
  selectedRowIndex: number;
}> = ({ config, onChange, availableColumns, selectedRowIndex }) => {
  const handleConfigChange = (newConfig: Partial<ColumnSourceConfig>) => {
    // Correctly merge the existing config with the new partial changes
    const currentConfig = config || { source_mode: 'full', column_id: '' };
    onChange({
      ...currentConfig,
      ...newConfig,
    });
  };

  const selectedColumn = useMemo(() => {
    return availableColumns.find(c => c.id === config?.column_id)
  }, [config?.column_id, availableColumns]);

  const previewValue = useMemo(() => {
    if (!selectedColumn) return 'N/A';
    let val = String(selectedColumn.sampleData[selectedRowIndex] ?? '');
    if (config?.source_mode === 'substring') {
      val = val.slice(config.start, config.end);
    }
    return `${config?.prefix || ''}${val}${config?.suffix || ''}`;
  }, [config, selectedColumn, selectedRowIndex]);

  return (
    <div className="space-y-3 p-2 bg-muted/50 rounded-lg">
      <Select
        value={config?.column_id}
        onValueChange={(columnId) => handleConfigChange({ column_id: columnId })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {availableColumns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {config?.column_id && (
        <>
          <RadioGroup
            value={config.source_mode}
            onValueChange={(source_mode: 'full' | 'substring') => handleConfigChange({ source_mode: source_mode })}
            className="flex gap-4 pt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id={`full-${config.column_id}-${Math.random()}`} />
              <Label htmlFor={`full-${config.column_id}-${Math.random()}`}>Full Column</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="substring" id={`substring-${config.column_id}-${Math.random()}`} />
              <Label htmlFor={`substring-${config.column_id}-${Math.random()}`}>Substring</Label>
            </div>
          </RadioGroup>

          {config.source_mode === 'substring' && (
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Start"
                value={config.start ?? ''}
                onChange={(e) => handleConfigChange({ start: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="End"
                value={config.end ?? ''}
                onChange={(e) => handleConfigChange({ end: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Prefix (optional)"
              value={config.prefix ?? ''}
              onChange={(e) => handleConfigChange({ prefix: e.target.value })}
            />
            <Input
              type="text"
              placeholder="Suffix (optional)"
              value={config.suffix ?? ''}
              onChange={(e) => handleConfigChange({ suffix: e.target.value })}
            />
          </div>

          <div className="p-2 bg-background rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Preview:</div>
            <div className="font-mono text-sm truncate">{previewValue}</div>
          </div>
        </>
      )}
    </div>
  );
};


export const ParameterInput: React.FC<ParameterInputProps> = ({
  parameter,
  value,
  onChange,
  availableColumns = [],
  selectedRowIndex = 0,
  selectedColumn = null,
}) => {  
  
  if (parameter.type === 'concat-sources') {  
    const sources: ConcatPart[] = Array.isArray(value) ? value : [];

    const handleAddSource = () => {
      const newSource: ConcatPart = {
        id: `concat-part-${Date.now()}`,
        type: 'manual',
        concat: 'prefix',
        value: ''
      };
      onChange([...sources, newSource]);
    };

    const handleUpdateSource = (id: string, newSourceData: Partial<ConcatPart>) => {
      onChange(sources.map(s => (s.id === id ? { ...s, ...newSourceData } : s)));
    };

    const handleDeleteSource = (id: string) => {
      onChange(sources.filter(s => s.id !== id));
    };

    return (
      <div className="space-y-3">
        <Label>{parameter.label}</Label>
        <p className="text-xs text-muted-foreground">{parameter.description}</p>
        <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
          {sources.map((source) => (
            <div key={source.id} className="flex items-start gap-2 p-2 bg-background rounded-md shadow-sm">
              <div className="flex-grow space-y-2">
                <RadioGroup
                  value={source.concat || 'prefix'}
                  onValueChange={(concat: 'prefix' | 'suffix') => handleUpdateSource(source.id, { concat })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="prefix" id={`prefix-${source.id}`} />
                    <Label htmlFor={`prefix-${source.id}`}>Prefix</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="suffix" id={`suffix-${source.id}`} />
                    <Label htmlFor={`suffix-${source.id}`}>Suffix</Label>
                  </div>
                </RadioGroup>
                <Select
                  value={source.type}
                  onValueChange={(type: 'manual' | 'column') => handleUpdateSource(source.id, { type, value: '', column_config: undefined })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Text</SelectItem>
                    <SelectItem value="column">From Column</SelectItem>
                  </SelectContent>
                </Select>
                {source.type === 'manual' ? (
                  <Input
                    type="text"
                    placeholder="Enter string..."
                    value={source.value || ''}
                    onChange={(e) => handleUpdateSource(source.id, { value: e.target.value })}
                    className="h-8"
                  />
                ) : (
                  <ColumnSourceInput
                    config={source.column_config}
                    onChange={(columnConfig) => handleUpdateSource(source.id, { column_config: columnConfig })}
                    availableColumns={availableColumns}
                    selectedRowIndex={selectedRowIndex}
                  />
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDeleteSource(source.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleAddSource} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Part to Concatenate
          </Button>
        </div>
      </div>
    );
  }

  const isColumnValue = value && typeof value === 'object' && value.source_mode;

  if (parameter.type === 'string-or-column') {
    const [inputMode, setInputMode] = useState<'manual' | 'column'>(isColumnValue ? 'column' : 'manual');

    // For manual input mode, determine if input should be numeric based on selected column type
    const isStringOrColumnNumeric = selectedColumn?.type === 'number';

    return (
      <div className="space-y-3">
        <Label htmlFor={parameter.name} className="text-sm font-medium">
          {parameter.label}
          {parameter.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={inputMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setInputMode('manual');
              if (isColumnValue) onChange('');
            }}
            className="flex-1"
          >
            Manual Input
          </Button>
          <Button
            type="button"
            variant={inputMode === 'column' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setInputMode('column');
              if (!isColumnValue) onChange({ source_mode: 'full', column_id: '' });
            }}
            className="flex-1"
          >
            From Column
          </Button>
        </div>

        {inputMode === 'manual' && (
          <Input
            id={parameter.name}
            type={isStringOrColumnNumeric ? 'number' : 'text'}
            value={isColumnValue ? '' : (value ?? '')}
            onChange={(e) => {
              // Convert to number if selected column is numeric, otherwise keep as string
              const newValue = isStringOrColumnNumeric
                ? (e.target.value === '' ? '' : Number(e.target.value))
                : e.target.value;
              onChange(newValue);
            }}
            placeholder={parameter.description}
            className="w-full"
          />
        )}

        {inputMode === 'column' && (
          <ColumnSourceInput
            config={isColumnValue ? value : undefined}
            onChange={onChange}
            availableColumns={availableColumns}
            selectedRowIndex={selectedRowIndex}
          />
        )}
        <p className="text-xs text-muted-foreground">{parameter.description}</p>
      </div>
    );
  }

  // Determine input type based on:
  // 1. parameter.type === 'number' -> always number input (e.g., greater_than, clip, round)
  // 2. parameter.type === 'string' AND selectedColumn.type === 'number' -> number input (e.g., equals, fill_null on numeric columns)
  const isNumeric = parameter.type === 'number' || (parameter.type === 'string' && selectedColumn?.type === 'number');

  return (
<div className="space-y-2">
    <Label htmlFor={parameter.name} className="text-sm font-medium">
      {parameter.label}
      {parameter.required && <span className="text-red-500 ml-1">*</span>}
    </Label>

    {parameter.type === 'checkbox' ? (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={parameter.name}
          checked={value ?? false}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <Label
          htmlFor={parameter.name}
          className="text-sm font-normal cursor-pointer"
        >
        </Label>
      </div>
    ) : parameter.type === 'select' ? (
      <Select
        value={value ?? ''}
        onValueChange={(newValue) => onChange(newValue)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={parameter.description || 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {parameter.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <div className="flex items-center gap-2">
        <Input
          id={parameter.name}
          type={isNumeric ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(isNumeric ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
          placeholder={parameter.description}
          className="w-full"
        />
      </div>
    )}

    {/* <p className="text-xs text-muted-foreground">{parameter.description}</p> */}
  </div>
  );

};

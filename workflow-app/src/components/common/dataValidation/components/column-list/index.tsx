import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, AlertCircle, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column {
  id: string;
  name: string;
  type?: string;
}

export interface ColumnMapping {
  id: string;
  sourceColumn: Column;
  targetColumn: Column;
  colorIndex: number;
}

interface ColumnListProps {
  sourceColumns: Column[];
  targetColumns: Column[];
  mappings: ColumnMapping[];
  onAddMapping: (sourceId: string, targetId: string) => void;
}

// Searchable Combobox Component
interface ComboboxProps {
  options: Column[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  emptyMessage: string;
}

const SearchableCombobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  emptyMessage
}) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(option => option.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedOption ? (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedOption.name}</span>
              {selectedOption.type && (
                <Badge variant="outline" className="text-xs">
                  {selectedOption.type}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" side="bottom">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.type || ''}`}
                  onSelect={() => {
                    onValueChange(option.id === value ? "" : option.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="truncate">{option.name}</span>
                    {option.type && (
                      <Badge variant="outline" className="text-xs">
                        {option.type}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ColumnList: React.FC<ColumnListProps> = ({
  sourceColumns,
  targetColumns,
  mappings,
  onAddMapping
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Get available columns (not yet mapped)
  const getAvailableSourceColumns = () => {
    const mappedSourceIds = mappings.map(m => m.sourceColumn.id);
    return sourceColumns.filter(col => !mappedSourceIds.includes(col.id));
  };

  const getAvailableTargetColumns = () => {
    const mappedTargetIds = mappings.map(m => m.targetColumn.id);
    return targetColumns.filter(col => !mappedTargetIds.includes(col.id));
  };

  const handleAddMapping = () => {
    setError('');

    if (!selectedSource) {
      setError('Please select a source column');
      return;
    }

    if (!selectedTarget) {
      setError('Please select a target column');
      return;
    }

    const sourceColumn = sourceColumns.find(col => col.id === selectedSource);
    const targetColumn = targetColumns.find(col => col.id === selectedTarget);

    if (!sourceColumn || !targetColumn) {
      setError('Selected columns not found');
      return;
    }

    onAddMapping(selectedSource, selectedTarget);

    // Reset selections
    setSelectedSource('');
    setSelectedTarget('');
  };

  const availableSourceColumns = getAvailableSourceColumns();
  const availableTargetColumns = getAvailableTargetColumns();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Column Selection
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Search and select source and target columns to create mappings
        </p>
      </div>

      {/* Column Selection Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Columns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Source Columns
              <Badge variant="secondary" className="text-xs">
                {availableSourceColumns.length} available
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SearchableCombobox
              options={availableSourceColumns}
              value={selectedSource}
              onValueChange={setSelectedSource}
              placeholder="Select source column"
              emptyMessage="No source columns found."
            />
          </CardContent>
        </Card>

        {/* Target Columns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Target Columns
              <Badge variant="secondary" className="text-xs">
                {availableTargetColumns.length} available
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SearchableCombobox
              options={availableTargetColumns}
              value={selectedTarget}
              onValueChange={setSelectedTarget}
              placeholder="Select target column"
              emptyMessage="No target columns found."
            />
          </CardContent>
        </Card>
      </div>

      {/* Add Mapping Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAddMapping}
          disabled={!selectedSource || !selectedTarget}
          className="flex items-center gap-2 px-6 py-2"
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ColumnList;

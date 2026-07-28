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
          <CommandInput placeholder={`Search columns...`} />
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
    if (!selectedSource || !selectedTarget) {
      setError('Please select both a source and target column.');
      return;
    }
    onAddMapping(selectedSource, selectedTarget);
    setSelectedSource('');
    setSelectedTarget('');
  };

  const availableSourceColumns = getAvailableSourceColumns();
  const availableTargetColumns = getAvailableTargetColumns();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Source to Target Mapping
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Source Columns
              <Badge variant="secondary" className="text-xs">
                {availableSourceColumns.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <SearchableCombobox
              options={availableSourceColumns}
              value={selectedSource}
              onValueChange={setSelectedSource}
              placeholder="Select source column"
              emptyMessage="No source columns found."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Target Columns
              <Badge variant="secondary" className="text-xs">
                {availableTargetColumns.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
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

      <div className="flex justify-center">
        <Button
          onClick={handleAddMapping}
          disabled={!selectedSource || !selectedTarget}
          className="flex items-center gap-2 px-6"
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ColumnList;

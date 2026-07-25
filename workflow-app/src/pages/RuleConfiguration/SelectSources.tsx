import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Database, Plus } from 'lucide-react';

interface Table {
  name: string;
  columns: { name: string; type: string; selected: boolean }[];
  selected: boolean;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  tables: Table[];
}

interface SelectSourcesProps {
  dataSources: DataSource[];
  selectedTables: string[];
  onTableToggle: (tableName: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  onNext?: () => void;
  onFilter?: () => void;
}

export const SelectSources: React.FC<SelectSourcesProps> = ({
  dataSources,
  selectedTables,
  onTableToggle,
  onSave,
  onCancel,
  onNext,
  onFilter
}) => {
  // Get all unique tables from all data sources
  const allTables = dataSources.flatMap(source => 
    source.tables.map(table => ({
      ...table,
      sourceName: source.name,
      sourceId: source.id
    }))
  );

  return (
    <div className="mb-2 space-y-4">
      {/* Header Section - wrapped in card */}
      <Card className='p-0 mb-2'>
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Select Sources
              </h2>
              {selectedTables.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''} selected
                </Badge>
              )}
              <span className="text-xs text-gray-500">
                Select tables from the panels below to view their columns
              </span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                className="!h-8 px-4"
              >
                Cancel
              </Button>
              {onFilter && (
                <Button
                  variant="outline"
                  onClick={onFilter}
                  className="!h-8 px-4"
                >
                  <Plus className="mr-2 h-4 w-4" /> Filter
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onSave}
                className="!h-8 px-4"
              >
                Save
              </Button>
              <Button
                onClick={onNext}
                className="!h-8 px-4"
                disabled={selectedTables.length === 0}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources Section - outside card */}
      <div className="p-0 text-left">
        <div className={`flex gap-1.5 p-1 ${
          allTables.length > 7 
            ? 'overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100' 
            : 'flex-wrap'
        }`}>
          {allTables.map((table) => {
            const isSelected = selectedTables.includes(table.name);
            
            return (
              <Card 
                key={`${table.sourceId}-${table.name}`}
                className={`p-1 cursor-pointer transition-all hover:shadow-md ${
                  allTables.length > 7 
                    ? 'flex-shrink-0 w-[200px]' 
                    : 'w-full sm:w-auto sm:flex-1 max-w-[200px]'
                } ${
                  isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => onTableToggle(table.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="leading-tight">
                      <p className="text-sm font-medium">{table.sourceName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

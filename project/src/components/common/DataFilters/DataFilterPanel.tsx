import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataFilterBlock } from './DataFilterBlock';
import { AppliedOperation, Column } from '@/types/deriveColumn';

interface DataFilterPanelProps {
  selectedColumn: Column | null;
  availableColumns: Column[];
  appliedOperations: AppliedOperation[];
  onOperationsChange: (operations: AppliedOperation[]) => void;
  selectedRowIndex: number;
  onSelectedRowIndexChange: (index: number) => void;
  onExecute: () => void;
}

export const DataFilterPanel: React.FC<DataFilterPanelProps> = ({
  selectedColumn,
  availableColumns,
  appliedOperations,
  onOperationsChange,
  selectedRowIndex,
  onSelectedRowIndexChange,
  onExecute,
}) => {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);

  const handleAddOperation = () => {
    const newOperation: AppliedOperation = {
      id: `filter-op-${Date.now()}`,
      operation_name: '',
      parameters: {},
      output_target: { mode: 'inplace' },
    };
    onOperationsChange([...appliedOperations, newOperation]);
  };

  const handleDeleteOperation = (id: string) => {
    onOperationsChange(appliedOperations.filter((op) => op.id !== id));
  };

  const handleUpdateOperation = (id: string, newOpData: Partial<AppliedOperation>) => {
    onOperationsChange(
      appliedOperations.map((op) => (op.id === id ? { ...op, ...newOpData } : op))
    );
  };

  const handleRowSelection = (start: number, end: number) => {
    setSelection({ start, end });
    onSelectedRowIndexChange(start);
  };

  const renderSampleData = () => {
    if (!selectedColumn || !selectedColumn.sampleData) return null;

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Sample Data (click to select):</label>
        <div className="border rounded p-2 max-h-32 overflow-y-auto">
          {selectedColumn.sampleData.slice(0, 10).map((data, index) => (
            <div
              key={index}
              className={`p-1 cursor-pointer rounded text-sm ${
                index === selectedRowIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              onClick={() => handleRowSelection(index, index)}
            >
              <span className="text-xs text-muted-foreground mr-2">[{index}]</span>
              {String(data)}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Selected row {selectedRowIndex}: {String(selectedColumn.sampleData[selectedRowIndex] || '')}
        </p>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Filter Operations</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {selectedColumn ? selectedColumn.name : 'No column selected'}
          </Badge>
          {appliedOperations.length > 0 && (
            <Badge variant="secondary">{appliedOperations.length} operations</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {selectedColumn && renderSampleData()}

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Applied Filter Operations:</label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddOperation}
              disabled={!selectedColumn}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Filter
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {appliedOperations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No filter operations added yet. Click "Add Filter" to start.
                </p>
              ) : (
                appliedOperations.map((operation) => (
                  <DataFilterBlock
                    key={operation.id}
                    operation={operation}
                    onDelete={handleDeleteOperation}
                    onUpdate={handleUpdateOperation}
                    availableColumns={availableColumns}
                    selectedRowIndex={selectedRowIndex}
                    selectedColumn={selectedColumn}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onExecute}
          disabled={!selectedColumn || appliedOperations.length === 0}
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          Execute Filters
        </Button>
      </CardFooter>
    </Card>
  );
};
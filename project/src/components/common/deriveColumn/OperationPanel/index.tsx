import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OperationBlock } from '@/components/common/deriveColumn/OperationBlock';
import { AppliedOperation, Column, STRING_OPERATIONS, DATA_FILTER_OPERATIONS } from '@/types/deriveColumn';

interface OperationPanelProps {
  selectedColumn: Column | null;
  availableColumns: Column[];
  appliedOperations: AppliedOperation[];
  onOperationsChange: (operations: AppliedOperation[]) => void;
  selectedRowIndex: number;
  onSelectedRowIndexChange: (index: number) => void;
  onExecute: () => void;
  operationsSet?: any[];
  hideOutputTarget?: boolean;
  onAiButtonClick: () => void;
}

export const OperationPanel: React.FC<OperationPanelProps> = ({
  selectedColumn,
  availableColumns,
  appliedOperations,
  onOperationsChange,
  selectedRowIndex,
  onSelectedRowIndexChange,
  onExecute,
  operationsSet = STRING_OPERATIONS,
  hideOutputTarget = false,
  onAiButtonClick,
}) => {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);

  const handleAddOperation = () => {
    const newOperation: AppliedOperation = {
      id: `op_${Date.now()}`,
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

  const handleTextSelection = () => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0 && domSelection.toString().length > 0) {
      const range = domSelection.getRangeAt(0);
      const container = document.getElementById('selectable-input-string');
      
      if (container && container.contains(range.startContainer) && container.firstChild === range.startContainer) {
        const start = Math.min(domSelection.anchorOffset, domSelection.focusOffset);
        const end = Math.max(domSelection.anchorOffset, domSelection.focusOffset);
        
        if (start !== end) {
          setSelection({ start, end });
          const updates: Record<string, any> = {
            start,
            end,
            length: end - start,
            fromIndex: start,
            position: start,
          };

          const updatedOps = appliedOperations.map(op => {
            const opDef = operationsSet.find(o => o.name === op.operation_name);
            if (!opDef) return op;

            const newParams = { ...op.parameters };
            let changed = false;
            
            for (const param of opDef.parameters) {
              if (updates[param.name] !== undefined) {
                newParams[param.name] = updates[param.name];
                changed = true;
              }
            }

            return changed ? { ...op, parameters: newParams } : op;
          });
          onOperationsChange(updatedOps);
        }
      }
    }
  };

  return (
    <Card className="h-full flex flex-col py-2">
      <CardHeader className="!flex justify-between items-center gap-2 px-2">
        <CardTitle>Operation Chain</CardTitle>
        <div className="flex items-center gap-2">
          {selectedColumn && (
            <>
              <Button onClick={handleAddOperation} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
              <Button onClick={onExecute} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Execute
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col space-y-4 overflow-hidden px-2">
        {!selectedColumn || !selectedColumn?.sampleData || selectedColumn?.sampleData?.length === 0 ? (
          <div className="flex-grow flex items-center justify-center p-4 bg-muted rounded-lg text-center">
            <p className="text-muted-foreground">Select a column to build an operation chain</p>
          </div>
        ) : (
          <>
            <div className="p-3 bg-muted rounded-lg shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Selected Column:</span>
                <Badge variant="outline">{selectedColumn?.name}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Select text below to capture range:
              </div>
              <div
                id="selectable-input-string"
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="font-mono p-2 bg-background rounded-md cursor-text select-text"
              >
                {selectedColumn?.sampleData?.[selectedRowIndex] || 'No data'}
              </div>
              {selection && (
                <div className="text-xs text-primary font-semibold mt-1">
                  Selected Range: {selection.start} - {selection.end}
                </div>
              )}
              <div className="mt-2">
                <label className="text-xs text-muted-foreground">Sample row:</label>
                <select
                  value={selectedRowIndex}
                  onChange={(e) => onSelectedRowIndexChange(Number(e.target.value))}
                  className="ml-2 text-xs bg-background border rounded px-2 py-1"
                >
                  {selectedColumn?.sampleData?.map((_, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-grow min-h-0">
              <ScrollArea className="h-full -mr-4 pr-4">
                <div className="space-y-4">
                  {appliedOperations.map((op) => (
                    <OperationBlock
                      key={op.id}
                      operation={op}
                      onDelete={handleDeleteOperation}
                      onUpdate={handleUpdateOperation}
                      availableColumns={availableColumns}
                      selectedRowIndex={selectedRowIndex}
                      operationsSet={operationsSet}
                      selectedColumn={selectedColumn}
                      hideOutputTarget={hideOutputTarget}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
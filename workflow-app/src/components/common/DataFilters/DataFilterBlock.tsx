import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppliedOperation, OperationBlockProps, DATA_FILTER_OPERATIONS } from '@/types/deriveColumn';

export const DataFilterBlock: React.FC<OperationBlockProps> = ({ 
  operation,
  onDelete,
  onUpdate,
  availableColumns,
  selectedRowIndex,
  selectedColumn,
}) => { 
  const currentOperationDef = DATA_FILTER_OPERATIONS.find(  
    (op) => op.name === operation.operation_name
  );
  
  const handleNameChange = (newName: string) => {
    onUpdate(operation.id, { operation_name: newName, parameters: {}, output_target: { mode: 'inplace' } });
  };

  const handleParameterChange = (paramName: string, value: any) => { 
    onUpdate(operation.id, { 
      parameters: {
        ...operation.parameters,
        [paramName]: value,
      },
    });
  };
  
  return (
    <Card className="bg-background/50 py-2">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex-1">
          <Label className="text-sm font-medium">Filter Operation</Label>
          <Select
            value={operation.operation_name || ""}
            onValueChange={handleNameChange}
          >
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Select filter operation" />
            </SelectTrigger>
            <SelectContent>
              {DATA_FILTER_OPERATIONS.map((op) => (
                <SelectItem key={op.name} value={op.name}>
                  {op.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(operation.id)}
          className="ml-2 text-destructive hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      {currentOperationDef && (
        <CardContent className="pt-0 p-3">
          <div className="space-y-3">
            {currentOperationDef.parameters.length > 0 && (
              <>
                <Label className="text-sm font-medium">Parameters</Label>
                {currentOperationDef.parameters.map((param) => {
                  // Determine if input should be numeric based on:
                  // 1. param.type === 'number' -> always number input
                  // 2. param.type === 'string' AND selectedColumn.type === 'number' -> number input
                  const isNumeric = param.type === 'number' || (param.type === 'string' && selectedColumn?.type === 'number');

                  return (
                    <div key={param.name} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {param.label || param.name}
                        {param.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        type={isNumeric ? 'number' : 'text'}
                        value={operation.parameters[param.name] || ''}
                        onChange={(e) => {
                          const value = isNumeric
                            ? (e.target.value === '' ? '' : Number(e.target.value))
                            : e.target.value;
                          handleParameterChange(param.name, value);
                        }}
                        placeholder={
                          param.name === 'values'
                            ? "Enter comma-separated values"
                            : `Enter ${param.label || param.name}`
                        }
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {param.description}
                      </p>
                    </div>
                  );
                })}
              </>
            )}
            
            {currentOperationDef.parameters.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This filter operation requires no parameters.
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
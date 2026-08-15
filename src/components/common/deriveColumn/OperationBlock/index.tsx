import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import { OperationSelector } from '@/components/common/deriveColumn/OperationSelector';
import { ParameterInput } from '@/components/common/deriveColumn/ParameterInput';
import { AppliedOperation, OperationBlockProps, STRING_OPERATIONS } from '@/types/deriveColumn';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';

export const OperationBlock: React.FC<OperationBlockProps> = ({ 
  operation,
  onDelete,
  onUpdate,
  availableColumns,
  selectedRowIndex,
  operationsSet = STRING_OPERATIONS,
  selectedColumn,
  hideOutputTarget = false,
}) => { 
  const currentOperationDef = operationsSet.find(  
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

  const handleOutputTargetChange = (newTarget: Partial<AppliedOperation['output_target']>) => {  
    const currentTarget = operation.output_target || { mode: 'inplace' };
    onUpdate(operation.id, { 
      output_target: {
        ...currentTarget,
        ...newTarget,
      }
    });
  };

  const isOutputTargetOperation = ['replace', 'replaceAll', 'concat','substring','toUpperCase','toLowerCase','trim','trimStart','trimEnd','split','reverse','padStart','padEnd','containsAny','to_date','to_datetime',''].includes(currentOperationDef?.name || '');
  
  return (
    <Card className="bg-background/50 py-2">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <OperationSelector value={operation.operation_name} onChange={handleNameChange} operationsSet={operationsSet} />
        <Button variant="ghost" size="sm" onClick={() => onDelete(operation.id)} className="ml-2">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      {currentOperationDef && (
        <CardContent className="p-3 pt-0 space-y-4 py-2">
          <Separator />
          {currentOperationDef.parameters.length > 0 ? ( 
            currentOperationDef.parameters.map((param) => (  
              <ParameterInput
                key={param.name}
                parameter={param}
                value={operation.parameters[param.name]}
                onChange={(value) => handleParameterChange(param.name, value)}
                availableColumns={availableColumns}
                selectedRowIndex={selectedRowIndex}
                selectedColumn={selectedColumn}
              />
            ))
          ) : ( 
            <p className="text-sm text-muted-foreground p-2">
              This operation takes no parameters.
            </p>
          )}
          {!hideOutputTarget && (
            <>
              <Separator />
              <div className="space-y-3 p-2 bg-muted/50 rounded-lg">
                <Label className="font-medium">Output Target</Label>
                <RadioGroup
                  value={operation.output_target?.mode ?? 'inplace'}
                  onValueChange={(mode: 'inplace' | 'new-column') => handleOutputTargetChange({ mode })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inplace" id={`${operation.id}-inplace`} />
                    <Label htmlFor={`${operation.id}-inplace`}>Modify in-place</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new-column" id={`${operation.id}-new-column`} />
                    <Label htmlFor={`${operation.id}-new-column`}>Create new column</Label>
                  </div>
                </RadioGroup>
                {operation.output_target?.mode === 'new-column' && ( 
                  <div className="space-y-2 pl-1 pt-2">
                    <Label htmlFor={`${operation.id}-new-column-name`}>New column name</Label>
                    <Input
                      id={`${operation.id}-new-column-name`}
                      placeholder="Enter name for the new column"
                      value={operation.output_target?.new_column_name ?? ''}
                      onChange={(e) => handleOutputTargetChange({ new_column_name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

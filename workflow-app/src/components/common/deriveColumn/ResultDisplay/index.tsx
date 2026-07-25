import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StepResult, Column } from '@/types/deriveColumn';
import { ArrowDown } from 'lucide-react';

interface ResultDisplayProps {
  selectedColumn: Column | null;
  selectedRowIndex: number;
  results: StepResult[] | null;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  selectedColumn,
  selectedRowIndex,
  results,
}) => {
  const formatResult = (value: any) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  };

  const getResultType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  if (!selectedColumn) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Sample Output</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground">Select a column to begin.</p>
        </CardContent>
      </Card>
    );
  }
  
  const initialValue = selectedColumn?.sampleData?.[selectedRowIndex] || '';
  const finalResult = results ? (results.length > 0 ? results[results.length - 1].result : initialValue) : initialValue;

  return (
    <Card className="h-full flex flex-col py-2">
      <CardHeader className="px-2">
        <CardTitle className="flex items-center gap-2">
          Sample Output
          {results && <Badge variant="outline">{getResultType(finalResult)}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col space-y-2 px-2">
        {!results ? (
          <div className="flex-grow flex items-center justify-center p-4 bg-muted rounded-lg text-center">
            <p className="text-muted-foreground">Configure your operations and click 'Execute' to see the results.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-grow -mr-4 pr-4">
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-sm font-medium text-muted-foreground">Initial Value</div>
                  <div className="font-mono text-md">{formatResult(initialValue)}</div>
                </div>

                {results.map((step, index) => (
                  <div key={step.id}>
                    <div className="flex justify-center my-2">
                      <ArrowDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className={`p-3 rounded-lg ${step.error ? 'bg-destructive/20' : 'bg-muted'}`}>
                      <div className="text-sm font-medium text-muted-foreground flex justify-between">
                        <span>Step {index + 1}: {step.operation_name}()</span>
                        <Badge variant={step.error ? 'destructive' : 'outline'}>{getResultType(step.result)}</Badge>
                      </div>
                      {step.error ? (
                        <div className="font-mono text-md text-destructive-foreground">{step.error}</div>
                      ) : (
                        <div className="font-mono text-md">{formatResult(step.result)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div>
              <h4 className="font-medium mb-2 text-md">Final Output:</h4>
              <div className="bg-primary/10 p-4 rounded-lg font-mono text-lg text-primary font-bold">
                {formatResult(finalResult)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

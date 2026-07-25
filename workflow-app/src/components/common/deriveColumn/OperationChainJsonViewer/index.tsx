import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { AppliedOperation, Column } from '@/types/deriveColumn';

interface OperationChainJsonViewerProps {
  operations: AppliedOperation[];
  selectedColumn: Column | null;
  availableColumns: Column[];
}

export const OperationChainJsonViewer: React.FC<OperationChainJsonViewerProps> = ({ operations, selectedColumn, availableColumns }) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = useMemo(() => {
    const columnMap = new Map(availableColumns.map(col => [col.id, col.name]));

    const enrichedOperations = JSON.parse(JSON.stringify(operations)).map((op: AppliedOperation) => {
      if (op.operation_name === 'concat' && op.parameters.sources) {
        op.parameters.sources.forEach((source: any) => {
          if (source.type === 'column') {
            source.column_name = columnMap.get(source.value) || 'Unknown Column';
          }
        });
      }
      return op;
    });

    const data = {
      target_column: selectedColumn ? selectedColumn.name : null,
      operations: enrichedOperations,
    };
    return JSON.stringify(data, null, 2);
  }, [operations, selectedColumn, availableColumns]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Operation Chain (JSON)</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {!selectedColumn || operations.length === 0 ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-muted-foreground text-center">
              {!selectedColumn
                ? "Select a column to begin."
                : "Add an operation to see its JSON data here."
              }
            </p>
          </div>
        ) : (
          <div className="relative flex-grow">
            <ScrollArea className="absolute inset-0 h-full w-full">
              <pre className="bg-muted p-4 rounded-lg text-sm">
                <code>{formattedJson}</code>
              </pre>
            </ScrollArea>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { StepResult, Column } from '@/types/deriveColumn';

interface JsonViewerProps {
  results: StepResult[] | null;
  selectedColumn: Column | null;
  selectedRowIndex: number;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ results, selectedColumn, selectedRowIndex }) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = useMemo(() => {
    if (!selectedColumn) {
      return JSON.stringify({ message: "Select a column to begin." }, null, 2);
    }
    if (!results) {
      return JSON.stringify({ message: "Click 'Execute' to generate the output JSON." }, null, 2);
    }

    const initialValue = selectedColumn.sampleData[selectedRowIndex] || '';
    const finalResult = results.length > 0 ? results[results.length - 1].result : initialValue;
    
    const data = {
        finalResult,
        metadata: {
            initialColumn: selectedColumn.name,
            initialValue,
            operationsApplied: results.filter(r => !r.error).length,
            resultType: Array.isArray(finalResult) ? 'array' : typeof finalResult,
            timestamp: new Date().toISOString()
        }
    };
    return JSON.stringify(data, null, 2);
  }, [results, selectedColumn, selectedRowIndex]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Final Output (JSON)</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
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
              disabled={!selectedColumn}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

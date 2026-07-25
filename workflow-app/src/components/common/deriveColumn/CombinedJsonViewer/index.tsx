import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Save, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepResult, AppliedOperation } from '@/types/deriveColumn';
import { toast } from 'sonner';

interface Column {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  sampleData: (string | number | boolean | string[])[];
}

interface CombinedJsonViewerProps {
  results: StepResult[] | null;
  selectedColumn: Column | null;
  selectedRowIndex: number;
  operations: AppliedOperation[];
  availableColumns: Column[];
  onLoadConfiguration: (config: any) => void;
}

const JsonTabContent = ({ jsonString, disabled }: { jsonString: string, disabled: boolean }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (disabled) return;
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative h-full">
      <ScrollArea className="absolute inset-0 h-full w-full">
        <pre className="bg-muted p-4 rounded-lg text-sm h-full">
          <code>{jsonString}</code>
        </pre>
      </ScrollArea>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2"
        onClick={copyToClipboard}
        disabled={disabled}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export const CombinedJsonViewer: React.FC<CombinedJsonViewerProps> = ({
  results,
  selectedColumn,
  selectedRowIndex,
  operations,
  availableColumns,
  onLoadConfiguration,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finalOutputJson = useMemo(() => {
    if (!selectedColumn) return JSON.stringify({ message: "Select a column to begin." }, null, 2);
    if (!results) return JSON.stringify({ message: "Click 'Execute' to generate the output JSON." }, null, 2);
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

  const operationChainJson = useMemo(() => {
    const columnMap = new Map(availableColumns.map(col => [col.id, col.name]));

    const enrichParameter = (paramValue: any) => {
      if (paramValue && typeof paramValue === 'object' && paramValue.sourceMode && paramValue.columnId) {
        return { ...paramValue, columnName: columnMap.get(paramValue.columnId) || 'Unknown Column' };
      }
      return paramValue;
    };
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));
    const enrichedOperations = JSON.parse(JSON.stringify(operations)).map((op: AppliedOperation) => {
      for (const paramName in op.parameters) {
        if (paramName === 'sources' && Array.isArray(op.parameters.sources)) {
          op.parameters.sources.forEach((part: any) => {
            if (part.type === 'column' && part.columnConfig) {
              part.columnConfig = enrichParameter(part.columnConfig);
            }
          });
        } else {
          op.parameters[paramName] = enrichParameter(op.parameters[paramName]);
        }
      }
      return op;
    });
    const data = {
      target_column: selectedColumn ? selectedColumn.name : null,
      target_column_type: selectedColumn ? selectedColumn.type : null,
      operations: enrichedOperations,
      generated_columns: customColumns
    };
    return JSON.stringify(data, null, 2);
  }, [operations, selectedColumn, availableColumns]);

  const customColumnsJson = useMemo(() => {
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));
    return JSON.stringify(customColumns, null, 2);
  }, [availableColumns]);

  const fullConfigurationJson = useMemo(() => {
    const data = {
      name: "String Transformation Configuration",
      timestamp: new Date().toISOString(),
      source: JSON.parse(operationChainJson),
      // generated_columns: customColumns,
      sample_execution: JSON.parse(finalOutputJson)
    };
    return JSON.stringify(data, null, 2);
  }, [operationChainJson, finalOutputJson, availableColumns]);

  const handleSave = () => {
    // Allow saving if there's a selected column OR custom columns exist
    const hasCustomColumns = availableColumns.some(col =>
      col.id.startsWith('custom-') || col.id.startsWith('new-col-')
    );

    if (!selectedColumn && !hasCustomColumns) return;

    const blob = new Blob([fullConfigurationJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'string-operation-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const json = JSON.parse(text);
          onLoadConfiguration(json);
        }
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        toast.error("Failed to load or parse the configuration file. Please ensure it's a valid JSON.");
      }
    };
    reader.onerror = () => {
      console.error("Error reading file:", reader.error);
      toast.error("An error occurred while reading the file.");
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Allow actions if there's a selected column OR custom columns exist
  const hasCustomColumns = availableColumns.some(col =>
    col.id.startsWith('custom-') || col.id.startsWith('new-col-')
  );
  const isDisabled = !selectedColumn && !hasCustomColumns;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>JSON Outputs</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-0 flex flex-col">
        <Tabs defaultValue="full-config" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mx-6 mt-0 mb-2 shrink-0">
            <TabsTrigger value="full-config">Full Configuration</TabsTrigger>
            <TabsTrigger value="final-output">Final Output</TabsTrigger>
            <TabsTrigger value="op-chain">Operation Chain</TabsTrigger>
            <TabsTrigger value="custom-cols">Generated Columns</TabsTrigger>
          </TabsList>
          <div className="flex-grow px-6 pb-6 min-h-0">
            <TabsContent value="full-config" className="h-full mt-0">
              <JsonTabContent jsonString={fullConfigurationJson} disabled={isDisabled} />
            </TabsContent>
            <TabsContent value="final-output" className="h-full mt-0">
              <JsonTabContent jsonString={finalOutputJson} disabled={isDisabled} />
            </TabsContent>
            <TabsContent value="op-chain" className="h-full mt-0">
              <JsonTabContent jsonString={operationChainJson} disabled={isDisabled || operations.length === 0} />
            </TabsContent>
            <TabsContent value="custom-cols" className="h-full mt-0">
              <JsonTabContent jsonString={customColumnsJson} disabled={isDisabled || availableColumns.filter(c => c.id.startsWith('custom-') || c.id.startsWith('new-col-')).length === 0} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button onClick={handleLoadClick} variant="outline" className="w-full">
          <Upload className="mr-2" />
          Load Configuration
        </Button>
        <Button onClick={handleSave} disabled={isDisabled} className="w-full">
          <Save className="mr-2" />
          Save Full Configuration
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
      </CardFooter>
    </Card>
  );
};

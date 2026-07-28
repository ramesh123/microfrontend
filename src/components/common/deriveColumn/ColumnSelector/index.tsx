import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transformToSampleModel } from '@/utils/utils';
import useExecutionResultStore from '@/stores/executionResultStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useFlowStore from '@/stores/flowStore';
import { toast } from 'sonner';



interface Column {
  id: string;
  name: string;
  type: any;
  sampleData: any[];
}

interface GeneratedColumn {
  id: string;
  source_type: 'manual' | 'column';
  name: string;
  type?: string;
  value?: string;
  column_name?: string;
}

interface ColumnSelectorProps {
  selectedColumn: Column | null;
  onColumnSelect: (column: Column) => void;
  onColumnsChange?: (columns: (Column | GeneratedColumn)[]) => void;
  hideAddCustomColumn?: boolean;
  /** When previous node has multi-source output (e.g. N-way matching), which source key to use for columns */
  selectedSourceKey?: string | null;
}

const isMultiSourceOutput = (output: any): boolean => {
  if (!output?.data || typeof output.data !== 'object' || Array.isArray(output.data)) return false;
  return Object.values(output.data).every((v: any) => Array.isArray(v));
};

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  selectedColumn,
  onColumnSelect,
  onColumnsChange,
  hideAddCustomColumn = false,
  selectedSourceKey = null,
}) => {
  // const { selectedNode }: any = useNodeStore.getState();
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const [customColumns, setCustomColumns] = useState<Column[]>([]);
  const [sourceNodes, setSourceNodes] = useState<any>([]);

  // ✅ Consistent with previousNodeColumns & previousNodeData
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnSample, setNewColumnSample] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newColumnType, setNewColumnType] = useState('string');
  const [sourceType, setSourceType] = useState<'manual' | 'column'>('manual');
  const [selectedSourceColumn, setSelectedSourceColumn] = useState<string>('');
  const [generatedColumns, setGeneratedColumns] = useState<GeneratedColumn[]>([]);

  useEffect(() => {
    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode?.id && sourceNodes.length > 0) {
      const output = selectedNode?.data?.node?.output;
      const hasCurrentOutput = output && (
        Array.isArray(output.data)
          ? output.data.length > 0
          : isMultiSourceOutput(output) && selectedSourceKey != null && selectedSourceKey !== '' && (output.data as Record<string, any>)[selectedSourceKey] != null
      );
      if (hasCurrentOutput) {
        const out = output || {};
        let columns: string[] = [];
        let data: any[] = [];
        if (isMultiSourceOutput(out) && selectedSourceKey && (out.data as Record<string, any>)[selectedSourceKey]) {
          data = (out.data as Record<string, any>)[selectedSourceKey] || [];
          columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
        } else {
          columns = out.columns || [];
          data = Array.isArray(out.data) ? out.data : [];
        }
        const availableColumns = columns.length > 0 ? transformToSampleModel(columns, data) : [];
        setCustomColumns(availableColumns);
      } else {
        const sourceNode = sourceNodes[0];
        const previousNodeOutput = sourceNode?.data?.node?.output;
        let columns: string[] = [];
        let data: any[] = [];
        if (previousNodeOutput && isMultiSourceOutput(previousNodeOutput)) {
          const key = (selectedSourceKey && (previousNodeOutput.data as Record<string, any>)[selectedSourceKey] != null)
            ? selectedSourceKey
            : Object.keys(previousNodeOutput.data || {})[0];
          data = key ? ((previousNodeOutput.data as Record<string, any>)[key] || []) : [];
          columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
        } else {
          columns = previousNodeOutput?.columns || [];
          data = previousNodeOutput?.data || [];
        }
        const availableColumns = columns.length > 0 ? transformToSampleModel(columns, data) : [];
        setCustomColumns(availableColumns);
      }
    }
  }, [selectedNode, sourceNodes, selectedSourceKey]);

  useEffect(() => {
    if (onColumnsChange) {
      const combinedColumns = [...customColumns, ...generatedColumns];
      onColumnsChange(combinedColumns);
    }
  }, [customColumns, generatedColumns]); // Remove onColumnsChange from dependencies

  const isEmptyStringType = newColumnType === 'empty_string';

  const addCustomColumn = () => {
    if (!newColumnName.trim()) {
      toast.warning('Please enter a column name before adding');
      return;
    }

    if (sourceType === 'manual') {
      if (!isEmptyStringType && !newColumnSample.trim()) {
        toast.warning('Please enter a column value before adding');
        return;
      }

      const newColumn: GeneratedColumn = {
        id: `custom-${Date.now()}`,
        source_type: 'manual',
        name: newColumnName.trim(),
        type: newColumnType,
        value: isEmptyStringType ? '' : newColumnSample.trim(),
      };

      setGeneratedColumns(prev => [...prev, newColumn]);
      setNewColumnName('');
      setNewColumnSample('');
      setNewColumnType('string');
      setSourceType('manual');
      setSelectedSourceColumn('');
      setShowAddColumn(false);
      return;
    }

    if (sourceType === 'column') {
      if (!selectedSourceColumn) {
        toast.warning('Please select a source column before adding');
        return;
      }

      const sourceColumn = filteredColumns.find(col => col.id === selectedSourceColumn);
      if (!sourceColumn) {
        toast.warning('Please select a valid source column before adding');
        return;
      }

      const newColumn: GeneratedColumn = {
        id: `custom-${Date.now()}`,
        source_type: 'column',
        name: newColumnName.trim(),
        column_name: sourceColumn.name,
      };

      setGeneratedColumns(prev => [...prev, newColumn]);
      setNewColumnName('');
      setNewColumnSample('');
      setNewColumnType('string');
      setSourceType('manual');
      setSelectedSourceColumn('');
      setShowAddColumn(false);
    }
  };


  const removeColumn = (columnId: string) => {
    setCustomColumns(prev => prev.filter(col => col.id !== columnId));
    if (selectedColumn?.id === columnId) {
      const remainingColumns = customColumns.filter(col => col.id !== columnId);
      if (remainingColumns.length > 0) {
        onColumnSelect(remainingColumns[0]);
      }
    }
  };

  const handleColumnClick = useCallback((column: Column | GeneratedColumn) => {
    // Convert GeneratedColumn to Column format if needed
    if ('source_type' in column) {
      const convertedColumn: Column = {
        id: column.id,
        name: column.name,
        type: column.type || 'string',
        sampleData: column.source_type === 'manual'
          ? [column.value || '']
          : [column.column_name || '']
      };
      onColumnSelect(convertedColumn);
    } else {
      onColumnSelect(column);
    }
  }, [onColumnSelect]);

  const getPreviewText = (data: string[]): string => {
    const first = data[0] || '';
    if (first.length > 30) {
      return first.substring(0, 30) + '...';
    }
    return first;
  };

  const filteredGeneratedColumns = useMemo(() =>
    generatedColumns.filter(column =>
      column.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [generatedColumns, searchTerm]
  );

  const filteredColumns = useMemo(() =>
    customColumns.filter(column =>
      column.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [customColumns, searchTerm]
  );


  const removeGeneratedColumn = (columnId: string) => {
    setGeneratedColumns(prev => prev.filter(col => col.id !== columnId));
  };

  return (
    <Card className="h-full flex flex-col gap-1 py-2">
      <CardHeader className="px-2">
        <CardTitle className="flex items-center gap-2">
          Select Column
          {selectedColumn && (
            <Badge variant="outline">{selectedColumn.type}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-y-hidden px-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex-grow my-4 min-h-0">
          <ScrollArea className="h-full w-full rounded-lg border">
            <div className="p-2">
              {[...filteredColumns, ...filteredGeneratedColumns].length > 0 ? (
                [...filteredColumns, ...filteredGeneratedColumns].map((column, index) => (
                  <div key={column.id}>
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                        selectedColumn?.id === column.id ? "bg-accent border-2 border-primary" : "hover:bg-muted"
                      )}
                      onClick={() => handleColumnClick(column)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{column.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {'source_type' in column ? column.source_type : column.type}
                          </Badge>
                          {selectedColumn?.id === column.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {'source_type' in column
                            ? (column.source_type === 'manual' ? column.value : column.column_name)
                            : getPreviewText(column.sampleData)
                          }
                        </div>
                      </div>
                      {/* Remove button for generated columns */}
                      {'source_type' in column && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeGeneratedColumn(column.id);
                          }}
                          className="h-8 w-8 p-0 ml-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {index < [...filteredColumns, ...filteredGeneratedColumns].length - 1 && <Separator className="my-2" />}
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  No columns found.
                </div>
              )}

            </div>
          </ScrollArea>
        </div>

        <div className="shrink-0 space-y-4">
          {selectedColumn && (
            <div className="space-y-2">
              <Label>Preview Data</Label>
              <div className="bg-muted p-3 rounded-lg">
                <div className="font-mono text-sm space-y-1">
                  {selectedColumn.sampleData && selectedColumn.sampleData.length > 0 ? (
                    selectedColumn.sampleData.slice(0, 4).map((data, index) => (
                      <div key={index} className="text-muted-foreground">
                        <span className="text-primary font-medium">Row {index + 1}:</span> {data}
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No preview data available</div>
                  )}
                  {(selectedColumn.sampleData?.length || 0) > 4 && (
                    <div className="text-xs text-muted-foreground italic">
                      ... and {(selectedColumn.sampleData.length || 0) - 4} more rows
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Sample rows: {selectedColumn.sampleData?.length || 0}</span>
                <span>Type: {selectedColumn.type}</span>
              </div>
            </div>
          )}


          {!hideAddCustomColumn && (
            <div className="space-y-2">
              {!showAddColumn ? (
                <Button
                  variant="outline"
                  onClick={() => setShowAddColumn(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Column
                </Button>
              ) : (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Add New Column</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddColumn(false);
                        setSourceType('manual');
                        setSelectedSourceColumn('');
                        setNewColumnType('string');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {/* <Label>Source Type</Label> */}
                    <Select
                      value={sourceType}
                      onValueChange={(type: 'manual' | 'column') => setSourceType(type)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="column">From Column</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {sourceType === 'manual' ? (
                    <div className="space-y-2">
                      <Label>Column Name</Label>
                      <Input
                        placeholder="Column name"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                      />
                      <div className="space-y-1">
                        <Label>Column Type</Label>
                        <Select
                          value={newColumnType}
                          onValueChange={(type) => {
                            setNewColumnType(type);
                            if (type === 'empty_string') {
                              setNewColumnSample('');
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="integer">Integer</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="float">Float</SelectItem>
                            <SelectItem value="datetime">DateTime</SelectItem>
                            <SelectItem value="empty_string">Empty String</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {isEmptyStringType ? (
                        <p className="text-xs text-muted-foreground">
                          Column value is(&quot;&quot;).
                        </p>
                      ) : (
                        <>
                          <Label>
                            Column Value
                            <span className="text-red-500 ml-1">*</span>
                          </Label>
                          <Input
                            placeholder="Column Value"
                            value={newColumnSample}
                            onChange={(e) => setNewColumnSample(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Column Name</Label>
                      <Input
                        placeholder="Column name"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                      />
                      <div className="space-y-1">
                        <Label>Source Column</Label>
                        <Select
                          value={selectedSourceColumn}
                          onValueChange={setSelectedSourceColumn}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select source column" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredColumns.map((column) => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.name} ({column.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Button onClick={addCustomColumn} className="w-full">
                    Add Column
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Settings, Filter, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterRow } from '../filterRows';
import { CustomColumn, CustomFilter } from '@/types/customColumn';
import { transformToExpectedPayload } from '@/utils/utils';
import { toast } from 'sonner';
import { useCustomColumnStore } from '@/stores/customColumnStore';
import useFlowStore from '@/stores/flowStore';
import { cn } from '@/lib/utils';
import { computeCustomColumnPreviewRows } from '../../customColumnPreview';

interface CustomDeriveColumnsProps {
  onClickSave: (filterType: string, data: any) => void;
  previewDeriveData: any;
}

export const SetCustomColumn: React.FC<CustomDeriveColumnsProps> = ({ onClickSave, previewDeriveData }) => {
  const [sourceNodes, setSourceNodes] = useState<any>([]);
  const selectedNode = useFlowStore.getState().getSelectedNode();

  useEffect(() => {
    if (selectedNode?.id) {
      const upstream = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(upstream);
    }
  }, [selectedNode?.id]);

  const { columns: previousNodeColumns = [], data: previousNodeData = [] } =
    selectedNode?.data?.node?.output?.data?.length > 0
      ? selectedNode.data.node.output
      : sourceNodes?.[0]?.data?.node?.output ?? {};

  const availableFields: string[] =
    previousNodeColumns.length > 0
      ? previousNodeColumns
      : selectedNode?.data?.node?.output?.columns?.length > 0
        ? selectedNode.data.node.output.columns
        : sourceNodes?.[0]?.data?.node?.output?.columns || [];

  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number>(0);
  const [columns, setColumns] = useState<CustomColumn[]>([
    {
      id: '1',
      name: `Column_${1}`,
      new_custom_column: '',
      custom_filter_list: [
        {
          id: '1',
          text_sf_box: false,
          selected_field: '',
          operation: '',
          text_slf_box: false,
          selected_last_field: ''
        }
      ]
    }
  ]);

  // const availableFields = [
  //   'AVAILABLE BALANCE',
  //   'Amount',
  //   'Balance',
  //   'Total',
  //   'Quantity',
  //   'Price',
  //   'Value'
  // ];

  useEffect(() => {
    if (previewDeriveData?.set_custom_column?.length > 0) {
      setColumns(previewDeriveData?.set_custom_column);
    } 
  }, [previewDeriveData]);

  const conditions = [
    { value: '+', label: '+ (Add)' },
    { value: '-', label: '- (Subtract)' },
    { value: '*', label: '* (Multiply)' },
    { value: '/', label: '/ (Divide)' },
  ];

  const addNewColumn = () => {
    const newColumnNumber = columns.length + 1;
    const newColumn: CustomColumn = {
      id: Date.now().toString(),
      name: `Column_${newColumnNumber}`,
      new_custom_column: '',
      custom_filter_list: []
    };
    setColumns([...columns, newColumn]);
    setSelectedColumnIndex(columns.length);
  };

  const updateColumn = (columnId: string, updatedColumn: CustomColumn) => {
    setColumns(columns.map(column =>
      column.id === columnId ? updatedColumn : column
    ));
  };

  const deleteColumn = (columnId: string) => {
    const nextIndex = columns.findIndex((column) => column.id === columnId);
    const nextColumns = columns.filter((column) => column.id !== columnId);
    setColumns(nextColumns);
    if (selectedColumnIndex >= nextColumns.length) {
      setSelectedColumnIndex(Math.max(0, nextColumns.length - 1));
    } else if (nextIndex <= selectedColumnIndex && selectedColumnIndex > 0) {
      setSelectedColumnIndex(selectedColumnIndex - 1);
    }
  };

  const addFilter = (columnId: string) => {
    const newFilter: CustomFilter = {
      id: Date.now().toString(),
      // useManualField: false,
      // field: '',
      text_sf_box: false,
      selected_field: '',
      operation: '',
      text_slf_box: false,
      selected_last_field: ''
    };

    const column = columns.find(c => c.id === columnId);
    if (column) {
      updateColumn(columnId, {
        ...column,
        custom_filter_list: [...column.custom_filter_list, newFilter]
      });
    }
  };

  const updateFilter = (columnId: string, filterId: string, updatedFilter: CustomFilter) => {
    const column = columns.find(c => c.id === columnId);
    if (column) {
      updateColumn(columnId, {
        ...column,
        custom_filter_list: column.custom_filter_list.map(filter =>
          filter.id === filterId ? updatedFilter : filter
        )
      });
    }
  };

  const removeFilter = (columnId: string, filterId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column) {
      updateColumn(columnId, {
        ...column,
        custom_filter_list: column.custom_filter_list.filter(filter => filter.id !== filterId)
      });
    }
  };

  const addFilterAfter = (columnId: string, currentFilterId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column) {
      const currentIndex = column.custom_filter_list.findIndex(f => f.id === currentFilterId);
      const newFilter: CustomFilter = {
        id: Date.now().toString(),
        text_sf_box: false,
        selected_field: '',
        operation: '',
        text_slf_box: false,
        selected_last_field: ''
      };

      const newFilters = [...column.custom_filter_list];
      newFilters.splice(currentIndex + 1, 0, newFilter);

      updateColumn(columnId, {
        ...column,
        custom_filter_list: newFilters
      });
    }
  };

  const activeColumn = columns[selectedColumnIndex] ?? null;
  const highlightedColumnName = activeColumn?.new_custom_column?.trim() || '';

  const handlePreview = () => {
    if (!previousNodeData.length) {
      toast.error('No source data available. Execute the upstream node first.');
      return;
    }

    const missingName = columns.find((col) => !col.new_custom_column?.trim());
    if (missingName) {
      toast.error('Please provide a name for each custom column.');
      return;
    }

    const { rows, previewColumnNames } = computeCustomColumnPreviewRows(previousNodeData, columns);
    setPreviewData(rows.slice(0, 10));
    setPreviewColumns([...previousNodeColumns, ...previewColumnNames]);
    toast.success('Preview generated!');
  };

  const handleDerive: () => Promise<void> = async () => {
    const transformedData = transformToExpectedPayload(columns);

    useCustomColumnStore.getState().setData(transformedData);
    if(previewDeriveData?.id) {
      onClickSave('custom_column', {set_custom_column: transformedData, id: previewDeriveData?.id});
    } else {
      onClickSave('custom_column', {set_custom_column: transformedData});
    }
  };

  return (
    <div className="p-2 md:p-3 h-full">
      <div className="flex gap-2 h-full min-h-[420px]">
      <div className="flex-1 min-w-0 overflow-y-auto max-h-[calc(90vh-14rem)]">
      <div className="max-w-full mx-auto">
        <div className="space-y-2">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <Settings className="w-3 h-3" />
                <span className="font-medium">{columns.length} Column{columns.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-3 w-px bg-border"></div>
              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3 h-3" />
                <span className="font-medium">
                  {columns.reduce((total, col) => total + col.custom_filter_list.length, 0)} Filter{columns.reduce((total, col) => total + col.custom_filter_list.length, 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={addNewColumn}
                size="sm"
                className="bg-primary shadow-md"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Column
              </Button>
            </div>
          </div>
          {/* Column Forms */}
          {columns.map((column, index) => (
            <Card
              key={column.id}
              onClick={() => setSelectedColumnIndex(index)}
              className={cn(
                'pt-0 transition-all duration-300 gap-0 cursor-pointer',
                selectedColumnIndex === index
                  ? 'border-blue-500 shadow-lg'
                  : 'border-border hover:border-muted-foreground/40'
              )}
            >
              <CardHeader className="rounded-t-lg p-3 space-y-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <span>{column.name}</span>
                  </CardTitle>
                  {columns.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteColumn(column.id);
                      }}
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-3">
                <div className="flex gap-4">
                  {/* Column Setup Section - 25% width */}
                  <div className="w-1/4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                      <h3 className="text-base font-semibold">Column Setup</h3>
                    </div>

                    <div className="rounded-lg p-3 space-y-2 bg-secondary dark:bg-gray-800">
                      <div>
                        <label className="block text-xs font-medium mb-1">New Column Name</label>
                        <Input
                          placeholder="Enter column name..."
                          value={column.new_custom_column}
                          onChange={(e) => updateColumn(column.id, { ...column, new_custom_column: e.target.value })}
                          className="border p-2 py-2 w-full rounded-md focus:outline-none text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg p-2 bg-secondary dark:bg-gray-800">
                      <h4 className="font-medium mb-1 text-sm">Quick Stats</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="">Active Filters:</span>
                          <span className="font-semibold text-blue-600">{column.custom_filter_list.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="">Status:</span>
                          <span className={`font-semibold ${column.custom_filter_list.length > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                            {column.custom_filter_list.length > 0 ? 'Configured' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filters Section - 75% width */}
                  <div className="flex-1 space-y-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                        <h3 className="text-base font-semibold">Custom Filters</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-xs font-medium rounded-full">
                          {column.custom_filter_list.length} Active
                        </span>
                        <Button
                          size="iconMd"
                          onClick={() => addFilter(column.id)}
                          className="px-2"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Filter
                        </Button>
                      </div>
                    </div>

                    {/* Filter Header */}
                    <div className="rounded-md p-2 dark:bg-gray-800">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <div style={{ flex: '0 0 230px' }}>Field</div>
                        <div style={{ flex: '0 0 150px' }}>Condition</div>
                        <div style={{ flex: '0 0 230px' }}>Value</div>
                        <div style={{ flex: '0 0 auto' }}>Actions</div>
                      </div>
                    </div>

                    <div className="space-y-2 min-h-[200px]">
                      {column.custom_filter_list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed border-border">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-2">
                            <Filter className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <h4 className="text-sm font-medium text-foreground mb-1">No filters added yet</h4>
                          <p className="text-muted-foreground text-center mb-3 text-xs max-w-sm">
                            Add filters to define how your custom column should be calculated
                          </p>
                          <Button
                            onClick={() => addFilter(column.id)}
                            size="iconMd"
                            className=""
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add First Filter
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 relative">
                          {column.custom_filter_list.map((filter, filterIndex) => (
                            <div key={filter.id} className="relative pl-8">
                              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 rounded-full text-xs font-bold">
                                {filterIndex + 1}
                              </div>

                              <FilterRow
                                index={filterIndex}
                                filter={filter}
                                onUpdate={(updatedFilter) => updateFilter(column.id, filter.id, updatedFilter)}
                                onAdd={() => addFilterAfter(column.id, filter.id)}
                                onRemove={() => removeFilter(column.id, filter.id)}
                                availableFields={availableFields || []}
                                conditions={conditions}
                                showDeleteButton={column.custom_filter_list.length > 1}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="py-4 text-center">
          <Card className="py-1 dark:bg-gray-800 border-0 shadow-lg inline-block">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="text-left">
                  <h3 className="text-base font-semibold mb-1">Ready to derive?</h3>
                  <p className="text-xs">
                    Process your {columns.length} column{columns.length !== 1 ? 's' : ''} with {columns.reduce((total, col) => total + col.custom_filter_list.length, 0)} filter{columns.reduce((total, col) => total + col.custom_filter_list.length, 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="outline" onClick={handlePreview}>
                  <Play className="mr-2 h-4 w-4" /> Run Preview
                </Button>
                <Button
                  size="default"
                  onClick={handleDerive}
                  className="px-8 py-2 shadow-lg font-semibold"
                >
                  Derive Columns
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      <div className="w-[30%] shrink-0 flex flex-col p-1">
        <Card className="flex-grow flex flex-col h-full">
          <CardHeader>
            <CardTitle>Output Preview</CardTitle>
            <CardDescription>Results of the transformation.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow overflow-auto max-h-[calc(90vh-14rem)]">
            {previewData.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {previewColumns.map((colName) => (
                      <TableHead
                        key={colName}
                        className={cn(
                          highlightedColumnName && colName === highlightedColumnName && 'text-blue-600 font-bold'
                        )}
                      >
                        {colName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 50).map((row, index) => (
                    <TableRow key={index}>
                      {previewColumns.map((colName) => (
                        <TableCell
                          key={colName}
                          className={cn(
                            highlightedColumnName &&
                              colName === highlightedColumnName &&
                              'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 font-medium'
                          )}
                        >
                          {String(row[colName] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-center text-muted-foreground">
                <p>Run a preview to see the results here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Play, ChevronsRight, ChevronUp, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useSourceNodes from '@/hooks/use-source-nodes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TextFilterParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import SmartCellRenderer from '@/components/core/cellRenderer';
import useFlowStore from '@/stores/flowStore';
import { useAgGridTheme } from '@/hooks/useAgGridTheme';
import '@/styles/ag-grid-theme-sync.css';

interface AndCondition {
  condition_logic: 'and' | 'or' | '' | string;
  new_condition_column: string;
  condition: string;
  is_condition_value: boolean;
  condition_value?: string | number;
}

interface FilterCondition {
  id: string;
  new_condition_column: string;
  logic: 'if' | 'else';
  condition?: string;
  is_condition_value: boolean;
  condition_value?: string | number;
  and_condition_list: AndCondition[];
  set_type: 'then' | 'otherwise';
  is_set_value: boolean;
  set_value: string;
  is_arithmetic: boolean;
  arithmetic_operation?: string;
  is_arithmetic_value: boolean;
  arithmetic_value?: string | number;
}

interface FilterColumn {
  id: string;
  manual_condition_column: string;
  condition_filter_list: FilterCondition[];
}

interface AvailableColumn {
  name: string;
  type: string;
}

interface ConditionalFilterProps {
  onClickSave: (data: { id: string, conditional_filter_columns: FilterColumn[] }) => void;
  editPreviewData?: any;
}

const conditionOptions = [
    { label: 'Equals to', value: '==' },
    { label: 'Not equals to', value: '!=' },
    { label: 'Greater than', value: '>' },
    { label: 'Less than', value: '<' },
    { label: 'Greater than or equal', value: '>=' },
    { label: 'Less than or equal', value: '<=' },
    { label: 'Contains', value: 'contains' },
    { label: 'Does not contain', value: 'not_contains' },
    { label: 'In', value: 'in' },
    { label: 'Not In', value: 'not_in' },
    { label: 'Starts With', value: 'starts_with' },
    { label: 'Ends With', value: 'ends_with' },
    { label: 'Not Starts With', value: 'not_starts_with' },
    { label: 'Not Ends With', value: 'not_ends_with' },
];

const arithmeticOptions = [
    { label: 'Add (+)', value: 'add' },
    { label: 'Subtract (-)', value: 'subtract' },
    { label: 'Multiply (*)', value: 'multiply' },
    { label: 'Divide (/)', value: 'divide' },
    { label: 'Modulo (%)', value: 'modulo' }
];

// --- COMPONENT ---
const ConditionalFilter: React.FC<ConditionalFilterProps> = ({ onClickSave, editPreviewData }) => {
  const selectedNode = useFlowStore.getState().getSelectedNode();

  const [sourceNodes, setSourceNodes] = useState<any>([]);


  useEffect(() => {
    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
    }
   }, [selectedNode]);


   const { columns: previousNodeColumns = [], data: previousNodeData = [] } = selectedNode?.data?.node?.output?.data.length > 0 ? selectedNode?.data?.node?.output : sourceNodes?.[0]?.data?.node?.output ?? {};

  const [columns, setColumns] = useState<FilterColumn[]>([
    {
      id: `col-${Date.now()}`,
      manual_condition_column: '',
      condition_filter_list: [
        {
          id: `cond-${Date.now()}`,
          new_condition_column: '',
          logic: 'if',
          condition: '==',
          is_condition_value: true,
          condition_value: '', // Keep as string for input control
          and_condition_list: [],
          set_type: 'then',
          is_set_value: true,
          set_value: '',
          is_arithmetic: false,
          arithmetic_operation: '',
          is_arithmetic_value: true,
          arithmetic_value: '' // Keep as string for input control
        }
      ]
    }
  ]);

  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);

  const [isGridVisible, setIsGridVisible] = useState(true);
  const filterItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [scrollToFilterId, setScrollToFilterId] = useState<string | null>(null);
  const { agTheme, theme: appTheme } = useAgGridTheme();

  const [colDefs, setColDefs] = useState([]);
  const [rowData, setRowData] = useState([]);

  const availableColumns = useMemo<AvailableColumn[]>(() => {
    if (!previousNodeColumns.length || !previousNodeData.length) return [];
    return previousNodeColumns.map((col: string) => ({
      name: col,
      type: typeof previousNodeData[0][col],
    }));
  }, [previousNodeColumns, previousNodeData]);

  const activeColumn = selectedColumnIndex !== null ? columns[selectedColumnIndex] : null;

  useEffect(() => {
    // Load the edit data when it's provided and has the expected structure
    if (editPreviewData && editPreviewData?.conditional_filter_columns?.length > 0) {
      setColumns(editPreviewData.conditional_filter_columns);
      // Set the first column as selected by default
      setSelectedColumnIndex(0);
    }
  }, [editPreviewData]);


  useEffect(() => {
    if (previousNodeColumns && previousNodeData) {
      const gridColumns = previousNodeColumns.map((column: any) => ({
        field: column,
        headerName: column,
        filter: 'agTextColumnFilter',
        filterParams: {
          closeOnApply: true,
        } as TextFilterParams,
      }));
      setColDefs(gridColumns);
      setRowData(previousNodeData);
    }
  }, [previousNodeColumns, previousNodeData]);

  useEffect(() => {
    if (!scrollToFilterId) return;
    const frameId = requestAnimationFrame(() => {
      const el = filterItemRefs.current.get(scrollToFilterId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setScrollToFilterId(null);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [columns, scrollToFilterId]);

  // --- COLUMN MANAGEMENT ---
  const addColumn = () => {
    setColumns([
      ...columns,
      {
        id: `col-${Date.now()}`,
        manual_condition_column: "",
        condition_filter_list: [
          {
            id: `cond-${Date.now()}`,
            new_condition_column: "",
            logic: "if",
            condition: "==",
            is_condition_value: true,
            condition_value: "", // Keep as string for input control
            and_condition_list: [],
            set_type: "then",
            is_set_value: true,
            set_value: "",
            is_arithmetic: false,
            arithmetic_operation: "",
            is_arithmetic_value: true,
            arithmetic_value: "" // Keep as string for input control
          },
        ],
      },
    ]);
    setSelectedColumnIndex(columns.length);
  };

  const removeColumn = (indexToRemove: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, index) => index !== indexToRemove));
    if (selectedColumnIndex === indexToRemove) {
      setSelectedColumnIndex(null);
    } else if (selectedColumnIndex && selectedColumnIndex > indexToRemove) {
      setSelectedColumnIndex(selectedColumnIndex - 1);
    }
  };

  const updateColumnConfig = (index: number, field: 'new_condition_column' | 'manual_condition_column', value: string) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const addAndCondition = (filterIndex: number) => {
    if (selectedColumnIndex === null) return;
    const newColumns = [...columns];
    const filter = newColumns[selectedColumnIndex].condition_filter_list[filterIndex];
    filter.and_condition_list.push({
      condition_logic: 'and',
      new_condition_column: '',
      condition: '==',
      is_condition_value: true,
      condition_value: '' // Keep as string for input control
    });
    setColumns(newColumns);
  };

  const removeAndCondition = (filterIndex: number, andIndex: number) => {
    if (selectedColumnIndex === null) return;
    const newColumns = [...columns];
    const filter = newColumns[selectedColumnIndex].condition_filter_list[filterIndex];
    filter.and_condition_list.splice(andIndex, 1);
    setColumns(newColumns);
  };

  const updateAndCondition = (filterIndex: number, andIndex: number, field: keyof AndCondition, value: string | boolean | number) => {
    if (selectedColumnIndex === null) return;
    const newColumns = [...columns];
    const andCondition = newColumns[selectedColumnIndex].condition_filter_list[filterIndex].and_condition_list[andIndex];

    let finalValue: string | boolean | number = value;
    // If updating the value, parse it based on the column type (only when it's a manual input)
    if (field === 'condition_value' && andCondition.is_condition_value) {
      const columnType = availableColumns.find(c => c.name === andCondition.new_condition_column)?.type;
      if (columnType === 'number' || columnType === 'integer' || columnType === 'float') {
        // Only keep as string if it's truly empty
        if (value === '' || value === null || value === undefined) {
          finalValue = '';
        } else {
          const num = Number(value);
          // Convert to number if valid (includes 0, negatives, floats)
          if (!isNaN(num) && value !== '') {
            finalValue = num;
          }
        }
      }
    }

    (andCondition as any)[field] = finalValue;
    setColumns(newColumns);
  };


  // --- FILTER MANAGEMENT ---
  const addFilter = () => {
    if (selectedColumnIndex === null) return;
    const newFilterId = `cond-${Date.now()}`;
    const newColumns = [...columns];
    const activeList = newColumns[selectedColumnIndex].condition_filter_list;
    activeList.push({
      id: newFilterId,
      new_condition_column: '',
      logic: 'if',
      condition: '==',
      is_condition_value: true,
      condition_value: '', // Keep as string for input control
      and_condition_list: [],
      set_type: 'then',
      is_set_value: true,
      set_value: '',
      is_arithmetic: false,
      arithmetic_operation: '',
      is_arithmetic_value: true,
      arithmetic_value: '' // Keep as string for input control
    });
    setColumns(newColumns);
    setScrollToFilterId(newFilterId);
  };

  const removeFilter = (filterIndex: number) => {
    if (selectedColumnIndex === null) return;
    const newColumns = [...columns];
    const activeList = newColumns[selectedColumnIndex].condition_filter_list;
    if (activeList.length > 1) {
      activeList.splice(filterIndex, 1);
      setColumns(newColumns);
    }
  };

  const updateFilter = (filterIndex: number, field: keyof FilterCondition, value: string | boolean | number) => {
    if (selectedColumnIndex === null) return;
    const newColumns = [...columns];
    const filterList = newColumns[selectedColumnIndex].condition_filter_list;

    if (filterIndex === 0 && field === 'logic') return;

    let finalValue: string | boolean | number = value;
    const filter = filterList[filterIndex];

    // If updating a value field, parse it based on the relevant column's type
    if (field === 'condition_value' && filter.is_condition_value) {
      const columnType = availableColumns.find(c => c.name === filter.new_condition_column)?.type;
      if (columnType === 'number' || columnType === 'integer' || columnType === 'float') {
        // Only keep as string if it's truly empty
        if (value === '' || value === null || value === undefined) {
          finalValue = '';
        } else {
          const num = Number(value);
          // Convert to number if valid (includes 0, negatives, floats)
          if (!isNaN(num) && value !== '') {
            finalValue = num;
          }
        }
      }
    } else if (field === 'arithmetic_value' && filter.is_arithmetic_value) {
      const columnType = availableColumns.find(c => c.name === filter.set_value)?.type;
      if (columnType === 'number' || columnType === 'integer' || columnType === 'float') {
        // Only keep as string if it's truly empty
        if (value === '' || value === null || value === undefined) {
          finalValue = '';
        } else {
          const num = Number(value);
          // Convert to number if valid (includes 0, negatives, floats)
          if (!isNaN(num) && value !== '') {
            finalValue = num;
          }
        }
      }
    }

    // Handle logic change
    if (field === 'logic') {
      const updatedFilter = { ...filterList[filterIndex], [field]: finalValue as 'if' | 'else' };
      if (value === 'else') {
        filterList.splice(filterIndex + 1);
        updatedFilter.condition = undefined;
        updatedFilter.condition_value = undefined;
        updatedFilter.and_condition_list = [];
        updatedFilter.set_type = 'otherwise';
      } else if (value === 'if') {
        updatedFilter.set_type = 'then';
      }
      filterList[filterIndex] = updatedFilter;
    } else {
      // For all other fields, use finalValue
      filterList[filterIndex] = { ...filterList[filterIndex], [field]: finalValue };
    }

    setColumns(newColumns);
  };

  const handlePreview = () => {
    if (!activeColumn || !activeColumn.manual_condition_column) {
      toast.error("Please provide a name for the new column.");
      return;
    }
    const evaluateCondition = (row: any, sourceColName: string, condition: string, isValue: boolean, value?: string | number) => {
      if (!sourceColName) return false;
      const val1 = row[sourceColName];
      const val2 = isValue ? value : row[value || ''];

      switch (condition) { 
        case '==': return val1 == val2;
        case '!=': return val1 != val2;
        case '>': return Number(val1) > Number(val2);
        case '<': return Number(val1) < Number(val2);
        case '>=': return Number(val1) >= Number(val2);
        case '<=': return Number(val1) <= Number(val2);
        case 'contains': return String(val1).includes(String(val2));
        case 'not_contains': return !String(val1).includes(String(val2));
        case 'in': {
          const list = String(val2).split(',').map(item => item.trim());
          return list.includes(String(val1));
        }
        case 'not_in': {
          const list = String(val2).split(',').map(item => item.trim());
          return !list.includes(String(val1));
        }
        case 'starts_with': return String(val1).startsWith(String(val2));
        case 'ends_with': return String(val1).endsWith(String(val2));
        case 'not_starts_with': return !String(val1).startsWith(String(val2));
        case 'not_ends_with': return !String(val1).endsWith(String(val2));
        default: return false;
      }
    };

    const applyArithmetic = (baseValue: any, operation: string, operandValue: any): any => {  
      const num1 = Number(baseValue);
      const num2 = Number(operandValue);

      if (isNaN(num1) || isNaN(num2)) {  
        return baseValue; 
      }

      switch (operation) {  
        case 'add': return num1 + num2;
        case 'subtract': return num1 - num2;
        case 'multiply': return num1 * num2;
        case 'divide': return num2 !== 0 ? num1 / num2 : baseValue;
        case 'modulo': return num2 !== 0 ? num1 % num2 : baseValue;
        case 'power': return Math.pow(num1, num2);
        default: return baseValue;
      }

    };

    const newPreviewData = previousNodeData.map((row: any) => {
      let newColumnValue: any = null;
      let conditionMet = false;

      for (const filter of activeColumn.condition_filter_list) {
        if (conditionMet) break;

        if (filter.logic === 'if') {
          let blockResult = evaluateCondition(row, filter.new_condition_column, filter.condition!, filter.is_condition_value, filter.condition_value);

          for (const andOrCond of filter.and_condition_list) {
            const conditionResult = evaluateCondition(row, andOrCond.new_condition_column, andOrCond.condition, andOrCond.is_condition_value, andOrCond.condition_value);
            if (andOrCond.condition_logic === 'and') {
              blockResult = blockResult && conditionResult;
            } else if (andOrCond.condition_logic === 'or') {
              blockResult = blockResult || conditionResult;
            }
          }
          if (blockResult) {
            newColumnValue = filter.is_set_value ? filter.set_value : row[filter.set_value || ''];

            // Apply arithmetic operation if enabled
            if (filter.is_arithmetic && filter.arithmetic_operation && filter.arithmetic_value !== undefined) {
              const operand = filter.is_arithmetic_value ? filter.arithmetic_value : row[filter.arithmetic_value || ''];
              newColumnValue = applyArithmetic(newColumnValue, filter.arithmetic_operation, operand);
            }

            conditionMet = true;
          }

        } else if (filter.logic === 'else') {
          newColumnValue = filter.is_set_value ? filter.set_value : row[filter.set_value || ''];

          // Apply arithmetic operation if enabled
          if (filter.is_arithmetic && filter.arithmetic_operation && filter.arithmetic_value !== undefined) {
            const operand = filter.is_arithmetic_value ? filter.arithmetic_value : row[filter.arithmetic_value || ''];
            newColumnValue = applyArithmetic(newColumnValue, filter.arithmetic_operation, operand);
          }

          conditionMet = true;
        }
      }
      return { ...row, [activeColumn.manual_condition_column]: newColumnValue };
    });

    setPreviewData(newPreviewData.slice(0, 10));
    setPreviewColumns([...previousNodeColumns, activeColumn.manual_condition_column]);
    toast.success("Preview generated!");
  };


  const handleSave = () => {
    const invalidColumn = columns.find(c => !c.manual_condition_column);
    if (invalidColumn) {
      toast.warning('Please ensure all columns have a new column name.');
      return;
    }

    // Deep clone and process data to ensure correct types before saving
    const dataToSave = columns.map((column) => ({
      ...column,
      condition_filter_list: column.condition_filter_list.map((filter) => ({
        ...filter,
        // Ensure arithmetic_operation is empty if not used
        arithmetic_operation: filter.is_arithmetic ? filter.arithmetic_operation : '',
        // Final type check on values before saving
        condition_value: (() => {
          const colType = availableColumns.find(c => c.name === filter.new_condition_column)?.type;
          if ((colType === 'number' || colType === 'integer' || colType === 'float') && typeof filter.condition_value === 'string') {
            const num = Number(filter.condition_value);
            return isNaN(num) ? filter.condition_value : num;
          }
          return filter.condition_value;
        })(),
        arithmetic_value: (() => {
          const colType = availableColumns.find(c => c.name === filter.set_value)?.type;
          if ((colType === 'number' || colType === 'integer' || colType === 'float') && typeof filter.arithmetic_value === 'string') {
            const num = Number(filter.arithmetic_value);
            return isNaN(num) ? filter.arithmetic_value : num;
          }
          return filter.arithmetic_value;
        })(),
      }))
    }));

    onClickSave({ id: editPreviewData?.id, conditional_filter_columns: dataToSave });
    toast.success('Conditional filters saved.');
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col w-full h-[calc(100vh-4rem)] bg-background font-sans">
        <div className="flex p-1 gap-1">
        <Card className="w-full py-2 gap-0.5">
          <CardHeader className="p-1">
            <div className="flex justify-between items-center">
              <div className='flex items-center gap-2'>
                <Button variant="ghost" size="icon" onClick={() => setIsGridVisible(!isGridVisible)}>
                  {isGridVisible ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
                <CardTitle className='text-lg p-0'>Source Data</CardTitle>
              </div>
            </div>
          </CardHeader>
          {isGridVisible && (
            <CardContent className={cn("p-0 px-2 pl-4 gap-2 overflow-y-auto")}>
              <div className={cn("ag-grid-theme-sync h-[250px] w-full")}>
                <AgGridReact
                  key={`conditional-filter-source-${appTheme}`}
                  rowData={rowData}
                  theme={agTheme}
                  columnDefs={colDefs}
                  defaultColDef={{
                    editable: false,
                    cellRenderer: SmartCellRenderer,
                  }}
                  pagination={true}
                  paginationPageSize={100}
                  paginationPageSizeSelector={[50, 100, 200]}
                  cellSelection={true}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  // autoSizeStrategy={{
                  //   type: 'fitGridWidth'
                  // }}
                />
              </div>
            </CardContent>
          )}
        </Card>
        </div>
        <div className="flex flex-grow w-full">
             {/* Left Section - Columns (25%) */}
        <div className="w-1/4 flex flex-col p-1 gap-1">
          <Card className="flex-grow flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Column Configurations</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col px-2 pl-4 gap-2 max-h-[27rem] overflow-y-auto">
              {columns.map((col, index) => (
                <Card
                  key={col.id}
                  onClick={() => setSelectedColumnIndex(index)}
                  className={cn(
                    "cursor-pointer transition-all duration-200 gap-[0.12rem] p-2",
                    selectedColumnIndex === index
                      ? 'border-blue-500 shadow-lg'
                      : 'border-border hover:border-muted-foreground/40 hover:shadow-md'
                  )}
                >
                  <CardHeader className="p-1">
                    <div className='flex items-center justify-between'>
                      <CardTitle className="text-base p-1">
                        {`Filter ${index + 1}`}
                      </CardTitle>
                      {columns.length > 1 && ( 
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" onClick={(e) => { e.stopPropagation(); removeColumn(index) }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-3">
                    <div>
                      <Label className="text-xs">New Column Name</Label>
                      <Input placeholder="Enter name..." value={col.manual_condition_column} onChange={(e) => updateColumnConfig(index, 'manual_condition_column', e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
          <Button onClick={addColumn} variant="outline" className="mt-2 border-dashed">
            <Plus className="mr-2 h-4 w-4" /> Add Another Column
          </Button>
        </div> 

        {/* Middle Section - Operations (45%) */}
        <div className="w-[45%] flex flex-col p-1">
          <Card className="flex-grow flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Conditional Logic</CardTitle>
              {activeColumn?.manual_condition_column && <CardDescription>Defining logic for: <Badge variant="outline">{activeColumn.manual_condition_column}</Badge></CardDescription>}
            </CardHeader>
            <CardContent className="flex-grow max-h-[27.5rem] overflow-y-auto p-[0.35rem]">
              {activeColumn ? (
                <div className="space-y-3">
                  {activeColumn.condition_filter_list.map((filter, filterIndex) => {
                    const hasElse = activeColumn.condition_filter_list.some(f => f.logic === 'else');
                    return (
                      <div key={filter.id}
                        ref={(el) => {
                          if (el) filterItemRefs.current.set(filter.id, el);
                          else filterItemRefs.current.delete(filter.id);
                        }}
                        className="p-3 border rounded-lg bg-background space-y-4 shadow-sm">
                        {/* --- Top Row: Logic Type and Remove Button --- */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {filterIndex === 0 ? (
                              <Badge variant="default" className="w-25 h-8.5 justify-center font-semibold text-sm">IF</Badge>
                            ) : (
                              <Select value={filter.logic} onValueChange={(v) => updateFilter(filterIndex, "logic", v as "if" | "else")}>
                                <SelectTrigger className="w-28 font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="if">IF</SelectItem>
                                  {(!hasElse || filter.logic === "else") && (
                                    <SelectItem value="else">ELSE</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          {activeColumn.condition_filter_list.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-500" onClick={() => removeFilter(filterIndex)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* --- Main IF Condition --- */}
                        {filter.logic === "if" && (
                          <div className='space-y-3'>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                              <div className='space-y-1'>
                                <Label className="text-xs">Source Column</Label>
                                <Select value={filter.new_condition_column} onValueChange={(v) => updateFilter(filterIndex, "new_condition_column", v)}>
                                  <SelectTrigger className='w-[170px]'>
                                    <SelectValue placeholder="Select source..." />
                                  </SelectTrigger>
                                  <SelectContent className='w-[240px]'>
                                    {availableColumns.map((opt) => (
                                      <SelectItem key={opt.name} value={opt.name}>
                                        <div className="flex justify-between w-full items-center">
                                          <span>{opt.name}</span><Badge variant="secondary" className="ml-2">{opt.type}</Badge>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className='space-y-1'>
                                <Label className="text-xs">Condition</Label>
                                <Select value={filter.condition} onValueChange={(v) => updateFilter(filterIndex, "condition", v)}>
                                  <SelectTrigger className='w-[170px]'><SelectValue placeholder="Condition..." /></SelectTrigger>
                                  <SelectContent className='w-[240px]'>
                                    {conditionOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className='space-y-1'>
                                <Label className="text-xs">Comparison Value</Label>
                                <div className="flex items-center gap-2">
                                  <Tooltip><TooltipTrigger asChild><Checkbox checked={filter.is_condition_value} onCheckedChange={(c) => updateFilter(filterIndex, "is_condition_value", !!c)} /></TooltipTrigger><TooltipContent><p>Checked: Manual Input<br />Unchecked: From Column</p></TooltipContent></Tooltip>
                                  {filter.is_condition_value ? (
                                    <Input className='w-[170px]' placeholder="Enter value" value={String(filter.condition_value ?? '')} onChange={(e) => updateFilter(filterIndex, "condition_value", e.target.value)} />
                                  ) : (
                                    <Select value={String(filter.condition_value ?? '')} onValueChange={(v) => updateFilter(filterIndex, "condition_value", v)}>
                                      <SelectTrigger className='w-[170px]'><SelectValue placeholder="Select column..." /></SelectTrigger>
                                      <SelectContent className='w-[240px]'>{availableColumns.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* --- Chained AND/OR Conditions --- */}
                        {filter.logic === "if" && filter.and_condition_list.map((andCondition, andIndex) => (
                          <div key={andIndex} className="space-y-2 pt-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3 ml-1">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 shrink-0">
                                <Label className="text-xs whitespace-nowrap">Combine with</Label>
                                <Select
                                  value={andCondition.condition_logic === 'or' ? 'or' : 'and'}
                                  onValueChange={(v) => updateAndCondition(filterIndex, andIndex, "condition_logic", v)}
                                >
                                  <SelectTrigger className="w-22 !h-7 font-semibold">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="and">AND</SelectItem>
                                    <SelectItem value="or">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-grow border-t"></div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => removeAndCondition(filterIndex, andIndex)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                              <div className='space-y-1'>
                                <Label className="text-xs">Source Column</Label>
                                <Select value={andCondition.new_condition_column} onValueChange={(v) => updateAndCondition(filterIndex, andIndex, "new_condition_column", v)}>
                                  <SelectTrigger className='w-[170px]'><SelectValue placeholder="Select source..." /></SelectTrigger>
                                  <SelectContent className='w-[240px]'>
                                    {availableColumns.map((opt) => (<SelectItem key={opt.name} value={opt.name}><div className="flex justify-between w-full items-center"><span>{opt.name}</span><Badge variant="secondary" className="ml-2">{opt.type}</Badge></div></SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className='space-y-1'>
                                <Label className="text-xs">Condition</Label>
                                <Select value={andCondition.condition} onValueChange={(v) => updateAndCondition(filterIndex, andIndex, "condition", v)}>
                                  <SelectTrigger className='w-[170px]'><SelectValue placeholder="Condition..." /></SelectTrigger>
                                  <SelectContent className='w-[240px]'>{conditionOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                              <div className='space-y-1'>
                                <Label className="text-xs">Comparison Value</Label>
                                <div className="flex items-center gap-2">
                                  <Tooltip><TooltipTrigger asChild><Checkbox checked={andCondition.is_condition_value} onCheckedChange={(c) => updateAndCondition(filterIndex, andIndex, "is_condition_value", !!c)} /></TooltipTrigger><TooltipContent><p>Checked: Manual Input<br />Unchecked: From Column</p></TooltipContent></Tooltip>
                                  {andCondition.is_condition_value ? (
                                    <Input className='w-[170px]' placeholder="Enter value" value={String(andCondition.condition_value ?? '')} onChange={(e) => updateAndCondition(filterIndex, andIndex, "condition_value", e.target.value)} />
                                  ) : (
                                    <Select value={String(andCondition.condition_value ?? '')} onValueChange={(v) => updateAndCondition(filterIndex, andIndex, "condition_value", v)}>
                                      <SelectTrigger className='w-[170px]'><SelectValue placeholder="Select column..." /></SelectTrigger>
                                      <SelectContent className='w-[240px]'>{availableColumns.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* --- Add AND/OR Button --- */}
                        {filter.logic === "if" && (
                          <div className="pl-6">
                            <Button onClick={() => addAndCondition(filterIndex)} variant="outline" size="sm" className="border-dashed w-full"><Plus className="mr-2 h-4 w-4" /> Add Condition (AND / OR)</Button>
                          </div>
                        )}
                        
                        {/* --- THEN / OTHERWISE Clause --- */}
                        <div className="space-y-3 pt-2">
                          {/* Row 1: Badge + Arithmetic Checkbox */}
                          <div className="flex items-center gap-3">
                            <Badge variant="default" className="w-25 h-7.5 justify-center font-semibold text-sm">{filter.logic === 'else' ? 'OTHERWISE' : 'THEN'}</Badge>
                            <ChevronsRight className="h-5 w-5 text-gray-400" />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`arithmetic-${filterIndex}`}
                                checked={filter.is_arithmetic}
                                onCheckedChange={(c) => updateFilter(filterIndex, "is_arithmetic", !!c)}
                              />
                              <Label htmlFor={`arithmetic-${filterIndex}`} className="text-sm font-medium cursor-pointer">Arithmetic</Label>
                            </div>
                          </div>

                          {/* Row 2: Set Value + Operation + Operation Value (All in Same Row) */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                            {/* Set Value */}
                            <div className='space-y-1'>
                              <Label className="text-xs">Set Value</Label>
                              <div className="flex items-center gap-2">
                                <Tooltip><TooltipTrigger asChild><Checkbox checked={filter.is_set_value} onCheckedChange={(c) => updateFilter(filterIndex, "is_set_value", !!c)} /></TooltipTrigger><TooltipContent><p>Checked: Manual Input<br />Unchecked: From Column</p></TooltipContent></Tooltip>
                                {filter.is_set_value ? (
                                  <Input className='w-[140px]' placeholder="Set value to..." value={String(filter.set_value ?? '')} onChange={(e) => updateFilter(filterIndex, "set_value", e.target.value)} />
                                ) : (
                                  <Select value={filter.set_value} onValueChange={(v) => updateFilter(filterIndex, "set_value", v)}>
                                    <SelectTrigger className='w-[140px]'><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent className='w-[240px]'>{availableColumns.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}</SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>

                            {/* Operation (shown when arithmetic is checked) */}
                            {filter.is_arithmetic ? (
                              <div className='space-y-1'>
                                <Label className="text-xs">Operation</Label>
                                <Select value={filter.arithmetic_operation} onValueChange={(v) => updateFilter(filterIndex, "arithmetic_operation", v)}>
                                  <SelectTrigger className='w-[140px]'>
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent className='w-[240px]'>
                                    {arithmeticOptions.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : <div />}

                            {/* Operation Value (shown when arithmetic is checked) */}
                            {filter.is_arithmetic ? (
                              <div className='space-y-1'>
                                <Label className="text-xs">Operation Value</Label>
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Checkbox
                                        checked={filter.is_arithmetic_value}
                                        onCheckedChange={(c) => updateFilter(filterIndex, "is_arithmetic_value", !!c)}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Checked: Manual Input<br />Unchecked: From Column</p></TooltipContent>
                                  </Tooltip>
                                  {filter.is_arithmetic_value ? (
                                    <Input
                                      className='w-[140px]'
                                      placeholder="Enter value"
                                      value={String(filter.arithmetic_value ?? '')}
                                      onChange={(e) => updateFilter(filterIndex, "arithmetic_value", e.target.value)}
                                    />
                                  ) : (
                                    <Select value={String(filter.arithmetic_value ?? '')} onValueChange={(v) => updateFilter(filterIndex, "arithmetic_value", v)}>
                                      <SelectTrigger className='w-[140px]'><SelectValue placeholder="Select column..." /></SelectTrigger>
                                      <SelectContent className='w-[240px]'>
                                        {availableColumns.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            ) : <div />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                  <p>Select a column configuration from the left panel to start building logic.</p>
                </div>
              )}
            </CardContent>
            {activeColumn && (
              <div className="p-2 border-t flex items-end gap-2 justify-center">
                {!activeColumn.condition_filter_list.some(f => f.logic === 'else') && (
                  <Button onClick={addFilter} variant="primary" className="w-[10rem] border border-blue-500"><Plus className="mr-2 h-4 w-4" /> Add Filter Step</Button>
                )}
                <Button onClick={handlePreview}>
                  <Play className="mr-2 h-4 w-4" /> Run Preview
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Section - Output (30%) */}
        <div className="w-[30%] flex flex-col p-1">
          <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle>Output Preview</CardTitle>
              <CardDescription>Results of the transformation.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto">
              {previewData.length > 0 && activeColumn ? (
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      {previewColumns.map((colName) => (
                         <TableHead key={colName} className={cn(colName === activeColumn.manual_condition_column && "text-blue-600 font-bold")}>
                            {colName}
                         </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                         {previewColumns.map((colName) => (
                            <TableCell key={colName} className={cn(colName === activeColumn.manual_condition_column && "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 font-medium")}>
                                {String(row[colName])}
                            </TableCell>
                         ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (  
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                  <p>Run a preview to see the results here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

        <div className="flex justify-end space-x-4 p-1 border-t border-border bg-background">
        <Button variant="outline" className="px-2 py-2 text-muted-foreground hover:text-foreground">
          Cancel
        </Button>
        <Button onClick={handleSave} className="px-2 py-2 shadow-sm">
          Save Filters
        </Button>
      </div>
     
      </div>
     
     
    </TooltipProvider>
  );
};

export default ConditionalFilter;
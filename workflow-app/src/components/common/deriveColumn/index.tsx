import { useState, useEffect, useMemo, useRef } from 'react';
import { ColumnSelector } from '@/components/common/deriveColumn/ColumnSelector';
import { OperationPanel } from '@/components/common/deriveColumn/OperationPanel';
import { ResultDisplay } from '@/components/common/deriveColumn/ResultDisplay';
// import { CombinedJsonViewer } from '@/components/common/deriveColumn/CombinedJsonViewer';
import { AppliedOperation, StepResult, STRING_OPERATIONS, ColumnSourceConfig, ConcatPart, Column } from '@/types/deriveColumn';
import { CombinedJsonViewer } from './CombinedJsonViewer';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';


interface LoadedConfiguration {
  source: {
    target_column: string | null;
    operations: AppliedOperation[];
    generated_columns?: any[];
  };
}

const polarToDateFnsMap: Record<string, string> = {
  '%Y': 'yyyy', '%y': 'yy', '%m': 'MM', '%b': 'MMM', '%B': 'MMMM',
  '%d': 'dd', '%H': 'HH', '%I': 'hh', '%p': 'a', '%M': 'mm', '%S': 'ss',
  '%f': 'SSS', '%z': 'xx', '%Z': 'zzz', '%j': 'DDD', '%a': 'EEE',
  '%A': 'EEEE', '%w': 'i', '%U': 'ww', '%W': 'II', '%%': '%'
};

function convertPolarFormatToDateFns(polarFormat: string | undefined): string {
  if (!polarFormat) return '';
  const regex = new RegExp(Object.keys(polarToDateFnsMap).join('|'), 'g');
  return polarFormat.replace(regex, (match) => polarToDateFnsMap[match]);
}

// Helper to convert snake_case to camelCase
const toCamelCase = (s: string) => s.replace(/(_\w)/g, k => k[1].toUpperCase());

const convertKeysToCamelCase = (o: any): any => {
  if (Array.isArray(o)) {
    return o.map(v => convertKeysToCamelCase(v));
  } else if (o !== null && typeof o === 'object' && o.constructor === Object) {
    return Object.keys(o).reduce((acc, k) => {
      const newKey = toCamelCase(k);
      acc[newKey] = convertKeysToCamelCase(o[k]);
      return acc;
    }, {} as Record<string, any>);
  }
  return o;
};

export type DeriveColumnProps = {
  onClickSave?: (json: Object) => void;
  previewDeriveData: any;
  operationsSet?: any[];
  configurationName?: string;
  hideOutputTarget?: boolean;
  hideAddCustomColumn?: boolean;
  autoEmit?: boolean;
  showResultDisplay?: boolean;
  showAiPanel?: boolean;
  onAiButtonClick?: () => void;
  onAiAccept?: (predicate: any) => void;
  onAiDiscard?: () => void;
  prepareAiContext?: () => any;
  /** When previous node has multi-source output (e.g. N-way matching), which source key to use (VBAK_DATA, VBAP_DATA, etc.) */
  selectedSourceKey?: string | null;
};

const noop = () => {};

const DeriveColumn = ({
  onClickSave = noop,
  previewDeriveData,
  operationsSet = STRING_OPERATIONS,
  configurationName = "String Transformation Configuration",
  hideOutputTarget = false,
  hideAddCustomColumn = false,
  autoEmit = true,
  showResultDisplay = true,
  showAiPanel = false,
  onAiButtonClick = noop,
  onAiAccept = noop,
  onAiDiscard = noop,
  prepareAiContext = () => ({}),
  selectedSourceKey = null,
}: DeriveColumnProps) => {
  const [availableColumns, setAvailableColumns] = useState<Column[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<Column | any>("");
  const [appliedOperations, setAppliedOperations] = useState<AppliedOperation[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [executionResults, setExecutionResults] = useState<StepResult[] | null>(null)
  const isProgrammaticChange = useRef(false);
  const hasSavedInitialConfig = useRef(false);

  const handleColumnsChange = (columns: Column[]) => {
    setAvailableColumns(columns);
    if (selectedColumn && !columns.find(c => c.id === selectedColumn.id)) {
      isProgrammaticChange.current = true;
      setSelectedColumn(columns.length > 0 ? columns[0] : null);
    }
  };

  const handleColumnSelection = (column: Column) => {
    if (selectedColumn?.id !== column.id) {
      setSelectedColumn(column);
    }
  };

  // 1. Update the applyOperation function to handle new parameter structures:

  const applyOperation = (op: AppliedOperation, value: any, rowIndex: number) => {
    try {
      const opDef = operationsSet.find(o => o.name === op.operation_name);
      if (!opDef) throw new Error(`Operation "${op.operation_name}" not found.`);

      const getParamValue = (paramValue: any) => {
        if (paramValue && typeof paramValue === 'object' && paramValue.source_mode) {
          const config = paramValue as ColumnSourceConfig;
          const col = availableColumns.find(c => c.id === config.column_id);
          if (!col) return '';
          let colValue = String(col.sampleData[rowIndex] ?? '');
          if (config.source_mode === 'substring') {
            colValue = colValue.slice(config.start, config.end);
          }
          return `${config.prefix || ''}${colValue}${config.suffix || ''}`;
        }
        return paramValue;
      };

      const args = opDef.parameters.map(p => getParamValue(op.parameters[p.name]));

      switch (op.operation_name) {
        // Basic string transformation operations
        case 'toUpperCase':
        case 'to_uppercase':
          return { result: String(value).toUpperCase() };

        case 'toLowerCase':
        case 'to_lowercase':
          return { result: String(value).toLowerCase() };

        case 'reverse':
          return { result: String(value).split('').reverse().join('') };

        case 'to_titlecase':
          return { result: String(value).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()) };

        case 'to_str':
          return { result: String(value) };

        case 'to_int': {
          const intResult = parseInt(String(value), 10);
          return { result: isNaN(intResult) ? null : intResult };
        }

        case 'to_float': {
          const floatResult = parseFloat(String(value));
          return { result: isNaN(floatResult) ? null : floatResult };
        }

        // Updated trim operations to handle strip parameter
        case 'trim': {
          const [strip] = args;
          let result = String(value);
          if (strip && strip !== '') {
            const stripChar = String(strip);
            result = result.replace(new RegExp(`^[${stripChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+|[${stripChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`, 'g'), '');
          } else {
            result = result.trim();
          }
          return { result };
        }

        case 'trimStart': {
          const [strip] = args;
          let result = String(value);
          if (strip && strip !== '') {
            const stripChar = String(strip);
            result = result.replace(new RegExp(`^[${stripChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+`, 'g'), '');
          } else {
            result = result.trimStart();
          }
          return { result };
        }

        case 'trimEnd': {
          const [strip] = args;
          let result = String(value);
          if (strip && strip !== '') {
            const stripChar = String(strip);
            result = result.replace(new RegExp(`[${stripChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`, 'g'), '');
          } else {
            result = result.trimEnd();
          }
          return { result };
        }

        // Updated replace operations to handle regex checkbox
        case 'replace': {
          const isRegex = op.parameters.is_regex;
          const searchValue = getParamValue(op.parameters.search_value);
          const replaceValue = getParamValue(op.parameters.replace_value);

          if (!searchValue) return { error: 'Search value is required' };

          let result = String(value);
          if (isRegex) {
            try {
              const regex = new RegExp(searchValue);
              result = result.replace(regex, replaceValue || '');
            } catch (e) {
              return { error: `Invalid regex pattern: ${searchValue}` };
            }
          } else {
            result = result.replace(searchValue, replaceValue || '');
          }
          return { result };
        }

        case 'replaceAll': {
          const isRegex = op.parameters.is_regex;
          const searchValue = getParamValue(op.parameters.search_value);
          const replaceValue = getParamValue(op.parameters.replace_value);

          if (!searchValue) return { error: 'Search value is required' };

          let result = String(value);
          if (isRegex) {
            try {
              const regex = new RegExp(searchValue, 'g');
              result = result.replace(regex, replaceValue || '');
            } catch (e) {
              return { error: `Invalid regex pattern: ${searchValue}` };
            }
          } else {
            // Use split and join instead of replaceAll for compatibility
            result = result.split(searchValue).join(replaceValue || '');
          }
          return { result };
        }

        // Updated split operation to handle regex and index
        case 'split': {
          const isRegex = op.parameters.is_regex;
          const separator = getParamValue(op.parameters.separator);
          const index = getParamValue(op.parameters.limit); // Using limit as index based on the types

          let parts: string[];
          if (isRegex && separator) {
            try {
              const regex = new RegExp(separator);
              parts = String(value).split(regex);
            } catch (e) {
              return { error: `Invalid regex pattern: ${separator}` };
            }
          } else {
            parts = String(value).split(separator || '');
          }

          if (index !== undefined && index !== null) {
            if (index < 0 || index >= parts.length) {
              return { error: `Index ${index} is out of bounds for split array (length: ${parts.length}).` };
            }
            return { result: parts[index] };
          }

          return { result: parts };
        }

        // Updated containsAny to handle regex checkbox
        case 'containsAny': {
          const isRegex = op.parameters.is_regex;
          const values = getParamValue(op.parameters.values);

          if (!values) return { result: false, error: "No values provided to search for." };

          const searchValues = String(values).split(',').map(s => s.trim()).filter(Boolean);
          if (searchValues.length === 0) return { result: false, error: "No valid values provided to search for." };

          const stringValue = String(value);

          if (isRegex) {
            try {
              return {
                result: searchValues.some(pattern => {
                  const regex = new RegExp(pattern);
                  return regex.test(stringValue);
                })
              };
            } catch (e) {
              return { error: `Invalid regex pattern in values: ${values}` };
            }
          } else {
            return { result: searchValues.some(term => stringValue.includes(term)) };
          }
        }

        // New numeric operations
        case 'abs': {
          const numValue = parseFloat(String(value));
          return { result: isNaN(numValue) ? null : Math.abs(numValue) };
        }

        case 'round': {
          const [decimals] = args;
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) return { result: null };
          const decimalPlaces = decimals !== undefined ? Number(decimals) : 0;
          return { result: Number(numValue.toFixed(decimalPlaces)) };
        }

        case 'floor': {
          const numValue = parseFloat(String(value));
          return { result: isNaN(numValue) ? null : Math.floor(numValue) };
        }

        case 'ceil': {
          const numValue = parseFloat(String(value));
          return { result: isNaN(numValue) ? null : Math.ceil(numValue) };
        }

        case 'clip': {
          const [minValue, maxValue] = args;
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) return { result: null };

          let result = numValue;
          if (minValue !== undefined && minValue !== null) result = Math.max(result, Number(minValue));
          if (maxValue !== undefined && maxValue !== null) result = Math.min(result, Number(maxValue));
          return { result };
        }

        case 'cumsum': {
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) return { result: null };
          // For cumsum, we need access to previous row values
          // In the context of single-row operations, we'll just return the value itself
          // The actual cumulative sum should be handled at a higher level when processing multiple rows
          return { result: numValue };
        }

        case 'fill_null': {
          const fillValue = getParamValue(op.parameters.fill_value);
          if (value === null || value === undefined || value === '') {
            return { result: fillValue || '' };
          }
          return { result: value };
        }

        // Updated substring operation
        case 'substring': {
          const [start, end] = args;
          if (start === undefined) return { error: 'Start index is required for substring operation.' };
          return { result: String(value).substring(Number(start), end !== undefined ? Number(end) : undefined) };
        }

        // Updated padding operations
        case 'padStart': {
          const [targetLength, padString] = args;
          if (targetLength === undefined) return { error: 'Target length is required for padStart operation.' };
          return { result: String(value).padStart(Number(targetLength), padString || ' ') };
        }

        case 'padEnd': {
          const [targetLength, padString] = args;
          if (targetLength === undefined) return { error: 'Target length is required for padEnd operation.' };
          return { result: String(value).padEnd(Number(targetLength), padString || ' ') };
        }

        case 'to_date':
        case 'to_datetime':
        case 'to_time': {
          const [inputFormat] = args;
          const dateFnsInputFormat = convertPolarFormatToDateFns(inputFormat);
          let date;
          try {
            if (dateFnsInputFormat && typeof dateFnsInputFormat === 'string') {
              date = parse(String(value), dateFnsInputFormat, new Date());
            } else {
              date = new Date(value);
            }
            if (isNaN(date.getTime())) {
              throw new Error('Invalid date');
            }
          } catch (e) {
            return { error: `Could not parse date: "${value}" with format "${inputFormat}"` };
          }
          if (op.operation_name === 'to_date') return { result: format(date, 'yyyy-MM-dd') };
          if (op.operation_name === 'to_datetime') return { result: date.toISOString() };
          if (op.operation_name === 'to_time') return { result: format(date, 'HH:mm:ss') };
          break;
        }

        case 'strftime': { 
          const [outputFormat] = args;
          const date = new Date(value);
          if (isNaN(date.getTime())) { 
            return { error: `Invalid date input: "${value}"` };
          }
          if (!outputFormat) return { error: 'Output format string is required.' };
          const dateFnsOutputFormat = convertPolarFormatToDateFns(outputFormat);
          try {
            return { result: format(date, dateFnsOutputFormat) };
          } catch (e) {
            return { error: `Invalid output format: "${outputFormat}"` };
          }
        }

        case 'concat': {
          const sources: ConcatPart[] = op.parameters.sources || [];
          let result = String(value);
          for (const part of sources) {
            const partStr =
              part.type === 'column' && part.column_config
                ? String(getParamValue(part.column_config) ?? '')
                : String(part.value ?? '');
            if (part.concat === 'prefix') {
              result = partStr + result;
            } else {
              result = result + partStr;
            }
          }
          return { result };
        }

        // Data Filter Operations (support both naming conventions)
        case 'equals':
          return { result: String(value) === String(args[0]) };

        case 'notEquals':
        case 'not_equals':
          return { result: String(value) !== String(args[0]) };

        case 'greater_than':
          const gtValue = parseFloat(String(value));
          const gtComparison = parseFloat(String(args[0]));
          return { result: !isNaN(gtValue) && !isNaN(gtComparison) && gtValue > gtComparison };

        case 'less_than':
          const ltValue = parseFloat(String(value));
          const ltComparison = parseFloat(String(args[0]));
          return { result: !isNaN(ltValue) && !isNaN(ltComparison) && ltValue < ltComparison };

        case 'greater_than_or_equal':
        case 'greater_than_or_equal_to':
          const gteValue = parseFloat(String(value));
          const gteComparison = parseFloat(String(args[0]));
          return { result: !isNaN(gteValue) && !isNaN(gteComparison) && gteValue >= gteComparison };

        case 'less_than_or_equal':
        case 'less_than_or_equal_to':
          const lteValue = parseFloat(String(value));
          const lteComparison = parseFloat(String(args[0]));
          return { result: !isNaN(lteValue) && !isNaN(lteComparison) && lteValue <= lteComparison };

        case 'is_null':
          return { result: value === null || value === undefined || String(value) === '' };

        case 'is_not_null':
          return { result: value !== null && value !== undefined && String(value) !== '' };

        case 'startsWith':
        case 'starts_with':
          return { result: String(value).startsWith(String(args[0])) };

        case 'endsWith':
        case 'ends_with':
          return { result: String(value).endsWith(String(args[0])) };

        case 'not_starts_with':
          return { result: !String(value).startsWith(String(args[0])) };

        case 'not_ends_with':
          return { result: !String(value).endsWith(String(args[0])) };

        case 'is_in':
          const inValues = String(args[0]).split(',').map(v => v.trim());
          return { result: inValues.includes(String(value)) };

        case 'not_is_in':
          const notInValues = String(args[0]).split(',').map(v => v.trim());
          return { result: !notInValues.includes(String(value)) };

        case 'len_chars':
          // Returns the number of characters in the string
          return { result: String(value).length };

        case 'len_bytes':
          // Returns the number of bytes in the string (UTF-8 encoding)
          // Using TextEncoder to get the byte length of the string
          const encoder = new TextEncoder();
          const bytes = encoder.encode(String(value));
          return { result: bytes.length };

        case 'extract': {
          if (value === null || value === undefined) {
            return { result: null };
          }
          const pattern = getParamValue(op.parameters.pattern);
          if (!pattern) {
            return { error: 'Pattern is required for extract operation.' };
          }
          const groupIndex =
            op.parameters.group_index !== undefined && op.parameters.group_index !== null
              ? Number(op.parameters.group_index)
              : 1;
          try {
            const regex = new RegExp(pattern);
            const match = String(value).match(regex);
            if (!match) {
              return { result: null };
            }
            if (groupIndex === 0) {
              return { result: match[0] ?? null };
            }
            return { result: match[groupIndex] ?? null };
          } catch {
            return { error: `Invalid regex pattern: ${pattern}` };
          }
        }

        case 'extract_all': {
          if (value === null || value === undefined) {
            return { result: null };
          }
          const pattern = getParamValue(op.parameters.pattern);
          if (!pattern) {
            return { error: 'Pattern is required for extract_all operation.' };
          }
          try {
            const regex = new RegExp(pattern, 'g');
            const haystack = String(value);
            const matches: string[] = [];
            let match: RegExpExecArray | null;
            while ((match = regex.exec(haystack)) !== null) {
              matches.push(match[0]);
              if (match[0] === '') {
                regex.lastIndex += 1;
              }
            }
            return { result: matches };
          } catch {
            return { error: `Invalid regex pattern: ${pattern}` };
          }
        }

        default: {
          // Fallback for standard string methods
          if (typeof String.prototype[op.operation_name] === 'function') {
            // @ts-ignore
            return { result: String(value)[op.operation_name](...args) };
          }
          return { error: `Operation "${op.operation_name}" is not a standard method and has no custom implementation.` };
        }
      }
      return { error: 'Unhandled operation' };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const handleExecute = () => {
    if (!selectedColumn) return;

    // --- Part 1: Process all rows to generate new columns ---
    const newColumns: Column[] = [];
    let dataStream = [...selectedColumn.sampleData];

    for (const op of appliedOperations) {
      const isNewColumnOp = ['replace', 'replaceAll', 'concat'].includes(op.operation_name) && op.output_target?.mode === 'new-column';

      if (isNewColumnOp && op.output_target?.new_column_name) {
        const newColumnName = op.output_target.new_column_name;
        const newColumnData = dataStream.map((value, rowIndex) => {
          const { result } = applyOperation(op, value, rowIndex);
          return result;
        });

        newColumns.push({
          id: `new-col-${op.id}`,
          name: newColumnName,
          type: 'string',
          sampleData: newColumnData.map(d => String(d ?? '')),
        });
        // Data stream for the next operation remains unchanged for a "new column" op
      } else {
        // In-place operation
        dataStream = dataStream.map((value, rowIndex) => {
          const { result, error } = applyOperation(op, value, rowIndex);
          return error ? value : result; // if error, keep original value
        });
      }
    }

    if (newColumns.length > 0) {
      setAvailableColumns(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const uniqueNewColumns = newColumns.filter(c => !existingIds.has(c.id));
        return [...prev, ...uniqueNewColumns];
      });
    }

    // --- Part 2: Generate step-by-step results for UI display ---
    const initialValue = selectedColumn.sampleData[selectedRowIndex] || '';
    const steps: StepResult[] = [];
    let currentValue: any = initialValue;

    for (const op of appliedOperations) {
      if (!op.operation_name) {
        steps.push({ id: op.id, operation_name: 'Unconfigured', result: currentValue, error: 'Select an operation' });
        continue;
      }
      const { result, error } = applyOperation(op, currentValue, selectedRowIndex);

      steps.push({ id: op.id, operation_name: op.operation_name, result, error });

      const isNewColumnOp = ['replace', 'replaceAll', 'concat'].includes(op.operation_name) && op.output_target?.mode === 'new-column';
      if (!isNewColumnOp) {
        currentValue = error ? null : result;
      }

      if (error) break;
    }
    setExecutionResults(steps);
  };

  const handleLoadConfiguration = (config: LoadedConfiguration) => {
    if (!config || !config.source) {
      toast.error("Invalid configuration file format.");
      return;
    }

    const baseColumns = availableColumns.filter(c => !c.id.startsWith('custom-') && !c.id.startsWith('new-col-'));
    const loadedColumns = config.source.generated_columns || [];
    const allColumns = [...baseColumns];
    const seenIds = new Set(baseColumns.map(c => c.id));

    for (const loadedCol of loadedColumns) {
      if (!seenIds.has(loadedCol.id)) {
        allColumns.push(loadedCol);
        seenIds.add(loadedCol.id);
      }
    }
    setAvailableColumns(allColumns);

    const reIdedOperations = (config.source.operations || []).map((op, index) => ({
      ...op,
      id: `loaded_op_${Date.now()}_${index}`
    }));
    setAppliedOperations(reIdedOperations);

    const targetColumn = allColumns.find(c => c.name === config.source.target_column);

    isProgrammaticChange.current = true;
    setSelectedColumn(targetColumn || (allColumns.length > 0 ? allColumns[0] : null));

    setExecutionResults(null);
    setSelectedRowIndex(0);
  };

  useEffect(() => {
    if (!selectedColumn && availableColumns.length > 0) {
      isProgrammaticChange.current = true;
      // setSelectedColumn(availableColumns[0]);

      if (previewDeriveData && previewDeriveData?.custom_derived_columns?.source) {
        handleLoadConfiguration(previewDeriveData?.custom_derived_columns);
      }
    }
  }, [availableColumns]);

  // Load configuration when previewDeriveData changes (for edit functionality)
  useEffect(() => {
    if (previewDeriveData && previewDeriveData?.custom_derived_columns?.source && availableColumns.length > 0) {
      isProgrammaticChange.current = true;
      handleLoadConfiguration(previewDeriveData?.custom_derived_columns);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDeriveData]);

  useEffect(() => {
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false;
      return;
    }

    if (selectedColumn) {
      setAppliedOperations([]);
      setSelectedRowIndex(0);
      setExecutionResults(null);
    }
  }, [selectedColumn]);

  useEffect(() => {
    setExecutionResults(null);
  }, [appliedOperations, selectedRowIndex]);

  const operationChainJson = useMemo(() => {
    const columnMap = new Map(availableColumns.map(col => [col.id, col.name]));

    const enrichParameter = (paramValue: any) => {
      if (paramValue && typeof paramValue === 'object' && paramValue.source_mode && paramValue.column_id) {
        return { ...paramValue, column_name: columnMap.get(paramValue.column_id) || 'Unknown Column' };
      }
      return paramValue;
    };
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));


    const enrichedOperations = JSON.parse(JSON.stringify(appliedOperations)).map((op: AppliedOperation) => {
      for (const paramName in op.parameters) {
        if (paramName === 'sources' && Array.isArray(op.parameters.sources)) {
          op.parameters.sources.forEach((part: any) => {
            if (part.type === 'column' && part.column_config) {
              part.column_config = enrichParameter(part.column_config);
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
    return data;
  }, [appliedOperations, selectedColumn, availableColumns]);

  const finalOutputJson = useMemo(() => {
    // Allow configuration to be saved even without selectedColumn if there are custom columns
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));

    if (!selectedColumn && customColumns.length === 0) {
      return JSON.stringify({ message: "Select a column to begin." }, null, 2);
    }
    if (!executionResults) return JSON.stringify({ message: "Click 'Execute' to generate the output JSON." }, null, 2);

    if (!selectedColumn) {
      // If no column selected but we have custom columns, still allow save
      return JSON.stringify({ message: "Custom columns added. Select a target column to apply operations." }, null, 2);
    }

    const initialValue = selectedColumn.sampleData[selectedRowIndex] || '';
    const finalResult = executionResults.length > 0 ? executionResults[executionResults.length - 1].result : initialValue;
    const data = {
      finalResult,
      metadata: {
        initialColumn: selectedColumn.name,
        initialValue,
        operationsApplied: executionResults.filter(r => !r.error).length,
        resultType: Array.isArray(finalResult) ? 'array' : typeof finalResult,
        timestamp: new Date().toISOString()
      }
    };
    return JSON.stringify(data, null, 2);
  }, [executionResults, selectedColumn, selectedRowIndex, availableColumns]);

  const fullConfigurationJson = useMemo(() => {
    const data: any = {
      name: configurationName,
      timestamp: new Date().toISOString(),
      source: operationChainJson,
      // generated_columns: customColumns,
      sample_execution: JSON.parse(finalOutputJson)
    };

    // Add id if it exists in previewDeriveData
    if (previewDeriveData?.id) {
      data.id = previewDeriveData.id;
    }

    return data;
  }, [operationChainJson, finalOutputJson, availableColumns, previewDeriveData?.id, configurationName]);


  // Also create a memoized object version for onClickSave
  // Handle saving configuration when it's ready
  // This notifies parent components when configuration changes, but doesn't trigger API calls
  // API calls are only made when user clicks the Save button in the modal
  useEffect(() => {
    // Allow saving if selectedColumn exists OR if there are custom columns
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));
    const canSave = selectedColumn || customColumns.length > 0;

    if (canSave && !hasSavedInitialConfig.current) {
      hasSavedInitialConfig.current = true;
      onClickSave(fullConfigurationJson);
    }
  }, [selectedColumn, fullConfigurationJson, onClickSave, availableColumns]);

  // Handle updates to configuration - notify parent of changes
  useEffect(() => {
    // Allow saving if selectedColumn exists OR if there are custom columns
    const customColumns = availableColumns.filter(col => col.id.startsWith('custom-') || col.id.startsWith('new-col-'));
    const canSave = selectedColumn || customColumns.length > 0;

    if (hasSavedInitialConfig.current && canSave) {
      onClickSave(fullConfigurationJson);
    }
  }, [appliedOperations, availableColumns, fullConfigurationJson, onClickSave, selectedColumn]);

  return (  //className="bg-background mx-auto mb-2 text-muted-foreground text-sm"
    <div className="bg-background">
      <div className="mx-auto">
        <div className="mb-2">
          <p className="text-muted-foreground text-sm">
            Chain multiple operations, and view the output at each step.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[720px]">
            <ColumnSelector
              selectedColumn={selectedColumn}
              onColumnSelect={handleColumnSelection}
              onColumnsChange={handleColumnsChange}
              hideAddCustomColumn={hideAddCustomColumn}
              selectedSourceKey={selectedSourceKey}
            />
          </div>

          <div className="h-[720px]">
            <OperationPanel
              selectedColumn={selectedColumn}
              availableColumns={availableColumns}
              appliedOperations={appliedOperations}
              onOperationsChange={setAppliedOperations}
              selectedRowIndex={selectedRowIndex}
              onSelectedRowIndexChange={setSelectedRowIndex}
              onExecute={handleExecute}
              operationsSet={operationsSet}
              hideOutputTarget={hideOutputTarget}
              onAiButtonClick={onAiButtonClick}
            />
          </div>

          <div className="h-[720px] relative">
            {showResultDisplay && (
              <ResultDisplay
                selectedColumn={selectedColumn}
                selectedRowIndex={selectedRowIndex}
                results={executionResults}
              />
            )}
          </div>

          <div className="h-[720px] lg:col-span-3">
            <CombinedJsonViewer
              results={executionResults}
              selectedColumn={selectedColumn}
              selectedRowIndex={selectedRowIndex}
              operations={appliedOperations}
              availableColumns={availableColumns}
              onLoadConfiguration={handleLoadConfiguration}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeriveColumn;
import * as React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { X, Plus, ChevronDown, Settings2, Type, Hash, CalendarDays, Check } from 'lucide-react';
import type { ChartFormParameter } from '@/pages/Visualization/API/chartsApi';
import { FieldPill } from './ChartConfigurator';
import useFlowStore from '@/stores/flowStore';

export interface DynamicChartFormProps {
  parameters: ChartFormParameter[];
  fields: Array<{ name: string; type: string }>;
  /** When set, limits column pickers/dropdowns per binding param (e.g. x-axis vs dimensions vs metrics). */
  fieldsByParamKey?: Record<string, Array<{ name: string; type: string }>>;
  formValues: Record<string, any>;
  onFormChange: (key: string, value: any) => void;
  onFieldDropped?: (paramKey: string) => void;
  droppedFieldParamKey?: string | null;
  pendingAddedKey?: string | null;
  onResolvePending?: () => void;
  filterValueOptions?: Record<string, string[]>;
  validationErrors?: Set<string>; // Set of parameter keys that have validation errors
  isViewOnly?: boolean;
  isSingleSource?: boolean;
}

const FieldIcon = ({ type, name }: { type: string; name?: string }) => {
  const t = (type || '').toLowerCase();
  let resolvedType = t;

  if (t === 'string' || t === 'varchar' || t === 'text' || t === 'char') {
    resolvedType = 'string';
  } else if (t === 'number' || t === 'int' || t === 'integer' || t === 'bigint' || t === 'float' || t === 'double' || t === 'decimal' || t === 'numeric') {
    resolvedType = 'number';
  } else if (t === 'date' || t === 'timestamp' || t === 'datetime' || t === 'time') {
    resolvedType = 'date';
  } else if (name) {
    resolvedType = inferFieldType(name);
  } else {
    resolvedType = inferFieldType(type);
  }

  switch (resolvedType) {
    case 'string':
      return <Type className="!h-3 !w-3 text-muted-foreground" />;
    case 'number':
      return <Hash className="!h-3 !w-3 text-muted-foreground" />;
    case 'date':
      return <CalendarDays className="!h-3 !w-3 text-muted-foreground" />;
    default:
      return <Type className="!h-3 !w-3 text-muted-foreground" />;
  }
};

const inferFieldType = (columnName: string): 'string' | 'number' | 'date' => {
  const name = columnName.toLowerCase();

  // Date patterns
  const datePatterns = [
    'date', 'time', 'timestamp', 'created', 'updated', 'modified',
    'start', 'end', 'birth', 'join', 'expire', 'valid', 'since',
    'day', 'month', 'year', 'hour', 'minute', 'second'
  ];

  if (datePatterns.some(pattern => name.includes(pattern))) {
    return 'date';
  }

  // Number patterns
  const numberPatterns = [
    'count', 'sum', 'total', 'amount', 'price', 'cost', 'value',
    'quantity', 'qty', 'num', 'number', 'id', 'score', 'rate',
    'percent', 'percentage', 'ratio', 'avg', 'average', 'max', 'min',
    'netwr', 'txn', 'txns', 'amount', 'balance', 'revenue', 'profit',
    'loss', 'income', 'expense', 'fee', 'charge', 'discount'
  ];

  if (numberPatterns.some(pattern => name.includes(pattern))) {
    return 'number';
  }

  // Default to string
  return 'string';
};

const DropZone = ({
  id,
  children,
  placeholder,
  hasError = false,
}: {
  id: string;
  children: React.ReactNode;
  placeholder?: string;
  hasError?: boolean;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const { active } = useDndContext();
  const [draggedFieldName, setDraggedFieldName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOver && active?.data?.current?.type === 'field') {
      const field = active.data.current.field as { name: string; type: string };
      setDraggedFieldName(field.name);
    } else if (!isOver || !active) {
      setDraggedFieldName(null);
    }
  }, [isOver, active]);

  const fieldType = draggedFieldName ? inferFieldType(draggedFieldName) : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[32px] w-full rounded-md border border-dashed bg-background p-0.5 transition-colors',
        hasError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-input',
        isOver && !hasError && 'border-primary bg-primary/10',
        (!children || (Array.isArray(children) && children.length === 0)) && 'flex items-center gap-2',
        // Always allow drops, even when populated - show visual feedback
        children && !hasError && 'cursor-pointer hover:border-primary/50'
      )}
    >
      {children ? (
        <>
          {children}
          {/* Show drop hint even when children present for multi-drop zones */}
          {Array.isArray(children) && children.length === 0 && (
            <span className="text-xs text-muted-foreground px-2 flex items-center gap-1">
              {fieldType && <FieldIcon type={fieldType} />}
              {placeholder || 'Drop here'}
            </span>
          )}
          {/* Show drop indicator when dragging over populated zone */}
          {isOver && active && (
            <div className="mt-1 text-xs text-primary/70 flex items-center gap-1">
              <Plus className="h-3 w-3" />
              <span>Drop to add</span>
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground px-2 flex items-center gap-2">
          {fieldType && <FieldIcon type={fieldType} />}
          {placeholder || 'Drop here'}
        </span>
      )}
    </div>
  );
};

/** Columns picker with search inside the dropdown (Radix Select steals keys from nested inputs; Popover does not.) */
function ColumnSelectWithSearch({
  param,
  fieldKey,
  selectValue,
  availableOptions,
  formValues,
  onFormChange,
  parentParamKey,
  parentParams,
  searchQueries,
  setSearchQueries,
}: {
  param: ChartFormParameter;
  fieldKey: string;
  selectValue: string;
  availableOptions: string[];
  formValues: Record<string, any>;
  onFormChange: (key: string, value: any) => void;
  parentParamKey?: string;
  parentParams?: ChartFormParameter[];
  searchQueries?: Record<string, string>;
  setSearchQueries?: (q: Record<string, string>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const q = (searchQueries?.[fieldKey] || '').toLowerCase();
  const filtered = availableOptions.filter((opt) =>
    String(opt).toLowerCase().includes(q)
  );

  const commit = (val: string) => {
    onFormChange(fieldKey, val);
    if (param.key === 'columns' && parentParamKey && parentParams && parentParams.length > 0) {
      const parentParam = parentParams[0];
      const isMultiple = parentParam.type === 'drag_and_drop_or_select_multiple';
      const parentValue = formValues[parentParamKey];
      if (isMultiple) {
        const currentArray = Array.isArray(parentValue) ? parentValue : [];
        const lastIndex = currentArray.length - 1;
        if (lastIndex >= 0) {
          const newArray = [...currentArray];
          newArray[lastIndex] = val;
          onFormChange(parentParamKey, newArray);
        } else {
          onFormChange(parentParamKey, [val]);
        }
      } else {
        onFormChange(parentParamKey, val);
      }
    }
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{param.label}</Label>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full !h-8 justify-between font-normal text-sm px-3 !border-foreground/10',
              !selectValue && '!text-foreground/40'
            )}
          >
            <span className="truncate">{selectValue || param.placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[1200] w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-[min(320px,85vh)] overflow-hidden p-0 flex flex-col"
          align="start"
        >
          <div className="shrink-0 border-b p-2 bg-popover">
            <Input
              value={searchQueries?.[fieldKey] || ''}
              onChange={(e) =>
                setSearchQueries?.({ ...(searchQueries || {}), [fieldKey]: e.target.value })
              }
              placeholder="Search..."
              className="h-7 text-sm"
            />
          </div>
          <div
            className="min-h-0 max-h-[min(240px,calc(85vh_-_8rem))] overflow-y-auto overflow-x-hidden overscroll-contain p-1 bg-popover [scrollbar-gutter:stable]"
            role="listbox"
            aria-label={param.label || 'Columns'}
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No columns found.</p>
            ) : (
              filtered.map((option, oi) => (
                <button
                  key={`${fieldKey}_${String(option)}_${oi}`}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    option === selectValue && 'bg-accent'
                  )}
                  onClick={() => commit(option)}
                >
                  <span className="truncate">{option}</span>
                  {option === selectValue && (
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      <Check className="size-4" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Filter "value" field: search loaded unique values and optionally commit a typed value
 * that is not in the list (sent to the backend like any other selected value).
 */
function FilterValueSearchAndAdd({
  fieldKey,
  placeholder,
  availableOptions,
  currentArray,
  onFormChange,
  searchQueries,
  setSearchQueries,
}: {
  fieldKey: string;
  placeholder?: string;
  availableOptions: string[];
  currentArray: string[];
  onFormChange: (key: string, value: any) => void;
  searchQueries?: Record<string, string>;
  setSearchQueries?: (q: Record<string, string>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rawQ = searchQueries?.[fieldKey] ?? '';
  const trimmed = rawQ.trim();
  const searchLower = trimmed.toLowerCase();
  const filtered =
    searchLower === ''
      ? availableOptions
      : availableOptions.filter((opt) => String(opt).toLowerCase().includes(searchLower));

  const exactInOptions = trimmed !== '' &&
    availableOptions.some((o) => String(o).toLowerCase() === searchLower);

  const showAddCustom =
    trimmed !== '' &&
    !exactInOptions &&
    !currentArray.includes(trimmed);

  const commit = (val: string) => {
    const v = String(val).trim();
    if (!v) return;
    if (currentArray.includes(v)) return;
    onFormChange(fieldKey, [...currentArray, v]);
    setSearchQueries?.({ ...(searchQueries || {}), [fieldKey]: '' });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full !h-9 justify-between font-normal text-sm px-3 !border-foreground/10',
            '!text-foreground/40'
          )}
        >
          <span className="truncate">{placeholder || 'Select value'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[1200] w-[var(--radix-popover-trigger-width)] min-w-[240px] max-h-[min(320px,85vh)] p-0 overflow-hidden flex flex-col"
        align="start"
      >
        <div className="shrink-0 border-b p-2 bg-popover">
          <Input
            value={rawQ}
            onChange={(e) =>
              setSearchQueries?.({ ...(searchQueries || {}), [fieldKey]: e.target.value })
            }
            placeholder="Search or type a value..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (showAddCustom) {
                  commit(trimmed);
                } else if (filtered.length === 1 && !currentArray.includes(String(filtered[0]))) {
                  commit(String(filtered[0]));
                }
              }
            }}
          />
        </div>
        {/* Radix ScrollArea only had max-height; viewport grew with content. Fixed height + native scroll. */}
        <div
          className="min-h-0 max-h-[min(240px,calc(85vh_-_8rem))] overflow-y-auto overflow-x-hidden overscroll-contain p-1 bg-popover [scrollbar-gutter:stable]"
          role="listbox"
          aria-label="Filter values"
        >
          {showAddCustom && (
            <button
              type="button"
              className="relative mb-1 flex w-full cursor-default select-none items-center rounded-sm border-b border-border/60 py-2 pl-2 pr-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onClick={() => commit(trimmed)}
            >
              <Plus className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                Use &quot;{trimmed}&quot;
              </span>
            </button>
          )}
          {filtered.length === 0 && !showAddCustom ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {availableOptions.length === 0
                ? 'No suggestions yet. Type a value and use “Use …” above, or pick after values load.'
                : 'No matching values.'}
            </p>
          ) : (
            filtered.map((option, oi) => {
              const optStr = String(option);
              const already = currentArray.includes(optStr);
              return (
                <button
                  key={`${fieldKey}_fv_${optStr}_${oi}`}
                  type="button"
                  disabled={already}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-14 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    already && 'cursor-not-allowed opacity-50'
                  )}
                  onClick={() => commit(optStr)}
                >
                  <span className="truncate">{optStr}</span>
                  {already && (
                    <span className="absolute right-2 text-[10px] text-muted-foreground">added</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const renderParameterField = (
  param: ChartFormParameter,
  fields: Array<{ name: string; type: string }>,
  formValues: Record<string, any>,
  onFormChange: (key: string, value: any) => void,
  onFieldDropped?: (paramKey: string) => void,
  openPopoverKey?: string | null,
  setOpenPopoverKey?: (key: string | null) => void,
  parentParamKey?: string,
  droppedFieldName?: string | null,
  parentParams?: ChartFormParameter[],
  pendingAddedKey?: string | null,
  onResolvePending?: () => void,
  filterValueOptions?: Record<string, string[]>,
  validationErrors?: Set<string>,
  searchQueries?: Record<string, string>,
  setSearchQueries?: (q: Record<string, string>) => void,
  doubleClickParamKey?: string | null,
  setDoubleClickParamKey?: (key: string | null) => void,
  doubleClickSearch?: string,
  setDoubleClickSearch?: (s: string) => void,
  isSingleSource?: boolean,
  isViewOnly?: boolean,
) => {
  // Use nested key for popover fields to avoid conflicts
  const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
  const value = formValues[fieldKey] || formValues[param.key] || null;

  switch (param.type) {
    case 'drag_and_drop_or_select_multiple':
    case 'drag_and_drop_or_select_single': {
      const isMultiple = param.type === 'drag_and_drop_or_select_multiple';

      // Get the raw value from formValues
      const rawValue = formValues[param.key];



      // For multiple fields, ensure it's an array
      // For single fields, if the value is an array with one item, extract it; otherwise use the value as-is
      let currentValue: any;
      if (isMultiple) {
        currentValue = Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
      } else {
        // For single fields, if we have an array with one item, use that item; otherwise use the value directly
        if (Array.isArray(rawValue) && rawValue.length > 0) {
          currentValue = rawValue[0]; // Take first item from array

        } else {
          currentValue = rawValue;
        }
      }


      const hasValue = isMultiple ? (Array.isArray(currentValue) && currentValue.length > 0) : !!currentValue;
      const popoverConfig = param.popover || param['popover-timerange'];
      const isPopoverOpen = openPopoverKey === param.key;

      // Get the dropped field name for auto-filling columns
      const localDroppedFieldName = isMultiple
        ? (Array.isArray(currentValue) && currentValue.length > 0 ? currentValue[currentValue.length - 1] : null)
        : (typeof currentValue === 'string' ? currentValue : currentValue?.name || null);


      const hasError = validationErrors?.has(param.key) || false;

      return (
        <div className="space-y-2">
          <Label className={cn('text-sm font-medium', hasError && 'text-red-500')}>{param.label}</Label>
          {isMultiple ? (
            <div className="space-y-1">
              {currentValue.map((item: any, idx: number) => {
                // Extract name - handle both string and object formats
                let itemName: string = '';
                if (typeof item === 'string') {
                  itemName = item;
                } else if (item && typeof item === 'object') {
                  itemName = item.name || item.columns || String(item.name || item.columns || '');
                } else {
                  itemName = String(item || '');
                }

                // Infer type if not present, but prefer the stored type
                let itemType: string = 'string';
                if (typeof item === 'string') {
                  itemType = inferFieldType(item);
                } else if (item && typeof item === 'object') {
                  itemType = item.type || inferFieldType(itemName);
                } else {
                  itemType = inferFieldType(itemName);
                }

                const itemPopoverKey = `${param.key}_${idx}`;
                const isItemPopoverOpen = openPopoverKey === itemPopoverKey;
                const aliasKey = `${itemPopoverKey}_alias`;
                const aliasValue = formValues[aliasKey] || '';
                const displayName = aliasValue || itemName;

                return (
                  <div key={idx} className="flex items-center gap-1">
                    <div className="flex-1">
                      <DropZone
                        id={`${param.key}_${idx}`}
                        placeholder={param.placeholder}
                        hasError={validationErrors?.has(param.key) || false}
                      >
                        {/* Show field pill if item exists and it's not pending (or if pending, show it anyway in edit mode) */}
                        {itemName && typeof itemName === 'string' && itemName.trim() !== '' && (
                          <FieldPill
                            field={{ name: String(itemName), type: String(itemType) }}
                            displayName={typeof displayName === 'string' && displayName.trim() !== '' ? displayName : itemName}
                            onRemove={() => {
                              const newValue = currentValue.filter((_: any, i: number) => i !== idx);
                              onFormChange(param.key, newValue);
                            }}
                          />
                        )}
                      </DropZone>
                    </div>
                    {popoverConfig && itemName && (
                      <Popover
                        modal={false}
                        open={isItemPopoverOpen}
                        onOpenChange={(open) => {
                        if (open) {
                          setOpenPopoverKey?.(itemPopoverKey);
                        } else {
                          // Outside click → CANCEL (not save)
                          if (pendingAddedKey === itemPopoverKey) {
                            const newValue = currentValue.filter((_: any, i: number) => i !== idx);
                            onFormChange(param.key, newValue);
                            // Clear all nested form values for this item when canceling
                            if (popoverConfig?.SIMPLE) {
                              popoverConfig.SIMPLE.forEach((popoverParam) => {
                                const nestedKey = `${itemPopoverKey}_${popoverParam.key}`;
                                onFormChange(nestedKey, null);
                              });
                            }
                            onResolvePending?.();
                          }
                          setOpenPopoverKey?.(null);
                        }
                      }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              setOpenPopoverKey?.(isItemPopoverOpen ? null : itemPopoverKey);
                            }}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="z-[1200] w-72 flex max-h-[min(85vh,480px)] flex-col overflow-hidden p-0" align="start">
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
                            {popoverConfig.SIMPLE?.map((popoverParam) => {
                              const nestedKey = `${itemPopoverKey}_${popoverParam.key}`;
                              // Get nested value from formValues
                              let nestedValue = formValues[nestedKey];


                              if (popoverParam.key === 'columns') {
                                // Default to dropped item name only when nested columns key is unset; do not overwrite
                                // a user-picked column (nestedValue !== itemName) or the trigger shows the wrong label.
                                if (nestedValue === undefined || nestedValue === null || nestedValue === '') {
                                  nestedValue = itemName;
                                } else if (nestedValue && typeof nestedValue === 'object') {
                                  nestedValue =
                                    nestedValue.name ||
                                    nestedValue.columns ||
                                    String(nestedValue.name || nestedValue.columns || '');
                                }
                              } else {
                                // For other fields (operation, alias, etc.), use the value from formValues
                                // If it's an object, extract the value
                                if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                                  nestedValue = nestedValue.value || nestedValue.name || nestedValue.columns || nestedValue;
                                }
                                // If still not set, use empty string
                                if (!nestedValue) {
                                  nestedValue = '';
                                }
                              }



                              return (
                                <div key={popoverParam.key} className="space-y-2">
                                  {renderParameterField(
                                    popoverParam,
                                    fields,
                                    { ...formValues, [nestedKey]: nestedValue },
                                    (key: string, val: any) => {
                                      // Update the nested key
                                      onFormChange(key, val);
                                      // If columns dropdown changed, update the item in array immediately
                                      if (popoverParam.key === 'columns' && key === nestedKey) {
                                        const newArray = [...currentValue];
                                        // Prevent duplicate columns in the same list
                                        const targetName = typeof val === 'string' ? val : (val?.name || String(val));
                                        const existsElsewhere = newArray.some((it: any, i: number) => i !== idx && ((typeof it === 'string' ? it : it?.name) === targetName));
                                        if (!existsElsewhere) {
                                          newArray[idx] = val;
                                          onFormChange(param.key, newArray);
                                        }
                                      }
                                    },
                                    onFieldDropped,
                                    openPopoverKey,
                                    setOpenPopoverKey,
                                    itemPopoverKey,
                                    itemName,
                                    [param],
                                    pendingAddedKey,
                                    onResolvePending,
                                    filterValueOptions,
                                    validationErrors,
                                    searchQueries,
                                    setSearchQueries
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex shrink-0 items-center justify-end gap-2 border-t p-3">
                            <Button
                              variant="outline"
                              className='!h-8 !px-2'
                              onClick={() => {
                                // Revert the just-added item when user cancels
                                if (pendingAddedKey === itemPopoverKey) {
                                  const newValue = currentValue.filter((_: any, i: number) => i !== idx);
                                  onFormChange(param.key, newValue);
                                  // Clear all nested form values for this item (e.g., columns, alias, operation)
                                  if (popoverConfig?.SIMPLE) {
                                    popoverConfig.SIMPLE.forEach((popoverParam) => {
                                      const nestedKey = `${itemPopoverKey}_${popoverParam.key}`;
                                      onFormChange(nestedKey, null);
                                    });
                                  }
                                  onResolvePending?.();
                                }
                                setOpenPopoverKey?.(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              className='!h-8'
                              onClick={() => {
                                // Update the specific item in the array if columns was changed
                                if (popoverConfig?.SIMPLE) {
                                  const columnsParam = popoverConfig.SIMPLE.find((p) => p.key === 'columns');
                                  if (columnsParam) {
                                    const columnsKey = `${itemPopoverKey}_columns`;
                                    const selectedColumn = formValues[columnsKey];

                                    if (selectedColumn && selectedColumn !== itemName) {
                                      const newArray = [...currentValue];
                                      const existsElsewhere = newArray.some((it: any, i: number) => i !== idx && ((typeof it === 'string' ? it : it?.name) === selectedColumn));
                                      if (!existsElsewhere) {
                                        newArray[idx] = selectedColumn;
                                        onFormChange(param.key, newArray);
                                      }
                                    }
                                  }
                                }
                                setOpenPopoverKey?.(null);
                                if (pendingAddedKey === itemPopoverKey) {
                                  onResolvePending?.();
                                }
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                );

              })}
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <Popover
                    modal={false}
                    open={doubleClickParamKey === param.key}
                    onOpenChange={(open) => {
                      if (!open && setDoubleClickParamKey && setDoubleClickSearch) {
                        setDoubleClickParamKey(null);
                        setDoubleClickSearch('');
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        onDoubleClick={() => {
                          if (isSingleSource && !isViewOnly && setDoubleClickParamKey) {
                            setDoubleClickParamKey(param.key);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <DropZone
                          id={param.key}
                          placeholder={`Drop ${param.label.toLowerCase()}`}
                          children={''}
                          hasError={validationErrors?.has(param.key) || false}
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="z-[1200] w-60 p-2 max-h-[300px] overflow-hidden flex flex-col">
                      <div className="p-1 shrink-0">
                        <Input
                          value={doubleClickSearch || ''}
                          onChange={(e) => setDoubleClickSearch?.(e.target.value)}
                          placeholder="Search columns..."
                          className="h-7 text-xs"
                          autoFocus
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 mt-1">
                        {fields
                          .filter((f) => f.name.toLowerCase().includes((doubleClickSearch || '').toLowerCase()))
                          .map((field) => (
                            <button
                              key={field.name}
                              type="button"
                              className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-sm truncate flex items-center gap-1.5"
                              onClick={() => {
                                if (typeof window !== 'undefined' && (window as any).__chartFormUpdate) {
                                  (window as any).__chartFormUpdate(param.key, field);
                                }
                                setDoubleClickParamKey?.(null);
                                setDoubleClickSearch?.('');
                              }}
                            >
                              <FieldIcon type={field.type} name={field.name} />
                              <span className="truncate">{field.name}</span>
                            </button>
                          ))}
                        {fields.filter((f) => f.name.toLowerCase().includes((doubleClickSearch || '').toLowerCase())).length === 0 && (
                          <div className="text-[10px] text-muted-foreground text-center py-2">
                            No columns found
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {!isViewOnly && isSingleSource && setDoubleClickParamKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    title={`Add ${param.label.toLowerCase()}`}
                    onClick={() => setDoubleClickParamKey(param.key)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex-1">
                <Popover
                  modal={false}
                  open={doubleClickParamKey === param.key}
                  onOpenChange={(open) => {
                    if (!open && setDoubleClickParamKey && setDoubleClickSearch) {
                      setDoubleClickParamKey(null);
                      setDoubleClickSearch('');
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <div
                      onDoubleClick={() => {
                        if (isSingleSource && !isViewOnly && setDoubleClickParamKey) {
                          setDoubleClickParamKey(param.key);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <DropZone
                        id={param.key}
                        placeholder={param.placeholder}
                        hasError={validationErrors?.has(param.key) || false}
                      >
                        {currentValue && (() => {
                          let fieldName: string = '';
                          let fieldType: string = 'string';

                          if (typeof currentValue === 'string') {
                            fieldName = currentValue;
                            fieldType = inferFieldType(currentValue);
                          } else if (currentValue && typeof currentValue === 'object') {
                            fieldName = currentValue.name || currentValue.columns || String(currentValue.name || currentValue.columns || '');
                            fieldType = currentValue.type || inferFieldType(fieldName);
                          } else {
                            fieldName = String(currentValue || '');
                            fieldType = inferFieldType(fieldName);
                          }

                          const aliasKey1 = `${param.key}_alias`;
                          const aliasKey2 = `${param.key}_0_alias`;
                          const aliasValue = formValues[aliasKey2] || formValues[aliasKey1] || '';
                          let displayName: string = fieldName;

                          if (aliasValue) {
                            if (typeof aliasValue === 'string' && aliasValue.trim() !== '') {
                              displayName = aliasValue;
                            } else if (typeof aliasValue === 'object' && aliasValue?.name) {
                              displayName = aliasValue.name;
                            }
                          }

                          return fieldName ? (
                            <FieldPill
                              field={{ name: String(fieldName), type: String(fieldType) }}
                              displayName={typeof displayName === 'string' ? displayName : String(displayName || fieldName)}
                              onRemove={() => onFormChange(param.key, null)}
                            />
                          ) : null;
                        })()}
                      </DropZone>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="z-[1200] w-60 p-2 max-h-[300px] overflow-hidden flex flex-col">
                    <div className="p-1 shrink-0">
                      <Input
                        value={doubleClickSearch || ''}
                        onChange={(e) => setDoubleClickSearch?.(e.target.value)}
                        placeholder="Search columns..."
                        className="h-7 text-xs"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 mt-1">
                      {fields
                        .filter((f) => f.name.toLowerCase().includes((doubleClickSearch || '').toLowerCase()))
                        .map((field) => (
                          <button
                            key={field.name}
                            type="button"
                            className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-sm truncate flex items-center gap-1.5"
                            onClick={() => {
                              if (typeof window !== 'undefined' && (window as any).__chartFormUpdate) {
                                (window as any).__chartFormUpdate(param.key, field);
                              }
                              setDoubleClickParamKey?.(null);
                              setDoubleClickSearch?.('');
                            }}
                          >
                            <FieldIcon type={field.type} name={field.name} />
                            <span className="truncate">{field.name}</span>
                          </button>
                        ))}
                      {fields.filter((f) => f.name.toLowerCase().includes((doubleClickSearch || '').toLowerCase())).length === 0 && (
                        <div className="text-[10px] text-muted-foreground text-center py-2">
                          No columns found
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {hasValue && popoverConfig && (
                <Popover
                  modal={false}
                  open={isPopoverOpen}
                  onOpenChange={(open) => {
                  if (open) {
                    setOpenPopoverKey?.(param.key);
                  } else {
                    // Outside click → CANCEL
                    if (pendingAddedKey === param.key) {
                      onFormChange(param.key, null);
                      // Clear all nested form values when canceling
                      if (popoverConfig?.SIMPLE) {
                        popoverConfig.SIMPLE.forEach((popoverParam) => {
                          const nestedKey = `${param.key}_${popoverParam.key}`;
                          onFormChange(nestedKey, null);
                        });
                      }
                      onResolvePending?.();
                    }
                    setOpenPopoverKey?.(null);
                  }
                }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        setOpenPopoverKey?.(isPopoverOpen ? null : param.key);
                      }}
                    >
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[1200] w-72 flex max-h-[min(85vh,480px)] flex-col overflow-hidden p-0" align="start">
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
                      {popoverConfig.SIMPLE?.map((popoverParam) => {
                        // For single fields, try both formats: metric_operation and metric_0_operation
                        // (because ChartFormulator stores as metric_0_operation for index 0)
                        const nestedKey1 = `${param.key}_${popoverParam.key}`;
                        const nestedKey2 = `${param.key}_0_${popoverParam.key}`;
                        // Prefer unindexed key first: Select writes `metric_operation`; API/edit hydrate `metric_0_operation`.
                        // If we read indexed first, stale COUNT hides the user's SUM on the unindexed key.
                        let nestedValue = formValues[nestedKey1] || formValues[nestedKey2];

                        if (popoverParam.key === 'columns') {
                          const currentFieldValue =
                            typeof currentValue === 'string' ? currentValue : (currentValue?.name || '');
                          const fromForm = formValues[nestedKey1] ?? formValues[nestedKey2];
                          if (fromForm !== undefined && fromForm !== null && fromForm !== '') {
                            nestedValue =
                              typeof fromForm === 'string'
                                ? fromForm
                                : (fromForm as { name?: string; columns?: string })?.name ||
                                (fromForm as { name?: string; columns?: string })?.columns ||
                                currentFieldValue;
                          } else {
                            nestedValue = currentFieldValue;
                          }
                        } else {
                          // For other fields (operation, alias, etc.), extract value if it's an object
                          if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                            nestedValue = nestedValue.value || nestedValue.name || nestedValue.columns || nestedValue;
                          }
                          // If still not set, use empty string
                          if (!nestedValue) {
                            nestedValue = '';
                          }
                        }

                        // Primary key for merged display: same preference as nestedValue (unindexed wins when set)
                        const nestedKey =
                          formValues[nestedKey1] !== undefined && formValues[nestedKey1] !== null && formValues[nestedKey1] !== ''
                            ? nestedKey1
                            : nestedKey2;

                        return (
                          <div key={popoverParam.key} className="space-y-2">
                            {renderParameterField(
                              popoverParam,
                              fields,
                              { ...formValues, [nestedKey]: nestedValue, [nestedKey1]: nestedValue, [nestedKey2]: nestedValue },
                              onFormChange,
                              onFieldDropped,
                              openPopoverKey,
                              setOpenPopoverKey,
                              param.key,
                              droppedFieldName,
                              parentParams, // Pass parent param to determine if multiple
                              pendingAddedKey,
                              onResolvePending,
                              filterValueOptions,
                              validationErrors,
                              searchQueries,
                              setSearchQueries
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (pendingAddedKey === param.key) {
                            onFormChange(param.key, null);
                            // Clear all nested form values when canceling
                            if (popoverConfig?.SIMPLE) {
                              popoverConfig.SIMPLE.forEach((popoverParam) => {
                                const nestedKey = `${param.key}_${popoverParam.key}`;
                                onFormChange(nestedKey, null);
                              });
                            }
                            onResolvePending?.();
                          }
                          setOpenPopoverKey?.(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          // Update the main drop zone value if columns dropdown was changed
                          if (popoverConfig?.SIMPLE) {
                            const columnsParam = popoverConfig.SIMPLE.find((p) => p.key === 'columns');
                            if (columnsParam) {
                              const columnsKey = `${param.key}_columns`;
                              const selectedColumn = formValues[columnsKey];

                              if (selectedColumn) {
                                // Update the main field value with the selected column
                                if (isMultiple) {
                                  // For multiple, update the last item or add new one
                                  const currentArray = Array.isArray(currentValue) ? currentValue : [];
                                  const lastIndex = currentArray.length - 1;
                                  if (lastIndex >= 0) {
                                    // Replace the last item
                                    const newArray = [...currentArray];
                                    newArray[lastIndex] = selectedColumn;
                                    onFormChange(param.key, newArray);
                                  } else {
                                    // Add new item
                                    onFormChange(param.key, [selectedColumn]);
                                  }
                                } else {
                                  // For single, replace the value
                                  onFormChange(param.key, selectedColumn);
                                }
                              }
                            }
                          }
                          setOpenPopoverKey?.(null);
                          if (pendingAddedKey === param.key) {
                            onResolvePending?.();
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'select': {
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      let selectValue: any = formValues[fieldKey] || formValues[param.key] || value || '';

      // Ensure selectValue is always a string (extract from object if needed)
      if (selectValue && typeof selectValue === 'object') {
        selectValue = selectValue.name || selectValue.columns || String(selectValue.name || selectValue.columns || '');
      }
      selectValue = String(selectValue || '');

      // If this is a columns dropdown in a popover, include the dropped column value
      let availableOptions: string[] = [];
      if (param.key === 'columns' && parentParamKey) {
        // Check if parentParamKey is an item-specific key (e.g., "dimensions_0") or param key (e.g., "dimensions")
        const isItemKey = parentParamKey.includes('_') && /_\d+$/.test(parentParamKey);
        let actualParamKey = parentParamKey;
        let itemIndex: number | null = null;

        if (isItemKey) {
          // Extract param key and index from item key (e.g., "dimensions_0" -> paramKey: "dimensions", index: 0)
          const parts = parentParamKey.split('_');
          itemIndex = parseInt(parts[parts.length - 1], 10);
          actualParamKey = parts.slice(0, -1).join('_');
        }

        // Get the dropped column from the parent field
        const parentValue = formValues[actualParamKey];
        let droppedColumn: string | null = null;

        if (itemIndex !== null && Array.isArray(parentValue) && parentValue[itemIndex]) {
          // For multi-drop, get the field from the specific index
          const item = parentValue[itemIndex];
          if (typeof item === 'string') {
            droppedColumn = item;
          } else if (item && typeof item === 'object') {
            droppedColumn = item.name || item.columns || null;
          }
        } else if (!Array.isArray(parentValue)) {
          // For single drop
          if (typeof parentValue === 'string') {
            droppedColumn = parentValue;
          } else if (parentValue && typeof parentValue === 'object') {
            droppedColumn = parentValue.name || parentValue.columns || null;
          }
        } else if (Array.isArray(parentValue) && parentValue.length > 0) {
          // Fallback: get the last item
          const lastItem = parentValue[parentValue.length - 1];
          if (typeof lastItem === 'string') {
            droppedColumn = lastItem;
          } else if (lastItem && typeof lastItem === 'object') {
            droppedColumn = lastItem.name || lastItem.columns || null;
          }
        }

        // Combine dropped column with all fields, ensuring dropped column is first
        const fieldNames = fields.map(f => f.name);
        if (droppedColumn && typeof droppedColumn === 'string' && !fieldNames.includes(droppedColumn)) {
          availableOptions = [droppedColumn, ...fieldNames];
        } else if (droppedColumn && typeof droppedColumn === 'string') {
          // If dropped column is already in fields, still put it first
          availableOptions = [droppedColumn, ...fieldNames.filter(f => f !== droppedColumn)];
        } else {
          availableOptions = fieldNames;
        }
      } else {
        // For other selects, use options or fields
        if (param.options && param.options.length > 0) {
          availableOptions = param.options.map((opt: any) => String(opt));
        } else {
          availableOptions = fields.map(f => f.name);
        }
      }

      if (param.key === 'columns') {
        return (
          <ColumnSelectWithSearch
            param={param}
            fieldKey={fieldKey}
            selectValue={selectValue}
            availableOptions={availableOptions}
            formValues={formValues}
            onFormChange={onFormChange}
            parentParamKey={parentParamKey}
            parentParams={parentParams}
            searchQueries={searchQueries}
            setSearchQueries={setSearchQueries}
          />
        );
      }

      const isLimitSelect = param.key === 'limit';
      const hasLimitValue = String(selectValue || '').trim() !== '';
      const selectRootValue = isLimitSelect
        ? hasLimitValue
          ? selectValue
          : undefined
        : selectValue || '';

      const heightClass =
        (param.key === 'time_grain' || param.key === 'timegrain') ||
          (String(param.label || '').toLowerCase().includes('time') &&
            String(param.label || '').toLowerCase().includes('grain'))
          ? '!h-7'
          : 'h-7';

      const selectContent = (
        <SelectContent className="z-[1200] max-h-[200px] w-full overflow-y-auto">
          {availableOptions.map((option, oi) => (
            <SelectItem key={`${fieldKey}_${String(option)}_${oi}`} value={option} className="text-sm py-1">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      );

      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{param.label}</Label>
          {isLimitSelect ? (
            <div className="flex w-full items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <Select
                  modal={false}
                  key={selectRootValue ?? 'limit-empty'}
                  value={selectRootValue}
                  onValueChange={(val) => {
                    onFormChange(fieldKey, val);
                  }}
                >
                  <SelectTrigger className={cn(`w-full ${heightClass} text-sm`)}>
                    <SelectValue placeholder={param.placeholder} />
                  </SelectTrigger>
                  {selectContent}
                </Select>
              </div>
              {hasLimitValue ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Clear limit"
                  className="h-8 w-8 shrink-0 border-destructive/60 text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onFormChange(fieldKey, null);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : (
            <Select
              modal={false}
              value={selectRootValue}
              onValueChange={(val) => {
                onFormChange(fieldKey, val);
              }}
            >
              <SelectTrigger className={cn(`w-full ${heightClass} text-sm`)}>
                <SelectValue placeholder={param.placeholder} />
              </SelectTrigger>
              {selectContent}
            </Select>
          )}
        </div>
      );
    }

    case 'text': {
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      const textValue = formValues[fieldKey] || formValues[param.key] || value || '';
      const isAliasField = String(param.key || '').toLowerCase().includes('alias');

      return (
        <div className="space-y-2">
          <Label className={cn(isAliasField ? 'text-sm font-medium' : 'text-xs font-medium')}>{param.label}</Label>
          <Input
            value={textValue || ''}
            onChange={(e) => onFormChange(fieldKey, e.target.value)}
            placeholder={param.placeholder}
            className={cn(isAliasField ? 'text-sm' : '')}
          />
        </div>
      );
    }

    case 'daterange': {
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      const dateValue = formValues[fieldKey] || formValues[param.key] || value;
      const formatDate = (date: Date | undefined) => {
        if (!date) return '';
        return date.toLocaleDateString();
      };

      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{param.label}</Label>
          <Popover modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateValue && 'text-muted-foreground'
                )}
              >
                {dateValue && dateValue.from && dateValue.to
                  ? `${formatDate(dateValue.from)} - ${formatDate(dateValue.to)}`
                  : param.placeholder}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[1200] w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateValue}
                onSelect={(range: any) => onFormChange(fieldKey, range)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      );
    }


    case "multi-select": {
      if (!parentParamKey) {
        return null;
      }
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      const multiValue = formValues[fieldKey] || formValues[param.key] || [];
      const currentArray = Array.isArray(multiValue) ? multiValue : [];

      let availableOptions: string[] = [];
      // Handle filter "values" dropdowns: param.key might be "value" or "values"
      if ((param.key === "value" || param.key === "values") && parentParams?.[0]?.key === "filters") {
        // Try to derive index from parentParamKey (e.g., "filters_0_values" or "filters_0")
        let columnName: string | null = null;
        const filtersArray = formValues["filters"];

        if (parentParamKey) {
          const m = parentParamKey.match(/filters[_-]?(\d+)/i);
          if (m && m[1] !== undefined) {
            const idx = Number(m[1]);
            if (Array.isArray(filtersArray) && filtersArray[idx]) {
              const filterItem = filtersArray[idx];
              columnName = typeof filterItem === "string" ? filterItem : filterItem?.name || null;
            }
          }
          // If explicit nested columns key exists (e.g., filters_0_columns), prefer it
          if (!columnName && formValues[`${parentParamKey}_columns`]) {
            const candidate = formValues[`${parentParamKey}_columns`];
            columnName = typeof candidate === 'string' ? candidate : candidate?.name || null;
          }
        }

        // Fallback: if filters array has exactly one item, use that
        if (!columnName && Array.isArray(filtersArray) && filtersArray.length === 1) {
          const only = filtersArray[0];
          columnName = typeof only === 'string' ? only : only?.name || null;
        }

        const normalized = columnName ? String(columnName).trim() : null;
        availableOptions =
          (normalized &&
            (filterValueOptions?.[normalized] ||
              filterValueOptions?.[normalized.toLowerCase?.()] ||
              filterValueOptions?.[normalized.toUpperCase?.()])) ||
          [];
      }

      const isFilterValueMulti =
        (param.key === 'value' || param.key === 'values') &&
        parentParams?.[0]?.key === 'filters';

      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{param.label}</Label>

          {isFilterValueMulti ? (
            <FilterValueSearchAndAdd
              fieldKey={fieldKey}
              placeholder={param.placeholder || 'Select value'}
              availableOptions={availableOptions}
              currentArray={currentArray.map((x) => String(x))}
              onFormChange={onFormChange}
              searchQueries={searchQueries}
              setSearchQueries={setSearchQueries}
            />
          ) : (
            <Select
              modal={false}
              value=""
              onValueChange={(val) => {
                onFormChange(fieldKey, [...currentArray, val]);
              }}
            >
              <SelectTrigger className="w-full !h-9 ">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="z-[1200] max-h-[200px] overflow-y-auto">
                {availableOptions.map((v, vi) => (
                  <SelectItem key={`${fieldKey}_${String(v)}_${vi}`} value={v} className="text-sm py-1">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {currentArray.length > 0 && (
            <div className="mt-2 max-h-[100px] overflow-y-auto space-y-1 border rounded-md p-2 bg-secondary/20">
              {currentArray.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-secondary px-2 py-0 rounded"
                >
                  <span className="truncate max-w-[180px]">{item}</span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 flex-shrink-0"
                    onClick={() =>
                      onFormChange(
                        fieldKey,
                        currentArray.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

        </div>
      );
    }

    default:
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      const defaultValue = formValues[fieldKey] || formValues[param.key] || value || '';

      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{param.label}</Label>
          <Input
            value={defaultValue || ''}
            onChange={(e) => onFormChange(fieldKey, e.target.value)}
            placeholder={param.placeholder}
          />
        </div>
      );
  }
};

export function DynamicChartForm({
  parameters,
  fields,
  formValues,
  onFormChange,
  onFieldDropped,
  droppedFieldParamKey,
  pendingAddedKey,
  onResolvePending,
  filterValueOptions,
  validationErrors,
  isViewOnly = false,
  isSingleSource: isSingleSourceProp,
}: DynamicChartFormProps) {
  const [openPopoverKey, setOpenPopoverKey] = React.useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = React.useState<Set<string>>(new Set());
  const { active, over } = useDndContext();
  const [searchQueries, setSearchQueries] = React.useState<Record<string, string>>({});
  const [doubleClickParamKey, setDoubleClickParamKey] = React.useState<string | null>(null);
  const [doubleClickSearch, setDoubleClickSearch] = React.useState('');

  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const upstreamNodes1 = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');
  const isSingleSource = isSingleSourceProp !== undefined 
    ? isSingleSourceProp 
    : (!upstreamNodes1 || upstreamNodes1.length <= 1);

  // Disable local DnD auto-commit; ChartFormulator centrally handles drops via __chartFormUpdate
  React.useEffect(() => {
    return;
  }, [active, over]);


  React.useEffect(() => {
    if (droppedFieldParamKey) {
      setOpenPopoverKey(droppedFieldParamKey);

      // Check if this is an item-specific key (e.g., "dimensions_0") or a param key (e.g., "dimensions")
      const isItemKey = droppedFieldParamKey.includes('_');
      let paramKey = droppedFieldParamKey;
      let itemIndex: number | null = null;

      if (isItemKey) {
        // Extract param key and index from item key (e.g., "dimensions_0" -> paramKey: "dimensions", index: 0)
        const parts = droppedFieldParamKey.split('_');
        itemIndex = parseInt(parts[parts.length - 1], 10);
        paramKey = parts.slice(0, -1).join('_');
      }

      // Auto-fill columns dropdown for the dropped field
      const param = parameters.find((p) => p.key === paramKey);
      if (param) {
        const droppedValue = formValues[paramKey];
        let droppedFieldName: string | null = null;

        if (itemIndex !== null && Array.isArray(droppedValue) && droppedValue[itemIndex]) {
          // For multi-drop, get the field from the specific index
          const item = droppedValue[itemIndex];
          droppedFieldName = typeof item === 'string' ? item : item?.name || null;
        } else if (!Array.isArray(droppedValue)) {
          // For single drop
          droppedFieldName = typeof droppedValue === 'string' ? droppedValue : droppedValue?.name || null;
        } else if (Array.isArray(droppedValue) && droppedValue.length > 0) {
          // Fallback: get the last item
          const lastItem = droppedValue[droppedValue.length - 1];
          droppedFieldName = typeof lastItem === 'string' ? lastItem : lastItem?.name || null;
        }

        if (droppedFieldName) {
          const popoverConfig = param.popover || param['popover-timerange'];
          if (popoverConfig?.SIMPLE) {
            popoverConfig.SIMPLE.forEach((popoverParam) => {
              if (popoverParam.key === 'columns') {
                const nestedKey = `${droppedFieldParamKey}_${popoverParam.key}`;
                const autoFillKey = nestedKey;

                // Only auto-fill if not already filled
                if (!autoFilledFields.has(autoFillKey) && !formValues[nestedKey]) {
                  onFormChange(nestedKey, droppedFieldName);
                  setAutoFilledFields((prev) => new Set(prev).add(autoFillKey));
                }
              }
            });
          }
        }
      }
    }
  }, [droppedFieldParamKey, parameters, formValues, onFormChange, autoFilledFields]);

  return (
    <div className="space-y-2">
      {parameters.map((param) => (
        <div key={param.key}>
          {renderParameterField(
            param,
            fields,
            formValues,
            onFormChange,
            onFieldDropped,
            openPopoverKey,
            setOpenPopoverKey,
            undefined,
            undefined,
            param.key === "filters" ? [param] : undefined,
            pendingAddedKey,
            onResolvePending,
            filterValueOptions,
            validationErrors,
            searchQueries,
            setSearchQueries,
            doubleClickParamKey,
            setDoubleClickParamKey,
            doubleClickSearch,
            setDoubleClickSearch,
            isSingleSource,
            isViewOnly,
          )}
        </div>
      ))}
    </div>
  );
}


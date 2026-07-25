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
import { X, Plus, ChevronDown, Settings2, Type, Hash, CalendarDays, Check, BarChart3, Sparkles, Filter, SlidersHorizontal } from 'lucide-react';
import type { ChartFormParameter } from '@/pages/Visualization/API/chartsApi';
import type { DynamicChartFormProps } from '@/pages/charts/components/DynamicChartForm';
import { FieldPill } from '@/pages/charts/components/ChartConfigurator';
import useFlowStore from '@/stores/flowStore';
import WizardColumnFieldPicker from './WizardColumnFieldPicker';

export type WizardDynamicChartFormProps = DynamicChartFormProps;

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

function resolveBindingParamKey(key: string): string | null {
  const base = key.replace(/_\d+$/, "");
  const lower = base.toLowerCase();
  if (lower === "x-axis" || lower === "xaxis" || lower === "x") return "x-axis";
  if (lower.includes("dimension")) return "dimensions";
  if (lower === "metric" || lower === "metrics" || lower === "mtric") return "metrics";
  return null;
}

function resolveParamFields(
  param: ChartFormParameter,
  allFields: Array<{ name: string; type: string }>,
  fieldsByParamKey?: Record<string, Array<{ name: string; type: string }>>,
  parentParamKey?: string,
): Array<{ name: string; type: string }> {
  if (!fieldsByParamKey) return allFields;

  const lookupKeys = [parentParamKey, param.key].filter(Boolean) as string[];
  for (const key of lookupKeys) {
    if (fieldsByParamKey[key]?.length) return fieldsByParamKey[key];
    const normalized = resolveBindingParamKey(key);
    if (normalized && fieldsByParamKey[normalized]?.length) return fieldsByParamKey[normalized];
  }

  return allFields;
}

function getBindingSectionMeta(paramKey: string, label: string) {
  const key = paramKey.toLowerCase();
  if (key.includes('dimension') || key === 'x-axis' || key === 'xaxis') {
    return {
      icon: BarChart3,
      iconClass: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
      hint: 'Categories that group your chart slices or bars',
    };
  }
  if (key === 'metric' || key === 'metrics' || key === 'mtric') {
    return {
      icon: Sparkles,
      iconClass: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
      hint: 'Numeric values to measure and aggregate',
    };
  }
  if (key.includes('filter')) {
    return {
      icon: Filter,
      iconClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      hint: 'Optional rules to narrow the dataset',
    };
  }
  if (key.includes('time') && key.includes('grain')) {
    return {
      icon: CalendarDays,
      iconClass: 'text-sky-600 dark:text-sky-400',
      hint: 'Roll up dates by day, week, month, or year',
    };
  }
  if (key.includes('limit') || key.includes('row')) {
    return {
      icon: SlidersHorizontal,
      iconClass: 'text-muted-foreground',
      hint: 'Control how many rows are returned',
    };
  }
  return {
    icon: BarChart3,
    iconClass: 'text-muted-foreground',
    hint: `Configure ${label.toLowerCase()}`,
  };
}

const wizardFieldBlockClass =
  "rounded-xl border border-border/60 bg-background p-3 shadow-sm space-y-2";
const popoverFieldBlockClass = "space-y-2";
const getFieldBlockClass = (parentParamKey?: string) =>
  parentParamKey ? popoverFieldBlockClass : wizardFieldBlockClass;
const wizardLabelClass = (hasError?: boolean) =>
  cn("text-xs font-bold uppercase tracking-tight text-foreground", hasError && "text-red-500");
const getPopoverFieldLabelClass = (paramKey?: string, hasError?: boolean) => {
  const isAliasField = String(paramKey || "").toLowerCase().includes("alias");
  return cn(isAliasField ? "text-sm font-medium" : "text-xs font-medium", hasError && "text-red-500");
};

const DropZone = ({
  id,
  children,
  placeholder,
  hasError = false,
  isEmpty = false,
}: {
  id: string;
  children: React.ReactNode;
  placeholder?: string;
  hasError?: boolean;
  isEmpty?: boolean;
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
        'min-h-[40px] w-full rounded-lg border border-dashed bg-muted/20 p-1.5 transition-all duration-200',
        hasError
          ? 'border-red-500/70 bg-red-50 dark:bg-red-950/20'
          : 'border-border/70',
        isOver && !hasError && 'border-primary bg-primary/[0.08] shadow-sm ring-2 ring-primary/20',
        isEmpty && !isOver && !hasError && 'animate-[pulse_2.5s_ease-in-out_infinite] border-primary/25 bg-primary/[0.02]',
        (!children || (Array.isArray(children) && children.length === 0)) && 'flex items-center',
        children && !hasError && 'cursor-pointer hover:border-primary/40 hover:bg-primary/[0.03]',
      )}
    >
      {children ? (
        <>
          {children}
          {Array.isArray(children) && children.length === 0 && (
            <span className="flex w-full items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border/80 bg-background">
                <Plus className="size-3" />
              </span>
              {fieldType && <FieldIcon type={fieldType} />}
              <span className="truncate">{placeholder || 'Drop or click to add'}</span>
            </span>
          )}
          {isOver && active && (
            <div className="mt-1 flex items-center gap-1 px-1 text-[10px] font-medium text-primary">
              <Plus className="size-3" />
              <span>Release to add field</span>
            </div>
          )}
        </>
      ) : (
        <span className="flex w-full items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border/80 bg-background">
            <Plus className="size-3" />
          </span>
          {fieldType && <FieldIcon type={fieldType} />}
          <span className="truncate">{placeholder || 'Drop or click to add'}</span>
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
    <div className={getFieldBlockClass(parentParamKey)}>
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
          className="w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-[min(320px,85vh)] overflow-hidden p-0 flex flex-col"
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
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-h-[min(320px,85vh)] p-0 overflow-hidden flex flex-col"
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
  fieldsByParamKey?: Record<string, Array<{ name: string; type: string }>>,
) => {
  const paramFields = resolveParamFields(param, fields, fieldsByParamKey, parentParamKey);
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
      const isPickerOpen = doubleClickParamKey === param.key;
      const openColumnPicker = () => {
        if (!isViewOnly && isSingleSource && setDoubleClickParamKey) {
          setDoubleClickParamKey(param.key);
        }
      };
      const closeColumnPicker = () => {
        setDoubleClickParamKey?.(null);
        setDoubleClickSearch?.('');
      };
      const handlePickerOpenChange = (nextOpen: boolean) => {
        if (isViewOnly) return;
        if (nextOpen) {
          openColumnPicker();
          return;
        }
        closeColumnPicker();
      };
      const handleSelectColumn = (field: { name: string; type: string }) => {
        if (isViewOnly) return;
        if (typeof window !== 'undefined' && (window as any).__chartFormUpdate) {
          (window as any).__chartFormUpdate(param.key, field);
        }
        closeColumnPicker();
      };

      const sectionMeta = getBindingSectionMeta(param.key, param.label);
      const SectionIcon = sectionMeta.icon;

      return (
        <div className={wizardFieldBlockClass}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/30 ring-1 ring-border/50', sectionMeta.iconClass)}>
                <SectionIcon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <Label className={wizardLabelClass(hasError)}>{param.label}</Label>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{sectionMeta.hint}</p>
              </div>
            </div>
            {isMultiple && Array.isArray(currentValue) && currentValue.length > 0 ? (
              <span className="shrink-0 rounded-full bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/50">
                {currentValue.length}
              </span>
            ) : null}
          </div>
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
                        isEmpty={!itemName || itemName.trim() === ''}
                      >
                        {/* Show field pill if item exists and it's not pending (or if pending, show it anyway in edit mode) */}
                        {itemName && typeof itemName === 'string' && itemName.trim() !== '' && (
                          <FieldPill
                            field={{ name: String(itemName), type: String(itemType) }}
                            displayName={typeof displayName === 'string' && displayName.trim() !== '' ? displayName : itemName}
                            disabled={isViewOnly}
                            onRemove={() => {
                              if (isViewOnly) return;
                              const newValue = currentValue.filter((_: any, i: number) => i !== idx);
                              onFormChange(param.key, newValue);
                            }}
                          />
                        )}
                      </DropZone>
                    </div>
                    {!isViewOnly && popoverConfig && itemName && (
                      <Popover open={isItemPopoverOpen} onOpenChange={(open) => {
                        if (open) {
                          if (isViewOnly) return;
                          setOpenPopoverKey?.(itemPopoverKey);
                        } else {
                          // Outside click → CANCEL (not save)
                          if (!isViewOnly && pendingAddedKey === itemPopoverKey) {
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
                        <PopoverContent className="w-72 flex max-h-[min(85vh,480px)] flex-col overflow-hidden p-0" align="start">
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
                                    setSearchQueries,
                                    undefined,
                                    undefined,
                                    undefined,
                                    undefined,
                                    isSingleSource,
                                    isViewOnly,
                                    fieldsByParamKey,
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
              {!isViewOnly && (
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <WizardColumnFieldPicker
                    paramLabel={param.label}
                    fields={paramFields}
                    open={isPickerOpen}
                    onOpenChange={handlePickerOpenChange}
                    search={doubleClickSearch || ''}
                    onSearchChange={(value) => setDoubleClickSearch?.(value)}
                    onSelectField={handleSelectColumn}
                  >
                    <div
                      className={cn("w-full", !isViewOnly && isSingleSource && "cursor-pointer")}
                      onClick={openColumnPicker}
                    >
                      <DropZone
                        id={param.key}
                        placeholder={`Drop or click to add ${param.label.toLowerCase()}`}
                        children={''}
                        hasError={validationErrors?.has(param.key) || false}
                        isEmpty
                      />
                    </div>
                  </WizardColumnFieldPicker>
                </div>
                {!isViewOnly && isSingleSource && setDoubleClickParamKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    title={`Add ${param.label.toLowerCase()}`}
                    onClick={openColumnPicker}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex-1">
                <WizardColumnFieldPicker
                  paramLabel={param.label}
                  fields={paramFields}
                  open={isPickerOpen}
                  onOpenChange={handlePickerOpenChange}
                  search={doubleClickSearch || ''}
                  onSearchChange={(value) => setDoubleClickSearch?.(value)}
                  onSelectField={handleSelectColumn}
                >
                  <div
                    className={cn("w-full", !isViewOnly && isSingleSource && "cursor-pointer")}
                    onClick={openColumnPicker}
                  >
                    <DropZone
                      id={param.key}
                      placeholder={param.placeholder}
                      hasError={validationErrors?.has(param.key) || false}
                      isEmpty={!currentValue}
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
                              disabled={isViewOnly}
                              onRemove={() => {
                                if (isViewOnly) return;
                                onFormChange(param.key, null);
                              }}
                            />
                          ) : null;
                        })()}
                      </DropZone>
                    </div>
                  </WizardColumnFieldPicker>
              </div>
              {hasValue && popoverConfig && !isViewOnly && (
                <Popover open={isPopoverOpen} onOpenChange={(open) => {
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
                  <PopoverContent className="w-72 flex max-h-[min(85vh,480px)] flex-col overflow-hidden p-0" align="start">
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
                              setSearchQueries,
                              undefined,
                              undefined,
                              undefined,
                              undefined,
                              isSingleSource,
                              isViewOnly,
                              fieldsByParamKey,
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
        const fieldNames = paramFields.map(f => f.name);
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
          availableOptions = paramFields.map(f => f.name);
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
        <SelectContent className="max-h-[200px] w-full overflow-y-auto">
          {availableOptions.map((option, oi) => (
            <SelectItem key={`${fieldKey}_${String(option)}_${oi}`} value={option} className="text-sm py-1">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      );

      if (parentParamKey) {
        return (
          <div className={popoverFieldBlockClass}>
            <Label className="text-sm font-medium">{param.label}</Label>
            {isLimitSelect ? (
              <div className="flex w-full items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <Select
                    key={selectRootValue ?? "limit-empty"}
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
                {hasLimitValue && !isViewOnly ? (
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

      const sectionMeta = getBindingSectionMeta(param.key, param.label);
      const SectionIcon = sectionMeta.icon;

      return (
        <div className={wizardFieldBlockClass}>
          <div className="flex items-start gap-2">
            <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/30 ring-1 ring-border/50', sectionMeta.iconClass)}>
              <SectionIcon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Label className={wizardLabelClass()}>{param.label}</Label>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{sectionMeta.hint}</p>
              </div>
          {isLimitSelect ? (
            <div className="flex w-full items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <Select
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
              {hasLimitValue && !isViewOnly ? (
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
          </div>
        </div>
      );
    }

    case 'text': {
      const fieldKey = parentParamKey ? `${parentParamKey}_${param.key}` : param.key;
      const textValue = formValues[fieldKey] || formValues[param.key] || value || '';
      const isAliasField = String(param.key || '').toLowerCase().includes('alias');

      return (
        <div className={getFieldBlockClass(parentParamKey)}>
          <Label
            className={
              parentParamKey
                ? getPopoverFieldLabelClass(param.key)
                : wizardLabelClass()
            }
          >
            {param.label}
          </Label>
          <Input
            value={textValue || ''}
            onChange={(e) => onFormChange(fieldKey, e.target.value)}
            placeholder={param.placeholder}
            className={cn(parentParamKey && isAliasField ? "text-sm" : "text-xs font-medium")}
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
        <div className={getFieldBlockClass(parentParamKey)}>
          <Label
            className={
              parentParamKey ? getPopoverFieldLabelClass(param.key) : wizardLabelClass()
            }
          >
            {param.label}
          </Label>
          <Popover>
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
            <PopoverContent className="w-auto p-0" align="start">
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
        <div className={popoverFieldBlockClass}>
          <Label className={getPopoverFieldLabelClass(param.key)}>{param.label}</Label>

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
              value=""
              onValueChange={(val) => {
                onFormChange(fieldKey, [...currentArray, val]);
              }}
            >
              <SelectTrigger className="w-full !h-9 ">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
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

                  {!isViewOnly ? (
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
                  ) : null}
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
        <div className={getFieldBlockClass(parentParamKey)}>
          <Label
            className={
              parentParamKey ? getPopoverFieldLabelClass(param.key) : wizardLabelClass()
            }
          >
            {param.label}
          </Label>
          <Input
            value={defaultValue || ''}
            onChange={(e) => onFormChange(fieldKey, e.target.value)}
            placeholder={param.placeholder}
            className="text-xs font-medium"
          />
        </div>
      );
  }
};

export function WizardDynamicChartForm({
  parameters,
  fields,
  fieldsByParamKey,
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
}: WizardDynamicChartFormProps) {
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
    <div className="space-y-3">
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
            fieldsByParamKey,
          )}
        </div>
      ))}
    </div>
  );
}


import * as React from 'react';
import { ChartFormulatorFormSkeleton } from '../ChartFormulator/ChartFormulatorSkeletons';
import {
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  Type,
  Hash,
  CalendarDays,
  Wand2,
  FunctionSquare,
  Save,
  Loader2,
  PieChart,
  BarChart,
  LineChart,
  AreaChart,
  Gauge,
  Table2,
  Donut,
  Funnel,
  ChartColumnStacked,
  GripVertical,
  Trash2,
  Search,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { RadiusPiePreview } from './ChartPreviewIcons';
import { ChartTypeThumbnail, hasChartTypeThumbnail } from './ChartTypeThumbnail';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PreserveScrollArea } from './PreserveScrollArea';
import type { ChartFormParameter } from '@/pages/Visualization/API/chartsApi';
import {DynamicChartForm, type DynamicChartFormProps} from './DynamicChartForm';
import { ChartCustomizePanel, defaultOptions, type ChartCustomizationOptions } from './charts/pie';
import { BarCustomizePanel } from './charts/bar';
import { LineCustomizePanel } from './charts/line';
import {
  BigNumberCustomizePanel,
  BigNumberStreamCustomizePanel,
  buildBigNumberMetricDescriptors,
  defaultOptions as bigNumberDefaultOptions,
  defaultStreamOptions as bigNumberStreamDefaultOptions,
} from './charts/bigNumber';
import { AreaCustomizePanel } from './charts/area';
import { GaugeCustomizePanel, defaultOptions as gaugeDefaultOptions } from './charts/gauge';
import { SunburstCustomizePanel, defaultOptions as sunburstDefaultOptions } from './charts/sunburst';
import { FunnelCustomizePanel, defaultOptions as funnelDefaultOptions } from './charts/funnel';
import { RadiusPieCustomizePanel } from './charts/variableRadiusPie';
import { isRadiusPieChart } from '../chartVizTypes';
import {
  TablePivotCustomizePanel,
} from './charts/pivot';
import { getUniqueValues, getAnalyticsStudioUniqueValues } from "@/pages/Visualization/API/chartsApi";
import { buildAnalyticsStudioUniqueValuesPayload } from '@/pages/analyticsstudio/analyticsStudioChartPayload';
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import { useLocation } from 'react-router';
import useFlowStore from '@/stores/flowStore';
import TableChartCustomization, { DEFAULT_TABLE_CHART_CONFIG } from './charts/Tablechartcustomization';
import { extractColumnName } from '../ChartFormulator/utils';

export type ChartType = { name: string; icon: React.ElementType; uniqueId?: string };
export type Field = { name: string; type: string };

/** Only merge keys that belong to the loaded chart form (prevents bar-chart x-axis / pivot rows, etc. from sticking when switching chart type in edit mode). */
function formValueKeyMatchesChartParams(key: string, params: ChartFormParameter[]): boolean {
  const keys = params.map((p) => p.key);
  if (keys.includes(key)) return true;
  return keys.some((pk) => key.startsWith(`${pk}_`));
}

export interface Config {
  x: Field | null;
  y: Field | null;
  operator: string | null;
  color: Field | null;
  column: Field | null;
  row: Field | null;
}

interface ChartConfiguratorProps {
  chart: ChartType;
  threadName: string;
  fields: Field[];
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
  onClear: () => void;
  onSave: () => void;
  /** When provided and footer is in "edit" mode, shown as secondary button to regenerate chart (create API) */
  onGenerateChart?: () => void;
  chartFormData?: any;
  isLoadingForm?: boolean;
  isLoadingChart?: boolean;
  initialFormValues?: Record<string, any>;
  flowId: string;
  analyticsStudioInit?: AnalyticsStudioChartInit;
  selectedSource?: string | null;
  customizationOptions?: ChartCustomizationOptions;
  onCustomizationChange?: (options: ChartCustomizationOptions) => void;
  isEditMode?: boolean;
  /** When set, overrides `isEditMode` for footer actions only (labels + secondary Create button). */
  footerEditMode?: boolean;
  isViewOnly?: boolean;
  /** Base-level drilldown columns (e.g. from saved chart). Shown in edit mode for reorder/delete */
  baseDrilldownColumns?: Array<{ column: string }>;
  /** Called when user reorders or removes base drilldown columns */
  onBaseDrilldownColumnsChange?: (columns: Array<{ column: string }>) => void;
  /** Optional: open drilldown column picker to add columns (e.g. from ChartFormulator dialog) */
  onOpenDrilldownColumnPicker?: () => void;
  sources?: any[];
  hideFooter?: boolean;
  hideDataTab?: boolean;
  hideCustomizeTab?: boolean;
  defaultTab?: 'data' | 'customize';
  onFormValuesChange?: (values: Record<string, any>) => void;
  /** Optional replacement for the default chart binding form (e.g. wizard-specific form). */
  chartFormComponent?: React.ComponentType<DynamicChartFormProps>;
  /** Limits column pickers per binding param when creating charts from dataset semantic mappings. */
  fieldsByParamKey?: Record<string, Field[]>;
  /** Wizard binding step uses tighter full-width layout. */
  layoutVariant?: 'default' | 'wizard';
  /** Override the panel header title (e.g. "Customization" in the wizard visualise step). */
  panelTitle?: string;
  /** Hide the top panel header row (wizard visualise customize panel). */
  hidePanelHeader?: boolean;
  /** Hide the secondary "Customize" section label when only the customize tab is shown. */
  hideCustomizeSectionLabel?: boolean;
  rawChartColumns?: string[];
}

const FieldIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'string':
      return <Type className="h-3 w-3 text-muted-foreground" />;
    case 'number':
      return <Hash className="h-3 w-3 text-muted-foreground" />;
    case 'date':
      return <CalendarDays className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Type className="h-3 w-3 text-muted-foreground" />;
  }
};

export const FieldPill = ({
  field,
  onRemove,
  displayName,
  disabled,
}: {
  field: Field;
  onRemove: () => void;
  displayName?: string | any;
  disabled?: boolean;
}) => {
  // Ensure we always render strings, not objects
  let fieldName: string = '';
  if (typeof field?.name === 'string') {
    fieldName = field.name;
  } else if (field?.name && typeof field.name === 'object') {
    fieldName = (field.name as any)?.name || (field.name as any)?.columns || String(field.name);
  } else {
    fieldName = String(field?.name || '');
  }

  const fieldType = typeof field?.type === 'string' ? field.type : 'string';

  let display: string = fieldName;
  if (typeof displayName === 'string') {
    display = displayName;
  } else if (displayName && typeof displayName === 'object') {
    display = displayName?.name || displayName?.columns || fieldName;
  } else if (displayName) {
    display = String(displayName);
  }

  return (
    <div className="flex h-full items-center justify-between gap-2 rounded-md border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-2.5 py-1.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <FieldIcon type={fieldType} />
        <span className="truncate text-xs font-semibold text-foreground">{display}</span>
      </div>
      {!disabled ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
};
const OperatorPill = ({
  operator,
  onRemove,
  disabled,
}: {
  operator: string;
  onRemove: () => void;
  disabled?: boolean;
}) => (
  <div className="flex h-full items-center justify-between gap-2 rounded-sm bg-secondary px-2 py-1">
    <div className="flex items-center gap-1">
      <FunctionSquare className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-secondary-foreground">
        {operator}
      </span>
    </div>
    {!disabled ? (
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    ) : null}
  </div>
);

const DropZone = ({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-8 w-full rounded-md border border-dashed border-input bg-background p-0.5 transition-colors',
        isOver && 'border-primary bg-primary/10'
      )}
    >
      {children}
    </div>
  );
};


export const ChartDiagramIcon = ({ type, className }: { type: string; className?: string }) => {
  if (hasChartTypeThumbnail(type)) {
    return (
      <ChartTypeThumbnail
        vizName={type}
        className={cn('object-contain shrink-0', className || 'h-5 w-5')}
      />
    );
  }

  const name = (type || '').toLowerCase();

  if (name.includes('radius') && name.includes('pie')) {
    return <RadiusPiePreview className={`${className || ''} h-5 w-5`} />;
  }
  if (name.includes('pie')) return <PieChart className={`${className || ''} h-5 w-5`} />;
  if (name.includes('donut')) return <Donut className={`${className || ''} h-5 w-5`} />;
  if (name.includes('sunburst')) return <Donut className={`${className || ''} h-5 w-5`} />;
  if (name.includes('funnel')) return <Funnel className={`${className || ''} h-5 w-5`} />;
  if (name.includes('big')) return <Type className={`${className || ''} h-5 w-5`} />;
  if (name.includes('stacked')) return <ChartColumnStacked className={`${className || ''} h-5 w-5`} />;
  if (name.includes('bar')) return <BarChart className={`${className || ''} h-5 w-5`} />;
  if (name.includes('column')) return <BarChart className={`${className || ''} h-5 w-5`} />;
  if (name.includes('line')) return <LineChart className={`${className || ''} h-5 w-5`} />;
  if (name.includes('area')) return <AreaChart className={`${className || ''} h-5 w-5`} />;
  if (name.includes('gauge')) return <Gauge className={`${className || ''} h-5 w-5`} />;
  if (name.includes('table') || (name.includes('pivot') && name.includes('table'))) {
    return <Table2 className={`${className || ''} h-5 w-5`} />;
  }

  return <PieChart className={`${className || ''} h-5 w-5`} />;
};



const getLabels = (chartName: string) => {
  switch (chartName) {
    case 'Pie Chart':
    case 'Radius Pie Chart':
    case 'Donut Chart':
    case 'Sunburst':
    case 'Gauge Chart':
    case 'Funnel Chart':
      return { x: 'Category', y: 'Value' };
    default:
      return { x: 'x-axis', y: 'y-axis' };
  }
};

/**
 * Builds the column list for the Table customization panel, matching the ALIASED
 * key names the backend actually produces (e.g. "ENTRY_DATE(COUNT)" for a COUNT
 * aggregation), not the raw source field names. Falls back to raw fields when no
 * dimensions/metrics are configured yet (e.g. before the user picks columns).
 */
function buildTableAvailableColumns(
  formValues: Record<string, any>,
  fields: Field[],
): { key: string; label: string }[] {
  const normalizeEntries = (val: any): any[] => {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  };

  const dimensions = normalizeEntries(
    formValues.dimensions ?? formValues.dimension ?? formValues.group_by,
  );
  const metrics = normalizeEntries(
    formValues.metrics ?? formValues.metric ?? formValues.mtric,
  );

  const columns: { key: string; label: string }[] = [];
  const seen = new Set<string>();

  const addColumn = (key: string, label?: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    columns.push({ key, label: label ?? key });
  };

  dimensions.forEach((d) => {
    const name = typeof d === 'string' ? d : d?.name;
    if (name) addColumn(name);
  });

  metrics.forEach((m) => {
    const name = typeof m === 'string' ? m : m?.name;
    const operation = typeof m === 'object' ? m?.operation : undefined;
    if (!name) return;
    if (operation) {
      const aliasKey = `${name}(${String(operation).toUpperCase()})`;
      addColumn(aliasKey, aliasKey);
    } else {
      addColumn(name);
    }
  });

  // Fallback: nothing configured yet, show raw source fields so the panel isn't empty.
  if (columns.length === 0) {
    fields.forEach((f) => addColumn(f.name));
  }

  return columns;
}
export function ChartConfigurator({
  chart,
  threadName,
  fields,
  config,
  setConfig,
  onClear,
  onSave,
  onGenerateChart,
  chartFormData,
  isLoadingForm = false,
  isLoadingChart = false,
  initialFormValues,
  flowId,
  analyticsStudioInit,
  selectedSource,
  customizationOptions,
  onCustomizationChange,
  isEditMode = false,
  footerEditMode,
  isViewOnly = false,
  baseDrilldownColumns = [],
  onBaseDrilldownColumnsChange,
  onOpenDrilldownColumnPicker,
  sources,
  hideFooter = false,
  hideDataTab = false,
  hideCustomizeTab = false,
  defaultTab = 'data',
  onFormValuesChange,
  chartFormComponent,
  fieldsByParamKey,
  layoutVariant = 'default',
  panelTitle,
  hidePanelHeader = false,
  hideCustomizeSectionLabel = false,
  rawChartColumns,
}: ChartConfiguratorProps) {
  const isWizardLayout = layoutVariant === 'wizard';
  const headerTitle = panelTitle ?? chart.name;
  const ChartFormComponent = chartFormComponent ?? DynamicChartForm;
  const showTabSwitcher = !hideDataTab && !hideCustomizeTab;
  const tableAvailableColumns = React.useMemo(
    () =>
      rawChartColumns?.length
        ? rawChartColumns.map((c) => ({ key: c, label: c }))
        : fields.map((f) => ({ key: f.name, label: f.name })),
    [rawChartColumns, fields],
  );
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  React.useEffect(() => {
    console.log('DIMENSIONS:', formValues.dimensions);
    console.log('METRICS:', formValues.metrics ?? formValues.metric ?? formValues.mtric);
    console.log('FULL formValues:', formValues);
  }, [formValues]);

  const [droppedFieldParamKey, setDroppedFieldParamKey] = React.useState<string | null>(null);
  // Track the most recently added item key (e.g., "dimensions_0" or "metric") to enable Save/Cancel behavior
  const [pendingAddedKey, setPendingAddedKey] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<Set<string>>(new Set());
  const [drilldownColumnsSearch, setDrilldownColumnsSearch] = React.useState('');
  const [addColumnSearch, setAddColumnSearch] = React.useState('');
  const [drilldownOpen, setDrilldownOpen] = React.useState(true);
  const location = useLocation();
  const pathname = location.pathname.toLowerCase();
  const isWorkflowPath = pathname.startsWith('/workflows');
  const footerIsUpdateMode = footerEditMode !== undefined ? footerEditMode : isEditMode;
  const storeFlowId = useFlowStore((s) => s.currentWorkflow?.flow_id);
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const upstreamNodes1 = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');
  const isSingleSource = (sources ? sources.length <= 1 : true) &&
    (upstreamNodes1 ? upstreamNodes1.length <= 1 : true);
  // Try multiple paths to get node_id - handle different node structures
  const nid = upstreamNodes1?.[0]?.data?.current_node_id ||
    upstreamNodes1?.[0]?.data?.node_id ||
    upstreamNodes1?.[0]?.data?.node?.node_id ||
    upstreamNodes1?.[0]?.data?.node?.current_node_id ||
    upstreamNodes1?.[0]?.id;
  const [localCustomizationOptions, setLocalCustomizationOptions] = React.useState<ChartCustomizationOptions>(
    customizationOptions || defaultOptions
  );

  const chartNameLower = String(chart.name || '').toLowerCase();
  const chartUniqueId = String((chart as { uniqueId?: string }).uniqueId || '').toLowerCase();
  const isGauge = chartNameLower.includes('gauge') || chartUniqueId === 'gauge_big';
  const isBigNumberStream =
    chartUniqueId === 'big_number_stream' ||
    chartNameLower.includes('big number stream') ||
    chartNameLower.includes('big_number_stream');
  const isBigNumber = !isBigNumberStream && chartNameLower.includes('big');
  const [headerMetricPickerOpen, setHeaderMetricPickerOpen] = React.useState(false);
  const [headerMetricSearch, setHeaderMetricSearch] = React.useState('');
  React.useEffect(() => {
    if (customizationOptions) {
      setLocalCustomizationOptions(customizationOptions as ChartCustomizationOptions);
    }
  }, [customizationOptions]);
  React.useEffect(() => {
    if (isGauge && !customizationOptions) {
      setLocalCustomizationOptions(gaugeDefaultOptions as unknown as ChartCustomizationOptions);
    }
  }, [isGauge, customizationOptions]);
  React.useEffect(() => {
    if (isBigNumberStream && !customizationOptions && !isEditMode) {
      const opts = bigNumberStreamDefaultOptions;
      setLocalCustomizationOptions(opts as unknown as ChartCustomizationOptions);
      onCustomizationChange?.(opts as unknown as ChartCustomizationOptions);
      if (typeof window !== 'undefined') {
        (window as any).__chartCustomizationOptions = opts;
      }
    }
  }, [isBigNumberStream, customizationOptions, onCustomizationChange, isEditMode]);

  React.useEffect(() => {
    if (isBigNumber && !customizationOptions && !isEditMode) {
      const opts = bigNumberDefaultOptions;
      setLocalCustomizationOptions(opts as unknown as ChartCustomizationOptions);
      onCustomizationChange?.(opts as unknown as ChartCustomizationOptions);
      if (typeof window !== 'undefined') {
        (window as any).__chartCustomizationOptions = opts;
      }
    }
  }, [isBigNumber, customizationOptions, onCustomizationChange, isEditMode]);

  const isPivotChart = chartNameLower.includes('pivot');
  const isTableChart = chartNameLower.includes('table') && !isPivotChart;

  /** Pivot customize: row + column + metric field names from the Data tab (plain names). */
  const pivotRowsAndColumnsFields = React.useMemo(() => {
    if (!isPivotChart) return [] as { key: string; label: string }[];
    const out: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    const push = (raw: unknown) => {
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const item of items) {
        const key = extractColumnName(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: key });
      }
    };
    push(formValues.rows);
    push(formValues.columns);
    push(formValues.metrics ?? formValues.metric ?? formValues.mtric);
    return out;
  }, [
    isPivotChart,
    formValues.rows,
    formValues.columns,
    formValues.metrics,
    formValues.metric,
    formValues.mtric,
  ]);

  React.useEffect(() => {
    if (isPivotChart && !customizationOptions) {
      const opts = DEFAULT_TABLE_CHART_CONFIG;
      setLocalCustomizationOptions(opts as unknown as ChartCustomizationOptions);
      onCustomizationChange?.(opts as unknown as ChartCustomizationOptions);
      if (typeof window !== 'undefined') {
        (window as any).__chartCustomizationOptions = opts;
      }
    }
  }, [isPivotChart, customizationOptions, onCustomizationChange]);

  React.useEffect(() => {
    if (isTableChart && !customizationOptions) {
      const opts = DEFAULT_TABLE_CHART_CONFIG;
      setLocalCustomizationOptions(opts as unknown as ChartCustomizationOptions);
      onCustomizationChange?.(opts as unknown as ChartCustomizationOptions);
      if (typeof window !== 'undefined') {
        (window as any).__chartCustomizationOptions = opts;
      }
    }
  }, [isTableChart, customizationOptions, onCustomizationChange]);

  // Filter out 'group_by' style parameters so UI never shows them
  const filteredParams = React.useMemo(() => {
    const params: ChartFormParameter[] = chartFormData?.parameters || [];
    const chartNameLower = String(chart.name || '').toLowerCase();
    const chartUniqueId = String((chart as { uniqueId?: string }).uniqueId || '').toLowerCase();
    const isBigNumberMulti =
      chartUniqueId === 'big_number_stream' ||
      chartNameLower.includes('big number stream') ||
      chartNameLower.includes('big_number_stream') ||
      (chartNameLower.includes('big') && !chartNameLower.includes('stream'));

    return params
      .filter((p) => {
        const key = (p.key || '').toLowerCase();
        const lbl = (p.label || '').toLowerCase();
        if (key === 'group_by') return false;
        if (lbl.includes('group by')) return false;
        return true;
      })
      .map((p) => {
        const key = (p.key || '').toLowerCase();
        if (
          isBigNumberMulti &&
          (key === 'metrics' || key === 'metric' || key === 'mtric') &&
          p.type === 'drag_and_drop_or_select_single'
        ) {
          return { ...p, type: 'drag_and_drop_or_select_multiple' as ChartFormParameter['type'] };
        }
        return p;
      });
  }, [chartFormData, chart]);

  const metricsParamKey = React.useMemo(() => {
    const found = filteredParams.find((p) => {
      const k = (p.key || '').toLowerCase();
      return k === 'metrics' || k === 'metric' || k === 'mtric';
    });
    return found?.key ?? null;
  }, [filteredParams]);

  const bigNumberMetricDescriptors = React.useMemo(() => {
    if (!isBigNumber || !metricsParamKey) return [];
    const metrics = formValues[metricsParamKey];
    if (!Array.isArray(metrics)) return [];
    return buildBigNumberMetricDescriptors(metrics);
  }, [isBigNumber, metricsParamKey, formValues]);

  const bigNumberMetricLabels = React.useMemo(
    () => bigNumberMetricDescriptors.map((descriptor) => descriptor.label),
    [bigNumberMetricDescriptors],
  );

  const handleHeaderAddMetric = React.useCallback(
    (field: Field) => {
      if (!metricsParamKey || typeof window === 'undefined') return;
      const updater = (window as any).__chartFormUpdate;
      if (typeof updater === 'function') {
        updater(metricsParamKey, field);
      }
      setHeaderMetricPickerOpen(false);
      setHeaderMetricSearch('');
    },
    [metricsParamKey],
  );

  const headerMetricPicker = (isBigNumber || isBigNumberStream) && metricsParamKey && !isViewOnly && (
    <Popover
      modal={false}
      open={headerMetricPickerOpen}
      onOpenChange={(open) => {
        setHeaderMetricPickerOpen(open);
        if (!open) setHeaderMetricSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Add metric"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[1200] w-60 p-2 max-h-[300px] overflow-hidden flex flex-col" align="end">
        <div className="p-1 shrink-0">
          <Input
            value={headerMetricSearch}
            onChange={(e) => setHeaderMetricSearch(e.target.value)}
            placeholder="Search columns..."
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 mt-1">
          {fields
            .filter((f) => f.name.toLowerCase().includes(headerMetricSearch.toLowerCase()))
            .map((field) => (
              <button
                key={field.name}
                type="button"
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-sm truncate flex items-center gap-1.5"
                onClick={() => handleHeaderAddMetric(field)}
              >
                {field.type === 'number' ? (
                  <Hash className="!h-3 !w-3 text-muted-foreground" />
                ) : field.type === 'date' ? (
                  <CalendarDays className="!h-3 !w-3 text-muted-foreground" />
                ) : (
                  <Type className="!h-3 !w-3 text-muted-foreground" />
                )}
                <span className="truncate">{field.name}</span>
              </button>
            ))}
          {fields.filter((f) => f.name.toLowerCase().includes(headerMetricSearch.toLowerCase())).length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center py-2">No columns found</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  /** Skip re-seeding when `initialFormValues` is a new reference but same JSON (avoids wiping user edits). Cleared on unmount so Strict Mode remount still seeds. */
  const lastInitialSeedFingerprintRef = React.useRef<string | null>(null);
  const lastReportedFormValuesRef = React.useRef<string>('');
  const initialFormValuesSig = JSON.stringify(initialFormValues ?? null);

  React.useEffect(() => {
    return () => {
      lastInitialSeedFingerprintRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (filteredParams && filteredParams.length) {
      const paramsSig = filteredParams.map((p) => p.key).join('|');
      const fingerprint = `${paramsSig}::${initialFormValuesSig}`;
      if (lastInitialSeedFingerprintRef.current === fingerprint) {
        return;
      }
      lastInitialSeedFingerprintRef.current = fingerprint;

      const initialValues: Record<string, any> = {};
      filteredParams.forEach((param: ChartFormParameter) => {
        if (param.type === 'drag_and_drop_or_select_multiple') {
          initialValues[param.key] = [];
        } else {
          initialValues[param.key] = null;
        }
      });

      // Merge with initial form values if provided (for edit mode). Skip keys not in this chart's
      // schema so switching visualization does not leave stale params (e.g. X-axis on pie).
      if (initialFormValues) {
        Object.keys(initialFormValues).forEach((key) => {
          if (!formValueKeyMatchesChartParams(key, filteredParams)) return;
          const value = initialFormValues[key];
          if (value !== null && value !== undefined) {
            const paramDef = filteredParams.find((p) => p.key === key);
            const keyLower = key.toLowerCase();
            const isMetricKey = keyLower === 'metrics' || keyLower === 'metric' || keyLower === 'mtric';
            // Always set arrays (metrics, dimensions, filters, etc.) regardless of initialValues[key]
            if (Array.isArray(value)) {
              initialValues[key] = value;
            } else if (
              paramDef?.type === 'drag_and_drop_or_select_multiple' ||
              (isMetricKey && filteredParams.some((p) => p.key === key && p.type === 'drag_and_drop_or_select_multiple'))
            ) {
              initialValues[key] = [value];
            } else {
              // For non-array values (like limit, source, metric_0_operation, etc.), always set them
              initialValues[key] = value;
            }
          }
        });
      }


      setFormValues(initialValues);
      const serializedInitialValues = JSON.stringify(initialValues);
      lastReportedFormValuesRef.current = serializedInitialValues;

      // Clear pending keys when initializing (especially in edit mode)
      setPendingAddedKey(null);
      setDroppedFieldParamKey(null);

      // Also update window.__chartFormValues to ensure it's in sync
      if (typeof window !== 'undefined') {
        (window as any).__chartFormValues = initialValues;
      }

      // Propagate seeded edit-mode values to the wizard parent so preview/transformation can run.
      if (
        onFormValuesChange &&
        !isViewOnly &&
        initialFormValues &&
        Object.keys(initialFormValues).length > 0
      ) {
        onFormValuesChange(initialValues);
      }
    }
  }, [filteredParams, initialFormValuesSig, initialFormValues, isViewOnly, onFormValuesChange]);

  const handleFormChange = React.useCallback((key: string, value: any) => {
    if (isViewOnly) return;
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, [isViewOnly]);
const [filterValueOptions, setFilterValueOptions] =
  React.useState<Record<string, string[]>>({});


  // Watch for changes to the filters array (contents), fetch unique values
  // for any column that we don't already have cached.
  const filtersSnapshot = JSON.stringify(formValues.filters || []);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  React.useEffect(() => {
    const filters = formValues?.filters;
    if (!filters || filters.length === 0) return;

    // Collect unique column names from the filters array and ensure they are strings
    const cols = Array.from(
      new Set(
        (Array.isArray(filters) ? filters : [])
          .map((it: any) => {
            if (typeof it === 'string') return it;
            if (it && typeof it.name === 'string') return it.name;
            return '';
          })
          .filter(Boolean)
          .map((c: string) => String(c).trim())
      )
    ) as string[];

    cols.forEach((rawColumnName) => {
      const columnName = String(rawColumnName).trim();
      if (!columnName) return;
      const keyLower = columnName.toLowerCase();
      // Skip if we already fetched this column (original or lowercase key)
      if (filterValueOptions[columnName] || filterValueOptions[keyLower]) return;

      (async () => {
        try {
          let res;
          if (analyticsStudioInit) {
            const payload = buildAnalyticsStudioUniqueValuesPayload(
              analyticsStudioInit,
              selectedSource ?? null,
              columnName,
            );
            if (!payload) return;
            res = await getAnalyticsStudioUniqueValues(payload);
          } else {
            const effectiveFlowId = isWorkflowPath ? (storeFlowId ?? flowId) : flowId;
            const payload = isWorkflowPath ? {
              flow_id: effectiveFlowId,
              node_id: effectiveFlowId + "_" + (nid || ""),
              unique_id: effectiveFlowId + "_" + (nid || ""),
              stmt_date: "",
              source: "",
              column: columnName,
            } : {
              flow_id: flowId,
              stmt_date: "",
              source: "",
              column: columnName,
            };
            res = await getUniqueValues(payload);
          }
          if (!mounted.current) return;
          if (res?.status) {
            const anyRes: any = res;
            const columnName = anyRes.column ?? anyRes.data?.column;
            const uniqueVals = anyRes.unique_values ?? anyRes.data?.unique_values ?? [];
            if (columnName) {
              setFilterValueOptions(prev => ({
                ...prev,
                [columnName]: uniqueVals,
                [String(columnName).toLowerCase()]: uniqueVals,
              }));
            }
          }
        } catch (err) {
          console.error("Failed to load filter values", err);
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersSnapshot, flowId, analyticsStudioInit, selectedSource]);


  // Expose validation error setter to parent component
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setValidationErrors = (errors: Set<string>) => {
        setValidationErrors(errors);
      };
      // Also expose form parameters for error messages
      if (filteredParams && filteredParams.length) {
        (window as any).__chartFormParams = filteredParams;
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__setValidationErrors;
        delete (window as any).__chartFormParams;
      }
    };
  }, [filteredParams]);

  // Expose form change handler and form values to parent component
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Define inferFieldType at the top of the effect before using it
      const inferFieldType = (columnName: string): 'string' | 'number' | 'date' => {
        const name = columnName.toLowerCase();
        const datePatterns = ['date', 'time', 'timestamp', 'created', 'updated', 'modified', 'start', 'end', 'birth', 'join', 'expire', 'valid', 'since', 'day', 'month', 'year', 'hour', 'minute', 'second'];
        const numberPatterns = ['count', 'sum', 'total', 'amount', 'price', 'cost', 'value', 'quantity', 'qty', 'num', 'number', 'id', 'score', 'rate', 'percent', 'percentage', 'ratio', 'avg', 'average', 'max', 'min', 'netwr', 'txn', 'txns', 'balance', 'revenue', 'profit', 'loss', 'income', 'expense', 'fee', 'charge', 'discount'];
        if (datePatterns.some(pattern => name.includes(pattern))) return 'date';
        if (numberPatterns.some(pattern => name.includes(pattern))) return 'number';
        return 'string';
      };

      (window as any).__chartFormUpdate = (paramKey: string, fieldInput: string | Field) => {
        if (isViewOnly) return;
        if (chartFormData?.parameters) {
          const param =
            filteredParams.find((p: ChartFormParameter) => p.key === paramKey) ||
            chartFormData.parameters.find((p: ChartFormParameter) => p.key === paramKey);
          if (param) {
            // Extract field name and type from input (can be string or Field object)
            let fieldName: string;
            let fieldType: string;

            if (typeof fieldInput === 'string') {
              fieldName = fieldInput;
              const field = fields.find((f: Field) => f.name === fieldName);
              fieldType = field?.type || inferFieldType(fieldName);
            } else {
              fieldName = fieldInput.name;
              fieldType = fieldInput.type;
            }

            // Create field object with type
            const fieldWithType = { name: fieldName, type: fieldType };

            const currentValue = formValues[paramKey];
            const isMultipleField = param.type === 'drag_and_drop_or_select_multiple';
            if (isMultipleField) {
              const arr = Array.isArray(currentValue)
                ? currentValue
                : currentValue
                  ? [currentValue]
                  : [];

              // Allow duplicates ONLY for filters
              const isFilter = paramKey === "filters";

              if (!isFilter) {
                const exists = arr.some((it: any) =>
                  (typeof it === "string" ? it : it?.name) === fieldName
                );
                if (exists) {
                  return; // block duplicates for dimensions/metrics etc.
                }
              }

              // Push duplicates normally for filters
              const newValue = [...arr, fieldWithType];
              handleFormChange(paramKey, newValue);

              const newIndex = arr.length;
              const itemPopoverKey = `${paramKey}_${newIndex}`;

              // Clear any existing nested form values for this new item to prevent stale data
              if (chartFormData?.parameters) {
                const param = chartFormData.parameters.find((p: ChartFormParameter) => p.key === paramKey);
                if (param?.popover?.SIMPLE) {
                  param.popover.SIMPLE.forEach((popoverParam: ChartFormParameter) => {
                    const nestedKey = `${itemPopoverKey}_${popoverParam.key}`;
                    handleFormChange(nestedKey, null);
                  });
                }
              }

              setDroppedFieldParamKey(itemPopoverKey);
              setPendingAddedKey(itemPopoverKey);
              // Clear validation errors for this param and any nested keys
              setValidationErrors(prev => {
                const newSet = new Set(prev);
                newSet.delete(paramKey);
                return newSet;
              });
            } else {
              // Clear any existing nested form values for this field to prevent stale data
              if (chartFormData?.parameters) {
                const param = chartFormData.parameters.find((p: ChartFormParameter) => p.key === paramKey);
                if (param?.popover?.SIMPLE) {
                  param.popover.SIMPLE.forEach((popoverParam: ChartFormParameter) => {
                    const nestedKey = `${paramKey}_${popoverParam.key}`;
                    handleFormChange(nestedKey, null);
                  });
                }
              }

              handleFormChange(paramKey, fieldWithType);
              // Clear validation errors for this single field and its nested popover keys
              setValidationErrors(prev => {
                const newSet = new Set(prev);
                newSet.delete(paramKey);
                // clear nested keys if any
                if (chartFormData?.parameters) {
                  const param = chartFormData.parameters.find((p: ChartFormParameter) => p.key === paramKey);
                  if (param?.popover?.SIMPLE) {
                    param.popover.SIMPLE.forEach((popoverParam: ChartFormParameter) => {
                      const nestedKey = `${paramKey}_${popoverParam.key}`;
                      newSet.delete(nestedKey);
                    });
                  }
                }
                return newSet;
              });
              setDroppedFieldParamKey(paramKey);
              // mark this single field as pending so Cancel can revert
              setPendingAddedKey(paramKey);
              // Do not clear pending here; wait for Save/Cancel
            }
          }
        }
      };
      // Expose form values for building payload
      (window as any).__chartFormValues = formValues;
      if (onFormValuesChange) {
        const serialized = JSON.stringify(formValues);
        if (lastReportedFormValuesRef.current !== serialized) {
          const hasInitialBinding =
            initialFormValues && Object.keys(initialFormValues).length > 0;
          const isEmptyBinding = Object.keys(formValues).length === 0;
          if (hasInitialBinding && isEmptyBinding) {
            return;
          }
          lastReportedFormValuesRef.current = serialized;
          onFormValuesChange(formValues);
        }
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__chartFormUpdate;
        delete (window as any).__chartFormValues;
      }
    };
  }, [chartFormData, formValues, fields, handleFormChange, setDroppedFieldParamKey, setPendingAddedKey, filteredParams, onFormValuesChange, isViewOnly]);

  const handleFieldDropped = (paramKey: string) => {
    if (isViewOnly) return;
    setDroppedFieldParamKey(paramKey);
    // Reset after a short delay to allow popover to open
    setTimeout(() => {
      setDroppedFieldParamKey(null);
    }, 100);
  };

  const handleCustomizationChange = React.useCallback((options: ChartCustomizationOptions) => {
    setLocalCustomizationOptions(options);
    onCustomizationChange?.(options);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: options }));
      (window as any).__chartCustomizationOptions = options;
    }
  }, [onCustomizationChange]);

  if (isLoadingForm) {
    return (
      <ScrollArea className="h-full">
        <ChartFormulatorFormSkeleton />
      </ScrollArea>
    );
  }

  // Handle customization changes and dispatch immediately for real-time updates
  // const handleCustomizationChange = React.useCallback((options: ChartCustomizationOptions) => {
  //   setLocalCustomizationOptions(options);
  //   onCustomizationChange?.(options);

  //   // Dispatch custom event immediately for real-time chart updates
  //   if (typeof window !== 'undefined') {
  //     window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: options }));
  //     // Also store in window for fallback access
  //     (window as any).__chartCustomizationOptions = options;
  //   }
  // }, [onCustomizationChange]);

  if (filteredParams && filteredParams.length) {
    return (
      <div className="flex h-full flex-col p-0">
        <Card
          className={cn(
            "flex flex-1 flex-col gap-0 overflow-hidden p-0",
            isWizardLayout
              ? "!border-0 !rounded-none !bg-transparent !py-0 !shadow-none"
              : "!rounded-none !border-none",
          )}
        >
          <CardHeader
            className={cn(
              "flex flex-shrink-0 flex-row items-center justify-between",
              isWizardLayout
                ? "border-0 bg-transparent px-0 pt-0 pb-2"
                : "px-4 py-1",
              hidePanelHeader && "hidden",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {panelTitle ? (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                    <Wand2 className="!h-4 !w-4 shrink-0 text-primary" />
                  </div>
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
                    <ChartDiagramIcon type={chart.name} className="!h-4 !w-4 shrink-0" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className={cn("truncate text-sm", isWizardLayout ? "font-bold" : "font-semibold")}>
                    {headerTitle}
                  </h3>
                  {isWizardLayout && !panelTitle ? (
                    <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                      Source · {threadName}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {headerMetricPicker}
              {!isWizardLayout ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClear}
              >
                <X className="h-5 w-5" />
              </Button>
              ) : null}
            </div>
          </CardHeader>
          {!isWizardLayout ? <Separator className="flex-shrink-0" /> : null}
          <Tabs defaultValue={hideDataTab ? 'customize' : defaultTab} className="flex flex-1 flex-col min-h-0">
            {showTabSwitcher ? (
            <div className="px-2 pt-2 flex-shrink-0">
              <TabsList className="w-full !h-8">
                <TabsTrigger value="data" className="flex-1 text-xs font-semibold !h-7">DATA</TabsTrigger>
                <TabsTrigger value="customize" className="flex-1 text-xs font-semibold !h-7">CUSTOMIZE</TabsTrigger>
              </TabsList>
            </div>
            ) : hideDataTab && !hideCustomizeSectionLabel ? (
            <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customize
            </div>
            ) : null}
            {!hideDataTab ? (
            <TabsContent value="data" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="flex-1 h-full">
                <CardContent className={cn("gap-0", isWizardLayout ? "px-0 py-0" : "p-2")}>
                  <div className={cn(isWizardLayout ? "w-full space-y-3" : "space-y-2")}>
                    {!isWizardLayout ? (
                    <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{threadName}</span>
                    </div>
                    <Separator />
                    </>
                    ) : null}
                    <ChartFormComponent
                      parameters={filteredParams}
                      fields={fields}
                      fieldsByParamKey={fieldsByParamKey}
                      formValues={formValues}
                      onFormChange={(key: string, value: any) => {
                        handleFormChange(key, value);
                        // Clear validation error for this field when it's filled
                        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                          setValidationErrors(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(key);
                            return newSet;
                          });
                        }
                      }}
                      onFieldDropped={handleFieldDropped}
                      droppedFieldParamKey={droppedFieldParamKey}
                      pendingAddedKey={pendingAddedKey}
                      onResolvePending={() => {
                        // Clear pending and dropped keys once Save/Cancel is handled in child
                        setPendingAddedKey(null);
                        setDroppedFieldParamKey(null);
                      }}
                      filterValueOptions={filterValueOptions}
                      validationErrors={validationErrors}
                      isViewOnly={isViewOnly}
                      isSingleSource={isSingleSource}
                    />
                    {/* Drilldown columns: show in edit mode or when base level has columns; allow reorder, delete, search */}
                    {onBaseDrilldownColumnsChange && (baseDrilldownColumns.length > 0 || isEditMode) && (
                      <div className="space-y-2 pt-2 border-t mt-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setDrilldownOpen((v) => !v)}
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                            aria-expanded={drilldownOpen}
                          >
                            {drilldownOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            <span>Drilldown columns</span>
                          </button>
                          <p className="text-[11px] text-muted-foreground">{baseDrilldownColumns.length} column{baseDrilldownColumns.length === 1 ? '' : 's'}</p>
                        </div>
                        {drilldownOpen && (
                          <>
                            <p className="text-[11px] text-muted-foreground">
                              Order of columns for drilldown. Use up/down to reorder, or remove to exclude.
                            </p>
                            {/* Search: filter displayed columns */}
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                              <Input
                                type="text"
                                placeholder="Search columns..."
                                value={drilldownColumnsSearch}
                                onChange={(e) => setDrilldownColumnsSearch(e.target.value)}
                                className="pl-8 h-8 text-xs"
                              />
                            </div>
                          </>
                        )}
                        {baseDrilldownColumns.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1.5 px-2 rounded bg-muted/30">
                            No drilldown columns. Arm Drilldown from the chart toolbar, then click a slice or point to add columns.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-1 rounded-md border bg-muted/20 p-1.5 max-h-[180px] overflow-y-auto">
                            {(() => {
                              const getColName = (item: { column?: string } | string) => typeof item === 'string' ? item : (item?.column ?? '');
                              const searchLower = drilldownColumnsSearch.trim().toLowerCase();
                              const withIndex = baseDrilldownColumns
                                .map((item, idx) => ({ item, idx }))
                                .filter(({ item: it }) => !searchLower || getColName(it).toLowerCase().includes(searchLower));
                              if (withIndex.length === 0) {
                                return (
                                  <p className="text-xs text-muted-foreground py-2 px-2 text-center">
                                    No columns match &quot;{drilldownColumnsSearch.trim()}&quot;
                                  </p>
                                );
                              }
                              return withIndex.map(({ item, idx }) => {
                                const colName = getColName(item);
                                if (!colName) return null;
                                return (
                                  <div
                                    key={`${colName}-${idx}`}
                                    className="flex items-center gap-1.5 rounded bg-background px-2 py-1.5 text-xs"
                                  >
                                    <div className="flex flex-col gap-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0"
                                        disabled={idx === 0 || isViewOnly}
                                        onClick={() => {
                                          if (idx <= 0 || isViewOnly) return;
                                          const next = [...baseDrilldownColumns];
                                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                          onBaseDrilldownColumnsChange(next);
                                        }}
                                      >
                                        <ChevronUp className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0"
                                        disabled={idx === baseDrilldownColumns.length - 1 || isViewOnly}
                                        onClick={() => {
                                          if (idx >= baseDrilldownColumns.length - 1 || isViewOnly) return;
                                          const next = [...baseDrilldownColumns];
                                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                          onBaseDrilldownColumnsChange(next);
                                        }}
                                      >
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <span className="flex-1 truncate font-medium">{colName}</span>
                                    {!isViewOnly && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                          const next = baseDrilldownColumns.filter((_, i) => i !== idx);
                                          onBaseDrilldownColumnsChange(next);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                        {!isViewOnly && fields.length > 0 && (
                          <DropdownMenu onOpenChange={(open) => !open && setAddColumnSearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                                Add column
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[200px] p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
                              <ScrollArea className="max-h-[220px]">
                                <div className="p-2 border-b bg-background/90 backdrop-blur sticky top-0 z-30">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      type="text"
                                      placeholder="Search all columns..."
                                      value={addColumnSearch}
                                      onChange={(e) => setAddColumnSearch(e.target.value)}
                                      className="pl-8 h-8 text-xs"
                                      onKeyDown={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                {(() => {
                                  const available = fields.filter((f) => !baseDrilldownColumns.some((c) => (typeof c === 'string' ? c : c.column) === f.name));
                                  const searchLower = addColumnSearch.trim().toLowerCase();
                                  const filtered = searchLower ? available.filter((f) => f.name.toLowerCase().includes(searchLower)) : available;
                                  if (filtered.length === 0) {
                                    return (
                                      <p className="text-xs text-muted-foreground py-4 px-3 text-center">
                                        {available.length === 0 ? 'All fields added' : `No columns match "${addColumnSearch.trim()}"`}
                                      </p>
                                    );
                                  }
                                  return filtered.map((field) => (
                                    <DropdownMenuItem
                                      key={field.name}
                                      onSelect={() => {
                                        const next = [...baseDrilldownColumns, { column: field.name }];
                                        onBaseDrilldownColumnsChange(next);
                                        setAddColumnSearch('');
                                      }}
                                      className="cursor-pointer"
                                    >
                                      {field.name}
                                    </DropdownMenuItem>
                                  ));
                                })()}
                              </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </ScrollArea>
            </TabsContent>
            ) : null}
            {!hideCustomizeTab ? (
            <TabsContent
              value="customize"
              className={cn("flex-1 min-h-0 bg-background", isWizardLayout ? "mt-0" : "mt-2")}
            >
              <PreserveScrollArea className="flex-1 h-full">
                <CardContent
                  className={cn("gap-0", isWizardLayout ? "px-0 py-2" : "p-2")}
                  data-wizard-customize={isWizardLayout ? "true" : undefined}
                >
                  {isPivotChart ? (
                    <TablePivotCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                        if (typeof window !== 'undefined') {
                          (window as any).__chartCustomizationOptions = opts;
                        }
                      }}
                      availableColumns={
                        pivotRowsAndColumnsFields.length > 0
                          ? pivotRowsAndColumnsFields
                          : tableAvailableColumns
                      }
                    />
                  ) : isTableChart ? (
                    <TableChartCustomization
                      value={(localCustomizationOptions as unknown) as any}
                      onChange={(opts) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                        if (typeof window !== 'undefined') {
                          (window as any).__chartCustomizationOptions = opts;
                        }
                      }}
                      availableColumns={tableAvailableColumns}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('bar') || String(chart.name || '').toLowerCase().includes('column') || String(chart.name || '').toLowerCase().includes('stacked') ? (
                    <BarCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('line') ? (
                    <LineCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('area') ? (
                    <AreaCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : isBigNumberStream ? (
                    <BigNumberStreamCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('big') || String(chart.name || '').toLowerCase().includes('big number') ? (
                    <BigNumberCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      metricLabels={bigNumberMetricLabels}
                      metricDescriptors={bigNumberMetricDescriptors}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('gauge') || chartUniqueId === 'gauge_big' ? (
                    <GaugeCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        // Keep existing handler behavior: update local state and notify parent
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('funnel') ? (
                    <FunnelCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : String(chart.name || '').toLowerCase().includes('sunburst') ? (
                    <SunburstCustomizePanel
                      options={(localCustomizationOptions as unknown) as any}
                      onOptionsChange={(opts: any) => {
                        // Keep existing handler behavior: update local state and notify parent
                        handleCustomizationChange((opts as unknown) as ChartCustomizationOptions);
                      }}
                    />
                  ) : isRadiusPieChart(chart.name) || isRadiusPieChart(chartUniqueId) ? (
                    <RadiusPieCustomizePanel
                      options={localCustomizationOptions}
                      onOptionsChange={handleCustomizationChange}
                      chartType={chart.name}
                    />
                  )
                  : (
                    <ChartCustomizePanel
                      options={localCustomizationOptions}
                      onOptionsChange={handleCustomizationChange}
                      chartType={chart.name}
                    />
                  )}
                </CardContent>
              </PreserveScrollArea>
            </TabsContent>
            ) : null}
          </Tabs>
          {!hideFooter ? (
          <CardFooter className="sticky bottom-0 z-10 border-t bg-background p-3 flex-shrink-0 flex flex-wrap gap-2">
            {footerIsUpdateMode && onGenerateChart && (
              <Button
                variant="outline"
                onClick={() => {
                  if (isViewOnly) return;
                  onGenerateChart();
                }}
                disabled={isViewOnly || isLoadingChart}
              >
                {isLoadingChart ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Create Chart
              </Button>
            )}
            <Button
              onClick={() => {
                if (isViewOnly) return;
                onSave();
              }}
              disabled={isViewOnly}
            >
              <Save className="mr-2 h-4 w-4" />
              {isLoadingChart
                ? (footerIsUpdateMode ? 'Updating...' : 'Creating...')
                : (footerIsUpdateMode ? 'Update Chart' : 'Create Chart')}
            </Button>
          </CardFooter>
          ) : null}
        </Card>
      </div>
    );
  }

  // Fallback to old form if no chartFormData
  const labels = getLabels(chart.name);

  const handleSelectField = (zone: keyof Config, field: Field | null) => {
    if (isViewOnly) return;
    setConfig((prev) => ({ ...prev!, [zone]: field }));
  };

  const handleSetOperator = (operator: string | null) => {
    setConfig((prev) => ({ ...prev!, operator }));
  };

  const renderConfigRow = (zone: keyof Config, label: string) => (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto justify-start px-1 py-0.5 text-sm text-muted-foreground"
          >
            {label}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {fields.map((field, fi) => (
            <DropdownMenuItem
              key={`${field.name}_${fi}`}
              onSelect={() => handleSelectField(zone, field)}
            >
              {field.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => handleSelectField(zone, null)}>
            Clear
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropZone id={zone}>
        {config[zone] && typeof config[zone] === 'object' && (
          <FieldPill
            field={config[zone] as Field}
            onRemove={() => handleSelectField(zone, null)}
            disabled={isViewOnly}
          />
        )}
      </DropZone>
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="flex h-full flex-col p-1">
        <Card className="flex flex-1 flex-col p-0 gap-0">
          <CardHeader className="flex flex-row items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <ChartDiagramIcon type={chart.name} className={`h-5 w-5`} />
              <h3 className="text-base font-semibold">{chart.name}</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClear}
              disabled={isViewOnly}
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="flex-1 p-2 gap-0">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-sm font-medium">
                <FileText className="h-4 w-4" />
                <span className="truncate">{threadName}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                {renderConfigRow('x', labels.x)}
                {renderConfigRow('y', labels.y)}
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="px-1 py-0.5 text-sm text-muted-foreground">
                    Operator
                  </span>
                  <DropZone id="operator">
                    {config.operator && (
                      <OperatorPill
                        operator={config.operator}
                        onRemove={() => handleSetOperator(null)}
                      />
                    )}
                  </DropZone>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  legends
                </p>
                {renderConfigRow('color', 'color')}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  facets
                </p>
                {renderConfigRow('column', 'column')}
                {renderConfigRow('row', 'row')}
              </div>
              <Separator />
              <div className="relative">
                <Input placeholder="formulate data" className="pr-8" />
                <Wand2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-3">
            <Button className="w-full" onClick={onSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Chart
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ScrollArea>
  );
}


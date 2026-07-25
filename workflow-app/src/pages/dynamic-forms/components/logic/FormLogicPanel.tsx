import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Play,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  FormApiHeader,
  FormApiLogicConfig,
  FormApiLogicStep,
  FormApiQueryParam,
  FormApiResponseMapping,
  FormBuilderField,
} from '../../types';
import {
  API_HTTP_METHODS,
  API_MAPPING_ACTIONS,
  ApiStepTestResult,
  applyPayloadFormatChange,
  buildMappingPreview,
  buildStepRequestUrl,
  createDefaultApiLogicStep,
  createDefaultResponseMapping,
  executeApiLogicStep,
  getPayloadFormatsForMethod,
  listMappableFields,
  methodBadgeClass,
  OPTION_MERGE_MODES,
  PAYLOAD_FORMATS,
  resolveEffectiveResponseKey,
  resolveMappingRaw,
  resolveOptionMergeMode,
  resolvePayloadFormat,
} from '../../lib/logic/form-logic.utils';
import type { FormOptionMergeMode } from '../../types';
import { fieldHasOptionList } from '../../lib/field/field.utils';
import {
  inferTableColumnsFromApiData,
  tableColumnsNeedApiDefaults,
} from '../../lib/table/form-table.utils';
import { TableColumnMappingRows } from '../fields/data-table/TableColumnMappingRows';

interface FormLogicPanelProps {
  apiLogic: FormApiLogicConfig;
  fields: FormBuilderField[];
  onChange: (config: FormApiLogicConfig) => void;
  onUpdateField: (fieldId: string, updates: Partial<FormBuilderField>) => void;
  onApply: () => Promise<void>;
  isApplying?: boolean;
  logicApplied?: boolean;
}

function SectionRow({
  label,
  hint,
  onAdd,
  addLabel = '+ add',
}: {
  label: string;
  hint?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        {hint && <span className="truncate text-[10px] text-gray-text-muted/80">{hint}</span>}
      </div>
      {onAdd && (
        <Button type="button" variant="ghost" size="sm" className="!h-6 px-2 text-[10px] text-primary" onClick={onAdd}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}

interface ApiLogicStepCardProps {
  step: FormApiLogicStep;
  index: number;
  total: number;
  mappableFields: FormBuilderField[];
  testResult?: ApiStepTestResult;
  isTesting: boolean;
  onUpdate: (updates: Partial<FormApiLogicStep>) => void;
  onUpdateField: (fieldId: string, updates: Partial<FormBuilderField>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onTest: () => void;
}

function ApiLogicStepCard({
  step,
  index,
  total,
  mappableFields,
  testResult,
  isTesting,
  onUpdate,
  onUpdateField,
  onRemove,
  onMove,
  onTest,
}: ApiLogicStepCardProps) {
  const updateHeader = (headerIndex: number, updates: Partial<FormApiHeader>) => {
    onUpdate({
      headers: step.headers.map((header, i) => (i === headerIndex ? { ...header, ...updates } : header)),
    });
  };

  const updateMapping = (mappingIndex: number, updates: Partial<FormApiResponseMapping>) => {
    onUpdate({
      mappings: step.mappings.map((mapping, i) => (i === mappingIndex ? { ...mapping, ...updates } : mapping)),
    });
  };

  const updateQueryParam = (paramIndex: number, updates: Partial<FormApiQueryParam>) => {
    onUpdate({
      queryParams: (step.queryParams ?? []).map((param, i) =>
        i === paramIndex ? { ...param, ...updates } : param,
      ),
    });
  };

  const payloadFormat = resolvePayloadFormat(step);
  const payloadFormatOptions = getPayloadFormatsForMethod(step.method);
  const queryParams = step.queryParams ?? [];
  const resolvedUrl = buildStepRequestUrl(step);
  const usesParamFields =
    payloadFormat === 'query_params' ||
    payloadFormat === 'form_urlencoded' ||
    payloadFormat === 'form_data';
  const usesRawBody =
    payloadFormat === 'json' || payloadFormat === 'text' || payloadFormat === 'xml';

  const mappingPreview = useMemo(() => {
    if (!testResult?.ok) return [];
    return buildMappingPreview(step.mappings, mappableFields, step, testResult);
  }, [testResult, step, mappableFields]);

  const autoFilledTableFieldsRef = useRef<Set<string>>(new Set());

  const applyTableColumnsFromApi = (
    fieldId: string,
    mapping: FormApiResponseMapping,
    options?: { force?: boolean; silent?: boolean },
  ): boolean => {
    if (!testResult?.ok) {
      if (!options?.silent) toast.error('Test the API first to load response keys');
      return false;
    }

    const field = mappableFields.find((item) => item.id === fieldId);
    if (!field || field.type !== 'data_table') return false;

    if (!options?.force && !tableColumnsNeedApiDefaults(field.tableColumns)) {
      return false;
    }

    const responseKey = resolveEffectiveResponseKey(mapping, field);
    const resolved = resolveMappingRaw(step, testResult, { ...mapping, responseKey });
    const inferred = inferTableColumnsFromApiData(resolved.raw);
    if (inferred.length === 0) {
      if (!options?.silent) toast.error('No column keys found in the API response at this path');
      return false;
    }

    onUpdateField(fieldId, {
      tableColumns: inferred,
      dataSource: 'api',
      apiSource: {
        stepId: step.id,
        responseKey: responseKey || 'data',
      },
    });
    autoFilledTableFieldsRef.current.add(fieldId);
    if (!options?.silent) {
      toast.success(`Filled ${inferred.length} columns from API — you can edit them`);
    }
    return true;
  };

  useEffect(() => {
    autoFilledTableFieldsRef.current.clear();
  }, [testResult]);

  useEffect(() => {
    if (!testResult?.ok) return;

    for (const mapping of step.mappings) {
      if (!mapping.fieldId) continue;
      const field = mappableFields.find((item) => item.id === mapping.fieldId);
      if (!field || field.type !== 'data_table') continue;
      if (!tableColumnsNeedApiDefaults(field.tableColumns)) continue;
      if (autoFilledTableFieldsRef.current.has(field.id)) continue;
      applyTableColumnsFromApi(field.id, mapping, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-fill defaults when API test succeeds
  }, [testResult, step.mappings, mappableFields]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-border bg-gray-elevated shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-border bg-gray-surface px-3 py-2">
        <Input
          value={step.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          className="h-7 max-w-[140px] border-none bg-transparent px-0 text-xs font-semibold shadow-none focus-visible:ring-0"
        />

        <Select value={step.method} onValueChange={(value) => {
          const method = value as FormApiLogicStep['method'];
          const defaultFormat = method === 'GET' ? 'none' : method === 'POST' ? 'json' : 'none';
          const nextPayload = applyPayloadFormatChange(defaultFormat, step.queryParams, step.requestBody);
          onUpdate({
            method,
            payloadFormat: defaultFormat,
            queryParams: nextPayload.queryParams,
            requestBody: nextPayload.requestBody,
          });
        }}>
          <SelectTrigger className={cn('!h-7 w-[84px] border-none px-2 text-[11px] font-semibold shadow-none', methodBadgeClass(step.method))}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {API_HTTP_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={step.url}
          onChange={(event) => onUpdate({ url: event.target.value })}
          placeholder="https://api.example.com/path"
          className="h-7 min-w-0 flex-1 font-mono text-xs"
        />

        <Button type="button" size="sm" className="!h-7 shrink-0 gap-1 px-2 text-[10px]" onClick={onTest} disabled={isTesting}>
          {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Test
        </Button>

        <div className="flex shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => onMove('up')}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index >= total - 1} onClick={() => onMove('down')}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-gray-text-muted hover:text-destructive" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 py-2 px-4">
        <section className="space-y-2">
          <SectionRow
            label="Headers"
            onAdd={() => onUpdate({ headers: [...step.headers, { key: '', value: '' }] })}
          />
          <div className="space-y-1.5">
            {step.headers.map((header, headerIndex) => (
              <div key={`${step.id}-header-${headerIndex}`} className="flex items-center gap-1.5">
                <Input
                  value={header.key}
                  onChange={(event) => updateHeader(headerIndex, { key: event.target.value })}
                  placeholder="Header name"
                  className="!h-8 flex-1 !text-xs"
                />
                <Input
                  value={header.value}
                  onChange={(event) => updateHeader(headerIndex, { value: event.target.value })}
                  placeholder="Value"
                  className="!h-8 flex-[1.2] !text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="!h-8 w-8 shrink-0 hover:text-destructive"
                  onClick={() =>
                    onUpdate({ headers: step.headers.filter((_, i) => i !== headerIndex) })
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionRow label="Payload" hint="(how data is sent with the request)" />
          <div className="space-y-2 rounded-md border border-gray-border p-2.5">
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Payload format</p>
              <Select
                value={payloadFormat}
                onValueChange={(value) => {
                  const nextFormat = value as FormApiLogicStep['payloadFormat'];
                  const nextPayload = applyPayloadFormatChange(
                    nextFormat,
                    step.queryParams,
                    step.requestBody,
                  );
                  onUpdate({
                    payloadFormat: nextFormat,
                    queryParams: nextPayload.queryParams,
                    requestBody: nextPayload.requestBody,
                  });
                }}
              >
                <SelectTrigger className="!h-8 !text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {payloadFormatOptions.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] leading-snug text-gray-text-muted">
                {PAYLOAD_FORMATS.find((format) => format.value === payloadFormat)?.hint}
              </p>
            </div>

            {usesParamFields && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">
                    {payloadFormat === 'query_params' ? 'Query params' : 'Form fields'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="!h-6 px-2 text-[10px] text-primary"
                    onClick={() =>
                      onUpdate({ queryParams: [...queryParams, { key: '', value: '' }] })
                    }
                  >
                    + Add field
                  </Button>
                </div>
                {queryParams.map((param, paramIndex) => (
                  <div key={`${step.id}-param-${paramIndex}`} className="flex items-center gap-1.5">
                    <Input
                      value={param.key}
                      onChange={(event) => updateQueryParam(paramIndex, { key: event.target.value })}
                      placeholder="Key"
                      className="!h-8 flex-1 !text-xs"
                    />
                    <Input
                      value={param.value}
                      onChange={(event) => updateQueryParam(paramIndex, { value: event.target.value })}
                      placeholder="Value"
                      className="!h-8 flex-[1.2] !text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="!h-8 w-8 shrink-0 hover:text-destructive"
                      onClick={() =>
                        onUpdate({ queryParams: queryParams.filter((_, i) => i !== paramIndex) })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {usesRawBody && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">
                  {payloadFormat === 'json' ? 'JSON payload' : payloadFormat === 'xml' ? 'XML payload' : 'Text payload'}
                </p>
                <Textarea
                  value={step.requestBody ?? ''}
                  onChange={(event) => onUpdate({ requestBody: event.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder={
                    payloadFormat === 'json'
                      ? '{\n  "id": "123"\n}'
                      : payloadFormat === 'xml'
                        ? '<request><id>123</id></request>'
                        : 'Plain text payload'
                  }
                />
              </div>
            )}


          </div>
        </section>

        <section className="space-y-2">
          <SectionRow
            label="Response mapping"
            onAdd={() => {
              const defaultFieldId = mappableFields[0]?.id ?? '';
              onUpdate({ mappings: [...step.mappings, createDefaultResponseMapping(defaultFieldId)] });
            }}
          />
          {mappableFields.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-border px-3 py-2 text-[11px] text-gray-text-muted">
              Add fields on the Design tab before mapping API response keys.
            </p>
          ) : (
            <div className="space-y-1.5">
              {step.mappings.map((mapping, mappingIndex) => {
                const mappedField = mappableFields.find((field) => field.id === mapping.fieldId);
                const availableActions = API_MAPPING_ACTIONS.filter((action) => {
                  if (action.value !== 'set_options') return true;
                  return mappedField ? fieldHasOptionList(mappedField.type) : true;
                });

                return (
                <div key={mapping.id} className="space-y-1.5 rounded-md border border-gray-border/60 p-2">
                  <div
                    className={cn(
                      'grid items-center gap-1.5',
                      mapping.action === 'set_options'
                        ? 'grid-cols-[minmax(0,1fr)_108px_132px_minmax(0,1fr)_auto]'
                        : 'grid-cols-[minmax(0,1fr)_108px_minmax(0,1fr)_auto]',
                    )}
                  >
                    <Input
                      value={mapping.responseKey}
                      onChange={(event) => updateMapping(mappingIndex, { responseKey: event.target.value })}
                      placeholder={
                        mappedField?.type === 'data_table'
                          ? 'data (row array path)'
                          : mappedField && fieldHasOptionList(mappedField.type)
                            ? 'e.g. data or deployment_name'
                            : 'e.g. data.status'
                      }
                      className="!h-7 !text-xs"
                    />
                    <Select
                      value={mapping.action}
                      onValueChange={(value) =>
                        updateMapping(mappingIndex, { action: value as FormApiResponseMapping['action'] })
                      }
                    >
                      <SelectTrigger className="!h-7 !text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableActions.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            {action.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping.action === 'set_options' && (
                      <Select
                        value={
                          mapping.optionMergeMode ??
                          (mappedField ? resolveOptionMergeMode(mappedField) : 'replace')
                        }
                        onValueChange={(value) =>
                          updateMapping(mappingIndex, {
                            optionMergeMode: value as FormOptionMergeMode,
                          })
                        }
                      >
                        <SelectTrigger className="!h-7 !text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPTION_MERGE_MODES.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select
                      value={mapping.fieldId}
                      onValueChange={(value) => {
                        const nextField = mappableFields.find((field) => field.id === value);
                        const updates: Partial<FormApiResponseMapping> = { fieldId: value };
                        if (nextField?.type === 'data_table' && !mapping.responseKey.trim()) {
                          updates.responseKey = 'data';
                        }
                        updateMapping(mappingIndex, updates);
                        if (nextField?.type === 'data_table') {
                          onUpdateField(value, {
                            dataSource: 'api',
                            apiSource: {
                              stepId: step.id,
                              responseKey: (updates.responseKey ?? mapping.responseKey.trim()) || 'data',
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="!h-7 !text-xs">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappableFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-text-muted hover:text-destructive"
                      onClick={() =>
                        onUpdate({ mappings: step.mappings.filter((_, i) => i !== mappingIndex) })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {(mapping.action === 'set_options' ||
                    (mappedField && fieldHasOptionList(mappedField.type))) && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-text-muted">
                        Pick any JSON field for value/label — id is not required.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={mapping.optionValueKey ?? ''}
                          onChange={(event) =>
                            updateMapping(mappingIndex, { optionValueKey: event.target.value })
                          }
                          placeholder="Value key (e.g. deployment_name)"
                          className="!h-7 !text-xs"
                        />
                        <Input
                          value={mapping.optionLabelKey ?? ''}
                          onChange={(event) =>
                            updateMapping(mappingIndex, { optionLabelKey: event.target.value })
                          }
                          placeholder="Label key (e.g. name)"
                          className="!h-7 !text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {mappedField?.type === 'data_table' && (
                    <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium text-gray-text">
                            Column → JSON key mapping
                          </p>
                          <p className="text-[10px] text-gray-text-muted">
                            Defaults fill from the API after Test. Edit any header or key afterward.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="!h-7 gap-1 px-2 text-[10px]"
                          disabled={!testResult?.ok}
                          onClick={() =>
                            applyTableColumnsFromApi(mapping.fieldId, mapping, { force: true })
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          Fill from API
                        </Button>
                      </div>
                      <TableColumnMappingRows
                        compact
                        columns={mappedField.tableColumns ?? []}
                        onChange={(tableColumns) =>
                          onUpdateField(mapping.fieldId, {
                            tableColumns,
                            dataSource: 'api',
                            apiSource: {
                              stepId: step.id,
                              responseKey: mapping.responseKey.trim() || 'data',
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )})}
              {step.mappings.length === 0 && (
                <p className="text-[11px] text-gray-text-muted">Map response keys to form fields.</p>
              )}
            </div>
          )}
        </section>



        {testResult && (
          <section className="space-y-2 rounded-md border border-gray-border bg-gray-surface/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider">Response preview</p>
              <Badge variant={testResult.source === 'live' ? 'default' : 'secondary'} className="h-5 text-[9px]">
                {testResult.source === 'live' ? 'Live API' : 'Sample fallback'}
              </Badge>
              {testResult.error && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">{testResult.error}</span>
              )}
            </div>

            <pre className="max-h-40 overflow-auto rounded-md border border-gray-border bg-gray-elevated p-2 font-mono text-[10px] text-gray-text">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>

            {mappingPreview.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider">Mapped values</p>
                {mappingPreview.map((row) => (
                  <div
                    key={`${row.responseKey}-${row.fieldLabel}`}
                    className="grid grid-cols-[1fr_auto_1fr] gap-2 rounded-md border border-gray-border/70 bg-gray-elevated px-2 py-1.5 text-[10px]"
                  >
                    <span className="truncate font-mono text-primary">{row.responseKey}</span>
                    <span className="text-gray-text-muted">→ {row.fieldLabel}</span>
                    <span
                      className={cn(
                        'truncate text-right font-medium',
                        row.missing ? 'text-amber-600 dark:text-amber-400' : 'text-gray-text',
                      )}
                    >
                      {row.resolvedValue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function FormLogicPanel({
  apiLogic,
  fields,
  onChange,
  onUpdateField,
  onApply,
  isApplying = false,
  logicApplied = false,
}: FormLogicPanelProps) {
  const [testingStepId, setTestingStepId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ApiStepTestResult>>({});

  const mappableFields = useMemo(() => listMappableFields(fields), [fields]);
  const dateFields = useMemo(() => fields.filter((field) => field.type === 'date'), [fields]);
  const steps = apiLogic.steps.length > 0 ? apiLogic.steps : [createDefaultApiLogicStep()];

  const updateSteps = (nextSteps: FormApiLogicStep[]) => {
    onChange({ steps: nextSteps });
  };

  const updateStep = (stepId: string, updates: Partial<FormApiLogicStep>) => {
    updateSteps(steps.map((step) => (step.id === stepId ? { ...step, ...updates } : step)));
  };

  const addStep = () => {
    updateSteps([...steps, createDefaultApiLogicStep(`Step ${steps.length + 1}`)]);
  };

  const removeStep = (stepId: string) => {
    if (steps.length === 1) {
      toast.error('At least one API step is required');
      return;
    }
    updateSteps(steps.filter((step) => step.id !== stepId));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= steps.length) return;
    const next = [...steps];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    updateSteps(next);
  };

  const testStep = async (step: FormApiLogicStep) => {
    if (!step.url.trim()) {
      toast.error('Enter an API URL before testing');
      return;
    }
    setTestingStepId(step.id);
    try {
      const result = await executeApiLogicStep(step);
      setTestResults((prev) => ({ ...prev, [step.id]: result }));
      if (result.ok) {
        toast.success(result.source === 'live' ? 'API responded successfully' : 'Using sample response fallback');
      } else {
        toast.error(result.error ?? 'Failed to load response');
      }
    } finally {
      setTestingStepId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-border bg-gray-elevated px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-text">API & conditional logic</p>
            <p className="mt-0.5 text-[11px] text-gray-text-muted">
              Configure GET/POST APIs, map response keys to field values or option lists, then apply to preview.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {logicApplied && (
              <Badge variant="secondary" className="h-6 gap-1 text-[10px]">
                <Check className="h-3 w-3" />
                Applied
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              className="!h-7 gap-1.5"
              disabled={isApplying || mappableFields.length === 0}
              onClick={() => void onApply()}
            >
              {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Apply logic
            </Button>
          </div>
        </div>
      </div>

      {dateFields.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <p className="text-xs font-semibold text-gray-text">Date picker fields</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-text-muted">
            Map API responses on this tab, then open the <strong className="font-medium text-gray-text">Integration</strong>{' '}
            tab for date picker JSON examples and field keys.
          </p>
        </div>
      )}

      {steps.map((step, index) => (
        <ApiLogicStepCard
          key={step.id}
          step={step}
          index={index}
          total={steps.length}
          mappableFields={mappableFields}
          testResult={testResults[step.id]}
          isTesting={testingStepId === step.id}
          onUpdate={(updates) => updateStep(step.id, updates)}
          onUpdateField={onUpdateField}
          onRemove={() => removeStep(step.id)}
          onMove={(direction) => moveStep(step.id, direction)}
          onTest={() => testStep(step)}
        />
      ))}

      <Button type="button" variant="outline" className="h-9 w-full border-dashed text-xs" onClick={addStep}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add step
      </Button>
    </div>
  );
}

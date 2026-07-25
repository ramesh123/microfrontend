import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  FormApiLogicStep,
  FormBuilderField,
  FormFieldApiSourceConfig,
  FormFieldDataSource,
} from '../../types';
import { fieldHasOptionList } from '../../lib/field/field.utils';

interface FieldDataSourceEditorProps {
  field: FormBuilderField;
  apiSteps: FormApiLogicStep[];
  onChange: (updates: Partial<FormBuilderField>) => void;
}

const DATA_SOURCE_OPTIONS: { value: FormFieldDataSource; label: string; description: string }[] = [
  { value: 'static', label: 'Hardcoded only', description: 'Use only manual options from the Options section.' },
  {
    value: 'api',
    label: 'API only',
    description: 'Replace manual options with the API list when logic is applied.',
  },
  {
    value: 'static_and_api',
    label: 'Hardcoded + API',
    description: 'Keep manual options and add API options together when logic is applied.',
  },
];

export function FieldDataSourceEditor({ field, apiSteps, onChange }: FieldDataSourceEditorProps) {
  const dataSource = field.dataSource ?? 'static';
  const apiSource = field.apiSource ?? {};
  const hasOptionList = fieldHasOptionList(field.type);
  const steps = apiSteps.length > 0 ? apiSteps : [];
  const usesApiConfig = dataSource === 'api' || dataSource === 'static_and_api';

  const updateApiSource = (updates: Partial<FormFieldApiSourceConfig>) => {
    onChange({
      apiSource: { ...apiSource, ...updates },
    });
  };

  const handleDataSourceChange = (value: FormFieldDataSource) => {
    onChange({
      dataSource: value,
      apiSource: value === 'api' || value === 'static_and_api' ? apiSource : undefined,
      staticOptions: field.staticOptions ?? field.options,
    });
  };

  const optionSourceChoices = hasOptionList
    ? DATA_SOURCE_OPTIONS
    : DATA_SOURCE_OPTIONS.filter((option) => option.value !== 'static_and_api');

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wider">Data source</Label>
        <Select value={dataSource} onValueChange={(value) => handleDataSourceChange(value as FormFieldDataSource)}>
          <SelectTrigger className="!h-8 !text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {optionSourceChoices.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] leading-snug text-gray-text-muted">
          {DATA_SOURCE_OPTIONS.find((option) => option.value === dataSource)?.description}
        </p>
      </div>

      {dataSource === 'static' && !hasOptionList && field.type !== 'data_table' && field.type !== 'big_number' && (
        <div className="space-y-1">
          <Label htmlFor="field-default-value" className="text-[11px]">
            Default value
          </Label>
          <Input
            id="field-default-value"
            value={field.defaultValue ?? ''}
            onChange={(event) => onChange({ defaultValue: event.target.value })}
            className="h-8 !text-xs"
            placeholder="Optional static default"
          />
        </div>
      )}

      {usesApiConfig && (
        <div className="space-y-2 rounded-md border border-gray-border p-2.5">
          {steps.length === 0 ? (
            <p className="text-[11px] text-gray-text-muted">
              Add an API step on the Logic tab first, then map this field here.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-[11px]">API step</Label>
                <Select
                  value={apiSource.stepId ?? steps[0]?.id ?? ''}
                  onValueChange={(value) => updateApiSource({ stepId: value })}
                >
                  <SelectTrigger className="!h-8 !text-xs">
                    <SelectValue placeholder="Select step" />
                  </SelectTrigger>
                  <SelectContent>
                    {steps.map((step) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.name} ({step.method})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Response path</Label>
                <Input
                  value={apiSource.responseKey ?? ''}
                  onChange={(event) => updateApiSource({ responseKey: event.target.value })}
                  className="h-8 !text-xs"
                  placeholder={hasOptionList ? 'e.g. data' : 'e.g. data.status'}
                />
              </div>

              {hasOptionList && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Value key</Label>
                    <Input
                      value={apiSource.optionValueKey ?? ''}
                      onChange={(event) => updateApiSource({ optionValueKey: event.target.value })}
                      className="h-8 !text-xs"
                      placeholder="e.g. deployment_name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Label key</Label>
                    <Input
                      value={apiSource.optionLabelKey ?? ''}
                      onChange={(event) => updateApiSource({ optionLabelKey: event.target.value })}
                      className="h-8 !text-xs"
                      placeholder="e.g. name"
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] leading-snug text-gray-text-muted">
                {hasOptionList
                  ? dataSource === 'static_and_api'
                    ? 'Manual options stay; API options are added when you apply logic.'
                    : 'Apply logic to replace this field’s options with the API list.'
                  : 'Apply logic to fill this field from the mapped API response.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

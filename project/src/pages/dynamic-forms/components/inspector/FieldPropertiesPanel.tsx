import { MousePointerClick, Trash2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormBuilderField, FormBuilderFieldType } from '../../types';
import { UNIQUE_FIELD_TYPE_OPTIONS } from '../../constants';
import { getFieldTypeBadge } from '../../lib/field/field-type-badge';
import { fieldSupportsDataSource, fieldSupportsPlaceholder, fieldUsesBigNumberConfig, fieldUsesDatePresets, fieldUsesOptions, fieldUsesTableConfig, getFieldTypeLabel, isFormButtonType, isDisplayFieldType } from '../../lib/field/field.utils';
import { DatePresetsEditor } from './DatePresetsEditor';
import { BigNumberConfigEditor } from './BigNumberConfigEditor';
import { FormBuilderDataTableEditor } from '../fields/data-table';
import { FieldTypeIcon } from '../fields/FieldTypeIcon';
import { OptionsEditor } from './OptionsEditor';
import { FieldDataSourceEditor } from './FieldDataSourceEditor';
import type { FormApiLogicStep } from '../../types';

interface FieldPropertiesPanelProps {
  field: FormBuilderField | null;
  apiSteps?: FormApiLogicStep[];
  onChange: (id: string, updates: Partial<FormBuilderField>) => void;
  onDelete: (id: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-text">{children}</span>
  );
}

function AccordionSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0 flex-1 text-left">
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-0.5 text-[10px] leading-snug text-gray-text-muted">{description}</p>
    </div>
  );
}

const accordionItemClassName = 'border-gray-border border-b px-0 last:border-b-0';
const accordionTriggerClassName =
  'items-center py-2.5 hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-gray-text-muted';

const panelShellClassName =
  'flex h-full min-h-0 flex-col overflow-hidden border-l border-gray-border bg-background';

export function FieldPropertiesPanel({ field, apiSteps = [], onChange, onDelete }: FieldPropertiesPanelProps) {
  if (!field) {
    return (
      <div className={panelShellClassName}>
        <div className="shrink-0 px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-text">Inspector</p>
          <p className="text-[10px] text-gray-text-muted">Field settings appear here</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-elevated">
            <MousePointerClick className="h-5 w-5 text-gray-text-muted" />
          </div>
          <p className="text-center text-xs font-medium text-gray-text">No field selected</p>
          <p className="mt-1 max-w-[180px] text-center text-[10px] leading-relaxed text-gray-text-muted">
            Click a field on the canvas to edit its label, type, and rules
          </p>
        </div>
      </div>
    );
  }

  const isSectionDivider = field.type === 'section_divider';
  const isFormButton = isFormButtonType(field.type);
  const isDisplayField = isDisplayFieldType(field.type);
  const typeLabel = UNIQUE_FIELD_TYPE_OPTIONS.find((item) => item.type === field.type)?.label ?? field.type;

  return (
    <div className={panelShellClassName}>
      <div className="shrink-0 space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <FieldTypeIcon type={field.type} className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-text">{field.displayName || 'Untitled'}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant="secondary" className="h-4 px-1 font-mono text-[8px]">
                {getFieldTypeBadge(field.type)}
              </Badge>
              <span className="truncate text-[10px] text-gray-text-muted">{typeLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <Accordion key={field.id} type="single" collapsible defaultValue="general" className="w-full">
          <AccordionItem value="general" className={accordionItemClassName}>
            <AccordionTrigger className={accordionTriggerClassName}>
              <AccordionSectionHeader
                title="General"
                description={
                  isSectionDivider
                    ? 'Title shown on the form section.'
                    : isFormButton
                      ? 'Text shown on the button.'
                      : isDisplayField
                        ? 'Title shown on the display component.'
                        : 'Label and key used in submissions.'
                }
              />
            </AccordionTrigger>
            <AccordionContent className="space-y-1.5 pb-3">
              <div className="space-y-1">
                <Label htmlFor="field-label" className="text-[11px]">
                  {isSectionDivider
                    ? 'Section title'
                    : isFormButton
                      ? 'Button label'
                      : isDisplayField
                        ? 'Title'
                        : 'Label'}
                </Label>
                <Input
                  id="field-label"
                  value={field.displayName}
                  onChange={(e) => onChange(field.id, { displayName: e.target.value })}
                  className="h-8 !text-xs"
                  placeholder={
                    isSectionDivider ? 'Section Title' : isFormButton ? 'Button text' : getFieldTypeLabel(field.type, UNIQUE_FIELD_TYPE_OPTIONS)
                  }
                />
              </div>
              {!isSectionDivider && !isFormButton && (
                <div className="space-y-1">
                  <Label htmlFor="field-name" className="text-[11px]">
                    Field key
                  </Label>
                  <Input
                    id="field-name"
                    value={field.name}
                    onChange={(e) => onChange(field.id, { name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    className="h-8 !text-xs"
                    placeholder={getFieldTypeLabel(field.type, UNIQUE_FIELD_TYPE_OPTIONS)
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/^_|_$/g, '')}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {!isSectionDivider && (
            <AccordionItem value="field-type" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title={isFormButton ? 'Button type' : 'Field type'}
                  description={
                    isFormButton
                      ? 'Switch between submit and cancel.'
                      : 'Input type and placeholder hint.'
                  }
                />
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                <Select
                  value={field.type}
                  onValueChange={(value) => onChange(field.id, { type: value as FormBuilderFieldType })}
                >
                  <SelectTrigger className="!h-7 !text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isFormButton
                      ? UNIQUE_FIELD_TYPE_OPTIONS.filter((item) => isFormButtonType(item.type))
                      : UNIQUE_FIELD_TYPE_OPTIONS
                    ).map((item) => (
                      <SelectItem key={item.type} value={item.type}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!isFormButton && fieldSupportsPlaceholder(field.type) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="field-placeholder" className="text-[10px] font-bold uppercase tracking-wider">
                      Placeholder
                    </Label>
                    <Input
                      id="field-placeholder"
                      value={field.placeholder ?? ''}
                      onChange={(e) => onChange(field.id, { placeholder: e.target.value })}
                      className="h-8 !text-xs"
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && !isDisplayField && (
            <AccordionItem value="validation" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Validation"
                  description="Require a value before the form submits."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <label
                  htmlFor="field-required"
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-2 transition-colors hover:bg-gray-surface-hover/50"
                >
                  <Checkbox
                    id="field-required"
                    checked={field.required ?? false}
                    onCheckedChange={(checked) => onChange(field.id, { required: checked === true })}
                  />
                  <span className="text-xs text-gray-text">Required field</span>
                </label>
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldUsesDatePresets(field.type) && (
            <AccordionItem value="date-range-buttons" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Date range buttons"
                  description="Preset ranges, accent color, and calendar."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <DatePresetsEditor
                  presets={field.datePresets ?? []}
                  allowCustomRange={field.allowCustomRange ?? true}
                  datePickerColor={field.datePickerColor}
                  onChange={(datePresets) => onChange(field.id, { datePresets })}
                  onAllowCustomRangeChange={(allowCustomRange) => onChange(field.id, { allowCustomRange })}
                  onDatePickerColorChange={(datePickerColor) => onChange(field.id, { datePickerColor })}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldUsesBigNumberConfig(field.type) && (
            <AccordionItem value="big-number" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Big number"
                  description="Value, prefix/suffix, and accent color."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <BigNumberConfigEditor
                  field={field}
                  onChange={(updates) => onChange(field.id, updates)}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldUsesTableConfig(field.type) && (
            <AccordionItem value="table-config" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Table"
                  description="Features, search, actions, and column display — split into tabs."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <FormBuilderDataTableEditor
                  columns={field.tableColumns ?? []}
                  initialRowCount={field.tableInitialRowCount}
                  tableUi={field.tableUi}
                  apiSteps={apiSteps}
                  onChange={({ tableColumns, tableInitialRowCount, tableUi }) =>
                    onChange(field.id, { tableColumns, tableInitialRowCount, tableUi })
                  }
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldSupportsDataSource(field.type) && (
            <AccordionItem value="data-source" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Data source"
                  description="Hardcode values or load them from an API step."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <FieldDataSourceEditor
                  field={field}
                  apiSteps={apiSteps}
                  onChange={(updates) => onChange(field.id, updates)}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldUsesOptions(field.type) && (field.dataSource ?? 'static') !== 'api' && (
            <AccordionItem value="options" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Options"
                  description={
                    field.dataSource === 'static_and_api'
                      ? 'Hardcoded choices kept alongside API options.'
                      : 'Hardcoded choices the user can pick from.'
                  }
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <OptionsEditor
                  options={field.staticOptions ?? field.options ?? []}
                  onChange={(options) => onChange(field.id, { options, staticOptions: options })}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {!isSectionDivider && !isFormButton && fieldUsesOptions(field.type) && field.dataSource === 'api' && (
            <AccordionItem value="options-api" className={accordionItemClassName}>
              <AccordionTrigger className={accordionTriggerClassName}>
                <AccordionSectionHeader
                  title="Options preview"
                  description="Options load from the API when you apply logic."
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <p className="rounded-md border border-dashed border-gray-border px-3 py-2 text-[11px] text-gray-text-muted">
                  {(field.options?.length ?? 0) > 0
                    ? `${field.options?.length} options loaded from the last apply.`
                    : 'Apply logic on the Logic tab to fetch options from your API.'}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>

      <div className="shrink-0 px-2 pb-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(field.id)}
          className="h-8 w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove field
        </Button>
      </div>
    </div>
  );
}

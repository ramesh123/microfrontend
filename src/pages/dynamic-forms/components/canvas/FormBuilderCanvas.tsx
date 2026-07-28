import {
  Eye,
  GitBranch,
  Info,
  LayoutTemplate,
  MousePointerClick,
  Plug,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AppliedFormLogicState, FormApiLogicConfig, FormBuilderDefinition, FormBuilderField, FormFieldValue } from '../../types';
import { FormBuilderFieldGrid } from './FormBuilderFieldGrid';
import { FormLogicPanel } from '../logic/FormLogicPanel';
import { FormApiIntegrationPanel } from '../integration/FormApiIntegrationPanel';
import { FormPreviewSheet } from '../preview/FormPreviewSheet';

export type BuilderCanvasTab = 'design' | 'logic' | 'integration' | 'settings';

interface FormBuilderCanvasProps {
  canvasTab: BuilderCanvasTab;
  onCanvasTabChange: (tab: BuilderCanvasTab) => void;
  definition: FormBuilderDefinition;
  sortedFields: FormBuilderField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeselectField: () => void;
  onRemoveField: (id: string) => void;
  onMoveField?: (id: string, direction: 'up' | 'down') => void;
  onFieldsLayoutChange: (fields: FormBuilderField[]) => void;
  onUpdateDefinition: (updates: Partial<FormBuilderDefinition>) => void;
  onUpdateApiLogic: (config: FormApiLogicConfig) => void;
  onUpdateField: (fieldId: string, updates: Partial<FormBuilderField>) => void;
  onApplyLogic: () => Promise<void>;
  onSave: () => void;
  onPreviewSubmit: (values: Record<string, FormFieldValue>) => void;
  previewSheetOpen?: boolean;
  onPreviewSheetOpenChange?: (open: boolean) => void;
  isApplyingLogic?: boolean;
  logicApplied?: boolean;
  appliedLogic?: AppliedFormLogicState | null;
}

const tabTriggerClassName = cn(
  'relative flex-none h-9 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-0 text-xs font-medium text-gray-text-muted shadow-none',
  'hover:text-gray-text',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-gray-text data-[state=active]:shadow-none',
);

export function FormBuilderCanvas({
  canvasTab,
  onCanvasTabChange,
  definition,
  sortedFields,
  selectedFieldId,
  onSelectField,
  onDeselectField,
  onRemoveField,
  onMoveField,
  onFieldsLayoutChange,
  onUpdateDefinition,
  onUpdateApiLogic,
  onUpdateField,
  onApplyLogic,
  onSave,
  onPreviewSubmit,
  previewSheetOpen = false,
  onPreviewSheetOpenChange,
  isApplyingLogic = false,
  logicApplied = false,
  appliedLogic = null,
}: FormBuilderCanvasProps) {
  const visibleFields = sortedFields.filter((field) => field.visible);
  const selectedField = visibleFields.find((field) => field.id === selectedFieldId);

  const handleOpenPreview = () => {
    if (visibleFields.length === 0) return;
    onPreviewSheetOpenChange?.(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-border bg-background px-7">
        <Tabs
          value={canvasTab}
          onValueChange={(value) => onCanvasTabChange(value as BuilderCanvasTab)}
          className="min-w-0 flex-1 gap-0"
        >
          <TabsList className="h-auto w-fit gap-0 rounded-none bg-transparent p-0">
            <TabsTrigger value="design" className={tabTriggerClassName}>
              <LayoutTemplate className="h-3.5 w-3.5" />
              Design
            </TabsTrigger>
            <TabsTrigger value="logic" className={tabTriggerClassName}>
              <GitBranch className="h-3.5 w-3.5" />
              Logic
            </TabsTrigger>
            <TabsTrigger value="integration" className={tabTriggerClassName}>
              <Plug className="h-3.5 w-3.5" />
              Integration
            </TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerClassName}>
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex shrink-0 items-center gap-2">
          {canvasTab === 'design' && visibleFields.length > 0 && (
            <div className="hidden items-center gap-2 text-[10px] text-gray-text-muted md:flex">
              <Info className="h-3 w-3 shrink-0" />
              <span className="max-w-[220px] truncate">
                {selectedField
                  ? `Editing "${selectedField.displayName}"`
                  : 'Select a field · Drag to move · Resize from corner'}
              </span>
              <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                {visibleFields.length} fields
              </Badge>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 gap-1.5 text-xs"
            disabled={visibleFields.length === 0}
            onClick={handleOpenPreview}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button type="button" size="sm" className="!h-7 gap-1.5 text-xs" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      <div
        className="form-builder-canvas-surface min-h-0 flex-1 overflow-y-auto p-3"
        onClick={(event) => {
          if (canvasTab === 'design' && event.target === event.currentTarget) {
            onDeselectField();
          }
        }}
      >
        {canvasTab === 'design' && (
          <div
            className="form-builder-form-zone mx-auto w-full max-w-5xl p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onDeselectField();
              }
            }}
          >
            <div className="mb-2 space-y-1 border-b border-gray-border/60 pb-1">
              <Input
                value={definition.title}
                onChange={(event) => onUpdateDefinition({ title: event.target.value })}
                className="h-auto !text-lg border-none bg-transparent px-0 py-0 font-semibold tracking-tight text-gray-text shadow-none focus-visible:ring-0"
                placeholder="Form title"
              />
              <Textarea
                value={definition.description ?? ''}
                onChange={(event) => onUpdateDefinition({ description: event.target.value })}
                rows={1}
                className="!h-6 min-h-0 py-0 resize-none border-none bg-transparent px-0 text-sm text-gray-text-muted shadow-none focus-visible:ring-0"
                placeholder="Form description (optional)"
              />
            </div>

            {visibleFields.length === 0 ? (
              <div className="form-builder-empty-state flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-border bg-gray-surface/50 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-gray-text">Your form is empty</p>
                <p className="mt-1 max-w-xs text-xs text-gray-text-muted">
                  Use quick-add chips on the left or browse components by category
                </p>
                <div className="mt-5 flex items-center gap-4 text-[10px] text-gray-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" /> Add field
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <LayoutTemplate className="h-3 w-3" /> Arrange layout
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Configure
                  </span>
                </div>
              </div>
            ) : (
              <div className="form-builder-field-enter">
                <FormBuilderFieldGrid
                  fields={sortedFields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={onSelectField}
                  onRemoveField={onRemoveField}
                  onMoveField={onMoveField}
                  onLayoutChange={onFieldsLayoutChange}
                />
              </div>
            )}
          </div>
        )}

        {canvasTab === 'logic' && (
          <div className="form-builder-form-zone mx-auto w-full max-w-5xl p-4">
            <FormLogicPanel
              apiLogic={definition.apiLogic ?? { steps: [] }}
              fields={sortedFields}
              onChange={onUpdateApiLogic}
              onUpdateField={onUpdateField}
              onApply={onApplyLogic}
              isApplying={isApplyingLogic}
              logicApplied={logicApplied}
            />
          </div>
        )}

        {canvasTab === 'integration' && (
          <div className="form-builder-form-zone mx-auto w-full max-w-5xl p-4">
            <FormApiIntegrationPanel fields={sortedFields} />
          </div>
        )}

        {canvasTab === 'settings' && (
          <div className="form-builder-form-zone mx-auto w-full max-w-5xl space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-gray-text">Form settings</p>
              <p className="text-xs text-gray-text-muted">Title and description shown to end users.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-text" htmlFor="settings-title">
                Title
              </label>
              <Input
                id="settings-title"
                value={definition.title}
                onChange={(event) => onUpdateDefinition({ title: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-text" htmlFor="settings-description">
                Description
              </label>
              <Textarea
                id="settings-description"
                value={definition.description ?? ''}
                onChange={(event) => onUpdateDefinition({ description: event.target.value })}
                rows={3}
                placeholder="What is this form for?"
              />
            </div>
          </div>
        )}

      </div>

      <FormPreviewSheet
        open={previewSheetOpen}
        onOpenChange={(open) => onPreviewSheetOpenChange?.(open)}
        definition={definition}
        appliedLogic={appliedLogic}
        logicApplied={logicApplied}
        onSubmit={onPreviewSubmit}
      />
    </div>
  );
}

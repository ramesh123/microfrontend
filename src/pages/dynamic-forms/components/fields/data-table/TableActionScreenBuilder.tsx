import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import '../../../styles/form-builder.css';
import { ALL_FIELD_TYPES } from '../../../constants';
import { ensureFieldLayout, getNextFieldLayout } from '../../../lib/grid/form-builder-grid.utils';
import { createDefaultField, migrateFieldType } from '../../../lib/field/field.utils';
import { applyApiLogicToForm } from '../../../lib/logic/form-logic.utils';
import { syncDisplayFieldsFromAppliedLogic } from '../../../lib/table/form-table.utils';
import type {
  AppliedFormLogicState,
  FormApiLogicConfig,
  FormBuilderDefinition,
  FormBuilderField,
  FormBuilderFieldType,
  FormBuilderTableColumn,
  FormBuilderTableCustomAction,
  FormFieldValue,
} from '../../../types';
import { FieldPalette } from '../../palette/FieldPalette';
import { FieldPropertiesPanel } from '../../inspector/FieldPropertiesPanel';
import { FormBuilderCanvas, type BuilderCanvasTab } from '../../canvas/FormBuilderCanvas';
import { resolveScreenDefinition } from './screen-definition.utils';

export interface TableActionScreenBuilderSave {
  screenDefinition: FormBuilderDefinition;
  screenTitle?: string;
  submitLabel?: string;
}

interface TableActionScreenBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: FormBuilderTableCustomAction | null;
  columns: FormBuilderTableColumn[];
  onSave: (config: TableActionScreenBuilderSave) => void;
}

export function TableActionScreenBuilder({
  open,
  onOpenChange,
  action,
  columns: _columns,
  onSave,
}: TableActionScreenBuilderProps) {
  const [definition, setDefinition] = useState<FormBuilderDefinition>(() =>
    resolveScreenDefinition({}),
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [builderCanvasTab, setBuilderCanvasTab] = useState<BuilderCanvasTab>('design');
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [appliedLogic, setAppliedLogic] = useState<AppliedFormLogicState | null>(null);
  const [isApplyingLogic, setIsApplyingLogic] = useState(false);

  useEffect(() => {
    if (!open || !action) return;
    const next = resolveScreenDefinition(action);
    setDefinition(next);
    setSelectedFieldId(next.fields[0]?.id ?? null);
    setBuilderCanvasTab('design');
    setAppliedLogic(null);
    setPreviewSheetOpen(false);
  }, [open, action]);

  const visibleFieldCount = useMemo(
    () => definition.fields.filter((field) => field.visible).length,
    [definition.fields],
  );

  const sortedFields = useMemo(
    () => [...definition.fields].sort((a, b) => a.position - b.position),
    [definition.fields],
  );

  const selectedField = sortedFields.find((field) => field.id === selectedFieldId) ?? null;

  const addField = (type: FormBuilderFieldType, label?: string) => {
    const newField: FormBuilderField = {
      ...createDefaultField(type, definition.fields.length, ALL_FIELD_TYPES, label),
      layout: getNextFieldLayout(definition.fields, type),
    };
    setDefinition((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldId(newField.id);
    setBuilderCanvasTab('design');
  };

  const handleFieldsLayoutChange = (fields: FormBuilderField[]) => {
    setDefinition((prev) => ({ ...prev, fields }));
  };

  const updateField = (id: string, updates: Partial<FormBuilderField>) => {
    setDefinition((prev) => ({
      ...prev,
      fields: prev.fields.map((field) => {
        if (field.id !== id) return field;
        if (updates.type && updates.type !== field.type) {
          return migrateFieldType(field, updates.type);
        }
        return { ...field, ...updates };
      }),
    }));
  };

  const moveField = (id: string, direction: 'up' | 'down') => {
    setDefinition((prev) => {
      const visible = prev.fields
        .filter((field) => field.visible)
        .sort((a, b) => {
          const sorted = prev.fields.filter((field) => field.visible);
          const indexA = sorted.findIndex((field) => field.id === a.id);
          const indexB = sorted.findIndex((field) => field.id === b.id);
          const layoutA = ensureFieldLayout(a, indexA, sorted);
          const layoutB = ensureFieldLayout(b, indexB, sorted);
          if (layoutA.y !== layoutB.y) return layoutA.y - layoutB.y;
          return layoutA.x - layoutB.x;
        });

      const index = visible.findIndex((field) => field.id === id);
      if (index < 0) return prev;

      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= visible.length) return prev;

      const fieldA = visible[index];
      const fieldB = visible[swapIndex];
      const layoutA = fieldA.layout ?? ensureFieldLayout(fieldA, index, visible);
      const layoutB = fieldB.layout ?? ensureFieldLayout(fieldB, swapIndex, visible);

      return {
        ...prev,
        fields: prev.fields.map((field) => {
          if (field.id === fieldA.id) return { ...field, layout: layoutB };
          if (field.id === fieldB.id) return { ...field, layout: layoutA };
          return field;
        }),
      };
    });
  };

  const removeField = (id: string) => {
    setDefinition((prev) => ({
      ...prev,
      fields: prev.fields
        .filter((field) => field.id !== id)
        .map((field, index) => ({ ...field, position: index })),
    }));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleApplyLogic = async () => {
    if (visibleFieldCount === 0) {
      toast.error('Add fields on the Design tab before applying logic');
      return;
    }

    const steps = definition.apiLogic?.steps ?? [];
    setIsApplyingLogic(true);
    try {
      const { state, fields: updatedFields, error } = await applyApiLogicToForm(
        definition.fields,
        steps,
      );
      if (!state) {
        toast.error(error ?? 'Failed to apply logic');
        return;
      }
      setAppliedLogic(state);
      setDefinition((prev) => ({
        ...prev,
        fields: syncDisplayFieldsFromAppliedLogic(updatedFields, state.values),
      }));
      setPreviewSheetOpen(true);
      toast.success('Logic applied — preview opened with mapped values');
    } finally {
      setIsApplyingLogic(false);
    }
  };

  const handleSave = () => {
    if (visibleFieldCount === 0) {
      toast.error('Add at least one field before saving');
      return;
    }
    onSave({
      screenDefinition: definition,
      screenTitle: definition.title,
      submitLabel: action?.submitLabel,
    });
    toast.success('Edit form saved — opens when the row action runs');
    onOpenChange(false);
  };

  const handlePreviewSubmit = (values: Record<string, FormFieldValue>) => {
    console.log('Edit screen preview submit:', values);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(98vw,96rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        hideClose={false}
      >
        <SheetHeader className="shrink-0 border-b px-5 py-3 text-left">
          <SheetTitle className="text-lg">Design edit form</SheetTitle>
          <SheetDescription className="text-xs">
            Exact mirror of the form builder — Design, Logic, Integration, and Settings. Saved form
            opens in the Edit dialog/sheet for each table row.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-surface">
          <div className="grid h-full min-h-0 gap-y-2.5 lg:grid-cols-[212px_minmax(0,1fr)_268px] lg:gap-x-0">
            <FieldPalette onAddField={addField} />

            <FormBuilderCanvas
              canvasTab={builderCanvasTab}
              onCanvasTabChange={setBuilderCanvasTab}
              definition={definition}
              sortedFields={sortedFields}
              selectedFieldId={selectedFieldId}
              onSelectField={setSelectedFieldId}
              onDeselectField={() => setSelectedFieldId(null)}
              onRemoveField={removeField}
              onMoveField={moveField}
              onFieldsLayoutChange={handleFieldsLayoutChange}
              onUpdateDefinition={(updates) =>
                setDefinition((prev) => ({ ...prev, ...updates }))
              }
              onUpdateApiLogic={(apiLogic: FormApiLogicConfig) =>
                setDefinition((prev) => ({ ...prev, apiLogic }))
              }
              onUpdateField={updateField}
              onApplyLogic={handleApplyLogic}
              onSave={handleSave}
              onPreviewSubmit={handlePreviewSubmit}
              previewSheetOpen={previewSheetOpen}
              onPreviewSheetOpenChange={setPreviewSheetOpen}
              isApplyingLogic={isApplyingLogic}
              logicApplied={!!appliedLogic}
              appliedLogic={appliedLogic}
            />

            <FieldPropertiesPanel
              field={selectedField}
              apiSteps={definition.apiLogic?.steps ?? []}
              onChange={updateField}
              onDelete={removeField}
            />
          </div>
        </div>

        <SheetFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t px-5 py-3 sm:space-x-0">
          <p className="text-xs text-muted-foreground">
            {visibleFieldCount} field{visibleFieldCount === 1 ? '' : 's'} ·{' '}
            {definition.apiLogic?.steps?.length ?? 0} API step
            {(definition.apiLogic?.steps?.length ?? 0) === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save edit form
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

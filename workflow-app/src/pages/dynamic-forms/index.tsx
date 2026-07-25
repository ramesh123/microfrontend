import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import './styles/form-builder.css';
import type { AppliedFormLogicState, FormBuilderDefinition, FormBuilderField, FormBuilderFieldType, FormFieldValue } from './types';
import { ALL_FIELD_TYPES } from './constants';
import { ensureFieldLayout, getNextFieldLayout } from './lib/grid/form-builder-grid.utils';
import { createDefaultField, migrateFieldType } from './lib/field/field.utils';
import { applyApiLogicToForm, createDefaultApiLogicStep } from './lib/logic/form-logic.utils';
import { syncDisplayFieldsFromAppliedLogic } from './lib/table/form-table.utils';
import { FieldPalette, FieldPropertiesPanel, FormBuilderCanvas } from './components';
import { FormMenuAssignmentDialog } from './components/save/FormMenuAssignmentDialog';
import { useDynamicFormAssignmentStore } from './stores/useDynamicFormAssignmentStore';

const DynamicFormsPage = () => {
  const [definition, setDefinition] = useState<FormBuilderDefinition>({
    id: crypto.randomUUID(),
    title: 'Customer Registration Form',
    description: 'Please fill in your details below to complete registration.',
    fields: [],
    apiLogic: { steps: [createDefaultApiLogicStep()] },
  });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [builderCanvasTab, setBuilderCanvasTab] = useState<
    'design' | 'logic' | 'integration' | 'settings'
  >('design');
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [appliedLogic, setAppliedLogic] = useState<AppliedFormLogicState | null>(null);
  const [isApplyingLogic, setIsApplyingLogic] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const assignForm = useDynamicFormAssignmentStore((state) => state.assignForm);
  const addCreatedMenuItem = useDynamicFormAssignmentStore((state) => state.addCreatedMenuItem);

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
    setDefinition((prev) => {
      const nextFields = prev.fields
        .filter((field) => field.id !== id)
        .map((field, index) => ({ ...field, position: index }));
      return { ...prev, fields: nextFields };
    });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  const saveForm = () => {
    if (visibleFieldCount === 0) {
      toast.error('Add at least one field before saving');
      return;
    }
    setSaveDialogOpen(true);
  };

  const handleSaveToMenu = (result: {
    menuPath: string;
    menuTitle: string;
    mode: 'create' | 'existing';
    parentPath?: string | null;
  }) => {
    if (result.mode === 'create') {
      addCreatedMenuItem({
        p_id: `df_${crypto.randomUUID().slice(0, 8)}`,
        title: result.menuTitle,
        path: result.menuPath,
        parentPath: result.parentPath ?? null,
        icon: 'LayoutTemplate',
      });
      assignForm(result.menuPath, result.menuTitle, definition, appliedLogic, {
        createdMenuItem: true,
      });
      toast.success(`Created menu "${result.menuTitle}" — open ${result.menuPath} to view the form`);
      return;
    }

    assignForm(result.menuPath, result.menuTitle, definition, appliedLogic);
    toast.success(`Form saved to "${result.menuTitle}" — open that menu tab to view it`);
  };

  const handleApplyLogic = async () => {
    if (visibleFieldCount === 0) {
      toast.error('Add fields on the Design tab before applying logic');
      return;
    }

    const steps = definition.apiLogic?.steps ?? [];
    setIsApplyingLogic(true);
    try {
      const { state, fields: updatedFields, error } = await applyApiLogicToForm(definition.fields, steps);
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

  const handlePreviewSubmit = (values: Record<string, FormFieldValue>) => {
    console.log('Form submitted:', values);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-surface">
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
          onUpdateDefinition={(updates) => setDefinition((prev) => ({ ...prev, ...updates }))}
          onUpdateApiLogic={(apiLogic) => setDefinition((prev) => ({ ...prev, apiLogic }))}
          onUpdateField={updateField}
          onApplyLogic={handleApplyLogic}
          onSave={saveForm}
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

      <FormMenuAssignmentDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultTitle={definition.title || 'My Form'}
        onConfirm={handleSaveToMenu}
      />
    </div>
  );
};

export default DynamicFormsPage;

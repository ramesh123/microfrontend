import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AppliedFormLogicState, FormBuilderDefinition, FormBuilderField, FormFieldValue } from '../../types';
import { getDefaultFieldValue, isFieldValueEmpty, isInputFieldType } from '../../lib/field/field.utils';
import { FormPreviewGrid } from './FormPreviewGrid';

interface FormPreviewProps {
  definition: FormBuilderDefinition;
  interactive?: boolean;
  hideHeader?: boolean;
  appliedLogic?: AppliedFormLogicState | null;
  onSubmit?: (values: Record<string, FormFieldValue>) => void;
  onCancel?: () => void;
}

export function FormPreview({
  definition,
  interactive = false,
  hideHeader = false,
  appliedLogic = null,
  onSubmit,
  onCancel,
}: FormPreviewProps) {
  const previewFields = useMemo(() => {
    return definition.fields
      .map((field) => ({
        ...field,
        visible: appliedLogic?.visibilityOverrides[field.id] ?? field.visible,
      }))
      .filter((field) => field.visible);
  }, [definition.fields, appliedLogic]);

  const visibleFields = useMemo(
    () => [...previewFields].sort((a, b) => a.position - b.position),
    [previewFields],
  );

  const [formValues, setFormValues] = useState<Record<string, FormFieldValue>>({});

  useEffect(() => {
    if (!appliedLogic) {
      setFormValues({});
      return;
    }

    setFormValues(appliedLogic.values);
  }, [appliedLogic?.appliedAt, appliedLogic]);

  const getValue = (field: FormBuilderField): FormFieldValue => {
    if (field.name in formValues) return formValues[field.name];
    return getDefaultFieldValue(field);
  };

  const setValue = (name: string, value: FormFieldValue) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputFields = visibleFields.filter((field) => isInputFieldType(field.type));
    const values = inputFields.reduce<Record<string, FormFieldValue>>((acc, field) => {
      acc[field.name] = getValue(field);
      return acc;
    }, {});

    const missingRequired = inputFields.filter(
      (field) => field.required && isFieldValueEmpty(field, getValue(field)),
    );

    if (missingRequired.length > 0) {
      toast.error(`Please fill required fields: ${missingRequired.map((f) => f.displayName).join(', ')}`);
      return;
    }

    onSubmit?.(values);
    toast.success('Form submitted successfully');
  };

  if (visibleFields.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-border bg-gray-panel-muted">
        <p className="text-sm text-gray-text-muted">Add and show at least one field to preview the form</p>
      </div>
    );
  }

  

  const standaloneHeader = !hideHeader && (
    <div className="mb-4 space-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-gray-text">{definition.title}</h2>
      {definition.description && (
        <p className="text-sm text-gray-text-muted">{definition.description}</p>
      )}
    </div>
  );

  const formBody = (
    <FormPreviewGrid
      fields={previewFields}
      interactive={interactive}
      getValue={getValue}
      onChange={setValue}
      onCancel={onCancel}
      apiSteps={definition.apiLogic?.steps ?? []}
    />
  );

  if (interactive) {
    return (
      <div className="w-full min-w-0">
        {standaloneHeader}
        <form onSubmit={handleSubmit} className="w-full min-w-0">
          {formBody}
        </form>
      </div>
    );
  }

  return (
    <Card className="max-w-4xl py-4">
      {!hideHeader && (
        <CardHeader className="px-6 pb-2">
          <CardTitle>{definition.title}</CardTitle>
          {definition.description && <CardDescription>{definition.description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn('px-6', hideHeader && 'px-0')}>
        {formBody}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AppliedFormLogicState, FormFieldValue } from '../../types';
import { applyApiLogicToForm } from '../../lib/logic/form-logic.utils';
import { syncDisplayFieldsFromAppliedLogic } from '../../lib/table/form-table.utils';
import type { DynamicFormAssignment } from '../../stores/useDynamicFormAssignmentStore';
import type { FormBuilderDefinition } from '../../types';
import { FormPreview } from '../preview/FormPreview';

interface DynamicFormRuntimeViewProps {
  assignment: DynamicFormAssignment;
}

export function DynamicFormRuntimeView({ assignment }: DynamicFormRuntimeViewProps) {
  const [definition, setDefinition] = useState<FormBuilderDefinition>(assignment.definition);
  const [appliedLogic, setAppliedLogic] = useState<AppliedFormLogicState | null>(assignment.appliedLogic);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDefinition(assignment.definition);
    setAppliedLogic(assignment.appliedLogic);
  }, [assignment]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromApi = async () => {
      if (assignment.appliedLogic) {
        setAppliedLogic(assignment.appliedLogic);
        setDefinition({
          ...assignment.definition,
          fields: syncDisplayFieldsFromAppliedLogic(
            assignment.definition.fields,
            assignment.appliedLogic.values,
          ),
        });
        return;
      }

      const steps = assignment.definition.apiLogic?.steps ?? [];
      if (steps.length === 0) {
        setAppliedLogic(null);
        return;
      }

      setIsLoading(true);
      try {
        const { state, fields: updatedFields, error } = await applyApiLogicToForm(assignment.definition.fields, steps);
        if (cancelled) return;
        if (!state) {
          toast.error(error ?? 'Failed to load form data from API');
          setAppliedLogic(null);
          return;
        }
        setAppliedLogic(state);
        setDefinition((prev) => ({
          ...prev,
          fields: syncDisplayFieldsFromAppliedLogic(updatedFields, state.values),
        }));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void hydrateFromApi();
    return () => {
      cancelled = true;
    };
  }, [assignment]);

  const handleSubmit = (values: Record<string, FormFieldValue>) => {
    console.log('Dynamic form submitted:', { menuPath: assignment.menuPath, values });
    toast.success('Form submitted');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-gray-text-muted">Loading form data from API…</p>
      </div>
    );
  }

  return (
      <div className="form-builder-form-zone mx-auto w-full max-w-9xl flex-1 overflow-y-auto p-5">
        <FormPreview
          definition={definition}
          appliedLogic={appliedLogic}
          interactive
          onSubmit={handleSubmit}
        />
      </div>
  );
}

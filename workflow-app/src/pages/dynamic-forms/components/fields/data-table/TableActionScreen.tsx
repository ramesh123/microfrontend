import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type {
  AppliedFormLogicState,
  FormApiLogicStep,
  FormBuilderDefinition,
  FormBuilderTableColumn,
  FormBuilderTableCustomAction,
  FormFieldValue,
} from '../../../types';
import {
  applyApiLogicToForm,
  executeApiLogicStep,
} from '../../../lib/logic/form-logic.utils';
import { syncDisplayFieldsFromAppliedLogic } from '../../../lib/table/form-table.utils';
import { FormPreview } from '../../preview/FormPreview';
import { applyRowContextToStep } from './table-action-screen.runtime';
import { getTableScreenSizeClasses } from './table-action-screen.utils';
import { resolveScreenDefinition } from './screen-definition.utils';

export interface TableActionScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: FormBuilderTableCustomAction | null;
  row: Record<string, unknown> | null;
  columns: FormBuilderTableColumn[];
  apiSteps?: FormApiLogicStep[];
}

function seedAppliedLogicFromRow(
  definition: FormBuilderDefinition,
  row: Record<string, unknown> | null,
): AppliedFormLogicState | null {
  if (!row) return null;
  const values: Record<string, FormFieldValue> = {};
  for (const field of definition.fields) {
    if (!field.visible) continue;
    const raw = row[field.name] ?? row[field.id];
    if (raw == null) continue;
    if (typeof raw === 'boolean') values[field.name] = raw;
    else if (Array.isArray(raw)) values[field.name] = raw.map(String);
    else values[field.name] = String(raw);
  }
  if (Object.keys(values).length === 0) return null;
  return {
    values,
    visibilityOverrides: {},
    appliedAt: Date.now(),
    summary: [],
  };
}

export function TableActionScreen({
  open,
  onOpenChange,
  action,
  row,
  apiSteps = [],
}: TableActionScreenProps) {
  const presentation = action?.screenPresentation ?? 'dialog';
  const size = action?.screenSize ?? 'xl';
  const sizeClasses = useMemo(() => getTableScreenSizeClasses(size), [size]);
  const title = action?.screenTitle?.trim() || action?.label || 'Screen';

  const [definition, setDefinition] = useState<FormBuilderDefinition | null>(null);
  const [appliedLogic, setAppliedLogic] = useState<AppliedFormLogicState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !action) return;

    const resolved = resolveScreenDefinition(action);
    setDefinition(resolved);
    const seeded = seedAppliedLogicFromRow(resolved, row);
    setAppliedLogic(seeded);

    const steps = (resolved.apiLogic?.steps ?? []).map((step) =>
      applyRowContextToStep(step, row),
    );
    if (steps.length === 0 || steps.every((step) => !step.url?.trim())) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const { state, fields: updatedFields, error } = await applyApiLogicToForm(
          resolved.fields,
          steps,
        );
        if (cancelled) return;
        if (!state) {
          toast.error(error ?? 'Failed to load edit form from API');
          return;
        }
        setAppliedLogic({
          ...state,
          values: { ...(seeded?.values ?? {}), ...state.values },
        });
        setDefinition({
          ...resolved,
          fields: syncDisplayFieldsFromAppliedLogic(updatedFields, state.values),
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, action, row]);

  const handleSubmit = async (values: Record<string, FormFieldValue>) => {
    if (!action) return;

    const submitStepId = action.submitStepId;
    const step =
      (submitStepId
        ? apiSteps.find((item) => item.id === submitStepId) ??
          definition?.apiLogic?.steps?.find((item) => item.id === submitStepId)
        : undefined) ??
      definition?.apiLogic?.steps?.find(
        (item) => item.method === 'POST' || item.method === 'PUT' || item.method === 'PATCH',
      );

    if (!step) {
      toast.success('Form submitted');
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await executeApiLogicStep(
        applyRowContextToStep(
          {
            ...step,
            requestBody: JSON.stringify(values),
            payloadFormat: step.payloadFormat === 'none' ? 'json' : step.payloadFormat ?? 'json',
          },
          row,
        ),
      );
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(`${action.label} saved`);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {isLoading || isSaving ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isSaving ? 'Saving…' : 'Loading form from API…'}
        </div>
      ) : definition ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <FormPreview
            definition={definition}
            appliedLogic={appliedLogic}
            interactive
            hideHeader
            onSubmit={(values) => void handleSubmit(values)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No edit form designed yet. Use Create form on the action.
        </p>
      )}
    </div>
  );

  if (!open) return null;

  if (presentation === 'page') {
    return (
      <div className="flex min-h-[420px] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{definition?.title || title}</p>
            <p className="truncate text-xs text-muted-foreground">
              Full page · Back returns to the previous screen
            </p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">{body}</div>
      </div>
    );
  }

  if (presentation === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn('flex flex-col gap-0 p-0', sizeClasses.sheet)}
          hideClose={false}
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-lg">{definition?.title || title}</SheetTitle>
            <SheetDescription className="text-xs">
              Same form builder Design + Logic — API mappings fill this screen.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-5 py-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-w-none flex-col gap-0 overflow-hidden p-0 pointer-events-auto',
          sizeClasses.dialog,
        )}
      >
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-lg">{definition?.title || title}</DialogTitle>
          <DialogDescription className="text-xs">
            Same form builder Design + Logic — API mappings fill this screen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

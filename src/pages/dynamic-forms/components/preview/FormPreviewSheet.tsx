import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import type { AppliedFormLogicState, FormBuilderDefinition, FormFieldValue } from '../../types';
import { FormPreview } from '../preview/FormPreview';

interface FormPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: FormBuilderDefinition;
  appliedLogic?: AppliedFormLogicState | null;
  logicApplied?: boolean;
  onSubmit?: (values: Record<string, FormFieldValue>) => void;
}

export function FormPreviewSheet({
  open,
  onOpenChange,
  definition,
  appliedLogic = null,
  onSubmit,
}: FormPreviewSheetProps) {
  const previewKey = `${appliedLogic?.appliedAt ?? 'none'}-${definition.fields.map((field) => `${field.id}-${field.position}-${field.type}`).join(',')}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        style={{ width: '96vw', maxWidth: '96vw' }}
        className="flex flex-col gap-0 overflow-visible rounded-l-3xl p-0"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="form-builder-form-zone min-h-full w-full rounded-none border-0 px-2 py-1 sm:px-2 sm:py-1 lg:px-2 lg:py-1">
            <FormPreview
              key={previewKey}
              definition={definition}
              appliedLogic={appliedLogic}
              interactive
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

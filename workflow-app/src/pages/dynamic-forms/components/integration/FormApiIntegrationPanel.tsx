import { Plug } from 'lucide-react';
import type { FormBuilderField } from '../../types';
import { DatePickerApiHelp } from './DatePickerApiHelp';

interface FormApiIntegrationPanelProps {
  fields: FormBuilderField[];
}

export function FormApiIntegrationPanel({ fields }: FormApiIntegrationPanelProps) {
  const dateFields = fields.filter((field) => field.type === 'date' && field.visible);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-text">API integration</p>
        <p className="mt-1 text-xs text-gray-text-muted">
          Connect your form fields to external APIs. Configure endpoints on the Logic tab; use this guide for date picker
          payloads and mapping examples.
        </p>
      </div>

      {dateFields.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-border bg-gray-surface/50 px-6 py-10 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-gray-text">No date pickers yet</p>
          <p className="mt-1 max-w-sm text-xs text-gray-text-muted">
            Add a Date Picker on the Design tab to see field keys, sample API responses, and submit payload examples here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateFields.map((field) => (
            <DatePickerApiHelp key={field.id} fieldKey={field.name} fieldLabel={field.displayName} />
          ))}
        </div>
      )}
    </div>
  );
}

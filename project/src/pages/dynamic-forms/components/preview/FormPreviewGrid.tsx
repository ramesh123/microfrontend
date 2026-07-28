import { memo, useMemo } from 'react';
import {
  FIELD_GRID_DEFAULTS,
  groupFieldsByLayoutRow,
} from '../../lib/grid/form-builder-grid.utils';
import type { FormApiLogicStep, FormBuilderField, FormFieldValue } from '../../types';
import { FormFieldRenderer } from '../fields/FormFieldRenderer';

interface FormPreviewGridProps {
  fields: FormBuilderField[];
  interactive: boolean;
  getValue: (field: FormBuilderField) => FormFieldValue;
  onChange: (name: string, value: FormFieldValue) => void;
  onCancel?: () => void;
  apiSteps?: FormApiLogicStep[];
}

function layoutHeightPx(h: number): number {
  const { rowHeight, margin } = FIELD_GRID_DEFAULTS;
  return h * rowHeight + Math.max(0, h - 1) * margin[1];
}

export const FormPreviewGrid = memo(function FormPreviewGrid({
  fields,
  interactive,
  getValue,
  onChange,
  onCancel,
  apiSteps = [],
}: FormPreviewGridProps) {
  const rows = useMemo(() => groupFieldsByLayoutRow(fields), [fields]);

  if (rows.length === 0) return null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid w-full min-w-0 grid-cols-12 gap-x-3 sm:gap-x-4">
          {row.map(({ field, layout }) => {
            const fillsHeight = field.type === 'big_number';
            return (
              <div
                key={field.id}
                className="min-w-0"
                style={{
                  gridColumn: `${layout.x + 1} / span ${layout.w}`,
                  ...(fillsHeight ? { height: layoutHeightPx(layout.h) } : {}),
                }}
              >
                <FormFieldRenderer
                  field={field}
                  value={getValue(field)}
                  interactive={interactive}
                  onChange={onChange}
                  variant="runtime"
                  onCancel={onCancel}
                  apiSteps={apiSteps}
                  fillHeight={fillsHeight}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

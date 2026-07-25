import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormBuilderFieldOption } from '../../types';

interface OptionsEditorProps {
  options: FormBuilderFieldOption[];
  onChange: (options: FormBuilderFieldOption[]) => void;
}

function createEmptyOption(index: number): FormBuilderFieldOption {
  const num = index + 1;
  return { value: `option_${num}`, label: `Option ${num}` };
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const rows = options.length > 0 ? options : [createEmptyOption(0)];

  const updateOption = (index: number, key: 'value' | 'label', nextValue: string) => {
    const next = rows.map((option, i) =>
      i === index ? { ...option, [key]: nextValue } : option,
    );
    onChange(next);
  };

  const addOption = () => {
    onChange([...rows, createEmptyOption(rows.length)]);
  };

  const removeOption = (index: number) => {
    if (rows.length === 1) {
      onChange([createEmptyOption(0)]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Options</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={addOption}>
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-gray-border p-2">
        <div className="grid grid-cols-[1fr_1fr_28px] gap-2 px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Value</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Label</span>
          <span />
        </div>

        {rows.map((option, index) => (
          <div key={`${index}-${option.value}`} className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
            <Input
              value={option.value}
              placeholder="value"
              className="!h-7 !text-xs"
              onChange={(e) => updateOption(index, 'value', e.target.value.replace(/\s+/g, '_').toLowerCase())}
            />
            <Input
              value={option.label}
              placeholder="Label"
              className="!h-7 !text-xs"
              onChange={(e) => updateOption(index, 'label', e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeOption(index)}
              title="Remove option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

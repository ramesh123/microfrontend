import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormBuilderField } from '../../types';

const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

interface BigNumberConfigEditorProps {
  field: FormBuilderField;
  onChange: (updates: Partial<FormBuilderField>) => void;
}

export function BigNumberConfigEditor({ field, onChange }: BigNumberConfigEditorProps) {
  const color = field.bigNumberColor ?? '#3B82F6';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Value</Label>
        <Input
          value={field.bigNumberValue ?? ''}
          onChange={(e) => onChange({ bigNumberValue: e.target.value })}
          className="h-8 !text-xs"
          placeholder="e.g. 12,450"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Prefix</Label>
          <Input
            value={field.bigNumberPrefix ?? ''}
            onChange={(e) => onChange({ bigNumberPrefix: e.target.value })}
            className="h-8 !text-xs"
            placeholder="$"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Suffix</Label>
          <Input
            value={field.bigNumberSuffix ?? ''}
            onChange={(e) => onChange({ bigNumberSuffix: e.target.value })}
            className="h-8 !text-xs"
            placeholder="%"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Sub-label</Label>
        <Input
          value={field.bigNumberSubLabel ?? ''}
          onChange={(e) => onChange({ bigNumberSubLabel: e.target.value })}
          className="h-8 !text-xs"
          placeholder="vs last month"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">Accent color</Label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              title={preset}
              onClick={() => onChange({ bigNumberColor: preset })}
              className="h-6 w-6 rounded-md border border-gray-border transition-transform hover:scale-105"
              style={{
                backgroundColor: preset,
                outline: color === preset ? '2px solid var(--primary)' : undefined,
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        <Input
          value={color}
          onChange={(e) => onChange({ bigNumberColor: e.target.value })}
          className="h-8 !text-xs font-mono"
          placeholder="#3B82F6"
        />
      </div>
    </div>
  );
}

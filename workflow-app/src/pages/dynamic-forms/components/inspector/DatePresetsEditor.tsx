import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormDatePresetOption, FormDatePresetRange } from '../../types';
import {
  DATE_PRESET_RANGE_LABELS,
  createEmptyDatePreset,
  DEFAULT_DATE_PRESETS,
  presetRangeNeedsAmount,
} from '../../lib/date/form-date.utils';
import { DatePickerColorPalette } from './DatePickerColorPalette';

interface DatePresetsEditorProps {
  presets: FormDatePresetOption[];
  onChange: (presets: FormDatePresetOption[]) => void;
  allowCustomRange: boolean;
  onAllowCustomRangeChange: (value: boolean) => void;
  datePickerColor?: string;
  onDatePickerColorChange: (color: string) => void;
}

export function DatePresetsEditor({
  presets,
  onChange,
  allowCustomRange,
  onAllowCustomRangeChange,
  datePickerColor,
  onDatePickerColorChange,
}: DatePresetsEditorProps) {
  const rows = presets.length > 0 ? presets : DEFAULT_DATE_PRESETS;

  const updatePreset = (index: number, updates: Partial<FormDatePresetOption>) => {
    onChange(rows.map((preset, i) => (i === index ? { ...preset, ...updates } : preset)));
  };

  const addPreset = () => {
    onChange([...rows, createEmptyDatePreset(rows.length)]);
  };

  const removePreset = (index: number) => {
    if (rows.length === 1) {
      onChange([createEmptyDatePreset(0)]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-md border border-gray-border/60 bg-gray-surface/40 p-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">
          Color palette
        </span>
        <p className="text-[10px] leading-snug text-gray-text-muted">
          Accent for the badge, active button, and calendar.
        </p>
        <DatePickerColorPalette value={datePickerColor} onChange={onDatePickerColorChange} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Quick range buttons</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={addPreset}>
            <Plus className="h-3.5 w-3.5" />
            Add button
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-gray-text-muted">
          Short labels for preset date ranges on the picker.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-gray-border p-2">
        {rows.map((preset, index) => (
          <div key={preset.id} className="space-y-1.5 rounded-md border border-gray-border/60 bg-gray-surface/40 p-2">
            <div className="grid grid-cols-[1fr_28px] gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Button label</span>
                <Input
                  value={preset.label}
                  placeholder="TDY"
                  className="!h-7 !text-xs"
                  onChange={(e) => updatePreset(index, { label: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removePreset(index)}
                  title="Remove button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Range</span>
                <Select
                  value={preset.range}
                  onValueChange={(value) =>
                    updatePreset(index, {
                      range: value as FormDatePresetRange,
                      amount: presetRangeNeedsAmount(value as FormDatePresetRange) ? preset.amount ?? 7 : undefined,
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-full min-w-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DATE_PRESET_RANGE_LABELS) as FormDatePresetRange[]).map((range) => (
                      <SelectItem key={range} value={range}>
                        {DATE_PRESET_RANGE_LABELS[range]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {presetRangeNeedsAmount(preset.range) && (
                <div className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">Amount (N)</span>
                  <Input
                    type="number"
                    min={1}
                    value={preset.amount ?? 1}
                    className="h-7 w-full text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onChange={(e) =>
                      updatePreset(index, { amount: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5">
        <input
          type="checkbox"
          checked={allowCustomRange}
          onChange={(e) => onAllowCustomRangeChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-border"
        />
        <span className="min-w-0">
          <span className="block text-xs text-gray-text">Allow custom date range (calendar)</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-gray-text-muted">
            Show the calendar icon for a manual from/to range.
          </span>
        </span>
      </label>

      <p className="text-[10px] leading-snug text-gray-text-muted">
        For API setup steps and JSON examples, open the{' '}
        <strong className="font-medium text-gray-text">Integration</strong> tab on the canvas.
      </p>
    </div>
  );
}

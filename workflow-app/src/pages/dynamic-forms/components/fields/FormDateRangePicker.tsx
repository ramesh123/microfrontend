import { useEffect, useMemo, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatYmd, parseYmd } from '@/components/common/FlowJobsDateFilter/utils';
import { cn } from '@/lib/utils';
import type { FormDatePresetOption } from '../../types';
import {
  formatFormDateSelectionLabel,
  getDatePickerColorStyles,
  getFieldDatePresets,
  parseFormDateValue,
  resolveDatePresetRange,
  resolveFormDateActiveColor,
  serializeFormDateValue,
  type FormDateFieldValue,
} from '../../lib/date/form-date.utils';

interface FormDateRangePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'canvas' | 'runtime';
  idPrefix?: string;
  presets?: FormDatePresetOption[];
  allowCustomRange?: boolean;
  datePickerColor?: string;
}

export function FormDateRangePicker({
  value = '',
  onChange,
  disabled = false,
  variant = 'default',
  idPrefix = 'form-date',
  presets,
  allowCustomRange = true,
  datePickerColor,
}: FormDateRangePickerProps) {
  const compact = variant === 'canvas';
  const presetOptions = useMemo(() => getFieldDatePresets(presets), [presets]);
  const selection = useMemo(() => parseFormDateValue(value), [value]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isCustomRange = selection.mode === 'custom';
  const activePresetId = selection.mode === 'preset' ? selection.presetId : undefined;
  const todayYmd = formatYmd(new Date());
  const badgeLabel = formatFormDateSelectionLabel(value, presetOptions);
  const activeColor = resolveFormDateActiveColor(selection, datePickerColor);
  const pickerColor = getDatePickerColorStyles(datePickerColor);

  useEffect(() => {
    if (selection.mode === 'custom') {
      setStartDate(selection.from);
      setEndDate(selection.to);
    }
  }, [selection]);

  const emitChange = (next: FormDateFieldValue) => {
    onChange?.(serializeFormDateValue(next));
  };

  const handlePresetClick = (presetId: string) => {
    setShowDatePicker(false);
    setStartDate('');
    setEndDate('');
    emitChange({ mode: 'preset', presetId });
  };

  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = event.target.value;
    setStartDate(newStart);
    if (endDate && newStart > endDate) {
      setEndDate('');
    }
  };

  const handleDateSubmit = () => {
    const from = parseYmd(startDate);
    const to = parseYmd(endDate);
    if (!from || !to) return;
    setShowDatePicker(false);
    emitChange({ mode: 'custom', from: formatYmd(from), to: formatYmd(to) });
  };

  const seedCustomPickerDates = () => {
    if (selection.mode === 'custom') return;

    if (selection.mode === 'preset') {
      const preset = presetOptions.find((item) => item.id === selection.presetId);
      if (preset) {
        const range = resolveDatePresetRange(preset);
        setStartDate(formatYmd(range.from));
        setEndDate(formatYmd(range.to));
      }
    }
  };

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', compact && 'gap-0.5')}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {badgeLabel ? (
        <Badge
          variant="secondary"
          className={cn(
            'h-7 max-w-[min(100%,14rem)] shrink-0 truncate border px-2.5 text-xs font-medium',
            !activeColor && 'border-primary/25 bg-primary/10 text-primary'
          )}
          style={
            activeColor
              ? {
                  backgroundColor: activeColor.badgeBg,
                  borderColor: activeColor.badgeBorder,
                  color: activeColor.badgeText,
                }
              : undefined
          }
          title={badgeLabel}
        >
          {badgeLabel}
        </Badge>
      ) : null}

      {presetOptions.map((preset) => {
        const active = !isCustomRange && activePresetId === preset.id;
        const range = resolveDatePresetRange(preset);
        const tooltip = `${preset.label}: ${formatYmd(range.from)} to ${formatYmd(range.to)}`;

        return (
          <Tooltip key={preset.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={active ? undefined : 'primary'}
                size="icon"
                disabled={disabled}
                className={cn('!px-2', active && '!border !text-white hover:opacity-90')}
                style={
                  active
                    ? {
                        backgroundColor: pickerColor.main,
                        borderColor: pickerColor.main,
                      }
                    : undefined
                }
                ignoreTitleCase
                onClick={() => handlePresetClick(preset.id)}
              >
                {preset.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {allowCustomRange && (
        <Popover
          open={showDatePicker}
          onOpenChange={(open) => {
            setShowDatePicker(open);
            if (open) seedCustomPickerDates();
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={isCustomRange ? undefined : 'primary'}
                  size="icon"
                  disabled={disabled}
                  className={cn('!px-2', isCustomRange && '!border !text-white hover:opacity-90')}
                  style={
                    isCustomRange
                      ? {
                          backgroundColor: pickerColor.main,
                          borderColor: pickerColor.main,
                        }
                      : undefined
                  }
                  aria-label="Select custom date range"
                >
                  <CalendarIcon className="!h-5 w-4" strokeWidth={isCustomRange ? 2.5 : 2} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Select custom date range</p>
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            className="w-[min(100vw-2rem,380px)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
            align="start"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={`${idPrefix}-from`} className="text-sm font-medium">
                  From
                </label>
                <Input
                  id={`${idPrefix}-from`}
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  disabled={disabled}
                  max={todayYmd}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`${idPrefix}-to`} className="text-sm font-medium">
                  To
                </label>
                <Input
                  id={`${idPrefix}-to`}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={disabled}
                  min={startDate || undefined}
                  max={todayYmd}
                  className="h-9"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="ghost" className="!h-8 !w-20" disabled={disabled} onClick={() => setShowDatePicker(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="!h-8 !w-20"
                disabled={disabled || !startDate || !endDate}
                onClick={handleDateSubmit}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

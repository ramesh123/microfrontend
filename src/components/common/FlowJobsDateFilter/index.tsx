import React, { useState, useEffect, useMemo } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { TimeRange } from '@/types/jobs';
import { cn } from '@/lib/utils';
import {
  FlowDateFilterValue,
  PRESET_FILTERS,
  formatYmd,
  formatFlowDateFilterBadgeLabel,
  getPresetDateRange,
  parseYmd,
} from './utils';

export type { FlowDateFilterValue } from './utils';
export {
  formatYmd,
  parseYmd,
  formatFlowDateFilterBadgeLabel,
  getPresetDateRange,
  resolveFlowDateFilterToYmd,
  PRESET_FILTERS,
} from './utils';

interface FlowJobsDateFilterProps {
  value: FlowDateFilterValue;
  onChange: (value: FlowDateFilterValue) => void;
  isLoading?: boolean;
  /** Prefix for date input ids (accessibility). */
  idPrefix?: string;
  className?: string;
  onlyAllAndCustom?: boolean;
  /** Override preset buttons (defaults to PRESET_FILTERS). */
  presets?: typeof PRESET_FILTERS;
}



function getActivePreset(value: FlowDateFilterValue): TimeRange | undefined {
  if (value.mode === 'all') return 'all';
  if (value.mode === 'preset') return value.timeRange;
  return undefined;
}

export const FlowJobsDateFilter: React.FC<FlowJobsDateFilterProps> = ({
  value,
  onChange,
  isLoading = false,
  idPrefix = 'flow-date',
  className,
  onlyAllAndCustom = false,
  presets = PRESET_FILTERS,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isCustomRange = value.mode === 'custom';
  const activePreset = getActivePreset(value);
  const todayYmd = formatYmd(new Date());
  const dateBadgeLabel = useMemo(() => formatFlowDateFilterBadgeLabel(value), [value]);

  useEffect(() => {
    if (value.mode === 'custom') {
      setStartDate(formatYmd(value.from));
      setEndDate(formatYmd(value.to));
    }
  }, [value]);

  const handlePresetClick = (preset: TimeRange) => {
    setShowDatePicker(false);
    setStartDate('');
    setEndDate('');
    if (preset === 'all') {
      onChange({ mode: 'all' });
      return;
    }
    onChange({ mode: 'preset', timeRange: preset });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
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
    onChange({ mode: 'custom', from, to });
  };

  const seedCustomPickerDates = () => {
    if (value.mode === 'custom') return;
    if (value.mode === 'preset' && value.timeRange !== 'all') {
      const range = getPresetDateRange(value.timeRange);
      if (range) {
        setStartDate(formatYmd(range.from));
        setEndDate(formatYmd(range.to));
      }
    }
  };

  return (
    <div className={cn('relative flex flex-wrap items-center justify-end gap-1', className)}>
      {dateBadgeLabel ? (
        <Badge
          variant="secondary"
          className="h-7 max-w-[min(100%,14rem)] shrink-0 truncate border border-primary/25 bg-primary/10 px-2.5 text-xs font-medium text-primary"
          title={dateBadgeLabel}
        >
          {dateBadgeLabel}
        </Badge>
      ) : null}
      {(onlyAllAndCustom ? presets.filter((f) => f.value === 'all') : presets).map((filter) => {
        const active = !isCustomRange && activePreset === filter.value;
        return (
          <Tooltip key={filter.value}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={active ? "default" : "primary"}
              size="icon"
              disabled={isLoading}
              className="!px-2"
              ignoreTitleCase
              onClick={() => handlePresetClick(filter.value)}
            >
              {filter.label}
            </Button>
          </TooltipTrigger>
        
          <TooltipContent side="top">
            <p>{filter.tooltip}</p>
          </TooltipContent>
        </Tooltip>
        );
      })}

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
        variant={isCustomRange ? "default" : "primary"}
        size="icon"
        disabled={isLoading}
        className="!px-2"
        aria-label="Select custom date range"
      >
        <CalendarIcon
          className="!h-5 w-4"
          strokeWidth={isCustomRange ? 2.5 : 2}
        />
      </Button>
    </PopoverTrigger>
  </TooltipTrigger>

  <TooltipContent side="top">
    <p>Select date range</p>
  </TooltipContent>
</Tooltip>
        <PopoverContent
          className="mr-10 w-[min(100vw-2rem,380px)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
          align="end"
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
                disabled={isLoading}
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
                disabled={isLoading}
                min={startDate || undefined}
                max={todayYmd}
                className="h-9"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              className="!h-8 !w-20"
              disabled={isLoading}
              onClick={() => setShowDatePicker(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="!h-8 !w-20"
              disabled={isLoading || !startDate || !endDate}
              onClick={handleDateSubmit}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ColorPickerPopover } from '@/pages/WidgetsLibrary/ColorPickerPopover';
import { Plus, Trash2 } from 'lucide-react';

const DECIMAL_INPUT_PATTERN = /^-?\d*\.?\d*$/;

function formatBoundDisplay(value?: number | ''): string {
  return value !== undefined && value !== '' ? String(value) : '';
}

function parseBoundCommit(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function ValueRangeBoundInput({
  value,
  onCommit,
  placeholder,
  suffix,
}: {
  value?: number | '';
  onCommit: (next: number | undefined) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = React.useState(() => formatBoundDisplay(value));
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(formatBoundDisplay(value));
  }, [value]);

  const commitFromDraft = () => {
    const parsed = parseBoundCommit(draft);
    onCommit(parsed);
    setDraft(formatBoundDisplay(parsed));
  };

  return (
    <div className="relative min-w-0">
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        className={cn('h-8 w-full text-sm tabular-nums', suffix && 'pr-7')}
        value={draft}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '' || DECIMAL_INPUT_PATTERN.test(next)) {
            setDraft(next);
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          commitFromDraft();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export interface ValueRangeBand {
  color: string;
  minValue?: number | '';
  maxValue?: number | '';
}

function parseBandBound(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Serialize band from/to values into a comma-separated intervalBounds string
 * (unique sorted boundary points), e.g. "0,50,100".
 */
export function buildIntervalBoundsFromBands(bands: ValueRangeBand[] | null | undefined): string {
  if (!bands?.length) return '';
  const points = new Set<number>();
  for (const band of bands) {
    const min = parseBandBound(band.minValue);
    const max = parseBandBound(band.maxValue);
    if (min !== undefined) points.add(min);
    if (max !== undefined) points.add(max);
  }
  if (points.size === 0) return '';
  return [...points].sort((a, b) => a - b).join(',');
}

export function ValueRangeBandsPanel({
  boundsMode,
  onBoundsModeChange,
  bands,
  onBandsChange,
}: {
  boundsMode: 'count' | 'percent';
  onBoundsModeChange: (mode: 'count' | 'percent') => void;
  bands: ValueRangeBand[];
  onBandsChange: (nextBands: ValueRangeBand[]) => void;
}) {
  const [openPickerIndex, setOpenPickerIndex] = React.useState<number | null>(null);
  const unitSuffix = boundsMode === 'percent' ? '%' : undefined;
  const fromPlaceholder = boundsMode === 'percent' ? '0' : 'Min';
  const toPlaceholderDefault = boundsMode === 'percent' ? '100' : 'Max';

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Range type</span>
        <div className="flex rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              boundsMode === 'count'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onBoundsModeChange('count')}
          >
            Count
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              boundsMode === 'percent'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onBoundsModeChange('percent')}
          >
            Percent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_minmax(64px,1fr)_auto_auto] items-center gap-x-2 gap-y-0 border-b border-border/50 bg-muted/20 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Band</span>
        <span className="text-center">From</span>
        <span className="text-center">To</span>
        <span className="text-center">Colour</span>
        <span className="text-right">Action</span>
      </div>

      <div className="space-y-0.5 bg-slate-50/50">
        {bands.map((band, index) => {
          const label = `Band ${index + 1}`;
          return (
            <div
              key={index}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_minmax(64px,1fr)_auto_auto] items-center gap-x-2 px-2 py-2 bg-white',
                index < bands.length - 1 && 'border-b border-border/40',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: band.color }}
                  aria-hidden
                />
                <span className="truncate text-xs font-medium text-slate-700">{label}</span>
              </div>
              <ValueRangeBoundInput
                value={band.minValue}
                placeholder={fromPlaceholder}
                suffix={unitSuffix}
                onCommit={(min) => {
                  const next = [...bands];
                  next[index] = { ...next[index], minValue: min ?? '' };
                  onBandsChange(next);
                }}
              />
              <ValueRangeBoundInput
                value={band.maxValue}
                placeholder={toPlaceholderDefault}
                suffix={unitSuffix}
                onCommit={(max) => {
                  const next = [...bands];
                  next[index] = { ...next[index], maxValue: max ?? '' };
                  onBandsChange(next);
                }}
              />
              <ColorPickerPopover
                isOpen={openPickerIndex === index}
                onOpenChange={(open) => setOpenPickerIndex(open ? index : null)}
                color={band.color}
                setColor={(c) => {
                  const next = [...bands];
                  next[index] = { ...next[index], color: c };
                  onBandsChange(next);
                }}
                previewText={label}
                label={label}
                popoverSide="right"
                popoverAlign="start"
              >
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted/40"
                  aria-label={`Pick colour for ${label}`}
                >
                  <span
                    className="h-5 w-5 rounded border border-border"
                    style={{ backgroundColor: band.color }}
                  />
                </button>
              </ColorPickerPopover>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
                onClick={() => {
                  const next = bands.filter((_, i) => i !== index);
                  onBandsChange(next);
                }}
                disabled={bands.length <= 1}
                aria-label={`Delete ${label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-2 py-2 border-t border-border/60 bg-muted/10">
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-dashed border-border/80 hover:border-slate-400 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors bg-white shadow-sm"
          onClick={() => {
            const colors = ['#3182bd', '#e6550d', '#31a354', '#756bb1', '#636363', '#fd8d3c', '#74c476', '#9e9ac8'];
            const nextColor = colors[bands.length % colors.length];
            const next: ValueRangeBand[] = [...bands, { color: nextColor, minValue: '', maxValue: '' }];
            onBandsChange(next);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add Band
        </button>
      </div>
    </div>
  );
}

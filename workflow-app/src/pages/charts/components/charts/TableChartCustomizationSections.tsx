import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, X, Check, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from './bigNumber/customize/bigNumberStreamRefreshIntervals';
import { ColorPickerPopover } from '@/pages/WidgetsLibrary/ColorPickerPopover';
import type { TableBadgeRange, TableChartConfig } from './Tablechartcustomization';
import {
  cssColorToHex,
  formatBadgeBound,
  normalizeTableBadgeRanges,
  parseOptionalNumber,
} from './Tablechartcustomization';

const TABLE_CUSTOMIZE_PANEL_CLASS =
  'space-y-1.5 px-1 pb-1 w-full min-w-0 max-w-full overflow-x-hidden box-border';

export function TableCustomizePanelShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={TABLE_CUSTOMIZE_PANEL_CLASS}>
      <div className="px-1 pb-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
        {description ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function TableCustomizeCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group overflow-hidden rounded-md border border-border bg-card shadow-sm"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 border-l-[3px] px-2 py-1.5 text-left transition-colors',
            'border-l-border bg-muted/50 hover:bg-muted/70',
            'group-data-[state=open]:border-l-primary group-data-[state=open]:bg-muted/70',
            'group-data-[state=open]:border-b group-data-[state=open]:border-b-border',
          )}
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">{title}</div>
            {description ? (
              <div className="truncate text-[10px] leading-snug text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180 text-primary',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1.5 border-t border-border/60 bg-card px-2 py-1.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TableCustomizeSwatchStyles() {
  return (
    <style>{`
      .round-swatch { -webkit-appearance: none; appearance: none; padding: 0; border-radius: 9999px; }
      .round-swatch::-webkit-color-swatch-wrapper { padding: 0; border-radius: 9999px; }
      .round-swatch::-webkit-color-swatch { border: none; border-radius: 9999px; }
      .round-swatch::-moz-color-swatch { border: none; border-radius: 9999px; }
    `}</style>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1.5">
      <div className="min-w-0">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function FieldStack({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      ) : null}
      {hint ? <div className="text-[10px] leading-snug text-muted-foreground">{hint}</div> : null}
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

export function RefreshSection({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <FieldStack label="Refresh interval" hint="Automatically reload table data on this schedule">
      <Select value={String(value ?? 0)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BIG_NUMBER_STREAM_REFRESH_INTERVALS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldStack>
  );
}

export function AppearanceSection({
  value,
  onChange,
}: {
  value: TableChartConfig['appearance'];
  onChange: (p: Partial<TableChartConfig['appearance']>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Header background" hint="Color behind the column headers">
        <input
          type="color"
          value={cssColorToHex(value.headerBg)}
          onChange={(e) => onChange({ headerBg: e.target.value })}
          className="h-7 w-7 cursor-pointer rounded-md border border-input bg-transparent shadow-sm ring-1 ring-black/5"
        />
      </Row>
      <Row label="Header text color">
        <input
          type="color"
          value={cssColorToHex(value.headerTextColor)}
          onChange={(e) => onChange({ headerTextColor: e.target.value })}
          className="h-7 w-7 cursor-pointer rounded-md border border-input bg-transparent shadow-sm ring-1 ring-black/5"
        />
      </Row>
      <Row label="Striped rows" hint="Alternate row background for readability">
        <Switch checked={value.striped} onCheckedChange={(v) => onChange({ striped: v })} className="scale-90" />
      </Row>
      <Row label="Show borders" hint="Row and cell divider lines">
        <Switch checked={value.showBorder} onCheckedChange={(v) => onChange({ showBorder: v })} className="scale-90" />
      </Row>
      <FieldStack label="Density" hint="Row height and cell padding">
        <Select value={value.density} onValueChange={(v) => onChange({ density: v as 'compact' | 'comfortable' })}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
          </SelectContent>
        </Select>
      </FieldStack>
    </div>
  );
}

export function ColumnsSection({
  value,
  onChange,
  visibleCount,
  variant = 'table',
}: {
  value: TableChartConfig['columns'];
  onChange: (p: Partial<TableChartConfig['columns']>) => void;
  visibleCount: { shown: number; total: number };
  variant?: 'table' | 'pivot';
}) {
  const [badgeColumnKey, setBadgeColumnKey] = useState<string>('');
  const [openBadgePicker, setOpenBadgePicker] = useState<{ columnKey: string; index: number } | null>(null);
  const [progressColumnKey, setProgressColumnKey] = useState<string>('');
  const [progressColor, setProgressColor] = useState<string>('#6366f1');
  const [progressMax, setProgressMax] = useState<string>('100');

  const toggleColumn = (key: string, checked: boolean) => {
    const base = value.visible.length ? value.visible : value.available.map((c) => c.key);
    const next = checked ? Array.from(new Set([...base, key])) : base.filter((k) => k !== key);
    onChange({ visible: next });
  };
  const toggleFixedColumn = (key: string, checked: boolean) => {
    const base = value.fixedColumns ?? [];
    const next = checked ? Array.from(new Set([...base, key])) : base.filter((k) => k !== key);
    onChange({ fixedColumns: next });
  };

  const badgeColumnKeys = Object.keys(value.badges || {}).filter(
    (key) => normalizeTableBadgeRanges(value.badges?.[key]).length > 0,
  );

  const BADGE_BAND_COLORS = ['#22c55e', '#e6550d', '#3182bd', '#756bb1', '#636363', '#fd8d3c', '#74c476', '#9e9ac8'];

  const setBadgeRanges = (columnKey: string, ranges: TableBadgeRange[]) => {
    const badges = { ...(value.badges || {}) };
    if (ranges.length === 0) delete badges[columnKey];
    else badges[columnKey] = ranges;
    onChange({ badges });
  };

  const startBadgeColumn = () => {
    if (!badgeColumnKey) return;
    const existing = normalizeTableBadgeRanges(value.badges?.[badgeColumnKey]);
    if (existing.length > 0) return;
    setBadgeRanges(badgeColumnKey, [{ color: BADGE_BAND_COLORS[0] }]);
    setBadgeColumnKey('');
  };

  const addBadgeBand = (columnKey: string) => {
    const existing = normalizeTableBadgeRanges(value.badges?.[columnKey]);
    const nextColor = BADGE_BAND_COLORS[existing.length % BADGE_BAND_COLORS.length];
    setBadgeRanges(columnKey, [...existing, { color: nextColor }]);
  };

  const editBadgeRange = (columnKey: string, index: number, patch: Partial<TableBadgeRange>) => {
    const ranges = normalizeTableBadgeRanges(value.badges?.[columnKey]);
    if (!ranges[index]) return;
    const next = [...ranges];
    next[index] = { ...next[index], ...patch };
    setBadgeRanges(columnKey, next);
  };

  const removeBadgeRange = (columnKey: string, index: number) => {
    const ranges = normalizeTableBadgeRanges(value.badges?.[columnKey]);
    setBadgeRanges(columnKey, ranges.filter((_, i) => i !== index));
  };

  const progressBarEntries = Object.entries(value.progressBars || {});
  const columnsWithoutProgressBar = value.available.filter((c) => !value.progressBars?.[c.key]);

  const addProgressBar = () => {
    const max = Number(progressMax);
    if (!progressColumnKey || !Number.isFinite(max) || max <= 0) return;
    onChange({
      progressBars: { ...(value.progressBars || {}), [progressColumnKey]: { color: progressColor, max } },
    });
    setProgressColumnKey('');
    setProgressMax('100');
  };

  const editProgressBar = (key: string, patch: Partial<{ color: string; max: number }>) => {
    const current = value.progressBars?.[key];
    if (!current) return;
    onChange({
      progressBars: { ...(value.progressBars || {}), [key]: { ...current, ...patch } },
    });
  };

  const removeProgressBar = (key: string) => {
    const next = { ...(value.progressBars || {}) };
    delete next[key];
    onChange({ progressBars: next });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Visible columns" hint={`${visibleCount.shown} of ${visibleCount.total} shown`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Choose columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto z-[80]">
            {value.available.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {variant === 'pivot' ? 'Add rows and columns on the Data tab first' : 'No columns detected yet'}
              </div>
            )}
            {value.available.map((col) => {
              const isChecked = value.visible.length ? value.visible.includes(col.key) : true;
              return (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleColumn(col.key, !!checked)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
      <Row label="Text alignment" hint={variant === 'pivot' ? 'Applies to value cells' : 'Applies to all columns'}>
        <Select value={value.align} onValueChange={(v) => onChange({ align: v as 'left' | 'center' | 'right' })}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Freeze columns" hint={`${(value.fixedColumns ?? []).length} frozen`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Choose columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto z-[80]">
            {value.available.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {variant === 'pivot' ? 'Add rows and columns on the Data tab first' : 'No columns detected yet'}
              </div>
            )}
            {value.available.map((col) => {
              const isChecked = (value.fixedColumns ?? []).includes(col.key);
              return (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleFixedColumn(col.key, !!checked)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>

      <div className="flex flex-col gap-2 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {variant === 'pivot' ? 'Field badges' : 'Column badges'}
        </p>
        <p className="text-xs text-muted-foreground">
          Color cell values as badges. Leave From/To empty to auto-split the column from its lowest to highest value
          (same as gauge bands).
        </p>

        {badgeColumnKeys.length > 0 && (
          <div className="flex flex-col gap-2">
            {badgeColumnKeys.map((columnKey) => {
              const label = value.available.find((c) => c.key === columnKey)?.label ?? columnKey;
              const ranges = normalizeTableBadgeRanges(value.badges?.[columnKey]);
              return (
                <div key={columnKey} className="overflow-hidden rounded-md border border-border/60">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {ranges.length} band{ranges.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_minmax(64px,1fr)_auto_auto] items-center gap-x-2 border-b border-border/50 bg-muted/20 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Band</span>
                    <span className="text-center">From</span>
                    <span className="text-center">To</span>
                    <span className="text-center">Colour</span>
                    <span className="text-right">Action</span>
                  </div>

                  <div className="space-y-0.5 bg-slate-50/50">
                    {ranges.map((range, index) => {
                      const bandLabel = `Band ${index + 1}`;
                      const pickerOpen =
                        openBadgePicker?.columnKey === columnKey && openBadgePicker.index === index;
                      return (
                        <div
                          key={`${columnKey}-${index}`}
                          className={cn(
                            'grid grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_minmax(64px,1fr)_auto_auto] items-center gap-x-2 px-2 py-2 bg-white',
                            index < ranges.length - 1 && 'border-b border-border/40',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-8 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: range.color }}
                              aria-hidden
                            />
                            <span className="truncate text-xs font-medium text-slate-700">{bandLabel}</span>
                          </div>
                          <Input
                            type="number"
                            value={formatBadgeBound(range.min)}
                            placeholder="Min"
                            onChange={(e) =>
                              editBadgeRange(columnKey, index, { min: parseOptionalNumber(e.target.value) })
                            }
                            className="h-8 w-full text-sm tabular-nums"
                            aria-label={`${label} ${bandLabel} from`}
                          />
                          <Input
                            type="number"
                            value={formatBadgeBound(range.max)}
                            placeholder="Max"
                            onChange={(e) =>
                              editBadgeRange(columnKey, index, { max: parseOptionalNumber(e.target.value) })
                            }
                            className="h-8 w-full text-sm tabular-nums"
                            aria-label={`${label} ${bandLabel} to`}
                          />
                          <ColorPickerPopover
                            isOpen={pickerOpen}
                            onOpenChange={(open) => setOpenBadgePicker(open ? { columnKey, index } : null)}
                            color={cssColorToHex(range.color)}
                            setColor={(c) => editBadgeRange(columnKey, index, { color: c })}
                            previewText={bandLabel}
                            label={bandLabel}
                            popoverSide="right"
                            popoverAlign="start"
                          >
                            <button
                              type="button"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted/40"
                              aria-label={`Pick colour for ${label} ${bandLabel}`}
                            >
                              <span
                                className="h-5 w-5 rounded-full border border-border"
                                style={{ backgroundColor: range.color }}
                              />
                            </button>
                          </ColorPickerPopover>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            onClick={() => removeBadgeRange(columnKey, index)}
                            disabled={ranges.length <= 1}
                            aria-label={`Delete ${label} ${bandLabel}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-2 py-2">
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-1.5 py-1.5 border border-dashed border-border/80 hover:border-slate-400 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors bg-white shadow-sm"
                      onClick={() => addBadgeBand(columnKey)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Band
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setBadgeRanges(columnKey, [])}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {value.available.filter((c) => !badgeColumnKeys.includes(c.key)).length > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border/80 p-2">
            <Select value={badgeColumnKey} onValueChange={setBadgeColumnKey}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {value.available
                  .filter((c) => !badgeColumnKeys.includes(c.key))
                  .map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-shrink-0 text-xs"
              disabled={!badgeColumnKey}
              onClick={startBadgeColumn}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
      </div>

      {variant !== 'pivot' && (
        <div className="flex flex-col gap-2 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress bars</p>
          <p className="text-xs text-muted-foreground">
            Render a column's numeric values as a progress bar instead of plain text
          </p>

          {progressBarEntries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {progressBarEntries.map(([key, cfg]) => {
                const label = value.available.find((c) => c.key === key)?.label ?? key;
                return (
                  <div key={key} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                    <span className="text-xs text-foreground min-w-0 truncate flex-1">{label}</span>
                    <Input
                      type="number"
                      min={1}
                      value={cfg.max}
                      onChange={(e) => {
                        const max = Number(e.target.value);
                        if (Number.isFinite(max) && max > 0) editProgressBar(key, { max });
                      }}
                      className="h-7 w-16 text-xs"
                      aria-label={`Edit ${label} progress bar max`}
                    />
                    <input
                      type="color"
                      value={cfg.color}
                      onChange={(e) => editProgressBar(key, { color: e.target.value })}
                      className="round-swatch h-7 w-7 cursor-pointer border border-input bg-transparent shadow-sm ring-1 ring-black/5 flex-shrink-0"
                      aria-label={`Edit ${label} progress bar color`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={() => removeProgressBar(key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {columnsWithoutProgressBar.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={progressColumnKey} onValueChange={setProgressColumnKey}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columnsWithoutProgressBar.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={progressMax}
                onChange={(e) => setProgressMax(e.target.value)}
                placeholder="Max"
                className="h-8 w-16 text-xs"
              />
              <input
                type="color"
                value={progressColor}
                onChange={(e) => setProgressColor(e.target.value)}
                className="round-swatch h-8 w-8 cursor-pointer border border-input bg-transparent shadow-sm ring-1 ring-black/5"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-emerald-600 hover:text-emerald-700"
                disabled={!progressColumnKey || !progressMax}
                onClick={addProgressBar}
                aria-label="Add progress bar"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaginationSection({
  value,
  onChange,
}: {
  value: TableChartConfig['pagination'];
  onChange: (p: Partial<TableChartConfig['pagination']>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Enable pagination" hint="Off shows all rows in one scroll">
        <Switch checked={value.enabled} onCheckedChange={(v) => onChange({ enabled: v })} className="scale-90" />
      </Row>
      <FieldStack label="Default page size" hint="Rows shown per page">
        <Select
          value={String(value.pageSize)}
          onValueChange={(v) => onChange({ pageSize: Number(v) })}
          disabled={!value.enabled}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {value.pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldStack>
      <FieldStack label="Page size options" hint="Comma separated, e.g. 10, 20, 50, 100">
        <Input
          className="h-8 w-full text-xs"
          disabled={!value.enabled}
          defaultValue={value.pageSizeOptions.join(', ')}
          onBlur={(e) => {
            const parsed = e.target.value
              .split(',')
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n) && n > 0);
            if (parsed.length) onChange({ pageSizeOptions: parsed });
          }}
        />
      </FieldStack>
    </div>
  );
}

export function SortingFilteringSection({
  value,
  columns,
  onChange,
}: {
  value: TableChartConfig['sortingFiltering'];
  columns: { key: string; label: string }[];
  onChange: (p: Partial<TableChartConfig['sortingFiltering']>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Sortable columns" hint="Click a header to sort">
        <Switch checked={value.sortable} onCheckedChange={(v) => onChange({ sortable: v })} className="scale-90" />
      </Row>
      <Row label="Filterable columns" hint="Show per-column filter icon">
        <Switch checked={value.filterable} onCheckedChange={(v) => onChange({ filterable: v })} className="scale-90" />
      </Row>
      <FieldStack label="Default sort column">
        <Select
          value={value.defaultSortColumn ?? 'none'}
          onValueChange={(v) => onChange({ defaultSortColumn: v === 'none' ? null : v })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {columns.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldStack>
      <FieldStack label="Default sort direction">
        <Select
          value={value.defaultSortDir}
          onValueChange={(v) => onChange({ defaultSortDir: v as 'asc' | 'desc' })}
          disabled={!value.defaultSortColumn}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
      </FieldStack>
    </div>
  );
}

export function TypographySection({
  value,
  onChange,
}: {
  value: TableChartConfig['typography'];
  onChange: (p: Partial<TableChartConfig['typography']>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Header font size" hint={`${value.headerFontSize}px`}>
        <input
          type="range"
          min={10}
          max={16}
          step={1}
          value={value.headerFontSize}
          onChange={(e) => onChange({ headerFontSize: Number(e.target.value) })}
          className="w-32"
        />
      </Row>
      <Row label="Cell font size" hint={`${value.cellFontSize}px`}>
        <input
          type="range"
          min={11}
          max={18}
          step={1}
          value={value.cellFontSize}
          onChange={(e) => onChange({ cellFontSize: Number(e.target.value) })}
          className="w-32"
        />
      </Row>
      <FieldStack label="Header weight">
        <Select
          value={value.headerFontWeight}
          onValueChange={(v) => onChange({ headerFontWeight: v as 'normal' | 'medium' | 'semibold' })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="semibold">Semibold</SelectItem>
          </SelectContent>
        </Select>
      </FieldStack>
    </div>
  );
}

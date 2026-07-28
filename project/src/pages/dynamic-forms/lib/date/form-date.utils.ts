import { addDays, format } from 'date-fns';
import { formatYmd, parseYmd } from '@/components/common/FlowJobsDateFilter/utils';
import { hexToRgb, normalizeHex, rgbToHex } from '@/pages/WidgetsLibrary/colorPickerUtils';
import type {
  FormDatePresetColorId,
  FormDatePresetOption,
  FormDatePresetRange,
} from '../../types';

export interface DatePresetColorDefinition {
  id: FormDatePresetColorId;
  label: string;
  main: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const DATE_PRESET_COLOR_OPTIONS: DatePresetColorDefinition[] = [
  {
    id: 'blue',
    label: 'Blue',
    main: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.12)',
    badgeBorder: 'rgba(59, 130, 246, 0.28)',
    badgeText: '#2563eb',
  },
  {
    id: 'green',
    label: 'Green',
    main: '#22c55e',
    badgeBg: 'rgba(34, 197, 94, 0.12)',
    badgeBorder: 'rgba(34, 197, 94, 0.28)',
    badgeText: '#16a34a',
  },
  {
    id: 'orange',
    label: 'Orange',
    main: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.12)',
    badgeBorder: 'rgba(249, 115, 22, 0.28)',
    badgeText: '#ea580c',
  },
  {
    id: 'purple',
    label: 'Purple',
    main: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    badgeBorder: 'rgba(168, 85, 247, 0.28)',
    badgeText: '#9333ea',
  },
  {
    id: 'red',
    label: 'Red',
    main: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.12)',
    badgeBorder: 'rgba(239, 68, 68, 0.28)',
    badgeText: '#dc2626',
  },
  {
    id: 'teal',
    label: 'Teal',
    main: '#14b8a6',
    badgeBg: 'rgba(20, 184, 166, 0.12)',
    badgeBorder: 'rgba(20, 184, 166, 0.28)',
    badgeText: '#0d9488',
  },
  {
    id: 'pink',
    label: 'Pink',
    main: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    badgeBorder: 'rgba(236, 72, 153, 0.28)',
    badgeText: '#db2777',
  },
  {
    id: 'gray',
    label: 'Gray',
    main: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.12)',
    badgeBorder: 'rgba(100, 116, 139, 0.28)',
    badgeText: '#475569',
  },
];

export const DEFAULT_DATE_PICKER_COLOR = '#3B82F6';

const LEGACY_COLOR_ID_TO_HEX = Object.fromEntries(
  DATE_PRESET_COLOR_OPTIONS.map((option) => [option.id, normalizeHex(option.main)])
) as Record<FormDatePresetColorId, string>;

export const DEFAULT_DATE_PRESETS: FormDatePresetOption[] = [
  { id: 'today', label: 'TDY', range: 'today' },
  { id: 'yesterday', label: 'YDY', range: 'yesterday' },
  { id: 'last_7_days', label: '1W', range: 'last_days', amount: 7 },
  { id: 'last_15_days', label: '15D', range: 'last_days', amount: 15 },
  { id: 'last_30_days', label: '1M', range: 'last_days', amount: 30 },
  { id: 'last_90_days', label: '3M', range: 'last_days', amount: 90 },
];

function darkenHex(hex: string, amount = 0.18): string {
  const { r, g, b } = hexToRgb(normalizeHex(hex));
  const factor = 1 - amount;
  return rgbToHex({
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor),
  });
}

export function resolveDatePickerColor(value?: string): string {
  if (!value) return DEFAULT_DATE_PICKER_COLOR;
  if (value.startsWith('#')) return normalizeHex(value);
  const legacy = LEGACY_COLOR_ID_TO_HEX[value as FormDatePresetColorId];
  if (legacy) return legacy;
  return DEFAULT_DATE_PICKER_COLOR;
}

export function getDatePickerColorStyles(color?: string): DatePresetColorDefinition {
  const resolved = resolveDatePickerColor(color);
  const preset = DATE_PRESET_COLOR_OPTIONS.find(
    (option) => normalizeHex(option.main) === resolved
  );
  if (preset) return preset;

  const rgb = hexToRgb(resolved);
  return {
    id: 'blue',
    label: resolved,
    main: resolved,
    badgeBg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    badgeBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
    badgeText: darkenHex(resolved),
  };
}

export type FormDateFieldValue =
  | { mode: 'empty' }
  | { mode: 'preset'; presetId: string }
  | { mode: 'custom'; from: string; to: string };

const LEGACY_TIME_RANGE_TO_PRESET_ID: Record<string, string> = {
  today: 'today',
  yesterday: 'yesterday',
  last_7_days: 'last_7_days',
  last_15_days: 'last_15_days',
  last_30_days: 'last_30_days',
  last_90_days: 'last_90_days',
};

export function getFieldDatePresets(presets?: FormDatePresetOption[]): FormDatePresetOption[] {
  return presets?.length ? presets : DEFAULT_DATE_PRESETS;
}

export function resolveFormDateActiveColor(
  selection: FormDateFieldValue,
  datePickerColor?: string
): DatePresetColorDefinition | null {
  if (selection.mode === 'empty') return null;
  return getDatePickerColorStyles(datePickerColor);
}

export function resolveDatePresetRange(preset: FormDatePresetOption): { from: Date; to: Date } {
  const to = new Date();

  switch (preset.range) {
    case 'today':
      return { from: new Date(), to };
    case 'yesterday': {
      const day = addDays(new Date(), -1);
      return { from: day, to: day };
    }
    case 'last_days':
      return { from: addDays(new Date(), -(preset.amount ?? 7)), to };
    case 'last_weeks':
      return { from: addDays(new Date(), -(preset.amount ?? 1) * 7), to };
    case 'last_months':
      return { from: addDays(new Date(), -(preset.amount ?? 1) * 30), to };
    default:
      return { from: addDays(new Date(), -7), to };
  }
}

export function parseFormDateValue(raw: string | undefined | null): FormDateFieldValue {
  if (!raw?.trim()) return { mode: 'empty' };

  try {
    const parsed = JSON.parse(raw) as {
      mode?: string;
      presetId?: string;
      timeRange?: string;
      from?: string;
      to?: string;
    };

    if (parsed.mode === 'preset') {
      const presetId = parsed.presetId ?? (parsed.timeRange ? LEGACY_TIME_RANGE_TO_PRESET_ID[parsed.timeRange] : undefined);
      if (presetId) return { mode: 'preset', presetId };
    }

    if (parsed.mode === 'custom' && parsed.from && parsed.to) {
      const from = parseYmd(parsed.from);
      const to = parseYmd(parsed.to);
      if (from && to) {
        return { mode: 'custom', from: formatYmd(from), to: formatYmd(to) };
      }
    }
  } catch {
    const legacy = parseYmd(raw);
    if (legacy) {
      const ymd = formatYmd(legacy);
      return { mode: 'custom', from: ymd, to: ymd };
    }
  }

  return { mode: 'empty' };
}

export function serializeFormDateValue(value: FormDateFieldValue): string {
  if (value.mode === 'empty') return '';
  if (value.mode === 'preset') {
    return JSON.stringify({ mode: 'preset', presetId: value.presetId });
  }
  return JSON.stringify({ mode: 'custom', from: value.from, to: value.to });
}

export function isFormDateValueEmpty(raw: string | undefined | null): boolean {
  return parseFormDateValue(raw).mode === 'empty';
}

/** Normalize API payloads into the date picker stored JSON string. */
export function coerceApiResponseToDateFieldValue(raw: unknown): string {
  if (raw == null || raw === '') return '';

  if (typeof raw === 'string') {
    const existing = parseFormDateValue(raw);
    if (existing.mode !== 'empty') return serializeFormDateValue(existing);

    try {
      return coerceApiResponseToDateFieldValue(JSON.parse(raw));
    } catch {
      const day = parseYmd(raw);
      if (day) {
        const ymd = formatYmd(day);
        return serializeFormDateValue({ mode: 'custom', from: ymd, to: ymd });
      }
    }
    return '';
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;

    if (obj.mode === 'preset' && typeof obj.presetId === 'string') {
      return serializeFormDateValue({ mode: 'preset', presetId: obj.presetId });
    }

    if (typeof obj.presetId === 'string' && !obj.from) {
      return serializeFormDateValue({ mode: 'preset', presetId: obj.presetId });
    }

    if (obj.from != null && obj.to != null) {
      const from = parseYmd(String(obj.from));
      const to = parseYmd(String(obj.to));
      if (from && to) {
        return serializeFormDateValue({
          mode: 'custom',
          from: formatYmd(from),
          to: formatYmd(to),
        });
      }
    }
  }

  return '';
}

/** Shape sent when the form is submitted (use field key as the JSON property name). */
export function formatDateFieldForApi(raw: string | undefined | null): Record<string, unknown> | null {
  const value = parseFormDateValue(raw);
  if (value.mode === 'empty') return null;
  if (value.mode === 'preset') return { mode: 'preset', presetId: value.presetId };
  return { mode: 'custom', from: value.from, to: value.to };
}

function formatDisplayDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

function formatCompactRange(from: Date, to: Date): string {
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate();
  if (sameDay) return formatDisplayDate(from);
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromStr = format(from, sameYear ? 'MMM d' : 'MMM d, yyyy');
  const toStr = format(to, 'MMM d, yyyy');
  return `${fromStr} – ${toStr}`;
}

export function formatFormDateSelectionLabel(
  raw: string | undefined | null,
  presets?: FormDatePresetOption[],
): string | null {
  const value = parseFormDateValue(raw);
  if (value.mode === 'empty') return null;

  if (value.mode === 'custom') {
    const from = parseYmd(value.from);
    const to = parseYmd(value.to);
    if (from && to) return formatCompactRange(from, to);
    return `${value.from} – ${value.to}`;
  }

  const preset = getFieldDatePresets(presets).find((item) => item.id === value.presetId);
  if (!preset) return value.presetId;

  const range = resolveDatePresetRange(preset);
  return `${preset.label} · ${formatCompactRange(range.from, range.to)}`;
}

export function createEmptyDatePreset(index: number): FormDatePresetOption {
  return {
    id: `preset_${crypto.randomUUID().slice(0, 8)}`,
    label: `R${index + 1}`,
    range: 'last_days',
    amount: 7,
  };
}

export const DATE_PRESET_RANGE_LABELS: Record<FormDatePresetRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_days: 'Last N days',
  last_weeks: 'Last N weeks',
  last_months: 'Last N months',
};

export function presetRangeNeedsAmount(range: FormDatePresetRange): boolean {
  return range === 'last_days' || range === 'last_weeks' || range === 'last_months';
}

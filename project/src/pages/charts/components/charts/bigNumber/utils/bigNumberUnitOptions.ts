import type { BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';

export type BigNumberNumberFormat = NonNullable<BigNumberCustomizationOptions['numberFormat']>;
export type BigNumberCurrencyFormat = NonNullable<BigNumberCustomizationOptions['currencyFormat']>;
export type BigNumberFontSizeOption = NonNullable<BigNumberCustomizationOptions['bigNumberFontSize']>;

export type BigNumberMetricFormatOptions = {
  numberFormat?: BigNumberNumberFormat;
  currencyFormat?: BigNumberCurrencyFormat;
  currencyCode?: string;
  fontSize?: BigNumberFontSizeOption;
};

export type BigNumberMetricDescriptor = {
  key: string;
  label: string;
  index: number;
};

function cleanMetricColumnName(value: string): string {
  return value.replace(/\(.*\)/, '').trim();
}

/** Stable key for per-metric customization (column name, not display index). */
export function getBigNumberMetricKey(
  metric: { columns?: string; column?: string; name?: string } | string | undefined,
  index: number,
): string {
  if (typeof metric === 'string') {
    const cleaned = cleanMetricColumnName(metric);
    return (cleaned || `METRIC_${index}`).toUpperCase();
  }
  const col = metric?.columns || metric?.column || metric?.name;
  if (col) return cleanMetricColumnName(String(col)).toUpperCase();
  return `METRIC_${index}`;
}

/** Prefer alias for customize panel labels and chart headers. */
export function getBigNumberMetricLabel(
  metric: { alias?: string; columns?: string; column?: string; name?: string } | string | undefined,
  index: number,
): string {
  if (typeof metric === 'string') return metric;
  if (metric?.alias?.trim()) return metric.alias.trim();
  const col = metric?.columns || metric?.column || metric?.name;
  if (col) return cleanMetricColumnName(String(col));
  return `Metric ${index + 1}`;
}

export function buildBigNumberMetricDescriptors(
  metrics: Array<{ alias?: string; columns?: string; column?: string; name?: string } | string>,
): BigNumberMetricDescriptor[] {
  return metrics.map((metric, index) => ({
    key: getBigNumberMetricKey(metric, index),
    label: getBigNumberMetricLabel(metric, index),
    index,
  }));
}

export const BIG_NUMBER_UNIT_PRESETS: Array<{ value: string; label: string; symbol: string }> = [
  { value: 'none', label: 'None', symbol: '' },
  { value: 'USD', label: '$ (USD)', symbol: '$' },
  { value: 'EUR', label: '€ (EUR)', symbol: '€' },
  { value: 'GBP', label: '£ (GBP)', symbol: '£' },
  { value: 'INR', label: '₹ (INR)', symbol: '₹' },
  { value: 'Energy', label: 'MWh (Energy)', symbol: 'MWh' },
  { value: 'Power', label: 'MW (Power)', symbol: 'MW' },
  { value: 'Irradiance', label: 'W/m² (Irradiance)', symbol: 'W/m²' },
  { value: 'Efficiency', label: '% (Efficiency)', symbol: '%' },
  { value: 'kWh', label: 'kWh', symbol: 'kWh' },
  { value: 'Custom', label: 'Custom text…', symbol: '' },
];

export function resolveUnitSymbol(code: string | undefined): string {
  if (!code || code === 'none') return '';
  const preset = BIG_NUMBER_UNIT_PRESETS.find((p) => p.value === code);
  if (preset && preset.value !== 'Custom') return preset.symbol || preset.value;
  return code;
}

export function resolveMetricFormatOptions(
  customOptions: BigNumberCustomizationOptions,
  metricIndex: number,
  metricKey?: string,
): BigNumberMetricFormatOptions & {
  numberFormat: BigNumberNumberFormat;
  currencyFormat: BigNumberCurrencyFormat;
  currencyCode: string;
} {
  const byKey = metricKey ? customOptions.metricFormatsByKey?.[metricKey] : undefined;
  const byIndex = customOptions.metricFormats?.[metricIndex];
  const per = byKey ?? byIndex;

  const hasExplicitPerUnit = per?.currencyCode !== undefined && per.currencyCode !== '';
  const hasExplicitPerFormat = per?.currencyFormat !== undefined;
  const globalFormat = customOptions.currencyFormat ?? 'none';

  let currencyFormat: BigNumberCurrencyFormat;
  if (hasExplicitPerFormat) {
    currencyFormat = per!.currencyFormat!;
  } else if (hasExplicitPerUnit) {
    currencyFormat = globalFormat !== 'none' ? globalFormat : 'suffix';
  } else {
    currencyFormat = globalFormat;
  }

  let currencyCode: string;
  if (per?.currencyCode !== undefined) {
    currencyCode = per.currencyCode;
  } else {
    currencyCode = customOptions.currencyCode ?? '';
  }

  return {
    numberFormat: per?.numberFormat ?? customOptions.numberFormat ?? 'raw',
    currencyFormat,
    currencyCode,
    fontSize: per?.fontSize ?? customOptions.bigNumberFontSize,
  };
}

export function resolveBigNumberFontPx(
  size: BigNumberFontSizeOption | undefined,
  context: 'kpiPrimary' | 'kpiFooter' | 'multi' | 'single',
): string {
  const s = size ?? 'normal';
  if (context === 'kpiPrimary') {
    if (s === 'large') return '40px';
    if (s === 'small') return '22px';
    return '32px';
  }
  if (context === 'kpiFooter') {
    if (s === 'large') return '15px';
    if (s === 'small') return '10px';
    return '13px';
  }
  if (context === 'multi') {
    if (s === 'large') return '40px';
    if (s === 'small') return '16px';
    return '22px';
  }
  if (s === 'large') return '64px';
  if (s === 'small') return '20px';
  return '28px';
}

export type BigNumberSubheaderFontContext = 'default' | 'kpi';

export function resolveBigNumberSubheaderFontPx(
  options: Pick<BigNumberCustomizationOptions, 'subheaderFontSize' | 'subheaderFontSizePx'>,
  context: BigNumberSubheaderFontContext = 'default',
): string {
  if (options.subheaderFontSizePx != null && Number.isFinite(options.subheaderFontSizePx)) {
    return `${Math.round(options.subheaderFontSizePx)}px`;
  }
  const subheaderSize = options.subheaderFontSize ?? 'large';
  if (context === 'kpi') {
    if (subheaderSize === 'large') return '11px';
    if (subheaderSize === 'small') return '9px';
    return '10px';
  }
  if (subheaderSize === 'large') return '16px';
  if (subheaderSize === 'small') return '11px';
  return '13px';
}

export function resolveBigNumberValueFontPx(
  options: Pick<BigNumberCustomizationOptions, 'bigNumberFontSize' | 'bigNumberFontSizePx'>,
  context: 'kpiPrimary' | 'kpiFooter' | 'multi' | 'single',
  presetSize?: BigNumberFontSizeOption,
): string {
  if (options.bigNumberFontSizePx != null && Number.isFinite(options.bigNumberFontSizePx)) {
    return `${Math.round(options.bigNumberFontSizePx)}px`;
  }
  return resolveBigNumberFontPx(presetSize ?? options.bigNumberFontSize, context);
}

export function parseTypographyPx(px: string): number {
  const parsed = Number.parseFloat(px);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Shrink font when formatted value is long (keeps values inside KPI cards). */
export function scaleFontSizeForFormattedValue(
  baseFontPx: string,
  formattedValue: string,
  enabled: boolean | undefined,
): string {
  if (!enabled) return baseFontPx;
  const base = Number.parseFloat(baseFontPx);
  if (!Number.isFinite(base) || base <= 0) return baseFontPx;

  const len = formattedValue.length;
  if (len <= 8) return baseFontPx;
  if (len <= 12) return `${Math.max(base * 0.88, 11)}px`;
  if (len <= 16) return `${Math.max(base * 0.74, 10)}px`;
  if (len <= 20) return `${Math.max(base * 0.62, 9)}px`;
  return `${Math.max(base * 0.52, 8)}px`;
}

/** Footer metrics step down in size (left → right), like gauge band segments. */
export function stepDownFooterFontPx(baseFontPx: string, index: number, enabled: boolean | undefined): string {
  if (!enabled) return baseFontPx;
  const base = Number.parseFloat(baseFontPx);
  if (!Number.isFinite(base) || base <= 0) return baseFontPx;
  const factors = [1, 0.92, 0.84, 0.76, 0.68];
  const factor = factors[Math.min(index, factors.length - 1)];
  return `${Math.max(base * factor, 9)}px`;
}

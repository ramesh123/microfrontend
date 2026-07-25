import type { BigNumberMetricConfig, BigNumberChartItem, BigNumberMetricDisplay } from './bigNumberMultiMetricData';
import { formatBigNumberValue, type BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';
import {
  getBigNumberMetricKey,
  getBigNumberMetricLabel,
  resolveMetricFormatOptions,
} from './bigNumberUnitOptions';

function isNumericValue(val: unknown): boolean {
  return (
    (typeof val === 'number' && !Number.isNaN(val)) ||
    (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val)))
  );
}

export function resolveMetricConfigIndex(
  item: BigNumberChartItem,
  metrics: BigNumberMetricConfig[] | undefined,
  fallbackIndex: number,
): number {
  if (typeof item.metricConfigIndex === 'number' && item.metricConfigIndex >= 0) {
    return item.metricConfigIndex;
  }
  if (item.metricKey && metrics?.length) {
    const byKey = metrics.findIndex((metric, index) => getBigNumberMetricKey(metric, index) === item.metricKey);
    if (byKey >= 0) return byKey;
  }
  if (item.alias?.trim() && metrics?.length) {
    const byAlias = metrics.findIndex((metric) => metric.alias?.trim() === item.alias?.trim());
    if (byAlias >= 0) return byAlias;
  }
  return fallbackIndex;
}

export function getBigNumberMetricDisplay(
  item: BigNumberChartItem,
  index: number,
  metrics: BigNumberMetricConfig[] | undefined,
  customOptions: BigNumberCustomizationOptions,
): BigNumberMetricDisplay {
  const metricConfigIndex = resolveMetricConfigIndex(item, metrics, index);
  const metric = metrics?.[metricConfigIndex];
  const metricKey =
    item.metricKey ?? (metric ? getBigNumberMetricKey(metric, metricConfigIndex) : undefined);

  let value: number | string;
  if (typeof item.value === 'number' && !Number.isNaN(item.value)) {
    value = item.value;
  } else {
    const row = item as Record<string, unknown>;
    const keys = Object.keys(row);
    const valueKey =
      keys.find((key) => isNumericValue(row[key]) && key.includes('(')) ||
      keys.find((key) => isNumericValue(row[key]) && key !== 'category') ||
      keys.find((key) => key.includes('(') && key !== 'category') ||
      keys.find((key) => key === 'value' && isNumericValue(row[key]));

    const rawValue = valueKey ? row[valueKey] : row.value ?? row.category ?? 'N/A';
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    value = !Number.isNaN(numericValue) && rawValue !== 'N/A' ? numericValue : String(rawValue);
  }

  let finalLabel = item.alias?.trim();
  if (!finalLabel && metric?.alias?.trim()) finalLabel = metric.alias.trim();
  if (!finalLabel && item.category && item.category.trim() !== '' && item.category !== 'value') {
    finalLabel = item.category.replace(/\(.*\)/, '').trim();
  }
  if (!finalLabel && metric) finalLabel = getBigNumberMetricLabel(metric, metricConfigIndex);
  if (!finalLabel || finalLabel.trim() === '') finalLabel = `Value ${index + 1}`;

  const formatOpts = resolveMetricFormatOptions(customOptions, metricConfigIndex, metricKey);
  const formattedValue =
    typeof value === 'number' ? formatBigNumberValue(value, formatOpts) : String(value);

  return {
    label: finalLabel,
    value,
    formattedValue,
    metricIndex: metricConfigIndex,
    metricKey,
  };
}

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode, type RefObject } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TrendingDown, TrendingUp, Minus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
} from 'recharts';
import { formatBigNumberValue, resolveBigNumberFontWeight } from '../customize/BigNumberCustmizechart';
import type { BigNumberStreamCustomizationOptions } from '../customize/BigNumberStreamCustomizePanel';
import { defaultStreamOptions } from '../customize/BigNumberStreamCustomizePanel';
import {
  buildBigNumberCardSurfaceStyles,
} from '../utils/bigNumberCardColors';
import { resolveValueRangeColorForValue } from '../../shared/bigNumberValueRangeColors';
import { resolveBigNumberSubheaderFontPx, resolveBigNumberValueFontPx } from '../utils/bigNumberUnitOptions';
import { BigNumberKpiIcon } from './BigNumberKpiIcon';
import { BigNumberDraggableKpiIcon } from './BigNumberDraggableKpiIcon';
import { hasKpiIconSource, resolveKpiIconSizePx } from '../utils/bigNumberKpiIconUtils';
import { resolveFreeIconPosition } from '../utils/bigNumberFreeIconPosition';
import { BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS } from '../utils/bigNumberStreamCustomizationPayload';
import {
  DEFAULT_HEADER_POSITION,
  DEFAULT_ICON_POSITION,
  DEFAULT_VALUE_POSITION,
  elementPositionAlignClass,
  elementPositionGridClass,
  normalizeElementPosition,
  shouldUsePositionGridLayout,
  type BigNumberElementPosition,
} from '../utils/bigNumberStreamLayout';
import { useBigNumberContainerScale } from './useBigNumberContainerScale';
import { useFreeIconHeaderInset } from './useFreeIconHeaderInset';
import { scalePaddingValue, scalePxNumber, scalePxValue } from '../utils/bigNumberResponsiveScale';

interface BigNumberStreamChartProps {
  data: Array<{ category: string; value: number; originalData?: any }>;
  config?: any;
  customizationOptions?: BigNumberStreamCustomizationOptions | null;
  useSavedCustomizationOnly?: boolean;
  rawResponse?: { data?: Array<Record<string, any>>; columns?: string[]; x_axis?: string } | null;
}

type PositionedBlock = {
  key: string;
  position: BigNumberElementPosition;
  node: ReactNode;
};

function groupBlocksByPosition(blocks: PositionedBlock[]): Map<BigNumberElementPosition, PositionedBlock[]> {
  const grouped = new Map<BigNumberElementPosition, PositionedBlock[]>();
  for (const block of blocks) {
    const list = grouped.get(block.position) ?? [];
    list.push(block);
    grouped.set(block.position, list);
  }
  return grouped;
}

type StreamClassicHeaderBandProps = {
  options: BigNumberStreamCustomizationOptions;
  iconSizePx: number;
  useFreeIcon: boolean;
  iconOnLeft: boolean;
  iconNode: ReactNode;
  headerTitleRow: ReactNode;
  valueBlock: ReactNode;
  measureRef: RefObject<HTMLElement | null>;
};

function StreamClassicHeaderBand({
  options,
  iconSizePx,
  useFreeIcon,
  iconOnLeft,
  iconNode,
  headerTitleRow,
  valueBlock,
  measureRef,
}: StreamClassicHeaderBandProps) {
  const headerInset = useFreeIconHeaderInset(options, measureRef, iconSizePx, useFreeIcon);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <div
        className="mb-2 flex w-full min-w-0 items-start gap-1"
        style={headerInset > 0 ? { paddingLeft: headerInset } : undefined}
      >
        {!useFreeIcon && iconOnLeft ? iconNode : null}
        <div className="min-w-0 flex-1 basis-0 grow overflow-hidden">{headerTitleRow}</div>
        {!useFreeIcon && !iconOnLeft ? iconNode : null}
      </div>
      {valueBlock}
    </div>
  );
}

/** Derive min/max from generated series values (no manual user input). */
function computeAutoValueRange(values: number[], currentValue: number): { min: number; max: number } {
  if (values.length > 1) {
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    if (dataMax > dataMin) return { min: dataMin, max: dataMax };
  }
  if (currentValue >= 0) return { min: 0, max: Math.max(currentValue, 1) };
  return { min: Math.min(currentValue, -1), max: 0 };
}

function mergeStreamOptions(
  ...sources: Array<BigNumberStreamCustomizationOptions | null | undefined>
): BigNumberStreamCustomizationOptions {
  return {
    ...defaultStreamOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };
}

function isAggregatedColumn(key: string): boolean {
  return key.includes('(') && key.includes(')');
}

function extractNumericSeries(
  rows: Array<Record<string, any>>,
  xAxis?: string | null,
): number[] {
  if (!rows.length) return [];

  const values: number[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const aggregatedKey = keys.find(
      (k) => isAggregatedColumn(k) && typeof row[k] === 'number' && !Number.isNaN(row[k]),
    );
    let valueKey = aggregatedKey;
    if (!valueKey) {
      valueKey = keys.find((k) => {
        if (xAxis && k === xAxis) return false;
        const val = row[k];
        return typeof val === 'number' && !Number.isNaN(val);
      });
    }
    if (valueKey) values.push(Number(row[valueKey]));
  }
  return values;
}

function formatValueWithOptions(v: number, opts: BigNumberStreamCustomizationOptions): string {
  return formatBigNumberValue(v, opts);
}

function resolveLabel(
  item: any,
  index: number,
  config?: any,
  valueKey?: string,
): string {
  const keys = Object.keys(item || {});
  let fieldName: string | undefined;
  let aliasName: string | undefined;

  if (config?.metrics && Array.isArray(config.metrics)) {
    const metric = config.metrics.find((m: any) => {
      const metricCol = m.columns || m.name;
      const cleanedValueKey = valueKey ? valueKey.replace(/\(.*\)/, '').trim() : '';
      const cleanedMetricCol = metricCol ? metricCol.replace(/\(.*\)/, '').trim() : '';
      return (
        metricCol === valueKey ||
        valueKey?.includes(metricCol) ||
        metricCol === item.category ||
        (cleanedValueKey &&
          cleanedMetricCol &&
          cleanedValueKey.toUpperCase() === cleanedMetricCol.toUpperCase())
      );
    });
    if (metric) {
      fieldName = (metric.columns || metric.name || '').replace(/\(.*\)/, '').trim();
      if (metric.alias) aliasName = String(metric.alias);
      else if (metric.name) aliasName = String(metric.name);
    }
  }

  if (!fieldName && valueKey) {
    fieldName = valueKey.replace(/\(.*\)/, '').trim();
  }

  if (!fieldName && item?.originalData) {
    const originalKeys = Object.keys(item.originalData);
    const numericKey = originalKeys.find((key) => typeof item.originalData[key] === 'number');
    if (numericKey) fieldName = numericKey.replace(/\(.*\)/, '').trim();
  }

  if (!aliasName && item?.originalData) {
    if (item.originalData.alias) aliasName = item.originalData.alias;
    else if (item.originalData.metric_alias) aliasName = item.originalData.metric_alias;
  }

  if (!aliasName && item?.alias) aliasName = item.alias;

  let finalLabel = aliasName;

  if (!finalLabel && item?.category && item.category.trim() !== '' && item.category !== 'value') {
    finalLabel = item.category.replace(/\(.*\)/, '').trim();
  }

  if (!finalLabel) finalLabel = fieldName;

  if (!finalLabel && valueKey) {
    finalLabel = valueKey.replace(/\(.*\)/, '').trim();
  }

  if (!finalLabel) {
    const allKeys = Object.keys(item || {});
    const fieldKey = allKeys.find(
      (key) =>
        key !== 'value' && key !== 'category' && key !== 'originalData' && typeof item[key] === 'number',
    );
    if (fieldKey) finalLabel = fieldKey.replace(/\(.*\)/, '').trim();
  }

  if (!finalLabel && item?.originalData) {
    const originalKeys = Object.keys(item.originalData);
    const originalFieldKey = originalKeys.find(
      (key) => typeof item.originalData[key] === 'number' && key.includes('('),
    );
    if (originalFieldKey) finalLabel = originalFieldKey.replace(/\(.*\)/, '').trim();
  }

  if (!finalLabel || finalLabel.trim() === '') {
    finalLabel = `Value ${index + 1}`;
  }

  return finalLabel;
}

export function BigNumberStreamChart({
  data,
  config,
  customizationOptions,
  useSavedCustomizationOnly = false,
  rawResponse,
}: BigNumberStreamChartProps) {
  const hasSavedFromProps =
    useSavedCustomizationOnly ||
    (customizationOptions != null &&
      typeof customizationOptions === 'object' &&
      Object.keys(customizationOptions).length > 0);

  const [customOptions, setCustomOptions] = useState<BigNumberStreamCustomizationOptions>(() => {
    if (hasSavedFromProps && customizationOptions) {
      return mergeStreamOptions(defaultStreamOptions, customizationOptions);
    }
    return mergeStreamOptions(
      defaultStreamOptions,
      customizationOptions,
      typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : undefined,
    );
  });

  const prevValueRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cardContentRefs = useRef(new Map<number, HTMLDivElement>());

  const persistCustomization = useCallback((next: BigNumberStreamCustomizationOptions) => {
    setCustomOptions(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: next }));
      (window as any).__chartCustomizationOptions = next;
    }
  }, []);

  const iconDraggable = !useSavedCustomizationOnly;

  const handleIconPositionChange = useCallback(
    (x: number, y: number) => {
      setCustomOptions((prev) => {
        const next = {
          ...prev,
          iconPositionX: Math.round(x * 10) / 10,
          iconPositionY: Math.round(y * 10) / 10,
        };
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: next }));
          (window as any).__chartCustomizationOptions = next;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!customizationOptions) return;
    if (hasSavedFromProps) {
      setCustomOptions(mergeStreamOptions(defaultStreamOptions, customizationOptions));
    } else {
      setCustomOptions((prev) => mergeStreamOptions(prev, customizationOptions));
    }
  }, [customizationOptions, hasSavedFromProps]);

  useEffect(() => {
    if (hasSavedFromProps) return;

    try {
      const w = (window as any).__chartCustomizationOptions;
      if (w) setCustomOptions((prev) => mergeStreamOptions(prev, w));
    } catch {
      /* ignore */
    }

    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail;
        if (!detail) return;
        const has = BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS.some((k) => typeof detail[k] !== 'undefined');
        if (has) setCustomOptions((prev) => mergeStreamOptions(prev, detail));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('chartCustomizationChanged', handler);
    return () => window.removeEventListener('chartCustomizationChanged', handler);
  }, [hasSavedFromProps]);

  const seriesValues = useMemo(() => {
    const fromRaw = rawResponse?.data?.length
      ? extractNumericSeries(rawResponse.data, rawResponse.x_axis)
      : [];
    if (fromRaw.length > 1) return fromRaw;
    if (data.length > 1) return data.map((d) => d.value).filter((v) => !Number.isNaN(v));
    return fromRaw.length ? fromRaw : data.map((d) => d.value).filter((v) => !Number.isNaN(v));
  }, [rawResponse, data]);

  const primaryValue = useMemo(() => {
    if (seriesValues.length) return seriesValues[seriesValues.length - 1];
    if (data.length) return data[data.length - 1]?.value ?? 0;
    return 0;
  }, [seriesValues, data]);

  useEffect(() => {
    if (customOptions.animateValueUpdates === false) return;
    if (typeof window !== 'undefined' && (window as any).__chartStreamSilentRefresh) {
      (window as any).__chartStreamSilentRefresh = false;
      prevValueRef.current = primaryValue;
      return;
    }
    if (prevValueRef.current !== null && prevValueRef.current !== primaryValue) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 600);
      prevValueRef.current = primaryValue;
      return () => window.clearTimeout(t);
    }
    prevValueRef.current = primaryValue;
  }, [primaryValue, customOptions.animateValueUpdates]);

  const trend = useMemo(() => {
    if (seriesValues.length < 2) return null;
    const prev = seriesValues[seriesValues.length - 2];
    const curr = seriesValues[seriesValues.length - 1];
    if (prev === 0 && curr === 0) return { pct: 0, direction: 'flat' as const };
    if (prev === 0) return { pct: 100, direction: 'up' as const };
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    const direction = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
    return { pct, direction };
  }, [seriesValues]);

  const sparklineData = useMemo(
    () => seriesValues.map((value, i) => ({ i, value })),
    [seriesValues],
  );

  const valueColorRange = useMemo(
    () => computeAutoValueRange(seriesValues, primaryValue),
    [seriesValues, primaryValue],
  );

  const streamLayoutMode = data.length > 1 ? ('multi' as const) : ('stream' as const);
  const containerRef = useRef<HTMLDivElement>(null);
  const responsiveScale = useBigNumberContainerScale(containerRef, streamLayoutMode);

  if (data.length === 0 && seriesValues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data to display
      </div>
    );
  }

  const displayItems =
    data.length > 1
      ? data
      : data.length > 0
        ? data.slice(0, 1)
        : [{ category: 'Value', value: primaryValue, originalData: null }];
  const isMultiMetric = data.length > 1;
  const showSparkline =
    !isMultiMetric && customOptions.showSparkline !== false && sparklineData.length > 1;
  const showTrend = !isMultiMetric && customOptions.showTrendDelta !== false && trend != null;

  const cardLayout = {
    borderRadius: '10px',
    padding: '18px',
    fontSize: '28px',
  };
  const scaledCardPadding = scalePaddingValue(cardLayout.padding, responsiveScale);

  if (isMultiMetric) {
    const { fillStyle, shellStyle, cardStyle, hasCardColor } = buildBigNumberCardSurfaceStyles(
      customOptions,
      cardLayout.borderRadius,
    );
    const defaultLabelColor = cardStyle.isDefaultWhite ? 'var(--muted-foreground)' : '#ffffff';
    const subheaderFontPx = resolveBigNumberSubheaderFontPx(customOptions, 'default');
    const numberFontSize = resolveBigNumberValueFontPx(customOptions, 'multi');
    const headerFontWeight = resolveBigNumberFontWeight(customOptions?.subheaderBold, false);
    const countFontWeight = resolveBigNumberFontWeight(customOptions?.bigNumberBold, true);

    return (
      <div ref={containerRef} className="flex h-full min-h-0 w-full min-w-0 flex-col items-stretch overflow-hidden pb-1">
        <Card
          className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent"
          style={shellStyle}
        >
          {hasCardColor ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={fillStyle}
              aria-hidden
            />
          ) : null}
          <CardContent
            className="relative z-[1] flex h-full min-h-0 w-full flex-row items-stretch overflow-x-auto overflow-y-hidden p-0 [scrollbar-width:thin]"
            style={{ padding: scaledCardPadding }}
          >
            {data.map((item, index) => {
              const keys = Object.keys(item);
              const valueKey =
                keys.find((key) => typeof (item as any)[key] === 'number' && key.includes('(')) ||
                keys.find((key) => typeof (item as any)[key] === 'number') ||
                'value';
              const value = (item as any).value ?? 0;
              const rangeNumberColor = resolveValueRangeColorForValue(
                value,
                customOptions,
                valueColorRange.min,
                valueColorRange.max,
              );
              const defaultNumberColor = cardStyle.isDefaultWhite
                ? 'var(--card-foreground)'
                : '#ffffff';
              const effectiveNumberColor = rangeNumberColor || defaultNumberColor;
              const dataLabel = resolveLabel(item, index, config, valueKey);
              const displayTitle = dataLabel.replace(/_/g, ' ');

              return (
                <div
                  key={index}
                  className={cn(
                    'flex h-full min-w-0 flex-1 flex-col items-center justify-center px-3 text-center',
                    index > 0 && 'border-l border-border/60',
                  )}
                >
                  <div
                    className={cn(
                      'mb-2 line-clamp-2 w-full break-words text-sm',
                      cardStyle.isDefaultWhite ? '' : 'opacity-80',
                    )}
                    style={{
                      color: defaultLabelColor,
                      fontSize: subheaderFontPx,
                      fontWeight: headerFontWeight,
                    }}
                  >
                    {displayTitle}
                  </div>
                  <div
                    className="w-full overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
                    style={{
                      color: effectiveNumberColor,
                      fontSize: numberFontSize,
                      fontWeight: countFontWeight,
                      lineHeight: 1.1,
                    }}
                  >
                    {formatValueWithOptions(value, customOptions)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full min-w-0 flex-col items-stretch overflow-hidden pb-1">
      <div
        className={cn(
          'flex-1 w-full min-h-0 min-w-0 overflow-hidden justify-start items-stretch',
          isMultiMetric
            ? 'flex flex-row gap-2 overflow-x-auto [scrollbar-width:thin]'
            : 'flex flex-col gap-3',
        )}
      >
        {displayItems.map((item, index) => {
          const keys = Object.keys(item);
          const valueKey =
            keys.find((key) => typeof (item as any)[key] === 'number' && key.includes('(')) ||
            keys.find((key) => typeof (item as any)[key] === 'number') ||
            'value';
          const value = isMultiMetric
            ? (item as any).value ?? 0
            : seriesValues.length
              ? primaryValue
              : (item as any).value ?? primaryValue;

          const { fillStyle, shellStyle, cardStyle, hasCardColor } = buildBigNumberCardSurfaceStyles(
            customOptions,
            cardLayout.borderRadius,
          );
          const rangeNumberColor = resolveValueRangeColorForValue(
            value,
            customOptions,
            valueColorRange.min,
            valueColorRange.max,
          );
          const defaultNumberColor = cardStyle.isDefaultWhite ? 'var(--card-foreground)' : '#ffffff';
          const effectiveNumberColor = rangeNumberColor || defaultNumberColor;
          const effectiveLabelColor = cardStyle.isDefaultWhite
            ? 'var(--muted-foreground)'
            : '#ffffff';
          const hasIcon = hasKpiIconSource(customOptions.iconSvg);
          const useFreeIcon = hasIcon;
          const freeIconPosition = useFreeIcon ? resolveFreeIconPosition(customOptions) : null;
          const iconColor = customOptions.iconSvgColor;
          const sparkColor =
            customOptions.sparklineColor?.trim() ||
            rangeNumberColor ||
            (cardStyle.isDefaultWhite ? 'hsl(var(--primary))' : '#ffffff');

          const subheaderFontPx = resolveBigNumberSubheaderFontPx(customOptions, 'default');
          const numberFontSize = resolveBigNumberValueFontPx(
            customOptions,
            isMultiMetric ? 'multi' : 'single',
          );
          const iconSizePx = scalePxNumber(resolveKpiIconSizePx(customOptions.iconSizePx), responsiveScale);

          const headerFontWeight = resolveBigNumberFontWeight(customOptions?.subheaderBold, false);
          const countFontWeight = resolveBigNumberFontWeight(customOptions?.bigNumberBold, true);

          const formattedValue = formatValueWithOptions(value, customOptions);
          const dataLabel = resolveLabel(item, index, config, valueKey);
          const displayTitle = (
            isMultiMetric ? dataLabel : customOptions.titleLabel?.trim() || dataLabel
          ).replace(/_/g, ' ');

          const startTitleEdit = () => {
            setDraftTitle(displayTitle);
            setIsEditingTitle(true);
            window.setTimeout(() => {
              titleInputRef.current?.focus();
              titleInputRef.current?.select();
            }, 0);
          };

          const commitTitleEdit = () => {
            const trimmed = draftTitle.trim();
            persistCustomization({ ...customOptions, titleLabel: trimmed });
            setIsEditingTitle(false);
          };

          const iconPosition = normalizeElementPosition(
            customOptions.iconPosition,
            DEFAULT_ICON_POSITION,
          );
          const headerPosition = normalizeElementPosition(
            customOptions.headerPosition,
            DEFAULT_HEADER_POSITION,
          );
          const headerValueSamePosition = customOptions.headerValueSamePosition === true;
          const valuePosition = headerValueSamePosition
            ? headerPosition
            : normalizeElementPosition(customOptions.valuePosition, DEFAULT_VALUE_POSITION);

          const titleTextClassName = cn(
            'min-w-0 flex-1 text-sm leading-snug line-clamp-2 whitespace-normal',
            isMultiMetric ? 'text-center' : 'text-left',
            cardStyle.isDefaultWhite ? '' : 'opacity-80',
          );
          const titleTextStyle = {
            color: effectiveLabelColor,
            fontSize: subheaderFontPx,
            fontWeight: headerFontWeight,
          };

          const headerTitleRow = isEditingTitle && !useSavedCustomizationOnly ? (
            <Input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTitleEdit();
                }
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                }
              }}
              className="h-8 min-w-0 w-full text-sm"
              style={{ fontSize: subheaderFontPx, fontWeight: headerFontWeight }}
            />
          ) : (
            <div className="flex w-full min-w-0 items-start gap-0.5">
              <span className={titleTextClassName} style={titleTextStyle}>
                {displayTitle}
              </span>
              {!useSavedCustomizationOnly && !isMultiMetric ? (
                <button
                  type="button"
                  onClick={startTitleEdit}
                  className={cn(
                    'shrink-0 rounded p-0.5 transition-colors hover:bg-muted/60 pr-12',
                    cardStyle.isDefaultWhite
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-white/70 hover:text-white',
                  )}
                  aria-label="Edit title"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );

          const valueNumber = (
            <div
              className={cn(
                'max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums',
                isMultiMetric ? 'text-center' : 'text-left',
              )}
              style={{
                color: effectiveNumberColor,
                fontSize: numberFontSize,
                fontWeight: countFontWeight,
                lineHeight: 1.1,
              }}
            >
              {formattedValue}
            </div>
          );

          const trendBadge =
            showTrend && trend ? (
              <div
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                  trend.direction === 'up' && 'bg-emerald-500/15 text-emerald-600',
                  trend.direction === 'down' && 'bg-red-500/15 text-red-600',
                  trend.direction === 'flat' && 'bg-muted text-muted-foreground',
                )}
              >
                {trend.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
                {trend.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
                {trend.direction === 'flat' && <Minus className="h-3.5 w-3.5" />}
                {trend.pct >= 0 ? '+' : ''}
                {trend.pct.toFixed(1)}%
              </div>
            ) : null;

          const usePositionGrid = shouldUsePositionGridLayout(customOptions, false);
          const iconOnLeft =
            !useFreeIcon &&
            (!hasIcon ||
            normalizeElementPosition(customOptions.iconPosition, DEFAULT_ICON_POSITION) === 'top-left' ||
            normalizeElementPosition(customOptions.iconPosition, DEFAULT_ICON_POSITION) === 'center-left');

          const headerBlock = <div className="min-w-0 w-full overflow-hidden">{headerTitleRow}</div>;

          const valueBlock = (
            <div className="flex max-w-full min-w-0 flex-wrap items-end gap-3">
              {valueNumber}
              {trendBadge}
            </div>
          );

          const iconNode =
            hasIcon && !useFreeIcon ? (
            <BigNumberKpiIcon
              source={customOptions.iconSvg!}
              color={iconColor}
              sizePx={iconSizePx}
              className="mt-0.5"
            />
          ) : null;

          const headerBandContent = (
            <StreamClassicHeaderBand
              options={customOptions}
              iconSizePx={iconSizePx}
              useFreeIcon={useFreeIcon}
              iconOnLeft={iconOnLeft}
              iconNode={iconNode}
              headerTitleRow={headerTitleRow}
              valueBlock={valueBlock}
              measureRef={{
                get current() {
                  return cardContentRefs.current.get(index) ?? null;
                },
              }}
            />
          );

          const positionedBlocks: PositionedBlock[] = [];
          if (usePositionGrid) {
            if (hasIcon && !useFreeIcon) {
              positionedBlocks.push({
                key: 'icon',
                position: iconPosition,
                node: (
                  <BigNumberKpiIcon
                    source={customOptions.iconSvg!}
                    color={iconColor}
                    sizePx={iconSizePx}
                  />
                ),
              });
            }
            if (headerValueSamePosition) {
              positionedBlocks.push({
                key: 'header-value',
                position: headerPosition,
                node: (
                  <div className="flex min-w-0 max-w-full flex-col items-stretch gap-1">
                    {headerBlock}
                    {valueBlock}
                  </div>
                ),
              });
            } else {
              positionedBlocks.push({
                key: 'header',
                position: headerPosition,
                node: headerBlock,
              });
              positionedBlocks.push({
                key: 'value',
                position: valuePosition,
                node: valueBlock,
              });
            }
          }

          const blocksByPosition = groupBlocksByPosition(positionedBlocks);

          return (
            <Card
              key={index}
              className={cn(
                'relative flex bg-transparent py-0 min-h-0 min-w-0 flex-col justify-between overflow-hidden transition-transform',
                isMultiMetric ? 'h-full flex-1 basis-0 shrink-0 min-w-[100px]' : 'w-full flex-1',
                pulse && !isMultiMetric && 'scale-[1.01]',
              )}
              style={shellStyle}
            >
              {hasCardColor ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={fillStyle}
                  aria-hidden
                />
              ) : null}
              <CardContent
                ref={(node) => {
                  if (node) cardContentRefs.current.set(index, node);
                  else cardContentRefs.current.delete(index);
                }}
                className={cn(
                  'relative z-[1] flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden p-0',
                  !usePositionGrid && 'overflow-x-clip overflow-y-visible',
                  isMultiMetric && 'justify-center',
                )}
                style={{ padding: isMultiMetric ? scalePaddingValue('12px', responsiveScale) : scaledCardPadding }}
              >
                {useFreeIcon && freeIconPosition ? (
                  <BigNumberDraggableKpiIcon
                    source={customOptions.iconSvg!}
                    color={iconColor}
                    sizePx={iconSizePx}
                    x={freeIconPosition.x}
                    y={freeIconPosition.y}
                    draggable={iconDraggable}
                    containerRef={{
                      get current() {
                        return cardContentRefs.current.get(index) ?? null;
                      },
                    }}
                    onPositionChange={handleIconPositionChange}
                  />
                ) : null}
                {!usePositionGrid ? (
                  headerBandContent
                ) : (
                  <div className="grid min-h-[100px] flex-1 grid-cols-3 grid-rows-3 gap-2">
                    {Array.from(blocksByPosition.entries()).map(([position, blocks]) => (
                      <div
                        key={position}
                        className={cn(
                          'flex min-w-0 max-w-full gap-2',
                          elementPositionGridClass(position),
                          elementPositionAlignClass(position),
                        )}
                      >
                        {blocks.map((block) => (
                          <div key={block.key} className="min-w-0 max-w-full shrink-0">
                            {block.node}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {showSparkline && (
                  <div className="mt-3 h-14 w-full min-h-[56px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <defs>
                          <linearGradient id={`stream-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={sparkColor}
                          strokeWidth={2}
                          fill={`url(#stream-fill-${index})`}
                          isAnimationActive={customOptions.animateValueUpdates !== false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

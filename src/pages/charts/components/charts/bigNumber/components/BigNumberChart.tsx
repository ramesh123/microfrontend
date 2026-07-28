import { useState, useEffect, useMemo, useRef, useCallback, type RefObject, type CSSProperties, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';
import {
  BIG_NUMBER_CUSTOMIZATION_KEYS,
  defaultOptions as bigNumberDefaultOptions,
  resolveBigNumberFontWeight,
} from '../customize/BigNumberCustmizechart';
import {
  resolveBigNumberCardStyle,
  buildBigNumberCardSurfaceStyles,
  BIG_NUMBER_CARD_BORDER_RADIUS,
  BIG_NUMBER_CARD_RADIUS_CLASS,
} from '../utils/bigNumberCardColors';
import {
  resolveBigNumberLayoutMode,
  splitKpiMetricDisplays,
  type BigNumberChartItem,
  type BigNumberMetricDisplay,
} from '../utils/bigNumberMultiMetricData';
import { getBigNumberMetricDisplay } from '../utils/bigNumberMetricDisplay';
import { BigNumberPositionedBody } from './BigNumberPositionedBody';
import { BigNumberDraggableKpiIcon } from './BigNumberDraggableKpiIcon';
import { shouldUsePositionGridLayout } from '../utils/bigNumberStreamLayout';
import { hasKpiIconSource, resolveKpiIconSizePx } from '../utils/bigNumberKpiIconUtils';
import {
  resolveBigNumberSubheaderFontPx,
  resolveBigNumberValueFontPx,
  resolveMetricFormatOptions,
  scaleFontSizeForFormattedValue,
  stepDownFooterFontPx,
} from '../utils/bigNumberUnitOptions';
import { useBigNumberContainerScale } from './useBigNumberContainerScale';
import { scalePaddingValue, scalePxValue, scalePxNumber, type BigNumberResponsiveLayoutMode } from '../utils/bigNumberResponsiveScale';
import { resolveFreeIconPosition } from '../utils/bigNumberFreeIconPosition';

interface BigNumberChartProps {
  data: Array<{ category: string; value: number; originalData: any }>;
  chartName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  config?: any;
  customizationOptions?: BigNumberCustomizationOptions | null;
  /** When true (dashboard saved chart), ignore live window customize panel overrides */
  useSavedCustomizationOnly?: boolean;
}

function mergeBigNumberOptions(
  ...sources: Array<BigNumberCustomizationOptions | null | undefined>
): BigNumberCustomizationOptions {
  return { ...bigNumberDefaultOptions, ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}) };
}

export function BigNumberChart({
  data,
  chartName,
  icon: IconComponent,
  config,
  customizationOptions,
  useSavedCustomizationOnly = false,
}: BigNumberChartProps) {
  const hasSavedFromProps =
    useSavedCustomizationOnly ||
    (customizationOptions != null &&
      typeof customizationOptions === 'object' &&
      Object.keys(customizationOptions).length > 0);

  const [customOptions, setCustomOptions] = useState<BigNumberCustomizationOptions>(() => {
    if (hasSavedFromProps && customizationOptions) {
      return mergeBigNumberOptions(bigNumberDefaultOptions, customizationOptions);
    }
    return mergeBigNumberOptions(
      bigNumberDefaultOptions,
      customizationOptions,
      typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : undefined,
    );
  });

  useEffect(() => {
    if (!customizationOptions) return;
    if (hasSavedFromProps) {
      setCustomOptions(mergeBigNumberOptions(bigNumberDefaultOptions, customizationOptions));
    } else {
      setCustomOptions((prev) => mergeBigNumberOptions(prev, customizationOptions));
    }
  }, [customizationOptions, hasSavedFromProps]);

  useEffect(() => {
    if (hasSavedFromProps) return;

    try {
      const w = (window as any).__chartCustomizationOptions;
      if (w) setCustomOptions((prev) => mergeBigNumberOptions(prev, w));
    } catch {
      /* ignore */
    }

    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail;
        if (!detail) return;
        const has = BIG_NUMBER_CUSTOMIZATION_KEYS.some((k) => typeof detail[k] !== 'undefined');
        if (has) setCustomOptions((prev) => mergeBigNumberOptions(prev, detail));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('chartCustomizationChanged', handler);
    return () => window.removeEventListener('chartCustomizationChanged', handler);
  }, [hasSavedFromProps]);

  const metrics = Array.isArray(config?.metrics) ? config.metrics : undefined;
  const layoutPreference = customOptions.layoutMode ?? 'auto';
  const layoutMode = resolveBigNumberLayoutMode(data, metrics, layoutPreference);
  const isKpiLayout = layoutMode === 'kpi';
  const isMultiMetric = layoutMode === 'columns';

  const responsiveMode: BigNumberResponsiveLayoutMode = isKpiLayout
    ? 'kpi'
    : isMultiMetric
      ? 'multi'
      : 'single';
  const containerRef = useRef<HTMLDivElement>(null);
  const iconSurfaceRef = useRef<HTMLDivElement>(null);
  const responsiveScale = useBigNumberContainerScale(containerRef, responsiveMode);

  const handleIconPositionChange = useCallback(
    (x: number, y: number) => {
      setCustomOptions((prev) => {
        const next = {
          ...prev,
          iconPositionX: Math.round(x * 10) / 10,
          iconPositionY: Math.round(y * 10) / 10,
        };
        if (!useSavedCustomizationOnly && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: next }));
          (window as any).__chartCustomizationOptions = next;
        }
        return next;
      });
    },
    [useSavedCustomizationOnly],
  );

  const iconDraggable = !useSavedCustomizationOnly;
  const hasUploadedIcon = hasKpiIconSource(customOptions.iconSvg);
  const freeIconPosition = hasUploadedIcon ? resolveFreeIconPosition(customOptions) : null;

  const cardLayout = useMemo(
    () => ({
      borderRadius: BIG_NUMBER_CARD_BORDER_RADIUS,
      padding: isKpiLayout ? '16px 18px 14px' : isMultiMetric ? '18px' : '16px 16px 18px 20px',
      labelGap: isKpiLayout ? '4px' : isMultiMetric ? '8px' : '6px',
      fontSize: '28px',
    }),
    [isKpiLayout, isMultiMetric],
  );
  const scaledCardPadding = scalePaddingValue(cardLayout.padding, responsiveScale);
  const scaledLabelGap = scalePxValue(cardLayout.labelGap, responsiveScale);

  const {
    fillStyle: cardBackgroundFillStyle,
    shellStyle: cardShellStyle,
    cardStyle: sharedCardStyle,
    hasCardColor: sharedHasCardColor,
    opacity: sharedOpacity,
  } = buildBigNumberCardSurfaceStyles(customOptions, cardLayout.borderRadius);
  const isGlassCard = sharedCardStyle.style === 'glass';
  const sharedNumberColor = sharedCardStyle.isDefaultWhite
    ? 'var(--card-foreground)'
    : isGlassCard && sharedCardStyle.useAccentText && sharedCardStyle.midColor
      ? sharedCardStyle.midColor
      : '#ffffff';
  const sharedLabelColor =
    sharedCardStyle.isDefaultWhite || (isGlassCard && sharedCardStyle.useAccentText)
      ? 'var(--muted-foreground)'
      : '#ffffff';
  const footerValueColor = sharedCardStyle.isDefaultWhite
    ? 'var(--card-foreground)'
    : isGlassCard && sharedCardStyle.useAccentText && sharedCardStyle.midColor
      ? sharedCardStyle.midColor
      : '#ffffff';

  const cardShellClassName = cn(
    'relative flex h-full min-h-0 w-full flex-col gap-0 !py-0 !px-0 bg-transparent box-border overflow-hidden isolate',
    BIG_NUMBER_CARD_RADIUS_CLASS,
  );
  const subheaderFontPx = resolveBigNumberSubheaderFontPx(customOptions, 'default');
  const kpiHeaderFontPx = resolveBigNumberSubheaderFontPx(customOptions, 'kpi');
  const headerFontWeight = resolveBigNumberFontWeight(customOptions?.subheaderBold, false);
  const countFontWeight = resolveBigNumberFontWeight(customOptions?.bigNumberBold, true);
  const primaryMetricIndex = customOptions.primaryMetricIndex ?? 0;

  const resolveValueFontPx = (
    metricIndex: number,
    formattedValue: string,
    context: 'kpiPrimary' | 'kpiFooter' | 'multi' | 'single',
    footerStepIndex?: number,
    metricKey?: string,
  ) => {
    const formatOpts = resolveMetricFormatOptions(customOptions, metricIndex, metricKey);
    let px = resolveBigNumberValueFontPx(
      customOptions,
      context,
      formatOpts.fontSize ?? customOptions.bigNumberFontSize,
    );
    if (context === 'kpiFooter') {
      px = stepDownFooterFontPx(px, footerStepIndex ?? 0, customOptions.footerStepDownFontSize);
    }
    return scaleFontSizeForFormattedValue(px, formattedValue, customOptions.autoScaleValueFontSize);
  };

  const metricDisplays = useMemo(
    (): BigNumberMetricDisplay[] =>
      data.map((item, index) =>
        getBigNumberMetricDisplay(item as BigNumberChartItem, index, metrics, customOptions),
      ),
    [data, metrics, customOptions],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data to display
      </div>
    );
  }

  const renderMetricCell = (item: (typeof data)[number], index: number) => {
    const display = metricDisplays[index] ?? getBigNumberMetricDisplay(item as BigNumberChartItem, index, metrics, customOptions);
    const metricIndex = display.metricIndex ?? index;
    const numberFontSize = resolveValueFontPx(
      metricIndex,
      display.formattedValue,
      isMultiMetric ? 'multi' : 'single',
      undefined,
      display.metricKey,
    );
    const usePositionedLayout = !isMultiMetric && (hasKpiIconSource(customOptions.iconSvg) || shouldUsePositionGridLayout(customOptions, hasKpiIconSource(customOptions.iconSvg)));

    if (usePositionedLayout) {
      return (
        <div
          key={index}
          className={cn(
            'flex min-w-0 flex-col',
            isMultiMetric
              ? 'h-full flex-1 items-center justify-center px-3 text-center'
              : 'h-auto flex-shrink-0 items-start justify-start text-left',
            isMultiMetric && index > 0 && 'border-l border-border/60',
          )}
        >
          <BigNumberPositionedBody
            label={display.label}
            formattedValue={display.formattedValue}
            options={customOptions}
            labelColor={sharedLabelColor}
            numberColor={sharedNumberColor}
            subheaderFontPx={subheaderFontPx}
            numberFontSize={numberFontSize}
            headerFontWeight={headerFontWeight}
            countFontWeight={countFontWeight}
            labelGap={scaledLabelGap}
            textAlign={isMultiMetric ? 'center' : 'left'}
            containerScale={responsiveScale}
            suppressFreeIcon={hasUploadedIcon}
            layoutMeasureRef={hasUploadedIcon ? iconSurfaceRef : undefined}
            iconDraggable={iconDraggable}
            onIconPositionChange={handleIconPositionChange}
          />
        </div>
      );
    }

    return (
      <div
        key={index}
        className={cn(
          'flex min-w-0 flex-col',
          isMultiMetric
            ? 'h-full flex-1 items-center justify-center px-3 text-center'
            : 'h-auto flex-shrink-0 items-start justify-start text-left',
          isMultiMetric && index > 0 && 'border-l border-border/60',
        )}
      >
        <div
          className={cn(
            'line-clamp-2 break-words text-sm',
            sharedCardStyle.isDefaultWhite ? '' : 'opacity-80',
          )}
          style={{
            color: sharedLabelColor,
            overflowWrap: 'break-word',
            fontSize: subheaderFontPx,
            fontWeight: headerFontWeight,
            marginBottom: scaledLabelGap,
          }}
        >
          {display.label}
        </div>
        <div
          className="max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
          style={{
            color: sharedNumberColor,
            fontSize: numberFontSize,
            fontWeight: countFontWeight,
            lineHeight: 1.1,
          }}
        >
          {display.formattedValue}
        </div>
      </div>
    );
  };

  const renderCardIconOverlay = (surfaceRef: RefObject<HTMLDivElement | null>) => {
    if (!hasUploadedIcon || !freeIconPosition) return null;
    return (
      <BigNumberDraggableKpiIcon
        source={customOptions.iconSvg!}
        color={customOptions.iconSvgColor}
        sizePx={scalePxNumber(resolveKpiIconSizePx(customOptions.iconSizePx), responsiveScale)}
        x={freeIconPosition.x}
        y={freeIconPosition.y}
        draggable={iconDraggable}
        containerRef={surfaceRef}
        onPositionChange={handleIconPositionChange}
      />
    );
  };

  const renderKpiCard = () => {
    const { primary, footer } = splitKpiMetricDisplays(
      metricDisplays,
      primaryMetricIndex,
    );
    const primaryIndex = primary?.metricIndex ?? primaryMetricIndex;
    const primaryFormatted = primary?.formattedValue ?? '';
    const primaryFontSize = resolveValueFontPx(
      primaryIndex,
      primaryFormatted,
      'kpiPrimary',
      undefined,
      primary?.metricKey,
    );

    return (
      <div ref={iconSurfaceRef} className="relative h-full min-h-0 w-full">
        <Card className={cn(cardShellClassName, 'h-full min-h-0')} style={cardShellStyle}>
          <div
            className="pointer-events-none absolute inset-0"
            style={cardBackgroundFillStyle}
            aria-hidden
          />
          <CardContent
            className="relative z-[1] flex h-full min-h-0 w-full flex-col overflow-hidden p-0"
            style={{ padding: scaledCardPadding }}
          >
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
                <BigNumberPositionedBody
                  label={primary?.label ?? ''}
                  formattedValue={primary?.formattedValue ?? ''}
                  options={customOptions}
                  labelColor={sharedLabelColor}
                  numberColor={sharedNumberColor}
                  subheaderFontPx={kpiHeaderFontPx}
                  numberFontSize={primaryFontSize}
                  headerFontWeight={headerFontWeight}
                  countFontWeight={countFontWeight}
                  uppercaseLabel
                  trackingLabel
                  containerScale={responsiveScale}
                  compact
                  suppressFreeIcon
                  layoutMeasureRef={iconSurfaceRef}
                  iconDraggable={iconDraggable}
                  onIconPositionChange={handleIconPositionChange}
                />
              </div>

              {footer.length > 0 ? (
                <div
                  className={cn(
                    'mt-auto flex min-w-0 shrink-0 gap-1.5 overflow-hidden pt-1',
                    sharedCardStyle.isDefaultWhite ? 'border-t border-border/50' : 'border-t border-white/15',
                  )}
                >
                  {footer.map((item, index) => {
                    const footerMetricIndex = item.metricIndex ?? index;
                    const footerFormatted = item.formattedValue;
                    const footerFontPx = resolveValueFontPx(
                      footerMetricIndex,
                      footerFormatted,
                      'kpiFooter',
                      index,
                      item.metricKey,
                    );
                    return (
                      <div
                        key={`${item.label}-${item.metricKey ?? index}`}
                        className="min-w-0 flex-1 basis-0 overflow-hidden"
                      >
                        <div
                          className="truncate text-[11px] uppercase tracking-wide opacity-80"
                          style={{ color: sharedLabelColor, fontSize: '11px' }}
                          title={item.label}
                        >
                          {item.label}
                        </div>
                        <div
                          className="mt-0.5 truncate tabular-nums font-semibold"
                          style={{
                            color: footerValueColor,
                            fontSize: footerFontPx,
                          }}
                          title={footerFormatted}
                        >
                          {footerFormatted}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
        {renderCardIconOverlay(iconSurfaceRef)}
      </div>
    );
  };

  const renderCardWithIconSurface = (card: ReactNode) => (
    <div ref={iconSurfaceRef} className="relative h-full min-h-0 w-full">
      {card}
      {renderCardIconOverlay(iconSurfaceRef)}
    </div>
  );

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col items-stretch overflow-hidden">
      {(chartName || IconComponent) && (
        <div className="mb-4 flex w-full flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="h-4 w-4" />}
            {chartName && <h3 className="text-sm font-semibold text-foreground">{chartName}</h3>}
          </div>
        </div>
      )}
      <div ref={containerRef} className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        {isKpiLayout ? (
          renderKpiCard()
        ) : isMultiMetric ? (
          renderCardWithIconSurface(
            <Card className={cardShellClassName} style={cardShellStyle}>
              <div
                className="pointer-events-none absolute inset-0"
                style={cardBackgroundFillStyle}
                aria-hidden
              />
              <CardContent
                className="relative z-[1] flex h-full min-h-0 w-full flex-row items-stretch overflow-x-auto overflow-y-hidden p-0 [scrollbar-width:thin]"
                style={{ padding: scaledCardPadding }}
              >
                {data.map((item, index) => renderMetricCell(item, index))}
              </CardContent>
            </Card>,
          )
        ) : (
          renderCardWithIconSurface(
            <Card className={cn(cardShellClassName, 'h-full min-h-0')} style={cardShellStyle}>
              <div
                className="pointer-events-none absolute inset-0"
                style={cardBackgroundFillStyle}
                aria-hidden
              />
              <CardContent
                className="relative z-[1] flex h-full min-h-0 w-full flex-col items-start justify-start overflow-hidden p-0"
                style={{ padding: scaledCardPadding }}
              >
                {data.map((item, index) => renderMetricCell(item, index))}
              </CardContent>
            </Card>,
          )
        )}
      </div>
    </div>
  );
}

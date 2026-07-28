import * as React from 'react';
import { formatNumber } from '@/utils/numberFormatters';
import {
  DEFAULT_HEADER_POSITION,
  DEFAULT_ICON_POSITION,
  DEFAULT_VALUE_POSITION,
  type BigNumberElementPosition,
} from '../utils/bigNumberStreamLayout';
import { resolveUnitSymbol, type BigNumberMetricDescriptor } from '../utils/bigNumberUnitOptions';
import type { BigNumberMetricFormatOptions } from '../utils/bigNumberUnitOptions';
import { BigNumberAppearanceCustomizeSection } from './BigNumberAppearanceCustomizeSection';
import { BigNumberDataFormatCustomizeSection } from './BigNumberDataFormatCustomizeSection';
import { BigNumberIconCustomizeSectionWrapper } from './BigNumberIconCustomizeSectionWrapper';
import { BigNumberLayoutMetricsCustomizeSection } from './BigNumberLayoutMetricsCustomizeSection';
import { BigNumberTypographyCustomizeSection } from './BigNumberTypographyCustomizeSection';
import { BigNumberCustomizePanelShell } from './bigNumberCustomizeShared';

export interface BigNumberCustomizationOptions {
  bigNumberFontSize?: 'small' | 'normal' | 'large';
  /** Explicit value font size in px; overrides preset and stays fixed on widget resize. */
  bigNumberFontSizePx?: number;
  subheaderFontSize?: 'small' | 'normal' | 'large';
  /** Explicit title font size in px; overrides preset and stays fixed on widget resize. */
  subheaderFontSizePx?: number;
  /** Bold header / subheader label text. */
  subheaderBold?: boolean;
  /** Bold big number (count) text. */
  bigNumberBold?: boolean;
  numberFormat?: 'adaptive' | 'raw' | 'short' | 'full' | 'decimal' | 'percent';
  currencyFormat?: 'none' | 'prefix' | 'suffix';
  currencyCode?: string;
  /** Optional legacy solid background override (cleared when using theme palette). */
  cardBackgroundColor?: string;
  /** KPI card background palette key (see bigNumberCardColorSchemes). */
  cardColorScheme?: string;
  /** Shine gradient (solid) or frosted glass gradient. */
  cardBackgroundStyle?: 'shine' | 'glass';
  /** 0–100 opacity for card background (100 = solid). */
  backgroundOpacity?: number;
  /** Data URL for uploaded KPI card background image. */
  cardBackgroundImage?: string;
  dateFormat?: 'adaptive' | 'raw';
  forceDateFormat?: boolean;
  conditionalFormattingEnabled?: boolean;
  /** auto: KPI card when 2+ metrics; kpi: primary + footer stats; columns: side-by-side metrics. */
  layoutMode?: 'auto' | 'kpi' | 'columns';
  /** 0-based index of the metric shown as the main KPI value (footer shows the rest). */
  primaryMetricIndex?: number;
  /** Data URL or inline SVG markup for icon shown on the KPI card. */
  iconSvg?: string;
  /** Tint colour for uploaded SVG icon (hex). Empty = original SVG colours. */
  iconSvgColor?: string;
  /** Icon display size in pixels (12–72). */
  iconSizePx?: number;
  iconPosition?: BigNumberElementPosition;
  /** 0–100: horizontal position of icon center within the card. */
  iconPositionX?: number;
  /** 0–100: vertical position of icon center within the card. */
  iconPositionY?: number;
  headerPosition?: BigNumberElementPosition;
  valuePosition?: BigNumberElementPosition;
  /** When true, value uses the header position and stacks below the title. */
  headerValueSamePosition?: boolean;
  /** Per-metric number format, units, and font size (by metric index). */
  metricFormats?: BigNumberMetricFormatOptions[];
  /** Per-metric format keyed by stable column id (preferred for multi-metric charts). */
  metricFormatsByKey?: Record<string, BigNumberMetricFormatOptions>;
  /** Auto-shrink value font when the formatted value is long. */
  autoScaleValueFontSize?: boolean;
  /** KPI footer values use progressively smaller font sizes (left to right). */
  footerStepDownFontSize?: boolean;
}

export const BIG_NUMBER_CUSTOMIZATION_KEYS: (keyof BigNumberCustomizationOptions)[] = [
  'bigNumberFontSize',
  'bigNumberFontSizePx',
  'subheaderFontSize',
  'subheaderFontSizePx',
  'subheaderBold',
  'bigNumberBold',
  'numberFormat',
  'currencyFormat',
  'currencyCode',
  'cardColorScheme',
  'cardBackgroundColor',
  'cardBackgroundStyle',
  'backgroundOpacity',
  'cardBackgroundImage',
  'forceDateFormat',
  'conditionalFormattingEnabled',
  'layoutMode',
  'primaryMetricIndex',
  'iconSvg',
  'iconPositionX',
  'iconPositionY',
  'iconSvgColor',
  'iconSizePx',
  'iconPosition',
  'headerPosition',
  'valuePosition',
  'headerValueSamePosition',
  'metricFormats',
  'metricFormatsByKey',
  'autoScaleValueFontSize',
  'footerStepDownFontSize',
];

const defaultOptions: BigNumberCustomizationOptions = {
  bigNumberFontSize: 'small',
  subheaderFontSize: 'large',
  subheaderBold: false,
  bigNumberBold: true,
  numberFormat: 'raw',
  currencyFormat: 'none',
  currencyCode: '',
  cardColorScheme: 'theme',
  cardBackgroundStyle: 'shine',
  backgroundOpacity: 100,
  cardBackgroundImage: '',
  dateFormat: 'adaptive',
  forceDateFormat: false,
  conditionalFormattingEnabled: false,
  layoutMode: 'auto',
  primaryMetricIndex: 0,
  iconSvg: '',
  iconSvgColor: '',
  iconSizePx: 16,
  iconPosition: DEFAULT_ICON_POSITION,
  headerPosition: DEFAULT_HEADER_POSITION,
  valuePosition: DEFAULT_VALUE_POSITION,
  headerValueSamePosition: false,
  metricFormats: [],
  metricFormatsByKey: {},
  autoScaleValueFontSize: false,
  footerStepDownFontSize: false,
};

export function formatBigNumberValue(
  v: number,
  opts: Pick<BigNumberCustomizationOptions, 'numberFormat' | 'currencyFormat' | 'currencyCode'>,
): string {
  const numberFormat = opts.numberFormat ?? 'raw';
  let formatted: string;
  try {
    if (numberFormat === 'raw' || numberFormat === 'decimal') {
      formatted = v.toLocaleString();
    } else if (numberFormat === 'short') {
      formatted = formatNumber(v, { format: 'short' });
    } else if (numberFormat === 'full') {
      formatted = formatNumber(v, { format: 'full' });
    } else if (numberFormat === 'adaptive') {
      formatted = formatNumber(v, { format: 'short' });
    } else if (numberFormat === 'percent') {
      formatted = `${(v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    } else {
      formatted = formatNumber(v, { format: 'short' });
    }
  } catch {
    formatted = String(v);
  }

  try {
    const code = opts.currencyCode || '';
    const fmt = opts.currencyFormat || 'none';
    const sym = resolveUnitSymbol(code);
    if (fmt === 'prefix' && sym) return `${sym}${formatted}`;
    if (fmt === 'suffix' && sym) return `${formatted} ${sym}`.trim();
  } catch {
    /* ignore */
  }

  return formatted;
}

/** Resolve font weight for header/count; uses per-field default when option is unset. */
export function resolveBigNumberFontWeight(
  bold: boolean | undefined,
  defaultBold: boolean,
): 'normal' | 'bold' {
  const useBold = bold === undefined ? defaultBold : bold;
  return useBold ? 'bold' : 'normal';
}

export function BigNumberCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
  metricLabels = [],
  metricDescriptors = [],
}: {
  options?: BigNumberCustomizationOptions;
  onOptionsChange: (o: BigNumberCustomizationOptions) => void;
  /** Labels for configured metrics (for main-metric picker). */
  metricLabels?: string[];
  /** Stable per-column descriptors (alias label + column key). */
  metricDescriptors?: BigNumberMetricDescriptor[];
}) {
  const descriptors =
    metricDescriptors.length > 0
      ? metricDescriptors
      : metricLabels.map((label, index) => ({ key: `METRIC_${index}`, label, index }));
  const resolvedMetricLabels = descriptors.map((d) => d.label);
  const layoutMode = options.layoutMode || 'auto';
  const showKpiControls =
    resolvedMetricLabels.length >= 2 && (layoutMode === 'kpi' || layoutMode === 'auto');

  return (
    <BigNumberCustomizePanelShell
      title="Big Number"
      description="Customize KPI card appearance and values"
    >
      <BigNumberAppearanceCustomizeSection
        options={options}
        onOptionsChange={onOptionsChange}
        defaultOpen
      />

      <BigNumberLayoutMetricsCustomizeSection
        options={options}
        onOptionsChange={onOptionsChange}
        metricLabels={resolvedMetricLabels}
      />

      <BigNumberIconCustomizeSectionWrapper options={options} onOptionsChange={onOptionsChange} />

      <BigNumberTypographyCustomizeSection
        options={options}
        onOptionsChange={onOptionsChange}
        showFooterControls={showKpiControls}
        defaultOpen
      />

      {descriptors.length > 0 ? (
        <BigNumberDataFormatCustomizeSection
          options={options}
          onOptionsChange={onOptionsChange}
          metricDescriptors={descriptors}
        />
      ) : null}
    </BigNumberCustomizePanelShell>
  );
}

export { defaultOptions };

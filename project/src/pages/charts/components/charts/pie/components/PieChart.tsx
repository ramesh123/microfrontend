import { useEffect, useRef } from 'react';
import * as React from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatNumber } from '@/utils/numberFormatters';
import type { ChartCustomizationOptions } from '../customize/pieCustomizeTypes';
import { defaultOptions, colorSchemes } from '../customize/PieCustomizePanel';
import { createShinePaletteFromBase, donutColors } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { shineRadialGradient } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors } from '../../amChartThemeColors';
import { ChartDomScrollLegend, type ChartDomScrollLegendItem } from '../../ChartDomScrollLegend';

interface PieChartProps {
  data: Array<{ category: string; value: number; originalData: any }>;
  isDonut?: boolean;
  onChartInteraction?: (field: string, value: any) => void;
  customizationOptions?: ChartCustomizationOptions;
  /** When true, ignore window live customize overrides (dashboard / analytics view). */
  useSavedCustomizationOnly?: boolean;
}

export function PieChart({ data, isDonut = false, onChartInteraction, customizationOptions, useSavedCustomizationOnly = false }: PieChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartLiveRefs = useRef<{
    series: am5percent.PieSeries;
    totalLabel: am5.Label | null;
    showLegend: boolean;
    showSideLegend: boolean;
  } | null>(null);
  const chartHasAppearedRef = useRef(false);
  const pointerdownCaptureRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const onChartInteractionRef = useRef<PieChartProps['onChartInteraction']>(onChartInteraction);
  const [customizationState, setCustomizationState] = React.useState<ChartCustomizationOptions | undefined>(customizationOptions);
  const [pieDomLegend, setPieDomLegend] = React.useState<ChartDomScrollLegendItem[]>([]);
  const layoutReadyRef = useRef(false);
  const [layoutReadyTick, setLayoutReadyTick] = React.useState(0);

  React.useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      if (!layoutReadyRef.current) {
        layoutReadyRef.current = true;
        setLayoutReadyTick(1);
      }
      return;
    }

    const markReadyWhenSized = () => {
      if (layoutReadyRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width >= 8 && rect.height >= 8) {
        layoutReadyRef.current = true;
        setLayoutReadyTick(1);
      }
    };

    markReadyWhenSized();
    const layoutObserver = new ResizeObserver(markReadyWhenSized);
    layoutObserver.observe(el);
    return () => layoutObserver.disconnect();
  }, []);

  React.useEffect(() => {
    onChartInteractionRef.current = onChartInteraction;
  }, [onChartInteraction]);

  // Listen for customization changes (formulator live preview only)
  React.useEffect(() => {
    if (useSavedCustomizationOnly || customizationOptions !== undefined) return;

    const handleCustomizationChange = (event: CustomEvent) => {
      setCustomizationState(event.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);

      if ((window as any).__chartCustomizationOptions) {
        setCustomizationState((window as any).__chartCustomizationOptions);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
      }
    };
  }, [customizationOptions, useSavedCustomizationOnly]);

  // Update state when prop changes
  React.useEffect(() => {
    if (customizationOptions !== undefined) {
      setCustomizationState(customizationOptions);
    } else if (!useSavedCustomizationOnly && typeof window !== 'undefined' && (window as any).__chartCustomizationOptions) {
      setCustomizationState((window as any).__chartCustomizationOptions);
    }
  }, [customizationOptions, useSavedCustomizationOnly]);

  useEffect(() => {
    return () => {
      try {
        if (rootRef.current) {
          rootRef.current.dispose();
          rootRef.current = null;
        }
      } catch {
        /* ignore */
      }
      chartLiveRefs.current = null;
      chartHasAppearedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || layoutReadyTick === 0) return;

    // Ensure the DOM element is actually mounted and accessible
    if (!chartRef.current || !(chartRef.current instanceof HTMLElement)) {
      return;
    }

    const containerRect = chartRef.current.getBoundingClientRect();
    if (containerRect.width < 8 || containerRect.height < 8) {
      return;
    }

    // Get customization options from state, props, or window
    const liveWindowOptions =
      !useSavedCustomizationOnly && customizationOptions === undefined && typeof window !== 'undefined'
        ? (window as any).__chartCustomizationOptions
        : null;
    const options = {
      ...defaultOptions,
      ...(liveWindowOptions && typeof liveWindowOptions === 'object' ? liveWindowOptions : {}),
      ...(customizationState && typeof customizationState === 'object' ? customizationState : {}),
      ...(customizationOptions && typeof customizationOptions === 'object' ? customizationOptions : {}),
    };

    const colorSchemeKey = options.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : donutColors;

    // Filter out invalid data points (coerce strings; API may send numeric strings)
    const validData = data.filter((d) => {
      if (!d) return false;
      const n = Number(d.value);
      return Number.isFinite(n) && n > 0;
    });

    if (validData.length === 0) {
      console.warn('No valid data points for pie chart. Data:', data);
      return;
    }

    const isStreamRefresh =
      typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);

    if (isStreamRefresh && rootRef.current && chartLiveRefs.current?.series) {
      try {
        (window as any).__chartStreamSilentRefresh = false;
      } catch {
        /* ignore */
      }

      const live = chartLiveRefs.current;
      validData.forEach((d) => {
        if (!d.originalData) d.originalData = { ...d };
        else d.originalData = { ...d.originalData };
      });
      live.series.data.setAll(validData);

      const refreshedTotal = validData.reduce((sum, item) => sum + (item.value || 0), 0);
      if (live.totalLabel) {
        let formattedTotal = String(refreshedTotal);
        if (typeof refreshedTotal === 'number') {
          if (options.numberFormat === 'short') {
            formattedTotal = formatNumber(refreshedTotal, { format: 'short' });
          } else if (options.numberFormat === 'full') {
            formattedTotal = refreshedTotal.toLocaleString();
          } else if (options.numberFormat === 'decimal') {
            formattedTotal = refreshedTotal.toFixed(2);
          } else {
            formattedTotal = formatNumber(refreshedTotal, { format: 'short' });
          }
        }
        live.totalLabel.set('text', `Total: ${formattedTotal}`);
      }

      if (options.showSideLegend === true) {
        setPieDomLegend(
          validData.map((d, idx) => {
            const pct =
              refreshedTotal > 0 ? ((Number(d.value) / refreshedTotal) * 100).toFixed(1) : '0.0';
            const formattedValue = formatNumber(d.value, { format: 'short' });
            return {
              id: String(d.category ?? idx),
              line: `${d.category}: ${formattedValue} (${pct}%)`,
              label: String(d.category ?? ''),
              valueLine: `${formattedValue} (${pct}%)`,
              color: activeColors[idx % activeColors.length],
            };
          }),
        );
      } else if (live.showLegend && options.showLegend !== false) {
        setPieDomLegend(
          validData.map((d, idx) => ({
            id: String(d.category ?? idx),
            line: `${d.category}: ${formatNumber(d.value, { format: 'short' })}`,
            color: activeColors[idx % activeColors.length],
          })),
        );
      } else {
        setPieDomLegend([]);
      }

      return;
    }

    chartLiveRefs.current = null;
    if (rootRef.current) {
      try {
        rootRef.current.dispose();
      } catch {
        /* ignore */
      }
      rootRef.current = null;
    }
    setPieDomLegend([]);

    // Double-check that chartRef.current is still valid and is an HTMLElement
    if (!chartRef.current || !(chartRef.current instanceof HTMLElement)) {
      return;
    }

    const chartTheme = probeAmChartThemeColors();

    // Create root element with error handling
    let root: am5.Root;
    try {
      root = am5.Root.new(chartRef.current);
      root.setThemes([am5themes_Animated.new(root)]);
      root.autoResize = true;
      rootRef.current = root;

      // Hide amCharts logo
      root._logo?.dispose();
      applyAm5InterfaceTheme(root, chartTheme);
    } catch (error) {
      console.error('Error creating chart root:', error);
      return;
    }

    // Calculate outer radius from customization options (higher default = larger pie in the container)
    const outerRadiusPercent = options.outerRadius ?? 88;
    const innerRadiusPercent = isDonut ? (options.innerRadius ?? 50) : 0;
    /** Stroke between slices (background-colored) reads as gaps; thinner = less space between slices. */
    const sliceSeparatorStrokeWidth = 2;

    const showSideLegend = options.showSideLegend === true;
    const showLegend = showSideLegend ? false : options.showLegend !== false;

    const wrapper = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout,
      })
    );

    const chartContainer = wrapper.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout,
        centerX: am5.p50,
        x: am5.p50,
        centerY: am5.p50,
        y: am5.p50,
      })
    ) as am5.Container;

    // Create chart inside chart container
    const chart = chartContainer.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        centerY: am5.p50,
        y: am5.p50,
        innerRadius: isDonut ? am5.percent(innerRadiusPercent) : undefined,
        radius: am5.percent(outerRadiusPercent),
        width: am5.percent(100),
        height: am5.percent(100),
      })
    );

    // Verify chart was created successfully
    if (!chart) {
      console.error('Failed to create pie chart');
      return;
    }
    chart.setAll({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    });

    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        /** Suppress default %/value in legend — full line is built in legend.labels adapter */
        legendValueText: '',
      })
    );
    series.slices.template.setAll({
      // Match chart background so gaps read clearly in light/dark; wider stroke = more space between slices + clearer outer rim
      stroke: chartTheme.background,
      strokeWidth: sliceSeparatorStrokeWidth,
      strokeOpacity: 1,
      cursorOverStyle: 'pointer',
      // Light depth so the outer perimeter of each slice reads against the chart background
      shadowColor: am5.color(0x000000),
      shadowBlur: 3,
      shadowOpacity: 0.08,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });

    series.ticks.template.setAll({
      stroke: chartTheme.muted,
      strokeWidth: 1,
      strokeOpacity: 0.6,
      length: 12,
    });


    // Verify series was created successfully
    if (!series) {
      console.error('Failed to create pie series');
      return;
    }

    series.get('colors')?.set(
      'colors',
      activeColors.map((c) => am5.color(c)),
    );
    series.slices.template.adapters.add('fillGradient', (_fillGradient, target) => {
      const di = target.dataItem;
      if (!di) return undefined;
      const idx = series.dataItems.indexOf(di as (typeof series.dataItems)[number]);
      if (idx < 0) return undefined;
      const base = activeColors[idx % activeColors.length];
      return shineRadialGradient(root, am5, createShinePaletteFromBase(base));
    });

    // Helper: build the full set of dimension keys from all validData (union across rows)
    const isAggregatedColumn = (key: string) => key.includes('(') && key.includes(')');
    const allDimensionKeys = ((): string[] => {
      const seen = new Set<string>();
      for (const d of validData) {
        const od = d.originalData || {};
        const valueKey = Object.keys(od).find((k) => isAggregatedColumn(k)) ||
          Object.keys(od).find((k) => typeof od[k] === 'number' && !isNaN(od[k]));
        for (const k of Object.keys(od)) {
          if (!k || k === 'value' || k === 'category' || k === valueKey || isAggregatedColumn(k)) continue;
          seen.add(k);
        }
      }
      return Array.from(seen);
    })();

    // Helper function to extract all dimension fields dynamically - show ALL dimensions including null as "—"
    const getAllDimensions = (dataContext: any): string => {
      let originalData = dataContext?.originalData;
      if (!originalData && dataContext?.category) {
        const matchingItem = validData.find(d => d.category === dataContext.category);
        if (matchingItem) originalData = matchingItem.originalData;
      }
      if (!originalData || Object.keys(originalData).length === 0) {
        return dataContext?.category || '';
      }
      const dimensionValues = allDimensionKeys.map((key) => {
        const val = originalData[key];
        return val === null || val === undefined ? '—' : String(val).trim();
      }).filter((v) => v !== '');
      if (dimensionValues.length > 0) return dimensionValues.join(', ');
      return dataContext?.category || '';
    };

    const PIE_LABEL_FONT_SIZE = 12;
    /** Rough average glyph width for bold 12px sans (used for word-wrap). */
    const PIE_LABEL_CHAR_PX = PIE_LABEL_FONT_SIZE * 0.58;

    const wrapLabelNameLines = (text: string, maxWidthPx: number): string[] => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return [];
      const maxChars = Math.max(4, Math.floor(maxWidthPx / PIE_LABEL_CHAR_PX));
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [trimmed];

      const lines: string[] = [];
      let current = '';
      const pushLongWord = (word: string) => {
        if (word.length <= maxChars) {
          lines.push(word);
          return;
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
      };

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        if (word.length > maxChars) {
          pushLongWord(word);
          current = '';
        } else {
          current = word;
        }
      }
      if (current) lines.push(current);
      return lines;
    };

    const getPieLabelMaxWidthPx = (): number => {
      const containerW = chartRef.current?.clientWidth ?? 320;
      const chartFraction = 1;
      const chartW = containerW * chartFraction;
      const pieRadiusPx = (chartW * Math.min(outerRadiusPercent, 100)) / 200;
      const sideSpace = Math.max(0, chartW / 2 - pieRadiusPx - 12);
      const fromGeometry = sideSpace * 1.85;
      const fromCard = containerW * 0.28;
      return Math.round(Math.max(64, Math.min(150, Math.max(fromGeometry, fromCard))));
    };

    // Calculate total for percentage calculation and showTotal display
    const total = validData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Helper function to get currency code and locale from currencySymbol option
    const getCurrencyInfo = (): { code: string; locale: string; symbol: string } => {
      const currencyOption = options.currencySymbol || '$ (USD)';

      // Extract currency code from options like "$ (USD)", "€ (EUR)", etc.
      const codeMatch = currencyOption.match(/\(([A-Z]{3})\)/);
      const code = codeMatch ? codeMatch[1] : 'USD';

      // Map currency codes to locales for proper formatting
      const localeMap: Record<string, string> = {
        'USD': 'en-US',
        'EUR': 'de-DE', // or 'fr-FR', 'es-ES' depending on preference
        'GBP': 'en-GB',
        'JPY': 'ja-JP',
        'CNY': 'zh-CN',
        'INR': 'en-IN',
        'AUD': 'en-AU',
        'CAD': 'en-CA',
        'CHF': 'de-CH',
        'SGD': 'en-SG',
      };

      const locale = localeMap[code] || 'en-US';

      // Extract symbol from option
      const symbolMatch = currencyOption.match(/^([^\s(]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : '$';

      return { code, locale, symbol };
    };

    // Helper function to format value with currency (supports prefix and suffix for all number formats)
    const formatValueWithCurrency = (value: number, formattedValue: string): string => {
      if (options.currencyFormat === 'none') {
        return formattedValue;
      }

      const { code, locale, symbol } = getCurrencyInfo();

      // Suffix: always append the currency symbol after the formatted value (e.g. "1,234.00 $")
      if (options.currencyFormat === 'suffix') {
        return `${formattedValue} ${symbol}`;
      }

      // Prefix: always ensure symbol appears before number regardless of locale
      if (options.currencyFormat === 'prefix') {
        try {
          // Use locale-aware numeric formatting (no currency) then prefix symbol
          const formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
            maximumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
          });
          const num = formatter.format(value);
          return `${symbol}${num}`;
        } catch (error) {
          return `${symbol}${formattedValue}`;
        }
      }

      return formattedValue;
    };

    // Helper function to format label with value: "dim1, dim2, dim3: value"
    // Used by both legend and tooltip to ensure identical text
    const formatLabelWithValue = (dataContext: any): string => {
      const dimensions = getAllDimensions(dataContext);
      const value = dataContext?.value || 0;

      // Format value based on numberFormat option
      let formattedValue = String(value);
      if (typeof value === 'number') {
        if (options.numberFormat === 'short') {
          formattedValue = formatNumber(value, { format: 'short' });
        } else if (options.numberFormat === 'full') {
          formattedValue = value.toLocaleString();
        } else if (options.numberFormat === 'decimal') {
          formattedValue = value.toFixed(2);
        } else {
          // adaptive formatting
          formattedValue = formatNumber(value, { format: 'short' });
        }

        // Apply currency formatting if needed
        formattedValue = formatValueWithCurrency(value, formattedValue);
      }

      // Format as "dim1, dim2, dim3: value"
      return `${dimensions}: ${formattedValue}`;
    };

    // Configure labels based on customization options
    // Use explicit boolean checks - default to true if not explicitly set to false
    const showLabels = options.showLabels !== false; // Show labels unless explicitly false
    const putLabelsOutside = true; // labels are outside by default (option removed)
    const labelLine = options.labelLine !== false; // Show label lines unless explicitly false
    const showTotal = options.showTotal === true; // Only show total if explicitly true
    const labelType = options.labelType || 'percentage';

    const formatSliceMetricLine = (dataContext: any): string => {
      const value = dataContext?.value || 0;

      let formattedValue = String(value);
      if (typeof value === 'number') {
        if (options.currencyFormat !== 'none' && (options.numberFormat === 'full' || options.numberFormat === 'decimal')) {
          const { locale, symbol } = getCurrencyInfo();
          try {
            if (options.currencyFormat === 'prefix') {
              const formatter = new Intl.NumberFormat(locale, {
                minimumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
                maximumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
              });
              formattedValue = `${symbol}${formatter.format(value)}`;
            } else if (options.currencyFormat === 'suffix') {
              const formatter = new Intl.NumberFormat(locale, {
                minimumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
                maximumFractionDigits: options.numberFormat === 'decimal' ? 2 : 0,
              });
              formattedValue = `${formatter.format(value)} ${symbol}`;
            } else {
              if (options.numberFormat === 'full') {
                formattedValue = value.toLocaleString();
              } else if (options.numberFormat === 'decimal') {
                formattedValue = value.toFixed(2);
              }
              formattedValue = formatValueWithCurrency(value, formattedValue);
            }
          } catch {
            if (options.numberFormat === 'full') {
              formattedValue = value.toLocaleString();
            } else if (options.numberFormat === 'decimal') {
              formattedValue = value.toFixed(2);
            }
            formattedValue = formatValueWithCurrency(value, formattedValue);
          }
        } else {
          if (options.numberFormat === 'short') {
            formattedValue = formatNumber(value, { format: 'short' });
          } else if (options.numberFormat === 'full') {
            formattedValue = value.toLocaleString();
          } else if (options.numberFormat === 'decimal') {
            formattedValue = value.toFixed(2);
          } else {
            formattedValue = formatNumber(value, { format: 'short' });
          }
          formattedValue = formatValueWithCurrency(value, formattedValue);
        }
      }

      const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';

      switch (labelType) {
        case 'percentage':
          return `${percentage}%`;
        case 'value':
          return formattedValue;
        case 'both':
          return `${formattedValue} (${percentage}%)`;
        case 'none':
          return '';
        default:
          return formattedValue;
      }
    };

    /** Name lines (word-wrapped to card width) + metric on its own last line, center-aligned in the label. */
    const formatMultilineSliceLabel = (dataContext: any): string => {
      if (labelType === 'none') return '';
      const name = getAllDimensions(dataContext) || dataContext?.category || '';
      const metricLine = formatSliceMetricLine(dataContext);
      const nameLines = wrapLabelNameLines(name, getPieLabelMaxWidthPx());
      if (!nameLines.length) return metricLine;
      if (!metricLine) return nameLines.join('\n');
      return [...nameLines, metricLine].join('\n');
    };

    /** Same strings for amCharts side legend and DOM scroll legend (top/bottom). */
    const formatPieLegendRowForDom = (dataContext: any): string => {
      try {
        let dimensions = '';
        let value = dataContext?.value || 0;
        if (dataContext.originalData) {
          dimensions = getAllDimensions(dataContext);
        } else {
          const category = dataContext.category;
          if (category) {
            const originalItem = validData.find((d) => d.category === category);
            if (originalItem && originalItem.originalData) {
              const completeContext = {
                value: dataContext.value || originalItem.value,
                originalData: originalItem.originalData,
                category,
              };
              dimensions = getAllDimensions(completeContext);
              value = completeContext.value;
            } else {
              dimensions = category;
            }
          }
        }
        const category = dataContext.category || dimensions;
        let formattedValue = String(value);
        if (typeof value === 'number') {
          const nf = options.numberFormat || 'adaptive';
          if (nf === 'short') {
            formattedValue = formatNumber(value, { format: 'short' });
          } else if (nf === 'full') {
            formattedValue = formatNumber(value, { format: 'full' });
          } else if (nf === 'decimal') {
            formattedValue = value.toFixed(2);
          } else {
            formattedValue = formatNumber(value, { format: 'short' });
          }
          formattedValue = formatValueWithCurrency(value, formattedValue);
        }
        const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
        switch (labelType) {
          case 'percentage':
            return `${dimensions || category}: ${percentage}%`;
          case 'value':
            return `${dimensions || category}: ${formattedValue}`;
          case 'both':
            return `${dimensions || category}: ${formattedValue} (${percentage}%)`;
          case 'none':
            return `${dimensions || category}`;
          default:
            return `${dimensions || category}: ${formattedValue}`;
        }
      } catch {
        return '';
      }
    };

    const buildPieLegendItem = (dataContext: any, idx: number): ChartDomScrollLegendItem => {
      let dimensions = '';
      let value = dataContext?.value || 0;
      if (dataContext?.originalData) {
        dimensions = getAllDimensions(dataContext);
      } else {
        const category = dataContext?.category;
        if (category) {
          const originalItem = validData.find((d) => d.category === category);
          if (originalItem?.originalData) {
            const completeContext = {
              value: dataContext.value || originalItem.value,
              originalData: originalItem.originalData,
              category,
            };
            dimensions = getAllDimensions(completeContext);
            value = completeContext.value;
          } else {
            dimensions = category;
          }
        }
      }
      const category = dataContext?.category || dimensions;
      let formattedValue = String(value);
      if (typeof value === 'number') {
        const nf = options.numberFormat || 'adaptive';
        if (nf === 'short') {
          formattedValue = formatNumber(value, { format: 'short' });
        } else if (nf === 'full') {
          formattedValue = formatNumber(value, { format: 'full' });
        } else if (nf === 'decimal') {
          formattedValue = value.toFixed(2);
        } else {
          formattedValue = formatNumber(value, { format: 'short' });
        }
        formattedValue = formatValueWithCurrency(value, formattedValue);
      }
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      const label = dimensions || category;
      const valueLine = `${formattedValue} (${percentage}%)`;
      return {
        id: String(category ?? idx),
        line: formatPieLegendRowForDom(dataContext),
        label,
        valueLine,
        color: activeColors[idx % activeColors.length],
      };
    };

    // Configure labels: multiline name (wrapped to card width) + metric, center-aligned
    series.labels.template.setAll({
      fontSize: PIE_LABEL_FONT_SIZE,
      fontWeight: '600',
      inside: false,
      textType: 'regular',
      centerX: am5.p50,
      centerY: am5.p50,
      textAlign: 'center',
      fill: chartTheme.cardForeground,
    });

    series.labels.template.adapters.add('maxWidth', () => getPieLabelMaxWidthPx());


    // Configure label lines (leader lines) - only show if putLabelsOutside and labelLine are both true
    // Labels are placed outside by default. Enable/disable leader lines based on `labelLine`.
    series.labels.template.set('forceInactive', !showLabels || labelType === 'none');
    if (labelLine && showLabels && labelType !== 'none') {
      series.labels.template.setAll({ textType: 'regular' });
      const labelRadius = (outerRadiusPercent / 100) * 1.05; // 5% beyond outer radius
      series.labels.template.set('radius', labelRadius);
    } else {
      series.labels.template.set('radius', undefined);
    }

    // Add labels - format based on labelType
    // Set adapter BEFORE setting data
    series.labels.template.adapters.add('text', (text, target) => {
      if (labelType === 'none') {
        return '';
      }

      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        return formatMultilineSliceLabel(dataItem.dataContext);
      }
      if (target && (target as any).dataItem) {
        const item = (target as any).dataItem;
        if (item.dataContext) {
          return formatMultilineSliceLabel(item.dataContext);
        }
      }
      return text || '';
    });

    const refreshSliceLabelLayout = () => {
      try {
        rootRef.current?.resize();
        series.labels.each((label) => {
          if (typeof label.markDirty === 'function') label.markDirty();
        });
      } catch {
        // ignore during teardown
      }
    };

    let labelResizeRaf = 0;
    let labelResizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartRef.current) {
      labelResizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(labelResizeRaf);
        labelResizeRaf = requestAnimationFrame(() => refreshSliceLabelLayout());
      });
      labelResizeObserver.observe(chartRef.current);
    }

    // Ensure tooltip and legend both get full originalData
    // CRITICAL FIX: AmCharts may not preserve originalData in dataContext for tooltips
    // Tooltips receive {category, value} but legends receive {category, value, originalData}
    // By ensuring originalData is always present on each data item, AmCharts will preserve it in dataContext
    validData.forEach(d => {
      // Ensure originalData is always present and properly structured
      if (!d.originalData) {
        // If originalData is missing, create it from the item (fallback)
        // This ensures tooltips can still extract dimensions
        d.originalData = { ...d };
      }
      // Ensure originalData is a fresh object that AmCharts will preserve
      // This prevents AmCharts from stripping it during data processing
      d.originalData = { ...d.originalData };
    });

    // Set data after configuring labels
    series.data.setAll(validData);

    // Add total label if showTotal is enabled (after data is set so we can calculate total)
    let totalLabelRef: am5.Label | null = null;
    if (showTotal) {
      // Helper functions are already defined above
      const { code, locale, symbol } = getCurrencyInfo();

      // Format total value
      let formattedTotal = String(total);
      if (typeof total === 'number') {
        if (options.numberFormat === 'short') {
          formattedTotal = formatNumber(total, { format: 'short' });
        } else if (options.numberFormat === 'full') {
          formattedTotal = total.toLocaleString();
        } else if (options.numberFormat === 'decimal') {
          formattedTotal = total.toFixed(2);
        } else {
          formattedTotal = formatNumber(total, { format: 'short' });
        }

        // Apply currency formatting if needed
        if (options.currencyFormat !== 'none') {
          if (options.currencyFormat === 'prefix') {
            formattedTotal = `${symbol}${formattedTotal}`;
          } else if (options.currencyFormat === 'suffix') {
            formattedTotal = `${formattedTotal} ${symbol}`;
          }
        }
      }

      const totalLabel = chart.children.push(
        am5.Label.new(root, {
          text: `Total: ${formattedTotal}`,
          fontSize: 14,
          fontWeight: '600',
          fill: chartTheme.cardForeground,
          centerX: am5.p50,
          centerY: am5.p50,
          x: am5.p50,
          y: am5.p50,
        })
      );
      totalLabelRef = totalLabel;
    }

    chartLiveRefs.current = {
      series,
      totalLabel: totalLabelRef,
      showLegend,
      showSideLegend,
    };

    // Add tooltips - use exact same logic as legend adapter to show identical text
    // Set adapter AFTER setting data to ensure dataContext is properly populated
    series.slices.template.adapters.add('tooltipText', (text, target) => {
      try {
        const dataItem = target.dataItem;
        if (!dataItem) {
          return text || '';
        }

        // Get dataContext - AmCharts stores the original data here
        const dataContext = dataItem.dataContext as any;
        if (!dataContext) {
          return text || '';
        }

        // Use EXACT same logic as legend adapter to ensure identical text
        // Check if originalData exists in dataContext
        if (dataContext.originalData) {
          return formatLabelWithValue(dataContext);
        }

        // Fallback: try to find the original data by matching category
        const category = dataContext.category;
        if (category) {
          const originalItem = validData.find(d => d.category === category);
          if (originalItem && originalItem.originalData) {
            // Create complete dataContext with originalData to ensure getAllDimensions works correctly
            const completeDataContext = {
              value: dataContext.value || originalItem.value,
              originalData: originalItem.originalData,
              category: category,
            };
            return formatLabelWithValue(completeDataContext);
          }
        }

        // If we still don't have originalData, try to format with what we have (same as legend)
        if (dataContext.value !== undefined) {
          const sourceName = dataContext.category || '';
          const formattedValue = typeof dataContext.value === 'number'
            ? formatNumber(dataContext.value)
            : String(dataContext.value || '0');
          return `${sourceName}: ${formattedValue}`;
        }

        return text || '';
      } catch (error) {
        return text || '';
      }
    });

    // Legend rendered in DOM below chart (ChartDomScrollLegend), not in amCharts.

    if (showSideLegend) {
      setPieDomLegend(validData.map((d: any, idx: number) => buildPieLegendItem(d, idx)));
    } else if (showLegend) {
      setPieDomLegend(
        validData.map((d: any, idx: number) => ({
          id: String(d.category ?? idx),
          line: formatPieLegendRowForDom(d),
          color: activeColors[idx % activeColors.length],
        })),
      );
    } else {
      setPieDomLegend([]);
    }
    // normalize defaults (important)
    const effectiveShowLabels = showLabels !== false && labelType !== 'none';
    const effectiveOutside = true; // option removed; labels are outside by default
    const effectiveLabelLine = labelLine !== false; // default true

    if (!effectiveShowLabels) {
      // completely hide labels
      series.labels.template.setAll({
        visible: false,
        forceHidden: true,
      });
      // ensure leader lines are hidden when labels are disabled
      series.ticks.template.setAll({
        visible: false,
        forceHidden: true,
        strokeOpacity: 0,
        length: 0,
      });

    } else {
      // show labels
      series.labels.template.setAll({
        visible: true,
        forceHidden: false,
        fontSize: PIE_LABEL_FONT_SIZE,
        fontWeight: '400',
        text: '{category}: {value}', // overridden by adapter
        inside: !effectiveOutside,
        centerX: am5.p50,
        centerY: am5.p50,
        textAlign: 'center',
      });

      if (effectiveOutside) {
        // labels outside
        series.labels.template.setAll({
          textType: 'regular',
          radius: effectiveLabelLine ? 15 : 6,
        });

        series.ticks.template.setAll({
          visible: effectiveLabelLine,
          strokeOpacity: 0.5,
          length: 10,
        });
      } else {
        // labels inside
        series.labels.template.setAll({
          radius: undefined,
        });
        series.ticks.template.setAll({
          visible: false,
        });
      }
    }


    // Ref so pointerdown fallback does not dispatch when slice click already fired with correct slice
    const pieSliceDispatchedRef = { current: false };

    // Add click handler – resolve dataItem from target or parent (click may land on slice child, e.g. label)
    series.slices.template.events.on('click', (ev) => {
        let target: any = ev.target;
        let dataItem = target?.dataItem;
        while (!dataItem && target?.parent) {
          target = target.parent;
          dataItem = target?.dataItem;
        }
        if (dataItem?.dataContext) {
          pieSliceDispatchedRef.current = true;
            const context = dataItem.dataContext as { category: string; value: number; originalData?: any };
            // Try to infer the original column name that corresponds to this category/value
            const inferColumn = (orig: any, categoryVal: any, valueVal: any) => {
              try {
                if (!orig || typeof orig !== 'object') return null;
                const keys = Object.keys(orig).filter(k => k !== 'value' && k !== 'category');
                // Prefer exact match to category string
                for (const k of keys) {
                  try {
                    if (String(orig[k]) === String(categoryVal)) return k;
                  } catch {}
                }
                // Then try matching numeric value
                for (const k of keys) {
                  try {
                    if (!isNaN(Number(orig[k])) && Number(orig[k]) === Number(valueVal)) return k;
                  } catch {}
                }
                return null;
              } catch {
                return null;
              }
            };
            const inferredColumn = inferColumn(context.originalData ?? context, context.category, context.value);
          try {
            // Notify parent via prop (category value remains for backwards compatibility)
            onChartInteractionRef.current?.('category', context.category);
          } catch (e) {}
          try {
            // Also dispatch a global event so parent listeners (if any) can pick it up even when amCharts events don't propagate
            // Include originalData when available so the formulator can construct drilldown filters without an extra API round-trip
            if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                const detail: any = { field: 'category', value: context.category, originalData: context.originalData ?? context };
                if (inferredColumn) detail.column = inferredColumn;
                try { console.log('PieChart: dispatching pieSliceInteraction', detail); } catch {}
                window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail }));
            }
          } catch (e) { console.log('PieChart: dispatch error', e); }
        }
      });

    // Fallback: amCharts sometimes captures pointer on canvas layers making DOM clicks not reach slice elements.
    // Add a pointerdown capture on the chart container that will attempt to resolve the slice by angle and dispatch the same global event.
    try {
      const capture = (ev: PointerEvent) => {
        try {
          // Ignore right-click/context-menu pointerdown so menu actions don't trigger slice fallback flow.
          if (ev.button === 2 || (ev.button === 0 && ev.ctrlKey)) return;

          pieSliceDispatchedRef.current = false;
          const container = chartRef.current;
          if (!container) return;
          if (!series || !series.dataItems || series.dataItems.length === 0) return;

          const rect = container.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const x = (ev.clientX - rect.left) - cx;
          const y = (ev.clientY - rect.top) - cy;
          // Only treat as slice click when pointer is inside the pie circle (not white space/legend)
          const outerRadiusPercent = options.outerRadius ?? 75;
          const radiusPx = (Math.min(rect.width, rect.height) / 2) * (outerRadiusPercent / 100);
          const distance = Math.sqrt(x * x + y * y);
          if (distance > radiusPx) return;

          const angleRad = Math.atan2(y, x);
          let angleDeg = (angleRad * 180) / Math.PI;
          if (angleDeg < 0) angleDeg += 360;

          // amCharts 5 PieSeries default startAngle is -90 (12 o'clock); use it so we match slice positions
          let startAngleDeg = -90;
          try {
            const raw = (series as any).get?.('startAngle');
            if (raw != null && !isNaN(Number(raw))) {
              const n = Number(raw);
              startAngleDeg = Math.abs(n) <= 2 * Math.PI ? (n * 180) / Math.PI : n;
            }
          } catch (_) {}
          const startNorm = ((startAngleDeg % 360) + 360) % 360;

          const vals = series.dataItems.map((d: any) => Number(d?.dataContext?.value ?? 0));
          const totalVals = vals.reduce((s: number, v: number) => s + (isNaN(v) ? 0 : v), 0);
          if (totalVals <= 0) return;

          let pendingDetail: any = null;
          let acc = startNorm;
          let idx = 0;
          const isSingleSlice = series.dataItems.length === 1;
          for (const di of series.dataItems) {
            const v = isNaN(vals[idx]) ? 0 : vals[idx];
            const arc = (v / totalVals) * 360;
            const end = (acc + arc) % 360;
            const sNorm = ((acc % 360) + 360) % 360;
            const eNorm = ((end % 360) + 360) % 360;
            // Single slice (full circle): sNorm === eNorm, so angle check would only match one point; treat any angle as match
            const fullCircle = isSingleSlice || arc >= 359.99;
            const match = fullCircle
              ? true
              : sNorm <= eNorm
                ? (angleDeg >= sNorm && angleDeg <= eNorm)
                : (angleDeg >= sNorm || angleDeg <= eNorm);
            if (match) {
              const found = (di as any).dataContext;
              if (found && found.category != null) {
                const inferColumn = (orig: any, categoryVal: any, valueVal: any) => {
                  try {
                    if (!orig || typeof orig !== 'object') return null;
                    const keys = Object.keys(orig).filter((k: string) => k !== 'value' && k !== 'category');
                    for (const k of keys) { if (String(orig[k]) === String(categoryVal)) return k; }
                    for (const k of keys) { if (!isNaN(Number(orig[k])) && Number(orig[k]) === Number(valueVal)) return k; }
                  } catch (_) {}
                  return null;
                };
                const inferred = inferColumn(found.originalData ?? found, found.category, found.value);
                pendingDetail = {
                  field: 'category',
                  value: found.category,
                  originalData: found.originalData ?? found,
                  ...(inferred ? { column: inferred } : {}),
                };
              }
              break;
            }
            acc = (acc + arc) % 360;
            idx++;
          }

          // Dispatch fallback only if slice click did not fire (so exact slice from amCharts wins)
          if (pendingDetail) {
            setTimeout(() => {
              if (pieSliceDispatchedRef.current) return;
              if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: pendingDetail }));
              }
            }, 80);
          }
        } catch (e) {
          // swallow errors in capture handler
        }
      };
      pointerdownCaptureRef.current = capture;
      if (chartRef.current) {
        chartRef.current.addEventListener('pointerdown', capture, true);
        chartRef.current.setAttribute('data-pie-capture-added', '1');
      }
    } catch (e) {}

    // Animate on first render only; stream refresh updates slices in place.
    if (!chartHasAppearedRef.current) {
      series.appear(1000, 100);
      chartHasAppearedRef.current = true;
    }

    return () => {
      cancelAnimationFrame(labelResizeRaf);
      labelResizeObserver?.disconnect();
      const el = chartRef.current;
      const handler = pointerdownCaptureRef.current;
      if (el && handler) {
        try {
          el.removeEventListener('pointerdown', handler, true);
          el.removeAttribute('data-pie-capture-added');
        } catch (_) {}
        pointerdownCaptureRef.current = null;
      }
      setPieDomLegend([]);
    };
  }, [data, isDonut, customizationOptions, customizationState, theme, layoutReadyTick, useSavedCustomizationOnly]);

  const liveWindowOptionsRaw =
    !useSavedCustomizationOnly && customizationOptions === undefined && typeof window !== 'undefined'
      ? (window as any).__chartCustomizationOptions
      : null;
  const optionsRaw = {
    ...defaultOptions,
    ...(liveWindowOptionsRaw && typeof liveWindowOptionsRaw === 'object' ? liveWindowOptionsRaw : {}),
    ...(customizationState && typeof customizationState === 'object' ? customizationState : {}),
    ...(customizationOptions && typeof customizationOptions === 'object' ? customizationOptions : {}),
  };
  const showSideLegend = optionsRaw.showSideLegend === true;
  const legendOrientation = showSideLegend
    ? (optionsRaw.sideLegendOrientation || 'right')
    : (optionsRaw.legendOrientation || 'bottom');

  return (
    <div className={`relative flex h-full w-full min-h-0 ${
      legendOrientation === 'left' ? 'flex-row-reverse' :
      legendOrientation === 'right' ? 'flex-row' :
      legendOrientation === 'top' ? 'flex-col-reverse' :
      'flex-col'
    }`}>
      <div ref={chartRef} className="min-h-0 flex-1 w-full" />
      <ChartDomScrollLegend
        visible={pieDomLegend.length > 0}
        items={pieDomLegend}
        orientation={legendOrientation}
        variant={showSideLegend ? 'side-detailed' : 'default'}
      />
    </div>
  );
}



import { useEffect, useRef } from 'react';
import * as React from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatNumber } from '@/utils/numberFormatters';
import type { SunburstCustomizationOptions } from '../customize/sunburstCustomizeTypes';
import { defaultOptions as sunburstDefaultOptions, SUNBURST_COLORS } from '../customize/sunburstCustomizeTypes';
import { useTheme } from '@/context/theme';
import { colorSchemes } from '../../pie/customize/pieColorSchemes';
import { applyAm5InterfaceTheme, probeAmChartThemeColors } from '../../amChartThemeColors';
import { createShinePaletteFromBase, rgbIntToHex } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { shineRadialGradient } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';

/** Match gloss base to hierarchy ColorSet `fill` (same source tooltips use); avoids wrong index vs `chart.dataItems`. */
function hierarchyNodeFillToHex(fill: unknown): string | null {
  try {
    if (fill == null) return null;
    const c = fill as { hex?: number };
    if (typeof c.hex === 'number' && Number.isFinite(c.hex)) {
      return rgbIntToHex(c.hex);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type SunburstChartInput =
  | Array<any>
  | {
      data?: Array<any>;
      columns?: string[];
      dimensions?: unknown;
      hierarchy?: unknown;
      drilldown_applied?: boolean;
    };

interface SunburstChartProps {
  /** Row array or full API response (rows + columns + dimensions/hierarchy). */
  data: SunburstChartInput;
  onChartInteraction?: (field: string, value: any) => void;
  customizationOptions?: SunburstCustomizationOptions;
}

/**
 * Identifies dimension fields from data structure.
 * Dimensions are non-numeric fields that are not aggregated (SUM, COUNT, AVG, etc.)
 */
function identifyDimensionFields(rows: Array<any>, apiColumns?: string[]): string[] {
  if (!rows || rows.length === 0) return [];

  const sample = rows[0] || {};

  // Prefer column order from API if provided, otherwise fall back to object's key order
  const allKeys = Array.isArray(apiColumns) && apiColumns.length ? apiColumns : Object.keys(sample);
  const dimensionFields: string[] = [];

  // Check each field to determine if it's a dimension
  for (const key of allKeys) {
    const upperKey = (key || '').toUpperCase();

    // Skip if field name contains aggregation indicators (e.g. DC_AMOUNT(SUM), SUM(...), ...)
    const hasAggregationPattern = /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upperKey) ||
                                   /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upperKey) ||
                                   /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey) ||
                                   /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey);

    if (hasAggregationPattern) {
      continue;
    }

    // If sample has a numeric value for this key, treat it as non-dimension
    const value = sample[key];
    if (typeof value === 'number') {
      continue;
    }

    // Otherwise treat as a dimension field (preserving order)
    dimensionFields.push(key);
  }

  return dimensionFields;
}

/**
 * Builds tooltip text from dimension fields.
 * - Single dimension: show value directly
 * - Multiple dimensions: concatenate with " | "
 * - Skip null/undefined/empty values
 */
function buildTooltipText(row: any, dimensionFields: string[]): string {
  if (!dimensionFields || dimensionFields.length === 0) {
    return '';
  }

  const values: string[] = [];

  for (const field of dimensionFields) {
    const value = row[field];
    
    // Skip null, undefined, or empty string values
    if (value !== null && value !== undefined && value !== '') {
      values.push(String(value));
    }
  }

  // Join with " | " separator
  return values.join(' | ');
}

export function SunburstChart({ data, onChartInteraction, customizationOptions }: SunburstChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const layoutReadyRef = useRef(false);
  const chartHasAppearedRef = useRef(false);
  const [layoutReadyTick, setLayoutReadyTick] = React.useState(0);
  const [customizationState, setCustomizationState] = React.useState<SunburstCustomizationOptions | undefined>(customizationOptions);

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

  useEffect(() => {
    return () => {
      chartHasAppearedRef.current = false;
    };
  }, []);

  // Listen for customization changes
  React.useEffect(() => {
    const handleCustomizationChange = (event: CustomEvent) => {
      setCustomizationState(event.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);

      // Also check window object on mount
      if ((window as any).__chartCustomizationOptions) {
        setCustomizationState((window as any).__chartCustomizationOptions);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
      }
    };
  }, []);

  // Update state when prop changes
  React.useEffect(() => {
    if (customizationOptions) {
      setCustomizationState(customizationOptions);
    } else if (typeof window !== 'undefined' && (window as any).__chartCustomizationOptions) {
      setCustomizationState((window as any).__chartCustomizationOptions);
    }
  }, [customizationOptions]);

  useEffect(() => {
    if (!chartRef.current || !data || layoutReadyTick === 0) return;

    const containerRect = chartRef.current.getBoundingClientRect();
    if (containerRect.width < 8 || containerRect.height < 8) return;

    // Build a combined options object (defaults <- window <- props <- state)
    const windowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
    const optionsRaw: any = { ...sunburstDefaultOptions, ...windowOpts, ...(customizationOptions as any), ...(customizationState as any) };

    // Support callers passing either an array of rows or the full API response
    // { status, message, data: [...rows], columns: [...], hierarchy: [...] or dimensions: [{columns: 'field1'}, {columns: 'field2'}] }
    let rows: Array<any> = Array.isArray(data) ? data : (data as any).data ?? [];
    const apiColumns: string[] | undefined = !Array.isArray(data) && Array.isArray((data as any).columns) ? (data as any).columns : undefined;
    
    // Extract hierarchy fields - prioritize dimensions from response (for sunburst, dimensions IS the hierarchy)
    // In the API, hierarchy is sent/received as "dimensions" - this is the ordered list of fields for multi-level structure
    let hierarchyFields: string[] | undefined = undefined;
    if (!Array.isArray(data)) {
      // First check for dimensions array (this is what the API returns for sunburst hierarchy)
      if (Array.isArray((data as any).dimensions)) {
        // Extract column names from dimensions array
        // Dimensions can be: [{columns: 'field1'}, {columns: 'field2'}] or ['field1', 'field2']
        hierarchyFields = (data as any).dimensions.map((dim: any) => {
          if (typeof dim === 'string') return dim;
          if (typeof dim === 'object' && dim.columns) return dim.columns;
          return null;
        }).filter((h: any) => h && typeof h === 'string');
      } 
      // Fallback to explicit hierarchy field (for backward compatibility)
      else if (Array.isArray((data as any).hierarchy)) {
        hierarchyFields = (data as any).hierarchy;
      }
    }
    
    if (!rows || rows.length === 0) return;

    const chartTheme = probeAmChartThemeColors();

    // Create root element
    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    rootRef.current = root;

    // Hide amCharts logo
    root._logo?.dispose();
    applyAm5InterfaceTheme(root, chartTheme);

    // Identify dimension fields from the data structure, preserving API column order if present
    const dimensionFields = identifyDimensionFields(rows, apiColumns);
    
    // If no hierarchy found in response, use dimension fields as fallback
    // This ensures sunburst charts work even when backend doesn't return dimensions explicitly
    if (!hierarchyFields && dimensionFields.length > 0) {
      hierarchyFields = dimensionFields;
      // eslint-disable-next-line no-console
      console.debug(' SunburstChart: Using dimension fields as hierarchy fallback');
    }

    // For drilldown responses, always use dimension fields from the current data so the chart
    // shows the drilldown level's categories (e.g. RECONCILIATION_STATUS: UNMATCHED, MATCHED) as separate segments
    const isDrilldownResponse = !Array.isArray(data) && (data as any).drilldown_applied === true;
    if (isDrilldownResponse && dimensionFields.length > 0) {
      hierarchyFields = dimensionFields;
    }

    // Debug: Log hierarchy detection if needed
    if (hierarchyFields && hierarchyFields.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('SunburstChart: Hierarchy fields detected');
    } else {
      // eslint-disable-next-line no-console
      console.debug(' SunburstChart: No hierarchy fields found');
    }

    // Convert input into hierarchical structure for sunburst.
    // Support multiple shapes:
    // 1) already structured: [{ category, value, originalData }]
    // 2) raw rows from API with hierarchy: [{ field1, field2, "AMOUNT(SUM)" }, ...]
    // 3) raw rows from API (legacy): [{ SOURCE_NAME, createdTS, "DC_AMOUNT(SUM)" }, ...]
    let hierarchicalData: any = { name: 'Total', value: 0, children: [] };

    if (rows && rows.length > 0) {
      const sample = rows[0];

      // If hierarchy fields are provided, build multi-level structure based on hierarchy
      if (hierarchyFields && hierarchyFields.length > 0) {
        // Find the metric/value column (aggregated column)
        const sampleKeys = apiColumns && apiColumns.length ? apiColumns : Object.keys(sample);
        const isAggregatedColumn = (key: string): boolean => {
          return key.includes('(') && key.includes(')');
        };
        
        const metricKey = sampleKeys.find((key) => {
          if (!isAggregatedColumn(key)) return false;
          const val = sample[key];
          return typeof val === 'number' && !isNaN(val);
        });

        if (metricKey) {
          // Build an N-level hierarchy based on `hierarchyFields` (or dimensionFields fallback).
          // At the deepest level, aggregate metric values; intermediate nodes roll up child totals.
          const buildHierarchy = (items: any[], level: number): any[] => {
            const field = hierarchyFields[level];
            const groups = new Map<string, any[]>();
            items.forEach((it) => {
              const key = String(it[field] ?? 'Unknown');
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(it);
            });

            const nodes: any[] = [];
              for (const [key, groupItems] of Array.from(groups.entries())) {
              if (level === hierarchyFields.length - 1) {
                // Leaf level: sum metric for group
                const sum = groupItems.reduce((s: number, r: any) => s + (Number(r[metricKey]) || 0), 0);
                if (sum > 0) nodes.push({ name: key, value: sum, originalData: groupItems[0], drillColumn: field, drillValue: key });
              } else {
                // Recurse
                const children = buildHierarchy(groupItems, level + 1);
                const total = children.reduce((s: number, c: any) => s + (c.value || 0), 0);
                if (children.length > 0) {
                  nodes.push({ name: key, value: total, children, originalData: groupItems[0], drillColumn: field, drillValue: key });
                } else {
                  // No deeper children found (all zeros), fall back to summing metric directly
                  const sum = groupItems.reduce((s: number, r: any) => s + (Number(r[metricKey]) || 0), 0);
                  if (sum > 0) nodes.push({ name: key, value: sum, originalData: groupItems[0], drillColumn: field, drillValue: key });
                }
              }
            }
            return nodes;
          };

          const children = buildHierarchy(rows, 0);

          // Collapse redundant child nodes where child.name === parent.name by promoting grandchildren or merging values.
          const collapseDuplicates = (node: any) => {
            if (!node || !Array.isArray(node.children)) return;
            let newChildren: any[] = [];
            for (const child of node.children) {
              collapseDuplicates(child);
              if (child.name === node.name) {
                if (Array.isArray(child.children) && child.children.length > 0) {
                  // promote grandchildren
                  for (const gc of child.children) newChildren.push(gc);
                } else {
                  // merge value into parent
                  node.value = (node.value || 0) + (child.value || 0);
                }
              } else {
                newChildren.push(child);
              }
            }
            node.children = newChildren;
            // ensure node.value matches children sum if children exist
            if (Array.isArray(node.children) && node.children.length > 0) {
              node.value = node.children.reduce((s: number, c: any) => s + (c.value || 0), 0);
            }
          };

          if (children.length === 1) {
            const rootChild = children[0];
            const rootNode = { name: 'Total', value: rootChild.value || 0, children: [rootChild] };
            collapseDuplicates(rootNode);
            hierarchicalData = rootNode;
          } else {
            const rootNode = { name: 'Total', value: children.reduce((s: number, c: any) => s + (c.value || 0), 0), children };
            collapseDuplicates(rootNode);
            hierarchicalData = rootNode;
          }
        } else {
          console.warn('SunburstChart: No aggregated metric column found for hierarchy-based structure');
        }
      } else {
        // Detect common raw API shape
        const sampleKeys = apiColumns && apiColumns.length ? apiColumns : Object.keys(sample);
        const hasSource = sampleKeys.some((k) => k.toUpperCase().includes('SOURCE_NAME'));
        const hasAmount = sampleKeys.some((k) => /DC_AMOUNT|AMOUNT/i.test(k));

        if (hasSource && hasAmount) {
          // find keys
          const sourceKey = (apiColumns && apiColumns.find((k) => k.toUpperCase().includes('SOURCE_NAME'))) || Object.keys(sample).find((k) => k.toUpperCase().includes('SOURCE_NAME')) as string;
          const amountKey = (apiColumns && apiColumns.find((k) => /DC_AMOUNT|AMOUNT/i.test(k))) || Object.keys(sample).find((k) => /DC_AMOUNT|AMOUNT/i.test(k)) as string;

          const groups = new Map<string, { name: string; value: number; children: any[]; dimensionText?: string; originalData?: any }>();
          let total = 0;

          rows.forEach((row: any, idx: number) => {
            const source = (row[sourceKey] ?? 'Unknown') as string;
            const rawAmount = row[amountKey];
            const amount = Number(rawAmount) || 0;
            total += amount;

            // Build tooltip text from dimension fields
            const dimensionText = buildTooltipText(row, dimensionFields);

            if (!groups.has(source)) {
              groups.set(source, {
                name: source,
                value: 0,
                children: [],
                // dimensionText computed after grouping
                dimensionText: undefined,
                originalData: row,
              });
            }

            const group = groups.get(source)!;
            group.value += amount;
            group.children.push({
              name: row.createdTS ? String(row.createdTS) : `Item ${idx + 1}`,
              value: amount,
              dimensionText: dimensionText,
              originalData: row,
            });
          });

          // After grouping, compute a combined dimensionText for each group
          // Preserve the order of `dimensionFields` (which itself respects API column order when available)
          groups.forEach((g) => {
            const parts: string[] = [];

            for (const field of dimensionFields) {
              const vals = new Set<string>();
              g.children.forEach((child: any) => {
                const od = child.originalData || {};
                const v = od[field];
                if (v !== null && v !== undefined && v !== '') vals.add(String(v));
              });
              if (vals.size > 0) {
                parts.push(Array.from(vals).join(', '));
              }
            }

            if (parts.length > 0) {
              g.dimensionText = parts.join(' | ');
            } else {
              g.dimensionText = g.name;
            }
          });

          // Attach drill metadata to top-level groups so clicks can be translated
          // into a specific column/value filter upstream (no hardcoding).
          const groupNodes = Array.from(groups.values()).map((g) => ({ ...g, drillColumn: sourceKey, drillValue: g.name }));
          hierarchicalData = { name: 'Total', value: total, children: groupNodes };
        } else if (
          // already-structured items: have category & value keys
          Object.prototype.hasOwnProperty.call(sample, 'category') &&
          Object.prototype.hasOwnProperty.call(sample, 'value')
        ) {
          const totalValue = rows.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
          // Infer a reasonable drill column (first hierarchy or dimension field)
          const inferredColumn = (hierarchyFields && hierarchyFields[0]) || (dimensionFields && dimensionFields[0]) || null;
          hierarchicalData = {
            name: 'Total',
            value: totalValue,
            children: rows.map((item: any) => {
              const originalRow = item.originalData ?? item;
              const dimensionText = buildTooltipText(originalRow, dimensionFields);
              return {
                name: item.category || 'Unknown',
                value: item.value || 0,
                dimensionText: dimensionText || item.category || 'Unknown',
                originalData: originalRow,
                drillColumn: inferredColumn,
                drillValue: item.category || 'Unknown',
              };
            }),
          };
        } else {
          // Fallback: try to map objects with numeric value-like fields
          const amountKey = Object.keys(sample).find((k) => /value|amount|dc_amount/i.test(k));
          const nameKey = Object.keys(sample).find((k) => /name|category|source/i.test(k));
          if (amountKey && nameKey) {
            const total = rows.reduce((s: number, r: any) => s + (Number(r[amountKey]) || 0), 0);
            hierarchicalData = {
              name: 'Total',
              value: total,
              children: rows.map((r: any) => {
                  const dimensionText = buildTooltipText(r, dimensionFields);
                  return {
                    name: r[nameKey] ?? 'Unknown',
                    value: Number(r[amountKey]) || 0,
                    dimensionText: dimensionText || (r[nameKey] ?? 'Unknown'),
                    originalData: r,
                    drillColumn: nameKey,
                    drillValue: r[nameKey] ?? 'Unknown',
                  };
                }),
            };
          }
        }
      }
    }

    // Detect number of hierarchy levels (excluding root) so we can render one ring per level.
    const getDepth = (node: any): number => {
      if (!node || !node.children || node.children.length === 0) return 0;
      const childDepths = node.children.map((c: any) => getDepth(c));
      return 1 + Math.max(...childDepths);
    };

    const detectedLevels = Math.max(1, getDepth(hierarchicalData));

    // Create container for chart and legend
    const container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout,
      })
    );

    // Create sunburst chart
    const chart = container.children.push(
      am5hierarchy.Sunburst.new(root, {
        singleBranchOnly: false,
        // Automatically set initialDepth/downDepth to the detected number of levels
        // so one concentric ring is rendered per hierarchy level.
        downDepth: detectedLevels,
        initialDepth: detectedLevels,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        width: am5.percent(100),
        height: am5.percent(85),
      })
    );

    // Dedupe only same slice within a short window so different slices always trigger drilldown
    const dispatchDrilldown = (detail: any) => {
      try {
        const now = Date.now();
        const last = (chartRef as any)._lastDispatch as { ts: number; key: string } | undefined;
        const key = JSON.stringify(detail?.payload ?? detail);
        if (last && last.key === key && now - last.ts < 400) return;
        (chartRef as any)._lastDispatch = { ts: now, key };
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sunburstDrilldown', { detail, bubbles: true }));
        }
      } catch (e) {
        // ignore
      }
    };

    // Diagnostic: attach DOM-level capture listener and deduped dispatch helper
    try {
      // eslint-disable-next-line no-console
      console.debug('SunburstChart: amCharts sunburst created', { detectedLevels });
      if (chartRef.current && typeof chartRef.current.addEventListener === 'function') {
        // Store last hovered slice context on DOM ref so series-level attachments can update it too
        (chartRef as any)._lastHover = null;

        try {
          if (chart && (chart as any).slices && (chart as any).slices.template && (chart as any).slices.template.events) {
            (chart as any).slices.template.events.on('pointerover', (ev: any) => {
              try { (chartRef as any)._lastHover = ev?.target?.dataItem?.dataContext ?? null; } catch { (chartRef as any)._lastHover = null; }
            });
            (chart as any).slices.template.events.on('pointermove', (ev: any) => {
              try { (chartRef as any)._lastHover = ev?.target?.dataItem?.dataContext ?? (chartRef as any)._lastHover; } catch { /* ignore */ }
            });
            (chart as any).slices.template.events.on('pointerout', () => { (chartRef as any)._lastHover = null; });
            // Pin exact slice on pointerdown so click uses the slice under the pointer, not a stale hover
            (chart as any).slices.template.events.on('pointerdown', (ev: any) => {
              try {
                const ctx = ev?.target?.dataItem?.dataContext ?? null;
                if (ctx) (chartRef as any)._clickSlice = ctx;
              } catch { (chartRef as any)._clickSlice = null; }
            });
            (chart as any).slices.template.events.on('pointerup', () => { (chartRef as any)._clickSlice = null; });
          }
        } catch (e) {
          // ignore attach errors
        }

        const domClickCapture = (ev: MouseEvent) => {
          try {
            const clickSlice = (chartRef as any)._clickSlice;
            const lastHoverDataContext = clickSlice ?? (chartRef as any)._lastHover;
            const context = lastHoverDataContext as any;
            // Only call drilldown when user clicked an actual chart slice (has slice context), not white space
            if (!context) return;
            let detail: any;
            if (context.originalData) {
              detail = { type: 'row', payload: context.originalData };
            } else if (context.drillColumn && context.drillValue !== undefined) {
              detail = { type: 'category', payload: { column: context.drillColumn, value: context.drillValue } };
            } else if (context.name != null || context.value != null) {
              detail = { type: 'category', payload: context.name ?? context.value ?? '' };
            } else if (typeof context === 'object' && Object.keys(context).length > 0) {
              detail = { type: 'row', payload: context };
            } else {
              return;
            }
            dispatchDrilldown(detail);
          } catch (e) {
            // ignore
          }
        };
        // attach in capture phase to catch events before other handlers
        chartRef.current.addEventListener('click', domClickCapture, true);
        // store ref for cleanup on dispose
        (chartRef as any)._domClickCapture = domClickCapture;

      }
    } catch (e) {
      // ignore diagnostic attach errors
    }

    // Root-level event handler (catches slice events so all slices trigger drilldown, including inner/outer rings)
    try {
      const rootEventHandler = (ev: any) => {
        try {
          let target: any = ev?.target;
          let dataItem = target?.dataItem;
          while (!dataItem && target?.parent) {
            target = target.parent;
            dataItem = target?.dataItem;
          }
          if (dataItem && dataItem.dataContext) {
            const context = dataItem.dataContext as any;
            let detail: any;
            if (context.originalData) {
              detail = { type: 'row', payload: context.originalData };
            } else if (context.drillColumn && context.drillValue !== undefined) {
              detail = { type: 'category', payload: { column: context.drillColumn, value: context.drillValue } };
            } else {
              detail = { type: 'category', payload: context.name ?? context.value ?? '' };
            }
            dispatchDrilldown(detail);
          }
        } catch (e) {
          // ignore
        }
      };

      try { (root.events as any).on('pointerup', rootEventHandler); } catch (e) {}
      try { (root.events as any).on('click', rootEventHandler); } catch (e) {}
    } catch (e) {
      // ignore root-level attach errors
    }

    // Fixed palette (no color-scheme picker); resolve CSS vars in hex strings if present
    const getCssVar = (name: string) => {
      try {
        if (typeof window === 'undefined') return '';
        const val = getComputedStyle(document.documentElement).getPropertyValue(name);
        return val ? val.trim() : '';
      } catch {
        return '';
      }
    };
    const resolveColorString = (input?: string) => {
      try {
        if (!input) return '';
        const s = String(input).trim();
        if (!s) return '';
        if (s.startsWith('--')) return getCssVar(s) || s;
        const varMatch = s.match(/var\((--[^),]+)\)/);
        if (varMatch) return getCssVar(varMatch[1]) || s;
        return s;
      } catch {
        return String(input || '');
      }
    };
    const colorSchemeKey = optionsRaw.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : [...SUNBURST_COLORS];

    const resolvedPalette = [...activeColors].map(resolveColorString).filter(Boolean);

    const paletteHex = resolvedPalette.length ? resolvedPalette : [...activeColors];
    try {
      const amColors = paletteHex.map((c) => {
        try {
          return am5.color(c);
        } catch {
          return am5.color(0x888888);
        }
      });
      const colorSet = am5.ColorSet.new(root, { colors: amColors as any });
      chart.set('colors', colorSet);
      chart.get('colors')?.set('colors', amColors);
      chart.get('colors')?.set('step', 1);
    } catch (e) {
      try {
        chart.get('colors')?.set('step', 1);
      } catch {}
    }

    // Radial gloss using the same base as ColorSet (sprite fill / dataItem fill — aligns with tooltip tint)
    try {
      chart.slices.template.adapters.add('fillGradient', (_fillGradient, target) => {
        const di = target.dataItem as { get?: (k: string) => unknown } | null;
        if (!di || typeof di.get !== 'function') return undefined;
        const spriteFill = typeof (target as { get?: (k: string) => unknown }).get === 'function'
          ? (target as { get: (k: string) => unknown }).get('fill')
          : undefined;
        let baseHex =
          hierarchyNodeFillToHex(spriteFill) ||
          hierarchyNodeFillToHex(di.get('fill'));
        if (!baseHex) {
          let idx = chart.dataItems.indexOf(di as (typeof chart.dataItems)[number]);
          if (idx < 0) idx = Number(di.get('index') ?? 0);
          baseHex = paletteHex[Math.abs(idx) % paletteHex.length] ?? activeColors[0];
        }
        return shineRadialGradient(root, am5, createShinePaletteFromBase(baseHex));
      });
    } catch {
      /* ignore */
    }
    
    // Configure labels based on customization options
    const fontSize = optionsRaw.fontSize || 12;
    const showLabels = optionsRaw.showLabels !== undefined ? optionsRaw.showLabels : true;
    chart.labels.template.setAll({
      fontSize: fontSize,
      fill: chartTheme.cardForeground,
      visible: showLabels,
    });

    // Configure tooltips with formatted values; stroke between slices matches page background
    const sliceStrokeColor = chartTheme.background;
    chart.slices.template.setAll({
      cursorOverStyle: 'pointer',
      interactive: true,
      stroke: sliceStrokeColor,
      strokeWidth: 1,
      shadowColor: am5.color(0x000000),
      shadowBlur: 4,
      shadowOpacity: 0.12,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });

    // Format tooltip with dimension fields and formatted value
    const numberFormat = optionsRaw.numberFormat || 'adaptive';
    // Currency helpers (respect options: currencyFormat: prefix|suffix|none, currencySymbol: "$ (USD)")
    const getCurrencyInfo = (): { code: string; locale: string; symbol: string } => {
      const currencyOption = optionsRaw.currencySymbol || '(USD)';
      const codeMatch = String(currencyOption).match(/\(([A-Z]{3})\)/);
      const code = codeMatch ? codeMatch[1] : 'USD';
      const symbolMatch = String(currencyOption).match(/^([^\s(]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : '';
      const localeMap: Record<string, string> = {
        'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'JPY': 'ja-JP', 'CNY': 'zh-CN', 'INR': 'en-IN',
        'AUD': 'en-AU', 'CAD': 'en-CA', 'CHF': 'de-CH', 'SGD': 'en-SG',
      };
      const locale = localeMap[code] || 'en-US';
      return { code, locale, symbol };
    };

    const formatValueWithCurrency = (value: number, numericString: string): string => {
      const currencyFormat = optionsRaw.currencyFormat || 'none';
      const { code, locale, symbol } = getCurrencyInfo();

      // If user disabled currency in UI
      if (currencyFormat === 'none') return numericString;

      // When numberFormat is 'full' prefer Intl currency formatting for correctness
      if (numberFormat === 'full' && currencyFormat !== 'none') {
        try {
          const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return formatter.format(value);
        } catch (e) {
          // fall back
        }
      }

      if (currencyFormat === 'prefix') return `${symbol}${numericString}`;
      if (currencyFormat === 'suffix') return `${numericString} ${symbol}`;
      return numericString;
    };
    // Also configure slice labels to include formatted value according to `numberFormat`
    chart.labels.template.adapters.add('text', (text, target) => {
      try {
        const dataItem = (target as any).dataItem;
        if (dataItem && dataItem.dataContext) {
          const ctx = dataItem.dataContext as any;
          if (typeof ctx.value === 'number') {
            // For `adaptive` we intentionally show only the name (no metric value)
            if (numberFormat === 'adaptive') {
              return ctx.name || text || '';
            }

            let formattedValue = '';

            if (numberFormat === 'decimal') {
              // Always show two decimal places for `decimal`
              formattedValue = ctx.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (numberFormat === 'full') {
              // Full: show as integer when possible, otherwise up to 2 decimals
              formattedValue = (Math.abs(ctx.value - Math.round(ctx.value)) < 1e-9)
                ? Math.round(ctx.value).toLocaleString()
                : Number(ctx.value.toFixed(2)).toLocaleString();
            } else if (numberFormat === 'short') {
              formattedValue = formatNumber(ctx.value, { format: 'short' });
            } else {
              // Fallback: use short formatting
              formattedValue = formatNumber(ctx.value, { format: 'short' });
            }

            // Apply currency formatting if requested
            const labeled = formatValueWithCurrency(ctx.value, formattedValue);
            return `${ctx.name} ${labeled}`;
          }
          return ctx.name || text || '';
        }
      } catch (e) {
        // ignore adapter errors and fall back to default
      }
      return text || '';
    });
    chart.slices.template.adapters.add('tooltipText', (text, target) => {
      if (target.dataItem) {
        const dataContext = target.dataItem.dataContext as any;
        if (dataContext && typeof dataContext.value === 'number') {
          const numericPart = formatNumber(dataContext.value, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
          const formattedValue = formatValueWithCurrency(dataContext.value, numericPart);
          
          // Use dimensionText if available (built from dimension fields)
          // Otherwise fall back to name, or build from originalData if available
          let tooltipLabel = '';
          
          if (dataContext.dimensionText) {
            tooltipLabel = dataContext.dimensionText;
          } else if (dataContext.originalData && dimensionFields.length > 0) {
            tooltipLabel = buildTooltipText(dataContext.originalData, dimensionFields);
          } else {
            tooltipLabel = dataContext.name || '';
          }
          
          // If we have a label, show it with the value; otherwise just show the value
          if (tooltipLabel) {
            return `${tooltipLabel}: ${formattedValue}`;
          } else {
            return formattedValue;
          }
        }
      }
      return text || '';
    });

    // Set chart data
    chart.data.setAll([hierarchicalData]);

    // Optionally display total value (top of chart) when enabled in customization
    const showTotal = optionsRaw.showTotal !== undefined ? optionsRaw.showTotal : false;
    let totalLabel: any = null;
    if (showTotal) {
      // Compute total by recursively summing all leaves to ensure full-hierarchy total
      const sumAll = (node: any): number => {
        if (!node) return 0;
        if (Array.isArray(node.children) && node.children.length > 0) {
          return node.children.reduce((s: number, c: any) => s + sumAll(c), 0);
        }
        return Number(node.value) || 0;
      };

      const totalNumeric = sumAll(hierarchicalData);
      const numericPart = formatNumber(totalNumeric, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
      const formattedTotal = formatValueWithCurrency(totalNumeric, numericPart);
      try {
        totalLabel = container.children.push(
          am5.Label.new(root, {
            text: `Total: ${formattedTotal}`,
            fontSize: fontSize,
            x: am5.percent(50),
            centerX: am5.p50,
            y: am5.percent(2),
            centerY: 0,
            fill: chartTheme.cardForeground,
          })
        );
      } catch (e) {
        // ignore label creation errors
      }
    }

    // Add legend at the bottom of the container (if enabled)
    const showLegend = optionsRaw.showLegend !== undefined ? optionsRaw.showLegend : true;
    const legend = showLegend ? container.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        width: am5.percent(100),
        layout: root.horizontalLayout,
        marginTop: 10,
      })
    ) : null;

    // Style legend items BEFORE setting data (guard in case legend is null)
    if (legend) {
      legend.itemContainers.template.setAll({
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
        cursorOverStyle: 'pointer',
      });

      // Add hover state
      legend.itemContainers.template.states.create('hover', {});
    }

    // Format legend text to show category, formatted value, and percentage
    if (legend) {
      const totalValue = hierarchicalData?.value ?? 0;
      legend.labels.template.adapters.add('text', (text, target) => {
        const dataItem = target.dataItem;
        if (dataItem && dataItem.dataContext) {
          const context = dataItem.dataContext as { name: string; value: number };
          const numericPart = formatNumber(context.value, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
          const formattedValue = formatValueWithCurrency(context.value, numericPart);
          const percentage = totalValue > 0 ? ((context.value / totalValue) * 100).toFixed(2) : '0.00';
          return `${context.name} ${formattedValue} (${percentage}%)`;
        }
        return text || '';
      });

      // Style legend labels with consistent font size for text and numbers
      // Set fontSize AFTER adapter to ensure it applies to the formatted text
      legend.labels.template.setAll({
        fontSize: fontSize,
        fontWeight: '400',
        fill: chartTheme.cardForeground,
      });

      // Style legend markers
      legend.markers.template.setAll({
        width: 14,
        height: 14,
      });

      // Wait for chart data to be processed, then populate legend
      setTimeout(() => {
        const childItems = chart.dataItems.filter((item) => item.get('depth') === 1);
        
        if (childItems.length > 0) {
          legend.data.setAll(childItems);
          
          // Ensure all legend labels have consistent font size after data is set
          setTimeout(() => {
            legend.labels.each((label) => {
              label.set('fontSize', fontSize);
              label.set('fontWeight', '400');
              label.set('fill', chartTheme.cardForeground);
            });
          }, 50);
          
          // Make legend items interactive after data is set
          legend.itemContainers.template.events.on('click', (ev) => {
            const target = ev.target;
            if (target.dataItem && target.dataItem.dataContext) {
              const clickedItem = target.dataItem.dataContext as any;
              const slice = clickedItem.get('slice');
              if (slice) {
                if (slice.isHidden()) {
                  slice.show();
                } else {
                  slice.hide();
                }
              }
            }
          });
        }
      }, 100);
    }

    // Add click handler — return category or original row if available
    // Click handler: notify parent via prop AND emit a deduped global event
    const sliceClickHandler = (ev: any) => {
      try {
        const target = ev?.target;
        const dataItem = target?.dataItem;
        if (dataItem && dataItem.dataContext) {
          const context = dataItem.dataContext as any;

          // Only emit the global drilldown event; prefer explicit column/value
          // when available so upstream formulator can create a single filter.
          try {
            let detail: any;
            if (context.originalData) {
              detail = { type: 'row', payload: context.originalData };
            } else if (context.drillColumn && context.drillValue !== undefined) {
              detail = { type: 'category', payload: { column: context.drillColumn, value: context.drillValue } };
            } else {
              detail = { type: 'category', payload: context.name };
            }
            dispatchDrilldown(detail);
          } catch (e) {
            // ignore dispatch errors
          }
        }
      } catch (e) {
        // ignore
      }
    };

    // Attach handler to chart.slices.template if present (listen to multiple event types)
    try {
      if (chart && (chart as any).slices && (chart as any).slices.template && (chart as any).slices.template.events) {
        const types = ['click', 'pointerup', 'pointerdown', 'hit', 'tap'];
        types.forEach((t) => {
          try { (chart as any).slices.template.events.on(t, sliceClickHandler); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) {
      // ignore
    }

    // Also attach to each series' slice template (covers amcharts internal series implementations)
    try {
      if ((chart as any).series && typeof (chart as any).series.each === 'function') {
        (chart as any).series.each((s: any) => {
          try {
            if (s && s.slices && s.slices.template && s.slices.template.events) {
              const types = ['click', 'pointerup', 'pointerdown', 'hit', 'tap'];
              types.forEach((t: string) => {
                try { s.slices.template.events.on(t, sliceClickHandler); } catch (e) { /* ignore */ }
              });
              // Also populate last-hover ref from per-series templates (covers alternative internal series)
              try {
                s.slices.template.events.on('pointerover', (ev: any) => {
                  try { (chartRef as any)._lastHover = ev?.target?.dataItem?.dataContext ?? null; } catch { (chartRef as any)._lastHover = null; }
                });
                s.slices.template.events.on('pointermove', (ev: any) => {
                  try { (chartRef as any)._lastHover = ev?.target?.dataItem?.dataContext ?? (chartRef as any)._lastHover; } catch { /* ignore */ }
                });
                s.slices.template.events.on('pointerout', () => { (chartRef as any)._lastHover = null; });
              } catch (ee2) {
                // ignore per-series pointer attach errors
              }
            }
          } catch (ee) {
            // ignore per-series attach errors
          }
        });
      }
    } catch (e) {
      // ignore
    }

    const isStreamRefresh =
      typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);
    if (isStreamRefresh) {
      try {
        (window as any).__chartStreamSilentRefresh = false;
      } catch {
        /* ignore */
      }
    }

    // Animate if enabled (skip entrance animation on interval refresh / resize rebuild)
    const animation = optionsRaw.animation !== undefined ? optionsRaw.animation : true;
    if (animation && !isStreamRefresh && !chartHasAppearedRef.current) {
      chart.appear(1000, 100);
      chartHasAppearedRef.current = true;
    }

    let resizeRaf = 0;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartRef.current) {
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          try {
            rootRef.current?.resize();
          } catch {
            /* ignore during teardown */
          }
        });
      });
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      cancelAnimationFrame(resizeRaf);
      resizeObserver?.disconnect();
      if (totalLabel) {
        try { totalLabel.dispose(); } catch {}
        totalLabel = null;
      }
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data, onChartInteraction, customizationState, customizationOptions, theme, layoutReadyTick]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div ref={chartRef} className="min-h-0 flex-1 w-full" />
    </div>
  );
}


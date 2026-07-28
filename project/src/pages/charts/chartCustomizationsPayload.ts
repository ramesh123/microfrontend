import {
  BIG_NUMBER_CUSTOMIZATION_KEYS,
  BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS,
  buildBigNumberStreamCustomizationPayload,
  defaultOptions as bigNumberDefaultOptions,
  hasExplicitBigNumberCardColor,
} from './components/charts/bigNumber';
import { normalizeBigNumberIconPositionCustomizations } from './components/charts/bigNumber/utils/bigNumberFreeIconPosition';
import { buildGaugeCustomizationPayload } from './components/charts/gauge';
import { buildPieCustomizationPayload } from './components/charts/pie';
import { PIE_CUSTOMIZATION_KEYS } from './components/charts/pie/utils/pieCustomizationPayload';
import { buildSunburstCustomizationPayload, SUNBURST_CUSTOMIZATION_KEYS } from './components/charts/sunburst';
import { buildFunnelCustomizationPayload, FUNNEL_CUSTOMIZATION_KEYS } from './components/charts/funnel';
import { buildBarCustomizationPayload } from './components/charts/bar';
import { buildLineCustomizationPayload } from './components/charts/line';
import { buildAreaCustomizationPayload } from './components/charts/area';
import { defaultOptions as tablePivotDefaultOptions } from './components/charts/pivot';
import { isPieDonutOrRadiusPieChart } from './chartVizTypes';
import type { CreateChartPayload } from '../Visualization/API/chartsApi';
import { isDashboardWidgetParamKey } from '../Dashboards/utils/dashboardWidgetParamKeys';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Read live customize-panel values (window store is updated on every swatch click). */
export function getWindowChartCustomizations(): ChartCustomizationsDict | null {
  if (typeof window === 'undefined') return null;
  const w = (window as any).__chartCustomizationOptions;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  return Object.keys(w).length > 0 ? (w as ChartCustomizationsDict) : null;
}

/** Normalize saved API value from `customization` on chart row or nested payload. */
export function getSavedChartCustomizations(source: unknown): ChartCustomizationsDict | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const o = source as Record<string, unknown>;
  const nested = o.customization;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as ChartCustomizationsDict;
  }
  const wrapperKeys = ['chart_name', 'visualization_name', 'params', 'flow_id', 'id', 'stmt_date', 'chart_type'];
  const hasWrapper = wrapperKeys.some((k) => k in o);
  if (!hasWrapper && Object.keys(o).length > 0) {
    return o as ChartCustomizationsDict;
  }
  return null;
}

function pickCustomizationKeys(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): ChartCustomizationsDict {
  if (!source) return {};
  const out: ChartCustomizationsDict = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function pickCustomizationFromParams(
  params: Record<string, unknown> | null | undefined,
  hint: string,
): ChartCustomizationsDict {
  if (!params) return {};
  if (isBigNumberStreamChartType(hint)) {
    return {
      ...pickCustomizationKeys(params, BIG_NUMBER_CUSTOMIZATION_KEYS),
      ...pickCustomizationKeys(params, BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS),
      ...pickCustomizationKeys(params, ['cardBackgroundColor', 'cardBackgroundStyle', 'bgOpacity']),
    };
  }
  if (isBigNumberChartType(hint)) {
    return pickCustomizationKeys(params, BIG_NUMBER_CUSTOMIZATION_KEYS);
  }
  if (isPieDonutOrRadiusPieChart(hint)) {
    return pickCustomizationKeys(params, PIE_CUSTOMIZATION_KEYS);
  }
  if (isSunburstChartType(hint)) {
    return pickCustomizationKeys(params, SUNBURST_CUSTOMIZATION_KEYS);
  }
  if (isFunnelChartType(hint)) {
    return pickCustomizationKeys(params, FUNNEL_CUSTOMIZATION_KEYS);
  }
  return {};
}

function isBigNumberStreamChartType(hint?: string): boolean {
  const h = (hint || '').toLowerCase();
  return /big_number_stream|big number stream/.test(h);
}

function isBigNumberChartType(hint?: string): boolean {
  const h = (hint || '').toLowerCase();
  if (isBigNumberStreamChartType(h)) return false;
  return /big|number|kpi|bignumber/.test(h);
}

function isGaugeChartType(hint?: string): boolean {
  return /gauge/.test((hint || '').toLowerCase());
}

function isSunburstChartType(hint?: string): boolean {
  return /sunburst/.test((hint || '').toLowerCase());
}

function isFunnelChartType(hint?: string): boolean {
  return /funnel/.test((hint || '').toLowerCase());
}

function isBarChartType(hint?: string): boolean {
  const h = (hint || '').toLowerCase();
  return h.includes('bar') || h.includes('column');
}

function isLineChartType(hint?: string): boolean {
  return /line/.test((hint || '').toLowerCase());
}

function isAreaChartType(hint?: string): boolean {
  return /area/.test((hint || '').toLowerCase());
}

function isPivotChartType(hint?: string): boolean {
  return /pivot/.test((hint || '').toLowerCase());
}

function isTableChartType(hint?: string): boolean {
  const h = (hint || '').toLowerCase();
  return h.includes('table') && !h.includes('pivot');
}

/** Merge saved + React state + window; apply big-number defaults when relevant. */
export function resolveChartCustomizationsForApi(
  stateOptions?: unknown,
  savedOptions?: ChartCustomizationsDict | null,
  chartTypeHint?: string,
  ignoreWindowOptions = false,
): ChartCustomizationsDict | undefined {
  const state =
    stateOptions && typeof stateOptions === 'object' && !Array.isArray(stateOptions) && Object.keys(stateOptions as object).length > 0
      ? (stateOptions as ChartCustomizationsDict)
      : null;
  const win = ignoreWindowOptions ? null : getWindowChartCustomizations();
  const saved = savedOptions && Object.keys(savedOptions).length > 0 ? savedOptions : null;

  let merged: ChartCustomizationsDict = {
    ...(saved || {}),
    ...(state || {}),
    ...(win || {}),
  };

  if (isBigNumberStreamChartType(chartTypeHint)) {
    merged = buildBigNumberStreamCustomizationPayload(merged);
    merged = normalizeBigNumberIconPositionCustomizations(merged);
  } else if (isGaugeChartType(chartTypeHint)) {
    merged = buildGaugeCustomizationPayload(merged);
  } else if (isBigNumberChartType(chartTypeHint)) {
    merged = { ...bigNumberDefaultOptions, ...merged };
    // Persist explicit white reset; strip other colour keys when user never chose a swatch.
    if (!hasExplicitBigNumberCardColor(merged)) {
      if (merged.cardColorScheme === 'theme') {
        const {
          cardBackgroundColor: _b,
          cardBackgroundImage: _i,
          backgroundOpacity: _o,
          bgOpacity: _bo,
          ...rest
        } = merged;
        merged = { ...rest, cardColorScheme: 'theme', cardBackgroundStyle: 'shine' };
      } else {
        const { cardColorScheme: _s, cardBackgroundColor: _b, backgroundOpacity: _o, bgOpacity: _bo, ...rest } =
          merged;
        merged = rest;
      }
    }
    merged = normalizeBigNumberIconPositionCustomizations(merged);
  }

  if (isPieDonutOrRadiusPieChart(chartTypeHint)) {
    merged = buildPieCustomizationPayload(merged);
  } else if (isSunburstChartType(chartTypeHint)) {
    merged = buildSunburstCustomizationPayload(merged);
  } else if (isFunnelChartType(chartTypeHint)) {
    merged = buildFunnelCustomizationPayload(merged);
  } else if (isBarChartType(chartTypeHint)) {
    merged = buildBarCustomizationPayload(merged);
  } else if (isLineChartType(chartTypeHint)) {
    merged = buildLineCustomizationPayload(merged);
  } else if (isAreaChartType(chartTypeHint)) {
    merged = buildAreaCustomizationPayload(merged);
  } else if (isPivotChartType(chartTypeHint) || isTableChartType(chartTypeHint)) {
    merged = { ...tablePivotDefaultOptions, ...merged };
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function attachCustomizationsToPayload<
  T extends { customization?: ChartCustomizationsDict; params?: Record<string, unknown> },
>(
  payload: T,
  stateOptions?: unknown,
  savedOptions?: ChartCustomizationsDict | null,
  chartTypeHint?: string,
): T {
  const merged = resolveChartCustomizationsForApi(stateOptions, savedOptions, chartTypeHint);
  if (merged) {
    payload.customization = merged;
    const hint = chartTypeHint || '';
    const params = { ...(payload.params || {}) };
    if (isBigNumberStreamChartType(hint)) {
      for (const key of BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS) {
        if (merged[key] !== undefined) params[key] = merged[key];
      }
    } else if (isBigNumberChartType(hint)) {
      for (const key of BIG_NUMBER_CUSTOMIZATION_KEYS) {
        if (merged[key] !== undefined) params[key] = merged[key];
      }
    }
    payload.params = params;
  }
  return payload;
}

export function chartTypeHintFromPayload(payload: CreateChartPayload | { visualization_name?: string }): string {
  return String((payload as CreateChartPayload).visualization_name || '');
}

/** Read saved customization from chart row (top-level or params) for dashboard/view mode. */
export function getChartCustomizationFromChart(chart?: {
  customization?: unknown;
  params?: { customization?: unknown; [key: string]: unknown };
  visualization_name?: string;
  chart_type?: string;
} | null): ChartCustomizationsDict | undefined {
  if (!chart) return undefined;
  const hint = String(chart.visualization_name || chart.chart_type || '');
  const fromTop = getSavedChartCustomizations(chart);
  const params = chart.params && typeof chart.params === 'object' ? chart.params : null;
  const fromParamsNested = params ? getSavedChartCustomizations({ customization: params.customization }) : null;
  const fromParamsRoot = { ...pickCustomizationFromParams(params, hint) };

  const apiCustomizationIsObject =
    chart.customization != null &&
    typeof chart.customization === 'object' &&
    !Array.isArray(chart.customization);

  if (apiCustomizationIsObject && isBigNumberChartType(hint)) {
    const apiResolvedCustom =
      resolveChartCustomizationsForApi(fromTop, null, hint, true) ?? fromTop ?? {};
    for (const key of BIG_NUMBER_CUSTOMIZATION_KEYS) {
      if (isDashboardWidgetParamKey(key)) continue;
      if (key in apiResolvedCustom) {
        fromParamsRoot[key] = apiResolvedCustom[key];
      } else if (params && params[key] !== undefined) {
        fromParamsRoot[key] = params[key];
      } else {
        delete fromParamsRoot[key];
      }
    }
  }

  const merged: ChartCustomizationsDict = {
    ...(fromParamsNested || {}),
    ...fromParamsRoot,
    ...(fromTop || {}),
  };

  if (Object.keys(merged).length === 0) return undefined;
  return resolveChartCustomizationsForApi(merged, null, hint, true) ?? merged;
}

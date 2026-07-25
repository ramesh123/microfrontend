import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  TrendingDown,
  Rows3,
  Gauge,
  CircleCheck,
  BarChart3,
  Table2,
  Upload,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import CustomTableData from '@/components/ui/CustomTableData';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  fetchDataQualityEvidenceTable,
  fetchDataQualityTrends,
  type DataQualityChartPlanEntry,
  type DataQualityTrendCard,
  type DataQualityTrendRow,
  type DataQualityTrendsResponse,
} from '@/controllers/API/dataQualityApi';
import type { ChartDetail } from '@/pages/ExploratoryAnalysis/AgenticSemantics/chartTypes';
import { AgenticEvidenceSheet } from '@/pages/ExploratoryAnalysis/AgenticSemantics/AgenticEvidenceSheet';
import { EVIDENCE_ROW_ID } from '@/pages/ExploratoryAnalysis/AgenticSemantics/evidenceRowConstants';
import { Am5MiniChart } from '@/pages/ExploratoryAnalysis/AgenticSemantics/Am5MiniChart';
import {
  ChartDataTable,
  type ChartDataTableColumnSpec,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/ChartDataTable';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DataQualityTrendStatusAm5Chart } from '@/pages/ExploratoryAnalysis/AgenticSemantics/DataQualityTrendStatusAm5Chart';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

export type DataQualityTrendsViewProps = {
  tenantId: string;
  domainId: string;
  runId: string;
  /** When false, omit outer padding (e.g. embedded in Insights). */
  padded?: boolean;
};

function numOrDash(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return String(Number(v));
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && v.trim() !== '') return v;
  return '—';
}

type CardKeyVisual = {
  Icon: LucideIcon;
  tone: string;
  wrap: string;
};

/** Optional icon / accent for known `card_key` values from the trends API. */
const CARD_KEY_META: Record<string, CardKeyVisual> = {
  trend_scope: {
    Icon: Rows3,
    tone: 'text-background dark:text-sky-400',
    wrap: 'bg-sky-500 ring-1 ring-sky-500/20',
  },
  overall_trust_score: {
    Icon: Gauge,
    tone: 'text-background dark:text-violet-300',
    wrap: 'bg-violet-500 ring-1 ring-violet-500/20',
  },
  final_dataset_readiness: {
    Icon: CircleCheck,
    tone: 'text-background dark:text-emerald-400',
    wrap: 'bg-emerald-500 ring-1 ring-emerald-500/20',
  },
  final_row_count: {
    Icon: Table2,
    tone: 'text-background dark:text-cyan-300',
    wrap: 'bg-cyan-600 ring-1 ring-cyan-500/20',
  },
  publish_readiness: {
    Icon: Upload,
    tone: 'text-background dark:text-amber-300',
    wrap: 'bg-amber-500 ring-1 ring-amber-500/20',
  },
  business_term_groups: {
    Icon: BookOpen,
    tone: 'text-background dark:text-slate-300',
    wrap: 'bg-slate-500 ring-1 ring-slate-500/20',
  },
};

function visualForCardKey(cardKey: string): CardKeyVisual {
  return (
    CARD_KEY_META[cardKey] ?? {
      Icon: Gauge,
      tone: 'text-muted-foreground',
      wrap: 'bg-muted/80 ring-1 ring-border/60',
    }
  );
}

function normalizeDataQualityTrendCards(data: DataQualityTrendsResponse | null): DataQualityTrendCard[] {
  const raw = data?.cards;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x))
    .map((x, i) => {
      const card_key = String(x.card_key ?? `card_${i}`);
      const valRaw = x.value;
      const value: string | number =
        typeof valRaw === 'number' && Number.isFinite(valRaw)
          ? valRaw
          : typeof valRaw === 'string'
            ? valRaw
            : typeof valRaw === 'boolean'
              ? valRaw
                ? 'Yes'
                : 'No'
              : valRaw != null
                ? String(valRaw)
                : '—';
      const o: DataQualityTrendCard = {
        card_key,
        title: String(x.title ?? card_key),
        value,
      };
      if (x.subtitle != null && String(x.subtitle).trim() !== '') o.subtitle = String(x.subtitle);
      if (x.note != null && String(x.note).trim() !== '') o.note = String(x.note);
      if (x.trend_status != null && String(x.trend_status).trim() !== '')
        o.trend_status = String(x.trend_status);
      if (x.evidence_path != null && String(x.evidence_path).trim() !== '')
        o.evidence_path = String(x.evidence_path);
      if (x.delta_value != null && String(x.delta_value).trim() !== '') o.delta_value = String(x.delta_value);
      if (x.delta_pct != null && String(x.delta_pct).trim() !== '') o.delta_pct = String(x.delta_pct);
      return o;
    });
}

/**
 * Resolves `evidence_path` from the trends API to a URL path segment for evidence fetches
 * (axios `baseURL` is already `/api/v2`).
 */
function evidenceRequestPath(path: string | null | undefined): string | null {
  if (path == null || String(path).trim() === '') return null;
  let p = String(path).trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const u = new URL(p);
      const marker = '/api/v2';
      const i = u.pathname.indexOf(marker);
      if (i >= 0) {
        const rest = u.pathname.slice(i + marker.length);
        return `${rest.startsWith('/') ? rest : `/${rest}`}${u.search}` || '/';
      }
      return `${u.pathname}${u.search}` || null;
    } catch {
      return null;
    }
  }
  if (p.startsWith('/api/v2')) {
    p = p.slice(7);
    if (!p.startsWith('/')) p = `/${p}`;
  }
  return p.startsWith('/') ? p : `/${p}`;
}

/** Drive sparkline height from primary value, then delta %, then delta value. */
function sparkEndFromCard(card: DataQualityTrendCard): number {
  let n = parseSummaryNumber(card.value);
  if (!Number.isFinite(n) || n === 0) {
    const d = parseSummaryNumber(card.delta_pct);
    if (Number.isFinite(d) && d !== 0) n = Math.min(100, Math.abs(d));
  }
  if (!Number.isFinite(n) || n === 0) {
    const dv = parseSummaryNumber(card.delta_value);
    if (Number.isFinite(dv) && dv !== 0) n = Math.min(1000, Math.abs(dv));
  }
  return Math.max(0, n);
}

function sparklinePointsForTrendCard(card: DataQualityTrendCard): { idx: number; v: number }[] {
  const pts = syntheticSparklinePoints(card.card_key, sparkEndFromCard(card), 20);
  return ensureMinSparkPoints(pts);
}

function parseSummaryNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(String(v).replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}

/** Decorative wave when there are no trend rows to derive a cumulative shape from. */
function syntheticSparklinePoints(key: string, endValue: number, len = 20): { idx: number; v: number }[] {
  const ev = Math.max(0, endValue);
  const h = stringHash(key);
  const pts: { idx: number; v: number }[] = [];
  if (len < 2) return [{ idx: 0, v: ev }, { idx: 1, v: ev }];
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const w1 = Math.sin(t * Math.PI * 2.1 + (h & 255) * 0.02) * 0.14;
    const w2 = Math.sin(t * Math.PI * 0.85 + (h >>> 8 & 255) * 0.02) * 0.1;
    const base = 0.38 + 0.62 * t * t;
    const raw = ev <= 0 ? t * 0.2 : ev * Math.max(0.12, base + w1 + w2);
    pts.push({ idx: i, v: raw });
  }
  pts[len - 1].v = ev;
  return pts;
}

function ensureMinSparkPoints(pts: { idx: number; v: number }[]): { idx: number; v: number }[] {
  if (pts.length === 0) return [
    { idx: 0, v: 0 },
    { idx: 1, v: 0 },
  ];
  if (pts.length === 1) {
    const v = pts[0].v;
    return [
      { idx: 0, v: v },
      { idx: 1, v: v },
    ];
  }
  return pts.map((p, i) => ({ ...p, idx: i }));
}

const SPARK_STROKE = 'hsl(221 83% 53%)';
const SPARK_FILL_TOP = 'hsl(221 83% 53%)';



const deltaNumberFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Single muted line: `baseline · Δ delta · pct%` (baseline comes from `note` when present).
 */
function insightCardTrendLine(card: DataQualityTrendCard): string | null {
  const dvTrim = card.delta_value != null ? String(card.delta_value).trim() : '';
  const dpTrim = card.delta_pct != null ? String(card.delta_pct).trim() : '';
  if (!dvTrim && !dpTrim) return null;
  const parts: string[] = [];
  const noteTrim = card.note != null ? String(card.note).trim() : '';
  if (noteTrim) parts.push(noteTrim);
  if (dvTrim) {
    const n = parseSummaryNumber(card.delta_value);
    parts.push(Number.isFinite(n) ? `Δ ${deltaNumberFmt.format(n)}` : `Δ ${dvTrim}`);
  }
  if (dpTrim) {
    const p = parseSummaryNumber(card.delta_pct);
    parts.push(Number.isFinite(p) ? `${deltaNumberFmt.format(p)}%` : `${dpTrim}%`);
  }
  return parts.join(' · ');
}

function strField(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function normalizeTrendsList(data: DataQualityTrendsResponse | null): DataQualityTrendRow[] {
  const t = data?.trends;
  if (!Array.isArray(t)) return [];
  return t.filter((x): x is DataQualityTrendRow => Boolean(x) && typeof x === 'object');
}

function trendStatusKey(row: DataQualityTrendRow): string {
  return strField(row.trend_status).toLowerCase();
}

/** Bar scale: prefer |delta_value|; else |current − previous| when both numeric. */
function deltaBarMagnitude(row: DataQualityTrendRow): number {
  const raw = row.delta_value;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(String(raw).replace(/,/g, ''));
    if (Number.isFinite(n)) return Math.abs(n);
  }
  const c =
    row.current_value_num != null
      ? Number(String(row.current_value_num).replace(/,/g, ''))
      : NaN;
  const p =
    row.previous_value_num != null
      ? Number(String(row.previous_value_num).replace(/,/g, ''))
      : NaN;
  if (Number.isFinite(c) && Number.isFinite(p)) return Math.abs(c - p);
  return 0;
}

function formatDeltaCell(row: DataQualityTrendRow): string {
  const raw = row.delta_value;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(String(raw).replace(/,/g, ''));
    if (Number.isFinite(n)) return deltaNumberFmt.format(n);
    return String(raw);
  }
  const c =
    row.current_value_num != null
      ? Number(String(row.current_value_num).replace(/,/g, ''))
      : NaN;
  const p =
    row.previous_value_num != null
      ? Number(String(row.previous_value_num).replace(/,/g, ''))
      : NaN;
  if (Number.isFinite(c) && Number.isFinite(p)) return deltaNumberFmt.format(c - p);
  return '—';
}

function trendRowLabel(row: DataQualityTrendRow): string {
  const on =
    strField(row.object_name) ||
    strField(row.object_key) ||
    strField(row.object_type) ||
    'Object';
  const mn = strField(row.metric_name) || 'metric';
  return `${on} - ${mn}`;
}

function cellNumOrText(
  num: string | null | undefined,
  text: string | null | undefined,
): string {
  const t = text != null ? String(text).trim() : '';
  if (t !== '') return t;
  const nStr = num != null ? String(num).trim() : '';
  if (nStr === '') return '—';
  const n = Number(nStr.replace(/,/g, ''));
  if (Number.isFinite(n)) return deltaNumberFmt.format(n);
  return nStr;
}

function formatDeltaPctCell(row: DataQualityTrendRow): string {
  const raw = row.delta_pct;
  if (raw == null || String(raw).trim() === '') return '—';
  const n = Number(String(raw).replace(/,/g, ''));
  if (Number.isFinite(n)) return deltaNumberFmt.format(n);
  return String(raw);
}

function TrendStatusBadge({ status, className }: { status: string; className?: string }) {
  const k = status.toLowerCase();
  const cls =
    k === 'improved'
      ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
      : k === 'worsened'
        ? 'border-rose-500/35 bg-rose-500/15 text-rose-800 dark:text-rose-200'
        : k === 'changed'
          ? 'border-amber-500/35 bg-amber-500/15 text-amber-900 dark:text-amber-200'
          : 'border-border bg-muted/60 text-muted-foreground';
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium capitalize', cls, className)}>
      {status.trim() ? status : '—'}
    </Badge>
  );
}

/** Count trend rows by normalized trend_status; preferred order then any other statuses. */
function buildStatusDistribution(
  rows: DataQualityTrendRow[],
): { status: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const s = trendStatusKey(r) || 'unknown';
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  const preferred = ['improved', 'unchanged', 'baseline', 'changed', 'worsened'] as const;
  const primary = preferred
    .map((status) => ({ status, count: map.get(status) ?? 0 }))
    .filter((x) => x.count > 0);
  for (const k of preferred) map.delete(k);
  const extra = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => ({ status, count }));
  return [...primary, ...extra];
}

/** Count trend rows by object_type (lowercase). */
function buildObjectTypeMix(rows: DataQualityTrendRow[]): { objectType: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const ot = strField(r.object_type).toLowerCase() || 'unknown';
    map.set(ot, (map.get(ot) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([objectType, count]) => ({ objectType, count }))
    .sort((a, b) => b.count - a.count);
}

function ObjectTypeMixTable({ rows }: { rows: { objectType: string; count: number }[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="shrink-0 border-b border-border/60 px-4 py-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Object type mix</h3>
        <p className="mt-1 text-xs leading-relaxed text-semibold">
          Row counts by object_type (run, rule, table, stage, final_dataset, …).
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        {rows.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
            No trend rows.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border/50">
            <table className="w-full min-w-[240px] text-left text-xs sm:text-[13px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Object type</th>
                  <th className="px-3 py-2 text-right font-semibold">Trend rows</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ objectType, count }) => (
                  <tr
                    key={objectType}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2 text-foreground">{objectType}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeChartPlan(data: DataQualityTrendsResponse | null): DataQualityChartPlanEntry[] {
  const raw = data?.chart_plan;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x))
    .map((x, i) => {
      const rec = x as Record<string, unknown>;
      const colsRaw = rec.columns;
      const columns = Array.isArray(colsRaw)
        ? colsRaw
            .filter((c) => Boolean(c) && typeof c === 'object' && !Array.isArray(c))
            .map((c) => {
              const col = c as Record<string, unknown>;
              return {
                field: String(col.field ?? '').trim(),
                label: String(col.label ?? col.field ?? '').trim(),
              };
            })
            .filter((c) => c.field)
        : undefined;
      const rowsRaw = rec.rows;
      const rows = Array.isArray(rowsRaw)
        ? (rowsRaw.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Record<string, unknown>[])
        : undefined;
      const summary =
        rec.summary && typeof rec.summary === 'object' && !Array.isArray(rec.summary)
          ? (rec.summary as Record<string, unknown>)
          : undefined;
      return {
        chart_key: String(rec.chart_key ?? `chart_${i}`),
        chart_type: String(rec.chart_type ?? 'unknown'),
        title: String(rec.title ?? rec.chart_key ?? 'Chart'),
        subtitle: rec.subtitle != null ? String(rec.subtitle) : undefined,
        summary,
        x_field: rec.x_field != null ? String(rec.x_field) : undefined,
        y_field: rec.y_field != null ? String(rec.y_field) : undefined,
        series_fields: Array.isArray(rec.series_fields) ? rec.series_fields.map(String) : undefined,
        rows,
        columns,
      };
    });
}

function chartPlanRowList(plan: DataQualityChartPlanEntry): Record<string, unknown>[] {
  const r = plan.rows;
  return Array.isArray(r) ? r.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[] : [];
}

function chartPlanRowNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(String(v).replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function formatChartPlanScalar(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return deltaNumberFmt.format(n);
}

function chartPlanCategoryColumnLabel(plan: DataQualityChartPlanEntry): string {
  const k = plan.chart_key.toLowerCase();
  const xf = String(plan.x_field ?? 'category').trim();
  if (k.includes('object_type')) return 'Object type';
  if (xf === 'category') return 'Category';
  return xf.replace(/_/g, ' ');
}

function chartPlanValueColumnLabel(plan: DataQualityChartPlanEntry): string {
  const yf = String(plan.y_field ?? 'value').trim();
  if (yf === 'value') return 'Trend rows';
  return yf.replace(/_/g, ' ');
}

function readablePlanField(field: string): string {
  return field.replace(/_/g, ' ');
}

function chartPlanRowsHaveField(rows: Record<string, unknown>[], field: string): boolean {
  return rows.some((r) => Object.prototype.hasOwnProperty.call(r, field));
}

/** Column specs for the Table tab (aligned with Insights / data-quality dashboard `ChartDataTable`). */
function buildChartPlanTableColumnSpecs(plan: DataQualityChartPlanEntry): ChartDataTableColumnSpec[] {
  const rows = chartPlanRowList(plan);
  if (!rows.length) return [];
  const t = String(plan.chart_type ?? '').toLowerCase();
  const out: ChartDataTableColumnSpec[] = [];
  const push = (field: string, label?: string, evidence?: boolean) => {
    if (!chartPlanRowsHaveField(rows, field)) return;
    out.push({ field, label: label ?? readablePlanField(field), evidence });
  };

  if (t === 'column' || t === 'pie') {
    const xf = String(plan.x_field ?? 'category');
    const yf = String(plan.y_field ?? 'value');
    if (chartPlanRowsHaveField(rows, xf)) {
      out.push({ field: xf, label: chartPlanCategoryColumnLabel(plan) });
    }
    if (chartPlanRowsHaveField(rows, yf)) {
      out.push({ field: yf, label: chartPlanValueColumnLabel(plan) });
    }
    push('evidence_path', 'Evidence', true);
  } else if (t === 'bar') {
    const lf = String(plan.x_field ?? 'label');
    const vf = String(plan.y_field ?? 'value');
    if (chartPlanRowsHaveField(rows, lf)) out.push({ field: lf, label: 'Label' });
    if (chartPlanRowsHaveField(rows, vf)) out.push({ field: vf, label: 'Value' });
    push('delta_pct', 'Delta %');
    push('object_type', 'Object type');
    push('object_key', 'Object key');
    push('metric_name', 'Metric name');
    push('evidence_path', 'Evidence', true);
  } else if (t === 'summary_cards') {
    push('label', 'Label');
    push('metric_key', 'Metric key');
    push('value', 'Value');
    push('note', 'Note');
    push('trend_status', 'Trend status');
    push('evidence_path', 'Evidence', true);
  }

  const used = new Set(out.map((c) => c.field));
  const extraKeys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!used.has(k)) extraKeys.add(k);
    }
  }
  for (const k of [...extraKeys].sort()) {
    out.push({
      field: k,
      label: readablePlanField(k),
      evidence: k === 'evidence_path',
    });
  }
  return out;
}

/**
 * Chart / Table tabs for each `chart_plan` entry — same pattern as Insights data-quality
 * `DashboardSingleChartCard` (icon triggers, table uses `ChartDataTable`).
 */
function ChartPlanTabbedShell({
  plan,
  chartTab,
  columnSpecs,
}: {
  plan: DataQualityChartPlanEntry;
  chartTab: ReactNode;
  columnSpecs?: ChartDataTableColumnSpec[];
}) {
  const rows = chartPlanRowList(plan);
  const displayColumns = useMemo(() => {
    if (columnSpecs?.length) return columnSpecs;
    return buildChartPlanTableColumnSpecs(plan);
  }, [plan, columnSpecs]);

  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm">
      <Tabs
        key={plan.chart_key}
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'chart' | 'table')}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b border-border/60 bg-background px-3 py-2 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pr-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">{plan.title}</h3>
              {plan.subtitle ? (
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{plan.subtitle}</p>
              ) : null}
            </div>
            <TabsList className="h-6 w-auto shrink-0 justify-start gap-0.5 rounded-md border border-border/50 bg-muted/20 p-0.5">
              <TabsTrigger value="chart" className="h-5 w-7 gap-0 px-0" title="Chart">
                <BarChart3 className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Chart</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="h-5 w-7 gap-0 px-0" title="Table">
                <Table2 className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Table</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent
          value="chart"
          className="mt-0 flex min-h-0 flex-1 flex-col p-0 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          {chartTab}
        </TabsContent>
        <TabsContent
          value="table"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-2 focus-visible:outline-none data-[state=inactive]:hidden sm:p-3"
        >
          <ChartDataTable
            rows={rows}
            displayColumns={displayColumns.length ? displayColumns : undefined}
            shrinkWrap
            scrollHeightClass="max-h-[min(320px,50vh)]"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartPlanColumnChart({ plan }: { plan: DataQualityChartPlanEntry }) {
  const rows = chartPlanRowList(plan);
  const xf = String(plan.x_field ?? 'category').trim() || 'category';
  const yf = String(plan.y_field ?? 'value').trim() || 'value';
  const detail = useMemo((): ChartDetail => {
    const chart_data = rows.map((r) => ({
      xCategory: String(r[xf] ?? '').replace(/_/g, ' '),
      value: chartPlanRowNumber(r[yf]),
    }));
    return {
      chart_id: `dq-trends-plan-${plan.chart_key}`,
      chart_type: 'column_chart',
      metric_name: chartPlanValueColumnLabel(plan),
      chart_data,
      title: plan.title,
      category_column: 'xCategory',
      intent: 'data_quality',
      chart_payload: { chart_type: 'column_chart' },
    };
  }, [plan.chart_key, plan.title, rows, xf, yf]);

  const chartBody = (
    <div className="flex min-h-0 w-full flex-1 flex-col p-2 sm:p-3">
      {rows.length === 0 ? (
        <p className="flex min-h-[200px] flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          No data.
        </p>
      ) : (
        <div className="min-h-[200px] w-full flex-1">
          <Am5MiniChart detail={detail} height="100%" />
        </div>
      )}
    </div>
  );

  return <ChartPlanTabbedShell plan={plan} chartTab={chartBody} />;
}

function ChartPlanPieAsTable({
  plan,
  onOpenEvidencePath,
}: {
  plan: DataQualityChartPlanEntry;
  onOpenEvidencePath: (title: string, path: string) => void;
}) {
  const rows = chartPlanRowList(plan);
  const xf = String(plan.x_field ?? 'category').trim() || 'category';
  const yf = String(plan.y_field ?? 'value').trim() || 'value';
  const catLabel = chartPlanCategoryColumnLabel(plan);
  const valLabel = chartPlanValueColumnLabel(plan);

  const chartBody = (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          No data.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border/50">
          <table className="w-full min-w-[240px] text-left text-xs sm:text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                <th className="px-3 py-2 font-semibold">{catLabel}</th>
                <th className="px-3 py-2 text-right font-semibold">{valLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const cat = String(r[xf] ?? '');
                const pathRaw = r.evidence_path;
                const path = typeof pathRaw === 'string' && pathRaw.trim() ? pathRaw.trim() : '';
                const key = `${cat}-${idx}`;
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b border-border/40 last:border-0',
                      path && 'cursor-pointer hover:bg-muted/30',
                    )}
                    onClick={() => {
                      if (path) onOpenEvidencePath(`${plan.title}: ${cat}`, path);
                    }}
                  >
                    <td className="px-3 py-2 text-foreground">{cat}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {formatChartPlanScalar(chartPlanRowNumber(r[yf]))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return <ChartPlanTabbedShell plan={plan} chartTab={chartBody} />;
}

function summaryAbsLargestDelta(summary: Record<string, unknown> | null | undefined): number | null {
  if (!summary) return null;
  const n = chartPlanRowNumber(summary.largest_delta);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n);
}

function ChartPlanHorizontalDeltaBars({
  plan,
  onOpenEvidencePath,
}: {
  plan: DataQualityChartPlanEntry;
  onOpenEvidencePath: (title: string, path: string) => void;
}) {
  const rows = chartPlanRowList(plan);
  const labelField = String(plan.x_field ?? 'label').trim() || 'label';
  const valueField = String(plan.y_field ?? 'value').trim() || 'value';
  const keyLower = plan.chart_key.toLowerCase();
  const isImproved = keyLower.includes('improved');
  const barClass = isImproved
    ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
    : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.2)]';

  const maxAbs = useMemo(() => {
    const fromSummary = summaryAbsLargestDelta(plan.summary ?? undefined);
    const fromRows = rows.length ? Math.max(...rows.map((r) => Math.abs(chartPlanRowNumber(r[valueField])))) : 0;
    const base = fromSummary != null && fromSummary > 0 ? fromSummary : fromRows;
    return Math.max(base, 1e-12);
  }, [plan.summary, rows, valueField]);

  const chartBody = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          No data.
        </p>
      ) : (
        rows.map((r, idx) => {
          const label = String(r[labelField] ?? r.label ?? '');
          const v = chartPlanRowNumber(r[valueField]);
          const mag = Math.abs(v);
          const pct = maxAbs > 0 ? Math.min(100, (mag / maxAbs) * 100) : 0;
          const pathRaw = r.evidence_path;
          const path = typeof pathRaw === 'string' && pathRaw.trim() ? pathRaw.trim() : '';
          const rowKey = `${label}-${idx}`;
          return (
            <div
              key={rowKey}
              className={cn(
                'grid w-full grid-cols-1 gap-1.5 rounded-lg border border-transparent bg-muted/20 px-2 py-2 text-left sm:grid-cols-[minmax(0,1.15fr)_1fr_minmax(4.5rem,auto)] sm:items-center sm:gap-2',
                path && 'cursor-pointer hover:border-border/60',
              )}
              onClick={() => {
                if (path) onOpenEvidencePath(label, path);
              }}
            >
              <span className="min-w-0 truncate text-xs text-foreground sm:text-[13px]" title={label}>
                {label}
              </span>
              <div className="order-3 h-2 w-full overflow-hidden rounded-full bg-muted/90 sm:order-none">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="order-2 text-right text-xs tabular-nums text-foreground sm:order-none sm:text-[13px]">
                {formatChartPlanScalar(v)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  return <ChartPlanTabbedShell plan={plan} chartTab={chartBody} />;
}

function ChartPlanSummaryCards({
  plan,
  onOpenEvidencePath,
}: {
  plan: DataQualityChartPlanEntry;
  onOpenEvidencePath: (title: string, path: string) => void;
}) {
  const rows = chartPlanRowList(plan);

  const chartBody = (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2 sm:grid-cols-4 sm:gap-2.5 sm:p-3">
      {rows.length === 0 ? (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No summary rows.</p>
      ) : (
        rows.map((r, idx) => {
          const label = String(r.label ?? r.metric_key ?? `metric_${idx}`);
          const value = r.value;
          const display =
            typeof value === 'number' && Number.isFinite(value)
              ? formatChartPlanScalar(value)
              : value != null
                ? String(value)
                : '—';
          const noteTrim = r.note != null ? String(r.note).trim() : '';
          const showNote = noteTrim !== '' && noteTrim !== display;
          const pathRaw = r.evidence_path;
          const path = typeof pathRaw === 'string' && pathRaw.trim() ? pathRaw.trim() : '';
          const status = r.trend_status != null ? String(r.trend_status) : '';
          return (
            <div
              key={`${label}-${idx}`}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/5 px-2.5 py-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-xs font-semibold leading-snug text-foreground">
                  {label}
                </span>
                {status ? (
                  <TrendStatusBadge status={status} className="shrink-0 px-1.5 py-0" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-xs font-semibold tabular-nums leading-none tracking-tight text-foreground">
                    {display}
                  </span>
                  {showNote ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" title={noteTrim}>
                      {noteTrim}
                    </span>
                  ) : null}
                </div>
                {path ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto shrink-0 !p-0 text-[11px] font-semibold leading-none"
                    onClick={() => onOpenEvidencePath(label, path)}
                  >
                    Evidence
                    <ExternalLink className="ml-0.5 inline size-3 opacity-80" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return <ChartPlanTabbedShell plan={plan} chartTab={chartBody} />;
}

function ChartPlanTableChart({
  plan,
  onOpenEvidencePath,
}: {
  plan: DataQualityChartPlanEntry;
  onOpenEvidencePath: (title: string, path: string) => void;
}) {
  const rows = chartPlanRowList(plan);
  const colDefs = plan.columns ?? [];

  if (colDefs.length === 0) {
    return (
      <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="shrink-0 border-b border-border/60 px-4 py-2 !pb-2">
          <CardTitle className="text-sm font-semibold">{plan.title}</CardTitle>
          {plan.subtitle ? (
            <CardDescription className="text-xs">{plan.subtitle}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-sm text-muted-foreground">
            No column definitions for this table chart.
          </p>
        </CardContent>
      </Card>
    );
  }

  const columns = useMemo(() => {
    return colDefs.map((c) => {
      const key = c.field;
      const isEvidence = key === 'evidence_path';
      return {
        key,
        header: c.label || key,
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: isEvidence ? 120 : 140,
        renderCell:
          isEvidence ?
            (r: Record<string, unknown>) => {
              const path = typeof r.evidence_path === 'string' ? r.evidence_path.trim() : '';
              if (!path) return <span className="text-muted-foreground">—</span>;
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold"
                  onClick={() => onOpenEvidencePath(String(r.label ?? plan.title), path)}
                >
                  View
                </Button>
              );
            }
          : undefined,
      };
    });
  }, [colDefs, onOpenEvidencePath, plan.title]);

  const data = useMemo(() => {
    return rows.map((r, idx) => {
      const base: Record<string, unknown> = { __idx: idx };
      for (const c of colDefs) {
        base[c.field] = r[c.field];
      }
      return base;
    });
  }, [colDefs, rows]);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="shrink-0 border-b border-border/60 px-4 py-2 !pb-2">
        <CardTitle className="text-sm font-semibold">{plan.title}</CardTitle>
        {plan.subtitle ? (
          <CardDescription className="text-xs">{plan.subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-hidden rounded-b-xl border-t border-border/40">
          <CustomTableData
            data={data}
            columns={columns}
            rowKey="__idx"
            scrollHeightClass="max-h-[min(360px,50vh)]"
            HorizontalScroll
            wrapLongCells
            bodyCellClassName="h-10"
            truncateCharLimit={64}
            roundDecimals={2}
            emptyState={
              <div className="p-8 text-center text-sm text-muted-foreground">No rows.</div>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartPlanEntry({
  plan,
  onOpenEvidencePath,
}: {
  plan: DataQualityChartPlanEntry;
  onOpenEvidencePath: (title: string, path: string) => void;
}) {
  const t = String(plan.chart_type ?? '').toLowerCase();
  if (t === 'column') return <ChartPlanColumnChart plan={plan} />;
  if (t === 'pie') return <ChartPlanPieAsTable plan={plan} onOpenEvidencePath={onOpenEvidencePath} />;
  if (t === 'bar') return <ChartPlanHorizontalDeltaBars plan={plan} onOpenEvidencePath={onOpenEvidencePath} />;
  if (t === 'summary_cards') {
    return <ChartPlanSummaryCards plan={plan} onOpenEvidencePath={onOpenEvidencePath} />;
  }
  if (t === 'table') return <ChartPlanTableChart plan={plan} onOpenEvidencePath={onOpenEvidencePath} />;
  return (
    <div className="flex h-full min-h-0 flex-col justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">{plan.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Unsupported chart_type &quot;{plan.chart_type}&quot; for this view.
      </p>
    </div>
  );
}

type TrendDeltaBarsPanelProps = {
  title: string;
  subtitle: string;
  rows: DataQualityTrendRow[];
  variant: 'improved' | 'worsened';
  emptyText: string;
};

function TrendDeltaBarsPanel({
  title,
  subtitle,
  rows,
  variant,
  emptyText,
}: TrendDeltaBarsPanelProps) {
  const chartRows = useMemo(() => {
    const list = rows.map((row) => ({
      row,
      label: trendRowLabel(row),
      display: formatDeltaCell(row),
      mag: deltaBarMagnitude(row),
    }));
    list.sort((a, b) => b.mag - a.mag);
    return list;
  }, [rows]);

  const maxMag = useMemo(() => Math.max(1, ...chartRows.map((r) => r.mag)), [chartRows]);

  const barClass =
    variant === 'improved'
      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
      : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.2)]';

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="shrink-0 border-b border-border/60 px-4 py-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-semibold">{subtitle}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        {chartRows.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          chartRows.map(({ row, label, display, mag }) => {
            const pct = maxMag > 0 ? Math.min(100, (mag / maxMag) * 100) : 0;
            const rowKey = `${strField(row.object_key)}:${strField(row.metric_name)}:${label}`;
            return (
              <div
                key={rowKey}
                className="grid w-full grid-cols-1 gap-1.5 rounded-lg border border-transparent bg-muted/20 px-2 py-2 text-left sm:grid-cols-[minmax(0,1.15fr)_1fr_minmax(4.5rem,auto)] sm:items-center sm:gap-2"
              >
                <span className="min-w-0 truncate text-xs text-foreground sm:text-[13px]" title={label}>
                  {label}
                </span>
                <div className="order-3 h-2 w-full overflow-hidden rounded-full bg-muted/90 sm:order-none">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="order-2 text-right text-xs tabular-nums text-foreground sm:order-none sm:text-[13px]">
                  {display}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DataQualityTrendsView({
  tenantId,
  domainId,
  runId,
  padded = true,
}: DataQualityTrendsViewProps) {
  const [data, setData] = useState<DataQualityTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drillRow, setDrillRow] = useState<DataQualityTrendRow | null>(null);
  const [evidenceSheet, setEvidenceSheet] = useState<{
    title: string;
    requestPath: string;
    rows: Record<string, unknown>[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    const tid = tenantId.trim();
    const did = domainId.trim();
    const rid = runId.trim();
    if (!tid || !did || !rid) {
      setLoading(false);
      setData(null);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetchDataQualityTrends({
        tenant_id: tid,
        domain_id: did,
        run_id: rid,
      });
      setData(res);
    } catch (err: unknown) {
      setError(true);
      setData(null);
      toast.error(getDisplayErrorMessage(err, 'Failed to load trends'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, domainId, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const trendInsightCards = useMemo(() => {
    const list = normalizeDataQualityTrendCards(data);
    return list.map((card, index) => ({
      card,
      sparkPoints: index === 0 ? sparklinePointsForTrendCard(card) : null,
      visual: visualForCardKey(card.card_key),
    }));
  }, [data]);

  const openEvidenceByPath = useCallback(async (title: string, evidencePathRaw: string) => {
    const raw = String(evidencePathRaw ?? '').trim();
    if (!raw) return;
    const requestPath = evidenceRequestPath(raw) ?? raw;
    setEvidenceSheet({
      title,
      requestPath,
      rows: [],
      loading: true,
      error: null,
    });
    try {
      const tableRows = await fetchDataQualityEvidenceTable(raw);
      const rows = tableRows.map((r, i) => ({
        ...r,
        [EVIDENCE_ROW_ID]: `dq-trends-evidence-${i}`,
      }));
      setEvidenceSheet({
        title,
        requestPath,
        rows,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const evidenceError = getDisplayErrorMessage(err, 'Evidence request failed');
      setEvidenceSheet({
        title,
        requestPath,
        rows: [],
        loading: false,
        error: evidenceError,
      });
      toast.error(evidenceError);
    }
  }, []);

  const openEvidence = useCallback(
    async (card: DataQualityTrendCard) => {
      const p = card.evidence_path;
      if (p == null || String(p).trim() === '') return;
      await openEvidenceByPath(card.title, String(p));
    },
    [openEvidenceByPath],
  );

  const chartPlanEntries = useMemo(() => normalizeChartPlan(data), [data]);

  const improvedTrendRows = useMemo(() => {
    return normalizeTrendsList(data).filter((r) => trendStatusKey(r) === 'improved');
  }, [data]);

  const worsenedTrendRows = useMemo(() => {
    return normalizeTrendsList(data).filter((r) => trendStatusKey(r) === 'worsened');
  }, [data]);

  const allTrendRowsForCharts = useMemo(() => normalizeTrendsList(data), [data]);

  const statusDistributionEntries = useMemo(
    () => buildStatusDistribution(allTrendRowsForCharts),
    [allTrendRowsForCharts],
  );

  const objectTypeMixRows = useMemo(
    () => buildObjectTypeMix(allTrendRowsForCharts),
    [allTrendRowsForCharts],
  );

  const trendTableRows = useMemo(() => {
    const list = normalizeTrendsList(data);
    return list.map((row, idx) => ({
      id: `${strField(row.object_key)}|${strField(row.metric_name)}|${idx}`,
      type: strField(row.object_type) || '—',
      object: strField(row.object_name) || strField(row.object_key) || '—',
      metric: strField(row.metric_name) || '—',
      previous: cellNumOrText(row.previous_value_num, row.previous_value_text),
      current: cellNumOrText(row.current_value_num, row.current_value_text),
      delta: formatDeltaCell(row),
      deltaPct: formatDeltaPctCell(row),
      status: strField(row.trend_status) || '—',
      direction: strField(row.directionality) || '—',
      __trend: row as unknown,
    }));
  }, [data]);

  const trendTableColumns = useMemo(
    () => [
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        // filterable: true,
        colWidth: 110,
        truncateData: true,
      },
      {
        key: 'object',
        header: 'Object',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 220,
        maxWidth: 360,
      },
      {
        key: 'metric',
        header: 'Metric',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 140,
      },
      {
        key: 'previous',
        header: 'Previous',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 112,
      },
      {
        key: 'current',
        header: 'Current',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 112,
      },
      {
        key: 'delta',
        header: 'Delta',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 96,
      },
      {
        key: 'deltaPct',
        header: 'Delta %',
        sortable: true,
        // filterable: true,
        colWidth: 88,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        // filterable: true,
        colWidth: 112,
        renderCell: (r: Record<string, unknown>) => (
          <TrendStatusBadge status={String(r.status ?? '')} />
        ),
      },
      {
        key: 'direction',
        header: 'Direction',
        sortable: true,
        // filterable: true,
        truncateData: true,
        colWidth: 140,
      },
      {
        key: 'evidence',
        header: 'Evidence (Action)',
        sortable: false,
        colWidth: 120,
        renderCell: (r: Record<string, unknown>) => {
          const row = r.__trend as DataQualityTrendRow | undefined;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-semibold"
              onClick={() => {
                if (row) setDrillRow(row);
              }}
            >
              Drill
            </Button>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className={cn('space-y-2', padded && 'p-1 sm:p-2')}>
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-14">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading trends…</p>
        </div>
      ) : null}

      {!loading && error && !data ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">Could not load trends for this run.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {data ? (
        <>
          {trendInsightCards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {trendInsightCards.map(({ card, sparkPoints, visual }, idx) => {
                const evidencePath = evidenceRequestPath(card.evidence_path);
                const { Icon, tone, wrap } = visual;
                const trendLine = insightCardTrendLine(card);
                const evidenceBusy =
                  evidenceSheet?.loading &&
                  evidencePath != null &&
                  evidenceSheet.requestPath === evidencePath;
                return (
                  <Card
                    key={`${card.card_key}-${idx}`}
                    className="flex h-full flex-col gap-0 overflow-hidden py-2 shadow-sm"
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pb-2 pt-0">
                      <div className="flex min-w-0 flex-1 items-stretch gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <CardDescription className="text-m font-semibold leading-tight">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                                  wrap,
                                )}
                              >
                                <Icon className={cn('size-3.5', tone)} aria-hidden />
                              </span>
                              <span className="min-w-0">{card.title}</span>
                            </span>
                          </CardDescription>
                          <CardTitle className="text-2xl font-semibold tabular-nums leading-tight">
                            {numOrDash(card.value)}
                          </CardTitle>
                        </div>
                        
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                        {card.trend_status ? (
                          <TrendStatusBadge status={String(card.trend_status)} />
                        ) : null}
                        {evidencePath ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            disabled={evidenceBusy}
                            className="h-auto shrink-0 justify-end !p-0 text-xs font-medium"
                            onClick={() => void openEvidence(card)}
                          >
                            {evidenceBusy ? (
                              <>
                                <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden />
                                Loading…
                              </>
                            ) : (
                              <>
                                Evidence
                                <ExternalLink className="ml-1 inline size-3 opacity-80" aria-hidden />
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col space-y-2 px-4 pb-2 pt-0">
                      <div className='flex flex-wrap items-center justify-between'>
                      {trendLine ? (
                        <p className="text-xs font-medium text-foreground/90">
                          {trendLine}
                        </p>
                      ) : card.note ? (
                        <p className="text-xs font-medium text-foreground/90">
                          {card.note}
                        </p>
                      ) : null}
                      </div>
                    </CardContent>
                    
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No insight cards in the API response.</p>
          )}

          {chartPlanEntries.length > 0 ? (
            <div className="grid items-stretch gap-2 lg:grid-cols-2">
              {chartPlanEntries.map((plan, i) => (
                <div
                  key={`${plan.chart_key}-${i}`}
                  className={cn(
                    'h-full min-h-0 min-w-0',
                    (String(plan.chart_type).toLowerCase() === 'table' ||
                      String(plan.chart_type).toLowerCase() === 'summary_cards') &&
                      'lg:col-span-2',
                  )}
                >
                  <ChartPlanEntry
                    plan={plan}
                    onOpenEvidencePath={(title, path) => {
                      void openEvidenceByPath(title, path);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid items-stretch gap-2 lg:grid-cols-2">
                <div className="h-full min-h-0 min-w-0">
                  <DataQualityTrendStatusAm5Chart entries={statusDistributionEntries} />
                </div>
                <div className="h-full min-h-0 min-w-0">
                  <ObjectTypeMixTable rows={objectTypeMixRows} />
                </div>
              </div>

              <div className="grid items-stretch gap-2 lg:grid-cols-2">
                <div className="h-full min-h-0 min-w-0">
                  <TrendDeltaBarsPanel
                  title="Top Improved Deltas"
                  subtitle="Metrics with trend_status improved, sorted by delta magnitude."
                  rows={improvedTrendRows}
                  variant="improved"
                  emptyText="No rows available."
                />
                </div>
                <div className="h-full min-h-0 min-w-0">
                  <TrendDeltaBarsPanel
                  title="Top Worsened Deltas"
                  subtitle="Metrics with trend_status worsened. If empty, the run has no regressions."
                  rows={worsenedTrendRows}
                  variant="worsened"
                  emptyText="No rows available."
                />
                </div>
              </div>
            </>
          )}

          <Card className="gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="border-b border-border/60 px-4 !py-2">
              <CardTitle className="text-sm font-semibold">Filtered Trend Rows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-b-xl border-t border-border/40">
                <CustomTableData
                  data={trendTableRows}
                  columns={trendTableColumns}
                  rowKey="id"
                  scrollHeightClass="max-h-[min(520px,62vh)]"
                  HorizontalScroll
                  wrapLongCells
                  truncateCharLimit={64}
                  roundDecimals={2}
                  bodyCellClassName="h-9"
                  emptyState={
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No trend rows in the API response.
                    </div>
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Sheet open={drillRow != null} onOpenChange={(open) => !open && setDrillRow(null)}>
            <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
              <SheetHeader className="shrink-0 space-y-1 pr-6 text-left">
                <SheetTitle className="text-base">Trend row</SheetTitle>
                <SheetDescription className=" text-xs">
                  {drillRow
                    ? `${strField(drillRow.object_name) || strField(drillRow.object_key)} · ${strField(drillRow.metric_name)}`
                    : ''}
                </SheetDescription>
              </SheetHeader>
              <pre className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed">
                {drillRow ? JSON.stringify(drillRow, null, 2) : ''}
              </pre>
            </SheetContent>
          </Sheet>

          {evidenceSheet != null && evidenceSheet.error != null && !evidenceSheet.loading ? (
            <Sheet open onOpenChange={(open) => !open && setEvidenceSheet(null)}>
              <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
                <SheetHeader className="shrink-0 space-y-1 pr-6 text-left">
                  <SheetTitle className="text-base">{evidenceSheet.title}</SheetTitle>
                  <SheetDescription className="break-all font-mono text-[10px] text-muted-foreground">
                    {evidenceSheet.requestPath}
                  </SheetDescription>
                </SheetHeader>
                <p className="mt-4 text-sm text-destructive">{evidenceSheet.error}</p>
              </SheetContent>
            </Sheet>
          ) : (
            <AgenticEvidenceSheet
              open={evidenceSheet != null}
              onOpenChange={(open) => {
                if (!open) setEvidenceSheet(null);
              }}
              title={evidenceSheet?.title ?? 'Evidence'}
              loading={evidenceSheet?.loading ?? false}
              rowData={evidenceSheet?.rows ?? []}
              columnDefs={[]}
              titleId="dq-trends-evidence-sheet-title"
            />
          )}
        </>
      ) : null}
    </div>
  );
}

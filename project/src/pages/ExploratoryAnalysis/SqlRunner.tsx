import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { fetchWorkspaceTenants, fetchTenantDomains } from '@/controllers/API/semanticsApi';
import type { TenantListItem, WorkspaceDomainItem } from '@/controllers/API/semanticsApi';
import {
  fetchViews, fetchViewSchema, executeViewQuery,
  type ViewItem, type ViewSchemaColumn,
} from '@/controllers/API/sqlRunnerApi';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, Play, Copy, RefreshCw, Search,
  Loader2, Info, Table2, Type, Hash, Calendar, Filter,
  Pencil, Trash2, BarChart3, Check,
  LineChart as LineChartIcon, AreaChart as AreaChartIcon, TableIcon,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import ViewsSvg from '@/assets/images/views.svg';
import AddDatabaseIcon from '@/assets/images/icons8-add-database-80.png';
import { cn } from '@/lib/utils';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

// ─── Constants ───────────────────────────────────────────────────────────────

const LIMIT_OPTIONS = [10, 50, 100, 500, 1000] as const;

const BLUE_PALETTE = [
  '#93c5fd', '#7dd3fc', '#a5b4fc', '#bae6fd', '#c7d2fe',
  '#60a5fa', '#7dd3fc', '#a5b4fc', '#bfdbfe', '#ddd6fe',
];

const CHART_MODES = [
  { mode: 'line', icon: LineChartIcon, label: 'Line' },
  { mode: 'bar', icon: BarChart3, label: 'Bar' },
  { mode: 'area', icon: AreaChartIcon, label: 'Area' },
  { mode: 'table', icon: TableIcon, label: 'Table' },
] as const;

type ChartMode = (typeof CHART_MODES)[number]['mode'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getColumnTypeIcon(dataType: string | undefined) {
  if (!dataType) return <Type className="size-3.5 text-muted-foreground shrink-0" />;
  const t = dataType.toLowerCase();
  if (/\b(int|integer|number|numeric|decimal|float|double|bigint|smallint)\b/.test(t))
    return <Hash className="size-3.5 text-muted-foreground shrink-0" />;
  if (/\b(date|time|timestamp|datetime)\b/.test(t))
    return <Calendar className="size-3.5 text-muted-foreground shrink-0" />;
  return <Type className="size-3.5 text-muted-foreground shrink-0" />;
}

function renumberQueryTabs(tabs: { id: string; label: string; sql: string }[]) {
  return tabs.map((tab, index) => ({ ...tab, label: `Query ${index + 1}` }));
}

function updateSqlLimitClause(sql: string, newLimit: number): string {
  const trimmed = sql.trim();
  if (!trimmed) return trimmed;
  const limitRegex = /\bLIMIT\s+\d+\s*;?\s*$/i;
  if (limitRegex.test(trimmed)) return trimmed.replace(limitRegex, `LIMIT ${newLimit}`);
  return `${trimmed}\nLIMIT ${newLimit}`;
}

function inferChartAxes(columns: string[], rows: Record<string, unknown>[]) {
  if (!columns.length || !rows.length) return { xKey: '', numericKeys: [] as string[] };
  const numericKeys: string[] = [];
  const stringKeys: string[] = [];
  for (const col of columns) {
    const sample = rows.find((r) => r[col] != null)?.[col];
    (typeof sample === 'number' ? numericKeys : stringKeys).push(col);
  }
  return {
    xKey: stringKeys[0] ?? columns[0],
    numericKeys: numericKeys.length > 0 ? numericKeys : columns.slice(1),
  };
}

// ─── TenantCombobox ──────────────────────────────────────────────────────────

const TenantCombobox = memo(function TenantCombobox({
  tenants,
  tenantId,
  loading,
  onSelect,
}: {
  tenants: TenantListItem[];
  tenantId: string;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = tenants.find((t) => t.tenant_id === tenantId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? tenants.filter(
          (t) =>
            (t.display_name ?? t.tenant_id).toLowerCase().includes(q) ||
            t.tenant_id.toLowerCase().includes(q)
        )
      : tenants;
  }, [tenants, search]);

  // Focus search when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className={cn(
            'flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm ring-offset-background',
            'hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            open && 'ring-1 ring-ring'
          )}
        >
          <span className="truncate text-left flex-1 min-w-0">
            {loading
              ? 'Loading...'
              : selected
              ? (selected.display_name ?? selected.tenant_id)
              : 'Select tenant'}
          </span>
          {loading ? (
            <Loader2 className="size-3.5 ml-1 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 ml-1 shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] p-0 shadow-md"
        style={{ minWidth: 250 }}
      >
        {/* Search input */}
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="flex items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
              >
             <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[160px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">No tenants found</p>
          )}
          {filtered.map((t) => {
            const isActive = t.tenant_id === tenantId;
            return (
              <button
                key={t.tenant_id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-accent',
                  isActive && 'bg-primary/10 text-primary font-semibold'
                )}
                onClick={() => {
                  onSelect(t.tenant_id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('size-3 shrink-0', isActive ? 'opacity-100 text-primary' : 'opacity-0')}
                />
                <span className="truncate">{t.display_name ?? t.tenant_id}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});

// ─── DataTable (shared between chart-table mode and results) ─────────────────

const DataTable = memo(function DataTable({
  columns, rows, sortColumn, sortDir, onSort, maxHeight,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  sortColumn: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
  maxHeight?: number | string;
}) {
  return (
    <div className="overflow-auto rounded-md border border-border" style={maxHeight ? { maxHeight, height: maxHeight === '100%' ? '100%' : undefined } : undefined}>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col}
                className="border-r border-border/50 last:border-r-0 px-3 py-1.5 text-left font-medium text-foreground whitespace-nowrap cursor-pointer select-none min-w-[80px] bg-muted hover:bg-muted/80"
                onClick={() => onSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col}
                  {sortColumn === col && (
                    <span className="text-primary" aria-hidden>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/40">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate border-r border-border/30 last:border-r-0"
                >
                  {row[col] != null ? String(row[col]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export default function SqlRunner() {
  // Sidebar state
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [domains, setDomains] = useState<WorkspaceDomainItem[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [domainId, setDomainId] = useState('');
  const [views, setViews] = useState<ViewItem[]>([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [schemaSearch, setSchemaSearch] = useState('');
  const [expandedViewNames, setExpandedViewNames] = useState<Set<string>>(new Set());
  const [schemaCache, setSchemaCache] = useState<Record<string, ViewSchemaColumn[]>>({});
  const [schemaLoadingFor, setSchemaLoadingFor] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);

  // Query tabs
  const [queryTabs, setQueryTabs] = useState<{ id: string; label: string; sql: string }[]>([
    { id: '1', label: 'Query 1', sql: '' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [limit, setLimit] = useState(100);

  // Query execution
  const [running, setRunning] = useState(false);
  const [resultRows, setResultRows] = useState<Record<string, unknown>[] | null>(null);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [resultSearch, setResultSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // UI toggles
  const [editorOpen, setEditorOpen] = useState(true);
  const [chartOpen, setChartOpen] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>('bar');

  // Tab overflow & rename
  const [overflowPopoverOpen, setOverflowPopoverOpen] = useState(false);
  const [tabSearch, setTabSearch] = useState('');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tabIdCounterRef = useRef(1);
  const [ctxMenu, setCtxMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const lastExecutedLimitRef = useRef<number | null>(null);

  const tenantsLoading = tenants.length === 0;

  // ─── Overflow detection ──────────────────────────────────────────────────

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [queryTabs]);

  // ─── Data loading ────────────────────────────────────────────────────────

  const loadTenants = useCallback(async () => {
    try {
      const list = await fetchWorkspaceTenants();
      setTenants(list);
      if (list.length > 0) setTenantId((prev) => prev || list[0].tenant_id);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load tenants'));
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  useEffect(() => {
    if (!tenantId) {
      setDomains([]);
      setDomainId('');
      setDomainsLoading(false);
      return;
    }
    let cancelled = false;
    setDomainsLoading(true);
    (async () => {
      try {
        const res = await fetchTenantDomains(tenantId);
        const list = res?.domains ?? [];
        if (!cancelled) {
          setDomains(list);
          setDomainId(list[0]?.domain_id ?? '');
        }
      } catch {
        if (!cancelled) setDomains([]);
      } finally {
        if (!cancelled) setDomainsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const loadViews = useCallback(async () => {
    if (!tenantId) return;
    setViewsLoading(true);
    try { setViews((await fetchViews(tenantId, domainId)) ?? []); }
    catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load views'));
      setViews([]);
    }
    finally { setViewsLoading(false); }
  }, [tenantId, domainId]);

  useEffect(() => { if (tenantId) loadViews(); }, [tenantId, domainId, loadViews]);

  const ensureSchemaCached = useCallback(async (viewName: string) => {
    if (!tenantId || !viewName) return;
    setSchemaLoadingFor(viewName);
    try { setSchemaCache((c) => ({ ...c, [viewName]: [] })); const cols = await fetchViewSchema(viewName, tenantId, domainId); setSchemaCache((c) => ({ ...c, [viewName]: cols ?? [] })); }
    catch (error) {
      toast.error(
        getDisplayErrorMessage(error, `Failed to load schema for ${viewName}`),
      );
    }
    finally { setSchemaLoadingFor(null); }
  }, [tenantId, domainId]);

  const expandAndLoadSchema = useCallback((viewName: string) => {
    setExpandedViewNames((prev) => {
      const next = new Set(prev);
      if (next.has(viewName)) { next.delete(viewName); } else { next.add(viewName); }
      return next;
    });
    if (!schemaCache[viewName]) ensureSchemaCached(viewName);
  }, [schemaCache, ensureSchemaCached]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const filteredViews = useMemo(() => {
    const q = schemaSearch.trim().toLowerCase();
    return q ? views.filter((v) => v.view_name.toLowerCase().includes(q)) : views;
  }, [views, schemaSearch]);

  const filteredAndSortedRows = useMemo(() => {
    if (!resultRows?.length) return [];
    let out = resultRows;
    const q = resultSearch.trim().toLowerCase();
    if (q) out = out.filter((row) => resultColumns.some((col) => String(row[col] ?? '').toLowerCase().includes(q)));
    if (sortColumn && resultColumns.includes(sortColumn)) {
      out = [...out].sort((a, b) => {
        const va = a[sortColumn], vb = b[sortColumn];
        if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
        const cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [resultRows, resultColumns, resultSearch, sortColumn, sortDir]);

  const chartAxes = useMemo(() => inferChartAxes(resultColumns, filteredAndSortedRows), [resultColumns, filteredAndSortedRows]);

  const filteredTabsForPopover = useMemo(() => {
    const q = tabSearch.trim().toLowerCase();
    return q ? queryTabs.filter((t) => t.label.toLowerCase().includes(q)) : queryTabs;
  }, [queryTabs, tabSearch]);

  // ─── Tab actions ─────────────────────────────────────────────────────────

  const activeTab = queryTabs.find((t) => t.id === activeTabId);
  const activeSql = activeTab?.sql ?? '';

  const setActiveSql = useCallback((sql: string) => {
    setQueryTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t)));
  }, [activeTabId]);

  const addTab = useCallback(() => {
    tabIdCounterRef.current += 1;
    const nextId = String(tabIdCounterRef.current);
    setQueryTabs((prev) => {
      const next = renumberQueryTabs([...prev, { id: nextId, label: '', sql: '' }]);
      return next;
    });
    setActiveTabId(nextId);
  }, []);

  const closeTab = useCallback((id: string) => {
    if (queryTabs.length <= 1) return;
    const idx = queryTabs.findIndex((t) => t.id === id);
    const next = renumberQueryTabs(queryTabs.filter((t) => t.id !== id));
    setQueryTabs(next);
    if (activeTabId === id) setActiveTabId(next[Math.min(idx, next.length - 1)]?.id ?? next[0].id);
  }, [queryTabs, activeTabId]);

  const renameTab = useCallback((id: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setQueryTabs((prev) => prev.map((t) => (t.id === id ? { ...t, label: trimmed } : t)));
    setRenamingTabId(null);
  }, []);

  const startRename = useCallback((id: string) => {
    const tab = queryTabs.find((t) => t.id === id);
    setRenamingTabId(id);
    setRenameValue(tab?.label ?? '');
    setCtxMenu(null);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [queryTabs]);

  const deleteTab = useCallback((id: string) => { setCtxMenu(null); closeTab(id); }, [closeTab]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setCtxMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
  }, [ctxMenu]);

  // ─── Query execution ─────────────────────────────────────────────────────

  const toggleSort = useCallback((col: string) => {
    setSortColumn((prev) => { if (prev === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else setSortDir('asc'); return col; });
  }, []);

  const runQuery = useCallback(async () => {
    if (!tenantId || !activeSql.trim()) { toast.error('Select tenant and enter SQL'); return; }
    setRunning(true); setQueryError(null); setResultRows(null); setResultColumns([]);
    setResultSearch(''); setSortColumn(null); setSortDir('asc');
    try {
      const res = await executeViewQuery({ tenant_id: tenantId, domain_id: domainId, sql: activeSql.trim(), limit });
      const rows = (res?.rows ?? res?.data ?? []) as Record<string, unknown>[];
      const cols = res?.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
      setResultRows(Array.isArray(rows) ? rows : []);
      setResultColumns(Array.isArray(cols) ? cols : []);
      lastExecutedLimitRef.current = limit;
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Query failed';
      setQueryError(message); toast.error(message);
    } finally { setRunning(false); }
  }, [tenantId, domainId, activeSql, limit]);

  const handleLimitChange = useCallback((value: string) => {
    const newLimit = Number(value);
    setLimit(newLimit);
    setQueryTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, sql: updateSqlLimitClause(t.sql, newLimit) } : t))
    );
  }, [activeTabId]);

  const runQueryRef = useRef(runQuery);
  runQueryRef.current = runQuery;

  useEffect(() => {
    if (
      resultRows === null
      || !tenantId
      || running
      || lastExecutedLimitRef.current === limit
    ) return;
    void runQueryRef.current();
  }, [limit, resultRows, tenantId, running]);

  const copySql = useCallback(() => {
    if (!activeSql) return;
    navigator.clipboard.writeText(activeSql);
    toast.success('SQL copied to clipboard');
  }, [activeSql]);

  const insertViewRef = useCallback((viewName: string) => {
    const ref = viewName.includes('.') ? viewName : `public.${viewName}`;
    setActiveSql(`SELECT * FROM ${ref} LIMIT ${limit}\n`);
  }, [limit, setActiveSql]);

  // ─── ECharts option ──────────────────────────────────────────────────────

  const echartsOption = useMemo(() => {
    const rows = filteredAndSortedRows;
    if (!rows.length || !chartAxes.numericKeys.length) return null;

    const xData = rows.map((r) => String(r[chartAxes.xKey] ?? ''));
    const series = chartAxes.numericKeys.map((key, idx) => {
      const color = BLUE_PALETTE[idx % BLUE_PALETTE.length];
      const base = { name: key, data: rows.map((r) => (r[key] as number) ?? 0), itemStyle: { color }, emphasis: { focus: 'series' as const } };
      if (chartMode === 'line') return { ...base, type: 'line' as const, smooth: true, lineStyle: { width: 2, color }, symbol: 'circle' as const, symbolSize: 4 };
      if (chartMode === 'area') return { ...base, type: 'line' as const, smooth: true, areaStyle: { opacity: 0.25, color }, lineStyle: { width: 2, color }, symbol: 'circle' as const, symbolSize: 4 };
      return { ...base, type: 'bar' as const, barMaxWidth: 32, itemStyle: { color, borderRadius: [3, 3, 0, 0] } };
    });

    return {
      color: BLUE_PALETTE,
      tooltip: { trigger: 'axis', axisPointer: { type: chartMode === 'bar' ? 'shadow' : 'cross', crossStyle: { color: '#999' } }, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e5e7eb', borderWidth: 1, textStyle: { fontSize: 12, color: '#374151' } },
      legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11, color: '#6b7280' }, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: '3%', right: '4%', top: 30, bottom: 70, containLabel: true },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, start: 0, end: rows.length > 30 ? 60 : 100 },
        { type: 'slider', xAxisIndex: 0, start: 0, end: rows.length > 30 ? 60 : 100, height: 18, bottom: 30, borderColor: '#dbeafe', fillerColor: 'rgba(147,197,253,0.2)', handleStyle: { color: '#93c5fd' } },
      ],
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: 40, fontSize: 10, color: '#6b7280', interval: 0, overflow: 'truncate', width: 90 }, axisTick: { alignWithLabel: true }, axisLine: { lineStyle: { color: '#e5e7eb' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#6b7280' }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLine: { show: false } },
      series,
    };
  }, [filteredAndSortedRows, chartAxes, chartMode]);

  // ─── Chart content (memoized) ────────────────────────────────────────────

  const chartContent = useMemo(() => {
    const rows = filteredAndSortedRows;
    if (!rows.length || !chartAxes.numericKeys.length) {
      return (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <BarChart3 className="size-8 text-primary/60 mb-1" />
          <p className="text-xs">Run a query with numeric columns to see charts</p>
        </div>
      );
    }
    if (chartMode === 'table') {
      return <DataTable columns={resultColumns} rows={rows} sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} maxHeight={260} />;
    }
    if (!echartsOption) return null;
    return <ReactECharts option={echartsOption} style={{ height: 260, width: '100%' }} notMerge lazyUpdate />;
  }, [filteredAndSortedRows, chartAxes, chartMode, resultColumns, sortColumn, sortDir, toggleSort, echartsOption]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ── */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/20">
          <div className="border-b border-border p-1 space-y-1">
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-wider mb-1 block">Tenant</label>
              {/* ↓ Replaced Select with searchable TenantCombobox */}
              <TenantCombobox
                tenants={tenants}
                tenantId={tenantId}
                loading={tenantsLoading}
                onSelect={setTenantId}
              />
            </div>
            {tenantId && (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-wider mb-1 block">Domain</label>
                <Select value={domainId} onValueChange={setDomainId} disabled={domainsLoading}>
                  <SelectTrigger className="h-7 w-full text-xs">
                    <SelectValue placeholder={domainsLoading ? 'Loading...' : domains.length === 0 ? 'No domains' : 'Select domain'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[160px]">
                    {domainsLoading ? (
                      <div className="flex items-center gap-2 py-2 px-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin shrink-0" />
                        Loading domains...
                      </div>
                    ) : (
                      domains.map((d) => (
                        <SelectItem key={d.domain_id} value={d.domain_id} className="text-xs">
                          {d.display_name ?? d.domain_id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-1 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground shrink-0">Views</span>
                <span className="rounded bg-primary/10 border border-primary/20 px-1 py-0 text-xs font-bold text-primary">{views.length}</span>
              </div>
              <Button variant="outline" size="sm" className="!h-6 px-1.5 text-xs text-primary border-primary/50 hover:bg-primary/10 shrink-0" onClick={loadViews} disabled={viewsLoading || !tenantId}>
                {viewsLoading ? <Loader2 className="size-2 animate-spin" /> : <RefreshCw className="size-2" />}
                <span className="ml-1">Reload</span>
              </Button>
            </div>
            <div className="px-1 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search views and members"
                  className="h-7 pl-8 pr-6 text-xs"
                  value={schemaSearch}
                  onChange={(e) => setSchemaSearch(e.target.value)}
                />
                {schemaSearch && (
                  <button
                    type="button"
                    onClick={() => setSchemaSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                    aria-label="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-1 py-1 pb-2">
              {viewsLoading && <div className="flex items-center gap-2 py-4 text-muted-foreground text-xs"><Loader2 className="size-4 animate-spin" /> Loading views...</div>}
              {!viewsLoading && filteredViews.length === 0 && <p className="py-4 text-xs text-muted-foreground">No views found</p>}
              {!viewsLoading && filteredViews.length > 0 && (
                <ul className="space-y-0.5">
                  {filteredViews.map((view) => {
                    const isExp = expandedViewNames.has(view.view_name);
                    const cols = schemaCache[view.view_name];
                    const ldg = schemaLoadingFor === view.view_name;
                    return (
                      <li key={view.view_name} className="rounded-md overflow-hidden">
                        <div className={cn('flex items-center gap-2 rounded px-1 py-1 transition-colors', isExp ? 'bg-background/80 text-foreground' : 'bg-transparent text-muted-foreground')}>
                          <button type="button" onClick={() => expandAndLoadSchema(view.view_name)} className="flex items-center justify-center w-5 h-5 rounded shrink-0 hover:bg-muted" aria-label={isExp ? 'Collapse' : 'Expand'}>
                            {isExp ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </button>
                          <span className={cn('shrink-0 size-4 rounded flex items-center justify-center', isExp ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                            <img src={ViewsSvg} alt="" className="size-3.5" />
                          </span>
                          <button type="button" onClick={() => insertViewRef(view.view_name)} className="flex-1 min-w-0 text-left font-semibold text-[12px] hover:underline truncate">
                            {view.view_name}
                          </button>
                        </div>
                        {isExp && (
                          <div className="py-0.5 ml-3 my-0.5 space-y-0.5">
                            {ldg && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-1"><Loader2 className="size-3 animate-spin" /> Loading columns...</div>}
                            {!ldg && cols?.length === 0 && <p className="text-[10px] text-muted-foreground py-1">No columns</p>}
                            {!ldg && cols && cols.length > 0 && (
                              <ul className="space-y-1">
                                {cols.map((c) => {
                                  const key = `${view.view_name}|${c.column_name}`;
                                  const sel = selectedColumnKey === key;
                                  return (
                                    <li key={String(c.column_name ?? '')}>
                                      <button type="button" onClick={() => setSelectedColumnKey((p) => (p === key ? null : key))} className={cn('flex w-full items-center gap-2 bg-white dark:bg-background border rounded-lg shadow-sm px-2 py-1.5 text-left font-semibold text-xs transition-colors', sel ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'text-muted-foreground hover:bg-muted/70')}>
                                        {getColumnTypeIcon(c.data_type)}
                                        <span className="font-mono truncate flex-1 min-w-0">{String(c.column_name ?? '')}</span>
                                        <Filter className="size-3 opacity-50 shrink-0" />
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className="flex flex-1 flex-col min-h-0 overflow-y-auto">

          {/* SQL Editor */}
          <Collapsible open={editorOpen} onOpenChange={setEditorOpen}>
            <div className="flex items-center gap-2 p-1 pl-2 border-b border-border">
              <CollapsibleTrigger asChild>
                <button type="button" className="shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-muted">
                  {editorOpen ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4 text-primary" />}
                </button>
              </CollapsibleTrigger>
              <h2 className="text-[16px] font-bold text-primary shrink-0">SQL Editor</h2>

              {editorOpen && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={addTab} className="shrink-0 p-1 rounded hover:bg-muted">
                        <img src={AddDatabaseIcon} alt="Add Query" className="size-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Add Query</TooltipContent>
                  </Tooltip>

                  <div ref={tabsContainerRef} className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 scrollbar-none">
                    {queryTabs.map((tab) => {
                      if (renamingTabId === tab.id) {
                        return (
                          <div key={tab.id} className="flex items-center gap-1 shrink-0 rounded-xl border border-primary px-1 py-0.5">
                            <input
                              ref={renameInputRef}
                              className="text-xs font-bold bg-transparent border-none outline-none w-24"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => renameTab(tab.id, renameValue)}
                              onKeyDown={(e) => { if (e.key === 'Enter') renameTab(tab.id, renameValue); if (e.key === 'Escape') setRenamingTabId(null); }}
                            />
                          </div>
                        );
                      }
                      const isActive = activeTabId === tab.id;
                      return (
                        <div
                          key={tab.id}
                          onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                          className={cn(
                            'flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs shrink-0 cursor-pointer shadow-sm',
                            isActive
                              ? 'text-primary bg-primary/10 border-primary/30 font-semibold'
                              : 'bg-white dark:bg-background text-muted-foreground border-border hover:bg-muted'
                          )}
                        >
                          <button type="button" onClick={() => setActiveTabId(tab.id)} className="font-bold truncate max-w-[120px]">{tab.label}</button>
                          {queryTabs.length > 1 && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="rounded p-0.5 hover:bg-muted-foreground/20 opacity-70 shrink-0" aria-label="Close tab">×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {hasOverflow && (
                    <Popover open={overflowPopoverOpen} onOpenChange={setOverflowPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="shrink-0 p-1 rounded hover:bg-muted border border-border">
                          <ChevronDown className="size-4 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-2 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <Input placeholder="Search tabs..." className="h-7 pl-8 text-xs" value={tabSearch} onChange={(e) => setTabSearch(e.target.value)} />
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {filteredTabsForPopover.map((tab) => (
                            <button key={tab.id} type="button" onClick={() => { setActiveTabId(tab.id); setOverflowPopoverOpen(false); }} className={cn('w-full text-left text-xs rounded px-2 py-1.5 truncate', activeTabId === tab.id ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted')}>
                              {tab.label}
                            </button>
                          ))}
                          {filteredTabsForPopover.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No tabs found</p>}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </>
              )}
            </div>

            <CollapsibleContent>
              <div className="flex flex-col px-2 py-1">
                <textarea
                  className="w-full min-h-[120px] rounded-md border bg-background px-2 py-2 font-mono text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring resize-y"
                  placeholder="SELECT * FROM public.your_view LIMIT 100"
                  value={activeSql}
                  onChange={(e) => setActiveSql(e.target.value)}
                  spellCheck={false}
                  rows={6}
                />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Button onClick={runQuery} disabled={running || !tenantId} className="!h-7 bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-2.5">
                    {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    <span className="ml-1.5">Run</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={copySql} disabled={!activeSql} className="!h-7 text-xs px-2.5">
                    <Copy className="size-3.5" /><span className="ml-1.5">Copy SQL</span>
                  </Button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Limit</span>
                    <Select value={String(limit)} onValueChange={handleLimitChange}>
                      <SelectTrigger className="!h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{LIMIT_OPTIONS.map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Chart */}
          <Collapsible open={chartOpen} onOpenChange={setChartOpen}>
            <div className="flex items-center gap-2 p-1 pl-2 border-b border-border">
              <CollapsibleTrigger asChild>
                <button type="button" className="shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-muted">
                  {chartOpen ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4 text-primary" />}
                </button>
              </CollapsibleTrigger>
              <h2 className="text-[16px] font-bold text-primary shrink-0">Chart</h2>
              {chartOpen && (
                <div className="flex items-center gap-1 ml-auto">
                  {CHART_MODES.map(({ mode, icon: Icon, label }) => (
                    <button key={mode} type="button" onClick={() => setChartMode(mode)} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs border transition-colors', chartMode === mode ? 'bg-primary/10 text-primary border-primary/30 font-semibold' : 'text-muted-foreground border-transparent hover:bg-muted')}>
                      <Icon className="size-3.5" />{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <CollapsibleContent>
              <div className="px-3 py-1">{chartContent}</div>
            </CollapsibleContent>
          </Collapsible>

          {/* Results — always visible */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 p-1 pl-2 border-b border-border bg-background shrink-0">
              <h2 className="text-[14px] font-bold text-primary shrink-0">Results</h2>
              {resultRows != null && resultRows.length > 0 && (
                <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0 text-xs font-bold text-primary">{filteredAndSortedRows.length} rows</span>
              )}
              {resultRows != null && resultRows.length > 0 && (
                <div className="relative flex-1 max-w-xs ml-auto">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search results..."
                    className="h-6 pl-8 pr-6 text-xs"
                    value={resultSearch}
                    onChange={(e) => setResultSearch(e.target.value)}
                  />
                  {resultSearch && (
                    <button
                      type="button"
                      onClick={() => setResultSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                      aria-label="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden p-2 bg-muted/10">
              {queryError && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{queryError}</div>}
              {!queryError && resultRows === null && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Info className="size-8 text-primary/60 mb-2" /><p className="text-sm">Run query to see the results</p>
                </div>
              )}
              {!queryError && resultRows !== null && resultRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Table2 className="size-8 text-primary/60 mb-2" /><p className="text-sm">No rows returned</p>
                </div>
              )}
              {!queryError && resultRows != null && resultRows.length > 0 && (
                <DataTable columns={resultColumns} rows={filteredAndSortedRows} sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} maxHeight="100%" />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div className="fixed z-[999] min-w-[140px] rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => startRename(ctxMenu.tabId)}>
            <Pencil className="size-3.5" /> Rename
          </button>
          {queryTabs.length > 1 && (
            <button type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10" onClick={() => deleteTab(ctxMenu.tabId)}>
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
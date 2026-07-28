import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  AppearanceSection,
  ColumnsSection,
  PaginationSection,
  RefreshSection,
  SortingFilteringSection,
  TableCustomizeCollapsibleSection,
  TableCustomizePanelShell,
  TableCustomizeSwatchStyles,
  TypographySection,
} from './TableChartCustomizationSections';

export type TableBadgeRange = {
  color: string;
  min?: number;
  max?: number;
};

/** Legacy: column → color string. Current: column → color ranges with optional min/max. */
export type TableColumnBadges = Record<string, string | TableBadgeRange | TableBadgeRange[]>;

export interface TableChartConfig {
  refreshIntervalSeconds: number;
  appearance: {
    headerBg: string;
    headerTextColor: string;
    striped: boolean;
    density: 'compact' | 'comfortable';
    showBorder: boolean;
  };
  columns: {
    available: { key: string; label: string }[];
    visible: string[];
    align: 'left' | 'center' | 'right';
    badges: TableColumnBadges;
    fixedColumns: string[];
    progressBars: Record<string, { color: string; max: number }>;
  };
  pagination: {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions: number[];
  };
  sortingFiltering: {
    sortable: boolean;
    filterable: boolean;
    defaultSortColumn: string | null;
    defaultSortDir: 'asc' | 'desc';
  };
  typography: {
    headerFontSize: number;
    cellFontSize: number;
    headerFontWeight: 'normal' | 'medium' | 'semibold';
  };
}

export const DEFAULT_TABLE_CHART_CONFIG: TableChartConfig = {
  refreshIntervalSeconds: 0,
  appearance: {
    headerBg: 'var(--muted)',
    headerTextColor: 'var(--muted-foreground)',
    striped: false,
    density: 'comfortable',
    showBorder: true,
  },
  columns: {
    available: [],
    visible: [],
    align: 'left',
    badges: {},
    fixedColumns: [],
    progressBars: {},
  },
  pagination: {
    enabled: true,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
  sortingFiltering: {
    sortable: true,
    filterable: false,
    defaultSortColumn: null,
    defaultSortDir: 'asc',
  },
  typography: {
    headerFontSize: 12,
    cellFontSize: 13,
    headerFontWeight: 'semibold',
  },
};

type SectionKey = 'refresh' | 'appearance' | 'columns' | 'pagination' | 'sorting' | 'typography';

interface SectionMeta {
  key: SectionKey;
  title: string;
  description: string;
  defaultOpen?: boolean;
}

const SECTIONS: SectionMeta[] = [
  { key: 'appearance', title: 'Appearance', description: 'Header colors, borders, and row style', defaultOpen: true },
  { key: 'columns', title: 'Columns', description: 'Visibility, badges, progress bars, and alignment' },
  { key: 'pagination', title: 'Pagination', description: 'Paging and page size options' },
  { key: 'sorting', title: 'Sorting & filtering', description: 'Column sort and filter controls' },
  { key: 'typography', title: 'Typography', description: 'Header and cell text sizing' },
  { key: 'refresh', title: 'Live & animation', description: 'Auto-refresh table data on a schedule' },
];

interface TableChartCustomizationProps {
  value?: TableChartConfig;
  onChange?: (config: TableChartConfig) => void;
  availableColumns?: { key: string; label: string }[];
  /** Override the panel subtitle under "Chart options". */
  panelDescription?: string;
  /** Pivot uses the same columns section for row + column dimension fields. */
  variant?: 'table' | 'pivot';
}

export default function TableChartCustomization({
  value,
  onChange,
  availableColumns = [],
  panelDescription = 'Table chart display settings',
  variant = 'table',
}: TableChartCustomizationProps) {
  const [config, setConfig] = useState<TableChartConfig>(() => ({
    ...DEFAULT_TABLE_CHART_CONFIG,
    ...value,
    columns: {
      ...DEFAULT_TABLE_CHART_CONFIG.columns,
      ...value?.columns,
      available: availableColumns.length ? availableColumns : value?.columns?.available ?? [],
    },
  }));

  React.useEffect(() => {
    if (!availableColumns.length) return;
    setConfig((prev) => {
      const same =
        prev.columns.available.length === availableColumns.length &&
        prev.columns.available.every(
          (c, i) => c.key === availableColumns[i]?.key && c.label === availableColumns[i]?.label,
        );
      if (same) return prev;
      return {
        ...prev,
        columns: { ...prev.columns, available: availableColumns },
      };
    });
  }, [availableColumns]);

  const sections = useMemo(() => {
    if (variant !== 'pivot') return SECTIONS;
    return SECTIONS.map((s) =>
      s.key === 'columns'
        ? {
            ...s,
            title: 'Rows & columns',
            description: 'Visibility, freeze, badges, and alignment for pivot row and column fields',
          }
        : s,
    );
  }, [variant]);

  const update = <K extends keyof TableChartConfig>(section: K, patch: Partial<TableChartConfig[K]>) => {
    setConfig((prev) => {
      const next = { ...prev, [section]: { ...(prev[section] as object), ...patch } };
      onChange?.(next);
      return next;
    });
  };

  const updateRefreshInterval = (seconds: number) => {
    setConfig((prev) => {
      const next = { ...prev, refreshIntervalSeconds: seconds };
      onChange?.(next);
      return next;
    });
  };

  const visibleCount = useMemo(() => {
    const total = config.columns.available.length;
    const shown = config.columns.visible.length || total;
    return { shown, total };
  }, [config.columns]);

  const renderSectionBody = (key: SectionKey) => {
    switch (key) {
      case 'refresh':
        return <RefreshSection value={config.refreshIntervalSeconds} onChange={updateRefreshInterval} />;
      case 'appearance':
        return <AppearanceSection value={config.appearance} onChange={(p) => update('appearance', p)} />;
      case 'columns':
        return (
          <ColumnsSection
            value={config.columns}
            onChange={(p) => update('columns', p)}
            visibleCount={visibleCount}
            variant={variant}
          />
        );
      case 'pagination':
        return <PaginationSection value={config.pagination} onChange={(p) => update('pagination', p)} />;
      case 'sorting':
        return (
          <SortingFilteringSection
            value={config.sortingFiltering}
            columns={config.columns.available}
            onChange={(p) => update('sortingFiltering', p)}
          />
        );
      case 'typography':
        return <TypographySection value={config.typography} onChange={(p) => update('typography', p)} />;
      default:
        return null;
    }
  };

  return (
    <TableCustomizePanelShell title="Chart options" description={panelDescription}>
      <TableCustomizeSwatchStyles />
      {sections.map((section) => (
        <TableCustomizeCollapsibleSection
          key={section.key}
          title={section.title}
          description={section.description}
          defaultOpen={section.defaultOpen}
        >
          {renderSectionBody(section.key)}
        </TableCustomizeCollapsibleSection>
      ))}
    </TableCustomizePanelShell>
  );
}

export function cssColorToHex(color: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
  return '#e5e5e5';
}

export function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function formatBadgeBound(value?: number): string {
  return value === undefined ? '' : String(value);
}

/** Normalize legacy string / single-object / array badge configs into ranges. */
export function normalizeTableBadgeRanges(
  value: string | TableBadgeRange | TableBadgeRange[] | null | undefined,
): TableBadgeRange[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    return value ? [{ color: value }] : [];
  }
  if (Array.isArray(value)) {
    return value
      .filter((r) => r && typeof r.color === 'string' && r.color)
      .map((r) => ({
        color: r.color,
        min: typeof r.min === 'number' && Number.isFinite(r.min) ? r.min : undefined,
        max: typeof r.max === 'number' && Number.isFinite(r.max) ? r.max : undefined,
      }));
  }
  if (typeof value === 'object' && typeof value.color === 'string' && value.color) {
    return [{
      color: value.color,
      min: typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : undefined,
      max: typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : undefined,
    }];
  }
  return [];
}

function rangeMatchesValue(range: { min?: number; max?: number }, numeric: number): boolean {
  const minOk = range.min === undefined || numeric >= range.min;
  const maxOk = range.max === undefined || numeric <= range.max;
  return minOk && maxOk;
}

/**
 * Resolve badge bands against a column's data min→max (gauge-style).
 * Empty From/To bounds are filled by equally splitting [autoMin, autoMax].
 */
export function resolveTableBadgeBands(
  ranges: TableBadgeRange[],
  autoMin?: number,
  autoMax?: number,
): Array<{ color: string; min?: number; max?: number }> {
  if (ranges.length === 0) return [];

  const hasAuto =
    typeof autoMin === 'number' &&
    typeof autoMax === 'number' &&
    Number.isFinite(autoMin) &&
    Number.isFinite(autoMax);

  if (!hasAuto) return ranges;

  const min = autoMin;
  const max = autoMax >= autoMin ? autoMax : autoMin;
  const span = max - min;
  const step = ranges.length > 0 ? span / ranges.length : 0;

  const segments = ranges.map((r, index) => {
    const defaultStart = min + index * step;
    const defaultEnd = index === ranges.length - 1 ? max : min + (index + 1) * step;
    const start = r.min !== undefined ? r.min : defaultStart;
    const end = r.max !== undefined ? r.max : defaultEnd;
    return {
      color: r.color,
      min: start,
      max: Math.max(start, end),
    };
  });

  if (segments.length > 1) {
    segments[0].min = ranges[0].min !== undefined ? segments[0].min! : min;
    segments[segments.length - 1].max =
      ranges[ranges.length - 1].max !== undefined ? segments[segments.length - 1].max! : max;
    for (let i = 0; i < segments.length - 1; i++) {
      const end = Math.max(segments[i].min!, Math.min(segments[i].max!, segments[i + 1].min!));
      segments[i].max = end;
      segments[i + 1].min = end;
    }
  }

  return segments;
}

/** Numeric min/max for a column across rows (used for auto badge bands). */
export function getColumnNumericExtent(
  rows: Array<Record<string, unknown>>,
  key: string,
): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const raw = row[key];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/** Pick badge color for a cell value from configured ranges (gauge-style min/max bands). */
export function resolveTableBadgeColor(
  config: string | TableBadgeRange | TableBadgeRange[] | null | undefined,
  cellValue: unknown,
  autoMin?: number,
  autoMax?: number,
): string | undefined {
  const ranges = normalizeTableBadgeRanges(config);
  if (ranges.length === 0) return undefined;

  const numeric = typeof cellValue === 'number' ? cellValue : Number(cellValue);
  if (!Number.isFinite(numeric)) {
    const hasBounds = ranges.some((r) => r.min !== undefined || r.max !== undefined);
    if (!hasBounds && ranges.length === 1) return ranges[0]?.color;
    return undefined;
  }

  const resolved = resolveTableBadgeBands(ranges, autoMin, autoMax);
  const matched = resolved.find((r) => rangeMatchesValue(r, numeric));
  if (matched) return matched.color;

  const hasBounds = resolved.some((r) => r.min !== undefined || r.max !== undefined);
  if (hasBounds) return undefined;

  return ranges[0]?.color;
}

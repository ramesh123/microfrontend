import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { Loader2, Search, FileSpreadsheet, Download } from 'lucide-react';
import { createChart } from '@/pages/Visualization/API/chartsApi';
import useFlowStore from '@/stores/flowStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

import { useAgGridTheme } from '@/hooks/useAgGridTheme';
import type { TableBadgeRange, TableChartConfig } from '../../Tablechartcustomization';
import {
  getColumnNumericExtent,
  resolveTableBadgeColor,
} from '../../Tablechartcustomization';

// Register AG Grid Enterprise Modules
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
]);

export interface PivotRawResponse {
  rows?: string[];
  columns?: string[];
  data?: Record<string, Record<string, any>>;
  apply_metrics_on?: string;
  metrics?: string[];
  schema?: string[];
  drilldown_applied?: boolean;
  unique_id?: string;
}

interface EnterprisePivotTableProps {
  data: Array<{ category: string; value: number; originalData: any }>;
  rawResponse?: PivotRawResponse | Record<string, unknown> | null;
  chartName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  flowId?: string;
  selectedSource?: string | null;
  config?: TableChartConfig;
}

interface ColGroupTreeNode {
  label: string;
  children: Record<string, ColGroupTreeNode>;
  compositeKey?: string;
}

function parseCompositePivotKey(value: string | number | null | undefined): string[] {
  const s = String(value ?? '').trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    const content = s.slice(1, -1);
    const matches = content.match(/("([^"]*)"|[^,]+)/g);
    if (matches) {
      return matches.map((m) => {
        let clean = m.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean.replace(/\\"/g, '"');
      });
    }
  }
  return s ? [s] : [];
}

export function EnterprisePivotTable({
  data,
  rawResponse,
  chartName = 'Pivot Table',
  flowId,
  selectedSource,
  config,
}: EnterprisePivotTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const { agTheme } = useAgGridTheme();
  const appearance = config?.appearance;
  const typography = config?.typography;
  const pagination = config?.pagination;
  const sortingFiltering = config?.sortingFiltering;
  const badges =
    config?.columns?.badges && typeof config.columns.badges === 'object'
      ? config.columns.badges
      : {};
  const visibleFields = config?.columns?.visible ?? [];
  const fixedFields = config?.columns?.fixedColumns ?? [];
  const hasVisibleFilter = visibleFields.length > 0;
  const valueAlign = config?.columns?.align ?? 'left';

  const compact = appearance?.density === 'compact';
  const headerFontWeight =
    typography?.headerFontWeight === 'normal'
      ? 400
      : typography?.headerFontWeight === 'medium'
        ? 500
        : 600;

  const pivotTheme = useMemo(() => {
    return agTheme.withParams({
      headerBackgroundColor: appearance?.headerBg || 'var(--muted)',
      headerTextColor: appearance?.headerTextColor || 'var(--foreground)',
      borderColor: appearance?.showBorder === false ? 'transparent' : 'var(--border)',
      rowHoverColor: 'var(--muted)',
      selectedRowBackgroundColor: 'var(--muted)',
      oddRowBackgroundColor: appearance?.striped ? 'color-mix(in srgb, var(--muted) 55%, transparent)' : undefined,
      headerHeight: compact ? 28 : 35,
      rowHeight: compact ? 26 : 32,
      fontSize: typography?.cellFontSize ?? 13,
      headerFontSize: typography?.headerFontSize ?? 12,
      headerFontWeight,
    });
  }, [agTheme, appearance, compact, typography, headerFontWeight]);

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Drill through states
  const [drillThroughOpen, setDrillThroughOpen] = useState(false);
  const [drillThroughLoading, setDrillThroughLoading] = useState(false);
  const [drillThroughRows, setDrillThroughRows] = useState<any[]>([]);
  const [drillThroughCols, setDrillThroughCols] = useState<string[]>([]);

  // Transpose backend pivot matrix to flat records
  const getFlatRows = (raw: PivotRawResponse, rowDimensions: string[], colDimensions: string[]) => {
    if (!raw || !raw.data || typeof raw.data !== 'object') return [];

    const metricKeys = Array.isArray(raw.metrics) && raw.metrics.length > 0 ? raw.metrics : Object.keys(raw.data);
    const colDim = colDimensions[0] || (Array.isArray(raw.columns) && raw.columns.length > 0 ? raw.columns[0] : null);
    const columnsSet = new Set<string>();

    metricKeys.forEach((metricKey) => {
      const mData = raw.data?.[metricKey];
      if (mData && typeof mData === 'object' && colDim && mData[colDim]) {
        (mData[colDim] as any[]).forEach((c) => {
          if (c !== colDim) columnsSet.add(String(c));
        });
      }
    });

    const columnsList = Array.from(columnsSet).sort();
    const firstMetric = metricKeys[0];
    const firstMetricData = raw.data?.[firstMetric];
    if (!firstMetricData || typeof firstMetricData !== 'object') return [];

    const joinedRowsKey = rowDimensions.join('_');
    let rowHeaderKey = joinedRowsKey in firstMetricData ? joinedRowsKey : null;
    if (!rowHeaderKey) {
      rowHeaderKey = Object.keys(firstMetricData).find(
        (k) => Array.isArray((firstMetricData as any)[k]) && k !== colDim
      ) || null;
    }

    if (!rowHeaderKey) return [];

    const rowHeaders = (firstMetricData as any)[rowHeaderKey];
    if (!Array.isArray(rowHeaders)) return [];

    const dataList: any[] = [];

    rowHeaders.forEach((rLabel) => {
      const rLabelStr = String(rLabel);
      if (rLabelStr === rowHeaderKey || (colDim && rLabelStr === colDim)) return;

      const rowObj: Record<string, any> = {};
      const parsedRows = parseCompositePivotKey(rLabelStr);
      rowDimensions.forEach((rDim, i) => {
        rowObj[rDim] = parsedRows[i] !== undefined ? parsedRows[i] : rLabelStr;
      });

      columnsList.forEach((cLabel) => {
        metricKeys.forEach((metricKey) => {
          let cellVal = 0;
          const mData = raw.data?.[metricKey];
          if (mData) {
            const colHeaders = colDim && mData[colDim] ? mData[colDim] : null;
            if (Array.isArray(colHeaders)) {
              const colIdx = colHeaders.indexOf(cLabel);
              const valsArr = mData[rLabelStr];
              if (colIdx >= 0 && Array.isArray(valsArr)) {
                const num = Number(valsArr[colIdx]);
                if (!Number.isNaN(num)) cellVal += num;
              }
            }
          }
          const fieldKey = metricKeys.length === 1 ? cLabel : `${cLabel}_${metricKey}`;
          rowObj[fieldKey] = cellVal;
        });
      });

      dataList.push(rowObj);
    });

    return dataList;
  };

  const buildColumnDefsFromTree = (
    node: ColGroupTreeNode,
    valsList: Array<{ field: string; aggFn: string }>,
    metricKeys: string[],
    colHeaderBadgeColor: string | null = null,
    depth = 0,
  ): any[] => {
    if (node.compositeKey) {
      return valsList.map((v) => {
        const fieldKey = metricKeys.length === 1 ? node.compositeKey! : `${node.compositeKey}_${v.field}`;
        return {
          headerName: v.field,
          field: fieldKey,
          aggFunc: 'sum',
          type: 'numericColumn',
          valueFormatter: (p: any) => formatNumber(p.value),
          headerClass: 'dynamic-pivot-header',
        };
      });
    }

    return Object.keys(node.children).map((label) => {
      const childNode = node.children[label];
      const childrenDefs = buildColumnDefsFromTree(
        childNode,
        valsList,
        metricKeys,
        colHeaderBadgeColor,
        depth + 1,
      );
      const def: any = {
        headerName: label || '(Blank)',
        children: childrenDefs,
      };
      // depth 0 = date values (01_DEC_23); apply column-field badge here.
      if (colHeaderBadgeColor && depth === 0) {
        def.headerClass = 'pivot-col-dim-badge pivot-col-dim-badge-0';
        def.headerGroupComponent = PivotColDimBadgeHeader;
        def.headerGroupComponentParams = { badgeColor: colHeaderBadgeColor };
      }
      return def;
    });
  };

  // Memoize flat rows mapping and column definitions
  const parsedData = useMemo(() => {
    if (!rawResponse) {
      return { rowData: [], columnDefs: [], rowsList: [], colDimHeaderColor: null as string | null };
    }
    const resp = rawResponse as PivotRawResponse;

    const rowDimensions = resp.rows || [];
    const colDimensions = resp.columns || [];
    const flatRows = getFlatRows(resp, rowDimensions, colDimensions);

    // Generate dynamic column definitions
    const colDim = colDimensions[0] || 'Val/Settle Date';
    const columnsSet = new Set<string>();
    const metricKeys = resp.metrics || Object.keys(resp.data || {});

    metricKeys.forEach((metricKey) => {
      const mData = resp.data?.[metricKey];
      if (mData && colDim && mData[colDim]) {
        (mData[colDim] as any[]).forEach((c) => {
          if (c !== colDim) columnsSet.add(String(c));
        });
      }
    });

    const columnsList = Array.from(columnsSet).sort();
    const defs: any[] = [];

    // Group rows definitions
    rowDimensions.forEach((rDim) => {
      defs.push({
        field: rDim,
        rowGroup: true,
        hide: true,
      });
    });

    const rowDimSet = new Set(rowDimensions);
    const badgeKeys = Object.keys(badges || {}).filter(
      (k) => getBadgeDisplayColor(badges?.[k]) != null,
    );
    const isRowBadgeKey = (k: string) =>
      rowDimSet.has(k) || rowDimensions.some((r) => fieldNamesMatch(r, k));
    const isMetricBadgeKey = (k: string) =>
      metricKeys.some((m) => m === k || fieldNamesMatch(m, k));

    let colDimHeaderColor: string | null = null;
    const colDimCandidates = colDimensions.length > 0 ? colDimensions : [colDim];
    for (const dim of colDimCandidates) {
      const key = badgeKeys.find((k) => k === dim || fieldNamesMatch(k, dim));
      if (!key) continue;
      colDimHeaderColor = getBadgeDisplayColor(badges[key]);
      if (colDimHeaderColor) break;
    }
    if (!colDimHeaderColor) {
      for (const key of badgeKeys) {
        if (isRowBadgeKey(key) || isMetricBadgeKey(key)) continue;
        colDimHeaderColor = getBadgeDisplayColor(badges[key]);
        if (colDimHeaderColor) break;
      }
    }

    // Build columns hierarchy tree
    const rootNode: ColGroupTreeNode = { label: 'root', children: {} };
    columnsList.forEach((cLabel) => {
      const parts = parseCompositePivotKey(cLabel);
      let current = rootNode;
      parts.forEach((part, index) => {
        if (!current.children[part]) {
          current.children[part] = { label: part, children: {} };
        }
        current = current.children[part];
        if (index === parts.length - 1) {
          current.compositeKey = cLabel;
        }
      });
    });

    const valsList = metricKeys.map((m) => ({ field: m, aggFn: 'Sum' }));
    const colDefs = buildColumnDefsFromTree(rootNode, valsList, metricKeys, colDimHeaderColor);
    defs.push(...colDefs);

    return {
      rowData: flatRows,
      columnDefs: defs,
      rowsList: rowDimensions,
      colDimHeaderColor,
    };
  }, [rawResponse, badges]);

  // Expanded levels state to control custom group columns visibility
  const [expandedLevels, setExpandedLevels] = useState<number[]>([]);

  // Reset expanded levels when pivot data/response changes
  useEffect(() => {
    setExpandedLevels([]);
  }, [rawResponse]);

  // Determine if a row group is expandable (disable for the last level)
  const lastLevelIndex = parsedData.rowsList.length - 1;
  const getRowClass = useCallback(
    (params: any) => {
      if (params.node.level >= lastLevelIndex) {
        return 'hide-chevron';
      }
      return undefined;
    },
    [lastLevelIndex]
  );

  // Track expanded levels
  const handleRowGroupOpened = useCallback((event: any) => {
    const api = event.api;
    const expandedList: number[] = [];
    api.forEachNode((node: any) => {
      if (node.group && node.expanded) {
        if (!expandedList.includes(node.level)) {
          expandedList.push(node.level);
        }
      }
    });
    setExpandedLevels((prev) => {
      if (prev.length === expandedList.length && prev.every((val, i) => val === expandedList[i])) {
        return prev;
      }
      return expandedList;
    });
  }, []);

  // Remove "Pin Column" option from the column header context menu
  const getMainMenuItems = useCallback((params: any) => {
    return params.defaultItems.filter((item: string) => item !== 'pinSubMenu');
  }, []);

  // Compute final column definitions incorporating custom group columns
  const pivotColumnLayout = useMemo(() => {
    const sortable = sortingFiltering?.sortable ?? true;
    const filterable = sortingFiltering?.filterable ?? false;
    const badgeKeys = Object.keys(badges || {}).filter(
      (k) => getBadgeDisplayColor(badges?.[k]) != null,
    );
    const rowDims = new Set(parsedData.rowsList);
    const resp = rawResponse as PivotRawResponse | null | undefined;
    const metricKeys =
      Array.isArray(resp?.metrics) && resp!.metrics!.length > 0
        ? resp!.metrics!
        : Object.keys(resp?.data || {});

    const matchConfiguredKey = (field?: string, keys: string[] = []): string | null => {
      if (!field || keys.length === 0) return null;
      if (keys.includes(field)) return field;
      const bySuffix = keys.find((k) => field.endsWith(`_${k}`));
      if (bySuffix) return bySuffix;
      const byPrefix = keys.find((k) => field.startsWith(`${k}_`) || field.includes(`_${k}_`));
      return byPrefix ?? null;
    };

    const colDimHeaderColor = parsedData.colDimHeaderColor;
    const colDimBadgeColorByDepth: Record<number, string> = colDimHeaderColor
      ? { 0: colDimHeaderColor }
      : {};

    /** Metric value cells only — row/column-dimension badges are applied elsewhere. */
    const resolveBadgeKeyForField = (field?: string): string | null => {
      if (!field || badgeKeys.length === 0) return null;

      const colDimsList =
        Array.isArray(resp?.columns) && resp!.columns!.length > 0
          ? resp!.columns!
          : colDimHeaderColor
            ? ['__col_dim__']
            : [];
      const isRowBadge = (k: string) =>
        rowDims.has(k) || [...rowDims].some((r) => fieldNamesMatch(r, k));
      const isMetricBadge = (k: string) =>
        metricKeys.some((m) => m === k || fieldNamesMatch(m, k));
      const isColDimBadge = (k: string) => {
        if (colDimsList[0] === '__col_dim__') return !isRowBadge(k) && !isMetricBadge(k);
        return colDimsList.some((c) => c === k || fieldNamesMatch(c, k));
      };

      const direct = matchConfiguredKey(field, badgeKeys);
      if (direct) {
        if (isRowBadge(direct) || isColDimBadge(direct) || !isMetricBadge(direct)) return null;
        return direct;
      }

      const metricBadgeKeys = badgeKeys.filter((k) => isMetricBadge(k));
      if (metricBadgeKeys.length === 0) return null;

      for (const badgeKey of metricBadgeKeys) {
        for (const metric of metricKeys) {
          if (!fieldNamesMatch(badgeKey, metric)) continue;
          if (metricKeys.length === 1) return badgeKey;
          if (
            field === metric ||
            field.endsWith(`_${metric}`) ||
            fieldNamesMatch(field, metric) ||
            field.endsWith(`_${badgeKey}`)
          ) {
            return badgeKey;
          }
        }
      }

      if (metricKeys.length === 1) {
        const metric = metricKeys[0];
        return metricBadgeKeys.find((k) => fieldNamesMatch(k, metric)) ?? null;
      }

      for (const badgeKey of metricBadgeKeys) {
        if (
          field.endsWith(`_${badgeKey}`) ||
          field.includes(`_${badgeKey}_`) ||
          fieldNamesMatch(field, badgeKey)
        ) {
          return badgeKey;
        }
      }

      return null;
    };

    const isFieldVisible = (field?: string, dimKey?: string) => {
      if (!hasVisibleFilter) return true;
      if (dimKey && visibleFields.includes(dimKey)) return true;
      return matchConfiguredKey(field, visibleFields) != null;
    };

    /** Preserve header badges from tree build; re-apply if missing. */
    const decorateLeaf = (def: any, depth = 0): any => {
      if (def?.children?.length) {
        const children = def.children.map((c: any) => decorateLeaf(c, depth + 1));
        const allHidden = children.length > 0 && children.every((c: any) => c.hide);
        const next: any = { ...def, children, hide: allHidden ? true : def.hide };

        const badgeColor = colDimBadgeColorByDepth[depth] ?? null;
        if (badgeColor && !next.headerGroupComponent) {
          next.headerClass = `pivot-col-dim-badge pivot-col-dim-badge-${depth}`;
          next.headerGroupComponent = PivotColDimBadgeHeader;
          next.headerGroupComponentParams = { badgeColor };
        }

        return next;
      }
      // Keep AG Grid row-group source columns hidden — group_* columns already show the name.
      if (def?.rowGroup) {
        return {
          ...def,
          hide: true,
          sortable,
          filter: filterable,
        };
      }
      if (!def?.field) {
        return {
          ...def,
          sortable,
          filter: filterable,
        };
      }

      const badgeKey = resolveBadgeKeyForField(def.field);
      const fixedKey = matchConfiguredKey(def.field, fixedFields);
      const next: any = {
        ...def,
        sortable,
        filter: filterable,
        hide: !isFieldVisible(def.field),
        minWidth: badgeKey ? Math.max(def.minWidth ?? 0, 110) : def.minWidth,
        cellStyle: {
          ...(def.cellStyle || {}),
          textAlign: valueAlign,
          justifyContent:
            valueAlign === 'center' ? 'center' : valueAlign === 'right' ? 'flex-end' : 'flex-start',
        },
      };
      if (fixedKey) {
        next.pinned = 'left';
        next.lockPinned = true;
      }

      if (badgeKey && badges?.[badgeKey]) {
        const extent = getColumnNumericExtent(parsedData.rowData, def.field);
        delete next.valueFormatter;
        next.cellRenderer = PivotBadgeCellRenderer;
        next.cellRendererParams = {
          badgeConfig: badges[badgeKey],
          extent,
        };
      }

      return next;
    };

    if (parsedData.rowsList.length === 0) {
      return {
        columnDefs: parsedData.columnDefs.map(decorateLeaf),
        colDimBadgeColorByDepth,
      };
    }

    const groupColDefs = parsedData.rowsList.map((rDim, index) => {
      const rowBadgeKey =
        badgeKeys.find((k) => fieldNamesMatch(k, rDim) || k === rDim) ?? null;
      const rowBadgeConfig = rowBadgeKey ? badges?.[rowBadgeKey] : undefined;

      return {
        headerName: formatPivotLabel(rDim),
        colId: `group_${rDim}`,
        showRowGroup: rDim,
        cellRenderer: 'agGroupCellRenderer',
        cellRendererParams: {
          suppressCount: true,
          suppressDoubleClickExpand: index === lastLevelIndex,
          suppressEnterExpand: index === lastLevelIndex,
          ...(rowBadgeConfig
            ? {
                innerRenderer: PivotGroupBadgeInnerRenderer,
                innerRendererParams: { badgeConfig: rowBadgeConfig },
              }
            : {}),
        },
        pinned: 'left',
        lockPinned: true,
        hide: hasVisibleFilter && !visibleFields.includes(rDim) ? true : index > 0,
        cellStyle: { fontWeight: '500' },
        sortable,
        filter: filterable,
      };
    });

    return {
      columnDefs: [...groupColDefs, ...parsedData.columnDefs.map(decorateLeaf)],
      colDimBadgeColorByDepth,
    };
  }, [
    parsedData.columnDefs,
    parsedData.rowsList,
    parsedData.rowData,
    parsedData.colDimHeaderColor,
    lastLevelIndex,
    sortingFiltering?.sortable,
    sortingFiltering?.filterable,
    badges,
    visibleFields,
    fixedFields,
    hasVisibleFilter,
    valueAlign,
    rawResponse,
  ]);

  const finalColumnDefs = pivotColumnLayout.columnDefs;
  const colDimBadgeColorByDepth = pivotColumnLayout.colDimBadgeColorByDepth;

  // Synchronize column visibility with expanded row groups via the Grid API to prevent React re-render crashes
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || parsedData.rowsList.length === 0) return;

    const timer = setTimeout(() => {
      parsedData.rowsList.forEach((rDim, index) => {
        if (index === 0) return;
        const allowedByCustomize = !hasVisibleFilter || visibleFields.includes(rDim);
        const isVisible = allowedByCustomize && expandedLevels.includes(index - 1);
        api.setColumnsVisible([`group_${rDim}`], isVisible);
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [expandedLevels, parsedData.rowsList, hasVisibleFilter, visibleFields]);

  // Drill Through Details on cell click
  const handleCellClicked = async (event: any) => {
    if (!event.data) return;

    const groupFilters = Object.keys(event.data)
      .filter((k) => parsedData.rowsList.includes(k) && event.data[k])
      .map((k) => ({
        column: k,
        value: event.data[k],
      }));

    if (groupFilters.length === 0) return;

    setDrillThroughLoading(true);
    setDrillThroughOpen(true);
    setDrillThroughRows([]);
    setDrillThroughCols([]);

    try {
      const activeNode = useFlowStore.getState().getSelectedNode();
      const nodePayload = activeNode?.data?.node?.payload;

      const payload = {
        flow_id: flowId || nodePayload?.flow_id || '',
        visualization_name: 'pivot',
        stmt_date: nodePayload?.stmt_date || '',
        params: {
          source: selectedSource || nodePayload?.source || '',
          is_drill_through: true,
          drill_through_columns: groupFilters,
          limit: 100,
        },
      };

      const response = await createChart(payload);
      if (response && response.status) {
        setDrillThroughRows(response.data || []);
        setDrillThroughCols(response.columns || []);
      } else {
        toast.error('Failed to load drill-through detail data');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error fetching drill-through rows');
    } finally {
      setDrillThroughLoading(false);
    }
  };

  const handleExportCsv = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `${chartName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_pivot.csv`,
    });
  };

  const handleExportExcel = () => {
    gridRef.current?.api.exportDataAsExcel({
      fileName: `${chartName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_pivot.xlsx`,
    });
  };

  return (
    <div className="flex h-full w-full bg-background min-h-0 text-foreground overflow-hidden">
      {/* Main Data Table Frame */}
      <div className="flex-1 flex flex-col min-h-0 bg-muted/5 relative">
        {/* Top actions/controls bar */}
        <div className="h-10 shrink-0 flex items-center justify-between px-4 !pr-5 gap-3 bg-card/65 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {/* <h4 className="font-semibold text-sm truncate max-w-[200px]">
              {chartName}
            </h4> */}
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search rows..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  gridRef.current?.api.setGridOption('quickFilterText', e.target.value);
                }}
                className="pl-8 !h-7 text-xs py-1 rounded-md"
              />
            </div>

            {/* Export options */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 text-xs !px-2 cursor-pointer"
                  title="Download options"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1 flex flex-col gap-0.5 z-[60]" align="end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCsv}
                  className="h-8 text-xs w-full justify-start cursor-pointer font-medium"
                >
                  <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Export as CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportExcel}
                  className="h-8 text-xs w-full justify-start cursor-pointer font-medium"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Export as Excel
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* AG Grid Pivot View Area */}
        <div className="flex-1 min-h-0 w-full p-0 relative">
          {parsedData.rowData.length === 0 ? (
            <div className="h-full w-full border border-border border-dashed rounded-lg flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Configure row, column and metric fields to view the pivot table.
              </p>
            </div>
          ) : (
            <div className="pivot-table-custom h-full w-full rounded-lg border border-border overflow-hidden bg-background">
              <style>{`
                .pivot-table-custom .ag-header {
                  border-bottom: 2px solid var(--border) !important;
                }
                .pivot-table-custom .ag-header-group-cell {
                  font-weight: 700 !important;
                  border-bottom: 1px solid var(--border) !important;
                  border-right: 1px solid var(--border) !important;
                }
                .pivot-table-custom .ag-header-cell {
                  font-weight: 600 !important;
                  border-right: 1px solid var(--border) !important;
                }
                .pivot-table-custom .ag-cell {
                  border-right: 1px solid var(--border) !important;
                  display: flex;
                  align-items: center;
                }
                .pivot-table-custom .ag-cell-value {
                  width: 100%;
                }
                .pivot-table-custom .ag-row {
                  border-bottom: 1px solid var(--border) !important;
                }
                .pivot-table-custom .dynamic-pivot-header .ag-header-cell-comp-wrapper {
                  display: flex !important;
                  flex-direction: row !important;
                  justify-content: space-between !important;
                  align-items: center !important;
                  width: 100% !important;
                }
                .pivot-table-custom .dynamic-pivot-header .ag-header-cell-label {
                  display: flex !important;
                  align-items: center !important;
                  width: 100% !important;
                  order: 1 !important;
                  flex-grow: 1 !important;
                  justify-content: flex-start !important;
                }
                .pivot-table-custom .dynamic-pivot-header .ag-header-cell-menu-button {
                  order: 2 !important;
                  display: flex !important;
                  align-items: center !important;
                  margin-left: 8px !important;
                  margin-right: 0 !important;
                }
                 .pivot-table-custom .hide-chevron .ag-group-contracted,
                 .pivot-table-custom .hide-chevron .ag-group-expanded {
                   display: none !important;
                 }
                ${Object.entries(colDimBadgeColorByDepth)
                  .map(([depth, color]) => {
                    const bg = hexToRgba(color, 0.12);
                    return `
                .pivot-table-custom .ag-header-group-cell.pivot-col-dim-badge-${depth} .ag-header-group-text,
                .pivot-table-custom .ag-header-group-cell.pivot-col-dim-badge-${depth} .ag-header-group-cell-label > span {
                  display: inline-flex !important;
                  align-items: center;
                  justify-content: center;
                  border-radius: 9999px;
                  padding: 3px 10px;
                  font-size: 12px;
                  font-weight: 600;
                  line-height: 1.25;
                  white-space: nowrap;
                  max-width: 100%;
                  background: ${bg} !important;
                  color: ${color} !important;
                }`;
                  })
                  .join('\n')}
              `}</style>
              <AgGridReact
                ref={gridRef}
                rowData={parsedData.rowData}
                columnDefs={finalColumnDefs}
                theme={pivotTheme}
                rowHeight={compact ? 26 : 32}
                headerHeight={compact ? 28 : 35}
                groupHeaderHeight={compact ? 28 : 35}
                pagination={pagination?.enabled ?? true}
                paginationPageSize={pagination?.pageSize ?? 20}
                paginationPageSizeSelector={pagination?.pageSizeOptions ?? [10, 20, 50, 100]}
                suppressAggFuncInHeader={true}
                animateRows={true}
                rowSelection="multiple"
                groupDisplayType="custom"
                getRowClass={getRowClass}
                onRowGroupOpened={handleRowGroupOpened}
                groupDefaultExpanded={0}
                onCellClicked={handleCellClicked}
                getMainMenuItems={getMainMenuItems}
              />
            </div>
          )}
        </div>
      </div>

      {/* Drill Through Raw Data Dialog */}
      <Dialog open={drillThroughOpen} onOpenChange={setDrillThroughOpen}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col gap-3 overflow-hidden p-4">
          <DialogHeader className="shrink-0 border-b border-border pb-2.5">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <FileSpreadsheet className="h-4 w-4" /> Raw Drill-Through Records
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 w-full relative bg-muted/5 rounded-md p-1 border border-border">
            {drillThroughLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 z-30">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Fetching records...</span>
              </div>
            ) : drillThroughRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                No matching records found.
              </div>
            ) : (
              <div className="pivot-table-custom h-full w-full bg-background rounded overflow-hidden">
                <AgGridReact
                  rowData={drillThroughRows}
                  theme={pivotTheme}
                  rowHeight={32}
                  headerHeight={35}
                  groupHeaderHeight={35}
                  columnDefs={drillThroughCols.map((c) => ({
                    headerName: formatPivotLabel(c),
                    field: c,
                    sortable: true,
                    filter: true,
                    resizable: true,
                  }))}
                  pagination={true}
                  paginationPageSize={25}
                  paginationPageSizeSelector={[25, 50, 100]}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatPivotLabel(value: string | number | null | undefined): string {
  if (value == null) return '';
  const parts = parseCompositePivotKey(value);
  if (parts.length > 1) return parts.join(', ');
  return parts[0] ?? '';
}

function formatNumber(value: any): string {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  if (num === 0) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1000000) {
    const divided = num / 1000000;
    return divided.toLocaleString(undefined, { maximumFractionDigits: divided % 1 === 0 ? 0 : 1 }) + 'M';
  }
  if (absNum >= 1000) {
    const divided = num / 1000;
    return divided.toLocaleString(undefined, { maximumFractionDigits: divided % 1 === 0 ? 0 : 1 }) + 'K';
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function hexToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split('').map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeFieldName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function fieldNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeFieldName(a) === normalizeFieldName(b);
}

/** React cell renderer — required for badges to show in ag-grid-react. */
function PivotBadgeCellRenderer(props: {
  value: unknown;
  badgeConfig?: string | TableBadgeRange | TableBadgeRange[] | null;
  extent?: { min: number; max: number } | null;
  /** When true, treat value as text label (row dims) instead of numeric metric. */
  textMode?: boolean;
}) {
  const val = props.value;
  if (val === null || val === undefined || val === '') return <span>-</span>;

  if (props.textMode) {
    const text = String(val);
    const ranges = Array.isArray(props.badgeConfig)
      ? props.badgeConfig
      : typeof props.badgeConfig === 'string'
        ? [{ color: props.badgeConfig }]
        : props.badgeConfig
          ? [props.badgeConfig]
          : [];
    const color = ranges[0]?.color;
    if (!color) return <span>{text}</span>;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9999,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: 'nowrap',
          background: hexToRgba(color, 0.12),
          color,
        }}
      >
        {text}
      </span>
    );
  }

  const numeric = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(numeric)) return <span>{String(val)}</span>;

  const text = formatNumber(numeric) || String(val);
  const color = resolveTableBadgeColor(
    props.badgeConfig,
    numeric,
    props.extent?.min,
    props.extent?.max,
  );
  if (!color) return <span>{text}</span>;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9999,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
        background: hexToRgba(color, 0.12),
        color,
      }}
    >
      {text}
    </span>
  );
}

/** Inner renderer for row-group cells so Account Name (etc.) can show badges. */
function PivotGroupBadgeInnerRenderer(props: {
  value: unknown;
  badgeConfig?: string | TableBadgeRange | TableBadgeRange[] | null;
}) {
  return (
    <PivotBadgeCellRenderer
      value={props.value}
      badgeConfig={props.badgeConfig}
      textMode
    />
  );
}

function getBadgeDisplayColor(
  badgeConfig?: string | TableBadgeRange | TableBadgeRange[] | null,
): string | null {
  if (!badgeConfig) return null;
  if (typeof badgeConfig === 'string') return badgeConfig || null;
  const ranges = Array.isArray(badgeConfig) ? badgeConfig : [badgeConfig];
  return ranges[0]?.color || null;
}

/** Column-group header badge for date labels (01_DEC_23, …). */
function PivotColDimBadgeHeader(props: {
  displayName?: string;
  badgeColor?: string | null;
}) {
  const text = props.displayName ?? '';
  const color = props.badgeColor;
  if (!text) return null;
  if (!color) return <span>{text}</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9999,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        background: hexToRgba(color, 0.12),
        color,
      }}
    >
      {text}
    </span>
  );
}

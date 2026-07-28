import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  FormApiLogicStep,
  FormBuilderTableColumn,
  FormBuilderTableCustomAction,
  FormBuilderTableRow,
  FormBuilderTableUiConfig,
} from '../../../types';
import {
  buildFormBuilderTableColumns,
  buildFormBuilderTableData,
  buildTablePageSizeSteps,
} from '../../../lib/table/form-builder-table.adapter';
import {
  DEFAULT_TABLE_INITIAL_ROW_COUNT,
  getTableBodyHeightPx,
  getTableHeaderHeightPx,
  normalizeTableInitialRowCount,
  padTableRowsToCount,
  parseTableValue,
} from '../../../lib/table/form-table.utils';
import {
  executeApiLogicStep,
  resolveMappedValue,
} from '../../../lib/logic/form-logic.utils';
import { FormBuilderTable } from './FormBuilderTable.tsx';
import { TableActionScreen } from './TableActionScreen';

export type FormBuilderDataTableVariant = 'default' | 'canvas' | 'runtime';

export interface FormBuilderDataTableProps {
  title?: string;
  columns: FormBuilderTableColumn[];
  rows: FormBuilderTableRow[];
  initialRowCount?: number;
  tableUi?: FormBuilderTableUiConfig;
  apiSteps?: FormApiLogicStep[];
  /** Response path used when refetching table data from an API step. */
  responsePath?: string;
  variant?: FormBuilderDataTableVariant;
  className?: string;
  onRowsChange?: (rows: FormBuilderTableRow[]) => void;
}

const DEFAULT_TABLE_UI: Required<
  Pick<
    FormBuilderTableUiConfig,
    | 'showSearch'
    | 'showRefresh'
    | 'showAddButton'
    | 'addButtonLabel'
    | 'showRowActions'
    | 'showColumnSort'
    | 'showColumnFilter'
    | 'searchUsesApi'
    | 'searchQueryParam'
  >
> = {
  showSearch: true,
  showRefresh: true,
  showAddButton: true,
  addButtonLabel: 'Add',
  showRowActions: true,
  showColumnSort: true,
  showColumnFilter: true,
  searchUsesApi: false,
  searchQueryParam: 'search',
};

function interpolateHref(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = row[key.trim()];
    return value == null ? '' : encodeURIComponent(String(value));
  });
}

function normalizeAction(action: FormBuilderTableCustomAction): FormBuilderTableCustomAction {
  // Migrate older "Edit" toast actions into open-screen actions.
  if (
    action.kind === 'message' &&
    !action.confirmMessage?.trim() &&
    action.label.trim().toLowerCase() === 'edit'
  ) {
    return {
      ...action,
      kind: 'screen',
      screenPresentation: action.screenPresentation ?? 'dialog',
      screenSize: action.screenSize ?? 'xl',
      screenColumns: action.screenColumns ?? 3,
      screenTitle: action.screenTitle ?? 'Edit',
      submitLabel: action.submitLabel ?? 'Update',
    };
  }
  return action;
}

function resolveCustomActions(ui: FormBuilderTableUiConfig): FormBuilderTableCustomAction[] {
  if (ui.customActions?.length) return ui.customActions.map(normalizeAction);
  const actions: FormBuilderTableCustomAction[] = [];
  if (ui.showEditAction !== false) {
    actions.push({
      id: 'act_edit',
      label: 'Edit',
      kind: 'screen',
      screenPresentation: 'dialog',
      screenSize: 'xl',
      screenColumns: 3,
      screenTitle: 'Edit',
      submitLabel: 'Update',
    });
  }
  if (ui.showDeleteAction !== false) {
    actions.push({
      id: 'act_delete',
      label: 'Delete',
      kind: 'api',
      variant: 'destructive',
      confirmMessage: 'Delete this row?',
    });
  }
  return actions;
}

export function FormBuilderDataTable({
  title,
  columns,
  rows,
  initialRowCount = DEFAULT_TABLE_INITIAL_ROW_COUNT,
  tableUi,
  apiSteps = [],
  responsePath = 'data',
  variant = 'default',
  className,
  onRowsChange,
}: FormBuilderDataTableProps) {
  const isCompact = variant === 'canvas';
  const ui = { ...DEFAULT_TABLE_UI, ...tableUi };
  const customActions = resolveCustomActions(ui);
  const defaultPageSize = normalizeTableInitialRowCount(initialRowCount);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState('');
  const [liveRows, setLiveRows] = useState<FormBuilderTableRow[]>(rows);
  const [isFetching, setIsFetching] = useState(false);
  const [screenState, setScreenState] = useState<{
    action: FormBuilderTableCustomAction;
    row: Record<string, unknown>;
  } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageHistoryPushedRef = useRef(false);

  const isPageScreen =
    !!screenState && (screenState.action.screenPresentation ?? 'dialog') === 'page';

  const closeScreen = () => {
    const shouldPopHistory = isPageScreen && pageHistoryPushedRef.current;
    pageHistoryPushedRef.current = false;
    setScreenState(null);
    if (shouldPopHistory) window.history.back();
  };

  useEffect(() => {
    if (!isPageScreen) return;

    if (!pageHistoryPushedRef.current) {
      window.history.pushState({ dfTableActionPage: true }, '');
      pageHistoryPushedRef.current = true;
    }

    const onPopState = () => {
      pageHistoryPushedRef.current = false;
      setScreenState(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isPageScreen]);

  useEffect(() => {
    setLiveRows(rows);
  }, [rows]);

  useEffect(() => {
    setPageSize(defaultPageSize);
    setCurrentPage(0);
  }, [defaultPageSize]);

  useEffect(() => {
    setCurrentPage(0);
  }, [liveRows, search]);

  const searchStep =
    apiSteps.find((step) => step.id === ui.searchStepId) ??
    (apiSteps.length === 1 ? apiSteps[0] : undefined);

  const fetchFromApi = async (query?: string) => {
    if (!searchStep) {
      toast.error('Configure an API step for table search / refresh');
      return;
    }

    setIsFetching(true);
    try {
      const paramKey = (ui.searchQueryParam || 'search').trim() || 'search';
      const stepForFetch: FormApiLogicStep = {
        ...searchStep,
        queryParams: [
          ...(searchStep.queryParams ?? []).filter(
            (param) => param.key.trim().toLowerCase() !== paramKey.toLowerCase(),
          ),
          ...(query?.trim()
            ? [{ key: paramKey, value: query.trim() }]
            : []),
        ],
        payloadFormat:
          searchStep.method === 'GET'
            ? searchStep.payloadFormat === 'none'
              ? 'query_params'
              : searchStep.payloadFormat ?? 'query_params'
            : searchStep.payloadFormat,
      };

      const result = await executeApiLogicStep(stepForFetch);
      if (!result.ok) {
        toast.error(result.error ?? 'Table API request failed');
        return;
      }

      const raw = resolveMappedValue(stepForFetch, result, responsePath);
      const nextRows = parseTableValue(raw ?? result.data, columns);
      setLiveRows(nextRows);
      onRowsChange?.(nextRows);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!ui.searchUsesApi || !ui.showSearch) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void fetchFromApi(search);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search against API
  }, [search, ui.searchUsesApi, ui.showSearch, ui.searchQueryParam, ui.searchStepId]);

  const hasRealRows = liveRows.some((row) =>
    Object.values(row.cells ?? {}).some((cell) => String(cell ?? '').trim().length > 0),
  );

  const sourceRows = useMemo(() => {
    if (hasRealRows) return liveRows;
    return padTableRowsToCount(liveRows, columns, defaultPageSize);
  }, [hasRealRows, liveRows, columns, defaultPageSize]);

  const tableData = useMemo(
    () => buildFormBuilderTableData(sourceRows, columns),
    [sourceRows, columns],
  );

  const searchedData = useMemo(() => {
    if (ui.searchUsesApi) return tableData;
    const query = search.trim().toLowerCase();
    if (!query) return tableData;
    return tableData.filter((row) =>
      columns.some((column) => String(row[column.id] ?? '').toLowerCase().includes(query)),
    );
  }, [tableData, search, columns, ui.searchUsesApi]);

  const tableColumns = useMemo(
    () =>
      buildFormBuilderTableColumns(columns, {
        sortable: ui.showColumnSort,
        filterable: ui.showColumnFilter,
      }),
    [columns, ui.showColumnSort, ui.showColumnFilter],
  );

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return searchedData.slice(start, start + pageSize);
  }, [searchedData, currentPage, pageSize]);

  const scrollViewportMaxHeightPx =
    getTableHeaderHeightPx(isCompact) + getTableBodyHeightPx(pageSize, isCompact);

  const showToolbar =
    !isCompact && (ui.showSearch || ui.showRefresh || ui.showAddButton || !!title);

  const handleRefresh = () => {
    if (ui.searchUsesApi || searchStep) {
      void fetchFromApi(ui.searchUsesApi ? search : undefined);
      return;
    }
    toast.message('Refresh', { description: 'Enable Search via API or Apply logic to reload data.' });
  };

  const handleAdd = () => {
    toast.message(ui.addButtonLabel || 'Add', {
      description: 'Wire Add to your create flow or API action.',
    });
  };

  const handleAction = async (
    action: FormBuilderTableCustomAction,
    row: Record<string, unknown>,
  ) => {
    if (action.kind === 'screen') {
      setScreenState({ action, row });
      return;
    }

    if (action.kind === 'navigate' && action.href?.trim()) {
      const href = interpolateHref(action.href, row);
      if (href.startsWith('http://') || href.startsWith('https://')) {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(href);
      }
      return;
    }

    if (action.kind === 'api' && action.stepId) {
      const step = apiSteps.find((item) => item.id === action.stepId);
      if (!step) {
        toast.error('API step not found for this action');
        return;
      }
      const result = await executeApiLogicStep(step);
      if (result.ok) toast.success(`${action.label} completed`);
      else toast.error(result.error ?? `${action.label} failed`);
      return;
    }

    toast.message(action.label, {
      description: `Row: ${String(row.id ?? row._rowKey ?? '')}`,
    });
  };

  if (isPageScreen && screenState) {
    return (
      <div className={cn('w-full min-w-0', className)}>
        <TableActionScreen
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeScreen();
          }}
          action={screenState.action}
          row={screenState.row}
          columns={columns}
          apiSteps={apiSteps}
        />
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0 space-y-2', className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {title && <p className="truncate text-sm font-semibold text-gray-text">{title}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ui.showSearch && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={ui.searchUsesApi ? 'Search API…' : 'Search…'}
                  className="!h-8 w-[180px] pl-8 !text-xs sm:w-[220px]"
                />
              </div>
            )}
            {ui.showRefresh && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={isFetching}
                onClick={handleRefresh}
                title="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              </Button>
            )}
            {ui.showAddButton && (
              <Button type="button" size="sm" className="!h-8 gap-1.5 text-xs" onClick={handleAdd}>
                <Plus className="h-3.5 w-3.5" />
                {ui.addButtonLabel || 'Add'}
              </Button>
            )}
          </div>
        </div>
      )}

      {isCompact && title && (
        <p className="mb-1 text-[11px] font-medium text-gray-text">{title}</p>
      )}

      <FormBuilderTable
        data={paginatedData}
        columns={tableColumns}
        rowKey="_rowKey"
        compact={isCompact}
        scrollViewportMaxHeightPx={scrollViewportMaxHeightPx}
        bodyCellClassName={isCompact ? 'h-8' : 'h-9'}
        rowActions={
          ui.showRowActions && customActions.length > 0
            ? { actions: customActions, onAction: (action, row) => void handleAction(action, row) }
            : undefined
        }
        pagination={{
          steps: buildTablePageSizeSteps(defaultPageSize),
          currentPage,
          pageSize,
          totalRows: searchedData.length,
          onChange: ({ currentPage: nextPage, limit }) => {
            setCurrentPage(nextPage);
            setPageSize(limit);
          },
        }}
        emptyState={
          <div className="p-8 text-center text-sm text-muted-foreground">
            {isFetching
              ? 'Loading…'
              : search.trim()
                ? 'No rows match your search'
                : 'No rows — map API data on the Logic tab'}
          </div>
        }
      />

      <TableActionScreen
        open={!!screenState}
        onOpenChange={(open) => {
          if (!open) closeScreen();
        }}
        action={screenState?.action ?? null}
        row={screenState?.row ?? null}
        columns={columns}
        apiSteps={apiSteps}
      />
    </div>
  );
}

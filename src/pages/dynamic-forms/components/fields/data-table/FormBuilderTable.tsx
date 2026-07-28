import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Filter,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormBuilderTableCustomAction } from '../../../types';
import type {
  FormBuilderTablePaginationConfig,
  FormBuilderTableProps,
  FormBuilderTableSortDir,
} from '../../../lib/table/form-builder-table.types';
import './form-builder-table.css';

export type {
  FormBuilderTableColumnDef,
  FormBuilderTablePaginationConfig,
  FormBuilderTableProps,
  FormBuilderTableSortDir,
} from '../../../lib/table/form-builder-table.types';

function isPositiveBadge(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['active', 'enabled', 'success', 'true', 'yes', 'on', 'approved'].includes(normalized);
}

function isNegativeBadge(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['inactive', 'disabled', 'error', 'false', 'no', 'off', 'rejected', 'deleted'].includes(
    normalized,
  );
}

function BadgeCell({ value }: { value: string }) {
  const positive = isPositiveBadge(value);
  const negative = isNegativeBadge(value);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        positive && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
        negative && 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
        !positive && !negative && 'bg-muted text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

type SortState = { key: string | null; dir: FormBuilderTableSortDir };

function RowActionsMenu({
  actions,
  row,
  compact,
  onAction,
}: {
  actions: FormBuilderTableCustomAction[];
  row: Record<string, unknown>;
  compact?: boolean;
  onAction: (action: FormBuilderTableCustomAction, row: Record<string, unknown>) => void;
}) {
  const [pendingAction, setPendingAction] = useState<FormBuilderTableCustomAction | null>(null);
  const confirmOpen = !!pendingAction;
  const isDestructive = pendingAction?.variant === 'destructive';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', compact && 'h-6 w-6')}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              className={
                action.variant === 'destructive'
                  ? 'text-destructive focus:text-destructive'
                  : undefined
              }
              onSelect={() => {
                // Wait for the dropdown to close so the confirm dialog can focus correctly.
                if (action.confirmMessage?.trim()) {
                  window.setTimeout(() => setPendingAction(action), 50);
                  return;
                }
                window.setTimeout(() => onAction(action, row), 0);
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label ?? 'Confirm'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                isDestructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                if (action) onAction(action, row);
              }}
            >
              {pendingAction?.label ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortIcon({ state }: { state: FormBuilderTableSortDir }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center">
      {state === 'asc' ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-80" aria-hidden>
          <path d="M10 6l5 6H5l5-6z" transform="rotate(180 10 10)" />
        </svg>
      ) : state === 'desc' ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-80" aria-hidden>
          <path d="M10 6l5 6H5l5-6z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current opacity-40" aria-hidden>
          <path d="M6 7h8l-4-4-4 4zm8 6H6l4 4 4-4z" />
        </svg>
      )}
    </span>
  );
}

function ColumnFilter({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = value.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        title={active ? `Filter: ${value}` : 'Filter column'}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'rounded p-1 transition-colors',
          open || active
            ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Filter className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-background p-2 shadow-md"
        >
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Filter…"
            className={cn('h-8', compact && 'h-7 text-xs')}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

function FormBuilderTablePagination({
  steps = [5, 10, 20, 50],
  currentPage,
  pageSize,
  totalRows,
  onChange,
}: FormBuilderTablePaginationConfig) {
  const safeTotal = Math.max(0, totalRows);
  const safeLimit = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const safePage = Math.min(pageCount - 1, Math.max(0, currentPage));
  const start = safeTotal === 0 ? 0 : safePage * safeLimit + 1;
  const end = Math.min(safeTotal, (safePage + 1) * safeLimit);
  const canPrev = safePage > 0;
  const canNext = safePage < pageCount - 1;

  return (
    <div className="flex flex-col gap-1.5 border-t border-border bg-background px-1 py-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>
          {safeTotal === 0 ? '0' : `${start} - ${end}`} of {safeTotal}
        </span>
        <Select
          value={String(safeLimit)}
          onValueChange={(next) => onChange({ currentPage: 0, limit: Number.parseInt(next, 10) })}
        >
          <SelectTrigger className="!h-7 w-[4.5rem] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {steps.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {step}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">rows per page</span>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canPrev} onClick={() => onChange({ currentPage: 0, limit: safeLimit })}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canPrev} onClick={() => onChange({ currentPage: safePage - 1, limit: safeLimit })}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[4rem] text-center text-[11px] tabular-nums text-muted-foreground">
          {safePage + 1} / {pageCount}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canNext} onClick={() => onChange({ currentPage: safePage + 1, limit: safeLimit })}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canNext} onClick={() => onChange({ currentPage: pageCount - 1, limit: safeLimit })}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FormBuilderTable({
  data = [],
  columns = [],
  rowKey = '_rowKey',
  scrollViewportMaxHeightPx,
  bodyCellClassName = 'h-9',
  compact = false,
  emptyState = (
    <div className="p-8 text-center text-sm text-muted-foreground">No data.</div>
  ),
  pagination,
  rowActions,
}: FormBuilderTableProps) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: null });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const actionItems = rowActions?.actions ?? [];
  const showActions = actionItems.length > 0;
  const colSpan = columns.length + (showActions ? 1 : 0);

  const filtered = useMemo(() => {
    if (!Object.keys(filters).length) return data;
    return data.filter((row) =>
      Object.entries(filters).every(([key, query]) => {
        if (!query.trim()) return true;
        const value = String(row[key] ?? '').toLowerCase();
        return value.includes(query.trim().toLowerCase());
      }),
    );
  }, [data, filters]);

  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = String(a[sort.key!] ?? '').toLowerCase();
      const bv = String(b[sort.key!] ?? '').toLowerCase();
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filtered, sort]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  };

  const headerClass = compact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs';
  const cellClass = compact ? 'px-3 text-[11px]' : 'px-4 text-sm';

  return (
    <div className="form-builder-table w-full min-w-0">
      <div
        className="form-builder-table__scroll isolate"
        style={
          scrollViewportMaxHeightPx && scrollViewportMaxHeightPx > 0
            ? { maxHeight: scrollViewportMaxHeightPx }
            : undefined
        }
      >
        <table>
          <thead>
            <tr className="border-b border-border/60 text-left">
              {columns.map((column) => {
                const isFilterActive = !!(filters[column.key] ?? '').trim();
                const sortable = column.sortable !== false;
                const filterable = column.filterable !== false;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      'select-none bg-muted font-semibold uppercase tracking-wide text-muted-foreground',
                      headerClass,
                      isFilterActive ? 'border-b-2 border-primary' : 'border-b border-border/60',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 bg-muted',
                          sortable ? 'cursor-pointer' : 'cursor-default',
                        )}
                        onClick={sortable ? () => toggleSort(column.key) : undefined}
                      >
                        <span>{column.header}</span>
                        {sortable && (
                          <SortIcon state={sort.key === column.key ? sort.dir : null} />
                        )}
                      </button>
                      {filterable && (
                        <ColumnFilter
                          compact={compact}
                          value={filters[column.key] ?? ''}
                          onChange={(value) =>
                            setFilters((prev) => ({ ...prev, [column.key]: value }))
                          }
                        />
                      )}
                    </div>
                  </th>
                );
              })}
              {showActions && (
                <th
                  className={cn(
                    'select-none border-b border-border/60 bg-muted font-semibold uppercase tracking-wide text-muted-foreground',
                    headerClass,
                    'w-12 text-right',
                  )}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={Math.max(colSpan, 1)}>{emptyState}</td>
              </tr>
            ) : (
              sorted.map((row, index) => (
                <tr key={String(row[rowKey] ?? index)} className="transition-colors">
                  {columns.map((column) => {
                    const raw = row[column.key];
                    const display = raw == null || raw === '' || raw === '—' ? '—' : String(raw);
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'align-middle font-medium text-foreground',
                          bodyCellClassName,
                          cellClass,
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                        )}
                      >
                        {column.display === 'badge' && display !== '—' ? (
                          <BadgeCell value={display} />
                        ) : (
                          <span className="whitespace-nowrap">{display}</span>
                        )}
                      </td>
                    );
                  })}
                  {showActions && (
                    <td
                      className={cn(
                        'align-middle text-right',
                        bodyCellClassName,
                        cellClass,
                      )}
                    >
                      <RowActionsMenu
                        actions={actionItems}
                        row={row}
                        compact={compact}
                        onAction={(action, actionRow) => rowActions?.onAction(action, actionRow)}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination ? <FormBuilderTablePagination {...pagination} /> : null}
    </div>
  );
}

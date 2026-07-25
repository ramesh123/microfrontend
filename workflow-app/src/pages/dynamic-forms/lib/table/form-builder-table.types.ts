import type { ReactNode } from 'react';
import type { FormBuilderTableCustomAction } from '../../types';

export type FormBuilderTableCellDisplay = 'text' | 'badge';

export interface FormBuilderTableColumnDef {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  display?: FormBuilderTableCellDisplay;
}

export interface FormBuilderTablePaginationConfig {
  steps?: number[];
  currentPage: number;
  pageSize: number;
  totalRows: number;
  onChange: (params: { currentPage: number; limit: number }) => void;
}

export type FormBuilderTableSortDir = 'asc' | 'desc' | null;

export interface FormBuilderTableRowActionsConfig {
  actions: FormBuilderTableCustomAction[];
  onAction: (action: FormBuilderTableCustomAction, row: Record<string, unknown>) => void;
}

export interface FormBuilderTableProps {
  data?: Record<string, unknown>[];
  columns?: FormBuilderTableColumnDef[];
  rowKey?: string;
  scrollViewportMaxHeightPx?: number;
  bodyCellClassName?: string;
  compact?: boolean;
  emptyState?: ReactNode;
  pagination?: FormBuilderTablePaginationConfig;
  rowActions?: FormBuilderTableRowActionsConfig;
}

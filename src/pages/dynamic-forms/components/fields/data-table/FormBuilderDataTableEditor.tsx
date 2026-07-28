import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  FormApiLogicStep,
  FormBuilderTableColumn,
  FormBuilderTableColumnDisplay,
  FormBuilderTableCustomAction,
  FormBuilderTableCustomActionKind,
  FormBuilderTableScreenPresentation,
  FormBuilderTableScreenSize,
  FormBuilderTableUiConfig,
} from '../../../types';
import {
  DEFAULT_TABLE_INITIAL_ROW_COUNT,
  normalizeTableInitialRowCount,
} from '../../../lib/table/form-table.utils';
import { TableActionScreenBuilder } from './TableActionScreenBuilder';
import { TABLE_SCREEN_SIZE_OPTIONS } from './table-action-screen.utils';

interface FormBuilderDataTableEditorProps {
  columns: FormBuilderTableColumn[];
  initialRowCount?: number;
  tableUi?: FormBuilderTableUiConfig;
  apiSteps?: FormApiLogicStep[];
  onChange: (updates: {
    tableColumns: FormBuilderTableColumn[];
    tableInitialRowCount: number;
    tableUi?: FormBuilderTableUiConfig;
  }) => void;
}

type EditorTab = 'features' | 'search' | 'actions' | 'columns';

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: 'features', label: 'Features' },
  { id: 'search', label: 'Search' },
  { id: 'actions', label: 'Actions' },
  { id: 'columns', label: 'Columns' },
];

function FeatureChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-gray-border bg-background text-gray-text-muted hover:border-gray-border hover:text-gray-text',
      )}
    >
      {label}
    </button>
  );
}

function defaultCustomActions(): FormBuilderTableCustomAction[] {
  return [
    {
      id: 'act_edit',
      label: 'Edit',
      kind: 'screen',
      variant: 'default',
      screenPresentation: 'dialog',
      screenSize: 'xl',
      screenColumns: 3,
      screenTitle: 'Edit',
      submitLabel: 'Update',
    },
    {
      id: 'act_delete',
      label: 'Delete',
      kind: 'api',
      variant: 'destructive',
      confirmMessage: 'Delete this row?',
    },
  ];
}

export function FormBuilderDataTableEditor({
  columns,
  initialRowCount = DEFAULT_TABLE_INITIAL_ROW_COUNT,
  tableUi = {},
  apiSteps = [],
  onChange,
}: FormBuilderDataTableEditorProps) {
  const [tab, setTab] = useState<EditorTab>('features');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [screenBuilderActionId, setScreenBuilderActionId] = useState<string | null>(null);

  const normalizedRowCount = normalizeTableInitialRowCount(initialRowCount);
  const customActions = tableUi.customActions?.length
    ? tableUi.customActions
    : defaultCustomActions();

  const ui: FormBuilderTableUiConfig = {
    showSearch: tableUi.showSearch ?? true,
    showRefresh: tableUi.showRefresh ?? true,
    showAddButton: tableUi.showAddButton ?? true,
    addButtonLabel: tableUi.addButtonLabel ?? 'Add',
    showRowActions: tableUi.showRowActions ?? true,
    showColumnSort: tableUi.showColumnSort ?? true,
    showColumnFilter: tableUi.showColumnFilter ?? true,
    searchUsesApi: tableUi.searchUsesApi ?? false,
    searchQueryParam: tableUi.searchQueryParam ?? 'search',
    searchStepId: tableUi.searchStepId ?? apiSteps[0]?.id,
    customActions,
  };

  const emit = (
    nextColumns: FormBuilderTableColumn[],
    nextRowCount: number,
    nextUi: FormBuilderTableUiConfig = ui,
  ) => {
    onChange({
      tableColumns: nextColumns,
      tableInitialRowCount: normalizeTableInitialRowCount(nextRowCount),
      tableUi: nextUi,
    });
  };

  const updateUi = (updates: Partial<FormBuilderTableUiConfig>) => {
    emit(columns, normalizedRowCount, { ...ui, ...updates });
  };

  const updateRowCount = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    emit(columns, parsed, ui);
  };

  const updateColumnDisplay = (columnId: string, display: FormBuilderTableColumnDisplay) => {
    emit(
      columns.map((column) => (column.id === columnId ? { ...column, display } : column)),
      normalizedRowCount,
      ui,
    );
  };

  const updateAction = (actionId: string, updates: Partial<FormBuilderTableCustomAction>) => {
    updateUi({
      customActions: customActions.map((action) =>
        action.id === actionId ? { ...action, ...updates } : action,
      ),
    });
  };

  const addAction = () => {
    const id = `act_${crypto.randomUUID().slice(0, 8)}`;
    updateUi({
      customActions: [
        ...customActions,
        {
          id,
          label: 'New action',
          kind: 'screen',
          variant: 'default',
          screenPresentation: 'dialog',
          screenSize: 'md',
          screenTitle: 'New screen',
        },
      ],
    });
    setExpandedActionId(id);
    setTab('actions');
  };

  const removeAction = (actionId: string) => {
    updateUi({
      customActions: customActions.filter((action) => action.id !== actionId),
    });
    if (expandedActionId === actionId) setExpandedActionId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-0.5 rounded-md border border-gray-border bg-gray-panel-muted/40 p-0.5">
        {EDITOR_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors',
              tab === item.id
                ? 'bg-background text-gray-text shadow-sm'
                : 'text-gray-text-muted hover:text-gray-text',
            )}
          >
            {item.label}
            {item.id === 'actions' && customActions.length > 0 && (
              <span className="ml-0.5 text-[9px] text-gray-text-muted">({customActions.length})</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'features' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-gray-text-muted">Toolbar & columns</Label>
            <div className="flex flex-wrap gap-1.5">
              <FeatureChip
                label="Search"
                active={!!ui.showSearch}
                onClick={() => updateUi({ showSearch: !ui.showSearch })}
              />
              <FeatureChip
                label="Refresh"
                active={!!ui.showRefresh}
                onClick={() => updateUi({ showRefresh: !ui.showRefresh })}
              />
              <FeatureChip
                label="Add button"
                active={!!ui.showAddButton}
                onClick={() => updateUi({ showAddButton: !ui.showAddButton })}
              />
              <FeatureChip
                label="Sort"
                active={!!ui.showColumnSort}
                onClick={() => updateUi({ showColumnSort: !ui.showColumnSort })}
              />
              <FeatureChip
                label="Filter"
                active={!!ui.showColumnFilter}
                onClick={() => updateUi({ showColumnFilter: !ui.showColumnFilter })}
              />
              <FeatureChip
                label="Row actions"
                active={!!ui.showRowActions}
                onClick={() => updateUi({ showRowActions: !ui.showRowActions })}
              />
            </div>
            <p className="text-[10px] text-gray-text-muted">Tap a chip to show or hide it.</p>
          </div>

          {ui.showAddButton && (
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-text-muted">Add button label</Label>
              <Input
                value={ui.addButtonLabel ?? 'Add'}
                onChange={(event) => updateUi({ addButtonLabel: event.target.value })}
                className="h-7 !text-xs"
                placeholder="Add User"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="table-initial-rows" className="text-[10px] text-gray-text-muted">
              Rows per page
            </Label>
            <Input
              id="table-initial-rows"
              type="number"
              min={1}
              max={50}
              value={normalizedRowCount}
              onChange={(e) => updateRowCount(e.target.value)}
              className="h-7 !text-xs"
            />
          </div>
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          {!ui.showSearch ? (
            <div className="rounded-md border border-dashed border-gray-border px-3 py-3 text-center">
              <p className="text-[11px] text-gray-text-muted">Search is off.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-[10px]"
                onClick={() => {
                  updateUi({ showSearch: true });
                }}
              >
                Enable search
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 rounded-md border border-gray-border px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-text">Search via API</p>
                  <p className="text-[10px] text-gray-text-muted">
                    Call your Logic API step instead of filtering locally
                  </p>
                </div>
                <FeatureChip
                  label={ui.searchUsesApi ? 'On' : 'Off'}
                  active={!!ui.searchUsesApi}
                  onClick={() => updateUi({ searchUsesApi: !ui.searchUsesApi })}
                />
              </div>

              {ui.searchUsesApi && (
                <div className="space-y-2 rounded-md border border-gray-border p-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-text-muted">API step</Label>
                    <Select
                      value={ui.searchStepId ?? apiSteps[0]?.id ?? ''}
                      onValueChange={(searchStepId) => updateUi({ searchStepId })}
                    >
                      <SelectTrigger className="!h-7 !text-[10px]">
                        <SelectValue placeholder="Select step" />
                      </SelectTrigger>
                      <SelectContent>
                        {apiSteps.map((step) => (
                          <SelectItem key={step.id} value={step.id}>
                            {step.name} ({step.method})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-text-muted">Query param</Label>
                    <Input
                      value={ui.searchQueryParam ?? 'search'}
                      onChange={(event) => updateUi({ searchQueryParam: event.target.value })}
                      className="h-7 !text-xs font-mono"
                      placeholder="search"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'actions' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-text-muted">
              {ui.showRowActions
                ? 'Click a row to edit details'
                : 'Row actions menu is hidden — enable it under Features'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={addAction}
              disabled={!ui.showRowActions}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {ui.showRowActions && (
            <div className="space-y-1.5">
              {customActions.map((action) => {
                const open = expandedActionId === action.id;
                return (
                  <div
                    key={action.id}
                    className="overflow-hidden rounded-md border border-gray-border"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-surface/50"
                      onClick={() => setExpandedActionId(open ? null : action.id)}
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-gray-text-muted transition-transform',
                          !open && '-rotate-90',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-text">
                        {action.label || 'Untitled'}
                      </span>
                      <span className="shrink-0 text-[9px] uppercase tracking-wide text-gray-text-muted">
                        {action.kind === 'screen'
                          ? (action.screenPresentation ?? 'dialog') === 'page'
                            ? 'page · back'
                            : `${action.screenPresentation ?? 'dialog'} · ${action.screenSize ?? 'md'}`
                          : action.kind}
                        {action.variant === 'destructive' ? ' · danger' : ''}
                      </span>
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-gray-border bg-background p-2.5">
                        <div className="flex items-end gap-1.5">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">Name</Label>
                            <Input
                              value={action.label}
                              onChange={(event) =>
                                updateAction(action.id, { label: event.target.value })
                              }
                              className="h-8 !text-xs"
                              placeholder="Edit"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive"
                            onClick={() => removeAction(action.id)}
                            title="Remove action"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">Type</Label>
                            <Select
                              value={action.kind}
                              onValueChange={(value) => {
                                const kind = value as FormBuilderTableCustomActionKind;
                                updateAction(action.id, {
                                  kind,
                                  ...(kind === 'screen'
                                    ? {
                                        screenPresentation:
                                          action.screenPresentation ?? 'dialog',
                                        screenSize: action.screenSize ?? 'xl',
                                        screenTitle:
                                          action.screenTitle ?? action.label ?? 'Edit',
                                      }
                                    : {}),
                                });
                              }}
                            >
                              <SelectTrigger className="!h-8 !text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="screen">Open screen</SelectItem>
                                <SelectItem value="api">API step</SelectItem>
                                <SelectItem value="navigate">Navigate</SelectItem>
                                <SelectItem value="message">Message</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">Style</Label>
                            <Select
                              value={action.variant ?? 'default'}
                              onValueChange={(value) =>
                                updateAction(action.id, {
                                  variant: value as FormBuilderTableCustomAction['variant'],
                                })
                              }
                            >
                              <SelectTrigger className="!h-8 !text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="destructive">Destructive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {action.kind === 'screen' && (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-gray-text-muted">Open as</Label>
                                <Select
                                  value={action.screenPresentation ?? 'dialog'}
                                  onValueChange={(value) =>
                                    updateAction(action.id, {
                                      screenPresentation:
                                        value as FormBuilderTableScreenPresentation,
                                    })
                                  }
                                >
                                  <SelectTrigger className="!h-8 !text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="dialog">Dialog</SelectItem>
                                    <SelectItem value="sheet">Sheet</SelectItem>
                                    <SelectItem value="page">New page</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-gray-text-muted">Size</Label>
                                {(action.screenPresentation ?? 'dialog') === 'page' ? (
                                  <div className="flex h-8 items-center rounded-md border border-dashed border-gray-border px-2 text-[10px] text-gray-text-muted">
                                    Full page
                                  </div>
                                ) : (
                                  <Select
                                    value={action.screenSize ?? 'xl'}
                                    onValueChange={(value) =>
                                      updateAction(action.id, {
                                        screenSize: value as FormBuilderTableScreenSize,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="!h-8 !text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TABLE_SCREEN_SIZE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              className="h-8 w-full text-[11px]"
                              variant={
                                action.screenDefinition || action.screenFields?.length
                                  ? 'outline'
                                  : 'default'
                              }
                              onClick={() => setScreenBuilderActionId(action.id)}
                            >
                              {action.screenDefinition || action.screenFields?.length
                                ? `Edit form · ${action.screenDefinition?.fields.length ?? action.screenFields?.length ?? 0} fields`
                                : 'Create form'}
                            </Button>
                            <p className="text-center text-[10px] leading-snug text-gray-text-muted">
                              Design + Logic + APIs in the form builder sheet
                            </p>
                          </div>
                        )}

                        {action.kind === 'navigate' && (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">Path / URL</Label>
                            <Input
                              value={action.href ?? ''}
                              onChange={(event) =>
                                updateAction(action.id, { href: event.target.value })
                              }
                              className="h-8 !text-xs font-mono"
                              placeholder="/path or https://… ({column_id})"
                            />
                          </div>
                        )}

                        {action.kind === 'api' && (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">API step</Label>
                            <Select
                              value={action.stepId ?? ''}
                              onValueChange={(stepId) => updateAction(action.id, { stepId })}
                            >
                              <SelectTrigger className="!h-8 !text-[11px]">
                                <SelectValue placeholder="Select step" />
                              </SelectTrigger>
                              <SelectContent>
                                {apiSteps.map((step) => (
                                  <SelectItem key={step.id} value={step.id}>
                                    {step.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {(action.kind === 'api' ||
                          action.variant === 'destructive' ||
                          !!action.confirmMessage) && (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-text-muted">
                              Confirm before run
                            </Label>
                            <Input
                              value={action.confirmMessage ?? ''}
                              onChange={(event) =>
                                updateAction(action.id, { confirmMessage: event.target.value })
                              }
                              className="h-8 !text-xs"
                              placeholder="Optional — e.g. Delete this row?"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {customActions.length === 0 && (
                <p className="rounded-md border border-dashed border-gray-border px-3 py-3 text-center text-[11px] text-gray-text-muted">
                  No actions yet — add the ones you need.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'columns' && (
        <div className="space-y-2">
          <p className="text-[10px] leading-snug text-gray-text-muted">
            Headers & JSON keys are on the <strong>Logic</strong> tab. Here you only set display style.
          </p>
          {columns.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-border px-3 py-3 text-center text-[11px] text-gray-text-muted">
              Map columns on the Logic tab first.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-gray-border">
              {columns.map((column, index) => (
                <div
                  key={column.id}
                  className={cn(
                    'grid grid-cols-[1fr_88px] items-center gap-2 px-2.5 py-1.5',
                    index > 0 && 'border-t border-gray-border/70',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-gray-text">
                      {column.label || column.id}
                    </p>
                    {column.responseKey?.trim() && (
                      <p className="truncate font-mono text-[9px] text-gray-text-muted">
                        {column.responseKey}
                      </p>
                    )}
                  </div>
                  <Select
                    value={column.display ?? 'text'}
                    onValueChange={(value) =>
                      updateColumnDisplay(column.id, value as FormBuilderTableColumnDisplay)
                    }
                  >
                    <SelectTrigger className="!h-7 !text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="badge">Badge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TableActionScreenBuilder
        open={!!screenBuilderActionId}
        onOpenChange={(open) => {
          if (!open) setScreenBuilderActionId(null);
        }}
        action={customActions.find((item) => item.id === screenBuilderActionId) ?? null}
        columns={columns}
        onSave={(config) => {
          if (!screenBuilderActionId) return;
          updateAction(screenBuilderActionId, {
            screenDefinition: config.screenDefinition,
            screenTitle: config.screenTitle ?? config.screenDefinition.title,
            submitLabel: config.submitLabel,
            screenFields: undefined,
          });
        }}
      />
    </div>
  );
}

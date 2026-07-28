import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Loader2,
  Search,
  Database,
  Globe,
  AlertCircle,
  RefreshCw,
  Trash,
  LayoutGrid,
  List,
  LayoutDashboard,
  ArrowUpDown,
  Pencil,
  AlignHorizontalJustifyCenter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  fetchWorkspaceTenants,
  createTenant,
  fetchDomains,
  deleteTenant,
  updateTenant,
  type ContextDomainItem,
  type TenantListItem,
} from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import { type DomainOption } from '@/stores/semanticsStore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import TableWithPagination from '@/common/tableWithPagination';
import type { ColumnDef } from '@tanstack/react-table';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface TenantLandingProps {
  onSelectTenant: (tenantId: string, displayName: string, domainId: string) => void;
  onCreateNew: () => void;
}

export default function TenantLanding({ onSelectTenant, onCreateNew }: TenantLandingProps) {
  const DEFAULT_LIST_PAGE_SIZE = 10;
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortKey, setSortKey] = useState<'display_name' | 'tenant_id' | 'domain_id' | 'status'>('display_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [listPagination, setListPagination] = useState<{ currentPage: number; pageSize: number }>({
    currentPage: 0,
    pageSize: DEFAULT_LIST_PAGE_SIZE,
  });

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDomainId, setNewDomainId] = useState('');

  // Domains
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);

  // Delete state
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inline display name edit
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editDisplayNameDraft, setEditDisplayNameDraft] = useState('');
  const [savingDisplayNameTenantId, setSavingDisplayNameTenantId] = useState<string | null>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await fetchWorkspaceTenants();
      setTenants(list ?? []);
    } catch (error) {
      setError(true);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setSearch("");
    setSortKey('display_name');
    setSortDir('asc');
    setListPagination({ currentPage: 0, pageSize: DEFAULT_LIST_PAGE_SIZE });
    void loadTenants();
  }, [loadTenants, DEFAULT_LIST_PAGE_SIZE]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    loadTenants();
  }, [loadTenants]);

  // Load domains when sheet opens
  useEffect(() => {
    if (sheetOpen && domains.length === 0) {
      setDomainsLoading(true);
      fetchDomains()
        .then((res) => {
          const list: DomainOption[] = (res?.domains ?? []).map((d: ContextDomainItem) => ({
            domain_id: d.domain_id,
            display_name: d.display_name ?? d.domain_id,
          }));
          setDomains(list);
        })
        .catch((loadError) => {
          toast.error(getDisplayErrorMessage(loadError, 'Failed to load domains'));
        })
        .finally(() => {
          setDomainsLoading(false);
        });
    }
  }, [sheetOpen, domains.length]);

  const filtered = tenants.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.tenant_id.toLowerCase().includes(q) ||
      t.display_name.toLowerCase().includes(q) ||
      (t.domain_id ?? '').toLowerCase().includes(q)
    );
  });

  const sortedTenants = [...filtered].sort((a, b) => {
    const aVal = sortKey === 'display_name' ? (a.display_name ?? '').toLowerCase()
      : sortKey === 'tenant_id' ? (a.tenant_id ?? '').toLowerCase()
      : sortKey === 'domain_id' ? (a.domain_id ?? '').toLowerCase()
      : (a.status ?? '').toLowerCase();
    const bVal = sortKey === 'display_name' ? (b.display_name ?? '').toLowerCase()
      : sortKey === 'tenant_id' ? (b.tenant_id ?? '').toLowerCase()
      : sortKey === 'domain_id' ? (b.domain_id ?? '').toLowerCase()
      : (b.status ?? '').toLowerCase();
    const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = useCallback((key: typeof sortKey, dir?: 'asc' | 'desc') => {
    setListPagination((p) => ({ ...p, currentPage: 0 }));
    if (dir) {
      setSortKey(key);
      setSortDir(dir);
      return;
    }
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // list view pagination + columns are defined after edit handlers (see below)

  const handleCreateTenant = async () => {
    if (!newDisplayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (!newDomainId.trim()) {
      toast.error('Domain is required');
      return;
    }
    const tenantIdToUse = crypto.randomUUID();
    setCreating(true);
    try {
      const res = await createTenant({
        tenant_id: tenantIdToUse,
        display_name: newDisplayName.trim(),
        domain_id: newDomainId,
        status: 'active',
      });
      toast.success(`Tenant "${res.display_name}" created`);
      setSheetOpen(false);
      setNewDisplayName('');
      setNewDomainId('');
      // Refresh list and auto-select the new tenant
      await loadTenants();
      onCreateNew();
      // Load the new tenant into the wizard
      onSelectTenant(res.tenant_id, res.display_name, res.domain_id || '');
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to create tenant'));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenInsights = useCallback(
    (e: React.MouseEvent, tenant: TenantListItem) => {
      e.preventDefault();
      e.stopPropagation();
      navigate('/exploratory-analysis/insights', {
        state: { tenantId: tenant.tenant_id, tenantName: tenant.display_name ?? tenant.tenant_id },
      });
    },
    [navigate],
  );

  const handleSelectTenant = (tenant: TenantListItem) => {
    onSelectTenant(tenant.tenant_id, tenant.display_name, tenant.domain_id || '');
  };

  const handleConfirmDelete = async (tenantId: string) => {
    setDeleting(true);
    try {
      await deleteTenant(tenantId);
      toast.success('Tenant deleted');
      await loadTenants();
    } catch (err: unknown) {
      toast.error(getDisplayErrorMessage(err, 'Failed to delete tenant'));
    } finally {
      setDeleting(false);
      setDeletingTenantId(null);
    }
  };

  useEffect(() => {
    if (editingTenantId) {
      queueMicrotask(() => {
        editNameInputRef.current?.focus();
        editNameInputRef.current?.select();
      });
    }
  }, [editingTenantId]);

  const beginEditDisplayName = useCallback(
    (e: React.SyntheticEvent, tenant: TenantListItem) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingTenantId(tenant.tenant_id);
      setEditDisplayNameDraft(tenant.display_name || tenant.tenant_id);
    },
    [],
  );

  const cancelEditDisplayName = useCallback(() => {
    setEditingTenantId(null);
    setEditDisplayNameDraft('');
  }, []);

  const saveEditDisplayName = useCallback(async (tenantId: string) => {
    const trimmed = editDisplayNameDraft.trim();
    if (!trimmed) {
      toast.error('Display name is required');
      return;
    }
    const current = tenants.find((t) => t.tenant_id === tenantId);
    if (current && trimmed === (current.display_name || current.tenant_id)) {
      cancelEditDisplayName();
      return;
    }
    setSavingDisplayNameTenantId(tenantId);
    try {
      const res = await updateTenant(tenantId, {
        tenant_id: tenantId,
        display_name: trimmed,
      });
      setTenants((prev) =>
        prev.map((t) =>
          t.tenant_id === tenantId ? { ...t, display_name: res.display_name ?? trimmed } : t
        )
      );
      toast.success('Display name updated');
      cancelEditDisplayName();
    } catch (err: unknown) {
      toast.error(getDisplayErrorMessage(err, 'Failed to update tenant'));
    } finally {
      setSavingDisplayNameTenantId(null);
    }
  }, [editDisplayNameDraft, tenants, cancelEditDisplayName]);

  const listPageData = useMemo(() => {
    const start = listPagination.currentPage * listPagination.pageSize;
    return sortedTenants.slice(start, start + listPagination.pageSize);
  }, [sortedTenants, listPagination.currentPage, listPagination.pageSize]);

  const listColumns = useMemo<ColumnDef<TenantListItem>[]>(() => {
    return [
      {
        accessorKey: 'display_name',
        size: 260,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            Tenant name
            <ArrowUpDown className="size-3.5 opacity-50" />
          </button>
        ),
        cell: ({ row }) => {
          const tenant = row.original;
          const isEditingRow = editingTenantId === tenant.tenant_id;
          return (
            <div
              className="flex items-center gap-1.5 min-w-0 group/rowname"
              onClick={(e) => {
                if (isEditingRow) e.stopPropagation();
              }}
            >
              {isEditingRow ? (
                <Input
                  ref={editNameInputRef}
                  className="h-8 text-sm font-medium px-2 max-w-[min(100%,280px)]"
                  value={editDisplayNameDraft}
                  onChange={(e) => setEditDisplayNameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveEditDisplayName(tenant.tenant_id);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEditDisplayName();
                    }
                  }}
                  disabled={savingDisplayNameTenantId === tenant.tenant_id}
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium text-primary hover:underline"
                  title={tenant.display_name || tenant.tenant_id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectTenant(tenant);
                  }}
                >
                  {tenant.display_name || tenant.tenant_id}
                </button>
              )}
              {!isEditingRow && (
                <span
                  role="button"
                  tabIndex={0}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover/rowname:opacity-100"
                  onClick={(e) => beginEditDisplayName(e, tenant)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      beginEditDisplayName(e, tenant);
                    }
                  }}
                  aria-label={`Rename ${tenant.display_name || tenant.tenant_id}`}
                >
                  <Pencil className="size-3.5" />
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'tenant_id',
        size: 240,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            Tenant ID
            <ArrowUpDown className="size-3.5 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <span className=" text-xs">
            {row.original.tenant_id}
          </span>
        ),
      },
      {
        accessorKey: 'domain_id',
        size: 280,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            Domain
            <ArrowUpDown className="size-3.5 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.domain_id ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        size: 140,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            Status
            <ArrowUpDown className="size-3.5 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-medium',
              row.original.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
            )}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        size: 200,
        header: () => <div className="w-full text-right pr-10">Actions</div>,
        cell: ({ row }) => {
          const tenant = row.original;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => handleOpenInsights(e, tenant)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0 text-[9px] font-medium !h-7.5',
                  'bg-sky-100 text-sky-800 border border-sky-200',
                  'dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700',
                  'hover:bg-sky-200 dark:hover:bg-sky-800/60 transition-colors'
                )}
                title="Open dashboards"
              >
                <LayoutDashboard className="size-2" />
                Dashboard
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeletingTenantId(tenant.tenant_id)}
                title="Delete"
              >
                <Trash className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ];
  }, [
    editingTenantId,
    editDisplayNameDraft,
    savingDisplayNameTenantId,
    beginEditDisplayName,
    cancelEditDisplayName,
    handleOpenInsights,
    saveEditDisplayName,
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Header: sticky, title + search, refresh, view toggle, new tenant */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-1 py-1 border-b bg-background shrink-0">
        <div className="min-w-0">
          <div className='flex items-center gap-2'>
            <AlignHorizontalJustifyCenter className="h-4 w-4 text-primary"/>
            <h1 className="text-[16px] font-semibold tracking-tight">Semantic Tenants</h1>
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Select a tenant to view its configuration or create a new one
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pr-1">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 pl-6 pr-2 text-sm"
              placeholder="Search Semantic Tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
          </div>

         
          <div className="flex rounded-md border border-input overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-7.5 min-w-8 px-2 flex items-center justify-center gap-1 transition-colors text-xs font-bold',
                viewMode === 'grid'
                  ? 'bg-primary text-white border-primary/20'
                  : 'hover:bg-muted/50 text-muted-foreground'
              )}
              title="Grid view"
            >
              <LayoutGrid className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'h-7.5 min-w-8 px-2 flex items-center justify-center gap-1 transition-colors text-xs font-bold',
                viewMode === 'list'
                  ? 'bg-primary text-white border-primary/20'
                  : 'hover:bg-muted/50 text-muted-foreground'
              )}
              title="List view"
            >
              <List className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
          <Button
            variant="primary"
            size="icon"
            className="!h-7.5 w-8 p-0 shrink-0"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh tenants"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
          <Button
            size="sm"
            className="!h-7.5 !p-2 text-sm !gap-2 shrink-0"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="size-3.5" />
            New Tenant
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-1 bg-muted/20">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading tenants...</span>
          </div>
        )}

        {/* Error or empty */}
        {!loading && (error || tenants.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
              {error ? (
                <AlertCircle className="size-4 text-muted-foreground" />
              ) : (
                <Database className="size-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {error ? 'Unable to load tenants' : 'No tenants available'}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {error
                ? 'Check your connection and try again'
                : 'Create your first tenant to get started'}
            </p>
            <div className="flex gap-1.5 mt-2">
              {error && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={loadTenants}
                >
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="size-3" />
                Create Tenant
              </Button>
            </div>
          </div>
        )}

        {/* List view: table with sortable headers */}
        {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
          <Card className="gap-0 border-border/70 p-0 shadow-sm">
            <CardContent className="p-0">
              <div className="semantic-tenants-table [&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-wider [&_td]:py-1.5 [&_th:first-child]:px-3 [&_td:first-child]:px-3">
                <TableWithPagination
                  key={`${listPagination.pageSize}|${listPagination.currentPage}|${sortKey}|${sortDir}|${search}`}
                  data={listPageData}
                  columns={listColumns}
                  totalRows={sortedTenants.length}
                  loading={false}
                  pagination={{
                    steps: [10, 20, 50, 100],
                    currentPage: listPagination.currentPage,
                    pageSize: listPagination.pageSize,
                  }}
                  paginationSummary="range"
                  onChangePagination={({ currentPage, limit, sortedColumns }) => {
                    setListPagination({ currentPage, pageSize: limit });
                    const entry = sortedColumns ? Object.entries(sortedColumns)[0] : undefined;
                    if (!entry) return;
                    const [key, dir] = entry;
                    if (
                      key === 'display_name' ||
                      key === 'tenant_id' ||
                      key === 'domain_id' ||
                      key === 'status'
                    ) {
                      handleSort(key, dir);
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid view: cards — tenant name and delete on same line, no avatar */}
        {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map((tenant) => (
              <article
                key={tenant.tenant_id}
                className={cn(
                  'group relative flex flex-col rounded-xl bg-card text-left overflow-hidden',
                  'border border-border/60',
                  'shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)]',
                  'transition-all duration-200 ease-out',
                  'hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.06)] hover:border-border',
                  'focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 focus-within:border-primary/30'
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (editingTenantId === tenant.tenant_id) return;
                    handleSelectTenant(tenant);
                  }}
                  className="flex w-full flex-col flex-1 min-h-0 text-left p-0"
                >
                  <div className="p-2 pt-1 pl-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {editingTenantId === tenant.tenant_id ? (
                          <Input
                            ref={editNameInputRef}
                            className="h-8 text-sm font-semibold px-2 flex-1 min-w-0"
                            value={editDisplayNameDraft}
                            onChange={(e) => setEditDisplayNameDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveEditDisplayName(tenant.tenant_id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEditDisplayName();
                              }
                            }}
                            disabled={savingDisplayNameTenantId === tenant.tenant_id}
                          />
                        ) : (
                          <h3
                            className="!text-[14px] font-semibold leading-tight text-foreground line-clamp-2 flex-1 min-w-0 text-left"
                            title={tenant.display_name || tenant.tenant_id}
                          >
                            {tenant.display_name || tenant.tenant_id}
                          </h3>
                        )}
                        {editingTenantId !== tenant.tenant_id && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => beginEditDisplayName(e, tenant)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                beginEditDisplayName(e, tenant);
                              }
                            }}
                            aria-label={`Rename ${tenant.display_name || tenant.tenant_id}`}
                          >
                            <Pencil className="size-3.5" />
                          </span>
                        )}
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingTenantId(tenant.tenant_id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingTenantId(tenant.tenant_id);
                          }
                        }}
                        aria-label={`Delete ${tenant.display_name || tenant.tenant_id}`}
                      >
                        <Trash className="size-3.5" />
                      </span>
                    </div>
                    {tenant.domain_id ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="size-3.5 shrink-0 text-muted-foreground/80" />
                        <span className="truncate font-mono" title={tenant.domain_id}>
                          {tenant.domain_id}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground/70 italic">No domain</p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 px-2 py-1 border-t border-border/50 bg-muted/20">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-medium rounded-md px-2 py-0.5 capitalize',
                        tenant.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0'
                          : 'bg-muted text-muted-foreground border-0'
                      )}
                    >
                      {tenant.status}
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => handleOpenInsights(e, tenant)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                        'bg-sky-100 text-sky-800 border border-sky-200',
                        'dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700',
                        'hover:bg-sky-200 dark:hover:bg-sky-800/60 transition-colors'
                      )}
                    >
                      <LayoutDashboard className="size-2.5" />
                      Dashboard
                    </button>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}

        {/* No search results */}
        {!loading && !error && tenants.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-1">
            <p className="text-sm text-muted-foreground">No tenants match "{search}"</p>
            <p className="text-xs text-muted-foreground/60">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingTenantId}
        onOpenChange={(open) => {
          if (!open) setDeletingTenantId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Delete tenant</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to delete this tenant?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" size="sm" onClick={() => setDeletingTenantId(null)}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="sm"
                variant="danger"
                className=""
                onClick={async () => {
                  if (deletingTenantId) await handleConfirmDelete(deletingTenantId);
                }}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-3 animate-spin" /> : 'Delete'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Tenant Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
          <SheetHeader className="px-3 py-2">
            <SheetTitle className="text-sm font-semibold">Create Tenant</SheetTitle>
            <SheetDescription className="text-xs">
              Register a new tenant for semantic layer configuration
            </SheetDescription>
          </SheetHeader>

          <div className="px-3 flex-1 overflow-auto">
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label className="text-xs font-medium">
                  Display Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-9 text-sm px-2.5"
                  placeholder="Enter display name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  disabled={creating}
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs font-medium">
                  Domain <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newDomainId}
                  onValueChange={setNewDomainId}
                  disabled={creating || domainsLoading}
                >
                  <SelectTrigger className="h-8 w-full text-sm">
                    <SelectValue
                      placeholder={domainsLoading ? 'Loading domains...' : 'Select a domain'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((domain) => (
                      <SelectItem key={domain.domain_id} value={domain.domain_id}>
                        {domain.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-1.5 px-3 py-2 border-t mt-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSheetOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleCreateTenant}
              disabled={creating || !newDisplayName.trim() || !newDomainId.trim()}
            >
              {creating && <Loader2 className="size-3 animate-spin" />}
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

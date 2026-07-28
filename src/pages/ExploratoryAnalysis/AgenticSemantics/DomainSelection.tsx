import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, Globe, CheckCircle2, AlertCircle, RefreshCw, LayoutGrid, List, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  fetchTenantDomains,
  fetchPacks,
  postTenantDomain,
  packItemDomainId,
  formatIndustrySlugForDisplay,
  type WorkspaceDomainItem,
  type PackListItem,
} from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TenantInfo } from './index';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface DomainSelectionProps {
  tenant: TenantInfo;
  onBack: () => void;
  /** When deployment_status is completed or configured: go to chats (domain conversations). */
  onDomainReady: (domain: WorkspaceDomainItem) => void;
  /** Otherwise: go to schema selection (connections, databases, new tenant model). */
  onDomainSetupRequired: (domain: WorkspaceDomainItem) => void;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch (error) {
    return String(s);
  }
}

export default function DomainSelection({ tenant, onBack, onDomainReady, onDomainSetupRequired }: DomainSelectionProps) {
  const [domains, setDomains] = useState<WorkspaceDomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [search, setSearch] = useState('');
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [packs, setPacks] = useState<PackListItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState(false);
  const [packSearch, setPackSearch] = useState('');
  const [linkingDomainId, setLinkingDomainId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const domainsRes = await fetchTenantDomains(tenant.tenantId);
      setDomains(domainsRes.domains ?? []);
    } catch {
      setError(true);
      setDomains([]);
      toast.error(getDisplayErrorMessage(error, 'Failed to load domains'));
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    loadDomains();
  }, [loadDomains]);

  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    setPacksError(false);
    try {
      const list = await fetchPacks();
      setPacks(list);
    } catch (error) {
      setPacksError(true);
      setPacks([]);
      toast.error(getDisplayErrorMessage(error, 'Failed to load available domains'));
    } finally {
      setPacksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!addDomainOpen) return;
    loadPacks();
  }, [addDomainOpen, loadPacks]);

  const existingDomainIds = new Set(domains.map((d) => d.domain_id).filter(Boolean));

  const packLabel = (p: PackListItem) => {
    if (typeof p.display_name === 'string' && p.display_name) return p.display_name;
    if (typeof p.name === 'string' && p.name) return p.name;
    const id = packItemDomainId(p);
    if (id) return formatIndustrySlugForDisplay(id);
    return '—';
  };

  const packMetaParts = (p: PackListItem): string[] => {
    const out: string[] = [];
    if (p.version != null && String(p.version).trim() !== '') out.push(`v${p.version}`);
    if (typeof p.release_date === 'string' && p.release_date.trim()) out.push(p.release_date);
    return out;
  };

  const handleLinkPack = async (pack: PackListItem) => {
    const domainId = packItemDomainId(pack);
    if (!domainId) {
      toast.error(getDisplayErrorMessage(error, 'This item has no domain id'));
      return;
    }
    setLinkingDomainId(domainId);
    try {
      await postTenantDomain(tenant.tenantId, domainId);
      toast.success('Domain linked to tenant');
      setAddDomainOpen(false);
      setPackSearch('');
      await loadDomains();
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to link domain'));
    } finally {
      setLinkingDomainId(null);
    }
  };

  const handleSelectDomain = (domain: WorkspaceDomainItem) => {
    const status = (domain.deployment_status ?? '').toLowerCase();
    if (status === 'completed' || status === 'configured') {
      onDomainReady(domain);
    } else {
      onDomainSetupRequired(domain);
    }
  };

  const deploymentStatusLabel = (status: string | null | undefined) => {
    const s = (status ?? '').toLowerCase();
    if (s === 'completed') return 'completed';
    if (s === 'not_started' || s === '') return 'not started';
    return s;
  };

  const deploymentStatusBadgeClass = (status: string | null | undefined) => {
    const s = (status ?? '').toLowerCase();
    if (s === 'completed') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0';
    if (s === 'not_started' || s === '') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0';
    return 'bg-muted text-muted-foreground border-0';
  };

  const filteredDomains = domains.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (d.display_name ?? '').toLowerCase().includes(q) ||
      (d.domain_id ?? '').toLowerCase().includes(q)
    );
  });

  const availablePacks = packs.filter((p) => {
    const id = packItemDomainId(p);
    if (!id) return false;
    if (existingDomainIds.has(id)) return false;
    if (!packSearch.trim()) return true;
    const q = packSearch.toLowerCase();
    const notes = typeof p.notes === 'string' ? p.notes.toLowerCase() : '';
    return (
      packLabel(p).toLowerCase().includes(q) ||
      id.toLowerCase().includes(q) ||
      notes.includes(q)
    );
  });

  useEffect(() => {
    if (!selectedPackId) return;
    if (!availablePacks.some((p) => packItemDomainId(p) === selectedPackId)) {
      setSelectedPackId(null);
    }
  }, [availablePacks, selectedPackId]);

  const selectedPackForDialog =
    selectedPackId != null ? packs.find((p) => packItemDomainId(p) === selectedPackId) ?? null : null;

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-1 py-1 border-b bg-background shrink-0">
      <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0 rounded-lg"
            onClick={onBack}
            title="Back to tenants"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
              Domains for <span className="font-semibold rounded-full bg-blue-50 px-3 py-0 text-blue-600 border border-blue-100">
  {tenant.displayName} </span> tenant
            </h1>
          
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative w-40">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 pl-6 pr-2 text-sm"
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-8 min-w-8 px-2 flex items-center justify-center gap-1 transition-colors text-xs font-medium',
                viewMode === 'grid' ? 'bg-primary/10 text-primary border-primary/20' : 'hover:bg-muted/50 text-muted-foreground'
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
                'h-8 min-w-8 px-2 flex items-center justify-center gap-1 transition-colors text-xs font-medium',
                viewMode === 'list' ? 'bg-primary/10 text-primary border-primary/20' : 'hover:bg-muted/50 text-muted-foreground'
              )}
              title="List view"
            >
              <List className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
          <Button
            variant="default"
            size="sm"
            className="!h-8 !w-25 p-0 shrink-0 rounded-lg"
            onClick={() => setAddDomainOpen(true)}
            title="Add domain from catalog"
          >
            <Plus className="size-4" />
            <span>Domain</span>
          </Button>
          <Button variant="outline" size="sm" className="!h-8 !w-8 p-0 shrink-0 rounded-lg" onClick={loadDomains} disabled={loading} title="Refresh domains">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <Dialog
        open={addDomainOpen}
        onOpenChange={(open) => {
          setAddDomainOpen(open);
          if (!open) {
            setPackSearch('');
            setSelectedPackId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription>
              Choose a domain from the catalog. It will be linked to this tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 flex flex-col gap-4 flex-1 min-h-0">
            {packsLoading && (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading catalog…</p>
              </div>
            )}
            {!packsLoading && packsError && (
              <div className="flex flex-col items-center gap-2 py-8">
                <AlertCircle className="size-8 text-destructive" />
                <p className="text-sm text-muted-foreground text-center">Could not load domains.</p>
                <Button variant="outline" size="sm" onClick={() => loadPacks()}>
                  Retry
                </Button>
              </div>
            )}
            {!packsLoading && !packsError && availablePacks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Globe className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const withId = packs.filter((p) => packItemDomainId(p));
                    if (withId.length === 0) return 'No domains are available in the catalog.';
                    const unlinked = withId.filter((p) => !existingDomainIds.has(packItemDomainId(p)!));
                    if (unlinked.length === 0) return 'All catalog domains are already linked to this tenant.';
                    if (packSearch.trim()) return 'No domains match your search.';
                    return 'No domains to show.';
                  })()}
                </p>
              </div>
            )}
            {!packsLoading && !packsError && availablePacks.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {/* <span className="text-sm font-medium text-foreground">Domains to attach</span> */}
                  <Select
                    value={selectedPackId ?? undefined}
                    onValueChange={(v) => setSelectedPackId(v || null)}
                    disabled={!!linkingDomainId}
                  >
                    <SelectTrigger className="w-full h-auto min-h-10 py-2 text-left [&_[data-slot=select-value]]:line-clamp-2">
                      <SelectValue placeholder="Select an industry pack…" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] max-h-[min(280px,50vh)] w-[var(--radix-select-trigger-width)]">
                      {availablePacks.map((pack) => {
                        const id = packItemDomainId(pack)!;
                        return (
                          <SelectItem key={id} value={id} className="py-2">
                            <span className="line-clamp-2 text-left">{packLabel(pack)}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
              </div>
            )}
          </div>
          {!packsLoading && !packsError && availablePacks.length > 0 && (
            <DialogFooter className="px-6 pb-6 pt-0 border-t sm:flex-col sm:space-x-0 gap-2">
              <Button
                className="w-full"
                disabled={!selectedPackId || linkingDomainId != null}
                onClick={() => {
                  if (!selectedPackId) return;
                  const pack = packs.find((p) => packItemDomainId(p) === selectedPackId);
                  if (pack) void handleLinkPack(pack);
                }}
              >
                {linkingDomainId ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Link to tenant
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-h-0 overflow-auto p-2 bg-muted/20">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading domains...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load domains</p>
            <Button variant="outline" size="sm" onClick={loadDomains}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && domains.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Globe className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No domains for this tenant</p>
          </div>
        )}

        {!loading && !error && domains.length > 0 && viewMode === 'list' && (
          <div className="space-y-4">
           
            {filteredDomains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-1">
                <p className="text-sm text-muted-foreground">No domains match &quot;{search}&quot;</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredDomains.map((domain) => {
                const ds = (domain.deployment_status ?? '').toLowerCase();
                const isCompleted = ds === 'completed' || ds === 'configured';
                return (
                  <button
                    key={domain.domain_id}
                    type="button"
                    onClick={() => handleSelectDomain(domain)}
                    className={cn(
                      'w-full flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/60 text-left transition-colors',
                      'bg-card hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm',
                      'shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Globe className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate text-foreground">
                          {domain.display_name ?? domain.domain_id}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {domain.domain_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0 sm:pl-2">
                      {domain.tables_detected != null && (
                        <Badge variant="secondary" className="text-[11px]">
                          {domain.tables_detected} table{domain.tables_detected !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {domain.last_scanned_at && (
                        <span className="text-[11px] text-muted-foreground">
                          Scanned {formatDate(domain.last_scanned_at)}
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[11px] font-medium rounded-md capitalize',
                          isCompleted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0' : deploymentStatusBadgeClass(domain.deployment_status)
                        )}
                      >
                        {isCompleted && <CheckCircle2 className="size-3 mr-0.5 inline" />}
                        {deploymentStatusLabel(domain.deployment_status)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        )}

        {!loading && !error && domains.length > 0 && viewMode === 'grid' && (
          <div className="space-y-4">
            {filteredDomains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-1">
                <p className="text-sm text-muted-foreground">No domains match &quot;{search}&quot;</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDomains.map((domain) => {
                const deploymentStatus = (domain.deployment_status ?? '').toLowerCase();
                const isCompleted = deploymentStatus === 'completed' || deploymentStatus === 'configured';
                return (
                  <article
                    key={domain.domain_id}
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
                      onClick={() => handleSelectDomain(domain)}
                      className="flex w-full flex-col flex-1 min-h-0 text-left p-0"
                    >
                      <div className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2 flex-1 min-w-0 text-left" title={domain.display_name ?? domain.domain_id}>
                            {domain.display_name ?? domain.domain_id}
                          </h3>
                        </div>
                        {domain.domain_id && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Globe className="size-3.5 shrink-0 text-muted-foreground/80" />
                            <span className="truncate font-mono" title={domain.domain_id}>
                              {domain.domain_id}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-auto flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-medium rounded-md px-2 py-0.5 capitalize',
                            isCompleted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0' : deploymentStatusBadgeClass(domain.deployment_status)
                          )}
                        >
                          {isCompleted && <CheckCircle2 className="size-3 mr-0.5 inline" />}
                          {deploymentStatusLabel(domain.deployment_status)}
                        </Badge>
                        {domain.tables_detected != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {domain.tables_detected} table{domain.tables_detected !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

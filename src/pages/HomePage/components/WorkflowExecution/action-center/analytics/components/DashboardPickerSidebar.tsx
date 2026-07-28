import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronRight, LayoutDashboard, Loader2, Trash2 } from 'lucide-react';
import { DashboardSidebarCollapsedRail } from '@/pages/Dashboards/components/DashboardSidebarCollapsedRail';
import { DASHBOARD_SIDEBAR_COLLAPSED_WIDTH_PX } from '@/pages/Dashboards/dashboardConstants';
import { getDashboardId } from '../utils/dashboard';
import type { AnalyticsViewProps } from '../viewTypes';

function formatDashboardListDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DashboardPickerSidebar(props: AnalyticsViewProps) {
  const {
    isDashboardPickerExpanded,
    dashboards,
    isLoadingDashboards,
    selectedDashboardId,
    deleteConfirmDashboardId,
    setDeleteConfirmDashboardId,
    deletingDashboardId,
    toggleDashboardPicker,
    handleSelectDashboard,
    handleConfirmDeleteDashboard,
  } = props;

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-0 max-h-full flex-shrink-0 flex-col border-l border-border bg-muted/30 transition-all duration-300 overflow-hidden',
        isDashboardPickerExpanded ? 'w-72' : 'w-10',
      )}
      style={{
        width: isDashboardPickerExpanded ? undefined : `${DASHBOARD_SIDEBAR_COLLAPSED_WIDTH_PX}px`,
      }}
    >
      {!isDashboardPickerExpanded ? (
        <DashboardSidebarCollapsedRail
          label="Dashboards"
          count={dashboards.length}
          icon={<LayoutDashboard className="size-3" />}
          onExpand={toggleDashboardPicker}
        />
      ) : null}

      <div
        className={cn(
          'absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300',
          isDashboardPickerExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="flex-shrink-0 border-b border-border bg-card px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight">Dashboards</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Switch between saved views</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {dashboards.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={toggleDashboardPicker}
                title="Collapse dashboards"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/20 scrollbar-thin">
          <div className="space-y-1.5 p-2">
            {isLoadingDashboards ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-3 py-6 text-center">
                <LayoutDashboard className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">No dashboards yet</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Create one from the toolbar</p>
              </div>
            ) : (
              dashboards.map((dashboard) => {
                const dashId = getDashboardId(dashboard);
                if (!dashId) return null;
                const isSelected = dashId === selectedDashboardId;
                const title = dashboard.dashboard_title || dashboard.title || 'Untitled Dashboard';
                const isDeleting = deletingDashboardId === dashId;
                const updatedLabel = formatDashboardListDate(dashboard.updated_at);

                return (
                  <div
                    key={dashId}
                    className={cn(
                      'group flex items-center gap-1 rounded-lg border bg-card transition-all duration-150',
                      isSelected
                        ? 'border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15'
                        : 'border-border hover:border-border/80 hover:shadow-sm',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectDashboard(dashId)}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                            isSelected
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground group-hover:text-primary',
                          )}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-[13px] font-medium leading-tight',
                              isSelected ? 'text-primary' : 'text-foreground',
                            )}
                            title={title}
                          >
                            {title}
                          </p>
                          {updatedLabel && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{updatedLabel}</p>
                          )}
                        </div>
                      </div>
                    </button>

                    <Popover
                      open={deleteConfirmDashboardId === dashId}
                      onOpenChange={(open) => {
                        if (!open && deleteConfirmDashboardId === dashId) {
                          setDeleteConfirmDashboardId(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'mr-1 h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                            isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                            isSelected && !isDeleting && 'opacity-70',
                          )}
                          title="Delete dashboard"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmDashboardId(dashId);
                          }}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="left"
                        align="center"
                        className="w-64 p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-sm font-medium">Delete dashboard?</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          &quot;{title}&quot; will be removed permanently.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => setDeleteConfirmDashboardId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => void handleConfirmDeleteDashboard(dashId)}
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

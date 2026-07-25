import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import {
  Settings,
  Plus,
  LayoutDashboard,
  BarChart3,
  Pencil,
  CalendarIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { getDashboardId } from '../utils/dashboard';
import type { AnalyticsViewProps } from '../viewTypes';

const toolbarIconButtonClass = '!h-7 !w-7 shrink-0';

export function AnalyticsToolbarControls({
  activeDashboard,
  workflowName,
  navigate,
  statementDateDisplay,
  loadingDates,
  date,
  hasUserSelectedDateRef,
  setDate,
  isStatementDateDisabled,
  setIsSettingsDialogOpen,
  refreshCharts,
  isChartsRefreshing,
  isAnalyticsStudio,
  analyticsStudioDashboardId,
}: AnalyticsViewProps) {
  const dashId = getDashboardId(activeDashboard) || analyticsStudioDashboardId;

  return (
    <div className="flex shrink-0 items-center justify-end gap-2 pr-2">
      {!isAnalyticsStudio && (
        <>
          <Popover>
            <ShadTooltip content="Create">
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={toolbarIconButtonClass}
                  aria-label="Create dashboard or chart"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                </Button>
              </PopoverTrigger>
            </ShadTooltip>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-52 border border-primary/25 bg-background/60 p-1.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/45"
            >
              <p className="px-2 pb-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Create new
              </p>
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  className="flex h-9 w-full items-center justify-start gap-2.5 rounded-md px-2"
                  onClick={() =>
                    workflowName && navigate(`/reconciliation/operations/${workflowName}/dashboards/create`)
                  }
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <LayoutDashboard className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">Create Dashboard</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex h-9 w-full items-center justify-start gap-2.5 rounded-md px-2"
                  onClick={() =>
                    workflowName && navigate(`/reconciliation/operations/${workflowName}/charts/create`)
                  }
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">Create Chart</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Statement:{' '}
              <span className="font-medium text-foreground">{statementDateDisplay}</span>
            </span>
            <ShadTooltip content={loadingDates ? 'Loading statement dates...' : 'Select Statement Date'}>
              <Popover modal={false}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className={toolbarIconButtonClass} disabled={loadingDates}>
                    {loadingDates ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarIcon className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto p-0 rounded-md bg-background shadow-md"
                  style={{ border: '1px solid rgb(209, 213, 219)' }}
                >
                  <style>{`
                    .analytics-calendar .rdp-day_selected,
                    .analytics-calendar .rdp-day[data-selected="true"] {
                      background: transparent !important;
                    }
                    .analytics-calendar .rdp-day_selected button,
                    .analytics-calendar .rdp-day[data-selected="true"] button,
                    .analytics-calendar button[data-selected-single="true"] {
                      background-color: #0370f1 !important;
                      color: white !important;
                      font-weight: 600 !important;
                      border-radius: 10px !important;
                      border: none !important;
                      box-shadow: none !important;
                    }
                    .analytics-calendar .rdp-day button:focus-visible {
                      outline: none !important;
                      box-shadow: none !important;
                    }
                  `}</style>
                  <Calendar
                    mode="single"
                    className="analytics-calendar"
                    selected={date}
                    startMonth={new Date(new Date().getFullYear() - 10, 0)}
                    endMonth={new Date(new Date().getFullYear(), 11)}
                    captionLayout="dropdown"
                    onSelect={(newDate) => {
                      if (newDate) {
                        hasUserSelectedDateRef.current = true;
                        setDate(newDate);
                      }
                    }}
                    disabled={isStatementDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </ShadTooltip>
          </div>
          <ShadTooltip content="Settings">
            <Button variant="outline" size="icon" className={toolbarIconButtonClass} onClick={() => setIsSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </ShadTooltip>
        </>
      )}
      <ShadTooltip content="Edit dashboard">
        <Button
          variant="outline"
          size="icon"
          className={toolbarIconButtonClass}
          onClick={() => {
            if (!dashId) return;
            if (isAnalyticsStudio) {
              navigate(`/analytic-studio/dashboards/create?dashboardId=${dashId}`);
            } else if (workflowName) {
              navigate(`/reconciliation/operations/${workflowName}/dashboards/create?edit=${dashId}`);
            } else {
              navigate(`/visualization/dashboards/create?edit=${dashId}`);
            }
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </ShadTooltip>
      <ShadTooltip content="Refresh charts">
        <Button
          variant="outline"
          size="icon"
          className={toolbarIconButtonClass}
          onClick={refreshCharts}
          disabled={
            isChartsRefreshing ||
            (!isAnalyticsStudio && loadingDates) ||
            !activeDashboard?.charts?.length
          }
        >
          <RefreshCw className={`h-4 w-4 ${isChartsRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </ShadTooltip>
    </div>
  );
}

/** Standalone header row: centered dashboard title with controls on the right. */
export function AnalyticsDashboardHeader(props: AnalyticsViewProps) {
  const { displayDashboardTitle, isDashboardTitleLoading } = props;

  return (
    <div className="mb-0 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div aria-hidden className="min-w-0" />
      <h3 className="min-w-0 max-w-[min(100%,28rem)] truncate text-center text-sm font-semibold">
        {isDashboardTitleLoading ? (
          <span
            className="mx-auto inline-block h-4 w-40 max-w-full animate-pulse rounded bg-muted"
            aria-label="Loading dashboard title"
          />
        ) : (
          displayDashboardTitle || 'Untitled Dashboard'
        )}
      </h3>
      <AnalyticsToolbarControls {...props} />
    </div>
  );
}

/** @deprecated Use AnalyticsDashboardHeader on the tabs row, or AnalyticsToolbarControls alone. */
export function AnalyticsToolbar(props: AnalyticsViewProps) {
  return <AnalyticsDashboardHeader {...props} />;
}

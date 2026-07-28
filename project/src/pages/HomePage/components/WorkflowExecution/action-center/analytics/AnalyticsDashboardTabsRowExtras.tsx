import { AnalyticsToolbarControls } from './components/AnalyticsToolbar';
import { useOptionalAnalyticsDashboardContext } from './AnalyticsDashboardContext';

/** Centered dashboard title + right-aligned controls for the Day Wise Trends / Dashboard tabs row. */
export function AnalyticsDashboardTabsRowExtras() {
  const viewProps = useOptionalAnalyticsDashboardContext();
  if (!viewProps) return null;

  const { displayDashboardTitle, isDashboardTitleLoading } = viewProps;

  return (
    <>
      <h3
        className="min-w-0 truncate text-center text-sm font-semibold"
        title={displayDashboardTitle ?? undefined}
      >
        {isDashboardTitleLoading ? (
          <span
            className="mx-auto inline-block h-4 w-40 max-w-full animate-pulse rounded bg-muted"
            aria-label="Loading dashboard title"
          />
        ) : (
          displayDashboardTitle || 'Untitled Dashboard'
        )}
      </h3>
      <AnalyticsToolbarControls {...viewProps} />
    </>
  );
}

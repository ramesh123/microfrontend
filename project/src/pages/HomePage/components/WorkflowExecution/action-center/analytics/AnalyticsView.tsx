import type { AnalyticsViewProps } from './viewTypes';
import { AnalyticsDashboardHeader } from './components/AnalyticsToolbar';
import { AnalyticsDashboardCanvas } from './components/AnalyticsDashboardCanvas';
import { DashboardPickerSidebar } from './components/DashboardPickerSidebar';
import { DataPreviewDialog } from './components/DataPreviewDialog';
import { DrillThroughDialog } from './components/DrillThroughDialog';
import { AnalyticsSettingsDialog } from './components/AnalyticsSettingsDialog';
import { useOptionalAnalyticsDashboardContext } from './AnalyticsDashboardContext';

type AnalyticsViewComponentProps = Partial<AnalyticsViewProps> & {
  /** When false, header controls are rendered by the parent (e.g. Analytics tabs row). */
  showToolbar?: boolean;
};

export function AnalyticsView(props: AnalyticsViewComponentProps) {
  const { showToolbar = true, ...viewProps } = props;
  const contextProps = useOptionalAnalyticsDashboardContext();
  const mergedProps = { ...(contextProps ?? {}), ...viewProps } as AnalyticsViewProps;
  const { isAnalyticsStudio } = mergedProps;

  if (!mergedProps.computedLayout) {
    return null;
  }

  return (
    <div className="py-0 px-0 h-full min-h-0 flex flex-col overflow-hidden">
      <div className="relative flex flex-1 min-h-0 h-full overflow-hidden items-stretch">
        <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden !pr-0">
          {showToolbar ? <AnalyticsDashboardHeader {...mergedProps} /> : null}
          <AnalyticsDashboardCanvas {...mergedProps} />
        </div>
        {!isAnalyticsStudio && <DashboardPickerSidebar {...mergedProps} />}
      </div>
      <DataPreviewDialog {...mergedProps} />
      <DrillThroughDialog {...mergedProps} />
      {!isAnalyticsStudio && <AnalyticsSettingsDialog {...mergedProps} />}
    </div>
  );
}

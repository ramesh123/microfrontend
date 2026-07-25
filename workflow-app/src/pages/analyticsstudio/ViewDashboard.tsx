import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalytics } from '@/pages/HomePage/components/WorkflowExecution/action-center/analytics/hooks/useAnalytics';
import { AnalyticsView } from '@/pages/HomePage/components/WorkflowExecution/action-center/analytics/AnalyticsView';

export default function AnalyticsStudioViewDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dashboardId = searchParams.get('dashboardId');

  const viewProps = useAnalytics({
    mode: 'analytics-studio',
    dashboardId: dashboardId ?? undefined,
  });

  if (!dashboardId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">No dashboard selected.</p>
        <Button onClick={() => navigate('/analytic-studio', { state: { tab: 'dashboards' } })}>
          Back to Dashboards
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-1 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/analytic-studio', { state: { tab: 'dashboards' } })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Analytics Studio — View Dashboard</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" style={{ height: 'calc(100vh - 49px)' }}>
        <AnalyticsView {...viewProps} />
      </div>
    </div>
  );
}

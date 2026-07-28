import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TbBrandGoogleAnalytics } from 'react-icons/tb';
import {
  BarChart3,
  BarChart2,
  LayoutDashboard,
  FileText,
  SquareKanban,
  ClipboardCheck,
  ClipboardCheckIcon,
  ArrowLeft,
  Settings,
  Loader2,
  SlidersHorizontal,
  Download,
  List,
  RefreshCw,
  GitBranch,
  BarChart2Icon,
  ChartBarIcon,
  SignalIcon,
  SignalHigh,
  SignpostBigIcon,
  SignalHighIcon,
  DownloadIcon,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import HistoryPage from '../historydata/history';
import { useParams } from 'react-router-dom';
import { SummaryTable } from '../Reconcilationtab/Summary';
import ReportDownloaderPage from '../Reconcilationtab/Report';
import { ReconSummary, clearReconSummaryCache } from '../Reconcilationtab/recon_summary';
import Actions from './actions';
import WorkflowExecution from '../index';
import { getWorkflowByIdApi } from '@/controllers/API';
import useFlowStore from '@/stores/flowStore';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import OperationsTab from './OperationsTab';
import FlowPage from '@/pages/FlowPage';
import { Analytics } from './Analytics';
import Nodeoperationoutput from '../Reconcilationtab/Nodeoperationoutput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChartsListPage from '@/pages/charts/ChartsListPage';
import DashboardsListPage from '@/pages/Dashboards/DashboardListPage';
import ConversationalOperations from '../conversational_operations';
import {
  isReconWorkflowFlowIdResolved,
  workflowMatchesRouteId,
} from '@/pages/Dashboards/utils/reconWorkflowHydration';

// Wrapper: pass list row (id, flow_id) to parent — no getWorkflowByIdApi; view and tabs use flowId from it.
function WorkflowExecutionWrapper({
  onWorkflowSelect,
  onLoadingChange
}: {
  onWorkflowSelect: (workflow: any) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const handleWorkflowClick = (workflow: any) => {
    const idParam = workflow.id ?? workflow.workflow_id ?? workflow.flow_id;
    if (!idParam) {
      toast.error('Workflow ID not found');
      return;
    }
    onWorkflowSelect(workflow);
  };

  return <WorkflowExecution onWorkflowClick={handleWorkflowClick} workflowType="Data_Reconciliation" />;
}


// Wrapper component to embed Recontab view without nested router
// Renders a simplified embedded version of Recontab content
function RecontabEmbeddedWrapper({
  workflow,
  workflowId,
  headerContent,
  viewModeToggle,
}: {
  workflow: any;
  workflowId: string;
  headerContent?: ReactNode;
  viewModeToggle?: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get active tab from URL query parameter (e.g., /reconciliation/27511?tab=summary -> 'summary')
  // Note: 'processflow' is NOT a valid tab - it's handled via overlayView
  const getTabFromQuery = () => {
    const tabFromQuery = searchParams.get('tab');
    const validTabs = ['summary', 'operations', 'conversational-ai', 'analytics', 'report', 'action-center', 'jobs'];
    return tabFromQuery && validTabs.includes(tabFromQuery) ? tabFromQuery : 'summary';
  };

  const [activeTab, setActiveTab] = useState(() => getTabFromQuery());
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overlayView, setOverlayView] = useState<'processflow' | 'output' | null>(null);
  const [loadingProcessFlow, setLoadingProcessFlow] = useState(false);
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const setOutputNode = useFlowStore((state) => state.setOutputNode);
  const previousWorkflowIdRef = useRef<string | null>(null);

  // Sync activeTab with URL query parameter changes
  // Note: 'processflow' is NOT a valid tab - it's handled via overlayView
  useEffect(() => {
    const tabFromQuery = searchParams.get('tab');
    const validTabs = ['summary', 'operations', 'conversational-ai', 'analytics', 'report', 'action-center', 'jobs'];
    // If tab is 'processflow', ignore it and default to 'summary'
    const tab = tabFromQuery && validTabs.includes(tabFromQuery) ? tabFromQuery : 'summary';
    if (tab !== activeTab) {
      setActiveTab(tab);
      // Reset overlayView when tab changes
      setOverlayView(null);
    }
  }, [searchParams, activeTab]);

  // Ensure location.state has mode: "view" when overlayView is 'processflow'
  // Use a ref to track when we enter processflow view
  const processFlowActiveRef = useRef(false);
  useEffect(() => {
    if (overlayView === 'processflow' && workflow) {
      processFlowActiveRef.current = true;
      // Always ensure location.state has mode: "view" when in processflow
      if (!location.state?.mode || location.state?.mode !== "view") {
        console.log('[RecontabEmbeddedWrapper] Setting location.state with mode: "view"');
        navigate(location.pathname + location.search, {
          state: { workflow: workflow, mode: "view" },
          replace: true
        });
      }
    } else {
      processFlowActiveRef.current = false;
    }
  }, [overlayView, workflow, location.pathname, location.search, navigate]);

  // Separate effect to watch for location.state changes and restore if cleared while in processflow
  useEffect(() => {
    if (processFlowActiveRef.current && overlayView === 'processflow' && workflow) {
      // If state was cleared while we're in processflow view, restore it
      if (!location.state?.mode || location.state?.mode !== "view") {
        console.log('[RecontabEmbeddedWrapper] location.state cleared while in processflow! Restoring mode: "view"');
        navigate(location.pathname + location.search, {
          state: { workflow: workflow, mode: "view" },
          replace: true
        });
      }
    }
  }, [location.state?.mode, overlayView, workflow, location.pathname, location.search, navigate]);

  // Set workflow in store - only when workflow ID actually changes
  useEffect(() => {
    const workflowId = workflow?.id || workflow?.flow_id || workflow?.workflow_id;
    if (workflow && workflowId && previousWorkflowIdRef.current !== workflowId) {
      setCurrentWorkflow(workflow);
      setOutputNode(workflow?.outputNode);
      previousWorkflowIdRef.current = workflowId;
    }
  }, [workflow, setCurrentWorkflow, setOutputNode]);

  const flowId = useMemo(() => {
    if (workflow?.flow_id && isReconWorkflowFlowIdResolved(workflow, workflowId)) {
      return workflow.flow_id as string;
    }
    return undefined;
  }, [workflow?.flow_id, workflowId]);

  const tabsData = useMemo(
    () => [
      { id: "summary", label: "Summary", icon: BarChart2, component: (props: any) => <SummaryTable flowId={props.flowId} /> },
      { id: "operations", label: "Operations", icon: SlidersHorizontal, component: (props: any) => <ReconSummary flowId={props.flowId} /> },
      {
        id: "conversational-ai",
        label: "Conversational AI",
        icon: Sparkles,
        component: (props: any) => (
          <ConversationalOperations
            flowId={props.flowId}
            workflowId={props.workflowId}
            workflow={props.workflow}
          />
        ),
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: TbBrandGoogleAnalytics,
        component: (props: any) => <Analytics flowId={props.flowId} workflowName={props.workflowName} />,
      },
      {
        id: "report",
        label: "Reports",
        icon: Download,
        component: (props: any) => (
          <ReportDownloaderPage workflowId={props.flowId || props.workflowId} workflow={props.workflow} />
        ),
      },
      // { id: "action-center", label: "Action Center", icon: SquareKanban, component: Actions },
      { id: "jobs", label: "Jobs", icon: ClipboardCheckIcon, component: (props: any) => <HistoryPage flowName={props.flowId} /> },
    ],
    [],
  );

  const currentTab = useMemo(() => tabsData.find((t) => t.id === activeTab), [tabsData, activeTab]);
  const TabComponent = currentTab?.component;
  const isAnalyticsTab = activeTab === 'analytics';

  const componentProps = useMemo(
    () => ({
      workflow,
      workflowId: workflow?.workflow_id,
      flowId: flowId,
      workflowName: workflowId,
    }),
    [workflow, flowId, workflowId],
  );

  const handleTabChange = (tabId: string) => {
    setTabLoading(true);
    setActiveTab(tabId);
    // Reset overlayView when switching tabs
    setOverlayView(null);
    // Update URL query parameter to stay in same view (DataReconciliationView)
    const currentSearch = new URLSearchParams(location.search);
    currentSearch.set('tab', tabId);
    currentSearch.set('view', 'recontab'); // Ensure view mode is set
    navigate(`/reconciliation/operations/${workflowId}?${currentSearch.toString()}`, {
      state: { workflow, mode: "view" },
      replace: true
    });
    setTimeout(() => setTabLoading(false), 300);
  };

  const handleRefresh = () => {
    setTabLoading(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setTabLoading(false), 300);
  };

  const recontabHeaderActions = (
    <div className="flex shrink-0 items-center gap-2">


      <ShadTooltip content="Process Flow">
        <Button
          variant="outline"
          className={`h-7 w-7 ${overlayView === 'processflow' ? "bg-primary text-white border-primary hover:bg-primary/90" : ""}`}
          size="icon"
          disabled={loadingProcessFlow}
          onClick={async () => {
            const currentSearch = new URLSearchParams(location.search);
            const hasFullWorkflow = workflow?.outputNode !== undefined || workflow?.data !== undefined;
            if (hasFullWorkflow) {
              navigate(`/reconciliation/operations/${workflowId}?${currentSearch.toString()}`, {
                state: { workflow, mode: "view" },
                replace: true
              });
              setOverlayView('processflow');
              return;
            }
            setLoadingProcessFlow(true);
            try {
              const res = await getWorkflowByIdApi({ id: workflowId });
              if (res) {
                setCurrentWorkflow(res);
                setOutputNode(res?.outputNode);
                navigate(`/reconciliation/operations/${workflowId}?${currentSearch.toString()}`, {
                  state: { workflow: res, mode: "view" },
                  replace: true
                });
                setOverlayView('processflow');
              } else {
                toast.error('Failed to load workflow');
              }
            } catch (err: unknown) {
              console.error('Failed to load process flow:', err);
              if (!(err instanceof ApiRequestError)) {
                toast.error(getDisplayErrorMessage(err, 'Could not load process flow'));
              }
            } finally {
              setLoadingProcessFlow(false);
            }
          }}
        >
          {loadingProcessFlow ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch />}
        </Button>
      </ShadTooltip>
      <ShadTooltip content="Output Node Operation">
        <Button
          variant="outline"
          className={`h-7 w-7 ${overlayView === 'output' ? "bg-primary text-white border-primary hover:bg-primary/90" : ""}`}
          size="icon"
          onClick={() => setOverlayView('output')}
        >
          <Settings />
        </Button>
      </ShadTooltip>
      <ShadTooltip content="Refresh Current Tab" side="left">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={tabLoading}
        >
          <RefreshCw className={`h-4 w-4 ${tabLoading ? "animate-spin" : ""}`} />
        </Button>
      </ShadTooltip>
      {viewModeToggle}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/70 bg-background">
        {headerContent && (
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0 flex-1">{headerContent}</div>
            {recontabHeaderActions}
          </div>
        )}
        <div className="relative flex w-full items-end gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto">
            {tabsData.map((tab) => {
              // Don't highlight any tab when Process Flow or Output overlay is active
              const isActive = overlayView === null && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={tabLoading}
                  aria-pressed={isActive}
                  role="tab"
                  aria-selected={isActive}
                  className={`shrink-0 border-b-2 px-1 pb-2 pt-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-primary'
                    }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden py-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {tabLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading ...</p>
              </div>
            </div>
          ) : overlayView === 'processflow' ? (
            <div className="relative w-full h-full">
              {loadingProcessFlow ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading process flow...</p>
                  </div>
                </div>
              ) : (
                <FlowPage />
              )}
            </div>
          ) : overlayView === 'output' ? (
            <div className="relative w-full h-full">
              <Nodeoperationoutput />
            </div>
          ) : TabComponent ? (
            <div
              className={
                isAnalyticsTab
                  ? 'flex h-full min-h-0 w-full flex-col overflow-hidden !pr-0 !mr-0'
                  : 'h-full min-h-0 w-full overflow-y-auto'
              }
            >
              <TabComponent key={`${activeTab}-${refreshKey}`} {...componentProps} />
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {currentTab?.label || ""} content not available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DataReconciliationView() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const sidebarParam = searchParams.get('sidebar');
  // Always ensure a sidebar is active - default to 'summary' if none specified
  // Initialize with sidebar from URL or default to 'summary'
  const [activeRightSidebar, setActiveRightSidebar] = useState<string>(() => {
    const initialSidebar = searchParams.get("sidebar");
    if (initialSidebar && ["summary", "operations", "jobs", "reports", "analytics", "action-center"].includes(initialSidebar)) {
      return initialSidebar;
    }
    return "summary";
  });
  const [activeStatusTab, setActiveStatusTab] = useState('matched');
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tabLoading, setTabLoading] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('charts');
  const location = useLocation();
  const navigate = useNavigate();
  const { workflowName } = useParams();
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);

  useEffect(() => {
    return () => {
      clearReconSummaryCache();
    };
  }, []);

  const handleRefreshCurrentView = useCallback(() => {
    setTabLoading(true);
    setRefreshKey((r) => r + 1);
    setTimeout(() => setTabLoading(false), 300);
  }, []);

  const [viewMode, setViewMode] = useState<'action-center' | 'recontab'>(() => {
    // Check query parameter for view mode
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab');

    // If view=recontab or tab parameter exists, it's Recontab view
    return (viewParam === 'recontab' || tabParam) ? 'recontab' : 'action-center';
  });

  // Compute a single flowId to use everywhere — only the real flow_id after workflow is resolved.
  const flowId = useMemo(() => {
    if (selectedWorkflow?.flow_id && isReconWorkflowFlowIdResolved(selectedWorkflow, workflowName)) {
      return selectedWorkflow.flow_id as string;
    }
    return undefined;
  }, [selectedWorkflow, workflowName]);
  const isWorkflowFlowIdReady = Boolean(flowId);
  // Use flowId for URL path construction too (it already falls back to workflowName)
  const pathId = selectedWorkflow?.id

  const viewModeToggle = selectedWorkflow ? (
    <div className="bg-muted border border-gray-200 shadow-sm h-8 rounded-md flex items-center px-0">
      <ToggleGroup
        type="single"
        value={viewMode}
        className="h-full flex items-center gap-1"
        onValueChange={(value) => {
          console.log('Toggle clicked - value:', value, 'pathId:', pathId, 'workflowName:', workflowName);
          if (value === 'recontab') {
            if (pathId || workflowName) {
              const currentSearch = new URLSearchParams(location.search);
              currentSearch.set('tab', 'summary');
              currentSearch.set('view', 'recontab');
              currentSearch.delete('sidebar');
              const newUrl = `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`;
              console.log('Navigating to Recontab:', newUrl);
              navigate(newUrl, {
                state: { workflow: selectedWorkflow, mode: "view" },
                replace: true
              });
            } else {
              console.warn('Cannot navigate to Recontab - no pathId or workflowName');
            }
          } else if (value === 'action-center') {
            const currentSearch = new URLSearchParams(location.search);
            const sidebar = currentSearch.get("sidebar") || "summary";
            currentSearch.set("sidebar", sidebar);
            currentSearch.delete("view");
            currentSearch.delete("tab");
            setActiveRightSidebar(sidebar);
            const newUrl = pathId || workflowName
              ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
              : `/reconciliation/operations?${currentSearch.toString()}`;
            navigate(newUrl, { replace: true });
          }
        }}
        aria-label="View mode"
      >
        <ShadTooltip content="List View">
          <ToggleGroupItem
            value="action-center"
            aria-label="List view"
            className={`h-7 w-7 p-0 flex items-center justify-center rounded-md transition-all data-[state=on]:bg-background data-[state=on]:shadow-sm ${viewMode === 'action-center'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'bg-transparent text-muted-foreground hover:bg-primary/10'
              }`}
          >
            <List className={`h-4 w-4 ${viewMode === 'action-center' ? 'text-foreground' : 'text-muted-foreground'}`} />
          </ToggleGroupItem>
        </ShadTooltip>
        <ShadTooltip content="Grid View">
          <ToggleGroupItem
            value="recontab"
            aria-label="Grid view"
            className={`px-1 py-1.5 h-7 text-xs font-medium transition-all duration-200 rounded-md ${viewMode === 'recontab'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'bg-transparent text-muted-foreground hover:bg-primary/10'
              }`}
          >
            <LayoutGrid className={`h-4 w-4 ${viewMode === 'recontab' ? 'text-foreground' : 'text-muted-foreground'}`} />
          </ToggleGroupItem>
        </ShadTooltip>
      </ToggleGroup>
    </div>
  ) : null;

  const workflowHeaderContent = (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="!h-7 !w-7 text-primary border border-primary bg-primary/10 hover:bg-primary/20 hover:text-primary shrink-0"
        onClick={() => {
          // Set navigating flag to prevent useEffect interference
          setIsNavigatingBack(true);
          // Clear all workflow-related state first
          setSelectedWorkflow(null);
          setCurrentWorkflow(null);
          useFlowStore.getState().setOutputNode(null);
          setIsLoadingWorkflow(false);
          setActiveRightSidebar(''); // Clear active sidebar
          // Navigate back to reconciliation route (without workflowName) to show workflow list
          // Use replace: true to replace current history entry
          void queryClient.invalidateQueries({ queryKey: ['projects'] });
          navigate('/reconciliation/operations', { replace: true });
          // Reset navigating flag after navigation completes
          setTimeout(() => setIsNavigatingBack(false), 100);
        }}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
      </Button>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">
          {selectedWorkflow?.name ? selectedWorkflow?.name.charAt(0).toUpperCase() + selectedWorkflow?.name.slice(1).toLowerCase() : ''}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {selectedWorkflow?.updated_at
            ? `Last updated: ${new Date(selectedWorkflow.updated_at).toLocaleString()}`
            : 'Run 7 (Latest) - 07 Aug 2025 11:24'}
        </p>
      </div>
    </div>
  );

  // Update active sidebar from URL param (only for Action Center view)
  useEffect(() => {
    // Don't interfere if we're navigating back or in Recontab view
    if (isNavigatingBack) {
      return;
    }

    const viewFromUrl = searchParams.get("view");
    const tabFromUrl = searchParams.get("tab");
    // Recontab is driven only by URL — do not also gate on `viewMode` or a brief stale state
    // can skip syncing and leave `activeRightSidebar` empty when switching grid → list.
    if (viewFromUrl === "recontab" || tabFromUrl) {
      return;
    }

    const sidebarFromUrl = searchParams.get('sidebar');
    // Priority 1: Always respect sidebar param from URL if it exists
    if (sidebarFromUrl && ['summary', 'operations', 'jobs', 'reports', 'analytics', 'action-center'].includes(sidebarFromUrl)) {
      // Always update the sidebar when URL param changes - this takes highest priority
      if (activeRightSidebar !== sidebarFromUrl) {
        setActiveRightSidebar(sidebarFromUrl);
      }
      return; // Exit early to prevent any defaulting logic
    }

    // Priority 2: Only default to summary if there's NO sidebar param at all
    // This should only happen on initial load, not when navigating back
    if (!sidebarFromUrl && workflowName && !selectedWorkflow) {
      // Only on initial load when workflow is in URL but not yet loaded
      setActiveRightSidebar('summary');
      const newParams = new URLSearchParams(searchParams);
      newParams.set('sidebar', 'summary');
      setSearchParams(newParams, { replace: true });
    } else if (!sidebarFromUrl && workflowName && selectedWorkflow) {
      // If workflow is loaded but no sidebar param, only set summary if we're not already on a different tab
      // This prevents overriding when user navigates to operations/jobs/etc
      if (activeRightSidebar === 'summary' || !activeRightSidebar) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('sidebar', 'summary');
        setSearchParams(newParams, { replace: true });
      }
    } else if (!sidebarFromUrl && !workflowName) {
      // If no sidebar param and no workflow, clear sidebar (showing workflow list)
      // This handles the back button navigation case
      if (activeRightSidebar) {
        setActiveRightSidebar('');
      }
      // Don't update URL to keep it as /reconciliation
    }
  }, [searchParams, setSearchParams, location.search, workflowName, selectedWorkflow, activeRightSidebar, isNavigatingBack]);

  // Debug: Log viewMode changes
  useEffect(() => {
    console.log('viewMode changed to:', viewMode);
  }, [viewMode]);

  // Update viewMode from URL query parameters (runs first, has priority)
  useEffect(() => {
    if (isNavigatingBack) {
      return;
    }

    const viewFromUrl = searchParams.get('view');
    const tabFromUrl = searchParams.get('tab');
    const sidebarFromUrl = searchParams.get('sidebar');

    console.log('ViewMode Effect - URL params:', { viewFromUrl, tabFromUrl, sidebarFromUrl, currentViewMode: viewMode });

    // Priority: view/tab params take precedence over sidebar
    if (viewFromUrl === 'recontab' || tabFromUrl) {
      // Query parameter indicates Recontab view
      console.log('Setting viewMode to recontab');
      setViewMode('recontab');
    } else if (sidebarFromUrl) {
      // Only set to action-center if sidebar param exists (explicit Action Center)
      console.log('Setting viewMode to action-center (sidebar exists)');
      setViewMode('action-center');
    } else if (!viewFromUrl && !tabFromUrl && !sidebarFromUrl) {
      // No params at all - default to action-center only if we have a workflow
      if (selectedWorkflow) {
        console.log('Setting viewMode to action-center (default, no params)');
        setViewMode('action-center');
      }
    }
  }, [searchParams, isNavigatingBack, selectedWorkflow]);

  // Use workflow from navigation state (list row with id, flow_id); sync to store. No getWorkflowByIdApi — tabs call their own APIs with flowId.
  // Skip when navigating back so we don't restore selectedWorkflow and re-trigger tab APIs.
  useEffect(() => {
    if (isNavigatingBack) return;
    if (location.state?.workflow) {
      if (location.state?.mode || location.state?.viewMode) {
        const workflowId = location.state.workflow?.id || location.state.workflow?.flow_id || location.state.workflow?.workflow_id;
        const currentWorkflowId = selectedWorkflow?.id || selectedWorkflow?.flow_id || selectedWorkflow?.workflow_id;
        if (workflowId !== currentWorkflowId) {
          setSelectedWorkflow(location.state.workflow);
          setCurrentWorkflow(location.state.workflow);
        }
        if (location.state?.viewMode) setViewMode(location.state.viewMode);
        return;
      }
      setSelectedWorkflow(location.state.workflow);
      setCurrentWorkflow(location.state.workflow);
      if (location.state?.viewMode) setViewMode(location.state.viewMode);
      const newUrl = location.search ? `${location.pathname}${location.search}` : location.pathname;
      navigate(newUrl, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname, location.search, selectedWorkflow, isNavigatingBack]);

  // When URL has workflow id but no selection: only set stub if we have no state.workflow (e.g. refresh).
  // When we have state.workflow we must not set stub — state effect will set selectedWorkflow with real flow_id, so tabs get one flowId and call API once (not twice with id then flow_id).
  useEffect(() => {
    if (isNavigatingBack) return;
    if (workflowName && !selectedWorkflow && !location.state?.workflow) {
      const stub = { id: workflowName, flow_id: workflowName, workflow_id: workflowName } as any;
      setSelectedWorkflow(stub);
      setCurrentWorkflow(stub);
    } else if (!workflowName && selectedWorkflow) {
      setSelectedWorkflow(null);
      setCurrentWorkflow(null);
      useFlowStore.getState().setOutputNode(null);
    }
  }, [workflowName, isNavigatingBack, location.state?.workflow]);

  // When URL has workflow id but flow_id is still a stub, fetch full workflow for Analytics/dashboard APIs.
  useEffect(() => {
    if (isNavigatingBack || !workflowName) return;
    if (!selectedWorkflow || !workflowMatchesRouteId(selectedWorkflow, workflowName)) return;
    if (isReconWorkflowFlowIdResolved(selectedWorkflow, workflowName)) return;

    let cancelled = false;
    setIsLoadingWorkflow(true);
    getWorkflowByIdApi({ id: workflowName })
      .then((res) => {
        if (!cancelled && res) {
          setSelectedWorkflow(res);
          setCurrentWorkflow(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch workflow'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkflow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowName, selectedWorkflow, isNavigatingBack, setCurrentWorkflow]);

  const handleWorkflowSelect = (workflow: any) => {
    setIsLoadingWorkflow(false);
    setSelectedWorkflow(workflow);
    const selectedFlowId = workflow?.id ?? workflow?.workflow_id ?? workflow?.flow_id;
    if (selectedFlowId) {
      navigate(`/reconciliation/operations/${selectedFlowId}?tab=summary&view=recontab`, {
        replace: false,
        state: { workflow, viewMode: "recontab" },
      });
    }
  };

  // If no workflow is selected and no workflowName in URL, show the workflows list
  // This happens when at /reconciliation route (without workflowName param)
  if (!selectedWorkflow && !workflowName) {
    return (
      <>
        {isLoadingWorkflow && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">Loading workflow...</p>
            </div>
          </div>
        )}
        <div className="h-screen overflow-auto">
          <div className="flex justify-end p-0">
            <Button
              variant="ghost"
              size="icon"
              className="!h-8 !w-8 hover:bg-primary/10"
              onClick={() => {
                setIsLoadingWorkflow(true);
                void queryClient.invalidateQueries({ queryKey: ['projects'] });
                void queryClient.refetchQueries({ queryKey: ['projects'] });
                navigate(location.pathname + location.search, { replace: true });
                setTimeout(() => setIsLoadingWorkflow(false), 500);
              }}
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          <WorkflowExecutionWrapper
            onWorkflowSelect={handleWorkflowSelect}
            onLoadingChange={setIsLoadingWorkflow}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="flex flex-col h-screen bg-background overflow-hidden pr-2 pl-1">
        {/* Process Title Section */}
        {viewMode !== 'recontab' && (
          <div className="bg-background shrink-0 border-b sticky top-0 z-10">
            <div className="flex items-center justify-between gap-2">
              {workflowHeaderContent}
              {selectedWorkflow ? (
                <div className="flex shrink-0 items-center gap-2">
                  <ShadTooltip content="Refresh current tab" side="bottom">
                    <Button
                      variant="outline"
                      size="icon"
                      className="!h-8 !w-8 shrink-0 border-primary/30 hover:bg-primary/10"
                      onClick={handleRefreshCurrentView}
                      disabled={tabLoading}
                    >
                      <RefreshCw className={`h-4 w-4 text-primary ${tabLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </ShadTooltip>
                  {viewModeToggle}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden !p-0">
          {/* Main Content Area */}
          <main className="flex-1 overflow-hidden bg-background ">
            <div className="flex h-full min-h-0 flex-col">
              {viewMode === 'recontab' ? (
                // Render Recontab view - navigate to reconciliation route but stay in view
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {isLoadingWorkflow || !isWorkflowFlowIdReady ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading workflow...</p>
                      </div>
                    </div>
                  ) : selectedWorkflow && (pathId || workflowName) ? (
                    <RecontabEmbeddedWrapper
                      workflow={selectedWorkflow}
                      workflowId={pathId || workflowName}
                      headerContent={workflowHeaderContent}
                      viewModeToggle={viewModeToggle}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading workflow...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Render Action Center view (existing sidebar-based content)
                <>
                  {tabLoading ? (
                    <div className="flex items-center justify-center h-full ">
                      <div className="flex flex-col items-center gap-3 ">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </div>
                  ) : activeRightSidebar === 'summary' ? (
                    <div key={`summary-${activeRightSidebar}-${refreshKey}`} className="flex-1 overflow-hidden pr-2">
                      {flowId ? (
                        <SummaryTable flowId={flowId} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading workflow Summary...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeRightSidebar === 'analytics' ? (
                    <div key={`analytics-${activeRightSidebar}-${refreshKey}`} className="flex min-h-0 flex-1 flex-col overflow-hidden pr-0">
                      {flowId ? (
                        <Analytics flowId={flowId} workflowName={pathId} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading workflow Analytics...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeRightSidebar === 'reports' ? (
                    <div key={`reports-${activeRightSidebar}-${refreshKey}`} className="flex-1 overflow-hidden pr-3">
                      {flowId ? (
                        <ReportDownloaderPage workflowId={flowId} workflow={selectedWorkflow} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading workflow Reports...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  // ) : activeRightSidebar === 'action-center' ? (
                  //   <div key={`action-center-${activeRightSidebar}-${refreshKey}`} className="flex-1 overflow-hidden !pr-3">
                  //     <Actions />
                  //   </div>
                  ) : activeRightSidebar === 'jobs' ? (
                    <div key={`jobs-${activeRightSidebar}-${refreshKey}`} className="flex min-h-0 flex-1 flex-col overflow-hidden pr-3">
                      {flowId ? (
                        <HistoryPage flowName={flowId} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading workflow Jobs...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeRightSidebar === 'operations' ? (
                    <div key={`operations-${activeRightSidebar}-${refreshKey}`} className="flex-1 overflow-hidden pr-3">
                      {flowId ? (
                        <OperationsTab workflowId={flowId} selectedWorkflow={selectedWorkflow} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading workflow Operations...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                    : null
                  }
                </>
              )}
            </div>
          </main>

          {/* Right Sidebar - Hide when Recontab view is active */}
          {viewMode !== 'recontab' && (
            <aside className="w-12 border-l bg-background shrink-0 flex flex-col items-center py-1 gap-0">
              <ShadTooltip content="Summary" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'summary'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-1.5'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={() => {
                    if (activeRightSidebar === 'summary') return; // Already on summary, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Always set to summary when clicked - stay in same view
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'summary');
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('summary');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <BarChart2 className="h-5 w-5 !text-primary" strokeWidth={activeRightSidebar === 'summary' ? 2.5 : 2} />
                </Button>
              </ShadTooltip>

              <ShadTooltip content="Operations" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'operations'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-1.5'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeRightSidebar === 'operations') return; // Already on operations, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Update URL params without full navigation - stay in same view
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'operations');
                    // Use replace: true to avoid adding to history and stay in same view
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('operations');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <SlidersHorizontal
                    className="h-5 w-5 !text-primary"
                    strokeWidth={activeRightSidebar === "operations" ? 2.5 : 2}
                  />
                </Button>
              </ShadTooltip>

              <ShadTooltip content="Analytics" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'analytics'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-0'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={() => {
                    if (activeRightSidebar === 'analytics') return; // Already on analytics, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Always set to analytics when clicked
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'analytics');
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('analytics');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <TbBrandGoogleAnalytics className={`h-5 w-5 !text-primary ${activeRightSidebar === 'analytics' ? 'font-bold' : ''}`} />
                </Button>
              </ShadTooltip>

              <ShadTooltip content="Reports" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'reports'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-1.5'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={() => {
                    if (activeRightSidebar === 'reports') return; // Already on reports, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Always set to reports when clicked
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'reports');
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('reports');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <DownloadIcon className="h-5 w-5 !text-primary" strokeWidth={activeRightSidebar === 'reports' ? 2.5 : 2} />
                </Button>
              </ShadTooltip>

              {/* <ShadTooltip content="Action centre" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'action-center'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-1.5'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={() => {
                    if (activeRightSidebar === 'action-center') return; // Already on action-center, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Always set to action-center when clicked
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'action-center');
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('action-center');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <SquareKanban className="h-5 w-5 !text-primary" strokeWidth={activeRightSidebar === 'action-center' ? 2.5 : 2} />
                </Button>
              </ShadTooltip> */}

              <ShadTooltip content="Jobs" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`!h-8 !w-8 !text-primary ${activeRightSidebar === 'jobs'
                      ? '!border !border-primary !bg-primary/10 hover:!bg-primary/20 hover:!text-primary p-1.5'
                      : 'hover:!border-primary hover:!bg-primary/10 hover:!text-primary'
                    }`}
                  onClick={() => {
                    if (activeRightSidebar === 'jobs') return; // Already on jobs, no need to switch
                    setTabLoading(true);
                    setRefreshKey((prev) => prev + 1);
                    // Always set to jobs when clicked
                    const currentSearch = new URLSearchParams(location.search);
                    currentSearch.set('sidebar', 'jobs');
                    const newUrl = pathId || workflowName
                      ? `/reconciliation/operations/${pathId || workflowName}?${currentSearch.toString()}`
                      : `/reconciliation/operations?${currentSearch.toString()}`;
                    navigate(newUrl, { replace: true });
                    setActiveRightSidebar('jobs');
                    setTimeout(() => setTabLoading(false), 100);
                  }}
                >
                  <ClipboardCheck className="h-5 w-5 !text-primary" strokeWidth={activeRightSidebar === 'jobs' ? 2.5 : 2} />
                </Button>
              </ShadTooltip>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

"use client";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2, Layers, Download, FileText, List, CheckCircle, GitBranch, FileTerminal } from "lucide-react";
import FlowPage from "@/pages/FlowPage";
import HistoryPage from "../historydata/history";
import ReportDownloaderPage from "../Reconcilationtab/Report";
import useFlowStore from "@/stores/flowStore";
import { getWorkflowByIdApi } from "@/controllers/API";
import DashboardPage from "../basepage/dashboard";
import ShadTooltip from "@/components/ui/shadTooltipComponent";

export default function WorkflowDetails() {
  const { id: workflowIdParam, tab: tabParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(location.state?.workflow ?? null);
  const [loading, setLoading] = useState(!workflow); 
  const [tabLoading, setTabLoading] = useState(false);
  const initialTab = location.pathname.split("/").pop() ;
  const [activeTab, setActiveTab] = useState(initialTab);
  const initialMode = useMemo(() => location.state?.mode || "view", []);
  const [refreshKey, setRefreshKey] = useState(0);

  // Tabs data
  const tabsData = useMemo(
    () => [
      { id: "basepage", label: "Basepage",icon: FileTerminal,component: (props: any) => <DashboardPage workflow_id={props.workflowId} />},
      { id: "datalineage", label: "Data Lineage",icon: GitBranch, component: FlowPage, props: { mode: initialMode } },
      { id: "validation", label: "Validation",icon:CheckCircle },
      { id: "dashboard", label: "Dashboard",icon: FileText },
      {
        id: "report",
        label: "Reports",
        icon: Download,
        component: (props: any) => (
          <ReportDownloaderPage workflowId={props.flowId || props.workflowId} workflow={props.workflow} />
        ),
      },
      {id: "jobs",label: "Jobs",icon: List,component: (props: any) => <HistoryPage flowName={props.flowId} />},
      
    ],
    [initialMode]
  );

  const flowStore = useFlowStore();
useEffect(() => {
    // If we already have a workflow (e.g. passed via location.state), don't refetch.
    if (workflow) {
      flowStore.setCurrentWorkflow(workflow);
      setLoading(false);
      return;
    }

    // No workflow in state: fetch from API (only when workflowIdParam exists)
    if (!workflowIdParam) return;

    let cancelled = false;
    const fetchWorkflow = async () => {
      setLoading(true);
      try {
        const res = await getWorkflowByIdApi({ id: workflowIdParam });
        if (cancelled) return;
        setWorkflow(res);
        flowStore.setCurrentWorkflow(res);
      } catch (err) {
        console.error("Failed to fetch workflow:", err);
        if (!cancelled) navigate("/reconciliation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkflow();
    return () => {
      cancelled = true;
    };
  }, [workflowIdParam, workflow,]);

  // Update active tab on route change
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setTabLoading(true);
    setActiveTab(tabId);
    if (workflowIdParam) {
      navigate(`/data-validation/${workflowIdParam}/${tabId}`, {
        replace: true,
        state: { workflow, mode: initialMode },
      });
    }
    setTimeout(() => setTabLoading(false), 300);
  };

  // Refresh button handler
  const handleRefresh = () => {
    setTabLoading(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setTabLoading(false), 300);
  };

  const currentTab = useMemo(
    () => tabsData.find((t) => t.id === activeTab),
    [tabsData, activeTab]
  );
  const TabComponent = currentTab?.component;

  const componentProps = useMemo(
    () => ({
      workflow,
      workflowId: workflow?.workflow_id,
      flowId: workflow?.flow_id,
      ...(currentTab?.props || {}),
    }),
    [workflow, currentTab],
  );

  if (loading && !workflow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workflow details...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return <div className="p-6 text-red-500">Workflow not found.</div>;
  }

  return (
    <div className="p-0 w-full">
       <div className="relative w-full flex justify-between">
       <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/data-validation")}
          aria-label="Go back"
          disabled={tabLoading}
          className="!h-5 !p-0 !mt-1 !border-none "
        >
          <ArrowLeft className="!h-5 !w-8 !text-black" />
          {/* <span>Back </span> */}
        </Button>
        <ShadTooltip content={workflow.name} side="bottom">
          <span className="text-l font-normal max-w-[9rem] overflow-hidden text-ellipsis pl-0 pr-2"> {workflow.name}</span>
        </ShadTooltip>
        
        <div className="flex flex-1 gap-2 m-0 ">
            {tabsData.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={tabLoading}
                  aria-pressed={isActive}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border !h-7 
                    ${isActive ? "bg-primary text-white shadow border-blue-700" : "bg-transparent text-blue-600 hover:bg-gray-100 border-blue-600 hover:border-blue-700"      
                    }`}                  
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="active-tab-bg"
                      className="sr-only"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end  gap-2 ml-3">
          <Button
          variant="outline"
          size="icon"
          className="h-7 w-8"
          onClick={handleRefresh}
          disabled={tabLoading}
          title="Refresh current tab"
        >
          <RefreshCw className={`h-4 w-4 ${tabLoading ? "animate-spin" : ""}`} />
        </Button>
        </div>
        </div>
          
       
        {/* Content */}
        <div className="">
          <Card className="py-1 border-none shadow-none">
            <CardContent className="px-0">
              {tabLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading {currentTab?.label}...</p>
                  </div>
                </div>
              ) : TabComponent ? (
                <TabComponent
                  key={`${activeTab}-${refreshKey}`}
                  {...componentProps}
                />
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  {currentTab?.label} content not available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
    
  );
}
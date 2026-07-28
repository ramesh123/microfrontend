"use client";

import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2, Layers, BarChart2, FileText, Download, List, GitBranchPlus, GitBranch, GitFork, Settings, ClipboardCheckIcon, SlidersHorizontal, Sparkles } from "lucide-react";

import FlowPage from "@/pages/FlowPage";
import ReportDownloaderPage from "./Report";
import { SummaryTable } from "./Summary";
import HistoryPage from "../historydata/history";
import { getWorkflowByIdApi } from "@/controllers/API";
import useFlowStore from "@/stores/flowStore";
import Nodeoperationoutput from "./Nodeoperationoutput";
import { ReconSummary, clearReconSummaryCache } from "./recon_summary";
import Actions from "../action-center/actions";
import ShadTooltip from "@/components/common/shadTooltipComponent";

export default function WorkflowDetails() {
  
  const { id: workflowIdParam, tab: tabParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [workflow, setWorkflow] = useState(location.state?.workflow ?? null);
  const [loading, setLoading] = useState(!workflow); 
  const [tabLoading, setTabLoading] = useState(false);
  const initialTab = location.pathname.split("/").pop();
  const [activeTab, setActiveTab] = useState(initialTab);
  const initialMode = useMemo(() => location.state?.mode || "view", []);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    return () => {
      clearReconSummaryCache();
    };
  }, []);
  
  type TabItem = {
    id: string;
    label: string;
    icon: any;
    component?: any;
    props?: Record<string, any>;
  };
  
  const tabsData: TabItem[] = useMemo(
    () => [
      { id: "summary", label: "Summary", icon: BarChart2, component: (props: any) => <SummaryTable flowId={props.flowId} /> },
      { id: "operations", label: "Operations", icon: SlidersHorizontal, component: (props: any) => <ReconSummary flowId={props.flowId} /> },
      { id: "dashboard", label: "Dashboard", icon: FileText },
      {
        id: "report",
        label: "Reports",
        icon: Download,
        component: (props: any) => (
          <ReportDownloaderPage workflowId={props.flowId || props.workflowId} workflow={props.workflow} />
        ),
      },
      { id: "action-center", label: "Action Center", icon: List, component: Actions },
      { id: "jobs", label: "Jobs", icon: ClipboardCheckIcon, component: (props: any) => <HistoryPage flowName={props.flowId} /> },
    ],
    [initialMode],
  );

  

  const flowStore = useFlowStore();
  useEffect(() => {
    // // If we already have a workflow (e.g. passed via location.state), don't refetch.
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
        flowStore.setOutputNode(res?.outputNode);  
        console.log("ubfnuinqwfcns f",res?.outputNode)
      

        } catch (err) {
        console.error("Failed to fetch workflow:", err);
        if (!cancelled) navigate("/reconciliation/operations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkflow();
    return () => {
      cancelled = true;
    };
  }, [workflowIdParam,]);

  // Keep activeTab in sync with URL changes (e.g., when clicking Process Flow button)
  useEffect(() => {
    const last = location.pathname.split("/").pop();
    if (last && last !== activeTab) {
      setActiveTab(last);
    }
  }, [location.pathname]);

  const handleTabChange = (tabId: string) => {
    setTabLoading(true);
    setActiveTab(tabId);
    if (workflowIdParam) {
      navigate(`/reconciliation/operations/${workflowIdParam}/${tabId}`, {
        replace: true,
        state: { workflow, mode:initialMode },
      });
    }
   
    setTimeout(() => setTabLoading(false), 300);
  };

  const handleRefresh = () => {
    setTabLoading(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setTabLoading(false), 300);
  };

  // Memoize current tab to prevent recalculation
  const currentTab = useMemo(() => tabsData.find((t) => t.id === activeTab), [tabsData, activeTab]);
  const isProcessFlow = activeTab === "processflow";
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


  return (
    <div className="p-0 w-full h-full overflow-y-auto ">
      <div className="relative w-full flex justify-between">
        {/* Header with button-style tabs */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/reconciliation/operations")}
              aria-label="Go back"
              disabled={tabLoading}
              className="!h-5 !p-0 !mt-1 !border-none"
            >
              <ArrowLeft className="!h-5 !w-8 !text-black" />
              {/* <span>Back </span> */}
          </Button>
          <ShadTooltip content={workflow.name} side="bottom">
          <span className="text-l font-normal max-w-[9rem] overflow-hidden text-ellipsis pl-0 pr-2"> {typeof workflow?.name === 'string' ? workflow.name.toLowerCase() : workflow?.name}</span>
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
            <ShadTooltip content="Process Flow">
                <Button
                variant="outline"
                className="h-7 w-7"
                size="icon"
                onClick={() =>
                  navigate(`/reconciliation/operations/${workflowIdParam}/processflow`, {
                    state: { workflow, mode: "view" },
                  })
                }
              >
                <GitBranch/>
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Output Node Operation">
            <Button variant="outline" className="h-7 w-7" size="icon" onClick={() => navigate(`/reconciliation/operations/${workflowIdParam}/operations/output`)}>
              <Settings/>
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
          </div>
          </div>

        {/* Content */}
        <div className="mt-1 py-1">
            <CardContent className="p-0">
              {tabLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading {currentTab?.label}...</p>
                  </div>
                </div>
              ) : isProcessFlow ? (
                <FlowPage />
              ) : TabComponent ? (
                <TabComponent key={`${activeTab}-${refreshKey}`} {...componentProps} />
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  {currentTab?.label || ""} content not available.
                </div>
              )}
            </CardContent>
        </div>
        
    
    </div>
  );
}
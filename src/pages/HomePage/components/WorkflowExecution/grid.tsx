import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from 'framer-motion';
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ShadTooltip from "@/components/ui/shadTooltipComponent";
import { Lock, MoreVertical, BarChart2, ClipboardCheck, CalendarClock, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
// Removed execute/delete/export related dialogs — actions moved to dropdown

interface WorkflowCardProps {
  workflow: any;
  isLoadingWorkflow?: boolean;
  // optional handler from parent to centralize loading/navigation
  onNavigateToSidebar?: (wf: any, sidebar: string) => void;
}

export function WorkflowCard({ workflow, isLoadingWorkflow = false, onNavigateToSidebar }: WorkflowCardProps) {
  // local fallback state is not used when parent provides centralized loading
  // keep for backward compatibility in case parent doesn't pass handlers
  const [, setDummy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Navigate immediately; destination page fetches workflow by id
  const handleNavigate = (
    wf: any,
    preferredTarget: "data-validation" | "reconciliation" | null = null
  ) => {
    const idParam = wf.id ?? wf.workflow_id ?? wf.flow_id;
    if (!idParam) return;
    const target =
      preferredTarget ??
      (location.pathname.includes("reconciliation")
        ? "reconciliation"
        : location.pathname.includes("data-validation")
        ? "data-validation"
        : "data-validation");

    if (target === "reconciliation") {
      navigate(`/reconciliation/operations/${idParam}?tab=summary&view=recontab`, {
        state: { workflow: wf, viewMode: "recontab" },
      });
    } else {
      navigate(`/${target}/${idParam}/basepage`, {
        state: { workflow: wf, viewMode: "view" },
      });
    }
  };

  const navigateToSidebar = (wf: any, sidebar: string) => {
    if (onNavigateToSidebar) {
      try {
        onNavigateToSidebar(wf, sidebar);
      } catch (err) {
        console.error(err);
        toast.error('Could not open workflow');
      }
      return;
    }

    const idParam = wf.id ?? wf.workflow_id ?? wf.flow_id;
    if (!idParam) return;
    const tab = sidebar === 'reports' ? 'report' : sidebar;
    navigate(`/reconciliation/operations/${idParam}?tab=${tab}&view=recontab`, {
      state: { workflow: wf, viewMode: "recontab" },
    });
  };

  // execute/export/delete functionality removed from this card; actions live in dropdown

  const titleCase = (s = "") => s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const businessProcessLabel = workflow?.business_process
    ? titleCase(String(workflow.business_process))
    : "—";
  const statementDateLabel = (() => {
    const d = workflow.statement_date;
    if (d == null || d === "") return "—";
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "—" : date.toISOString().split("T")[0];
  })();

  // matches parent `containerVariants`/`itemVariants` pattern: slide + fade with spring
  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 12 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.12 } },
  };

  return (
    <>
      {/* This child uses variants only so a parent container can control staggered entrance */}
      <motion.div variants={cardVariants} whileHover={{ scale: 1.02 }}>
        <Card onClick={() => handleNavigate(workflow)} className="py-3 gap-2 flex h-full cursor-pointer flex-col transition-transform bg-background border border-border rounded-lg shadow-sm hover:shadow-md hover:shadow-primary/20">
          <CardHeader className="px-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                
                <div className="min-w-0 ">
                  <ShadTooltip content={workflow.name || ""}>
                    <CardTitle className="text-l font-semibold truncate max-w-[12rem]">{titleCase(workflow?.name)}</CardTitle>
                  </ShadTooltip>
                  <ShadTooltip content={workflow.description || ""}>
                    <div className="text-sm text-muted-foreground truncate max-w-[12rem] mt-4 ">{workflow.description || ""}</div>
                  </ShadTooltip>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className={`!p-2 ${isLoadingWorkflow ? 'pointer-events-none opacity-60' : ''}`}>
                  <div className="grid grid-cols-1 gap-1 w-35">
                    <Button variant="ghost" size="sm" className="justify-start" disabled={isLoadingWorkflow} onClick={(e) => { e.stopPropagation(); navigateToSidebar(workflow, 'operations'); }}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" strokeWidth={2} />
                      Operations
                    </Button>

                    <Button variant="ghost" size="sm" className="justify-start" disabled={isLoadingWorkflow} onClick={(e) => { e.stopPropagation(); navigateToSidebar(workflow, 'jobs'); }}>
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Jobs
                    </Button>

                    <Button variant="ghost" size="sm" className="justify-start" disabled={isLoadingWorkflow} onClick={(e) => { e.stopPropagation(); navigateToSidebar(workflow, 'analytics'); }}>
                      <BarChart2 className="mr-2 h-4 w-4" />
                      Analytics
                    </Button>

                    <Button variant="ghost" size="sm" className="justify-start" disabled={isLoadingWorkflow} onClick={(e) => { e.stopPropagation(); navigate('/scheduler/create', { state: { flowId: workflow.id || workflow.workflow_id || workflow.flow_id, flowName: workflow.name }}); }}>
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Scheduler
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardFooter className="flex w-full items-center justify-between gap-2 px-3 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-center gap-1.5">
              {workflow.locked && <Lock className="h-3 w-3 shrink-0" />}
              <ShadTooltip content={businessProcessLabel}>
                <span className="max-w-[8rem] truncate text-xs">
                  {businessProcessLabel}
                </span>
              </ShadTooltip>
            </div>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-xs">
              {statementDateLabel}
            </span>
          </CardFooter>
        </Card>
      </motion.div>

      {isLoadingWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-[92%] md:w-96 bg-card border border-border rounded-md p-6 shadow-lg"
          >
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Loading Workflow...</h3>
              <p className="text-sm text-muted-foreground mb-4">Loading workflow and fetching all node data. This may take a moment.</p>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 10, ease: 'linear' }} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      
    </>
  );
}

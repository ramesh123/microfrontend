import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreateWorkflowForm } from "@/pages/HomePage/components/createWorkflowForm";
import useFlowStore from "@/stores/flowStore";
import { getProjectsNamesApi } from "@/controllers/API";
import { useRbacStore } from "@/stores/useRBACStore";

export function hasWorkflowDetails(workflow: any): boolean {
  if (!workflow) return false;
  const hasPerspectives = (workflow.perspective_ids && workflow.perspective_ids.length > 0) ||
    (workflow.workflow_type && workflow.workflow_type !== "");
  const hasProjects = !!(workflow.project && workflow.project.trim() !== "");
  const hasBusinessProcesses = !!(workflow.business_process && workflow.business_process.trim() !== "");
  return hasPerspectives && hasProjects && hasBusinessProcesses;
}

interface WorkflowDetailsSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAsDraft: (description: string) => void | Promise<void>;
  onRelease: () => void;
  onDetailsSubmit: (workflowUpdate: Record<string, any>) => void;
  isSavingDraft?: boolean;
  isReleasing?: boolean;
  virtualDbMode?: boolean;
}

export function WorkflowDetailsSaveDialog({
  open,
  onOpenChange,
  onSaveAsDraft,
  onRelease,
  onDetailsSubmit,
  isSavingDraft = false,
  isReleasing = false,
  virtualDbMode = false,
}: WorkflowDetailsSaveDialogProps) {
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const { availablePerspectives } = useRbacStore();
  const [projectIds, setProjectIds] = React.useState<(string | number)[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = React.useState(true);

  React.useEffect(() => {
    if (!currentWorkflow?.project || !open) {
      setProjectIds([]);
      setIsLoadingProjects(false);
      return;
    }

    const fetchProjectIds = async () => {
      try {
        const response = await getProjectsNamesApi();
        if (response.data && response.data.length > 0) {
          const projectNames = currentWorkflow.project
            .split(",")
            .map((name: string) => name.trim())
            .filter(Boolean);
          const matchingIds = response.data
            .filter((project: any) => projectNames.includes(project.name))
            .map((project: any) => project.id);
          setProjectIds(matchingIds);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjectIds();
  }, [currentWorkflow?.project, open]);

  const perspectiveNames: string[] = React.useMemo(() => {
    if (!currentWorkflow) return [];
    const names: string[] = [];

    if (currentWorkflow.perspective_ids && currentWorkflow.perspective_ids.length > 0) {
      const perspectiveIdsArray = Array.isArray(currentWorkflow.perspective_ids)
        ? currentWorkflow.perspective_ids
        : [currentWorkflow.perspective_ids];

      perspectiveIdsArray.forEach((id: any) => {
        const perspective = availablePerspectives.find(
          (p: any) => String(p.perspective_id || p.id) === String(id)
        );
        if (perspective?.name && !names.includes(perspective.name)) {
          names.push(perspective.name);
        }
      });
    }

    if (currentWorkflow.workflow_type && !names.includes(currentWorkflow.workflow_type)) {
      const isValidPerspective = availablePerspectives.some(
        (p: any) => p.name === currentWorkflow.workflow_type
      );
      if (isValidPerspective) {
        names.push(currentWorkflow.workflow_type);
      }
    }

    return names;
  }, [currentWorkflow?.perspective_ids, currentWorkflow?.workflow_type, availablePerspectives]);

  if (!currentWorkflow) return null;

  const businessProcessArray: (string | number)[] = currentWorkflow.business_process
    ? Array.isArray(currentWorkflow.business_process)
      ? currentWorkflow.business_process
      : currentWorkflow.business_process.split(",").map((bp: string) => bp.trim()).filter(Boolean)
    : [];

  const initialValues = {
    perspectives: perspectiveNames,
    projects: projectIds,
    businessProcesses: businessProcessArray,
    execution_engine: currentWorkflow.execution_engine ?? null,
    target_output: currentWorkflow.target_output ?? null,
    storage_engine: currentWorkflow.storage_engine ?? null,
    flowName: currentWorkflow.name || currentWorkflow.deployment_name || "",
    description: "",
    cycle_wise: currentWorkflow.cycle_wise ?? false,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-7xl flex flex-col p-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-lg font-semibold">
            Complete workflow details
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Fill in the details below before saving or releasing this workflow.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoadingProjects ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <CreateWorkflowForm
              key={`details-${projectIds.join(",")}`}
              initialValues={initialValues}
              isEditMode
              detailsOnlyMode
              onSaveAsDraft={onSaveAsDraft}
              onRelease={onRelease}
              onDetailsSubmit={onDetailsSubmit}
              isSavingDraft={isSavingDraft}
              isReleasing={isReleasing}
              virtualDbMode={virtualDbMode}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { CreateWorkflowForm } from '@/pages/HomePage/components/createWorkflowForm';
import useFlowStore from '@/stores/flowStore';
import { Button } from '@/components/ui/button';
import ForwardedIconComponent from '@/components/common/genericIconComponent';
import { toast } from 'sonner';
import { getProjectsNamesApi } from '@/controllers/API';

interface WorkflowInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowInfoSheet({ open, onOpenChange }: WorkflowInfoSheetProps) {
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const [isEditMode, setIsEditMode] = useState(false);
  const [projectIds, setProjectIds] = useState<(string | number)[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Fetch projects and convert project names to IDs
  useEffect(() => {
    if (!currentWorkflow?.project) {
      setProjectIds([]);
      setIsLoadingProjects(false);
      return;
    }

    const fetchProjectIds = async () => {
      try {
        const response = await getProjectsNamesApi();
        if (response.data && response.data.length > 0) {
          // Split the project names from the workflow
          const projectNames = currentWorkflow.project
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);

          // Find matching project IDs
          const matchingIds = response.data
            .filter((project: any) => projectNames.includes(project.name))
            .map((project: any) => project.id);

          setProjectIds(matchingIds);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjectIds();
  }, [currentWorkflow?.project]);

  // Reset edit mode when sheet closes
  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
    }
  }, [open]);

  if (!currentWorkflow) return null;

  // Convert business_process string to array if needed
  const businessProcessArray: (string | number)[] = currentWorkflow.business_process
    ? Array.isArray(currentWorkflow.business_process)
      ? currentWorkflow.business_process
      : currentWorkflow.business_process.split(',').map(bp => bp.trim()).filter(Boolean)
    : [];

  const initialValues = {
    perspective: currentWorkflow.workflow_type || '',
    projects: projectIds,
    businessProcesses: businessProcessArray,
    execution_engine: currentWorkflow.execution_engine ?? null,
    target_output: currentWorkflow.target_output ?? null,
    storage_engine: currentWorkflow.storage_engine ?? null,
    flowName: currentWorkflow.name || '',
    description: currentWorkflow.description || '',
    cycle_wise: currentWorkflow.cycle_wise ?? false,
  };

  const handleFormSubmit = () => {  
    toast.success('Workflow details updated successfully');
    setIsEditMode(false);
  };

  const handleCancel = () => {
    if (isEditMode) {
      setIsEditMode(false);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <div className="p-6 pt-10">
          <SheetHeader className="mb-6 p-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>Workflow Information</SheetTitle>
                <SheetDescription>
                  {isEditMode ? 'Edit workflow details below' : 'View workflow details'}
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditMode(!isEditMode)}
                className="h-8 w-8"
              >
                <ForwardedIconComponent
                  name={isEditMode ? "Eye" : "Pencil"}
                  className="h-4 w-4"
                />
              </Button>
            </div>
          </SheetHeader>

          <div className="pb-6">
            {!isLoadingProjects && (
              <CreateWorkflowForm
                key={`${isEditMode ? 'edit' : 'view'}-${projectIds.join(',')}`}
                initialValues={initialValues}
                isEditMode={isEditMode}
                onFormSubmit={handleFormSubmit}
                onCancel={handleCancel}
              />
            )}
            {isLoadingProjects && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

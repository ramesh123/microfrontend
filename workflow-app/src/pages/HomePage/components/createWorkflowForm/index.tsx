import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FileEdit, Loader2, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router';
import { useCreateNewWorkflow } from '@/hooks/use-add-flow';
import { useIdStore } from '@/stores/idStore';
import { track } from '@/customization/utils/analytics';
import { useEffect, useState, useMemo } from 'react';
import { useSaveWorkflow } from '@/hooks/use-save-flow';
import { useFlowsManagerStore } from '@/stores/flowManagerStore';
import { getProjectsNamesApi, getBusinessProcessApi } from '@/controllers/API';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRbacStore } from '@/stores/useRBACStore';
import { MultiSelectCombobox } from '@/components/ui/multi-select';
import { Combobox } from '@/components/ui/combobox';
import api from '@/controllers/API/api';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const createFormSchema = z.object({
  perspectives: z.string().min(1, {
    message: 'Please select a perspective.',
  }),

  projects: z.union([z.string(), z.number()])
    .refine(
      (val) =>
        val !== undefined &&
        val !== null &&
        String(val).trim() !== '',
      {
        message: 'Please select a project.',
      }
    ),

  businessProcesses: z.union([z.string(), z.number()])
    .refine(
      (val) =>
        val !== undefined &&
        val !== null &&
        String(val).trim() !== '',
      {
        message: 'Please select a business process.',
      }
    ),

   execution_engine: z.string().nullable().default(null),


  target_output: z.string().nullable().default(null),

  storage_engine: z.string().nullable().default(null),

  flowName: z.string().min(2, {
    message: 'Flow name must be at least 2 characters.',
  }),

  description: z.string()
    .min(1, {
      message: 'Description is required.',
    })
    .max(200, {
      message: 'Description must not be longer than 200 characters.',
    }),

  cycle_wise: z.boolean().default(false),
});
const editFormSchema = z.object({
  perspectives: z.string().min(1, {
    message: 'Please select a perspective.',
  }),
  projects: z.union([z.string(), z.number()]).optional(),
  businessProcesses: z.union([z.string(), z.number()]).optional(),
  execution_engine: z.string().nullable().default(null),
  target_output: z.string().nullable().default(null),
  storage_engine: z.string().nullable().default(null),
  flowName: z.string().min(2, {
    message: 'Flow name must be at least 2 characters.',
  }),
  description: z.string().max(200, {
    message: 'Description must not be longer than 200 characters.'
  }).optional(),
  cycle_wise: z.boolean().optional().default(false),
});

const formSchema = createFormSchema;

export type WorkflowDetailsFormValues = z.infer<typeof createFormSchema>;

type CreateWorkflowFormProps = {
  onFormSubmit?: () => void;
  initialValues?: any;
  isEditMode?: boolean;
  onCancel?: () => void;
  detailsOnlyMode?: boolean;
  onSaveAsDraft?: (description: string) => void | Promise<void>;
  onRelease?: () => void;
  onDetailsSubmit?: (workflowUpdate: Record<string, any>) => void;
  isSavingDraft?: boolean;
  isReleasing?: boolean;
  /** When true (Virtual DB workflow), hide Save as Draft and show "Release Virtual DB" */
  virtualDbMode?: boolean;
};

export function CreateWorkflowForm({ onFormSubmit, initialValues, isEditMode = false, onCancel, detailsOnlyMode = false, onSaveAsDraft, onRelease, onDetailsSubmit, isSavingDraft = false, isReleasing = false, virtualDbMode = false }: CreateWorkflowFormProps) {
  const { availablePerspectives } = useRbacStore();

  const normalizedInitialValues = useMemo(() => {
    if (!initialValues) return undefined;
    const perspectivesVal = initialValues.perspectives || (initialValues as any).perspective || "";
    return {
      ...initialValues,
      perspectives: Array.isArray(perspectivesVal)
        ? perspectivesVal[0] || ""
        : perspectivesVal || "",
      projects: Array.isArray(initialValues.projects)
        ? initialValues.projects[0] || ""
        : initialValues.projects || "",
      businessProcesses: Array.isArray(initialValues.businessProcesses)
        ? initialValues.businessProcesses[0] || ""
        : initialValues.businessProcesses || "",
    };
  }, [initialValues]);

  const schema = detailsOnlyMode ? createFormSchema : (initialValues ? editFormSchema : createFormSchema);
  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(schema),
    defaultValues: normalizedInitialValues || {
      perspectives: '',
      projects: '',
      businessProcesses: '',
      execution_engine: null,
      target_output: null,
      storage_engine: null,
      flowName: '',
      description: '',
      cycle_wise: false,
    },
  });

  useEffect(() => {
    if (normalizedInitialValues) {
      form.reset(normalizedInitialValues);
    }
  }, [normalizedInitialValues, form]);
  const navigate = useNavigate();
  const isViewMode = initialValues && !isEditMode;
  const { generateId } = useIdStore()
  const id = generateId()
  const { createAndLoadWorkflow, isCreating } = useCreateNewWorkflow();
  const [projectsOptions, setProjectsOptions] = useState<Array<{ value: string | number, label: string }>>([]);
  const [businessProcessOptions, setBusinessProcessOptions] = useState<Array<{ value: string | number, label: string }>>([]);
  const [projectsData, setProjectsData] = useState<Array<any>>([]);
  const [businessProcessData, setBusinessProcessData] = useState<Array<any>>([]);
  const [executionEngineOptions, setExecutionEngineOptions] = useState<string[]>([]);
  const [targetOutputOptions, setTargetOutputOptions] = useState<string[]>([]);
  const [storageEngineOptions, setStorageEngineOptions] = useState<string[]>([]);

  useEffect(() => {
    getProjectName()
    getBusinessProcesses()
    getFlowEngineOptions()
  }, []);

  const getProjectName = () => {
    const response = getProjectsNamesApi()
    response.then((res) => {
      console.log(res);
      if (res.data && res.data.length > 0) {

        setProjectsData(res.data); // Store the full project data
        const options = res.data.map((project: any) => ({
          value: project.id,
          label: project.name
        }));
        setProjectsOptions(options)
      } else {
        setProjectsData([]);
        setProjectsOptions([])
      }
    })
  }

  const getBusinessProcesses = () => {
    const response = getBusinessProcessApi()
    response.then((res) => {
      console.log(res);
      if (res.data && res.data.length > 0) {
        setBusinessProcessData(res.data); // Store the full business process data
        const options = res.data.map((bp: any) => ({
          value: bp.business_process_name,
          label: bp.business_process_name
        }));
        setBusinessProcessOptions(options)
      } else {
        setBusinessProcessData([]);
        setBusinessProcessOptions([])
      }
    })
  }

  const getFlowEngineOptions = async () => {
    try {
      const response = await api.post('/flow-builder/get-flow-engine', {});
      // console.log('Flow engine options:', response.data);
      if (response.data?.status && response.data?.data) {
        const { storage_engine, execution_engine, target_output } = response.data.data;
        setStorageEngineOptions(storage_engine || []);
        setExecutionEngineOptions(execution_engine || []);
        setTargetOutputOptions(target_output || []);
      }
    } catch (error) {
      console.error('Failed to fetch flow engine options:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load engine options'));
    }
  }

  const buildWorkflowFromFormValues = (values: z.infer<typeof formSchema>) => {
    const selectedProjects = projectsData.filter((p: any) => String(p.id) === String(values.projects));
    const orgIds: string[] = [];
    const projectNames: string[] = [];
    selectedProjects.forEach((project: any) => {
      if (project.org_id) {
        if (Array.isArray(project.org_id)) orgIds.push(...project.org_id);
        else orgIds.push(String(project.org_id));
      }
      if (project.name) projectNames.push(project.name);
    });
    const uniqueOrgIds = [...new Set(orgIds)];
    const selectedBusinessProcesses = businessProcessData.filter((bp: any) =>
      String(bp.business_process_name) === String(values.businessProcesses)
    );
    const processIds = selectedBusinessProcesses.map((bp: any) => bp.process_id).filter(Boolean);
    const processIdString = processIds.join(', ');
    const selectedPerspectives = availablePerspectives.filter((p: any) => String(p.name) === String(values.perspectives));
    const perspectiveIds = selectedPerspectives.map((p: any) => String(p.perspective_id || p.id)).filter(Boolean);
    return {
      org_id: uniqueOrgIds,
      project: projectNames.join(', '),
      business_process: values.businessProcesses ? String(values.businessProcesses) : '',
      process_id: processIdString,
      execution_engine: values.execution_engine,
      target_output: values.target_output,
      storage_engine: values.storage_engine,
      description: values.description || '',
      cycle_wise: values.cycle_wise,
      perspective_ids: perspectiveIds,
      workflow_type: values.perspectives || '',
    };
  };

  const handleDetailsSaveAsDraft = async (draftDescription: string) => {
    const valid = await form.trigger();
    if (!valid || !onDetailsSubmit || !onSaveAsDraft) return;
    const values = form.getValues() as WorkflowDetailsFormValues;
    const workflowUpdate = buildWorkflowFromFormValues(values);
    onDetailsSubmit(workflowUpdate);
    await onSaveAsDraft(draftDescription);
  };

  const handleDetailsRelease = async () => {
    const valid = await form.trigger();
    if (!valid || !onDetailsSubmit || !onRelease) return;
    const values = form.getValues() as WorkflowDetailsFormValues;
    const workflowUpdate = buildWorkflowFromFormValues(values);
    onDetailsSubmit(workflowUpdate);
    onRelease();
  };


  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('Form values submitted:', values);
    console.log('cycle_wise value:', values.cycle_wise);

    // Extract org_ids from selected projects
    const selectedProjects = projectsData.filter(p => String(p.id) === String(values.projects));
    const orgIds: string[] = [];
    const projectNames: string[] = [];

    selectedProjects.forEach(project => {
      if (project.org_id) {
        if (Array.isArray(project.org_id)) {
          orgIds.push(...project.org_id);
        } else {
          orgIds.push(String(project.org_id));
        }
      }
      if (project.name) {
        projectNames.push(project.name);
      }
    });

    // Remove duplicates
    const uniqueOrgIds = [...new Set(orgIds)];

    // Extract process_ids from selected business processes
    const selectedBusinessProcesses = businessProcessData.filter(bp =>
      String(bp.business_process_name) === String(values.businessProcesses)
    );
    const processIds: string[] = selectedBusinessProcesses
      .map(bp => bp.process_id)
      .filter(Boolean); // Filter out any undefined/null values

    // Join multiple process IDs with comma (same as business_process)
    const processIdString = processIds.join(', ');

    // Extract perspective IDs from selected perspectives
    const selectedPerspectives = availablePerspectives.filter((p: any) =>
      String(p.name) === String(values.perspectives)
    );
    const perspectiveIds: string[] = selectedPerspectives
      .map((p: any) => String(p.perspective_id || p.id))
      .filter(Boolean); // Filter out any undefined/null values

    const workflowParams = {
      type: values.perspectives || '', // Use selected perspective as primary type
      name: values.flowName, // Pass flowName for internal name
      deploymentName: values.flowName, // Pass flowName for deployment_name
      description: values.description || '',
      org_id: uniqueOrgIds,
      project: projectNames.join(', '), // Pass selected project names
      businessProcesses: values.businessProcesses ? [String(values.businessProcesses)] : [], // Pass selected business process names as array
      process_id: processIdString, // Pass selected process IDs as comma-separated string
      execution_engine: values.execution_engine,
      target_output: values.target_output,
      storage_engine: values.storage_engine,
      cycle_wise: values.cycle_wise,
      perspective_ids: perspectiveIds, // Pass selected perspective IDs
    };

    console.log('Creating workflow with params:', workflowParams);

    await createAndLoadWorkflow(
      workflowParams,
      (flowId: string) => {
        // Navigate to the workflow page with the flow_id from API response
        if (onFormSubmit) onFormSubmit();
        navigate(`/workflows/${flowId}`);
      }
    );
  };
  return (
    <Form {...form}>
      <form onSubmit={detailsOnlyMode ? (e) => e.preventDefault() : form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">

          {!detailsOnlyMode && (
            <FormField
              control={form.control}
              name="flowName"
              render={({ field }) => (
                <FormItem>
                <FormLabel>
                  Flow Name <span className="text-destructive">*</span>
                </FormLabel>   
                <FormControl>
                    <Input
                      placeholder="e.g., NewUserValidation"
                      {...field}
                      disabled={isViewMode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[\s-]/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {detailsOnlyMode && (
            <FormField
              control={form.control}
              name="flowName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flow Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., NewUserValidation" {...field} disabled readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="perspectives"
            render={({ field }) => (
              <FormItem>
              <FormLabel>
                Perspectives <span className="text-destructive">*</span>
              </FormLabel>    
            <FormControl>
                  <Combobox
                    options={availablePerspectives.map((perspective: any) => ({
                      value: perspective.name,
                      label: perspective.name
                    }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select perspective..."
                    searchPlaceholder="Search perspectives..."
                    emptyText="No perspectives found."
                    disabled={isViewMode}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="projects"
            render={({ field }) => (
              <FormItem>
              <FormLabel>
                Projects <span className="text-destructive">*</span>
              </FormLabel>
                <FormControl>
                  <Combobox
                    options={projectsOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select project..."
                    searchPlaceholder="Search projects..."
                    emptyText="No projects found."
                    disabled={isViewMode}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="businessProcesses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Business Processes <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={businessProcessOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select business process..."
                    searchPlaceholder="Search business processes..."
                    emptyText="No business processes found."
                    disabled={isViewMode}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* <FormField
                control={form.control}
                name="execution_engine"
                render={({ field }) => (  // render
                  <FormItem>
                    <FormLabel>Execution Engine</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className="w-full border-input hover:bg-accent hover:text-accent-foreground">
                          <SelectValue placeholder="Select execution engine" />
                        </SelectTrigger>
                        <SelectContent>
                          {executionEngineOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
          {/* <FormField
                control={form.control}
                name="target_output"
                render={({ field }) => (  
                  <FormItem>
                    <FormLabel>Target Output</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className="w-full border-input hover:bg-accent hover:text-accent-foreground">
                          <SelectValue placeholder="Select target output" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetOutputOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
          {/* <FormField
                control={form.control}
                name="storage_engine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Engine</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className="w-full border-input hover:bg-accent hover:text-accent-foreground">
                          <SelectValue placeholder="Select storage engine" />
                        </SelectTrigger>
                        <SelectContent>
                          {storageEngineOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
          <FormField
            control={form.control}
            name="cycle_wise"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cycle Wise</FormLabel>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      console.log('Checkbox changed to:', checked);
                      field.onChange(checked);
                    }}
                    disabled={isViewMode}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Description <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide a brief description of this workflow."
                  className="resize-none"
                  {...field}
                  disabled={isViewMode}
                />
              </FormControl>
              <FormDescription>
                You can add more details about the purpose of this workflow.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {detailsOnlyMode ? (
      <div className="space-y-4 pt-4">
          <div className="flex justify-end gap-2">
            <Button
              className="flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              onClick={handleDetailsRelease}
              disabled={isSavingDraft || isReleasing}
            >
              {isReleasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              <span>
                {isReleasing
                  ? 'Releasing...'
                  : virtualDbMode
                  ? 'Release Virtual DB'
                  : 'Release Workflow'}
              </span>
            </Button>

            {!virtualDbMode && (
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                onClick={() => handleDetailsSaveAsDraft('')}
                disabled={isSavingDraft || isReleasing}
              >
                {isSavingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileEdit className="h-4 w-4" />
                )}
                <span>
                  {isSavingDraft ? 'Saving...' : 'Save as Draft'}
                </span>
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isSavingDraft || isReleasing}
            >
              Cancel
            </Button>
          </div>
        </div>
        ) : (isEditMode || !initialValues) && (
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel || (() => navigate('/workflows'))}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : isEditMode ? 'Save Changes' : 'Create Workflow'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}

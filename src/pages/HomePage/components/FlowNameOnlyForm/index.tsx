import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCreateNewWorkflow } from '@/hooks/use-add-flow';
import { useRbacStore } from '@/stores/useRBACStore';

const flowNameSchema = z.object({
  flowName: z.string().min(2, {
    message: 'Flow name must be at least 2 characters.',
  }),
  virtualdb: z.boolean().optional(),
});

type FlowNameFormValues = z.infer<typeof flowNameSchema>;

export interface FlowNameOnlyFormProps {
  /** When true, Virtual DB checkbox is checked by default (e.g. when opening from Virtual DB screen). */
  defaultVirtualDb?: boolean;
  /** Submit button label. Default "Create Workflow". Use "Create Virtual DB" in Virtual DB flow. */
  submitButtonLabel?: string;
  /** When provided, Cancel button calls this instead of navigating to /workflows (e.g. close dialog). */
  onCancel?: () => void;
}

export function FlowNameOnlyForm({ defaultVirtualDb = false, submitButtonLabel = 'Create Workflow', onCancel }: FlowNameOnlyFormProps = {}) {
  const form = useForm<FlowNameFormValues>({
    resolver: zodResolver(flowNameSchema),
    defaultValues: { flowName: '', virtualdb: defaultVirtualDb },
  });
  const navigate = useNavigate();
  const { currentUser, currentOrganization } = useRbacStore();
  const { createAndLoadWorkflow, isCreating } = useCreateNewWorkflow();

  const handleSubmit = async (values: FlowNameFormValues) => {
    const flowName = values.flowName.replace(/[\s-]/g, '');
    const virtualdbMode = values.virtualdb ?? false;

    await createAndLoadWorkflow(
      {
        name: flowName,
        deploymentName: flowName,
        description: '',
        type: 'Data_Validation',
        org_id: currentUser?.organizationIds ?? [],
        project: '',
        businessProcesses: [],
        process_id: '',
        execution_engine: null,
        target_output: null,
        storage_engine: null,
        cycle_wise: false,
        perspective_ids: currentOrganization?.perspectiveIds ?? currentUser?.organizationIds ?? [],
        virtualdb_mode: virtualdbMode,
        workflow_origin: 'Manual',
      },
      (flowId: string) => {
        navigate(`/workflows/${flowId}${virtualdbMode ? '?virtualdb=1' : ''}`, {
          state: { openAiChat: false },
        });
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="flowName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Flow Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., NewUserValidation"
                  {...field}
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
        <FormField
          control={form.control}
          name="virtualdb"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <Checkbox
                id="virtualdb"
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <Label htmlFor="virtualdb">Create as Virtual DB</Label>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : navigate('/workflows'))}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : submitButtonLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

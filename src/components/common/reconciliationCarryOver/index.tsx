import { useForm } from 'react-hook-form';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import cloneDeep from 'lodash/cloneDeep';
import { Loader2 } from 'lucide-react';
import useFlowStore from '@/stores/flowStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import { getNodeOutputData } from '@/utils/nodeDataUtils';
import { FetchAPIParams } from '@/types/form';
import ReconciliationCarryOverTable from './reconciliationCarryOverTable';

interface Option {
  label: string;
  value: string | number;
}

interface TemplateField {
  key: string;
  type: string;
  position: number;
  required?: boolean;
  description?: string;
  placeholder?: string;
  display_name: string;
  options?: Option[];
  value?: string;
  default?: boolean | string | number;
}

interface NodeDetailsData {
  id: string;
  data: {
    node: {
      template: Record<string, TemplateField>;
      payload: Record<string, any>;
      save_node: Record<string, any>;
    };
    // flow_id is intentionally not used from here, we use the store instead.
  };
}

interface ReconciliationCarryOverProps {
  nodeDetailsData: NodeDetailsData;
  onSave: (formData: Record<string, any>) => void;
  onCancel: () => void;
  flowId: string;
  mode?: "view" | "edit";
}

const ReconciliationCarryOver = ({
  nodeDetailsData,
  onSave,
  onCancel,
  flowId,
  mode = "edit", // default
}: ReconciliationCarryOverProps) => {
  const workflowNodes = useFlowStore((state) => state.currentWorkflow?.data?.nodes);
  const edges = useFlowStore((state) => state.currentWorkflow?.data?.edges);

  /** Immediate predecessor(s) of this node — same data as after execution wiring. */
  const directParentNodes = useMemo(() => {
    const id = nodeDetailsData.id;
    if (!id || !edges?.length || !workflowNodes?.length) return [];
    const parentIds = edges.filter((e) => e.target === id).map((e) => e.source);
    return parentIds
      .map((pid) => workflowNodes.find((n) => n.id === pid))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [nodeDetailsData.id, edges, workflowNodes]);

  const [isSaving, setIsSaving] = useState(false);
  const [upstreamResponse, setUpstreamResponse] = useState<{ 
    status: boolean; 
    message: string; 
    data: any[] | { data: any[] } 
  } | null>(null);
  const [isLoadingUpstream, setIsLoadingUpstream] = useState(false);

  useEffect(() => {
    const fetchUpstreamData = async () => {
      if (directParentNodes.length > 0) {
        setIsLoadingUpstream(true);
        try {
          const firstParent = directParentNodes[0];
          const data = await getNodeOutputData(firstParent as any, flowId);
          setUpstreamResponse({
            status: true,
            message: 'Success',
            data: data || []
          });
        } catch (error) {
          console.error("Failed to fetch upstream data for ReconciliationCarryOver:", error);
        } finally {
          setIsLoadingUpstream(false);
        }
      }
    };

    fetchUpstreamData();
  }, [directParentNodes, flowId]);

  const template = nodeDetailsData.data.node.template;

  const templateFields = useMemo(() =>
    Object.values(template).sort((a, b) => (a.position || 0) - (b.position || 0)),
    [template]
  );

  const formSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    templateFields.forEach((field) => {
      let fieldSchema: z.ZodTypeAny;

      // Handle different field types
      if (field.type === 'switch' || field.type === 'checkbox') {
        fieldSchema = z.boolean();
      } else {
        fieldSchema = z.string().optional();
        if (field.required) {
          fieldSchema = z.string().min(1, `${field.display_name} is required`);
        }
      }

      schemaFields[field.key] = fieldSchema;
    });
    return z.object(schemaFields);
  }, [templateFields]);

  type FormData = z.infer<typeof formSchema>;

  const defaultValues = useMemo(() => {
    const initialValues: Record<string, any> = {};
    const savedPayload = nodeDetailsData.data.node.payload;

    templateFields.forEach(field => {
        const savedValue = savedPayload[field.key];
        const isPlaceholderValue = typeof savedValue === 'string' && savedValue.startsWith('{{') && savedValue.endsWith('}}');

        if (field.type === 'switch' || field.type === 'checkbox') {
          // Handle boolean fields
          if (typeof savedValue === 'boolean') {
            initialValues[field.key] = savedValue;
          } else if (field.default !== undefined) {
            initialValues[field.key] = field.default;
          } else {
            initialValues[field.key] = false;
          }
        } else {
          // Handle string fields
          if (savedValue && !isPlaceholderValue) {
              initialValues[field.key] = savedValue;
          } else {
              initialValues[field.key] = field.value || '';
          }
        }
    });

    return initialValues;
  }, [templateFields, nodeDetailsData.data.node.payload]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onChange',
  });

  // No need for watch or dynamic options since template only has enable switch

  const handleFormSubmit = async (data: FormData) => {
    setIsSaving(true);
    const { save_node } = nodeDetailsData.data.node;

    if (!save_node?.enabled) {
      toast.error("Save is not enabled for this node.");
      setIsSaving(false);
      return;
    }

    const finalPayload = cloneDeep(nodeDetailsData.data);
    const payloadTemplate = finalPayload.node.payload;

    // Use the flow_id from props
    const flowIdFromProps = flowId;
    console.log(`Submitting with flow_id from props: "${flowIdFromProps}"`);

    // Update payload with form data
    Object.assign(payloadTemplate, data);

    // Set output_format to json and custom_filters to empty string
    payloadTemplate.output_format = 'json';
    payloadTemplate.custom_filters = '';

    // Build records from upstream node output after execution (hydrates via unique_id when inline data is absent)
    if (data.enable && directParentNodes.length === 0) {
      toast.warning('Connect an upstream node and run it so output data is available for carryover.');
      payloadTemplate.records = {};
    }

    if (data.enable && directParentNodes.length > 0) {
      const records: Record<string, unknown[]> = {};

      for (const parentNode of directParentNodes) {
        const sourceName =
          (parentNode.data as any)?.node?.payload?.table ||
          (parentNode.data as any)?.display_name ||
          parentNode.id;

        const sourceData = await getNodeOutputData(parentNode as any, flowIdFromProps);
        records[sourceName] = sourceData;
      }

      const firstParent = directParentNodes[0];
      const firstName =
        (firstParent.data as any)?.node?.payload?.table ||
        (firstParent.data as any)?.display_name ||
        firstParent.id;

      payloadTemplate.source_name = firstName;
      payloadTemplate.records = records;

      const firstKey = Object.keys(records)[0];
      const firstRows = firstKey ? records[firstKey] : [];
      if (Array.isArray(firstRows) && firstRows.length > 0 && firstRows[0] && typeof firstRows[0] === 'object') {
        payloadTemplate.columns = Object.keys(firstRows[0] as object);
      } else {
        const out = (firstParent.data as any)?.node?.output;
        if (Array.isArray(out?.columns) && out.columns.length > 0) {
          payloadTemplate.columns = out.columns;
        }
      }
    }

    // Ensure flow_id is correctly set in the payload
    if (payloadTemplate.hasOwnProperty('flow_id')) {
        payloadTemplate.flow_id = flowIdFromProps;
    }

    // Set the root-level flow_id for the API
    (finalPayload as any).flow_id = flowIdFromProps;

    finalPayload.node.payload = payloadTemplate;
    (finalPayload as any).current_node_id = nodeDetailsData.id;

    try {
        const response =   await saveNodeDetailsApi(save_node as FetchAPIParams, finalPayload);
        const merged =
          response && typeof response === "object"
            ? { ...response, saved_node: true as const }
            : { saved_node: true as const };
        useFlowStore.getState().updateNodeDataPreserveLabel(nodeDetailsData.id, merged);
        toast.success("Configuration saved successfully!");
        onSave(data);
    } catch (error) {
        const errorMessage = getDisplayErrorMessage(error, "An unknown error occurred.");
        toast.error(`Failed to save: ${errorMessage}`);
    } finally {
        setIsSaving(false);
    }
  };

  const renderField = (field: TemplateField) => {
    const fieldKey = field.key as keyof FormData;

    switch (field.type) {
      case 'switch':
        return (
          <FormField
            key={field.key}
            control={form.control}
            name={fieldKey}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    {field.display_name}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                  {field.description && (
                    <div className="text-sm text-muted-foreground">
                      {field.description}
                    </div>
                  )}
                </div>
                <FormControl>
                  <Switch
                    checked={formField.value as boolean}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        );
      case 'select': {
        const options = field.options || [];
        const hasOptions = options.length > 0;

        return (
          <FormField
            key={field.key}
            control={form.control}
            name={fieldKey}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.display_name}{field.required && <span className="text-red-500 ml-1">*</span>}</FormLabel>
                <Select onValueChange={formField.onChange} value={formField.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="w-[var(--radix-select-trigger-width)]">
                    {hasOptions ? (
                      options.map((option: Option) => (
                        <SelectItem key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No options available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      }
      case 'text':
      case 'input':
      default:
        return (
          <FormField
            key={field.key}
            control={form.control}
            name={fieldKey}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.display_name}{field.required && <span className="text-red-500 ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Input placeholder={field.placeholder} {...formField} value={formField.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <div className="w-full bg-background text-foreground p-0">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
            {templateFields.map((field) => renderField(field))}
          </div>

          {isLoadingUpstream && (
            <div className="flex flex-col items-center justify-center p-12 gap-2 border-t mt-8">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <span className="text-sm text-muted-foreground">Loading upstream data...</span>
            </div>
          )}

          {!isLoadingUpstream && upstreamResponse && (
            <div className="mt-2 pt-2 h-[400px] w-full">
              <ReconciliationCarryOverTable response={upstreamResponse} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || mode === "view"} className='disabled:cursor-not-allowed'
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ReconciliationCarryOver;

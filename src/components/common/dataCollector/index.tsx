import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import cloneDeep from 'lodash/cloneDeep';
import { Loader2 } from 'lucide-react';
import useFlowStore from '@/stores/flowStore';
import { fetchDatabaseConnections } from '@/controllers/API/apiService';
import { saveNodeDetailsApi } from '@/controllers/API';
import { FetchAPIParams } from '@/types/form';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';


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

interface DataCollectorProps {
  nodeDetailsData: NodeDetailsData;
  onSave: (formData: Record<string, any>) => void;
  onCancel: () => void;
  flowId: string;
  mode?: "view" | "edit";
}

const DataCollector = ({
  nodeDetailsData,
  onSave,
  onCancel,
  flowId,
  mode = "edit", // default

}: DataCollectorProps) => {
  // Get the active flow_id from the central store
  // const { nodes, setNodes } = useFlowStore();
  const nodes = useFlowStore.getState().currentWorkflow.data.nodes;
  const selectedNode = useFlowStore.getState().getSelectedNode();
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Option[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [errorFields, setErrorFields] = useState<Record<string, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);

  const databaseFetchInitiated = useRef(false);

  const template = nodeDetailsData.data.node.template;

  const templateFields = useMemo(() =>
    Object.values(template).sort((a, b) => (a.position || 0) - (b.position || 0)),
    [template]
  );
  const formSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    templateFields.forEach((field) => {
      let fieldSchema: z.ZodTypeAny = z.string().optional();
      if (field.required) {
        fieldSchema = z.string().min(1, `${field.display_name} is required`);
      }
      schemaFields[field.key] = fieldSchema;
    });
    return z.object(schemaFields);
  }, [templateFields]);

  type FormData = z.infer<typeof formSchema>;

  // Updated defaultValues logic for form initialization
  const defaultValues = useMemo(() => {
    const initialValues: Record<string, string> = {};
    const savedPayload = nodeDetailsData.data.node.payload;
    templateFields.forEach(field => {
      const savedValue = savedPayload[field.key];
      const isPlaceholderValue = typeof savedValue === 'string' && savedValue.startsWith('{{') && savedValue.endsWith('}}');

      if (savedValue && !isPlaceholderValue) {
        initialValues[field.key] = savedValue;
      } else {
        // Special handling for records field - check if dataframe exists
        if (field.key === 'records' && savedPayload.dataframe) {
          try {
            // Use the dataframe content for records
            initialValues[field.key] = savedPayload.dataframe;
          } catch (error) {
            initialValues[field.key] = field.value || '';
          }
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

  const { watch, setValue } = form;
  const sourceTypeValue = watch('source_type');

  const fetchDatabases = useCallback(async () => {
    setLoadingFields(prev => ({ ...prev, databases: true }));
    setErrorFields(prev => ({ ...prev, databases: null }));
    try {
      const options = await fetchDatabaseConnections();
      setDynamicOptions(prev => ({ ...prev, databases: options }));
    } catch (error) {
      setErrorFields(prev => ({
        ...prev,
        databases: getDisplayErrorMessage(error, 'Failed to load databases'),
      }));
    } finally {
      setLoadingFields(prev => ({ ...prev, databases: false }));
    }
  }, []);

  useEffect(() => {
    if (sourceTypeValue === 'db' && !databaseFetchInitiated.current) {
      databaseFetchInitiated.current = true;
      fetchDatabases();
    } else if (sourceTypeValue !== 'db') {
      setValue('databases', '');
      databaseFetchInitiated.current = false;
    }
  }, [sourceTypeValue, setValue, fetchDatabases]);

  // Updated form submission handler
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

    // Get flow_id from store first, fallback to props (same pattern as NodeDetailsPage)
    const activeFlowId = useFlowStore.getState().currentWorkflow?.flow_id || flowId;

    // Update payload with form data
    Object.assign(payloadTemplate, data);

    // CRITICAL: Transform dataframe to records and clear dataframe
    if (payloadTemplate.records) {
      // Move dataframe content to records
      payloadTemplate.records = payloadTemplate.dataframe;

      // Clear the dataframe field to prevent it from being sent
      // delete payloadTemplate.dataframe;
    }

    // Ensure flow_id is correctly set in the payload
    if (payloadTemplate.hasOwnProperty('flow_id')) {
      payloadTemplate.flow_id = activeFlowId;

    }

    // Set the root-level flow_id for the API
    (finalPayload as any).flow_id = activeFlowId;

    finalPayload.node.payload = payloadTemplate;
    (finalPayload as any).current_node_id = nodeDetailsData.id;

    try {
      const response = await saveNodeDetailsApi(save_node as FetchAPIParams, finalPayload);

      const updatedNodes = nodes.map((node) =>
        node.id === response?.current_node_id
          ? { ...node, data: response }
          : node
      );

      useFlowStore.getState().updateNodeData(selectedNode?.id, response);
      // setNodes(updatedNodes);

      toast.success("Configuration saved successfully!");
      onSave(data);
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to save configuration'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: TemplateField) => {
    const fieldKey = field.key as keyof FormData;

    switch (field.type) {
      case 'select': {
        const isLoading = loadingFields[field.key];
        const error = errorFields[field.key];
        const options = dynamicOptions[field.key] || field.options || [];
        const hasOptions = options.length > 0;
        let isDisabled = isLoading || !!error;

        if (field.key === 'databases') {
          isDisabled = sourceTypeValue !== 'db' || isLoading || !!error;
        }

        return (
          <FormField
            key={field.key}
            control={form.control}
            name={fieldKey}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.display_name}{field.required && <span className="text-red-500 ml-1">*</span>}</FormLabel>
                <Select onValueChange={formField.onChange} value={formField.value || ''} disabled={isDisabled}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoading ? "Loading..." : error ? "Error" : field.placeholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="w-[var(--radix-select-trigger-width)]">
                    {hasOptions ? (
                      options.map((option) => (
                        <SelectItem key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {isLoading ? "Loading..." : "No options available"}
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
    <div className="w-full bg-background text-foreground p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {templateFields.map((field) => renderField(field))}
            </div>
          </div>

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

export default DataCollector;
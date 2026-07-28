import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DynamicForm from '@/components/common/dynamicForm';
import {
  getSchedulerTemplate,
  getSchedulerById,
  addScheduler,
  updateScheduler
} from '@/controllers/API/schedulerApi';
import { transformSchedulerTemplate, transformToBackendPayload } from '@/utils/schedulerFormUtils';
import { FormSchema } from '@/types/form';
import { fetchDynamicOptions } from '@/controllers/API/apiService';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';

const SchedulerPage: React.FC = () => {  
  const navigate = useNavigate();
  const location = useLocation();
  const { schedulerId: schedulerIdParam } = useParams<{ schedulerId?: string }>();
  const { flowId, flowName, schedulerId: schedulerIdState, returnPath } = location.state || {};
  const schedulerId = schedulerIdState ?? schedulerIdParam;

  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [payloadTemplate, setPayloadTemplate] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialFormData, setInitialFormData] = useState<Record<string, any> | null>(null);

  useEffect(() => {   
    loadSchedulerTemplate();
  }, []);

  useEffect(() => {  
    // Load existing scheduler if editing
    if (schedulerId && formSchema) {   
      loadExistingScheduler();
    } else if (!schedulerId && flowId && flowName && formSchema) {  
      // Pre-populate workflow when creating new scheduler from a specific flow
      // Note: We only set the flowId value, the multi-select will handle the label from fetched options
      setInitialFormData({
        workflow: [flowId.toString()],
      });
    }
  }, [schedulerId, flowId, flowName, formSchema]);

 
  const toArrayValue = (raw: unknown): (string | number)[] => {
    if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'object' && item != null && 'value' in item ? (item as { value: string | number }).value : item));
    if (raw == null || raw === '') return [];
    return [raw as string | number];
  };

  const loadExistingScheduler = async () => {  
    try { 
      const existing = await getSchedulerById(schedulerId);
      // Transform backend data to form format
      const formData: Record<string, any> = {  
        name: existing.name || '',
        // Transform workflow from [{label, value}] to [value] for the form
        workflow: toArrayValue(existing.workflow),
        scan_type: existing.scan_type || '',
        statement_date: existing.statement_date || '',
        scheduler: existing.scheduler || '',
        notification_email: toArrayValue(existing.notification_email),
        active: existing.is_active !== false,
      };

      // Handle scheduler-specific fields from settings
      const settings = existing.settings || {};

      // Time field (for daily, days_in_a_month, yearly)
      if (settings.time) {  
        formData.time = settings.time;
      }

      // Hourly field
      if (settings.hourly) { 
        formData.hourly = settings.hourly.toString();
      }

      // Weekly field
      if (settings.weekly) { 
        formData.weekly = settings.weekly;
      }

      // Week days field
      if (settings.week_days) {
        formData.week_days = toArrayValue(settings.week_days);
      }

      // Days field
      if (settings.days) {
        formData.days = toArrayValue(settings.days);
      }

      // Months field
      if (settings.months) {
        formData.months = toArrayValue(settings.months);
      }

      setInitialFormData(formData);
    } catch (error) {
      console.error('Failed to load scheduler:', error);
      if (!(error instanceof ApiRequestError && error.status_code === 404)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to load scheduler details'));
      }
    }
  };

  const loadSchedulerTemplate = async () => { 
    try {
      setIsLoading(true);
      const response = await getSchedulerTemplate();

      // Transform backend template to DynamicForm schema
      const schema = transformSchedulerTemplate(response.template);
      schema.suppressSuccessToast = true;
      schema.submitButtonText = schedulerId ? 'Update Scheduler' : 'Create Scheduler';
      setFormSchema(schema);
      setPayloadTemplate(response.payload ?? {});
    } catch (error) {
      console.error('Failed to load scheduler template:', error);
      if (!(error instanceof ApiRequestError && error.status_code === 404)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to load scheduler configuration'));
      }
    } finally {  
      setIsLoading(false);
    }
  };

  const normalizeMultiValue = (raw: unknown): (string | number)[] => {
    if (Array.isArray(raw)) {
      return raw.map((item) =>
        typeof item === 'object' && item != null && 'value' in item
          ? (item as { value: string | number }).value
          : item
      );
    }
    if (raw == null || raw === '') return [];
    return [raw as string | number];
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Transform form data to backend payload format
      const payload = transformToBackendPayload(formData, payloadTemplate);

      if (formData.active !== undefined && payload.is_active === undefined) {
        payload.is_active = Boolean(formData.active);
      }
      if (formData.notification_email !== undefined) {
        payload.notification_email = normalizeMultiValue(formData.notification_email);
      }

      // Fallback: ensure core fields are sent even if payload template omits them
      (['name', 'scan_type', 'statement_date', 'scheduler'] as const).forEach((key) => {
        const value = formData[key];
        if (
          (payload[key] === undefined || payload[key] === '') &&
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          payload[key] = value;
        }
      });

      // Transform workflow array from ["20290"] to [{label: "...", value: "20290"}]
      if (formData.workflow && Array.isArray(formData.workflow)) {  
        // Get the workflow field from schema to fetch its options
        const workflowField = formSchema?.fields.find(f => f.key === 'workflow');

        if (workflowField?.fetch) {  
          try { 
            // Fetch workflow options to get labels
            const options = await fetchDynamicOptions(workflowField.fetch, {});
            // Transform workflow values to {label, value} objects
            payload.workflow = formData.workflow.map((workflowValue: string) => {  
              const option = options.find(opt => String(opt.value) === String(workflowValue));
              return {
                label: option?.label || workflowValue,
                value: workflowValue
              };
            });
          } catch (error) {  
            console.error('Failed to fetch workflow options:', error);
            // Fallback: use value as both label and value
            payload.workflow = formData.workflow.map((workflowValue: string) => ({
              label: workflowValue,
              value: workflowValue
            }));
          }
        } else {   
          // No fetch config - use flowId from state or form data
          const workflowIds = flowId ? [flowId] : formData.workflow;
          payload.workflow = workflowIds.map((workflowValue: string) => ({ 
            label: flowName || workflowValue,
            value: workflowValue
          }));
        }
      } else if (flowId) { 
        // Use flowId from state when coming from a specific flow
        payload.workflow = [{  
          label: flowName || flowId,
          value: flowId
        }];
      }

      if (schedulerId) {
        await updateScheduler(schedulerId.toString(), payload);
        toast.success('Scheduler updated successfully');
      } else {
        await addScheduler(payload);
        toast.success('Scheduler created successfully');
      }

      if (returnPath) {
        navigate(returnPath, { replace: false });
      } else if (!schedulerId) {
        navigate('/settings/schedulers', { replace: false });
      } else {
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to save scheduler:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to save scheduler'));
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {  
    return (  
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading scheduler configuration...</p>
        </div>
      </div>
    );
  }

  if (!formSchema) {  
    return (  
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No scheduler configuration available</p>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  return (  
    <div className="min-h-screen bg-background">
      <div className="container mx-auto  px-0 py-3 max-w-7xl">
     {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          
          <div className="flex items-center gap-3">
            <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (returnPath) {
                navigate(returnPath, { replace: false });
              } else {
                navigate(-1);
              }
            }}
            aria-label="Go back"
            className="h-[1.7rem] w-[1.7rem]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
            <h1 className="text-base font-bold">
              {schedulerId ? 'Edit Scheduler' : 'Add Scheduler'}
            </h1>
            {flowName && (
              <>
                <span className="text-muted-foreground">•</span>
                <p className="text-xs text-muted-foreground">Flow: {flowName}</p>
              </>
            )}
          </div>
          
        </div>

        {/* Form Content */}
        <Card className="py-2 gap-3">
          <CardHeader className="px-3">
            <CardTitle className="text-sm">Scheduler Configuration</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0">
            <DynamicForm
              schema={formSchema}
              onSubmit={handleFormSubmit}
              initialData={initialFormData}
              isEditing={!!schedulerId}
              isDataSetNode={false}
              gridColumns={2}
              skipClientValidation
            />
            {isSaving && (
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Saving scheduler…
              </p>
            )}
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
};

export default SchedulerPage;

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import api from '@/controllers/API/api';
import CredDynamicForm from '@/pages/CredVaultPage/CredForm';
import { emptyStringsToNullDeep } from '@/utils/emptyStringsToNullDeep';
import { resolveConnectionVaultActionsKlass } from '@/utils/sapNodeActions';
import {
  ApiRequestError,
  executeApiRequest,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';
import { fetchConnectionFormSchema } from '@/controllers/API/connectionVaultApi';

interface FormSchema {
  id: number;
  form_id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  group: string;
  enabled: boolean;
  fields: any[];
  save_connection: {
    name: string;
    klass: string;
    module: string;
    params: Record<string, any>;
  };
}

interface CredCreateModalProps {
  sourceFormId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CredCreateModal: React.FC<CredCreateModalProps> = ({
  sourceFormId,
  onSuccess,
  onCancel,
}) => {
  const [connectorFormSchema, setConnectorFormSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<Record<string, boolean>>({});
  const [testConnectionSuccess, setTestConnectionSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stableInitialData = useMemo(() => ({}), []);

  useEffect(() => {
    if (sourceFormId) {
      fetchFormSchema(sourceFormId);
    } else {
      setLoading(false);
      setConnectorFormSchema(null);
    }
  }, [sourceFormId]);

  const fetchFormSchema = async (formId: string) => {
    try {
      setLoading(true);
      const schema = await fetchConnectionFormSchema(formId);
      if (schema) {
        setConnectorFormSchema(schema as FormSchema);
      } else {
        setConnectorFormSchema(null);
        toast.error('Failed to load form schema');
      }
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        console.error('Error fetching form schema:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to load form schema'));
      }
      setConnectorFormSchema(null);
    } finally {
      setLoading(false);
    }
  };

  const processFormDataWithParams = (
    formData: Record<string, any>,
    paramsSchema: Record<string, any>
  ) => {
    const replaceTemplates = (currentSchemaValue: any): any => {
      if (typeof currentSchemaValue === 'string') {
        const pureTemplateMatch = currentSchemaValue.match(/^\{\{([^}]+)\}\}$/);
        if (pureTemplateMatch) {
          const fieldName = pureTemplateMatch[1];
          return formData.hasOwnProperty(fieldName) ? formData[fieldName] : undefined;
        } else {
          return currentSchemaValue.replace(/\{\{([^}]+)\}\}/g, (_match, fieldName) => {
            const value = formData[fieldName];
            if (value === null || value === undefined) {
              return '';
            }
            return String(value);
          });
        }
      } else if (Array.isArray(currentSchemaValue)) {
        return currentSchemaValue.map(replaceTemplates);
      } else if (typeof currentSchemaValue === 'object' && currentSchemaValue !== null) {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(currentSchemaValue)) {
          result[key] = replaceTemplates(value);
        }
        return result;
      }
      return currentSchemaValue;
    };

    return emptyStringsToNullDeep(replaceTemplates(paramsSchema));
  };

  const handleCustomAction = async (actionField: any, formData: Record<string, any>) => {
    const { name: actionName, fetch: actionConfig } = actionField;
    if (!actionConfig || !actionConfig.klass || !actionConfig.module || !actionConfig.params) {
      toast.error('Action configuration is invalid.');
      return;
    }

    setIsActionLoading((prev) => ({ ...prev, [actionName]: true }));
    try {
      const { module, klass, params, method } = actionConfig;
      const processedPayload = processFormDataWithParams(formData, params);
      const httpMethod = (method || 'POST').toUpperCase();
      const connectionType =
        formData.connection_type ??
        sourceFormId ??
        connectorFormSchema?.form_id ??
        '';
      const resolvedKlass = resolveConnectionVaultActionsKlass(klass, connectionType);
      const url = `/${module}/${resolvedKlass}`;

      const result = await executeApiRequest(
        () =>
          httpMethod === 'GET'
            ? api.get(url, { params: processedPayload })
            : api.post(url, processedPayload),
        'Action failed.',
      );

      toast.success(result.message || 'Action completed successfully!');
      if (actionName.toLowerCase().includes('test')) {
        setTestConnectionSuccess(true);
      }
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        console.error(`Error performing action '${actionName}':`, error);
        toast.error(getDisplayErrorMessage(error, 'An error occurred while performing the action.'));
      }
      if (actionName.toLowerCase().includes('test')) {
        setTestConnectionSuccess(false);
      }
    } finally {
      setIsActionLoading((prev) => ({ ...prev, [actionName]: false }));
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!connectorFormSchema) return;

    try {
      setIsSubmitting(true);
      const { save_connection } = connectorFormSchema;
      const apiUrl = `/${save_connection.module}/${save_connection.klass}`;
      const processedData = processFormDataWithParams(formData, save_connection.params);

      await executeApiRequest(
        () => api.post(apiUrl, processedData),
        'Failed to create connection',
      );

      toast.success('Connection created successfully');
      setTestConnectionSuccess(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        console.error('Error creating connection:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to create connection'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <div className="text-gray-900 font-medium">Loading form...</div>
            <div className="text-gray-500 text-sm">Preparing connection form</div>
          </div>
        </div>
      </div>
    );
  }

  if (!connectorFormSchema) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load form</h3>
          <p className="text-gray-600 mb-4">Unable to load the connection form</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px]">
      <CredDynamicForm
        formSchema={connectorFormSchema}
        onSubmit={handleFormSubmit}
        onCancel={handleCancel}
        initialData={stableInitialData}
        layout={3}
        submitButtonText="Create Connection"
        onCustomAction={handleCustomAction}
        isActionLoading={isActionLoading}
        testConnectionSuccess={testConnectionSuccess}
        onTestConnectionSuccess={setTestConnectionSuccess}
      />
    </div>
  );
};

export default CredCreateModal;

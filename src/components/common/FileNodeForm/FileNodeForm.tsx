import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField as UIFormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { FormSchema, FormSubmissionData, FormField, FormFieldOption } from '@/types/form';
import { cn } from '@/lib/utils';
import { MultiSelectCombobox } from '@/components/ui/multi-select';
import {
  fetchDynamicOptions,
  getFieldDependencies,
  isExcelActionsFetchConfig,
  saveFormData,
  shouldSkipExcelActionsTriggerForChangedField,
  uploadFileApi,
} from '@/controllers/API/apiService';
import MonacoEditor from '@/components/core/monacoEditor';
import BaseModal from '@/modals/baseModal';
import { AlternativeSelect } from '@/components/ui/alternative-select';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';
import {
  fieldSupportsInlineCreateTable,
  isTableNameFieldKey,
} from '@/utils/formFieldUtils';
import InputUpload from '@/components/core/inputUpload';
import MasterDataUploadPage from '@/pages/MasterDataPage';
import { useMasterDataStore } from '@/pages/MasterDataPage/constants';
import CredCreateModal from '@/components/common/CredCreateModal';

interface FileNodeFormProps {
  schema: FormSchema;
  onSubmit: (data: FormSubmissionData) => void;
  className?: string;
  initialData?: FormSubmissionData | null;
  isEditing?: boolean;
  mode?: 'view' | 'edit';
}

export const FileNodeForm: React.FC<FileNodeFormProps> = ({ schema, onSubmit, className, initialData, isEditing, mode='edit' }) => {

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, FormFieldOption[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [isAddConnectionDialogOpen, setAddConnectionDialogOpen] = useState(false);
  const [connectionField, setConnectionField] = useState<FormField | null>(null);
  const previousWatchedValuesRef = useRef<FormSubmissionData>({});
  const hasFetchedInitialRef = useRef(false);
  // Track upload responses per field key to support multiple upload fields
  const [uploadResponsesMap, setUploadResponsesMap] = useState<Record<string, any>>({});
  const { openUploadDialog, closeUploadDialog, isUploadDialogOpen } = useMasterDataStore();
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize upload response data from initialData if available
  React.useEffect(() => {
    if (initialData) {
      const responsesMap: Record<string, any> = {};

      // Handle standard upload_file response data
      if (initialData.file_name) {
        const isTemplate = typeof initialData.file_name === 'string' && initialData.file_name.match(/^{{.*}}$/);
        if (!isTemplate) {
          responsesMap['upload_file'] = {
            encrypted_file_key: initialData.encrypted_file_key,
            file_name: initialData.file_name,
            unique_id: initialData.unique_id,
            size: initialData.size,
          };
        }
      }

      // Handle structure_file response data (for fixed format nodes)
      if (initialData.structure_file_id) {
        const isTemplate = typeof initialData.structure_file_id === 'string' && initialData.structure_file_id.match(/^{{.*}}$/);
        if (!isTemplate) {
          responsesMap['structure_file_id'] = {
            structure_file: initialData.structure_file,
            structure_file_id: initialData.structure_file_id,
          };
        }
      }

      if (Object.keys(responsesMap).length > 0) {
        setUploadResponsesMap(responsesMap);
      }
    }
  }, [initialData]);

  const sortedFields = useMemo(() => schema.fields.sort((a, b) => a.position - b.position), [schema.fields]);

  const generateValidationSchema = (fields: FormField[], currentValues: FormSubmissionData) => {
    const schemaObject: { [key: string]: z.ZodTypeAny } = {};

    fields.forEach((field) => {
      // Check if field is visible based on dependencies
      const isFieldVisible = checkFieldDependencies(field, currentValues);

      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case 'email':
          fieldSchema = z.string().email({ message: 'Invalid email address' });
          break;
        case 'number':
          let numSchema = z.coerce.number();
          if (field.validation?.min !== undefined) numSchema = numSchema.min(field.validation.min);
          if (field.validation?.max !== undefined) numSchema = numSchema.max(field.validation.max);
          fieldSchema = numSchema;
          break;
        case 'checkbox':
          fieldSchema = z.boolean();
          break;
        case 'multi-select-combobox':
          fieldSchema = z.array(z.any());
          break;
        case 'combobox':
        case 'upload': // Upload field can be any type, we handle it separately
          fieldSchema = z.any();
          break;
        default:
          fieldSchema = z.string();
      }

      // Only apply required validation if the field is visible
      if (field.required && isFieldVisible) {
        fieldSchema = fieldSchema.refine(val => {
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === 'boolean') return val === true;
          if (typeof val === 'number') return true;
          return !!val;
        }, {
          message: `${field.display_name} is required`,
        });
      } else if (!isFieldVisible) {
        // For hidden fields, make them optional
        fieldSchema = fieldSchema.optional();
      }

      schemaObject[field.key] = fieldSchema;
    });
    return z.object(schemaObject);
  };

  const defaultFormValues = useMemo(() => {
    return sortedFields.reduce((acc, field) => {
      let defaultValue = field.value ?? (field.type === 'checkbox' ? false : field.type === 'multi-select-combobox' ? [] : field.type === 'number' ? 0 : '');

      // Clean template placeholders from default values
      if (typeof defaultValue === 'string' && defaultValue.match(/^{{.*}}$/)) {
        defaultValue = field.type === 'number' ? 0 : '';
      }

      acc[field.key] = defaultValue;
      return acc;
    }, {} as FormSubmissionData);
  }, [sortedFields]);

  // Clean template placeholders from initialData if provided
  const cleanedInitialData = useMemo(() => {
    if (!initialData) return null;

    const cleaned: FormSubmissionData = {};
    Object.keys(initialData).forEach((key) => {
      const value = initialData[key];
      // Clean template placeholders
      if (typeof value === 'string' && value.match(/^{{.*}}$/)) {
        cleaned[key] = '';
      } else {
        cleaned[key] = value;
      }
    });

    // extract values from remote_input_fields or local_input_fields
    // remote_input_fields[0] -> local_input_fields[0]
    const remoteFields = initialData.remote_input_fields;
    const localFields = initialData.local_input_fields;

    if (Array.isArray(remoteFields) && remoteFields.length > 0 && remoteFields[0]) {
      const firstRemote = remoteFields[0];

      // Map remote_source_path to sftp_source_path
      if (firstRemote.remote_source_path !== undefined) {
        cleaned.sftp_source_path = firstRemote.remote_source_path;
      }

      // Map remote_file_pattern to file_pattern
      if (firstRemote.remote_file_pattern !== undefined) {
        cleaned.file_pattern = firstRemote.remote_file_pattern;
      }

      // Map remote_process_path if needed
      if (firstRemote.remote_process_path !== undefined) {
        cleaned.remote_process_path = firstRemote.remote_process_path;
      }

      // Map remote_sheet_name to sheet_name
      if (firstRemote.remote_sheet_name !== undefined) {
        cleaned.sheet_name = firstRemote.remote_sheet_name;
      }
    } else if (Array.isArray(localFields) && localFields.length > 0 && localFields[0]) {
      const firstLocal = localFields[0];

      // Map local_source_path to sftp_source_path (fallback)
      if (firstLocal.local_source_path !== undefined) {
        cleaned.sftp_source_path = firstLocal.local_source_path;
      }

      // Map local_file_pattern to file_pattern (fallback)
      if (firstLocal.local_file_pattern !== undefined) {
        cleaned.file_pattern = firstLocal.local_file_pattern;
      }

      // Map local_process_path if needed
      if (firstLocal.local_process_path !== undefined) {
        cleaned.remote_process_path = firstLocal.local_process_path;
      }

      // Map local_sheet_name to sheet_name
      if (firstLocal.local_sheet_name !== undefined) {
        cleaned.sheet_name = firstLocal.local_sheet_name;
      }
    }

    // Also map root-level remote_sheet_name or local_sheet_name if sheet_name is empty
    if (!cleaned.sheet_name) {
      if (initialData.remote_sheet_name !== undefined) {
        cleaned.sheet_name = initialData.remote_sheet_name;
      } else if (initialData.local_sheet_name !== undefined) {
        cleaned.sheet_name = initialData.local_sheet_name;
      }
    }

    return cleaned;
  }, [initialData]);

  const dynamicResolver = async (values: FormSubmissionData) => {  // Type cast to any for zodResolver // resolver: zodResolver(schema) //
    const schema = generateValidationSchema(sortedFields, values);
    const resolver = zodResolver(schema);
    return resolver(values, undefined as any, { shouldUseNativeValidation: false, fields: {} });
  };

  // Merge cleanedInitialData with defaultFormValues to ensure number fields get 0
  const mergedFormValues = useMemo(() => {
    const merged = { ...defaultFormValues };
    if (cleanedInitialData) {
      Object.keys(cleanedInitialData).forEach((key) => {
        const val = cleanedInitialData[key];
        // If it's not empty, not a template placeholder, use it; otherwise let default be
        const isTemplate = typeof val === 'string' && val.match(/^{{.*}}$/);
        if (!isTemplate && val !== '' && val !== undefined && val !== null) {
          merged[key] = val;
        }
      });
    }
    // Explicitly check for number fields and set to 0 if still not set
    sortedFields.forEach((field) => {
      if (field.type === 'number' && (merged[field.key] === '' || merged[field.key] === undefined || merged[field.key] === null)) {
        merged[field.key] = 0;
      }
    });
    return merged;
  }, [cleanedInitialData, defaultFormValues, sortedFields]);

  const form = useForm<FormSubmissionData>({ 
    resolver: dynamicResolver as any,
    defaultValues: mergedFormValues
  });

  // Reset form when initialData changes (e.g., after save/update)
  useEffect(() => {
    form.reset(mergedFormValues);
  }, [mergedFormValues, form]);

  const formValues = form.watch();

  /** CSV (and similar): type options are filtered by mode; clear an invalid saved `type`. */
  const watchedModeForType = form.watch("mode");
  const watchedTypeForType = form.watch("type");
  useEffect(() => {
    const typeField = sortedFields.find((f) => f.key === "type");
    const obd = typeField?.options_by_dependency;
    if (!obd?.value_map || obd.dependency_key !== "mode") return;
    if (watchedTypeForType === undefined || watchedTypeForType === null || watchedTypeForType === "") return;
    if (watchedModeForType === undefined || watchedModeForType === null || watchedModeForType === "") return;
    const mapped = obd.value_map[String(watchedModeForType)];
    if (!mapped?.length) return;
    const stillValid = mapped.some((o) => String(o.value) === String(watchedTypeForType));
    if (!stillValid) {
      form.setValue("type", "", { shouldDirty: true });
    }
  }, [watchedModeForType, watchedTypeForType, sortedFields, form]);

  const visibleFields = useMemo(() => {   //useMemo
    const currentValues = formValues || form.getValues();
    return sortedFields.filter(field => checkFieldDependencies(field, currentValues));
  }, [sortedFields, formValues, form]);

  // Helper to get all upload response data merged together
  const getMergedUploadData = useCallback(() => {
    const merged: Record<string, any> = {};

    // Merge all upload responses
    Object.values(uploadResponsesMap).forEach(response => {
      if (response) {
        Object.assign(merged, response);
      }
    });

    return merged;
  }, [uploadResponsesMap]);

  const triggerFetch = useCallback(async (field: FormField, currentFormValues: FormSubmissionData) => {
    if (!field.fetch) return;
    setLoadingFields((prev) => ({ ...prev, [field.key]: true }));
    try {
      // Merge upload response data with current form values for template replacement
      const uploadData = getMergedUploadData();
      // Add stmtDate (today's date) for Excel actions API
      const today = new Date();
      const stmtDate = today.toISOString().split('T')[0];
      const mergedValues = {
        ...currentFormValues,
        ...uploadData,
        stmtDate,
      };
      const options = await fetchDynamicOptions(field.fetch, mergedValues);
      setDynamicOptions((prev) => ({ ...prev, [field.key]: options }));
    } catch (error) {
      console.error(`Failed to fetch options for ${field.key}:`, error);
      toast.error(getDisplayErrorMessage(error, `Failed to load data for ${field.display_name}.`));
    } finally {
      setLoadingFields((prev) => ({ ...prev, [field.key]: false }));
    }
  }, [getMergedUploadData]);

  // Generic file upload handler that supports multiple upload fields
  const handleFieldUpload = async (fieldKey: string, file: File, uploadField: FormField) => {
    const formData = new FormData();

    // Determine the upload parameter name based on field fetch config
    const uploadParamName = uploadField.fetch?.params ?
      Object.keys(uploadField.fetch.params)[0] : 'upload_file';

    formData.append(uploadParamName, file);

    // Build the API endpoint from field fetch config
    const endpoint = uploadField.fetch ?
      `/api/${uploadField.fetch.module}/${uploadField.fetch.klass}` :
      '/api/files/upload-file';

    const promise = fetch(endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }).then(res => res.json());

    toast.promise(promise, {
      loading: 'Uploading file...',
      success: (response) => {
        if (response && response.status !== false) {
          console.log(`[FileNodeForm] Upload successful for ${fieldKey}, response:`, response);

          // Store the upload response data for this specific field
          setUploadResponsesMap(prev => ({
            ...prev,
            [fieldKey]: response.data || response,
          }));

          // Trigger refetch for any fields that depend on this upload's response data
          const currentValues = form.getValues();
          const responseData = response.data || response;
          const responseKeys = Object.keys(responseData);

          sortedFields.forEach(field => {
            if (field.fetch && field.type !== 'upload') {
              const dependencies = getFieldDependencies(field.fetch);
              // Check if this field depends on any of the response data keys
              const dependsOnUpload = dependencies.some(dep => responseKeys.includes(dep));

              if (dependsOnUpload) {
                // Check if field is currently visible
                const isVisible = checkFieldDependencies(field, currentValues);
                console.log(`[FileNodeForm] Field ${field.key} is visible: ${isVisible}`);

                if (isVisible) {
                  // Clear current value and options
                  form.setValue(field.key, field.type === 'multi-select-combobox' ? [] : '', { shouldDirty: true });
                  setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));

                  // Trigger fetch with upload data
                  const mergedValues = {
                    ...currentValues,
                    ...responseData,
                  };
                  console.log(`[FileNodeForm] Triggering fetch for ${field.key} with merged values`);
                  triggerFetch(field, mergedValues);
                }
              }
            }
          });

          return response.message || 'File uploaded successfully';
        } else {
          throw new Error(response.message || 'Invalid response from server');
        }
      },
      error: (error) => getDisplayErrorMessage(error, 'File upload failed'),
    });
  };

  // Legacy handler for backward compatibility
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fieldKey?: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Find the upload field configuration
    const uploadField = sortedFields.find(f => f.key === fieldKey && f.type === 'upload');

    if (uploadField && uploadField.fetch) {
      // Use the new generic handler for fields with fetch config
      await handleFieldUpload(fieldKey!, file, uploadField);
    } else {
      // Fallback to legacy behavior for upload_file
      const formData = new FormData();
      formData.append('upload_file', file);
      const promise = uploadFileApi(formData);
      toast.promise(promise, {
        loading: 'Uploading file...',
        success: (response) => {
          if (response && response.unique_id) {
            console.log('[FileNodeForm] Upload successful, response:', response);
            // Store the upload response data for upload_file field
            setUploadResponsesMap(prev => ({
              ...prev,
              ['upload_file']: response,
            }));

            // Trigger refetch for any fields that depend on upload response data
            const currentValues = form.getValues();
            sortedFields.forEach(field => { 
              if (field.fetch && field.type !== 'upload') {  
                const dependencies = getFieldDependencies(field.fetch);
                const uploadDependencies = ['encrypted_file_key', 'file_name', 'unique_id', 'size'];
                const dependsOnUpload = dependencies.some(dep => uploadDependencies.includes(dep));
                if (dependsOnUpload) { 
                  const isVisible = checkFieldDependencies(field, currentValues);
                  if (isVisible) {  
                    form.setValue(field.key, field.type === 'multi-select-combobox' ? [] : '', { shouldDirty: true });
                    setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                    const mergedValues = {
                      ...currentValues,
                      ...response,
                    };
                    triggerFetch(field, mergedValues);
                  }
                }
              }
            });

            return response.message || 'File uploaded successfully';
          } else {
            throw new Error(response.message || 'Invalid response from server');
          }
        },
        error: (error) => getDisplayErrorMessage(error, 'File upload failed'),
      });
    }
  };

  useEffect(() => {  
    const subscription = form.watch((currentValues, { name: changedFieldName }) => { 
      if (!changedFieldName || !hasFetchedInitialRef.current) return;

      const previousValues = previousWatchedValuesRef.current;
      const values = currentValues as FormSubmissionData;

      if (JSON.stringify(values[changedFieldName]) === JSON.stringify(previousValues[changedFieldName])) {
        return;
      }

      if (changedFieldName === 'mode') {
        const prevMode = previousValues['mode'];
        const newMode = values['mode'];
        if (
          prevMode !== undefined &&
          prevMode !== null &&
          prevMode !== '' &&
          String(prevMode) !== String(newMode)
        ) {
          form.setValue('type', '', { shouldDirty: true });
        }
      }

      sortedFields.forEach(dependentField => {  
        if (dependentField.fetch && dependentField.type !== 'upload') {
          const dependencies = getFieldDependencies(dependentField.fetch);

          // Check if this field was just made visible
          const wasVisible = checkFieldDependencies(dependentField, previousValues);
          const isNowVisible = checkFieldDependencies(dependentField, values);
          const justBecameVisible = !wasVisible && isNowVisible;

          // Trigger fetch if:
          // 1. The changed field is a dependency AND all dependencies are met, OR
          // 2. The field just became visible (even with no dependencies)
          const depChanged =
            dependencies.includes(changedFieldName) &&
            !shouldSkipExcelActionsTriggerForChangedField(dependentField.fetch, changedFieldName, values);
          const shouldFetch = depChanged || justBecameVisible;

          if (shouldFetch) { 
            // Clear current value and options
            form.setValue(dependentField.key, dependentField.type === 'multi-select-combobox' ? [] : '', { shouldDirty: true });
            setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));

            // Do not automatically trigger fetch for sheet_name on field changes/visibility changes.
            // sheet_name will be fetched when the user clicks/opens its dropdown.
            if (dependentField.key === 'sheet_name') {
              return;
            }

            // Check if all dependencies are met
            const visibleDependencies = dependencies.filter(dep => {
              const depField = sortedFields.find(f => f.key === dep);
              return !depField || checkFieldDependencies(depField, values);
             });

            // For conditional dependencies based on 'type' field:
            // - If type === "upload", only check upload-related dependencies
            // - If type === "sftp", only check sftp-related dependencies
            // - If type === "amazon_s3", only check amazon_s3-related dependencies
            // - If type === "minio", only check minio-related dependencies
            const currentType = values['type'];
            const currentMode = String(values['mode'] ?? '').toLowerCase();
            const uploadDependencies = ['file_name', 'unique_id', 'encrypted_file_key', 'size'];
            const sftpDependencies =
              currentMode === 'write'
                ? ['sftp', 'sftp_destination_path', 'file_pattern']
                : ['sftp', 'sftp_source_path', 'file_pattern'];
            const amazonS3Dependencies = ['amazon_s3', 'bucket_name', 'object_name'];
            const minioDependencies = ['Minio', 'MinioBucket'];

            const relevantDependencies = visibleDependencies.filter(dep => {
              // Always include 'type' and 'file_category' as they're always relevant
              if (dep === 'type' || dep === 'file_category') return true;

              // Filter based on current type
              if (currentType === 'upload') {
                return uploadDependencies.includes(dep);
              } else if (currentType === 'sftp') {
                return sftpDependencies.includes(dep);
              } else if (currentType === 'amazon_s3') {
                return amazonS3Dependencies.includes(dep);
              } else if (currentType === 'minio') {
                return minioDependencies.includes(dep);
              }
              // If no type is selected or unknown type, include all dependencies
              return true;
            });

            const allDependenciesMet = relevantDependencies.every(dep => {
              const depValue = values[dep];
              return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
            });

            // For fields with no dependencies, always fetch when visible
            // For fields with dependencies, only fetch when all are met
            if (dependencies.length === 0 || allDependenciesMet) {
              // Clear existing timer for this field
              if (debounceTimers.current[dependentField.key]) {
                clearTimeout(debounceTimers.current[dependentField.key]);
              }

              // Special fields that need debouncing (like sheet_name for Excel)
              const shouldDebounce = dependentField.key === 'sheet_name';
              const debounceDelay = 1200; // 800ms delay

              if (shouldDebounce) {
                debounceTimers.current[dependentField.key] = setTimeout(() => {
                  triggerFetch(dependentField, values);
                }, debounceDelay);
              } else {
                triggerFetch(dependentField, values);
              }
            }
          }
        }
      });

      // Write + SFTP: excel-actions is deferred until destination path is set; refetch when user fills it.
      if (changedFieldName === 'sftp_destination_path') {
        const mode = String(values.mode ?? '').toLowerCase();
        const type = String(values.type ?? '').toLowerCase();
        const dest = values.sftp_destination_path;
        if (mode === 'write' && type === 'sftp' && dest != null && String(dest).trim() !== '') {
          sortedFields.forEach((dependentField) => {
            if (!dependentField.fetch || dependentField.type === 'upload') return;
            if (!isExcelActionsFetchConfig(dependentField.fetch)) return;
            if (!checkFieldDependencies(dependentField, values)) return;

            // Skip sheet_name automatic fetch
            if (dependentField.key === 'sheet_name') return;

            const dependencies = getFieldDependencies(dependentField.fetch);
            const visibleDependencies = dependencies.filter((dep) => {
              const depField = sortedFields.find((f) => f.key === dep);
              return !depField || checkFieldDependencies(depField, values);
            });

            const currentType = values['type'];
            const currentMode = String(values['mode'] ?? '').toLowerCase();
            const uploadDependencies = ['file_name', 'unique_id', 'encrypted_file_key', 'size'];
            const sftpDependencies =
              currentMode === 'write'
                ? ['sftp', 'sftp_destination_path', 'file_pattern']
                : ['sftp', 'sftp_source_path', 'file_pattern'];
            const amazonS3Dependencies = ['amazon_s3', 'bucket_name', 'object_name'];
            const minioDependencies = ['Minio', 'MinioBucket'];

            const relevantDependencies = visibleDependencies.filter((dep) => {
              if (dep === 'type' || dep === 'file_category') return true;
              if (currentType === 'upload') return uploadDependencies.includes(dep);
              if (currentType === 'sftp') return sftpDependencies.includes(dep);
              if (currentType === 'amazon_s3') return amazonS3Dependencies.includes(dep);
              if (currentType === 'minio') return minioDependencies.includes(dep);
              return true;
            });

            const allDependenciesMet = relevantDependencies.every((dep) => {
              const depValue = values[dep];
              return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
            });

            if (dependencies.length === 0 || allDependenciesMet) {
              if (debounceTimers.current[dependentField.key]) {
                clearTimeout(debounceTimers.current[dependentField.key]);
              }
              const shouldDebounce = dependentField.key === 'sheet_name';
              const debounceDelay = 1200;
              if (shouldDebounce) {
                debounceTimers.current[dependentField.key] = setTimeout(() => {
                  triggerFetch(dependentField, values);
                }, debounceDelay);
              } else {
                triggerFetch(dependentField, values);
              }
            }
          });
        }
      }

      previousWatchedValuesRef.current = values;
    });

    return () => { // Cleanup // subscription.unsubscribe() //
      subscription.unsubscribe();
      // Clear all debounce timers on cleanup
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };

  }, [form, sortedFields, triggerFetch]);

  useEffect(() => {
    if (hasFetchedInitialRef.current) return;

    const fetchInitialData = async () => {
      const initialValues = form.getValues();

      const initiallyVisibleFields = sortedFields.filter(field =>
        checkFieldDependencies(field, initialValues)
      );
      const initiallyVisibleFieldKeys = new Set(initiallyVisibleFields.map(f => f.key));

      // Do not use generic fetch for 'upload' type, and only fetch for visible fields
      const fieldsToFetch = sortedFields.filter(f =>
        f.fetch &&
        f.type !== 'upload' &&
        f.key !== 'sheet_name' &&
        initiallyVisibleFieldKeys.has(f.key)
      );

      for (const field of fieldsToFetch) {
        const dependencies = getFieldDependencies(field.fetch!);

        const visibleDependencies = dependencies.filter(dep => {
          const depField = sortedFields.find(f => f.key === dep);
          return !depField || checkFieldDependencies(depField, initialValues);
        });

        const allDependenciesMet = visibleDependencies.every(dep => {
          const depValue = initialValues[dep];
          return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
        });

        if (allDependenciesMet) {
          await triggerFetch(field, initialValues);
        }
      }

      hasFetchedInitialRef.current = true;
      previousWatchedValuesRef.current = form.getValues();
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch master_data dropdown options when the upload dialog closes
  useEffect(() => {  
    if (!isUploadDialogOpen && hasFetchedInitialRef.current) {
      // Dialog just closed, refetch master_data fields
      const currentValues = form.getValues();
      sortedFields.forEach(field => {
        if (field.source_form_id === 'master_data' && field.fetch) {
          triggerFetch(field, currentValues);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploadDialogOpen]);

  // Watch for changes in master_data selection to update uploadResponsesMap with file metadata
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (!name) return;

      const field = sortedFields.find((f) => f.key === name);
      if (field?.source_form_id === 'master_data') {
        const selectedValue = values[name];
        const options = dynamicOptions[name];
        if (options && selectedValue) {
          const selectedOption = options.find((opt) => opt.value === selectedValue);
          if (selectedOption) {
            // Update uploadResponsesMap with metadata from the selected option
            setUploadResponsesMap((prev) => ({
              ...prev,
              [name]: {
                unique_id: selectedOption.value,
                file_name: (selectedOption as any).file_name,
                file_type: (selectedOption as any).file_type,
                encrypted_file_key: (selectedOption as any).encrypted_file_key,
                sheet_name: (selectedOption as any).sheet_name,
              },
            }));
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, sortedFields, dynamicOptions]);

  // Handlers for connection creation modal
  const handleConnectionCreated = () => {
    setAddConnectionDialogOpen(false);
    if (connectionField) {
      triggerFetch(connectionField, form.getValues());
    }
  };

  const handleConnectionCancel = () => {
    setAddConnectionDialogOpen(false);
  };

  const handleSubmit = async (data: FormSubmissionData) => {
    console.log('[FileNodeForm] handleSubmit called');
    console.log('[FileNodeForm] Form data:', data);
    console.log('[FileNodeForm] Upload responses map:', uploadResponsesMap);

    try {
      // Clean up template placeholders - replace {{value}} patterns with empty string
      const cleanedData: FormSubmissionData = {};
      Object.keys(data).forEach((key) => {
        const value = data[key];
        // Check if value is a string with template placeholder pattern
        if (typeof value === 'string' && value.match(/^{{.*}}$/)) {
          // Replace template placeholders with empty string
          cleanedData[key] = '';
        } else {
          // Keep all other values as-is (including empty strings)
          cleanedData[key] = value;
        }
      });

      // Merge cleaned form data with all upload response data
      const uploadData = getMergedUploadData();
      const mergedData = {
        ...cleanedData,
        ...uploadData,
      };

      console.log('[FileNodeForm] Merged data:', mergedData);
      console.log('[FileNodeForm] Calling onSubmit...');

      onSubmit(mergedData);

      console.log('[FileNodeForm] onSubmit completed');
    } catch (error) {
      console.error('[FileNodeForm] Error in handleSubmit:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to submit form'));
      }
    }
  };

  const getResponsiveGridClass = (gridColumn?: string) => {
    const span = gridColumn?.split('-')[1] || '12';
    if (span === '6') return 'col-span-6';
    return `col-span-12 md:col-span-${span}`;
  };

  const renderField = (field: FormField) => {
    const gridClass = getResponsiveGridClass(field.gridColumn);
    const baseDynamic = dynamicOptions[field.key];
    const baseStatic = field.options || [];
    let options =
      baseDynamic && baseDynamic.length > 0 ? baseDynamic : baseStatic;
    const obd = field.options_by_dependency;
    if (obd?.value_map && obd.dependency_key) {
      const depVal = formValues?.[obd.dependency_key] ?? form.getValues(obd.dependency_key);
      if (depVal !== undefined && depVal !== null && depVal !== '') {
        const mapped = obd.value_map[String(depVal)];
        if (mapped && mapped.length > 0) {
          options = mapped;
        }
      }
    }
    const currentValue = formValues?.[field.key] ?? form.getValues(field.key);
    const isMultiValue =
      field.type === 'multi-select-combobox' ||
      field.type === 'multi-date' ||
      field.type === 'multi-input';
    if (!isMultiValue && currentValue !== undefined && currentValue !== null && currentValue !== '') {
      if (!options.some(o => String(o.value) === String(currentValue))) {
        options = [...options, { value: currentValue, label: String(currentValue) }];
      }
    }
    const isLoading = loadingFields[field.key] || false;
    const isTableNameField = isTableNameFieldKey(field.key);
    const showInlineCreateTable = fieldSupportsInlineCreateTable(field.key, formValues?.mode);
    const createTableLabel = field.source_form_name?.trim() || 'Create table';
    return (
      <div key={field.key} className={cn('w-full', gridClass)}>
        <UIFormField
          control={form.control}
          name={field.key}
          render={({ field: formField }) => {
            let isDisabled = false;
            if (field.fetch) {
              const dependencies = getFieldDependencies(field.fetch);
              if (dependencies.length > 0) {
                const currentValues = form.getValues();

                // Merge with upload response data for dependency checking
                const uploadData = getMergedUploadData();
                const mergedValues = {
                  ...currentValues,
                  ...uploadData,
                };

                const visibleDependencies = dependencies.filter(dep => { 
                  const depField = sortedFields.find(f => f.key === dep);
                  return !depField || checkFieldDependencies(depField, currentValues);
                });

                // Apply the same conditional dependency logic as in the watch effect
                const currentType = currentValues['type'];
                const currentMode = String(currentValues['mode'] ?? '').toLowerCase();
                const uploadDependencies = ['file_name', 'unique_id', 'encrypted_file_key', 'size'];
                const sftpDependencies =
                  currentMode === 'write'
                    ? ['sftp', 'sftp_destination_path', 'file_pattern']
                    : ['sftp', 'sftp_source_path', 'file_pattern'];
                const amazonS3Dependencies = ['amazon_s3', 'bucket_name', 'object_name'];
                const minioDependencies = ['Minio', 'MinioBucket'];

                const relevantDependencies = visibleDependencies.filter(dep => {
                  // Always include 'type' and 'file_category' as they're always relevant
                  if (dep === 'type' || dep === 'file_category') return true;

                  // Filter based on current type
                  if (currentType === 'upload') {
                    return uploadDependencies.includes(dep);
                  } else if (currentType === 'sftp') {
                    return sftpDependencies.includes(dep);
                  } else if (currentType === 'amazon_s3') {
                    return amazonS3Dependencies.includes(dep);
                  } else if (currentType === 'minio') {
                    return minioDependencies.includes(dep);
                  }
                  // If no type is selected or unknown type, include all dependencies
                  return true;
                });

                isDisabled = relevantDependencies.some(dep => {
                  const depValue = mergedValues[dep];
                  return !depValue || (Array.isArray(depValue) && depValue.length === 0);
                });
              }
            }
            return (  
              <FormItem className="space-y-0 gap-0">
                <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                  {field.display_name}
                  {field.required && <span className="text-red-500 text-base">*</span>}
                </FormLabel>
                <FormControl>
                  {(() => {
                    switch (field.type) {
                      case 'upload':
                        // Get the file name from the appropriate upload response or initialData
                        // Each upload field should only show its own uploaded file, not share with others
                        const fieldResponse = uploadResponsesMap[field.key];
                        let fileName: string | undefined;

                        if (field.key === 'structure_file_id') {
                          // For structure_file_id field, the response contains structure_file_id as the identifier
                          // But we want to show the actual file name if available
                          fileName = fieldResponse?.file_name || fieldResponse?.structure_file_id || initialData?.structure_file_id;
                        } else if (field.key === 'upload_file') {
                          // For upload_file field, use file_name from its own response or initialData
                          fileName = fieldResponse?.file_name || initialData?.file_name;
                        } else {
                          // For any other upload field, only use its own response
                          fileName = fieldResponse?.file_name || initialData?.[field.key];
                        }

                        const cleanFileName = (fileName && typeof fileName === 'string' && fileName.match(/^{{.*}}$/))
                          ? undefined
                          : fileName;

                        return (
                          <InputUpload
                            name={field.key}
                            required={field.required}
                            info={field.info}
                            onChange={(e) => handleFileChange(e, field.key)}
                            initialFileName={cleanFileName}
                          />
                        );
                      case 'textarea':
                        return <Textarea placeholder={field.placeholder} {...formField} className="min-h-[100px] resize-none" />;
                      case 'dropdown':
                      case 'select': return (
                        <Select
                          onValueChange={formField.onChange}
                          value={String(formField.value)}
                          disabled={isDisabled || isLoading}
                          onOpenChange={(open) => {
                            if (open && field.key === 'sheet_name' && !isDisabled && !isLoading) {
                              triggerFetch(field, form.getValues());
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={isLoading ? 'Loading...' : field.placeholder || 'Select an option'} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.length === 0 && !isLoading ? (
                              <div className="p-2 text-sm text-gray-500">No options available</div>
                            ) : (
                              options.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                      );
                       case 'checkbox': return (
                        <div className="flex items-start space-x-3 p-3">
                          <Checkbox id={field.key} checked={formField.value} onCheckedChange={formField.onChange} className="mt-0.5 -ml-2"
                          />
                          <Label htmlFor={field.key} className="text-sm font-normal cursor-pointer">{field.info || field.placeholder}</Label>
                        </div>
                      );
                      case 'radio': return (
                        <RadioGroup onValueChange={formField.onChange} value={formField.value} className="space-y-3">
                          {options.map((o) => (<div key={String(o.value)} className="flex items-center space-x-3"><RadioGroupItem value={String(o.value)} id={String(o.value)} /><Label htmlFor={String(o.value)}>{o.label}</Label></div>))}
                        </RadioGroup>
                      );
                      case 'combobox': return (
                        <AlternativeSelect
                          key={
                            field.options_by_dependency
                              ? `${field.key}-${String(
                                  form.getValues(
                                    field.options_by_dependency.dependency_key
                                  ) ?? ''
                                )}`
                              : field.key
                          }
                          options={options}
                          value={formField.value}
                          onChange={formField.onChange}
                          placeholder={field.placeholder}
                          isLoading={isLoading}
                          allowCustomValue={field.key === 'delimiter'}
                          disabled={isDisabled}
                          showCreateTable={showInlineCreateTable}
                          createTableLabel={createTableLabel}
                          onCreateTable={(name) => {
                            const trimmed = name.trim();
                            if (trimmed) formField.onChange(trimmed);
                          }}
                          showAddButton={!isTableNameField && !!field.add_source_connection}
                          onAddClick={() => {
                            if (field.source_form_id === 'master_data') {
                              openUploadDialog();
                            } else if (!field.source_form_id) {
                              toast.error('Connection form is not configured for this field.');
                            } else {
                              setConnectionField(field);
                              setAddConnectionDialogOpen(true);
                            }
                          }}
                          addButtonLabel={field.source_form_name ? field.source_form_name : "Add new connection"}
                          onDropdownOpen={() => {
                            if (field.key === 'sheet_name' && !isDisabled && !isLoading) {
                              triggerFetch(field, form.getValues());
                            }
                          }}
                        />
                      );
                      case 'multi-select-combobox':
                        const processedOptions = (formField.value.length > 0 && options.length === 0) ? formField.value.map(fieldVal => { return { value: fieldVal, label: fieldVal } })
                          : options
                        return (
                          <MultiSelectCombobox
                            options={processedOptions}
                            value={formField.value}
                            onChange={formField.onChange}
                            placeholder={field.placeholder}
                            isLoading={isLoading}
                            disabled={isDisabled}
                            showAddButton={!isTableNameField && !!field.add_source_connection}
                            onAddClick={() => {
                              if (field.source_form_id === 'master_data') {
                                openUploadDialog();
                              } else if (!field.source_form_id) {
                                toast.error('Connection form is not configured for this field.');
                              } else {
                                setConnectionField(field);
                                setAddConnectionDialogOpen(true);
                              }
                            }}
                            addButtonLabel="Add new connection"
                          />
                        );
                      default: return <Input type={field.type} placeholder={field.placeholder} {...formField} />;
                    }
                  })()}
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )
          }}
        />
      </div>
    );
  };

  const onFormSubmit = form.handleSubmit(
    handleSubmit,
    (errors) => {
      console.error('[FileNodeForm] Form validation errors:', errors);
      toast.error('Please fix form validation errors');
    }
  );

  return (  
    <>
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={onFormSubmit} className="space-y-4">
            <div className="grid grid-cols-12 gap-x-4 gap-y-4">
              {visibleFields.map(renderField)}
            </div>
            <div className="flex justify-center pt-8 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="submit"
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md min-w-[140px] disabled:cursor-not-allowed"
                  disabled={form.formState.isSubmitting || mode === 'view'}
                  onClick={() => {
                    console.log('[FileNodeForm] Submit button clicked');
                    console.log('[FileNodeForm] Form state:', form.formState);
                    console.log('[FileNodeForm] Form errors:', form.formState.errors);
                  }}
                >
                  {form.formState.isSubmitting ? (
                    <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Submitting...</div>
                  ) : (isEditing ? 'Update' : (schema.submitButtonText || 'Submit'))}
                </Button>
            </div>
          </form>
        </Form>
      </FormProvider>

      {/* Master Data Upload Modal */}
      <BaseModal size="x-large" open={isUploadDialogOpen} setOpen={closeUploadDialog}>
        <BaseModal.Header>
          <span>Master Data Upload</span>
        </BaseModal.Header>
        <BaseModal.Content>
          <MasterDataUploadPage />
        </BaseModal.Content>
      </BaseModal>

      {/* Connection Creation Modal */}
      <BaseModal size="x-large" open={isAddConnectionDialogOpen} setOpen={setAddConnectionDialogOpen}>
        <BaseModal.Header>
          <span>Create Connection</span>
        </BaseModal.Header>
        <BaseModal.Content>
          <CredCreateModal
            sourceFormId={connectionField?.source_form_id}
            onSuccess={handleConnectionCreated}
            onCancel={handleConnectionCancel}
          />
        </BaseModal.Content>
      </BaseModal>

    </>
  );
};




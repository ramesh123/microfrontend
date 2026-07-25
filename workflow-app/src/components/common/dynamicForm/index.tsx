import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField as UIFormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FormSchema, FormSubmissionData, FormField, FormFieldOption } from '@/types/form';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Code, Sparkles, Send, Loader2, Check } from 'lucide-react';
import {
  fetchDynamicOptions,
  getFieldDependencies,
  isExcelActionsFetchConfig,
  saveFormData,
  shouldSkipExcelActionsTriggerForChangedField,
} from '@/controllers/API/apiService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MonacoEditor from '@/components/core/monacoEditor';
import BaseModal from '@/modals/baseModal';
import CredCreateModal from '@/components/common/CredCreateModal';
import { AlternativeSelect } from '@/components/ui/alternative-select';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';
import {
  fieldSupportsInlineCreateTable,
  isTableNameFieldKey,
} from '@/utils/formFieldUtils';
import useFlowStore from '@/stores/flowStore';
import { DayPicker } from '@/components/ui/day-picker';

interface DynamicFormProps {
  schema: FormSchema;
  onSubmit: (data: FormSubmissionData) => void | Promise<void>;
  className?: string;
  initialData?: FormSubmissionData | null;
  isEditing?: boolean;
  isDataSetNode: boolean;
  mode?: 'view' | 'edit';
  gridColumns?: 1 | 2 | 3; // Number of columns in the form grid (default: 1)
  /** Skip zod resolver — use for forms where client validation blocks API calls (e.g. scheduler). */
  skipClientValidation?: boolean;
  onValidationError?: (errors: Record<string, { message?: string }>) => void;
  onValuesChange?: (values: FormSubmissionData) => void;
}

/** Textarea keys that must not trigger API dropdown cascade while typing (e.g. SQL query). */
const FREE_TEXT_FIELD_KEYS = new Set(['query', 'custom_sql', 'sql', 'sql_query']);

function isFreeTextFieldKey(key: string): boolean {
  return FREE_TEXT_FIELD_KEYS.has(key);
}

function getEmptyFieldValue(field: FormField): FormSubmissionData[string] {
  if (field.type === 'checkbox' || field.type === 'switch') return false;
  if (field.type === 'multi-select-combobox' || field.type === 'multi-date' || field.type === 'multi-input') {
    return [];
  }
  return '';
}

function clearFieldValue(
  form: { setValue: (name: string, value: FormSubmissionData[string], options?: { shouldDirty?: boolean }) => void },
  field: FormField,
) {
  form.setValue(field.key, getEmptyFieldValue(field), { shouldDirty: true });
}

const DynamicForm: React.FC<DynamicFormProps> = ({
  schema,
  onSubmit,
  className,
  initialData,
  isEditing,
  isDataSetNode,
  mode = 'edit',
  gridColumns = 2,
  skipClientValidation = false,
  onValidationError,
  onValuesChange,
}) => {
  const { toast } = useToast();
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, FormFieldOption[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [isAddConnectionDialogOpen, setAddConnectionDialogOpen] = useState(false);
  const [isAddTableDialogOpen, setAddTableDialogOpen] = useState(false);
  const [addTableDraft, setAddTableDraft] = useState('');
  const [tableFieldForCreate, setTableFieldForCreate] = useState<FormField | null>(null);
  const [connectionField, setConnectionField] = useState<FormField | null>(null);
  const previousWatchedValuesRef = useRef<FormSubmissionData>({});
  const hasFetchedInitialRef = useRef(false);
  const lastResetSnapshotRef = useRef<string | null>(null);
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;
  /** When true, next table-name field change skips dependent resets / fetches (create-table flow). */
  const suppressTableDependentFetchRef = useRef(false);

  // State for multi-input fields
  const [multiInputValues, setMultiInputValues] = useState<Record<string, string[]>>({});
  
  // State for AI mode in textarea fields
  const [aiModeEnabled, setAiModeEnabled] = useState<Record<string, boolean>>({});
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});

  const sortedFields = useMemo(() => {  
    // Filter out 'dataset' field for database nodes (DynamicForm)
    return schema.fields
      .filter(field => field.key !== 'dataset')
      .sort((a, b) => a.position - b.position);
  }, [schema.fields]);

  const generateValidationSchema = (fields: FormField[]) => {
    const schemaObject: { [key: string]: z.ZodTypeAny } = {};
    fields.forEach((field) => {
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
        case 'switch':
          fieldSchema = z.boolean();
          break;
        case 'multi-select-combobox':
        case 'multi-date':
        case 'multi-input':
          fieldSchema = z.array(z.any());
          break;
        case 'combobox':
          fieldSchema = z.any();
          break;
        case 'time':
        case 'date':
        default:
          fieldSchema = z.string();
      }

      // Make all fields optional at the individual level, 
      // as we are handling required logic in superRefine.
      schemaObject[field.key] = fieldSchema.optional().nullable();
    });

    return z.object(schemaObject).superRefine((data, ctx) => {
        const visibleFields = fields.filter(field => checkFieldDependencies(field, data as FormSubmissionData));

        visibleFields.forEach(field => {
            if (field.required) {
                const value = data[field.key];
                let isInvalid = false;

                if (Array.isArray(value)) {
                    isInvalid = value.length === 0;
                } else if (typeof value === 'boolean') {
                    // Switches can be false when required — only reject unset values
                    isInvalid = value === null || value === undefined;
                } else if (typeof value === 'number') {
                    isInvalid = value === null || value === undefined;
                } else if (!value) { // For strings and other types
                    isInvalid = true;
                }

                if (isInvalid) {
                    ctx.addIssue({
                        path: [field.key],
                        message: `${field.display_name} is required`,
                        code: z.ZodIssueCode.custom,
                    });
                }
            }
        });
    });
  };

  const validationSchema = useMemo(() => generateValidationSchema(sortedFields), [sortedFields]);

  const defaultFormValues = useMemo(() => {
    return sortedFields.reduce((acc, field) => { 
      let defaultValue = field.value ?? (
        field.type === 'checkbox' || field.type === 'switch' ? false :
        field.type === 'multi-select-combobox' || field.type === 'multi-date' || field.type === 'multi-input' ? [] :
        ''
      );

      // Clean template placeholders from default values
      if (typeof defaultValue === 'string' && defaultValue.match(/^{{.*}}$/)) {
        defaultValue = '';
      }

      acc[field.key] = defaultValue;
      return acc;
    }, {} as FormSubmissionData);
  }, [sortedFields]);

  // Clean template placeholders from initialData if provided
  const cleanedInitialData = useMemo(() => {
    const cleaned: FormSubmissionData = { ...defaultFormValues };
    if (!initialData) return null;

    Object.keys(initialData).forEach((key) => {
      const value = initialData[key];
      const field = sortedFields.find((f) => f.key === key);
      const isMultiValueField =
        field?.type === 'multi-select-combobox' ||
        field?.type === 'multi-date' ||
        field?.type === 'multi-input';

      // Clean template placeholders
      if (typeof value === 'string' && value.match(/^{{.*}}$/)) {
        cleaned[key] = isMultiValueField ? [] : '';
      } else if (isMultiValueField && !Array.isArray(value)) {
        cleaned[key] = value == null || value === '' ? [] : [value];
      } else {
        cleaned[key] = value;
      }
    });

    sortedFields.forEach((field) => {
      if (!field.options?.length) return;
      const raw = cleaned[field.key];
      if (raw == null || raw === '') return;
      const match = field.options.find(
        (o) => String(o.value).toLowerCase() === String(raw).toLowerCase(),
      );
      if (match) cleaned[field.key] = match.value;
    });

    // Drop values for fields hidden by current fetch mode (e.g. table vs query)
    sortedFields.forEach((field) => {
      if (checkFieldDependencies(field, cleaned)) return;
      cleaned[field.key] = getEmptyFieldValue(field);
    });

    // Map remote_sheet_name / local_sheet_name if sheet_name is empty
    if (!cleaned.sheet_name) {
      if (initialData.remote_sheet_name !== undefined) {
        cleaned.sheet_name = initialData.remote_sheet_name;
      } else if (initialData.local_sheet_name !== undefined) {
        cleaned.sheet_name = initialData.local_sheet_name;
      }
    }

    return cleaned;
  }, [initialData, sortedFields, defaultFormValues]);

  const form = useForm<FormSubmissionData>({
    resolver: skipClientValidation ? undefined : zodResolver(validationSchema),
    defaultValues: cleanedInitialData || defaultFormValues,
    shouldUnregister: false,
  });

  const lastInitialDataRef = useRef(initialData);
  useEffect(() => {
    if (!cleanedInitialData) return;
    if (lastInitialDataRef.current === initialData) return;
    lastInitialDataRef.current = initialData;
    const snapshot = JSON.stringify(cleanedInitialData);
    lastResetSnapshotRef.current = snapshot;
    form.reset(cleanedInitialData);
    onValuesChangeRef.current?.(cleanedInitialData);
  }, [cleanedInitialData, initialData, form]);

  const formValues = useWatch({ control: form.control }) as FormSubmissionData | undefined;

  // Filter fields based on dependencies
  const visibleFields = useMemo(() => {
    const currentValues = formValues || form.getValues();
    return sortedFields.filter(field => checkFieldDependencies(field, currentValues));
  }, [sortedFields, formValues, form]);

  const triggerFetch = useCallback(async (field: FormField, currentFormValues: FormSubmissionData) => {
    if (!field.fetch) return;
    if (!checkFieldDependencies(field, currentFormValues)) return;
    setLoadingFields((prev) => ({ ...prev, [field.key]: true }));
    try {
      const options = await fetchDynamicOptions(field.fetch, currentFormValues);
      setDynamicOptions((prev) => ({ ...prev, [field.key]: options }));
    } catch (error) {
      console.error(`Failed to fetch options for ${field.key}:`, error);
      toast({ title: 'Error', description: `Failed to load data for ${field.display_name}.`, variant: 'destructive' });
    } finally {
      setLoadingFields((prev) => ({ ...prev, [field.key]: false }));
    }
  }, [toast]);

  const syncFormValuesToParent = useCallback(() => {
    const latest = form.getValues() as FormSubmissionData;
    previousWatchedValuesRef.current = latest;
    onValuesChangeRef.current?.(latest);
    return latest;
  }, [form]);

  // Effect for handling user-driven changes
  useEffect(() => {
    const subscription = form.watch((currentValues, { name: changedFieldName }) => {
      if (!changedFieldName || !hasFetchedInitialRef.current) return;

      const previousValues = previousWatchedValuesRef.current;
      const values = form.getValues() as FormSubmissionData;
      // Watch can run before getValues() reflects the new selection (e.g. Fetch Type)
      if (currentValues && changedFieldName in currentValues) {
        values[changedFieldName] = (currentValues as FormSubmissionData)[changedFieldName];
      }

      if (JSON.stringify(values[changedFieldName]) === JSON.stringify(previousValues[changedFieldName])) {
        if (isTableNameFieldKey(changedFieldName) && suppressTableDependentFetchRef.current) {
          suppressTableDependentFetchRef.current = false;
        }
        return;
      }

      const skipTableDependentEffects =
        isTableNameFieldKey(changedFieldName) && suppressTableDependentFetchRef.current;
      if (skipTableDependentEffects) {
        suppressTableDependentFetchRef.current = false;
      }

      const changedFieldDef = sortedFields.find((f) => f.key === changedFieldName);
      const isStaticChoiceChange =
        changedFieldDef != null &&
        !changedFieldDef.fetch &&
        (changedFieldDef.type === 'combobox' ||
          changedFieldDef.type === 'select' ||
          changedFieldDef.type === 'dropdown');

      const isFreeTextChange =
        changedFieldDef != null &&
        !changedFieldDef.fetch &&
        (changedFieldDef.type === 'textarea' || isFreeTextFieldKey(changedFieldName));

      if (isStaticChoiceChange) {
        sortedFields.forEach((dependentField) => {
          if (!dependentField.fetch) return;
          if (dependentField.key === changedFieldName) return;
          if (dependentField.type === 'textarea' || isFreeTextFieldKey(dependentField.key)) return;

          const dependencies = getFieldDependencies(dependentField.fetch);
          const wasVisible = checkFieldDependencies(dependentField, previousValues);
          const isNowVisible = checkFieldDependencies(dependentField, values);
          const justBecameVisible = !wasVisible && isNowVisible;
          const justBecameHidden = wasVisible && !isNowVisible;

          if (justBecameHidden) {
            clearFieldValue(form, dependentField);
            setDynamicOptions((prev) => ({ ...prev, [dependentField.key]: [] }));
            return;
          }

          if (justBecameVisible && isNowVisible) {
            const visibleDependencies = dependencies.filter((dep) => {
              const depField = sortedFields.find((f) => f.key === dep);
              return !depField || checkFieldDependencies(depField, values);
            });
            const allDependenciesMet = visibleDependencies.every((dep) => {
              const depValue = values[dep];
              return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
            });
            if (dependencies.length === 0 || allDependenciesMet) {
              triggerFetch(dependentField, values);
            }
          }
        });
        syncFormValuesToParent();
        return;
      }

      if (isFreeTextChange) {
        syncFormValuesToParent();
        return;
      }

      if (!skipTableDependentEffects) {
      sortedFields.forEach(dependentField => {
        if (!dependentField.fetch) return;
        if (dependentField.key === changedFieldName) return;
        if (dependentField.type === 'textarea' || isFreeTextFieldKey(dependentField.key)) return;

        const dependencies = getFieldDependencies(dependentField.fetch);
        const wasVisible = checkFieldDependencies(dependentField, previousValues);
        const isNowVisible = checkFieldDependencies(dependentField, values);
        const justBecameVisible = !wasVisible && isNowVisible;
        const justBecameHidden = wasVisible && !isNowVisible;

        if (justBecameHidden) {
          clearFieldValue(form, dependentField);
          setDynamicOptions((prev) => ({ ...prev, [dependentField.key]: [] }));
          return;
        }

        const depChanged =
          dependencies.includes(changedFieldName) &&
          !shouldSkipExcelActionsTriggerForChangedField(dependentField.fetch, changedFieldName, values);
        if (!(depChanged || justBecameVisible) || !isNowVisible) return;

        if (depChanged) {
          form.setValue(dependentField.key, dependentField.type === 'multi-select-combobox' ? [] : '', { shouldDirty: true });
          setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));
        }

        const visibleDependencies = dependencies.filter(dep => {
          const depField = sortedFields.find(f => f.key === dep);
          return !depField || checkFieldDependencies(depField, values);
        });

        const allDependenciesMet = visibleDependencies.every(dep => {
          const depValue = values[dep];
          return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
        });

        // Do not automatically trigger fetch for sheet_name on field changes/visibility changes.
        // sheet_name will be fetched when the user clicks/opens its dropdown.
        if (dependentField.key === 'sheet_name') {
          return;
        }

        if (dependencies.length === 0 || allDependenciesMet) {
          triggerFetch(dependentField, values);
        }
      });
      }

      if (!skipTableDependentEffects && changedFieldName === 'sftp_destination_path') {
        const mode = String(values.mode ?? '').toLowerCase();
        const type = String(values.type ?? '').toLowerCase();
        const dest = values.sftp_destination_path;
        if (mode === 'write' && type === 'sftp' && dest != null && String(dest).trim() !== '') {
          sortedFields.forEach((dependentField) => {
            if (!dependentField.fetch) return;
            if (!isExcelActionsFetchConfig(dependentField.fetch)) return;
            if (!checkFieldDependencies(dependentField, values)) return;
            const dependencies = getFieldDependencies(dependentField.fetch);
            const visibleDependencies = dependencies.filter((dep) => {
              const depField = sortedFields.find((f) => f.key === dep);
              return !depField || checkFieldDependencies(depField, values);
            });
            const allDependenciesMet = visibleDependencies.every((dep) => {
              const depValue = values[dep];
              return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
            });
            if (dependentField.key === 'sheet_name') return;
            if (allDependenciesMet) {
              triggerFetch(dependentField, values);
            }
          });
        }
      }

      syncFormValuesToParent();
    });

    return () => subscription.unsubscribe();
  }, [form, sortedFields, triggerFetch, syncFormValuesToParent]);

  // Effect for initial data fetching (for both new and edit modes)
  useEffect(() => {
    if (hasFetchedInitialRef.current) return;

    const fetchInitialData = async () => {
      const initialValues = form.getValues();
      const fieldsToFetch = sortedFields.filter(f => f.fetch && f.key !== 'sheet_name');

      for (const field of fieldsToFetch) {
        if (!checkFieldDependencies(field, initialValues)) continue;

        const dependencies = getFieldDependencies(field.fetch!);

        // Filter dependencies to only include visible fields
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
      syncFormValuesToParent();
    };
    // Dataset nodes are read-only but still need option labels (e.g. get-connections).
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFormValuesToParent]);

  const handleOpenAddConnectionDialog = (field: FormField) => {
    if (!field.source_form_id) {
      toast({
        title: 'Cannot open form',
        description: 'Connection form is not configured for this field.',
        variant: 'destructive',
      });
      return;
    }
    setConnectionField(field);
    setTimeout(() => setAddConnectionDialogOpen(true), 100);
  };

  const handleSaveNewConnection = () => {
    toast({
      title: "Connection Saved",
      description: "The new connection is now available in the list.",
    });
    setAddConnectionDialogOpen(false);
    if (connectionField) {
      triggerFetch(connectionField, form.getValues());
    }
  };

  const handleConnectionCreated = () => {
    // Close the modal
    setAddConnectionDialogOpen(false);
    // Refresh the dropdown options for the field
    if (connectionField) {
      triggerFetch(connectionField, form.getValues());
    }
  };

  const handleConnectionCancel = () => {
    setAddConnectionDialogOpen(false);
  };

  const handleOpenCreateTableModal = (field: FormField) => {
    setTableFieldForCreate(field);
    setAddTableDraft(String(form.getValues(field.key) ?? ''));
    setTimeout(() => setAddTableDialogOpen(true), 100);
  };

  const handleApplyTableFromModal = () => {
    const field = tableFieldForCreate;
    if (!field) return;
    const trimmed = addTableDraft.trim();
    if (!trimmed) return;
    suppressTableDependentFetchRef.current = true;
    form.setValue(field.key, trimmed, { shouldDirty: true, shouldValidate: true });
    setAddTableDialogOpen(false);
    setTableFieldForCreate(null);
    queueMicrotask(syncFormValuesToParent);
  };

  const handleCloseCreateTableModal = (open: boolean) => {
    setAddTableDialogOpen(open);
    if (!open) {
      setTableFieldForCreate(null);
      setAddTableDraft('');
    }
  };

  const handleSubmit = async (data: FormSubmissionData) => {
    try {
      // When zod is skipped, merge live form state so conditional fields are included
      const mergedInput = skipClientValidation
        ? { ...form.getValues(), ...data }
        : data;

      const visibilityValues = { ...form.getValues(), ...mergedInput } as FormSubmissionData;

      // Merge form data with all field default values to ensure all fields are included
      const fullData: FormSubmissionData = {};

      // First, add all fields with their current values from the template
      sortedFields.forEach(field => {
        if (field.key !== 'dataset') { // Skip dataset field for database nodes
          if (!checkFieldDependencies(field, visibilityValues)) {
            fullData[field.key] = getEmptyFieldValue(field);
            return;
          }

          const formValue = mergedInput[field.key];
          const defaultValue = field.value;

          // Use form value if it exists and is not empty, otherwise use default value
          if (formValue !== undefined && formValue !== null && formValue !== '') {
            fullData[field.key] = formValue;
          } else if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
            // Check if default value is a template placeholder
            if (typeof defaultValue === 'string' && defaultValue.match(/^{{.*}}$/)) {
              fullData[field.key] = '';
            } else {
              fullData[field.key] = defaultValue;
            }
          } else {
            // For empty values, send appropriate default based on type
            fullData[field.key] =
              field.type === 'checkbox' || field.type === 'switch' ? false :
              field.type === 'multi-select-combobox' || field.type === 'multi-date' || field.type === 'multi-input' ? [] :
              '';
          }
        }
      });

      // Clean up any remaining template placeholders in the final data
      const cleanedData: FormSubmissionData = {};
      Object.keys(fullData).forEach((key) => {
        const value = fullData[key];
        // Check if value is a string with template placeholder pattern
        if (typeof value === 'string' && value.match(/^{{.*}}$/)) {
          // Replace template placeholders with empty string
          cleanedData[key] = '';
        } else {
          // Keep all other values as-is (including empty strings)
          cleanedData[key] = value;
        }
      });

      let finalData = cleanedData;
      if (schema.saveNode && schema.submitPayload) {
        // Pass flow_id from currentWorkflow to saveFormData
        const flowId = currentWorkflow?.flow_id;
        console.log('[DynamicForm] Saving node with flow_id:', flowId);
        finalData = await saveFormData(schema.saveNode, cleanedData, schema.submitPayload, flowId);
        toast({ title: 'Node Saved Successfully!', description: 'Your node configuration has been saved.' });
      } else if (!schema.suppressSuccessToast) {
        const message = isEditing ? 'Form Updated Successfully!' : 'Form Submitted Successfully!';
        toast({ title: message, description: 'Your form data has been processed.' });
      }
      await Promise.resolve(onSubmit(finalData));
      if (!isEditing) {
        form.reset(defaultFormValues);
        setDynamicOptions({});
        hasFetchedInitialRef.current = false;
        setTimeout(() => {
          const newInitialValues = form.getValues();
          sortedFields.forEach(field => {
            if (field.fetch && getFieldDependencies(field.fetch).length === 0) {
              triggerFetch(field, newInitialValues);
            }
          });
          hasFetchedInitialRef.current = true;
          previousWatchedValuesRef.current = newInitialValues;
        }, 0);
      }
    } catch (error) {
      console.error("Failed to submit form:", error);
      toast({ title: 'Submission Failed', description: 'There was an error saving your data.', variant: 'destructive' });
    }
  };

  const renderField = (field: FormField) => {
    let options = dynamicOptions[field.key] || field.options || [];
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
    const fieldDisabled = mode === 'view' || isDataSetNode;
    const isTableNameField = isTableNameFieldKey(field.key);
    const showInlineCreateTable = fieldSupportsInlineCreateTable(field.key, formValues?.mode);
    const createTableLabel = field.source_form_name?.trim() || 'Create table';

    return (
      <div
        key={
          isFreeTextFieldKey(field.key)
            ? `${field.key}-${String(formValues?.fetch ?? formValues?.fetch_type ?? '')}`
            : field.key
        }
        className="w-full"
      >
        <UIFormField
          control={form.control}
          name={field.key}
          render={({ field: formField }) => {
            let isDisabled = false;
            if (field.fetch) {
              const dependencies = getFieldDependencies(field.fetch);
              if (dependencies.length > 0) {
                // Filter dependencies to only include visible fields
                const currentValues = form.getValues();
                const visibleDependencies = dependencies.filter(dep => {
                  const depField = sortedFields.find(f => f.key === dep);
                  return !depField || checkFieldDependencies(depField, currentValues);
                });

                // Check if any visible dependency is missing
                isDisabled = visibleDependencies.some(dep => {
                  const depValue = form.getValues(dep);
                  return !depValue || (Array.isArray(depValue) && depValue.length === 0);
                });
              }
            }
            return (
              <FormItem className="space-y-0 gap-1">
                <FormLabel className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                  {field.display_name}
                  {field.required && <span className="text-red-500 text-sm ml-0.5">*</span>}
                </FormLabel>
                <FormControl>
                  {(() => {
                    switch (field.type) {
                      case 'textarea':
                        if (field.key === 'custom_sql') {
                          return (
                            <MonacoEditor
                              value={formField.value}
                              onChange={(val) => formField.onChange(val)}
                              readOnly={fieldDisabled}
                            />
                          );
                        }
                        const isAiEnabled = aiModeEnabled[field.key] || false;
                        const hasText = formField.value && String(formField.value).trim().length > 0;
                        const isGenerating = isGeneratingAi[field.key] || false;
                        const aiResponse = aiResponses[field.key];
                        const showSendButton = isAiEnabled && hasText && !isGenerating && !aiResponse;
                        const showInsertButton = isAiEnabled && aiResponse && !isGenerating;

                        const handleSendToAi = async () => {
                          const userText = String(formField.value || '').trim();
                          if (!userText) return;

                          setIsGeneratingAi(prev => ({ ...prev, [field.key]: true }));
                          setAiResponses(prev => ({ ...prev, [field.key]: '' }));

                          try {
                            // TODO: Replace with actual AI API call for SQL generation
                            // For now, simulate AI response
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            
                            // Mock AI response - in production, this would come from an API
                            const mockResponse = `-- AI Generated SQL based on: "${userText}"\nSELECT * FROM your_table WHERE condition = '${userText}'`;
                            
                            setAiResponses(prev => ({ ...prev, [field.key]: mockResponse }));
                            toast({ title: 'Success', description: 'AI response generated', variant: 'default' });
                          } catch (error) {
                            console.error('Error generating AI response:', error);
                            toast({ title: 'Error', description: 'Failed to generate AI response', variant: 'destructive' });
                          } finally {
                            setIsGeneratingAi(prev => ({ ...prev, [field.key]: false }));
                          }
                        };

                        const handleInsertAiResponse = () => {
                          if (aiResponse) {
                            formField.onChange(aiResponse);
                            setAiResponses(prev => {
                              const newState = { ...prev };
                              delete newState[field.key];
                              return newState;
                            });
                            // Disable AI mode after inserting
                            setAiModeEnabled(prev => ({ ...prev, [field.key]: false }));
                            toast({ title: 'Success', description: 'Text inserted successfully', variant: 'default' });
                          }
                        };

                        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                          // Activate AI mode when "/" is typed and AI mode is not already enabled
                          if (e.key === '/' && !isAiEnabled && (!formField.value || formField.value === '')) {
                            e.preventDefault();
                            setAiModeEnabled(prev => ({ ...prev, [field.key]: true }));
                            toast({ title: 'AI Mode Activated', description: 'Start typing your query', variant: 'default' });
                          }
                        };

                        return (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAiModeEnabled(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className={cn(
                                "absolute left-3 top-3 h-4 w-4 z-10 transition-all duration-200",
                                "hover:scale-110 active:scale-95",
                                isAiEnabled 
                                  ? "text-primary animate-pulse" 
                                  : "text-slate-400 dark:text-slate-500 hover:text-primary"
                              )}
                              title={isAiEnabled ? "AI Mode Enabled - Click to disable" : "Enable AI Mode - Or press /"}
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                            
                            <Textarea 
                              placeholder={isAiEnabled ? "Start typing your query..." : (field.placeholder || "Press / for AI assistance")}
                              {...formField}
                              onKeyDown={handleKeyDown}
                              className={cn(
                                "min-h-[100px] resize-none pl-10 transition-all duration-300",
                                isAiEnabled && "border-primary/50 ring-2 ring-primary/20 bg-gradient-to-r from-primary/5 via-primary/15 to-primary/5 bg-[length:200%_100%] animate-shimmer",
                                showSendButton && "pr-10",
                                showInsertButton && "pr-20"
                              )} 
                              disabled={fieldDisabled || isGenerating}
                            />

                            {/* Send Button - appears when typing and AI mode is enabled */}
                            {showSendButton && (
                              <button
                                type="button"
                                onClick={handleSendToAi}
                                className="absolute bottom-2 right-2 h-7 w-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md z-10"
                                title="Send to AI"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Loading State */}
                            {isGenerating && (
                              <div className="absolute bottom-2 right-2 h-7 w-7 flex items-center justify-center rounded-md bg-primary/20 z-10">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                              </div>
                            )}

                            {/* Insert Button - appears after AI response */}
                            {showInsertButton && (
                              <button
                                type="button"
                                onClick={handleInsertAiResponse}
                                className="absolute bottom-2 right-2 h-7 px-3 flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md z-10 text-xs font-medium"
                                title="Insert AI response"
                              >
                                <Check className="h-3 w-3" />
                                Insert
                              </button>
                            )}
                          </div>
                        );
                      case 'select': return (
                        <Select
                          onValueChange={formField.onChange}
                          value={String(formField.value ?? '')}
                          onOpenChange={(open) => {
                            if (open && field.key === 'sheet_name' && !isDisabled && !isLoading) {
                              triggerFetch(field, form.getValues());
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select an option'} /></SelectTrigger>
                          <SelectContent>{options.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      );
                      case 'checkbox': return (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={field.key}
                            checked={formField.value}
                            onCheckedChange={formField.onChange}
                            disabled={isDataSetNode}
                          />
                          <Label
                            htmlFor={field.key}
                            className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {field.info || field.placeholder || field.display_name}
                          </Label>
                        </div>
                      );
                      case 'switch': return (
                        <div className="flex items-center space-x-2 py-1">
                          <Switch
                            id={field.key}
                            className=''
                            checked={formField.value}
                            onCheckedChange={formField.onChange}
                            disabled={isDataSetNode}
                          />
                          <Label
                            htmlFor={field.key}
                            className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {field.info || field.placeholder || 'Enable'}
                          </Label>
                        </div>
                      );
                      case 'radio': return (
                        <RadioGroup onValueChange={formField.onChange} value={formField.value} className="space-y-3">
                          {options.map((o) => (<div key={String(o.value)} className="flex items-center space-x-3"><RadioGroupItem value={String(o.value)} id={String(o.value)} /><Label htmlFor={String(o.value)}>{o.label}</Label></div>))}
                        </RadioGroup>
                      );
                      case 'combobox': return (
                        <AlternativeSelect
                          options={options}
                          value={formField.value != null && formField.value !== '' ? formField.value : undefined}
                          onChange={(val) => {
                            formField.onChange(val);
                            if (!field.fetch) {
                              queueMicrotask(syncFormValuesToParent);
                            }
                          }}
                          placeholder={field.placeholder}
                          isLoading={isLoading}
                          disabled={isDisabled || isDataSetNode}
                          showCreateTable={showInlineCreateTable}
                          createTableLabel={createTableLabel}
                          onCreateTableClick={() => handleOpenCreateTableModal(field)}
                          showAddButton={!isTableNameField && !!field.add_source_connection}
                          onAddClick={() => handleOpenAddConnectionDialog(field)}
                          addButtonLabel={field.source_form_name ? field.source_form_name : "Add new connection"}
                          onDropdownOpen={() => {
                            if (field.key === 'sheet_name' && !isDisabled && !isLoading && !isDataSetNode) {
                              triggerFetch(field, form.getValues());
                            }
                          }}
                        />
                      );
                      case 'multi-select-combobox':
                        const processedOptions = (Array.isArray(formField.value) && formField.value.length > 0 && options.length === 0) ? formField.value.map(fieldVal => { return { value: fieldVal, label: fieldVal } })
                          : options
                        return (
                          <MultiSelectCombobox
                            options={processedOptions}
                            value={Array.isArray(formField.value) ? formField.value : []}
                            onChange={formField.onChange}
                            placeholder={field.placeholder}
                            isLoading={isLoading}
                            disabled={isDisabled || isDataSetNode}
                            showAddButton={!isTableNameField && !!field.add_source_connection}
                            onAddClick={() => handleOpenAddConnectionDialog(field)}
                            addButtonLabel="Add new connection"
                          />
                        );
                      case 'time': return ( 
                        <Input
                          type="time"
                          placeholder={field.placeholder}
                          value={formField.value || ''}
                          onChange={formField.onChange}
                          disabled={isDataSetNode}
                          className="w-full"
                        />
                      );
                      case 'multi-date': {
                        // Parse selected days from form value (can be strings or numbers)
                        const selectedDays = Array.isArray(formField.value)
                          ? formField.value.map(day => parseInt(String(day))).filter(d => !isNaN(d) && d >= 1 && d <= 31)
                          : [];

                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outliner"
                                className={cn(
                                  'w-full justify-start text-left font-normal h-9',
                                  !formField.value?.length && 'text-muted-foreground'
                                )}
                                disabled={isDataSetNode}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                {formField.value && formField.value.length > 0 ? (
                                  <span className="truncate">
                                    {formField.value.length} day{formField.value.length > 1 ? 's' : ''} selected: {selectedDays.sort((a, b) => a - b).join(', ')}
                                  </span>
                                ) : (
                                  <span>{field.placeholder || 'Select days'}</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                              <DayPicker
                                selectedDays={selectedDays}
                                onSelect={(days) => {
                                  // Store as array of numbers (or strings based on backend requirement)
                                  formField.onChange(days.map(d => String(d)));
                                }}
                                disabled={isDataSetNode}
                                maxDays={31}
                              />
                            </PopoverContent>
                          </Popover>
                        );
                      }

                      case 'multi-input': {
                        // Use MultiSelectCombobox with custom value support
                        const processedOptions = (Array.isArray(formField.value) && formField.value.length > 0 && options.length === 0)
                          ? formField.value.map(fieldVal => { return { value: fieldVal, label: fieldVal } })
                          : options;

                        return (
                          <MultiSelectCombobox
                            options={processedOptions}
                            value={formField.value || []}
                            onChange={formField.onChange}
                            placeholder={field.placeholder || 'Enter values'}
                            isLoading={isLoading}
                            disabled={isDisabled || isDataSetNode}
                            allowCustomValue={true}
                          />
                        );
                      }
                      default: return <Input className='h-[2.42rem]' type={field.type} placeholder={field.placeholder} {...formField} disabled={isDataSetNode} />;
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

  return (
    <>
      {/* <Card className={cn('w-full mx-auto shadow-md border-0 dark:bg-gray-900 h-[calc(100vh-200px)] overflow-auto', className)}>
        <CardHeader className="space-y-4 pb-8">
          <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">{schema.title}</CardTitle>
          {schema.description && <CardDescription className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto text-base">{schema.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-8 px-4 sm:px-6 lg:px-8"> */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(
          handleSubmit,
          (errors) => {
            console.log('🔴 Form validation errors:', errors);
            onValidationError?.(errors);
            const firstMessage =
              Object.values(errors)[0]?.message ?? 'Please fill in all required fields.';
            toast({
              title: 'Validation failed',
              description: String(firstMessage),
              variant: 'destructive',
            });
          }
        )} className="space-y-2">
          <div className={cn(
            'grid gap-x-3 gap-y-3',
            gridColumns === 1 && 'grid-cols-1',
            gridColumns === 2 && 'grid-cols-1 md:grid-cols-2',
            gridColumns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          )}>
            {visibleFields.map(renderField)}
          </div>
          <div className="flex justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
            {!isDataSetNode &&
              <Button type="submit" className="px-6 py-2 bg-blue-600  text-white font-semibold rounded-lg shadow-md min-w-[120px] disabled:cursor-not-allowed" disabled={form.formState.isSubmitting || mode === 'view'}>
                {form.formState.isSubmitting ? (
                  <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Submitting...</div>
                ) : (isEditing ? 'Update' : (schema.submitButtonText || 'Submit'))}
              </Button>
            }
          </div>
        </form>
      </Form>
      {/* </CardContent>
      </Card> */}

      <BaseModal size="x-small" open={isAddTableDialogOpen} setOpen={handleCloseCreateTableModal}>
        <BaseModal.Header>
          <span>{tableFieldForCreate?.source_form_name?.trim() || 'Create Table'}</span>
        </BaseModal.Header>
        <BaseModal.Content>
          <div className="w-full flex flex-col gap-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-table-name" className="text-right">
                Table
              </Label>
              <Input
                id="create-table-name"
                value={addTableDraft}
                onChange={(e) => setAddTableDraft(e.target.value)}
                className="col-span-3"
                placeholder={tableFieldForCreate?.placeholder || 'Enter table name'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyTableFromModal();
                  }
                }}
              />
            </div>
          </div>
        </BaseModal.Content>
        <BaseModal.Footer>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              onClick={handleApplyTableFromModal}
              disabled={!addTableDraft.trim()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md min-w-[140px] !h-8"
            >
              Create Table
            </Button>
            <Button
              type="button"
              variant="outline"
              className="!h-8"
              onClick={() => setAddTableDraft('')}
            >
              Clear
            </Button>
          </div>
        </BaseModal.Footer>
      </BaseModal>

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

      {/* <Dialog open={isAddConnectionDialogOpen} onOpenChange={setAddConnectionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Connection</DialogTitle>
            <DialogDescription>
              Please fill in the details for the new connection you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" defaultValue="My New DB Connection" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="host" className="text-right">Host</Label>
              <Input id="host" defaultValue="localhost" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddConnectionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNewConnection}>Save Connection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
      
      {/* Shimmer Animation Styles */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default DynamicForm;
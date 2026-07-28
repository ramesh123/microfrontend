import { FormSchema, FormField } from '@/types/form';

/**
 * Transform backend scheduler template to DynamicForm schema format
 * @param backendTemplate - Template object from backend API
 * @returns FormSchema compatible with DynamicForm component
 */
export const transformSchedulerTemplate = (backendTemplate: Record<string, any>): FormSchema => {
  const fields: FormField[] = [];

  Object.entries(backendTemplate).forEach(([key, field]: [string, any]) => {
    const formField: Partial<FormField> = {
      key: field.key || key,
      type: mapFieldType(field.type) as any,
      display_name: field.display_name || key,
      placeholder: field.placeholder || '',
      required: field.required || false,
      position: field.position || 0,
      value: field.value !== undefined ? field.value : '',
      info: field.info || '',
    };

    // Handle options for dropdown/select fields
    if (field.options && Array.isArray(field.options)) {
      formField.options = field.options;
    }

    // Handle fetch configuration for dynamic dropdowns
    if (field.fetch) {
      formField.fetch = field.fetch;
    }

    // Handle dependencies - Fix the backend template format
    // The backend template has incorrect dependency format (arrays instead of pipe-separated strings)
    if (field.depends_key && field.depends_value) {
      formField.depends_key = Array.isArray(field.depends_key)
        ? field.depends_key
        : [field.depends_key];

      // Fix the depends_value format
      // Backend sends: ["daily", "days_in_a_month", "yearly"]
      // But should send: ["daily|days_in_a_month|yearly"]
      if (Array.isArray(field.depends_value)) {
        // If it's an array with multiple values, join them with pipe
        if (field.depends_value.length > 1 && formField.depends_key.length === 1) {
          formField.depends_value = [field.depends_value.join('|')];
        } else {
          formField.depends_value = field.depends_value;
        }
      } else {
        formField.depends_value = [field.depends_value];
      }
    }

    // Add grid column for layout (default to full width)
    formField.gridColumn = 'span-12';

    fields.push(formField as FormField);
  });

  return {
    title: 'Scheduler Configuration',
    description: 'Configure your workflow scheduler',
    fields: fields.sort((a, b) => a.position - b.position),
  };
};

/**
 * Map backend field types to DynamicForm field types
 */
const mapFieldType = (backendType: string): string => {
  const typeMap: Record<string, string> = {
    'text': 'text',
    'dropdown': 'combobox',
    'multi-dropdown': 'multi-select-combobox',
    'time': 'time',
    'date': 'multi-date',
    'multi-date': 'multi-date',  // Backend sends multi-date directly
    'multi-input': 'multi-input',
    'switch': 'switch',
    'number': 'number',
    'email': 'email',
    'textarea': 'textarea',
  };

  return typeMap[backendType] || 'text';
};

/**
 * Transform form data to backend payload format with nested settings
 * @param formData - Form data from DynamicForm
 * @param payloadTemplate - Payload template from backend
 * @returns Payload object ready for backend API
 */
export const transformToBackendPayload = (
  formData: Record<string, any>,
  payloadTemplate: Record<string, any>
): Record<string, any> => {
  const payload: Record<string, any> = {};
  const settingsFields = ['time', 'hourly', 'weekly', 'week_days', 'days', 'months'];

  // Helper to get default empty value based on field type
  const getEmptyValue = (fieldKey: string): any => {
    // Array fields get empty array, string fields get empty string
    const arrayFields = ['weekly', 'week_days', 'days', 'months'];
    return arrayFields.includes(fieldKey) ? [] : '';
  };

  // Process template structure
  const processValue = (template: any, formData: Record<string, any>, includeEmpty: boolean = false): any => {
    if (typeof template === 'string') {
      const match = template.match(/^{{(.*)}}$/);
      if (match && match[1]) {
        const fieldKey = match[1];
        let value = formData[fieldKey];

        // Special handling for days field - convert to array if needed
        if (fieldKey === 'days' && value) {
          if (typeof value === 'string') {
            // Convert comma-separated string to array
            value = value.split(',').map(d => d.trim()).filter(d => d);
          } else if (Array.isArray(value)) {
            // Already an array, ensure strings
            value = value.map(d => String(d));
          }
        }

        // Return value or empty default
        if (value !== undefined && value !== null && value !== '') {
          return value;
        } else if (includeEmpty && settingsFields.includes(fieldKey)) {
          return getEmptyValue(fieldKey);
        }
      }
      return undefined;
    } else if (typeof template === 'object' && !Array.isArray(template)) {
      const result: Record<string, any> = {};
      Object.entries(template).forEach(([key, val]) => {
        const processed = processValue(val, formData, includeEmpty);
        if (processed !== undefined) {
          result[key] = processed;
        }
      });
      return Object.keys(result).length > 0 ? result : undefined;
    }
    return template;
  };

  // If the payload template has settings, use it as-is
  if (payloadTemplate.settings) {
    Object.entries(payloadTemplate).forEach(([key, template]) => {
      if (key === 'settings') {
        // Process settings with empty defaults
        const processed = processValue(template, formData, true);
        payload[key] = processed || {};
      } else {
        const processed = processValue(template, formData, false);
        if (processed !== undefined) {
          payload[key] = processed;
        }
      }
    });

    // Ensure all settings fields exist with proper empty values
    if (payload.settings) {
      settingsFields.forEach(field => {
        if (!(field in payload.settings)) {
          payload.settings[field] = getEmptyValue(field);
        }
      });
    }
  } else {
    // Old format - manually create nested structure
    const settings: Record<string, any> = {};

    // Initialize all settings fields with empty values
    settingsFields.forEach(field => {
      settings[field] = getEmptyValue(field);
    });

    Object.entries(payloadTemplate).forEach(([key, template]) => {
      const match = String(template).match(/^{{(.*)}}$/);
      if (match && match[1]) {
        const fieldKey = match[1];
        let value = formData[fieldKey];

        // Check if this field should go in settings
        if (settingsFields.includes(fieldKey)) {
          // Special handling for days field
          if (fieldKey === 'days' && value) {
            if (typeof value === 'string') {
              value = value.split(',').map(d => d.trim()).filter(d => d);
            } else if (Array.isArray(value)) {
              value = value.map(d => String(d));
            }
          }

          // Only override empty value if we have actual data
          if (value !== undefined && value !== null && value !== '') {
            settings[fieldKey] = value;
          }
        } else {
          // Non-settings fields only added if they have values
          if (value !== undefined && value !== null && value !== '') {
            payload[key] = value;
          }
        }
      }
    });

    // Always add settings object with all fields
    payload.settings = settings;
  }

  return payload;
};

/**
 * Get changes between original and new payload for documentation
 * This helps identify what fields are being sent to backend
 */
export const getPayloadChanges = (
  formData: Record<string, any>,
  payloadTemplate: Record<string, string>
): { field: string; formValue: any; payloadKey: string }[] => {
  const changes: { field: string; formValue: any; payloadKey: string }[] = [];

  Object.entries(payloadTemplate).forEach(([payloadKey, template]) => {
    const match = template.match(/^{{(.*)}}$/);
    if (match && match[1]) {
      const fieldKey = match[1];
      const value = formData[fieldKey];

      // Only include fields that have values
      if (value !== undefined && value !== null && value !== '') {
        changes.push({
          field: fieldKey,
          formValue: value,
          payloadKey: payloadKey,
        });
      }
    }
  });

  return changes;
};

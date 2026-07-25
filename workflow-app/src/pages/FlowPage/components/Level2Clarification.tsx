import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { AlternativeSelect } from '@/components/ui/alternative-select';
import { MultiSelectCombobox } from '@/components/ui/multi-select';
import { Upload, Paperclip, X, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/controllers/API/api';
import type { Clarification, ClarificationNode, CompileUserRequestResponse, UploadedFile } from '@/controllers/API/orchestrationApi';

interface Level2ClarificationProps {
  clarification: Clarification;
  apiResponse: CompileUserRequestResponse | null;
  clarificationNodes: ClarificationNode[];
  nodeConfigAnswers: { [key: string]: any };
  isHistoryItem: boolean;
  historySelectedAnswers: { [key: string]: any };
  messageId: string;
  isLoading: boolean;
  onNodeConfigChange: (field: string, value: any, label?: string) => void;
  onFileUpload: (file: File, field: string) => void;
  onSubmit: () => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

export function Level2Clarification({
  clarification,
  apiResponse,
  clarificationNodes,
  nodeConfigAnswers,
  isHistoryItem,
  historySelectedAnswers,
  messageId,
  isLoading,
  onNodeConfigChange,
  onFileUpload,
  onSubmit,
  setUploadedFiles
}: Level2ClarificationProps) {
  const missingFields = clarification.missing_fields || [];
  const fileInputId = `file-input-${messageId}`;

  // Safety check: If node_ref is null, don't render the component
  if (!clarification.node_ref) {
    return (
      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-xs text-destructive">Error: Missing node reference in clarification data.</p>
      </div>
    );
  }


  // Get the node template from response data
  const nodeTemplate = useMemo(() => {
    if (!apiResponse) {
      return null;
    }

    // The clarification.node_ref.id is like "n2" which matches pipeline.nodes[].id
    // We need to find the corresponding node in data.data.nodes which has the full template
    
    // First, find the basic node info from pipeline.nodes
    const pipelineNode = apiResponse.pipeline?.nodes?.find((n: any) => n.id === clarification.node_ref?.id);
    
    if (!pipelineNode) {
      return null;
    }

    // Now find the full node data in data.data.nodes by matching node_id
    const fullNodes = (apiResponse?.data as any)?.data?.nodes || [];
    const matchingNode = fullNodes.find((n: any) => {
      // Match by node_id (like "postgres-sql") or by checking if the id matches
      // pipelineNode might have node_uid in some responses
      const pipelineNodeUid = (pipelineNode as any).node_uid;
      return n.data?.node_id === pipelineNode.node_id || 
             (pipelineNodeUid && n.id === pipelineNodeUid) ||
             n.data?.node_id === clarification.node_ref?.node_id;
    });



    return matchingNode?.data?.node?.template || null;
  }, [apiResponse, clarification.node_ref?.id, clarification.node_ref?.node_id]);

  // State for dynamic options for each field
  const [fieldOptions, setFieldOptions] = useState<Record<string, any[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

  // Track which fields have been fetched to prevent duplicate calls
  const fetchedFieldsRef = useRef<Set<string>>(new Set());

  // Template string replacement utility
  const replaceTemplateStrings = useCallback((obj: any, values: Record<string, any>): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || '');
    }
    if (Array.isArray(obj)) {
      return obj.map(item => replaceTemplateStrings(item, values));
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = replaceTemplateStrings(v, values);
      }
      return result;
    }
    return obj;
  }, []);

  // Extract dependencies from fetch params
  const getDependencies = useCallback((fieldConfig: any): string[] => {
    if (!fieldConfig?.fetch) return [];

    const deps: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;

    const extract = (value: any) => {
      if (typeof value === 'string') {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(value)) !== null) {
          deps.push(match[1]);
        }
      } else if (Array.isArray(value)) {
        value.forEach(extract);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(extract);
      }
    };

    extract(fieldConfig.fetch.params);
    return Array.from(new Set(deps));
  }, []);

  // Fetch dynamic options for a field
  const fetchFieldOptions = useCallback(async (fieldKey: string, fieldConfig: any, formValues: Record<string, any>) => {
    if (!fieldConfig.fetch) return;

    // Create a cache key based on field and current dependency values
    const deps = getDependencies(fieldConfig);
    const cacheKey = `${fieldKey}_${deps.map(d => `${d}:${formValues[d]}`).join('_')}`;

    // Skip if already fetched with same dependencies
    if (fetchedFieldsRef.current.has(cacheKey)) {
      return;
    }

    setLoadingFields(prev => ({ ...prev, [fieldKey]: true }));
    try {
      const resolvedParams = replaceTemplateStrings(fieldConfig.fetch.params, formValues);
      const endpoint = `/${fieldConfig.fetch.module}/${fieldConfig.fetch.klass}`;

      const response = await api.post(endpoint, resolvedParams);

      // Handle different response formats
      let options: any[] = [];
      const result = response.data;

      if (Array.isArray(result)) {
        if (result.length > 0 && typeof result[0] === 'object' && 'label' in result[0]) {
          options = result;
        } else {
          options = result.map((item: any) => ({
            label: String(item),
            value: String(item)
          }));
        }
      } else if (result?.data && Array.isArray(result.data)) {
        if (result.data.length > 0 && typeof result.data[0] === 'object' && 'label' in result.data[0]) {
          options = result.data;
        } else {
          options = result.data.map((item: any) => ({
            label: String(item),
            value: String(item)
          }));
        }
      }

      setFieldOptions(prev => ({ ...prev, [fieldKey]: options }));
      fetchedFieldsRef.current.add(cacheKey);
    } catch (error) {
      console.error(`Failed to fetch options for ${fieldKey}:`, error);
      toast.error(`Failed to load options for ${fieldKey}`);
    } finally {
      setLoadingFields(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [getDependencies, replaceTemplateStrings]);

  // Check if field dependencies are met
  const checkDependencies = useCallback((fieldConfig: any, formValues: Record<string, any>) => {
    if (!fieldConfig.fetch) return true;

    const dependencies = getDependencies(fieldConfig);

    // Check if all dependencies have values
    return dependencies.every(dep => {
      const value = formValues[dep];
      return value !== undefined && value !== null && value !== '';
    });
  }, [getDependencies]);

  // Fetch options when dependencies change with proper chaining
  useEffect(() => {
    if (!nodeTemplate) return;

    // Build form values from current state and existing config
    const existingConfig = clarificationNodes.find((n: any) => n.id === clarification.node_ref?.id)?.config || {};
    const formValues: Record<string, any> = isHistoryItem
      ? { ...existingConfig, ...historySelectedAnswers }
      : { ...existingConfig, ...nodeConfigAnswers };

    // Group fields by their dependency level for proper chaining
    const fieldsByLevel: { [level: number]: string[] } = {};

    missingFields.forEach(fieldKey => {
      const fieldConfig = nodeTemplate[fieldKey];
      if (!fieldConfig?.fetch) return;

      const dependencies = getDependencies(fieldConfig);

      // Fields with no dependencies are level 0
      // Fields depending only on existing config are level 0
      // Fields depending on missing fields are higher levels
      const dependsOnMissingFields = dependencies.filter(dep => missingFields.includes(dep));
      const level = dependsOnMissingFields.length === 0 ? 0 : dependsOnMissingFields.length;

      if (!fieldsByLevel[level]) {
        fieldsByLevel[level] = [];
      }
      fieldsByLevel[level].push(fieldKey);
    });

    // Fetch fields level by level
    const fetchByLevel = async () => {
      const levels = Object.keys(fieldsByLevel).map(Number).sort((a, b) => a - b);

      for (const level of levels) {
        const fieldsAtLevel = fieldsByLevel[level];

        // Fetch all fields at this level in parallel
        const fetchPromises = fieldsAtLevel.map(fieldKey => {
          const fieldConfig = nodeTemplate[fieldKey];
          if (!fieldConfig?.fetch) return Promise.resolve();

          // Check if dependencies are met
          if (checkDependencies(fieldConfig, formValues)) {
            return fetchFieldOptions(fieldKey, fieldConfig, formValues);
          }
          return Promise.resolve();
        });

        // Wait for all fetches at this level to complete before moving to next level
        await Promise.all(fetchPromises);
      }
    };

    fetchByLevel();
  }, [nodeTemplate, missingFields, nodeConfigAnswers, historySelectedAnswers, isHistoryItem, fetchFieldOptions, checkDependencies, clarification.node_ref?.id, clarificationNodes, getDependencies]);

  // Build form values for dependency checking
  const existingConfig = clarificationNodes.find((n: any) => n.id === clarification.node_ref?.id)?.config || {};
  const formValues: Record<string, any> = isHistoryItem
    ? { ...existingConfig, ...historySelectedAnswers }
    : { ...existingConfig, ...nodeConfigAnswers };

  return (
    <div className="mt-3 space-y-3">
      <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
        <p className="text-xs font-semibold mb-1">Node: {clarification.node_ref?.name || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground">Type: {clarification.node_ref?.node_id || 'Unknown'}</p>
      </div>

      {missingFields.map((field) => {
        // Get field configuration from template
        const fieldConfig = nodeTemplate?.[field];

        // Check if this field is a file upload field
        const isFileField = field === 'file_name' || fieldConfig?.type === 'upload';

        // Use history answer if available, otherwise use current state
        const currentValue = isHistoryItem
          ? (historySelectedAnswers[field] || '')
          : (nodeConfigAnswers[field] || '');

        // Get field type from template
        const fieldType = fieldConfig?.type || 'text';
        const fieldLabel = fieldConfig?.display_name || field.replace(/_/g, ' ');
        const fieldPlaceholder = fieldConfig?.placeholder || `Enter ${fieldLabel}`;

        // Use dynamic options if available, otherwise fall back to static options from template
        const options = fieldOptions[field] || fieldConfig?.options || [];
        const isFieldLoading = loadingFields[field] || false;
        const dependenciesMet = fieldConfig ? checkDependencies(fieldConfig, formValues) : true;



        return (
          <div key={field} className="space-y-2">
            <Label className="text-xs font-semibold">
              {fieldLabel}:
            </Label>

            {isFileField ? (
              // File upload button with hidden input
              <div className="space-y-2">
                {!isHistoryItem && (
                  <>
                    <input
                      id={`${fileInputId}-${field}`}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onFileUpload(file, field);
                          // Reset input
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => document.getElementById(`${fileInputId}-${field}`)?.click()}
                      className="w-full px-3 py-2 text-xs border border-border rounded-md bg-background hover:bg-muted transition flex items-center justify-center gap-2"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {currentValue ? 'Change File' : 'Upload File'}
                    </button>
                  </>
                )}
                {currentValue && (
                  <div className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                    isHistoryItem 
                      ? "bg-muted/50 border border-border/50" 
                      : "bg-primary/10 border border-primary/20"
                  )}>
                    <Paperclip className="h-3 w-3" />
                    <span className="flex-1 truncate">{currentValue}</span>
                    {!isHistoryItem && (
                      <button
                        onClick={() => {
                          onNodeConfigChange(field, '');
                          // Also remove from uploaded files
                          setUploadedFiles(prev => prev.filter(f => f.file_name !== currentValue));
                        }}
                        className="hover:bg-destructive/10 rounded p-0.5 transition"
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : fieldType === 'dropdown' || fieldType === 'combobox' ? (
              // Dropdown field with AlternativeSelect
              <AlternativeSelect
                options={options}
                value={currentValue}
                onChange={(value) => {
                  if (!isHistoryItem) {
                    // Find the selected option to get its label
                    const selectedOption = options.find((opt: any) => opt.value === value);
                    const label = selectedOption?.label || value;
                    onNodeConfigChange(field, value, label);
                  }
                }}
                placeholder={fieldPlaceholder}
                isLoading={isFieldLoading}
                disabled={isHistoryItem || !dependenciesMet}
                className="w-full"
              />
            ) : fieldType === 'multi-dropdown' ? (
              // Multi-select dropdown with search
              <MultiSelectCombobox
                options={options}
                value={Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : [])}
                onChange={(value) => {
                  if (!isHistoryItem) {
                    // Find labels for all selected values
                    const valueArray = Array.isArray(value) ? value : [value];
                    const labels = valueArray.map(val => {
                      const selectedOption = options.find((opt: any) => opt.value === val);
                      return selectedOption?.label || val;
                    });
                    const labelString = labels.join(', ');
                    onNodeConfigChange(field, value, labelString);
                  }
                }}
                placeholder={fieldPlaceholder}
                searchPlaceholder="Search..."
                emptyText="No options found"
                isLoading={isFieldLoading}
                disabled={isHistoryItem || !dependenciesMet}
              />
            ) : fieldType === 'textarea' ? (
              // Textarea for longer text input
              <textarea
                value={currentValue}
                onChange={(e) => !isHistoryItem && onNodeConfigChange(field, e.target.value)}
                placeholder={fieldPlaceholder}
                disabled={isHistoryItem}
                rows={3}
                className={cn(
                  "w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y",
                  isHistoryItem && "bg-muted/50 cursor-not-allowed opacity-75"
                )}
              />
            ) : fieldType === 'number' ? (
              // Number input
              <input
                type="number"
                value={currentValue}
                onChange={(e) => !isHistoryItem && onNodeConfigChange(field, e.target.value)}
                placeholder={fieldPlaceholder}
                disabled={isHistoryItem}
                className={cn(
                  "w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isHistoryItem && "bg-muted/50 cursor-not-allowed opacity-75"
                )}
              />
            ) : (
              // Text input for other fields (default)
              <input
                type="text"
                value={currentValue}
                onChange={(e) => !isHistoryItem && onNodeConfigChange(field, e.target.value)}
                placeholder={fieldPlaceholder}
                disabled={isHistoryItem}
                className={cn(
                  "w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isHistoryItem && "bg-muted/50 cursor-not-allowed opacity-75"
                )}
              />
            )}
          </div>
        );
      })}

      {/* Submit Button for Level-2 Clarification - Show for non-history items */}
      {!isHistoryItem && (
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full h-9 text-sm mt-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Configuration
            </>
          )}
        </button>
      )}
    </div>
  );
}

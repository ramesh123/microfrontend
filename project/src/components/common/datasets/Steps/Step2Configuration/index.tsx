// src/components/common/datasets/Steps/Step2Configuration/index.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { getNodeDetails, performDatabaseAction, getDataPreview } from '@/controllers/API/datasetApi';
import { NodeDetails, TemplateField, ColumnDataResponse } from '@/types/dataset';
import DatasetStepLoading from '@/components/common/datasets/DatasetStepLoading';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Form, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox } from '@/components/ui/comboboxV2';
import { Database, FileText, Play, Table } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  createFileDatasetApi,
  shouldSkipCascadeRefetchForChangedKey,
  shouldSkipExcelActionsTriggerForChangedField,
} from '@/controllers/API/apiService';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';


// Helper function to determine file accept types based on field configuration
const getFileAcceptTypes = (field: TemplateField): string => {
    // Default to common file types if not specified
    const defaultTypes = '.csv,.xlsx,.json,.xml,.txt';
    
    // You can customize this based on field properties or node type
    if (field.key.includes('csv')) return '.csv';
    if (field.key.includes('excel') || field.key.includes('xlsx')) return '.xlsx';
    if (field.key.includes('json')) return '.json';
    if (field.key.includes('xml')) return '.xml';
    
    return defaultTypes;
};
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import SmartCellRenderer from '@/components/core/cellRenderer';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/theme';
import InputUpload from '@/components/core/inputUpload';
import { uploadFile } from '@/controllers/API/datasetApi';
import { ConnectionConfigDialog, ConnectionConfig } from './ConnectionConfigDialog';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MultiSelectCombobox } from '@/components/ui/multi-select';

const replacePlaceholdersForPreview = (obj: any, dependencies: Record<string, any>): { finalParams: any, success: boolean, missingKeys: string[] } => {
    const newObj = JSON.parse(JSON.stringify(obj));
    const missingKeys: string[] = [];
    let success = true;

    const traverse = (currentObj: any) => { 
        for (const key in currentObj) { 
            if (typeof currentObj[key] === 'string') {
                const match = currentObj[key].match(/^{{(.*)}}$/);
                if (match) { 
                    const depKey = match[1];
                    if (dependencies[depKey] === undefined || dependencies[depKey] === null || dependencies[depKey] === '') {
                        // For preview, we'll be more lenient - try to use a default or skip
                        missingKeys.push(depKey);
                        
                        // Try to provide reasonable defaults for common keys
                        if (depKey === 'name' && dependencies['datasetName']) {
                            currentObj[key] = dependencies['datasetName'];
                        } else if (depKey === 'limit') {
                            currentObj[key] = '100'; // Default limit
                        } else {
                            // For preview, we can try to continue with empty string or remove the key
                            currentObj[key] = '';
                        }
                    } else {
                        currentObj[key] = dependencies[depKey];
                    }
                }
            } else if (typeof currentObj[key] === 'object' && currentObj[key] !== null) {
                traverse(currentObj[key]);
            }
        }
    };
    traverse(newObj);

    // Only fail if critical keys are missing (not just any missing key)
    const criticalKeys = ['connection', 'database', 'schema', 'table'];
    const criticalMissing = missingKeys.filter(key => criticalKeys.includes(key));
    
    if (criticalMissing.length > 0) {  
        success = false;
        console.warn(
            `[Preview Warning] Critical placeholders missing: ${criticalMissing.join(', ')}`,
            { missingKeys, all_form_values: dependencies }
        );
    } else if (missingKeys.length > 0) {
        console.info(
            `[Preview Info] Some optional placeholders were replaced with defaults: ${missingKeys.join(', ')}`,
            { missingKeys, all_form_values: dependencies }
        );
    }

    return { finalParams: newObj, success, missingKeys };
};

// Keep the original strict function for final form submission
const replacePlaceholders = (obj: any, dependencies: Record<string, any>): { finalParams: any, success: boolean } => {
    
    let success = true;
    let failingKey: string | null = null;
    const newObj = JSON.parse(JSON.stringify(obj));

    const traverse = (currentObj: any) => { 
        if (!success) return;
        for (const key in currentObj) {
            if (typeof currentObj[key] === 'string') {
                const match = currentObj[key].match(/^{{(.*)}}$/);
                if (match) {
                    const depKey = match[1];
                    if (dependencies[depKey] === undefined || dependencies[depKey] === null) {
                        failingKey = depKey;
                        success = false;
                        return;
                    }
                    currentObj[key] = dependencies[depKey];
                }
            } else if (typeof currentObj[key] === 'object' && currentObj[key] !== null) {
                traverse(currentObj[key]);
            }
        }
    };

    traverse(newObj);

    if (!success) {
        console.error(
            `[Form Validation Failed] The placeholder '{{${failingKey}}}' could not be replaced. Its value was missing (null or undefined) in the form data.`,
            { all_form_values: dependencies }
        );
    }

    return { finalParams: newObj, success };
};

const FETCH_MODE_FIELD_KEYS = new Set(['fetch_type', 'fetch']);

function getFetchType(values: Record<string, any>): string {
    const raw = values.fetch_type ?? values.fetch;
    if (raw == null || String(raw).trim() === '') return '';
    return String(raw).toLowerCase();
}

function getAllTemplateFieldsFromNode(nodeDetails: NodeDetails | null): TemplateField[] {
    if (!nodeDetails?.node?.template) return [];
    const template = nodeDetails.node.template;
    if (Array.isArray(template)) {
        return template.filter(
            (f): f is TemplateField => f && typeof f === 'object' && 'key' in f,
        );
    }
    if (typeof template === 'object') {
        return Object.values(template).filter(
            (f): f is TemplateField => f && typeof f === 'object' && 'key' in f,
        );
    }
    return [];
}

function getEmptyTemplateFieldValue(field: TemplateField): unknown {
    if (field.type === 'checkbox') return false;
    if (field.type === 'multi-dropdown') return [];
    return '';
}

function clearFieldsHiddenByDependencies(
    form: {
        setValue: (
            name: string,
            value: unknown,
            options?: { shouldDirty?: boolean; shouldValidate?: boolean },
        ) => void;
    },
    allFields: TemplateField[],
    formValues: Record<string, any>,
    preserveKeys: Set<string> = new Set(['mode', 'datasetName']),
) {
    allFields.forEach((field) => {
        if (!field.key || preserveKeys.has(field.key)) return;
        const fieldForCheck = {
            ...field,
            depends_key: field.depends_key || field.depends_on,
        };
        if (checkFieldDependencies(fieldForCheck, formValues)) return;
        form.setValue(field.key, getEmptyTemplateFieldValue(field), {
            shouldDirty: true,
            shouldValidate: false,
        });
    });
}

function applyFetchTypeSideEffects(
    form: {
        setValue: (
            name: string,
            value: unknown,
            options?: { shouldDirty?: boolean; shouldValidate?: boolean },
        ) => void;
    },
    formValues: Record<string, any>,
    nodeDetails: NodeDetails,
    callbacks: {
        clearTableSchema: () => void;
        clearTableColumns: () => void;
        clearPreview: () => void;
        clearDynamicOptions?: (keys: string[]) => void;
    },
) {
    const fetchType = getFetchType(formValues);
    const allFields = getAllTemplateFieldsFromNode(nodeDetails);
    clearFieldsHiddenByDependencies(form, allFields, formValues);

    if (fetchType === 'query') {
        form.setValue('table', '', { shouldDirty: true, shouldValidate: false });
        callbacks.clearDynamicOptions?.(['table']);
    } else if (fetchType === 'table') {
        form.setValue('query', '', { shouldDirty: true, shouldValidate: false });
    }

    callbacks.clearTableSchema();
    callbacks.clearTableColumns();
    callbacks.clearPreview();
}

function sanitizeConfigForFetchType(config: Record<string, any>): Record<string, any> {
    const fetchType = getFetchType(config);
    const out = { ...config };
    if (fetchType === 'query') {
        out.table = '';
    } else if (fetchType === 'table') {
        out.query = '';
    }
    return out;
}

function ensurePayloadDataObject(payload: Record<string, any>): Record<string, any> {
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        payload.data = {};
    }
    return payload.data as Record<string, any>;
}

function sanitizeDatabasePreviewPayload(payload: Record<string, any>, formData: Record<string, any>): void {
    const fetchType = getFetchType(formData);
    delete payload.fetch_type;

    const data = ensurePayloadDataObject(payload);
    if (fetchType) {
        data.fetch_type = fetchType;
    }

    if (fetchType === 'query') {
        payload.table = '';
        data.table = '';
    } else if (fetchType === 'table') {
        payload.query = '';
    }
}

/** Merge form state into postgresql-actions params (data.fetch_type, query, data.*, connection). */
const syncDatabaseActionParamsFromForm = (finalParams: any, formValues: Record<string, any>) => {
    if (!finalParams || typeof finalParams !== 'object') return;

    const sanitized = sanitizeConfigForFetchType(formValues);
    const fetchType = getFetchType(sanitized);

    const applyToPayload = (payload: Record<string, any>) => {
        delete payload.fetch_type;

        const data = ensurePayloadDataObject(payload);
        if (fetchType) {
            data.fetch_type = fetchType;
        }

        if (sanitized.connection !== undefined && sanitized.connection !== null && sanitized.connection !== '') {
            payload.connection = sanitized.connection;
        }

        if (sanitized.database != null && sanitized.database !== '') {
            data.database = sanitized.database;
        }
        if (sanitized.schema != null && sanitized.schema !== '') {
            data.schema = sanitized.schema;
        }

        if (fetchType === 'query') {
            const q = typeof sanitized.query === 'string' ? sanitized.query.trim() : '';
            if (q) payload.query = q;
            payload.table = '';
            data.table = '';
        } else if (fetchType === 'table') {
            payload.query = '';
            if (sanitized.table != null) {
                payload.table = sanitized.table;
                data.table = sanitized.table;
            }
        } else {
            const q = typeof sanitized.query === 'string' ? sanitized.query.trim() : '';
            if (q) payload.query = q;
            if (sanitized.table != null && sanitized.table !== '') {
                payload.table = sanitized.table;
                data.table = sanitized.table;
            }
        }
    };

    if (finalParams.payload && typeof finalParams.payload === 'object') {
        applyToPayload(finalParams.payload);
    } else {
        applyToPayload(finalParams);
    }
};

const agTheme = themeQuartz
    .withParams({ backgroundColor: '#FAFAFA', foregroundColor: '#361008CC', browserColorScheme: 'light' }, 'light-red')
    .withParams({ backgroundColor: '#141516', foregroundColor: '#FFFFFFCC', browserColorScheme: 'dark' }, 'dark-red');

    interface Step2ConfigurationProps { 
        nodeId: string; 
        initialData: Record<string, any> | null; 
        onConfigurationComplete: (details: NodeDetails, config: Record<string, any>) => void; 
        onBack: () => void;
        previewColDefs: ColDef[];
        previewRowData: any[];
        setPreviewColDefs: React.Dispatch<React.SetStateAction<ColDef[]>>;
        setPreviewRowData: React.Dispatch<React.SetStateAction<any[]>>;
        isEditing: boolean;
    }

const LeftPanelForm = ({
    form,
    templateFields,
    nodeDetails,
    isEditing,
    initialData,
    isFileDataset,
    clearPreview,
}: {
    form: any;
    templateFields: TemplateField[];
    nodeDetails: NodeDetails;
    isEditing: boolean;
    initialData: Record<string, any> | null;
    isFileDataset: boolean;
    clearPreview: () => void;
}) => {
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});
    const [tableSchema, setTableSchema] = useState<any[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, any>>(() => {
        // Initialize uploadedFiles from initialData when editing
        if (isEditing && initialData) {
            const files: Record<string, any> = {};
            // Check for file-related fields in initialData
            if (initialData.file_name || initialData.encrypted_file_key) {
                files['upload_file'] = {
                    file_name: initialData.file_name,
                    encrypted_file_key: initialData.encrypted_file_key
                };
            }
            return files;
        }
        return {};
    });
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [lastFetchedDeps, setLastFetchedDeps] = useState<Record<string, string>>({});
    const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
        {},
    );
    const previousWatchedValuesRef = useRef<Record<string, unknown>>({});
    const hasFetchedInitialRef = useRef(false);
    const isUpdatingRef = useRef(false);

    // Connection config dialog state
    const [isConnectionConfigOpen, setIsConnectionConfigOpen] = useState(false);
    const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(() => {
        // Initialize from initialData when editing
        if (isEditing && initialData) {
            return {
                tdate: initialData.tdate,
                tmonth: initialData.tmonth,
                date_folder_pattern: initialData.date_folder_pattern,
                date_folder_date: initialData.date_folder_date,
                date_folder_month: initialData.date_folder_month,
                move_input_to_process: initialData.move_input_to_process,
                remote_process_path: initialData.remote_process_path,
                // Include dynamic fields from template
                ...Object.fromEntries(
                    Object.entries(initialData).filter(([key]) =>
                        !['tdate', 'tmonth', 'date_folder_pattern', 'date_folder_date', 'date_folder_month', 'move_input_to_process', 'remote_process_path'].includes(key)
                    )
                )
            };
        }
        return {};
    });

    const fetchDropdownOptions = useCallback(async (field: TemplateField, dependencies: Record<string, any>) => {  //
        if (!field.fetch) return;

        // Skip upload fields - they use handleFileUpload instead
        if (field.type === 'upload') {
            return;
        }

        // Set loading state
        setLoadingFields((prev) => ({ ...prev, [field.key]: true }));

        try {
            // === NEW: Merge upload file data with dependencies (like FileNodeForm does) ===
            // Check if there are any uploaded files and merge their data
            const mergedDependencies = { ...dependencies };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {
                    if (uploadData.encrypted_file_key) mergedDependencies.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedDependencies.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedDependencies.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedDependencies.size = uploadData.size;
                }
            });
            console.log(`[fetchDropdownOptions] Merged dependencies for ${field.key}:`, mergedDependencies);

            const fetchMod = String(field.fetch.module ?? '').toLowerCase();
            const fetchKlass = field.fetch.klass != null ? String(field.fetch.klass).trim() : '';
            if (fetchMod === 'files' && !fetchKlass) {
                console.warn(`[fetchDropdownOptions] Skipping ${field.key}: files fetch missing klass`);
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                return;
            }

            // Special handling for different field types
            let modifiedParams = field.fetch.params;
            let modifiedDependencies = { ...mergedDependencies };

            // For RFC mode - provide empty values for hidden DB fields
            if (mergedDependencies.protocol_type === 'RFC' && ['table', 'columns'].includes(field.key)) {
                modifiedDependencies = {
                    ...mergedDependencies,
                    schema: mergedDependencies.schema || '',
                    search: mergedDependencies.search || '',
                    database: mergedDependencies.database || ''
                };
            }

            // For file-based fields (like sheet_name) - provide empty values for unused type-specific fields
            if (field.key === 'sheet_name' && mergedDependencies.type) {
                const currentType = mergedDependencies.type;

                if (currentType === 'sftp') {
                    // For SFTP, provide empty values for upload-specific fields
                    modifiedDependencies = {
                        ...mergedDependencies,
                        file_name: mergedDependencies.file_name || '',
                        unique_id: mergedDependencies.unique_id || '',
                        encrypted_file_key: mergedDependencies.encrypted_file_key || ''
                    };
                } else if (currentType === 'upload') {
                    // For upload, provide empty values for SFTP-specific fields
                    modifiedDependencies = {
                        ...mergedDependencies,
                        sftp: mergedDependencies.sftp || '',
                        sftp_source_path: mergedDependencies.sftp_source_path || '',
                        file_pattern: mergedDependencies.file_pattern || ''
                    };
                } else if (currentType === 'amazon_s3') {
                    // For Amazon S3, provide empty values for upload and SFTP fields
                    modifiedDependencies = {
                        ...mergedDependencies,
                        file_name: mergedDependencies.file_name || '',
                        unique_id: mergedDependencies.unique_id || '',
                        encrypted_file_key: mergedDependencies.encrypted_file_key || '',
                        sftp: mergedDependencies.sftp || '',
                        sftp_source_path: mergedDependencies.sftp_source_path || '',
                        file_pattern: mergedDependencies.file_pattern || ''
                    };
                }
            }

            if (mergedDependencies.protocol_type === 'RFC' && ['table', 'columns'].includes(field.key)) {
                const { finalParams, success } = replacePlaceholders(modifiedParams, modifiedDependencies);
                if (!success) {
                    setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                    return;
                }

                syncDatabaseActionParamsFromForm(finalParams, modifiedDependencies);

                const response = await performDatabaseAction(field.fetch.module, field.fetch.klass, finalParams);

                // Handle response format: could be array or object with 'data' property
                let options = Array.isArray(response) ? response : (response?.data || response);
                if (!Array.isArray(options)) {
                    console.warn(`Unexpected response format for ${field.key}:`, response);
                    options = [];
                }

                let icon: React.ComponentType | undefined = undefined;
                if (field.key.includes('connection')) icon = Database;
                if (field.key.includes('source')) icon = FileText;
                if (field.key.includes('table') || field.key.includes('sheet')) icon = Table;

                const formatted = options.map(opt => (typeof opt === 'object' ? {...opt, icon} : { value: opt, label: String(opt), icon }));
                setDynamicOptions(prev => ({ ...prev, [field.key]: formatted }));
                return formatted;
            }

            const { finalParams, success } = replacePlaceholders(modifiedParams, modifiedDependencies);
            if (!success) {
                console.log(`Failed to replace placeholders for ${field.key}`);
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                return;
            }

            console.log(`Calling API for ${field.key}:`, { module: field.fetch.module, klass: field.fetch.klass, finalParams });

            syncDatabaseActionParamsFromForm(finalParams, modifiedDependencies);

            const response = await performDatabaseAction(field.fetch.module, field.fetch.klass, finalParams);
            console.log(`API response for ${field.key}:`, response);

            // Handle response format: could be array or object with 'data' property
            let options = Array.isArray(response) ? response : (response?.data || response);
            if (!Array.isArray(options)) {
                console.warn(`Unexpected response format for ${field.key}:`, response);
                options = [];
            }

            let icon: React.ComponentType | undefined = undefined;
            if (field.key.includes('connection')) icon = Database;
            if (field.key.includes('source')) icon = FileText;
            if (field.key.includes('table') || field.key.includes('sheet')) icon = Table;

            const formatted = options.map(opt => (typeof opt === 'object' ? {...opt, icon} : { value: opt, label: String(opt), icon }));
            setDynamicOptions(prev => ({ ...prev, [field.key]: formatted }));
            console.log(`Set options for ${field.key}:`, formatted);
            return formatted;
        } catch (error) {
            console.error(`Failed to fetch options for ${field.key}:`, error);
            toast.error(getDisplayErrorMessage(error, `Failed to load data for ${field.display_name}.`));
            setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
            return [];
        } finally {
            setLoadingFields((prev) => ({ ...prev, [field.key]: false }));
        }
    }, [uploadedFiles]);

    const handleValueChange = (changedFieldKey: string, value: any) => {
        form.setValue(changedFieldKey, value, { shouldDirty: true });
        const updatedDependencies = { ...form.getValues(), [changedFieldKey]: value };

        if (FETCH_MODE_FIELD_KEYS.has(changedFieldKey)) {
            applyFetchTypeSideEffects(form, updatedDependencies, nodeDetails, {
                clearTableSchema: () => setTableSchema([]),
                clearTableColumns: () => setTableColumns([]),
                clearPreview,
                clearDynamicOptions: (keys) => {
                    setDynamicOptions((prev) => {
                        const next = { ...prev };
                        keys.forEach((key) => {
                            next[key] = [];
                        });
                        return next;
                    });
                    setLastFetchedDeps((prev) => {
                        const next = { ...prev };
                        keys.forEach((key) => {
                            delete next[key];
                        });
                        return next;
                    });
                },
            });
        }

        if (shouldSkipCascadeRefetchForChangedKey(changedFieldKey, updatedDependencies)) {
            return;
        }

        templateFields.forEach(field => {
            // Skip API calls for upload type fields - they handle their own uploads
            if (field.type === 'upload') {
                return;
            }

            // Check if field is visible based on dependencies before fetching
            const fieldForCheck = {
                ...field,
                depends_key: field.depends_key || field.depends_on
            };

            const willBeVisible = checkFieldDependencies(fieldForCheck, updatedDependencies);

            // If field won't be visible, don't fetch options
            if (!willBeVisible) {
                return;
            }

            // Skip API calls for DB-specific fields when protocol_type is RFC
            if (updatedDependencies.protocol_type === 'RFC' && ['database', 'schema', 'search'].includes(field.key)) {
                return; // Don't call APIs for these fields when RFC is selected
            }

            // Special handling for table field based on protocol_type
            if (field.key === 'table') {
                if (updatedDependencies.protocol_type === 'RFC') {
                    // For RFC, table should trigger when connection or protocol_type changes
                    if (['connection', 'protocol_type'].includes(changedFieldKey) && value) {
                        form.setValue(field.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                        // Clear dependency tracking to force fresh API call
                        setLastFetchedDeps(prev => ({ ...prev, [field.key]: '' }));
                        fetchDropdownOptions(field, updatedDependencies);
                    }
                } else {
                    // For other protocols, use default dependency checking
                    if (field.fetch?.params && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`)) {
                        form.setValue(field.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                        fetchDropdownOptions(field, updatedDependencies);
                    }
                }
                return;
            }
            
            // Special handling for columns field based on protocol_type
            if (field.key === 'columns') {
                if (updatedDependencies.protocol_type === 'RFC') {
                    // For RFC, columns should trigger when table changes (and connection/protocol_type exist)
                    if (changedFieldKey === 'table' && value && updatedDependencies.connection && updatedDependencies.protocol_type) {
                        form.setValue(field.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                        fetchDropdownOptions(field, updatedDependencies);
                    }
                } else {
                    // For other protocols, use default dependency checking
                    if (field.fetch?.params && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`)) {
                        form.setValue(field.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                        fetchDropdownOptions(field, updatedDependencies);
                    }
                }
                return;
            }
            
            // Default behavior for other fields
            if (field.fetch?.params && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`)) {
                form.setValue(field.key, '', { shouldDirty: true });
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));

                // Clear existing timer for this field
                if (debounceTimers.current[field.key]) {
                    clearTimeout(debounceTimers.current[field.key]);
                }

                // Special fields that need debouncing (like sheet_name for Excel)
                const shouldDebounce = field.key === 'sheet_name';
                const debounceDelay = 800; // 800ms delay

                if (shouldDebounce) {
                    debounceTimers.current[field.key] = setTimeout(() => {
                        fetchDropdownOptions(field, updatedDependencies);
                    }, debounceDelay);
                } else {
                    fetchDropdownOptions(field, updatedDependencies);
                }
            }
        });
        
        // Clear table schema and columns when relevant fields change
        if (['schema', 'table'].includes(changedFieldKey)) {
            setTableSchema([]);
            if (changedFieldKey === 'table') {
                setTableColumns([]);
            }
        }
        
        // Clear table options when protocol_type changes
        if (changedFieldKey === 'protocol_type') {
            form.setValue('table', '', { shouldDirty: true });
            setDynamicOptions(prev => ({ ...prev, table: [] }));
            setTableColumns([]);
            // Clear dependency tracking for affected fields
            setLastFetchedDeps(prev => ({ ...prev, table: '', columns: '' }));
        }
        
        // Clear dependency tracking when key fields change
        if (['connection', 'table', 'database', 'schema', 'search'].includes(changedFieldKey)) {
            setLastFetchedDeps(prev => {
                const newState = { ...prev };
                // Clear tracking for fields that depend on this changed field
                templateFields.forEach(field => {
                    if (field.fetch && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`)) {
                        delete newState[field.key];
                    }
                });
                return newState;
            });
        }
    };

    const handleFileUpload = async (field: TemplateField, file: File) => {
        if (!field.fetch) return;

        setIsUploading(prev => ({ ...prev, [field.key]: true }));
        try {
            const formData = new FormData();
            formData.append('upload_file', file);

            const { module, klass } = field.fetch;
            const response = await uploadFile(module, klass, formData);

            if (response) {
                setUploadedFiles(prev => ({ ...prev, [field.key]: response }));
                form.setValue(field.key, response.encrypted_file_key || response.file_name || file.name, { shouldDirty: true });

                // Update other fields based on upload response
                if (response.encrypted_file_key) {
                    form.setValue('encrypted_file_key', response.encrypted_file_key, { shouldDirty: true });
                }
                if (response.file_name) {
                    form.setValue('file_name', response.file_name, { shouldDirty: true });
                }
                if (response.unique_id) {
                    form.setValue('unique_id', response.unique_id, { shouldDirty: true });
                }
                if (response.size) {
                    form.setValue('size', response.size, { shouldDirty: true });
                }

                toast.success('File uploaded successfully!');

                // === NEW: Trigger refetch for dependent fields (like FileNodeForm does) ===
                const currentValues = form.getValues();
                const uploadDependencies = ['encrypted_file_key', 'file_name', 'unique_id', 'size'];

                // Create merged values with upload response for dependency checking
                const mergedValues = {
                    ...currentValues,
                    encrypted_file_key: response.encrypted_file_key,
                    file_name: response.file_name,
                    unique_id: response.unique_id,
                    size: response.size,
                };

                console.log('[Step2Configuration] File uploaded, checking dependent fields...');

                // Check all template fields for dependencies on upload response
                templateFields.forEach(dependentField => {
                    // Skip the upload field itself
                    if (dependentField.type === 'upload' || !dependentField.fetch) {
                        return;
                    }

                    // Check if this field depends on upload response data
                    const fieldParams = JSON.stringify(dependentField.fetch.params || {});
                    const dependsOnUpload = uploadDependencies.some(dep =>
                        fieldParams.includes(`{{${dep}}}`)
                    );

                    if (dependsOnUpload) {
                        console.log(`[Step2Configuration] Field '${dependentField.key}' depends on upload data`);

                        // Check if field is visible based on other dependencies
                        const fieldForCheck = {
                            ...dependentField,
                            depends_key: dependentField.depends_key || dependentField.depends_on
                        };

                        const isVisible = checkFieldDependencies(fieldForCheck, mergedValues);

                        if (isVisible) {
                            console.log(`[Step2Configuration] Field '${dependentField.key}' is visible, fetching options...`);

                            // Clear current value and options
                            form.setValue(dependentField.key, '', { shouldDirty: true });
                            setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));

                            // Trigger fetch with merged values
                            fetchDropdownOptions(dependentField, mergedValues);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('File upload failed:', error);
            toast.error(getDisplayErrorMessage(error, 'File upload failed. Please try again.'));
        } finally {
            setIsUploading(prev => ({ ...prev, [field.key]: false }));
        }
    };

    const handleFileChange = (field: TemplateField, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(field, file);
        }
    };

    const handleConnectionConfigSave = (config: ConnectionConfig) => {
        setConnectionConfig(config);
        // Update form values with connection config
        Object.entries(config).forEach(([key, value]) => {
            form.setValue(key, value, { shouldDirty: true });
        });
    };

    const handleConnectionFieldChange = (fieldKey: string, value: any) => {
        // Trigger dependent field fetching when a field changes in the dialog
        handleValueChange(fieldKey, value);
    };

    const hasConnectionConfig = Object.values(connectionConfig).some(v => v !== undefined && v !== '' && v !== false);

    // Form watch effect for auto-fetching dependent fields with debouncing
    useEffect(() => {
        const subscription = form.watch((currentValues, { name: changedFieldName }) => {
            if (!changedFieldName || !hasFetchedInitialRef.current || isUpdatingRef.current) return;

            const previousValues = previousWatchedValuesRef.current;
            const values = currentValues as Record<string, any>;

            if (JSON.stringify(values[changedFieldName]) === JSON.stringify(previousValues[changedFieldName])) {
                return;
            }

            // Merge upload file data with current values
            const mergedValues = { ...values };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {
                    if (uploadData.encrypted_file_key) mergedValues.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedValues.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedValues.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedValues.size = uploadData.size;
                }
            });

            if (changedFieldName && FETCH_MODE_FIELD_KEYS.has(changedFieldName)) {
                applyFetchTypeSideEffects(form, mergedValues, nodeDetails, {
                    clearTableSchema: () => setTableSchema([]),
                    clearTableColumns: () => setTableColumns([]),
                    clearPreview,
                    clearDynamicOptions: (keys) => {
                        setDynamicOptions((prev) => {
                            const next = { ...prev };
                            keys.forEach((key) => {
                                next[key] = [];
                            });
                            return next;
                        });
                        setLastFetchedDeps((prev) => {
                            const next = { ...prev };
                            keys.forEach((key) => {
                                delete next[key];
                            });
                            return next;
                        });
                    },
                });
            }

            templateFields.forEach((dependentField) => {
                if (dependentField.fetch && dependentField.type !== 'upload') {
                    // Extract dependencies from fetch params
                    const dependencies = (JSON.stringify(dependentField.fetch.params || {}).match(/{{(.*?)}}/g) || [])
                        .map((p: string) => p.replace(/{{|}}/g, ''));

                    // Debug logging for sheet_name
                    if (dependentField.key === 'sheet_name') {
                        console.log(`[Watch] Processing sheet_name field:`, {
                            changedFieldName,
                            dependencies,
                            fetchParams: dependentField.fetch.params
                        });
                    }

                    // Check if this field was just made visible
                    const fieldForCheck = {
                        ...dependentField,
                        depends_key: dependentField.depends_key || dependentField.depends_on
                    };
                    const wasVisible = checkFieldDependencies(fieldForCheck, previousValues);
                    const isNowVisible = checkFieldDependencies(fieldForCheck, mergedValues);
                    const justBecameVisible = !wasVisible && isNowVisible;

                    // Trigger fetch if:
                    // 1. The changed field is a dependency AND all dependencies are met, OR
                    // 2. The field just became visible (even with no dependencies)
                    // Do not treat `query` edits as a trigger — SQL is applied when the user clicks Run.
                    const depChanged =
                        dependencies.includes(changedFieldName) &&
                        changedFieldName !== 'query' &&
                        !shouldSkipExcelActionsTriggerForChangedField(
                            dependentField.fetch,
                            changedFieldName,
                            mergedValues
                        );
                    const shouldFetch = depChanged || justBecameVisible;

                    // Debug logging for sheet_name
                    if (dependentField.key === 'sheet_name') {
                        console.log(`[Watch] sheet_name shouldFetch:`, {
                            shouldFetch,
                            dependencyIncludesChanged: dependencies.includes(changedFieldName),
                            justBecameVisible,
                            wasVisible,
                            isNowVisible
                        });
                    }

                    if (shouldFetch) {
                        // Set flag to prevent recursive watch triggers
                        isUpdatingRef.current = true;

                        // Clear current value and options
                        form.setValue(dependentField.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));

                        // Reset flag after a short delay
                        setTimeout(() => {
                            isUpdatingRef.current = false;
                        }, 0);

                        // Check if all dependencies are met
                        const visibleDependencies = dependencies.filter(dep => {
                            const depField = templateFields.find(f => f.key === dep);
                            return !depField || checkFieldDependencies({
                                ...depField,
                                depends_key: depField.depends_key || depField.depends_on
                            }, mergedValues);
                        });

                        // For conditional dependencies based on 'type' field (for file datasets)
                        const currentType = mergedValues['type'];
                        const uploadDependencies = ['file_name', 'unique_id', 'encrypted_file_key', 'size'];
                        const sftpDependencies = ['sftp', 'sftp_source_path', 'file_pattern'];
                        const amazonS3Dependencies = ['amazon_s3', 'bucket_name', 'object_name'];

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
                            }
                            // If no type is selected or unknown type, include all dependencies
                            return true;
                        });

                        const allDependenciesMet = relevantDependencies.every(dep => {
                            const depValue = mergedValues[dep];
                            return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
                        });

                        // Debug logging for sheet_name
                        if (dependentField.key === 'sheet_name') {
                            console.log(`[Watch] sheet_name dependencies check:`, {
                                relevantDependencies,
                                allDependenciesMet,
                                mergedValues,
                                dependencyValues: relevantDependencies.map(dep => ({ [dep]: mergedValues[dep] }))
                            });
                        }

                        // For fields with no dependencies, always fetch when visible
                        // For fields with dependencies, only fetch when all are met
                        if (dependencies.length === 0 || allDependenciesMet) {
                            // Clear existing timer for this field
                            if (debounceTimers.current[dependentField.key]) {
                                clearTimeout(debounceTimers.current[dependentField.key]);
                            }

                            // Special fields that need debouncing (like sheet_name for Excel)
                            const shouldDebounce = dependentField.key === 'sheet_name';
                            const debounceDelay = 1200; // 1200ms delay (same as FileNodeForm)

                            if (shouldDebounce) {
                                console.log(`[Watch] Setting debounce timer for sheet_name (${debounceDelay}ms)`);
                                debounceTimers.current[dependentField.key] = setTimeout(() => {
                                    console.log(`[Watch] Debounce timer fired for sheet_name, calling fetchDropdownOptions`);
                                    fetchDropdownOptions(dependentField, mergedValues);
                                }, debounceDelay);
                            } else {
                                fetchDropdownOptions(dependentField, mergedValues);
                            }
                        }
                    }
                }
            });

            previousWatchedValuesRef.current = values;
        });

        return () => {
            subscription.unsubscribe();
            // Clear all debounce timers on cleanup
            Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, templateFields]);

    // Initialize refs and mark as ready for watching after component mounts
    useEffect(() => {
        // Set initial values
        previousWatchedValuesRef.current = form.getValues();
        // Mark as ready to watch for changes after a short delay
        const timer = setTimeout(() => {
            hasFetchedInitialRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }, [form]);

    const watchedFields = form.watch();

    // Auto-open dialog when type changes to sftp/amazon_s3
    useEffect(() => {
        const currentType = watchedFields.type;
        if (currentType === 'sftp' || currentType === 'amazon_s3') {
            // Populate config from current form values
            const currentConfig: ConnectionConfig = {
                tdate: watchedFields.tdate,
                tmonth: watchedFields.tmonth,
                date_folder_pattern: watchedFields.date_folder_pattern,
                date_folder_date: watchedFields.date_folder_date,
                date_folder_month: watchedFields.date_folder_month,
                move_input_to_process: watchedFields.move_input_to_process,
                remote_process_path: watchedFields.remote_process_path,
            };

            // Add dynamic template fields
            templateFields.forEach(field => {
                const hasTypeDependency = field.depends_key?.includes('type');
                const dependsValueArray = Array.isArray(field.depends_value) ? field.depends_value : [];
                const hasSftpOrS3Value = dependsValueArray.some((val: string) =>
                    val === 'sftp' || val === 'amazon_s3'
                );
                if (hasTypeDependency && hasSftpOrS3Value && watchedFields[field.key]) {
                    currentConfig[field.key] = watchedFields[field.key];
                }
            });

            setConnectionConfig(currentConfig);

            // Auto-open dialog only if config is empty and dialog isn't already open
            const hasExistingConfig = Object.values(currentConfig).some(v => v !== undefined && v !== '' && v !== false);
            if (!hasExistingConfig && !isConnectionConfigOpen && isFileDataset) {
                setTimeout(() => setIsConnectionConfigOpen(true), 150);
            }
        }
    }, [watchedFields.type]);

    // Sync connectionConfig when fields change
    useEffect(() => {
        const currentType = watchedFields.type;
        if (currentType === 'sftp' || currentType === 'amazon_s3') {
            const updatedConfig: ConnectionConfig = {
                tdate: watchedFields.tdate,
                tmonth: watchedFields.tmonth,
                date_folder_pattern: watchedFields.date_folder_pattern,
                date_folder_date: watchedFields.date_folder_date,
                date_folder_month: watchedFields.date_folder_month,
                move_input_to_process: watchedFields.move_input_to_process,
                remote_process_path: watchedFields.remote_process_path,
            };

            // Add dynamic fields
            templateFields.forEach(field => {
                const hasTypeDependency = field.depends_key?.includes('type');
                const dependsValueArray = Array.isArray(field.depends_value) ? field.depends_value : [];
                const hasSftpOrS3Value = dependsValueArray.some((val: string) =>
                    val === 'sftp' || val === 'amazon_s3'
                );
                if (hasTypeDependency && hasSftpOrS3Value && watchedFields[field.key]) {
                    updatedConfig[field.key] = watchedFields[field.key];
                }
            });

            setConnectionConfig(updatedConfig);
        }
    }, [watchedFields.tdate, watchedFields.tmonth, watchedFields.date_folder_pattern, watchedFields.date_folder_date, watchedFields.date_folder_month, watchedFields.move_input_to_process, watchedFields.remote_process_path, templateFields]);

    useEffect(() => {  
        templateFields.forEach(field => {
            if (!field.fetch) return;
            // Skip upload type fields - they handle their own file uploads
            if (field.type === 'upload') {  
                return;
            }

            // Check if field is visible based on dependencies before fetching
            const fieldForCheck = {
                ...field,
                depends_key: field.depends_key || field.depends_on
            };

            const isVisible = checkFieldDependencies(fieldForCheck, watchedFields);

            // If field is not visible, don't fetch options
            if (!isVisible) { 
                return;
            }

            // Skip DB-specific fields when protocol_type is RFC (but allow columns)
            if (watchedFields.protocol_type === 'RFC' && ['database', 'schema', 'search'].includes(field.key)) {
                return; // Don't call APIs for these fields when RFC is selected
            }

            // Create a unique key for tracking dependencies
            let dependenciesToCheck = [];
            let shouldFetch = false;
            
            // === UPDATED: Merge upload data for all dependency checks ===
            const mergedValuesForCheck = { ...watchedFields };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {
                    if (uploadData.encrypted_file_key) mergedValuesForCheck.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedValuesForCheck.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedValuesForCheck.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedValuesForCheck.size = uploadData.size;
                }
            });

            // Special handling for table field when protocol_type is RFC or DB
            if (field.key === 'table' && (watchedFields.protocol_type === 'RFC' || watchedFields.protocol_type === 'DB')) {
                if (watchedFields.protocol_type === 'RFC') {
                    // For RFC, only need connection and protocol_type
                    dependenciesToCheck = ['connection', 'protocol_type'];
                    const allDepsMet = dependenciesToCheck.every(dep => mergedValuesForCheck[dep]);
                    shouldFetch = allDepsMet && !dynamicOptions[field.key];
                } else {
                    // For DB, use the original dependencies from the API
                    dependenciesToCheck = (JSON.stringify(field.fetch.params || {}).match(/{{(.*?)}}/g) || []).map((p: string) => p.replace(/{{|}}/g, ''));
                    const depsNoQuery = dependenciesToCheck.filter((d: string) => d !== 'query');
                    const allDepsMet = depsNoQuery.every(dep => mergedValuesForCheck[dep]);
                    shouldFetch = allDepsMet && !dynamicOptions[field.key];
                }
            }
            // Special handling for columns field when protocol_type is RFC
            else if (field.key === 'columns' && watchedFields.protocol_type === 'RFC') {
                dependenciesToCheck = ['table', 'connection', 'protocol_type'];
                const allDepsMet = dependenciesToCheck.every(dep => mergedValuesForCheck[dep]);
                shouldFetch = allDepsMet && !dynamicOptions[field.key];
            }
            // Default behavior for other fields
            else {
                dependenciesToCheck = (JSON.stringify(field.fetch.params || {}).match(/{{(.*?)}}/g) || []).map((p: string) => p.replace(/{{|}}/g, ''));
                const depsNoQuery = dependenciesToCheck.filter((d: string) => d !== 'query');
                const allDepsMet = depsNoQuery.every(dep => mergedValuesForCheck[dep]);
                shouldFetch = allDepsMet && !dynamicOptions[field.key];
            }

            // Create a dependency signature to prevent duplicate calls
            // Use merged values for signature to include upload data (omit `query` so typing SQL does not refetch)
            const depsForSignature = dependenciesToCheck.filter((d: string) => d !== 'query');
            const depSignature = depsForSignature.map(dep => `${dep}:${mergedValuesForCheck[dep]}`).join('|');
            const currentSignature = lastFetchedDeps[field.key];

            if (shouldFetch && depSignature !== currentSignature) {
                setLastFetchedDeps(prev => ({ ...prev, [field.key]: depSignature }));
                fetchDropdownOptions(field, watchedFields);
            }
        });
    }, [watchedFields, templateFields, fetchDropdownOptions, dynamicOptions, lastFetchedDeps, uploadedFiles]);

    // Special handling for editing mode - populate dropdowns with existing data
    useEffect(() => {
        if (isEditing && initialData && templateFields.length > 0) {
            const formValues = { ...initialData };
            
            // Sort fields by dependency order (fields with fewer dependencies first)
            const sortedFields = [...templateFields].sort((a, b) => {
                const aDeps = (JSON.stringify(a.fetch?.params || {}).match(/{{(.*?)}}/g) || []).length;
                const bDeps = (JSON.stringify(b.fetch?.params || {}).match(/{{(.*?)}}/g) || []).length;
                return aDeps - bDeps;
            });

            // Process all fields - load options for those with fetch and set static options for those without
            sortedFields.forEach((field, index) => {
                // Skip upload fields in editing mode - they don't need dropdown options
                if (field.fetch && formValues[field.key] && field.type !== 'upload') {
                    setTimeout(async () => {
                        try {
                            const options = await fetchDropdownOptions(field, formValues);
                            if (options && options.length > 0) {
                                // After loading options, make sure the form value is set correctly
                                const currentFormValue = form.getValues(field.key);
                                const initialValue = formValues[field.key];
                                if (initialValue && (!currentFormValue || currentFormValue === '')) {
                                    console.log(`Setting form value for ${field.key} to:`, initialValue);
                                    form.setValue(field.key, initialValue, { shouldValidate: false, shouldDirty: false });
                                }
                            }
                        } catch (error) {
                            console.error(`Error loading options for ${field.key}:`, error);
                        }
                    }, index * 200); // Increase stagger time
                } else if (field.options && field.options.length > 0) {
                    // For fields with static options, ensure they're set in dynamicOptions
                    setDynamicOptions(prev => ({ ...prev, [field.key]: field.options }));
                }
            });
        }
    }, [isEditing, initialData, templateFields, fetchDropdownOptions, form]);

    // Force update form values when dynamic options change in editing mode
    useEffect(() => {
        if (isEditing && initialData && Object.keys(dynamicOptions).length > 0) {
            // Ensure form values are set after options are loaded
            Object.keys(initialData).forEach(key => {
                const initialValue = initialData[key];
                if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
                    // Always set the value, even if current value exists, to ensure it's properly displayed
                    form.setValue(key, initialValue, { shouldValidate: false, shouldDirty: false });
                }
            });
            
            // Trigger a form re-render by updating a dummy field
            setTimeout(() => {
                form.trigger();
            }, 100);
        }
    }, [isEditing, initialData, dynamicOptions, form]);


    useEffect(() => {  
        const fetchSchema = async () => { 
            const formVals = form.getValues();
            const fetchType = getFetchType(formVals);
            if (fetchType === 'query') {
                setTableSchema([]);
                return;
            }

            const table = formVals.table;
            if (fetchType === 'table' && !table) {
                setTableSchema([]);
                return;
            }
            const queryTrim = (formVals.query || '').trim();
            if (!fetchType && !table && !queryTrim) {
                setTableSchema([]);
                return;
            }
            // Handle both old array format and new object format for columns field
            let columnsField: TemplateField | undefined;
            if (Array.isArray(nodeDetails.node.template)) {
                columnsField = nodeDetails.node.template.find(f => f.key === 'columns');
            } else if (nodeDetails.node.template && typeof nodeDetails.node.template === 'object') {
                columnsField = Object.values(nodeDetails.node.template).find((f): f is TemplateField => 
                    f && typeof f === 'object' && 'key' in f && f.key === 'columns'
                );
            }
            if (!columnsField?.fetch) return;
            const { finalParams, success } = replacePlaceholders(columnsField.fetch.params, formVals);
            if (success) {
                try {
                    syncDatabaseActionParamsFromForm(finalParams, formVals);
                    const response = await performDatabaseAction(columnsField.fetch.module, columnsField.fetch.klass, finalParams);
                    // Handle response format: could be array or object with 'data' property
                    const schema = Array.isArray(response) ? response : (response?.data || []);
                    setTableSchema(schema);
                } catch {
                    setTableSchema([]);
                }
            }
        };
        fetchSchema();
        // Intentionally omit watchedFields.query: schema/columns APIs should not run on every
        // keystroke; users run SQL from the editor and trigger preview via the Run button.
    }, [watchedFields.table, watchedFields.fetch_type, watchedFields.fetch, nodeDetails, form]);

    // Fetch table columns when table changes
    useEffect(() => {
        const fetchTableColumns = async () => {
            const formValues = form.getValues();
            const fetchType = getFetchType(formValues);
            if (fetchType === 'query') {
                setTableColumns([]);
                return;
            }

            const table = formValues.table;
            if (fetchType === 'table' && !table) {
                setTableColumns([]);
                return;
            }
            const queryTrim = (formValues.query || '').trim();
            if (!fetchType && !table && !queryTrim) {
                setTableColumns([]);
                return;
            }
            
            // Handle both old array format and new object format for columns field
            let columnsField: TemplateField | undefined;
            if (Array.isArray(nodeDetails.node.template)) {
                columnsField = nodeDetails.node.template.find(f => f.key === 'columns');
            } else if (nodeDetails.node.template && typeof nodeDetails.node.template === 'object') {
                columnsField = Object.values(nodeDetails.node.template).find((f): f is TemplateField => 
                    f && typeof f === 'object' && 'key' in f && f.key === 'columns'
                );
            }
            
            if (!columnsField?.fetch) return;
            
            try {
                // Special handling for RFC mode - provide empty values for hidden fields
                let modifiedDependencies = formValues;
                if (formValues.protocol_type === 'RFC') {
                    modifiedDependencies = {
                        ...formValues,
                        schema: formValues.schema || '',
                        search: formValues.search || '',
                        database: formValues.database || ''
                    };
                }
                
                const { finalParams, success } = replacePlaceholders(columnsField.fetch.params, modifiedDependencies);
                if (success) {
                    syncDatabaseActionParamsFromForm(finalParams, modifiedDependencies);
                    const response = await performDatabaseAction(columnsField.fetch.module, columnsField.fetch.klass, finalParams);
                    // Handle response format: could be array or object with 'data' property
                    const columns = Array.isArray(response) ? response : (response?.data || []);
                    setTableColumns(columns);
                }
            } catch (error) {
                console.error('Error fetching table columns:', error);
                setTableColumns([]);
            }
        };
        
        fetchTableColumns();
    }, [watchedFields.table, watchedFields.fetch_type, watchedFields.fetch, nodeDetails, form]);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden p-2">
            <ScrollArea className="min-h-0 flex-1 pr-2">
                <Form {...form}>
                    <form className="space-y-2">
                        <FormItem>
                            <FormLabel className="text-xs font-medium">Dataset Name</FormLabel>
                            <Controller
                                name="datasetName"
                                control={form.control}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input
                                            className="!h-8 text-xs px-2"
                                            placeholder="Enter dataset name"
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                    </FormControl>
                                )}
                            />
                            <FormMessage />
                        </FormItem>
                        {templateFields.map((field, index) => {

                            if (!field || !field.key || !field.display_name) {
                                console.warn('Invalid field at index', index, field);
                                return null;
                            }

                            // Check field visibility based on dependencies using the utility function
                            // This ensures consistency with FileNodeForm and DynamicForm
                            if (field.visible === false) {
                                return null;
                            }

                            // Convert depends_on to depends_key for compatibility with checkFieldDependencies
                            const fieldForCheck = {
                                ...field,
                                depends_key: field.depends_key || field.depends_on
                            };

                            const isFieldVisible = checkFieldDependencies(fieldForCheck, watchedFields);

                            if (!isFieldVisible) {
                                console.log(`Field ${field.key} is hidden due to dependencies:`, {
                                    depends_key: fieldForCheck.depends_key,
                                    depends_value: field.depends_value,
                                    currentValues: watchedFields
                                });
                                return null;
                            }

                            // Check if this field should be in the dialog (has type+sftp/amazon_s3 dependency)
                            const hasTypeDependency = fieldForCheck.depends_key?.includes('type');
                            const dependsValueArray = Array.isArray(fieldForCheck.depends_value) ? fieldForCheck.depends_value : [];
                            const hasSftpOrS3Value = dependsValueArray.some((val: string) =>
                                val === 'sftp' || val === 'amazon_s3'
                            );
                            const shouldGoInDialog = hasTypeDependency && hasSftpOrS3Value && isFileDataset;

                            if (shouldGoInDialog) {
                                // Skip rendering - these fields are in the dialog
                                return null;
                            }

                            return (
                                <React.Fragment key={`${field.key}-${index}`}>
                                    <FormItem>
                                        <FormLabel className="text-xs font-medium">
                                            {field.display_name}
                                            {field.required && <span className="text-destructive">*</span>}
                                        </FormLabel>
                                <Controller 
                                    name={field.key || `field_${index}`} 
                                    control={form.control} 
                                    render={({ field: ctlField }) => {  // field.key || `field_${index}` 
                                        // Use watchedFields to get the current value, which should be more reliable
                                        const currentValue = watchedFields[field.key];
                                        const options = dynamicOptions[field.key] || field.options || [];
                                        const isLoading = loadingFields[field.key] || false;
                                        
                                        return ( 
                                            <FormControl>
                                                {field.type === 'upload' ? (
                                                    <div className="space-y-1.5">
                                                        <InputUpload
                                                            name={field.key}
                                                            accept={getFileAcceptTypes(field)}
                                                            onChange={(e) => handleFileChange(field, e)}
                                                            initialFileName={uploadedFiles[field.key]?.file_name}
                                                        />
                                                        {isUploading[field.key] && (
                                                            <div className="flex items-center gap-1.5 text-xs text-blue-600">
                                                                <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                                <span>Uploading...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : field.type === 'checkbox' ? (
                                                    <div className="flex items-center space-x-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border border-gray-300 focus:ring-2"
                                                            checked={!!currentValue}
                                                            onChange={(e) => {
                                                                ctlField.onChange(e.target.checked);
                                                                handleValueChange(field.key, e.target.checked);
                                                            }}
                                                        />
                                                    </div>
                                                ) : field.type === 'number' ? (
                                                    <Input
                                                        type="number"
                                                        className=" h-9 text-xs px-2"
                                                        placeholder={field.placeholder}
                                                        value={currentValue !== undefined && currentValue !== null ? String(currentValue) : '0'}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? '' : Number(e.target.value);
                                                            ctlField.onChange(val);
                                                            handleValueChange(field.key, val);
                                                        }}
                                                    />
                                                ) : field.type === 'text' ? (  //field.type 
                                                    <Input
                                                        className=" h-9 text-xs px-2"
                                                        placeholder={field.placeholder}
                                                        value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                                                        onChange={(e) => {
                                                            ctlField.onChange(e.target.value);
                                                            handleValueChange(field.key, e.target.value);
                                                        }}
                                                    />
                                                ) : (
                                                    <div>
                                                        {/* {field.key === 'table' ? ( */}
                                                            {/* <MultiSelectCombobox
                                                                options={options}
                                                                value={Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : [])}
                                                                onChange={(vals) => {
                                                                    ctlField.onChange(vals);
                                                                    handleValueChange(field.key, vals);
                                                                }}
                                                                placeholder={field.placeholder}
                                                                isLoading={isLoading}
                                                                allowCustomValue={false}
                                                            /> */}
                                                        {/* ) : ( */}
                                                            <Combobox
                                                                options={options}
                                                                value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                                                                onChange={(v) => {
                                                                    ctlField.onChange(v);
                                                                    handleValueChange(field.key, v);
                                                                }}
                                                                placeholder={field.placeholder}
                                                                isLoading={isLoading}
                                                                allowCustomValue={field.key === 'delimiter'}
                                                            />
                                                        {/* )} */}
                                                    </div>
                                                )}
                                            </FormControl>
                                        );
                                    }}
                                />
                                    </FormItem>

                                    {/* Show badge right after the type field */}
                                    {field.key === 'type' && isFileDataset && (watchedFields.type === 'sftp' || watchedFields.type === 'amazon_s3') && (
                                        <FormItem>
                                            <FormLabel className="text-xs font-medium">
                                                Additional Configuration
                                            </FormLabel>
                                            <div className="flex items-center gap-2">
                                                {hasConnectionConfig ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent transition-colors"
                                                        onClick={() => setIsConnectionConfigOpen(true)}
                                                    >
                                                        <span className="text-xs">
                                                            {watchedFields.type === 'sftp' ? 'SFTP' : 'S3'} Config
                                                        </span>
                                                        <Pencil className="h-3 w-3" />
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsConnectionConfigOpen(true)}
                                                        className="h-8 px-3 text-xs"
                                                    >
                                                        Configure {watchedFields.type === 'sftp' ? 'SFTP' : 'Amazon S3'}
                                                    </Button>
                                                )}
                                            </div>
                                            {hasConnectionConfig && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Click to edit configuration
                                                </div>
                                            )}
                                        </FormItem>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Old inline SFTP fields removed - now in dialog */}
                        {false && isFileDataset && (watchedFields.type === 'sftp' || watchedFields.type === 'amazon_s3') && (
                            <>
                                <FormItem>
                                    <FormLabel className="text-xs font-medium">T+Date</FormLabel>
                                    <Controller
                                        name="tdate"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter T+Date"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                        handleValueChange('tdate', e.target.value);
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                <FormItem>
                                    <FormLabel className="text-xs font-medium">T+Month</FormLabel>
                                    <Controller
                                        name="tmonth"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter T+Month"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                        handleValueChange('tmonth', e.target.value);
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                <FormItem>
                                    <FormLabel className="text-xs font-medium">Date Folder Pattern</FormLabel>
                                    <Controller
                                        name="date_folder_pattern"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter Date Folder Pattern"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                        handleValueChange('date_folder_pattern', e.target.value);
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                <FormItem>
                                    <FormLabel className="text-xs font-medium">Date Folder+Date</FormLabel>
                                    <Controller
                                        name="date_folder_date"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter Date Folder+Date"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                        handleValueChange('date_folder_date', e.target.value);
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                <FormItem>
                                    <FormLabel className="text-xs font-medium">Date Folder+Month</FormLabel>
                                    <Controller
                                        name="date_folder_month"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter Date Folder+Month"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                        handleValueChange('date_folder_month', e.target.value);
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                <FormItem>
                                    <FormLabel className="text-xs font-medium flex items-center gap-2">
                                        <Controller
                                            name="move_input_to_process"
                                            control={form.control}
                                            render={({ field }) => (
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border border-gray-300 focus:ring-2"
                                                    checked={!!field.value}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.checked);
                                                        handleValueChange('move_input_to_process', e.target.checked);
                                                    }}
                                                />
                                            )}
                                        />
                                        Move Input File To Process
                                    </FormLabel>
                                    <FormMessage />
                                </FormItem>

                                {watchedFields.move_input_to_process && (
                                    <FormItem>
                                        <FormLabel className="text-xs font-medium">Remote Process Path</FormLabel>
                                        <Controller
                                            name="remote_process_path"
                                            control={form.control}
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Input
                                                        className="h-9 text-xs px-2"
                                                        placeholder="Enter Remote Process Path"
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => {
                                                            field.onChange(e.target.value);
                                                            handleValueChange('remote_process_path', e.target.value);
                                                        }}
                                                    />
                                                </FormControl>
                                            )}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            </>
                        )}

                        {getFetchType(watchedFields) === 'table' && tableSchema.length > 0 && (
                            <div className="pt-2">
                                <h4 className="font-semibold text-xs mb-1 uppercase text-muted-foreground">
                                    {form.getValues('table')} Schema
                                </h4>
                                <div className="border rounded-md text-xs p-2 space-y-1 bg-muted/30 max-h-[13.5rem] min-h-40 overflow-y-auto">
                                    {tableSchema.map((col: any, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="font-mono text-xs">{col.name || col}</span>
                                            <span className="font-mono text-muted-foreground uppercase text-xs">
                                                {col.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {getFetchType(watchedFields) === 'table' && tableColumns.length > 0 && (
                            <div className="pt-2">
                                <h4 className="font-semibold text-xs mb-1 uppercase text-muted-foreground">
                                    {form.getValues('table')} Columns
                                </h4>
                                <div className="border rounded-md text-xs p-2 space-y-1 bg-muted/30 max-h-[13.5rem] min-h-40 overflow-y-auto">
                                    {tableColumns.map((col: any, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="font-mono text-xs">{col.label || col.value || col.name || col}</span>
                                            <span className="font-mono text-muted-foreground uppercase text-xs">
                                                {col.type || 'COLUMN'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </Form>
            </ScrollArea>

            {/* Connection Config Dialog */}
            <ConnectionConfigDialog
                open={isConnectionConfigOpen}
                onOpenChange={setIsConnectionConfigOpen}
                connectionType={(watchedFields.type === 'sftp' ? 'sftp' : 'amazon_s3') as 'sftp' | 'amazon_s3'}
                initialConfig={connectionConfig}
                onSave={handleConnectionConfigSave}
                templateFields={templateFields}
                dynamicOptions={dynamicOptions}
                loadingFields={loadingFields}
                onFieldChange={handleConnectionFieldChange}
                formValues={watchedFields}
            />
        </div>
    );
};

const PreviewGrid = ({ colDefs, rowData, isLoading }: { colDefs: ColDef[], rowData: any[], isLoading: boolean }) => {
    const hasData = colDefs.length > 0 && rowData.length > 0;
    const hasNoDataButNotLoading = !isLoading && !hasData;

    console.log('[PreviewGrid] Rendering with:', {
        isLoading,
        colDefsCount: colDefs.length,
        rowDataCount: rowData.length,
        hasData,
        hasNoDataButNotLoading
    });

    return (
        <div className="h-full flex flex-col p-2">
            <Tabs defaultValue="results" className="h-full flex flex-col">
                <TabsList className="flex-shrink-0 h-7 p-0">
                    <TabsTrigger value="results" className="text-xs px-3 py-1 h-full">
                        Results
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs px-3 py-1 h-full">
                        Query History
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="results" className="flex-grow mt-2">
                    <div className="ag-theme-quartz h-full w-full">
                        {isLoading ? (
                            <DatasetStepLoading message="Loading preview..." className="h-full w-full min-h-[200px]" />
                        ) : hasNoDataButNotLoading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm border rounded-md bg-muted/20">
                                <div className="text-center space-y-2">
                                    <p className="font-medium">No preview data available</p>
                                    <p className="text-xs">Click "Run" or "View Data" to load preview</p>
                                </div>
                            </div>
                        ) : (
                            <AgGridReact
                                rowData={rowData}
                                columnDefs={colDefs}
                                rowHeight={30}
                                headerHeight={30}
                                defaultColDef={{
                                    editable: false,
                                    cellRenderer: SmartCellRenderer,
                                    resizable: true,
                                    sortable: true,
                                    filter: true
                                }}
                                pagination={true}
                                noRowsOverlayComponent={() => (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        No rows to display
                                    </div>
                                )}
                            />
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="history" className="flex-grow mt-2">
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No Query History
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

const DatabaseSqlQueryEditor = ({
    form,
    onRunPreview,
    isPreviewLoading,
    limit,
    setLimit,
}: {
    form: ReturnType<typeof useForm<Record<string, any>>>;
    onRunPreview: () => void;
    isPreviewLoading: boolean;
    limit: string;
    setLimit: (value: string) => void;
}) => (
    <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="min-h-0 flex-1 rounded-lg border border-primary/30 bg-background p-3">
            <Controller
                name="query"
                control={form.control}
                render={({ field }) => (
                    <Textarea
                        {...field}
                        value={field.value ?? ''}
                        placeholder="Write your SQL query here"
                        className="min-h-[120px] h-full resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 font-mono text-sm"
                    />
                )}
            />
        </div>
        <div className="flex shrink-0 items-center gap-2">
            <Button
                size="sm"
                onClick={onRunPreview}
                disabled={isPreviewLoading}
                className="!h-8 px-3 text-xs"
            >
                <Play className="mr-1 h-3 w-3" />
                {isPreviewLoading ? 'Running…' : 'Run'}
            </Button>
            <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {['10', '100', '1000', '10000', '100000'].map((l) => (
                        <SelectItem key={l} value={l} className="text-xs">
                            Limit: {l}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    </div>
);

const RightPanel = ({
    form,
    queryField,
    onRunPreview,
    isPreviewLoading,
    colDefs,
    rowData,
    limit,
    setLimit,
    isFileDataset,
}: {
    form: ReturnType<typeof useForm<Record<string, any>>>;
    queryField: TemplateField | null;
    onRunPreview: () => void;
    isPreviewLoading: boolean;
    colDefs: ColDef[];
    rowData: any[];
    limit: string;
    setLimit: (value: string) => void;
    isFileDataset: boolean;
}) => {
    const watchedValues = useWatch({ control: form.control }) as Record<string, any> | undefined;
    const fetchType = getFetchType(watchedValues || {});
    const isQueryFetchMode = fetchType === 'query';
    const showSqlEditor = Boolean(queryField && !isFileDataset && isQueryFetchMode);

    const previewToolbar = (
        <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2">
            <Button
                size="sm"
                onClick={onRunPreview}
                disabled={isPreviewLoading}
                className="h-7 px-3 text-xs"
            >
                <Play className="mr-1 h-3 w-3" />
                {isPreviewLoading ? 'Loading…' : isQueryFetchMode ? 'Refresh preview' : 'View data'}
            </Button>
            {fetchType === 'table' && (
                <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                    <Table className="h-3 w-3" />
                    Table mode
                </Badge>
            )}
            {!fetchType && queryField && !isFileDataset && (
                <span className="text-[10px] text-muted-foreground">
                    Choose fetch type on the left to configure data preview
                </span>
            )}
        </div>
    );

    if (showSqlEditor) {
        return (
            <div className="flex h-full flex-col">
                <ResizablePanelGroup direction="vertical" className="h-full">
                    <ResizablePanel defaultSize={28} minSize={18} maxSize={50} className="p-2">
                        <DatabaseSqlQueryEditor
                            form={form}
                            onRunPreview={onRunPreview}
                            isPreviewLoading={isPreviewLoading}
                            limit={limit}
                            setLimit={setLimit}
                        />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={72} minSize={35} className="flex min-h-0 flex-col">
                        {previewToolbar}
                        <div className="min-h-0 flex-1">
                            <PreviewGrid
                                colDefs={colDefs}
                                rowData={rowData}
                                isLoading={isPreviewLoading}
                            />
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            {previewToolbar}
            <div className="min-h-0 flex-1">
                <PreviewGrid colDefs={colDefs} rowData={rowData} isLoading={isPreviewLoading} />
            </div>
        </div>
    );
};

const Step2Configuration = ({
    nodeId, initialData, onConfigurationComplete, onBack,
    previewColDefs, previewRowData, setPreviewColDefs, setPreviewRowData,isEditing
}: Step2ConfigurationProps) => {
    const { theme } = useTheme();
    const location = useLocation();
    const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);

    useEffect(() => {
        document.body.dataset.agThemeMode = theme.includes('dark') ? 'dark-red' : 'light-red';
    }, [theme]);


    const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    // Removed unused local state - using parent's state instead
    const [limit, setLimit] = useState('100');
    const [initialPreviewHasRun, setInitialPreviewHasRun] = useState(false);

    const clearPreview = useCallback(() => {
        setPreviewColDefs([]);
        setPreviewRowData([]);
    }, [setPreviewColDefs, setPreviewRowData]);

    // Detect if this is a file-based dataset
    const isFileDataset = useMemo(() => nodeDetails?.group === 'Files', [nodeDetails]);


    const { formFields, queryField } = useMemo(() => {  
        if (!nodeDetails) return { formFields: [], queryField: null };
        
        // Handle both old array format and new object format
        let fields: TemplateField[] = [];
        if (Array.isArray(nodeDetails.node.template)) {
            // Old format - array of fields
            fields = nodeDetails.node.template;
        } else if (nodeDetails.node.template && typeof nodeDetails.node.template === 'object') {
            // New format - object with field keys
            fields = Object.values(nodeDetails.node.template).filter((field): field is TemplateField => 
                field && typeof field === 'object' && 'key' in field
            );
        }
        
        const qField = fields.find(f => f.key === 'query') || null;
        const otherFields = fields.filter(f =>
            f && f.key && !['columns', 'name', 'query','dataset', 'mode'].includes(f.key)
        ).sort((a, b) => (a.position || 0) - (b.position || 0));
        return { formFields: otherFields, queryField: qField };
    }, [nodeDetails]);

    const form = useForm<Record<string, any>>({
        defaultValues: {
            datasetName: '',
            query: '',
            ...(initialData || {}),
            mode: 'read',
        },
    });

    // Database datasets are read-only in this stepper; keep mode in form state so
    // template fields with depends_key: ["mode"] / depends_value: ["read"] render immediately.
    useEffect(() => {
        if (isFileDataset) return;
        form.setValue('mode', 'read', { shouldValidate: false, shouldDirty: false });
    }, [form, isFileDataset]);

    // Initialize number template fields to 0 if not set
    useEffect(() => {
        if (!nodeDetails || formFields.length === 0) return;
        const currentValues = form.getValues();
        let updated = false;
        formFields.forEach(field => {
            if (field.type === 'number') {
                const val = currentValues[field.key];
                if (val === undefined || val === null || val === '') {
                    form.setValue(field.key, 0, { shouldValidate: false, shouldDirty: false });
                    updated = true;
                }
            }
        });
        if (updated) {
            form.trigger();
        }
    }, [nodeDetails, formFields, form]);

    // Enhanced effect to handle form reset when editing
    useEffect(() => { 
        if (initialData && nodeDetails) {
            // Prepare the form data with all the values from the dataset payload
            const formData: Record<string, any> = { ...initialData, mode: 'read' };
            
            // If we're editing, ensure all form fields are populated properly
            if (isEditing) {
                // Handle special field mappings
                if (formData.datasetName && !formData.name) {
                    formData.name = formData.datasetName;
                }
                
                form.reset(formData);
                
                // Set individual values to ensure they're properly set
                Object.keys(formData).forEach(key => {
                    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '') {
                        form.setValue(key, formData[key], { shouldValidate: false, shouldDirty: false });
                    }
                });
                form.setValue('mode', 'read', { shouldValidate: false, shouldDirty: false });
            } else if (!isFileDataset) {
                form.setValue('mode', 'read', { shouldValidate: false, shouldDirty: false });
                Object.keys(formData).forEach((key) => {
                    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '') {
                        form.setValue(key, formData[key], { shouldValidate: false, shouldDirty: false });
                    }
                });
            }
        }
    }, [initialData, nodeDetails, isEditing, isFileDataset, form, formFields]);

    useEffect(() => { setIsLoading(true); getNodeDetails(nodeId).then(setNodeDetails).catch(console.error).finally(() => setIsLoading(false)); }, [nodeId]);
    


    // FIXED: Updated handleRunPreview to use the more lenient validation
    const handleRunPreview = useCallback(async () => {
        if (!nodeDetails) return;
        setIsPreviewLoading(true);
        try {
            const formData = sanitizeConfigForFetchType(form.getValues());
            formFields.forEach(field => {
                if (field.type === 'number') {
                    const val = formData[field.key];
                    if (val === undefined || val === null || val === '') {
                        formData[field.key] = 0;
                    }
                }
            });
            const payload = JSON.parse(JSON.stringify(nodeDetails.node.payload));
            Object.keys(payload).forEach(key => {
                const placeholder = payload[key];
                if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {  
                    const dataKey = placeholder.replace(/{{|}}/g, '');
                    payload[dataKey] = formData[dataKey] ?? '';
                }
            });

            // For database preview: send custom SQL on the same object as data/actions/connection when present
            const queryPreview = (formData.query || '').trim();
            if (queryPreview) {
                payload.query = queryPreview;
            }

            if (!isFileDataset) {
                sanitizeDatabasePreviewPayload(payload, formData);
            }

            // For file datasets, handle both upload and SFTP types
            if (isFileDataset) { 
                const fileType = nodeDetails.node_id; // csv, excel, etc.
                const uploadType = formData.type || payload.type || 'upload'; // Determine if it's 'upload' or 'sftp'
                // Validate based on upload type
                if (uploadType === 'upload') { 
                    // For upload type, we need file upload metadata
                    if (!formData.encrypted_file_key || !formData.file_name || !formData.unique_id) { 
                        toast.error("Please upload a file before viewing data.");
                        setIsPreviewLoading(false);
                        return;
                    }
                } else if (uploadType === 'sftp') {  
                    // For SFTP type, we need SFTP path and connection
                    if (!formData.sftp && !formData.sftp_source_path && !formData.source_path) { 
                        toast.error("Please select an SFTP connection and source path before viewing data.");
                        setIsPreviewLoading(false);
                        return;
                    }
                } else if (uploadType === 'amazon_s3') {
                    // For Amazon S3 type, we need S3 connection and bucket info
                    if (!formData.amazon_s3) { 
                        toast.error("Please select an Amazon S3 connection before viewing data.");
                        setIsPreviewLoading(false);
                        return;
                    }
                }

                const fileName = formData.file_name || formData.sftp_source_path?.split('/').pop() || '';
                const fileNameWithoutExt = fileName.split('.')[0];

                // Only call create-file API for 'upload' type
                if (uploadType === 'upload') {  
                    const createFilePayload: any = { 
                        name: fileNameWithoutExt,
                        type: fileType,
                        node_id: fileType,
                        show_node: true,
                        is_dataset: true,
                        display_name: nodeDetails.display_name,
                        modules: nodeDetails.modules,
                        klass_name: nodeDetails.klass_name,
                        group: "Files",
                        unique_id: formData.unique_id,
                        file_name: fileName,
                        encrypted_file_key: formData.encrypted_file_key,
                        file_category: "source_data",
                        file_type: fileType,
                    };

                    // Add sheet_name for excel files
                    if (fileType === "excel" && formData.sheet_name) {
                        createFilePayload.sheet_name = formData.sheet_name;
                    }

                    // Add other form fields to the payload
                    if (formData.delimiter) {
                        createFilePayload.delimiter = formData.delimiter;
                    }
                    if (formData.skip_row) {
                        createFilePayload.skip_row = formData.skip_row;
                    }
                    if (formData.skip_footer) {
                        createFilePayload.skip_footer = formData.skip_footer;
                    }

                    try {
                        await createFileDatasetApi(createFilePayload);
                    } catch (fileError) {
                        console.error("Failed to create file dataset:", fileError);
                        toast.error(getDisplayErrorMessage(fileError, 'Failed to create file dataset.'));
                        setIsPreviewLoading(false);
                        return;
                    }
                }

                // Now fetch the preview data using the correct payload structure for /files/view-data
                // Build the view-data payload by replacing all placeholders in the original payload
                const viewDataPayload: any = { ...payload };

                // Replace all placeholder values with form data
                Object.keys(viewDataPayload).forEach(key => {  
                    const value = viewDataPayload[key];
                    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
                        const dataKey = value.replace(/{{|}}/g, '');
                        viewDataPayload[key] = formData[dataKey] ?? '';
                    }
                });

                // Set common fields
                viewDataPayload.skip_row = formData.skip_row || "0";
                viewDataPayload.skip_footer = formData.skip_footer || "0";
                viewDataPayload.response_type = "json";
                viewDataPayload.mode = "read";
                viewDataPayload.actions = "read_file";
                viewDataPayload.type = uploadType;

                // Set type-specific required fields
                if (uploadType === 'upload') {
                    viewDataPayload.unique_id = formData.unique_id;
                    viewDataPayload.file_name = fileName;
                    viewDataPayload.encrypted_file_key = formData.encrypted_file_key;
                } else {
                    // For SFTP and other types, set what's available
                    if (formData.unique_id) viewDataPayload.unique_id = formData.unique_id;
                    if (formData.file_name) viewDataPayload.file_name = formData.file_name;
                    if (formData.encrypted_file_key) viewDataPayload.encrypted_file_key = formData.encrypted_file_key;
                    if (fileName) viewDataPayload.file_name = fileName;
                }

                // Add sheet_name for excel files
                if (fileType === "excel" && formData.sheet_name) {
                    viewDataPayload.sheet_name = formData.sheet_name;
                }

                // Add SFTP-specific fields if present
                if (uploadType === 'sftp') {
                    if (formData.sftp) viewDataPayload.sftp = formData.sftp;
                    if (formData.sftp_source_path) viewDataPayload.sftp_source_path = formData.sftp_source_path;
                    if (formData.source_path) viewDataPayload.source_path = formData.source_path;
                    // Add all additional SFTP fields (always include them, even if empty)
                    viewDataPayload.tdate = formData.tdate || '';
                    viewDataPayload.tmonth = formData.tmonth || '';
                    viewDataPayload.date_folder_pattern = formData.date_folder_pattern || '';
                    viewDataPayload.date_folder_date = formData.date_folder_date || '';
                    viewDataPayload.date_folder_month = formData.date_folder_month || '';
                    viewDataPayload.move_input_to_process = formData.move_input_to_process || false;
                    viewDataPayload.remote_process_path = formData.remote_process_path || '';
                } else if (uploadType === 'amazon_s3') {
                    // Add Amazon S3-specific fields if present
                    if (formData.amazon_s3) viewDataPayload.amazon_s3 = formData.amazon_s3;
                    if (formData.bucket_name) viewDataPayload.bucket_name = formData.bucket_name;
                    if (formData.object_name) viewDataPayload.object_name = formData.object_name;
                    if (formData.source_path) viewDataPayload.source_path = formData.source_path;
                    // Add all additional S3 fields (always include them, even if empty)
                    viewDataPayload.tdate = formData.tdate || '';
                    viewDataPayload.tmonth = formData.tmonth || '';
                    viewDataPayload.date_folder_pattern = formData.date_folder_pattern || '';
                    viewDataPayload.date_folder_date = formData.date_folder_date || '';
                    viewDataPayload.date_folder_month = formData.date_folder_month || '';
                    viewDataPayload.move_input_to_process = formData.move_input_to_process || false;
                    viewDataPayload.remote_process_path = formData.remote_process_path || '';
                }

                // Remove columns from preview payload
                delete viewDataPayload.columns;

                // Call the view-data API
                const { module, klass } = nodeDetails.node.get_data;
                const data = await getDataPreview(module, klass, viewDataPayload);

                console.log('[Step2Configuration] Preview response:', data);
                console.log('[Step2Configuration] Columns:', data.columns);
                console.log('[Step2Configuration] Data rows:', data.data?.length);

                const gridColumns = (data.columns || []).map((col: string) => ({
                    field: col,
                    headerName: col,
                    filter: true
                }));

                console.log('[Step2Configuration] Grid columns:', gridColumns);
                console.log('[Step2Configuration] Setting preview with', gridColumns.length, 'columns and', (data.data || []).length, 'rows');

                setPreviewColDefs(gridColumns);
                setPreviewRowData(data.data || []);
                toast.success("Preview loaded successfully!");
            } else {
                // For database datasets, modify the payload with query limits
                if (payload.query && !/limit\s+\d+/i.test(payload.query)) {
                    let modifiedQuery = payload.query.replace(/;$/, '').trim();
                    payload.query = `${modifiedQuery} LIMIT ${limit}`;
                }

                // Remove columns from preview payload
                delete payload.columns;
                payload.mode = formData.mode || 'read';
                const { module, klass } = nodeDetails.node.get_data;
                const data = await getDataPreview(module, klass, { ...payload, response_type: "json" });

                console.log('[Step2Configuration] Database preview response:', data);
                console.log('[Step2Configuration] Columns:', data.columns);
                console.log('[Step2Configuration] Data rows:', data.data?.length);

                const gridColumns = (data.columns || []).map((col: string) => ({
                    field: col,
                    headerName: col,
                    filter: true
                }));

                console.log('[Step2Configuration] Grid columns:', gridColumns);
                console.log('[Step2Configuration] Setting preview with', gridColumns.length, 'columns and', (data.data || []).length, 'rows');

                // FIX: Update the parent's state instead of local state
                setPreviewColDefs(gridColumns);
                setPreviewRowData(data.data || []);
                toast.success("Preview loaded successfully!");
            }
        } catch (error) {
            console.error("Preview error:", error);
            toast.error(getDisplayErrorMessage(error, 'Could not load preview.'));
        } finally {
            setIsPreviewLoading(false);
        }
    }, [nodeDetails, limit, setPreviewColDefs, setPreviewRowData, isFileDataset, form]);

    // Disabled auto-preview for editing mode - user should manually click Run/View Data
    // useEffect(() => {
    //     if (isEditing && initialData && !initialPreviewHasRun && nodeDetails) {
    //         const timeoutId = setTimeout(() => {
    //             console.log('[Step2Configuration] Auto-running preview for edit mode');
    //             handleRunPreview().catch(error => {
    //                 console.error('[Step2Configuration] Auto-preview failed:', error);
    //             });
    //             setInitialPreviewHasRun(true);
    //         }, 500);
    //         return () => clearTimeout(timeoutId);
    //     }
    // }, [isEditing, initialData, handleRunPreview, initialPreviewHasRun, nodeDetails]);




    
    // Keep strict validation for final form submission
    const handleNext = async () => {
        if (!nodeDetails) return;
        const finalConfig = sanitizeConfigForFetchType(form.getValues());
        finalConfig.mode = 'read';

        // Ensure all number template fields default to 0 if empty/null/undefined
        formFields.forEach(field => {
            if (field.type === 'number') {
                const val = finalConfig[field.key];
                if (val === undefined || val === null || val === '') {
                    finalConfig[field.key] = 0;
                }
            }
        });
        const fetchTypeForSubmit = getFetchType(finalConfig);
        if (fetchTypeForSubmit) {
            finalConfig.fetch_type = fetchTypeForSubmit;
        }

        if (finalConfig.datasetName) {
            finalConfig.name = finalConfig.datasetName;
        }

        // Use strict validation for final submission
        const dependencies: Record<string, any> = {
            ...finalConfig,
            name: finalConfig.datasetName
        };

        // For file datasets, skip column fetching and proceed directly
        if (isFileDataset) {
            console.log('File dataset detected, skipping column fetch');

            const uploadType = finalConfig.type || 'upload';

            // Validate based on upload type
            if (uploadType === 'upload') {
                // For upload type, we need file upload metadata
                if (!finalConfig.encrypted_file_key || !finalConfig.file_name || !finalConfig.unique_id) {
                    toast.error("Please upload a file before proceeding.");
                    return;
                }
            } else if (uploadType === 'sftp') {
                // For SFTP type, ensure SFTP-specific fields are included
                // The additional fields (tdate, tmonth, date_folder_pattern, etc.) are already in finalConfig
                if (!finalConfig.sftp) {
                    toast.error("Please select an SFTP connection before proceeding.");
                    return;
                }
            } else if (uploadType === 'amazon_s3') {
                // For Amazon S3 type, ensure S3-specific fields are included
                // The additional fields (tdate, tmonth, date_folder_pattern, etc.) are already in finalConfig
                if (!finalConfig.amazon_s3) {
                    toast.error("Please select an Amazon S3 connection before proceeding.");
                    return;
                }
            }

            onConfigurationComplete(nodeDetails, finalConfig);
            return;
        }

        // Handle both old array format and new object format for columns field (for database datasets)
        let columnsField: TemplateField | undefined;
        if (Array.isArray(nodeDetails.node.template)) {
            columnsField = nodeDetails.node.template.find(f => f.key === 'columns');
        } else if (nodeDetails.node.template && typeof nodeDetails.node.template === 'object') {
            columnsField = Object.values(nodeDetails.node.template).find((f): f is TemplateField =>
                f && typeof f === 'object' && 'key' in f && f.key === 'columns'
            );
        }
        if (columnsField?.fetch) {
             const fetchToast = toast.loading("Fetching final schema...");
             try {
                // Special handling for RFC mode - provide empty values for hidden fields
                let modifiedDependencies = dependencies;
                if (dependencies.protocol_type === 'RFC') {
                    modifiedDependencies = {
                        ...dependencies,
                        schema: dependencies.schema || '',
                        search: dependencies.search || '',
                        database: dependencies.database || ''
                    };
                    console.log('RFC mode: Modified dependencies for final schema fetch:', modifiedDependencies);
                }

                const { finalParams, success } = replacePlaceholders(columnsField.fetch.params, modifiedDependencies);
                if (!success) throw new Error("Missing required fields for final submission");
                syncDatabaseActionParamsFromForm(finalParams, modifiedDependencies);
                const response = await performDatabaseAction(columnsField.fetch.module, columnsField.fetch.klass, finalParams);

                // Handle API response: {status, message, data: [...], column_mapping: [...]}
                if (response && typeof response === 'object' && 'data' in response) {
                    finalConfig.columns = response.data || [];
                    finalConfig.column_mapping = response.column_mapping || [];
                } else if (Array.isArray(response)) {
                    // Fallback for old format
                    finalConfig.columns = response.map((o: any) => (typeof o === 'object' ? o.value || o.name : o)) || [];
                } else {
                    finalConfig.columns = [];
                }

                toast.success("Schema fetched!", { id: fetchToast });
             } catch (err) {
                console.error('Schema fetch error:', err);
                // For RFC mode, don't block progression if schema fetch fails
                if (dependencies.protocol_type === 'RFC') {
                    console.log('RFC mode: Allowing progression without schema');
                    finalConfig.columns = [];
                    toast.warning("Schema fetch failed, but continuing with RFC setup", { id: fetchToast });
                } else {
                    finalConfig.columns = [];
                    toast.error(
                        getDisplayErrorMessage(err, 'Failed to fetch schema. Please ensure all required fields are filled.'),
                        { id: fetchToast },
                    );
                    return;
                }
            }
        }
        onConfigurationComplete(nodeDetails, finalConfig);
    };

    if (isLoading || !nodeDetails) return <DatasetStepLoading message="Loading configuration..." className="min-h-[60vh] w-full" />;

    return ( 
        <div className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          isVirtualDb ? 'h-[55vh]' : 'h-full',
        )}>
            <div className="flex min-h-0 flex-1 overflow-hidden p-2">
                <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 rounded-md border bg-background">
                    <ResizablePanel defaultSize={25} minSize={20} className="min-h-0 overflow-y-auto">
                        <LeftPanelForm form={form} templateFields={formFields} nodeDetails={nodeDetails} isEditing={isEditing} initialData={initialData} isFileDataset={isFileDataset} clearPreview={clearPreview} />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={75} minSize={30} className="flex min-h-0 flex-col overflow-hidden">
                    <RightPanel
                            form={form}
                            queryField={queryField}
                            onRunPreview={handleRunPreview}
                            isPreviewLoading={isPreviewLoading}
                            // FIX: Pass down the props from the parent
                            colDefs={previewColDefs}
                            rowData={previewRowData}
                            limit={limit}
                            setLimit={setLimit}
                            isFileDataset={isFileDataset}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-2">
                <Button variant="outline" onClick={onBack} className="!h-8 px-3 text-xs">Back</Button>
                <Button onClick={handleNext} className="!h-8 px-3 text-xs">Next</Button>
            </footer>
        </div>
    );
};

export default Step2Configuration;

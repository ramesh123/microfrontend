import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { getNodeDetails, performDatabaseAction, uploadFile } from '@/controllers/API/datasetApi';
import { createUploadedFileRecord, type CreateUploadedFileApiPayload } from '@/controllers/API/filesApi';
import {
  createFileDatasetApi,
  shouldSkipCascadeRefetchForChangedKey,
  shouldSkipExcelActionsTriggerForChangedField,
} from '@/controllers/API/apiService';
import { NodeDetails, TemplateField } from '@/types/dataset';
import DatasetStepLoading from '@/components/common/datasets/DatasetStepLoading';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Form, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';
import InputUpload from '@/components/core/inputUpload';
import formConfig from './file-dataset-form-config.json';
import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AlternativeSelect } from '@/components/ui/alternative-select';
import { motion, AnimatePresence } from 'framer-motion';

/** Sheet-name / get_sheet_names calls are read-path only; SFTP write should not hit excel-actions. */
const shouldSkipExcelActionsForSftpWrite = (values: Record<string, any>) =>
    String(values?.mode ?? '').toLowerCase() === 'write' &&
    String(values?.type ?? '').toLowerCase() === 'sftp';

/** Never overwrite these when dynamic dropdown options load (e.g. after file upload). */
const PRESERVE_ON_DYNAMIC_OPTIONS_SYNC = new Set([
    'mode', 'type', 'input_local', 'input_remote',
    'upload_file', 'encrypted_file_key', 'file_name', 'unique_id', 'size',
    'datasetName', 'name',
]);

const fieldAnimationVariants = {
    hidden: {
        opacity: 0,
        height: 0,
        y: -20,
        scale: 0.95
    },
    visible: {
        opacity: 1,
        height: 'auto',
        y: 0,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        height: 0,
        y: -20,
        scale: 0.95,
        transition: {
            duration: 0.2,
            ease: 'easeIn'
        }
    }
};
// Helper function to determine file accept types based on field configuration
const getFileAcceptTypes = (field: TemplateField): string => {  
    const defaultTypes = '.csv,.xlsx,.json,.xml,.txt';
    if (field.key.includes('csv')) return '.csv';
    if (field.key.includes('excel') || field.key.includes('xlsx')) return '.xlsx';
    if (field.key.includes('json')) return '.json';
    if (field.key.includes('xml')) return '.xml';
    return defaultTypes;
};

// Replace placeholders in API params with form values
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

interface Step2ConfigurationFilesProps {
    nodeId: string;
    initialData: Record<string, any> | null;
    onConfigurationComplete: (details: NodeDetails, config: Record<string, any>) => void;
    onBack: () => void;
    isEditing: boolean;
}

const Step2ConfigurationFiles = ({
    nodeId,
    initialData,
    onConfigurationComplete,
    onBack,
    isEditing
}: Step2ConfigurationFilesProps) => {   
    const location = useLocation();
    const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);
    const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, any>>(() => {
        // Initialize uploadedFiles from initialData when editing
        if (isEditing && initialData) {   
            const files: Record<string, any> = {};
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
    const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
    const [lastFetchedDeps, setLastFetchedDeps] = useState<Record<string, string>>({});
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
        {},
    );
    const previousWatchedValuesRef = useRef<Record<string, unknown>>({});
    const hasFetchedInitialRef = useRef(false);
    const isUpdatingRef = useRef(false);

    // State for sheet name options per input field
    const [inputFieldSheetOptions, setInputFieldSheetOptions] = useState<Record<string, any[]>>({});
    const [loadingInputFieldSheets, setLoadingInputFieldSheets] = useState<Record<string, boolean>>({});
    const [nodeIconData, setNodeIconData] = useState<Record<string, any> | null>(null);
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);

    // State for dynamic output fields //
    const [outputFields, setOutputFields] = useState<Array<{
        id: string;
        folder_path: string;
        output_path: string;
        output_file_pattern: string;
        tdate: string;
        tmonth: string;
    }>>(() => {
        // Check for local or remote output fields from the parent state
        const localFields = initialData?.local_output_fields;
        const remoteFields = initialData?.remote_output_fields;

        if (localFields && Array.isArray(localFields) && localFields.length > 0) {
            return localFields.map((field: any, index: number) => ({
                id: `${index + 1}`,
                folder_path: field.local_folder_path || '',
                output_path: field.local_output_path || '',
                output_file_pattern: field.local_output_file_pattern || '',
                tdate: field.local_tdate || '',
                tmonth: field.local_tmonth || ''
            }));
        } else if (remoteFields && Array.isArray(remoteFields) && remoteFields.length > 0) {
            return remoteFields.map((field: any, index: number) => ({
                id: `${index + 1}`,
                folder_path: field.remote_folder_path || '',
                output_path: field.remote_output_path || '',
                output_file_pattern: field.remote_output_file_pattern || '',
                tdate: field.remote_tdate || '',
                tmonth: field.remote_tmonth || ''
            }));
        }
        return [{ id: '1', folder_path: '', output_path: '', output_file_pattern: '', tdate: '', tmonth: '' }];
    });

    // State for dynamic input fields (local or remote)
    const [inputFields, setInputFields] = useState<Array<{
        id: string;
        folder_path: string;
        source_path: string;
        file_pattern: string;
        tdate: string;
        tmonth: string;
        move_to_process: boolean;
        process_path: string;
        sheet_name?: string;
    }>>(() => {
        // Check for local or remote input fields from the parent state
        const localFields = initialData?.local_input_fields;
        const remoteFields = initialData?.remote_input_fields;

        if (localFields && Array.isArray(localFields) && localFields.length > 0) {
            return localFields.map((field: any, index: number) => ({
                id: `${index + 1}`,
                folder_path: field.local_folder_path || '',
                source_path: field.local_source_path || '',
                file_pattern: field.local_file_pattern || '',
                tdate: field.local_tdate || '',
                tmonth: field.local_tmonth || '',
                move_to_process: field.local_move_to_process || false,
                process_path: field.local_process_path || '',
                sheet_name: field.local_sheet_name || ''
            }));
        } else if (remoteFields && Array.isArray(remoteFields) && remoteFields.length > 0) {
            return remoteFields.map((field: any, index: number) => ({
                id: `${index + 1}`,
                folder_path: field.remote_folder_path || '',
                source_path: field.remote_source_path || '',
                file_pattern: field.remote_file_pattern || '',
                tdate: field.remote_tdate || '',
                tmonth: field.remote_tmonth || '',
                move_to_process: field.remote_move_to_process || false,
                process_path: field.remote_process_path || '',
                sheet_name: field.remote_sheet_name || ''
            }));
        }
        return [{ id: '1', folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }];
    });

    // State for dynamic rollback output fields - COMMENTED OUT
    // const [rollbackOutputFields, setRollbackOutputFields] = useState<Array<{ id: string; output_bin_path: string; output_bin_file_pattern: string }>>(() => {
    //     if (initialData?.rollback_output_fields && Array.isArray(initialData.rollback_output_fields) && initialData.rollback_output_fields.length > 0) {
    //         return initialData.rollback_output_fields.map((field: any, index: number) => ({
    //             id: `${index + 1}`,
    //             output_bin_path: field.output_bin_path || '',
    //             output_bin_file_pattern: field.output_bin_file_pattern || ''
    //         }));
    //     }
    //     return [{ id: '1', output_bin_path: '', output_bin_file_pattern: '' }];
    // });

    // State for dynamic rollback input fields - COMMENTED OUT
    // const [rollbackInputFields, setRollbackInputFields] = useState<Array<{ id: string; input_bin_path: string; input_bin_file_pattern: string }>>(() => {
    //     if (initialData?.rollback_input_fields && Array.isArray(initialData.rollback_input_fields) && initialData.rollback_input_fields.length > 0) {
    //         return initialData.rollback_input_fields.map((field: any, index: number) => ({
    //             id: `${index + 1}`,
    //             input_bin_path: field.input_bin_path || '',
    //             input_bin_file_pattern: field.input_bin_file_pattern || ''
    //         }));
    //     }
    //     return [{ id: '1', input_bin_path: '', input_bin_file_pattern: '' }];
    // });

    const form = useForm({
        defaultValues: initialData || {
            datasetName: '',
            mode: 'read', // Fixed mode value
            // Input section - Local
            input_local: false,
            local_source_path: '',
            local_file_pattern: '',
            local_tdate: '',
            local_tmonth: '',
            local_move_to_process: false,
            local_process_path: '',
            // Input section - Remote
            input_remote: false,
            remote_source_path: '',
            remote_file_pattern: '',
            remote_tdate: '',
            remote_tmonth: '',
            remote_move_to_process: false,
            remote_process_path: '',
            // Output section - Local
            output_local: false,
            // Output section - Remote
            output_remote: false,
            // Rollback section
            output_bin_path: '',
            input_bin_path: '',
            output_bin_file_pattern: '',
            input_bin_file_pattern: ''
        }
    });

    // Get template fields from node details
    const templateFields = React.useMemo(() => {
        if (!nodeDetails) return [];

        let fields: TemplateField[] = [];
        if (Array.isArray(nodeDetails.node.template)) {
            fields = nodeDetails.node.template;
        } else if (nodeDetails.node.template && typeof nodeDetails.node.template === 'object') {
            fields = Object.values(nodeDetails.node.template).filter((field): field is TemplateField =>
                field && typeof field === 'object' && 'key' in field
            );
        }

        // Filter out name, columns, dataset, query fields and sort by position
        return fields
            .filter(f => f && f.key && !['name', 'columns', 'dataset', 'query'].includes(f.key))
            .sort((a, b) => (a.position || 0) - (b.position || 0));
    }, [nodeDetails]);

    // Check if this is an Excel node
    const isExcelNode = React.useMemo(() => {
        if (!nodeDetails) return false;
        const nodeName = nodeDetails?.name?.toLowerCase() || '';
        return nodeName.includes('excel') || nodeName.includes('xlsx');
    }, [nodeDetails]);

    const watchedFields = form.watch();

    // Fetch node details on mount
    useEffect(() => {
        setIsLoading(true);
        getNodeDetails(nodeId)
            .then(setNodeDetails)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [nodeId]);

    // Track the previous type to detect actual changes
    const previousTypeRef = useRef<string | undefined>(undefined);

    const isRestoringFromInitialDataRef = useRef<boolean>(false);
    const hasRestoredFormFromInitialDataRef = useRef<boolean>(false);

    // Effect to handle input_local/input_remote based on type selection - AUTO-SWITCH BASED ON TYPE
    useEffect(() => {
        const selectedType = watchedFields.type;
        const previousType = previousTypeRef.current;

        // Don't auto-switch if we're restoring from initialData (navigating back from Step 3)
        if (isRestoringFromInitialDataRef.current) {  
            return;
        }

        // Only process if type has actually changed (not on initial mount or when returning to the step)
        if (selectedType && selectedType !== previousType) {  // Check if type is defined //
            if (selectedType === 'upload') {
                // For upload type: switch to local
                if (!watchedFields.input_local) {
                    form.setValue('input_local', true, { shouldDirty: false });
                    form.setValue('input_remote', false, { shouldDirty: false });
                    // Only clear input fields if we're switching FROM another type
                    if (previousType && previousType !== 'upload') {  
                        setInputFields([{ id: '1', folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }]);
                    }
                }
            } else {
                // For other types (sftp, amazon_s3, etc.): switch to remote
                if (!watchedFields.input_remote) {
                    form.setValue('input_remote', true, { shouldDirty: false });
                    form.setValue('input_local', false, { shouldDirty: false });
                    // Only clear input fields if we're switching FROM upload type
                    if (previousType === 'upload') {
                        setInputFields([{ id: '1', folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }]);
                    }
                }
            }

            // Update the previous type
            previousTypeRef.current = selectedType;
        }
    }, [watchedFields.type, watchedFields.input_local, watchedFields.input_remote, form]);

    // Restore form from initialData once when editing — do not re-run after user edits (e.g. type → upload).
    useEffect(() => {
        if (!initialData || !nodeDetails || hasRestoredFormFromInitialDataRef.current) {
            return;
        }
        if (isEditing && form.formState.isDirty) {
            hasRestoredFormFromInitialDataRef.current = true;
            if (form.getValues('type')) {
                previousTypeRef.current = form.getValues('type');
            }
            return;
        }

        const formData = { ...initialData };
        isRestoringFromInitialDataRef.current = true;

        if (isEditing) {
            if (formData.datasetName && !formData.name) {
                formData.name = formData.datasetName;
            }

            form.reset(formData);

            Object.keys(formData).forEach(key => {
                if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '') {
                    form.setValue(key, formData[key], { shouldValidate: false, shouldDirty: false });
                }
            });

            // Initialize node icon from initial data
            if (formData.file_name && formData.icon_encrypted_file_key) {
                setNodeIconData({
                    file_name: formData.file_name,
                    encrypted_file_key: formData.icon_encrypted_file_key,
                    unique_id: formData.icon_unique_id,
                    size: formData.icon_size
                });
                // TODO: Set preview if possible?
            }
        }

        if (formData.type) {
            previousTypeRef.current = formData.type;
        }

        hasRestoredFormFromInitialDataRef.current = true;
        setTimeout(() => {
            isRestoringFromInitialDataRef.current = false;
        }, 100);
    }, [initialData, nodeDetails, isEditing, form]);

    // Fetch dropdown options for fields with fetch config
    const fetchDropdownOptions = useCallback(async (field: TemplateField, dependencies: Record<string, any>) => {
        if (!field.fetch) return;

        // Skip upload fields - they use handleFileUpload instead
        if (field.type === 'upload') {
            return;
        }

        // Set loading state
        setLoadingFields((prev) => ({ ...prev, [field.key]: true }));

        // Debug logging for sheet_name

        try {
            // Merge upload file data with dependencies
            const mergedDependencies = { ...dependencies };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {  
                    if (uploadData.encrypted_file_key) mergedDependencies.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedDependencies.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedDependencies.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedDependencies.size = uploadData.size;
                }
            });

            if (
                field.key === 'sheet_name' &&
                shouldSkipExcelActionsForSftpWrite(mergedDependencies)
            ) {
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                return [];
            }

            // Debug logging for sheet_name
            if (field.key === 'sheet_name') {
                console.log(`[fetchDropdownOptions] Merged dependencies for sheet_name:`, mergedDependencies);
            }

            // Special handling for file-based fields
            let modifiedDependencies = { ...mergedDependencies };
            if (field.key === 'sheet_name' && mergedDependencies.type) {
                const currentType = mergedDependencies.type;

                if (currentType === 'sftp') {
                    modifiedDependencies = {
                        ...mergedDependencies,
                        file_name: mergedDependencies.file_name || '',
                        unique_id: mergedDependencies.unique_id || '',
                        encrypted_file_key: mergedDependencies.encrypted_file_key || '',
                        amazon_s3: mergedDependencies.amazon_s3 || '',
                        bucket_name: mergedDependencies.bucket_name || '',
                        object_name: mergedDependencies.object_name || ''
                    };
                } else if (currentType === 'upload') {
                    modifiedDependencies = {
                        ...mergedDependencies,
                        sftp: mergedDependencies.sftp || '',
                        sftp_source_path: mergedDependencies.sftp_source_path || '',
                        file_pattern: mergedDependencies.file_pattern || '',
                        amazon_s3: mergedDependencies.amazon_s3 || '',
                        bucket_name: mergedDependencies.bucket_name || '',
                        object_name: mergedDependencies.object_name || ''
                    };
                } else if (currentType === 'amazon_s3') {
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

            const { finalParams, success } = replacePlaceholders(field.fetch.params, modifiedDependencies);


            if (!success) {
                console.log(`Failed to replace placeholders for ${field.key}`);
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                return;
            }

            const fetchMod = String(field.fetch.module ?? '').toLowerCase();
            const fetchKlass = field.fetch.klass != null ? String(field.fetch.klass).trim() : '';
            if (fetchMod === 'files' && !fetchKlass) {
                console.warn(`[fetchDropdownOptions] Skipping ${field.key}: files fetch missing klass`);
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                return;
            }

            // Debug logging for sheet_name


            const response = await performDatabaseAction(field.fetch.module, field.fetch.klass, finalParams);

            // Debug logging for sheet_name


            // Handle response format: could be array or object with 'data' property
            let options = Array.isArray(response) ? response : (response?.data || response);
            if (!Array.isArray(options)) {
                console.warn(`Unexpected response format for ${field.key}:`, response);
                options = [];
            }

            // Special handling for sheet_name: show "No sheets available" if empty or error
            if (field.key === 'sheet_name') {
                if (options.length === 0) {
                    const noSheetsOption = [{ value: '', label: 'No sheets available' }];
                    setDynamicOptions(prev => ({ ...prev, [field.key]: noSheetsOption }));
                    return noSheetsOption;
                }
            }

            const formatted = options.map(opt => (typeof opt === 'object' ? opt : { value: opt, label: String(opt) }));
            setDynamicOptions(prev => ({ ...prev, [field.key]: formatted }));
            return formatted;
        } catch (error) {
            console.error(`Failed to fetch options for ${field.key}:`, error);

            // Special handling for sheet_name: show "No sheets available" instead of error toast
            if (field.key === 'sheet_name') {
                const noSheetsOption = [{ value: '', label: 'No sheets available' }];
                setDynamicOptions(prev => ({ ...prev, [field.key]: noSheetsOption }));
                return noSheetsOption;
            }

            toast.error(getDisplayErrorMessage(error, `Failed to load data for ${field.display_name}.`));
            setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
            return [];
        } finally {
            setLoadingFields((prev) => ({ ...prev, [field.key]: false }));
        }
    }, [uploadedFiles]);

    // Handle field value change
    const handleValueChange = (changedFieldKey: string, value: any) => {
        form.setValue(changedFieldKey, value, { shouldDirty: true });
        const updatedDependencies = { ...form.getValues(), [changedFieldKey]: value };

        if (shouldSkipCascadeRefetchForChangedKey(changedFieldKey, updatedDependencies)) {
            return;
        }

        // Merge upload file data with updated dependencies
        const mergedDependencies = { ...updatedDependencies };
        Object.values(uploadedFiles).forEach((uploadData: any) => {
            if (uploadData) {
                if (uploadData.encrypted_file_key) mergedDependencies.encrypted_file_key = uploadData.encrypted_file_key;
                if (uploadData.file_name) mergedDependencies.file_name = uploadData.file_name;
                if (uploadData.unique_id) mergedDependencies.unique_id = uploadData.unique_id;
                if (uploadData.size) mergedDependencies.size = uploadData.size;
            }
        });

        templateFields.forEach(field => {
            if (field.type === 'upload') {
                return;
            }

            const fieldForCheck = {
                ...field,
                depends_key: field.depends_key || field.depends_on
            };

            const willBeVisible = checkFieldDependencies(fieldForCheck, mergedDependencies);

            if (!willBeVisible) {
                return;
            }

            if (field.fetch?.params && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`)) {
                form.setValue(field.key, '', { shouldDirty: true });
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));

                // Clear existing timer for this field
                if (debounceTimers.current[field.key]) {
                    clearTimeout(debounceTimers.current[field.key]);
                }

                // Special fields that need debouncing (like sheet_name for Excel)
                const shouldDebounce = field.key === 'sheet_name';
                const debounceDelay = 800;

                if (shouldDebounce) {
                    debounceTimers.current[field.key] = setTimeout(() => {
                        fetchDropdownOptions(field, mergedDependencies);
                    }, debounceDelay);
                } else {
                    fetchDropdownOptions(field, mergedDependencies);
                }
            }
        });
    };

    // Handle file upload
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

                // Register uploaded file with /files/create-file (same as Step2Configuration preview).
                // Backend expects this for Excel (e.g. sheet list / read_file) after multipart upload.
                const formAfterUpload = form.getValues();
                const uploadType = formAfterUpload.type ?? 'upload';
                let createFileOk = uploadType !== 'upload';
                if (uploadType === 'upload') {
                    if (!nodeDetails) {
                        toast.error('Cannot register file: configuration is still loading. Wait a moment and upload again.');
                        createFileOk = false;
                    } else {
                        const fileType = nodeDetails.node_id;
                        const fileName = response.file_name || file.name;
                        const fileNameWithoutExt = String(fileName).split('.')[0];
                        const createFilePayload: Record<string, unknown> = {
                            name: fileNameWithoutExt,
                            type: fileType,
                            node_id: fileType,
                            show_node: true,
                            is_dataset: true,
                            display_name: nodeDetails.display_name,
                            modules: nodeDetails.modules,
                            klass_name: nodeDetails.klass_name,
                            group: 'Files',
                            unique_id: response.unique_id,
                            file_name: fileName,
                            encrypted_file_key: response.encrypted_file_key,
                            file_category: 'source_data',
                            file_type: fileType,
                        };
                        if (fileType === 'excel' && formAfterUpload.sheet_name) {
                            createFilePayload.sheet_name = formAfterUpload.sheet_name;
                        }
                        if (formAfterUpload.delimiter) {
                            createFilePayload.delimiter = formAfterUpload.delimiter;
                        }
                        if (formAfterUpload.skip_row) {
                            createFilePayload.skip_row = formAfterUpload.skip_row;
                        }
                        if (formAfterUpload.skip_footer) {
                            createFilePayload.skip_footer = formAfterUpload.skip_footer;
                        }
                        try {
                            await createFileDatasetApi(createFilePayload);
                            createFileOk = true;
                        } catch (createErr) {
                            console.error('[handleFileUpload] create-file failed:', createErr);
                            toast.error(getDisplayErrorMessage(createErr, 'File uploaded but registering the file failed. Try again or pick a sheet after selecting source type.'));
                            createFileOk = false;
                        }
                    }
                }

                if (createFileOk) {
                    toast.success('File uploaded successfully!');
                }

                // Trigger refetch for dependent fields
                const currentValues = form.getValues();
                const uploadDependencies = ['encrypted_file_key', 'file_name', 'unique_id', 'size'];

                const mergedValues = {
                    ...currentValues,
                    encrypted_file_key: response.encrypted_file_key,
                    file_name: response.file_name,
                    unique_id: response.unique_id,
                    size: response.size,
                };


                templateFields.forEach(dependentField => {
                    if (dependentField.type === 'upload' || !dependentField.fetch) {
                        return;
                    }

                    const fieldParams = JSON.stringify(dependentField.fetch.params || {});
                    const dependsOnUpload = uploadDependencies.some(dep =>
                        fieldParams.includes(`{{${dep}}}`)
                    );

                    // Debug logging for sheet_name


                    if (dependsOnUpload) {

                        const fieldForCheck = {
                            ...dependentField,
                            depends_key: dependentField.depends_key || dependentField.depends_on
                        };

                        const isVisible = checkFieldDependencies(fieldForCheck, mergedValues);

                        // Debug logging for sheet_name


                        if (isVisible) {
                            console.log(`[handleFileUpload] Field '${dependentField.key}' is visible, fetching options...`);
                            form.setValue(dependentField.key, '', { shouldDirty: true });
                            setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));
                            fetchDropdownOptions(dependentField, mergedValues);
                        } else {
                            console.log(`[handleFileUpload] Field '${dependentField.key}' is NOT visible`);
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

    const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
            const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg'];
            const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
                toast.error('Invalid file type. Please upload SVG, PNG, JPG, or JPEG.');
                return;
            }
            
            // Upload the file using /files/upload-file endpoint
            setIsUploadingIcon(true);
            try {
                const formData = new FormData();
                formData.append('upload_file', file);
                const response = await uploadFile('files', 'upload-file', formData);
                console.log("encrypted_file_key from upload:", response.encrypted_file_key);
                
                // Determine file type from extension
                const fileType = fileExt.slice(1);
                
                // Create the file record using /files/create-file
                const createPayload: CreateUploadedFileApiPayload = {
                    file_name: response.file_name || file.name,
                    display_name: '',
                    encrypted_file_key: response.encrypted_file_key,
                    unique_id: response.unique_id,
                    size: response.size !== undefined && response.size !== null ? String(response.size) : '',
                    sheet_name: '',
                    delimiter: '',
                    file_type: fileType,
                    file_category: 'dataset_icon',
                    created_by: '',
                    updated_by: '',
                };
                await createUploadedFileRecord(createPayload);
                
                setNodeIconData(response);
                toast.success('Icon uploaded successfully!');
            } catch (error) {
                toast.error(getDisplayErrorMessage(error, 'Icon upload failed. Please try again.'));
                // Reset if upload fails
                setNodeIconData(null);
            } finally {
                setIsUploadingIcon(false);
            }
        } else {
            // Clear if no file
            removeIcon();
        }
    };

    const removeIcon = () => {
        setNodeIconData(null);
    };

    // Form watch effect for auto-fetching dependent fields with debouncing
    useEffect(() => {
        const subscription = form.watch((currentValues, { name: changedFieldName }) => {
            if (!changedFieldName || !hasFetchedInitialRef.current || isUpdatingRef.current) return;

            const previousValues = previousWatchedValuesRef.current;
            const values = currentValues as Record<string, any>;

            if (JSON.stringify(values[changedFieldName]) === JSON.stringify(previousValues[changedFieldName])) {
                return;
            }

            // Log ALL field changes to help debug

            const mergedValues = { ...values };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {
                    if (uploadData.encrypted_file_key) mergedValues.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedValues.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedValues.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedValues.size = uploadData.size;
                }
            });

            templateFields.forEach(dependentField => {
                if (dependentField.fetch && dependentField.type !== 'upload') {
                    const dependencies = (JSON.stringify(dependentField.fetch.params || {}).match(/{{(.*?)}}/g) || [])
                        .map((p: string) => p.replace(/{{|}}/g, ''));

                    // Debug logging for sheet_name
                
                    const fieldForCheck = {
                        ...dependentField,
                        depends_key: dependentField.depends_key || dependentField.depends_on
                    };
                    const wasVisible = checkFieldDependencies(fieldForCheck, previousValues);
                    const isNowVisible = checkFieldDependencies(fieldForCheck, mergedValues);
                    const justBecameVisible = !wasVisible && isNowVisible;

                    // Special handling for sheet_name: only fetch when specific dependencies change
                    // NOT when input section fields like tdate, tmonth, folder_path, move_to_process, process_path change
                    let shouldFetch: boolean;

                    if (dependentField.key === 'sheet_name') {
                        // MAIN sheet_name dropdown (Source Information section):
                        // - Should trigger API ONLY when type is "upload" or "amazon_s3" (NOT sftp)
                        // - For upload: uses file_name, unique_id, encrypted_file_key
                        // - For amazon_s3: uses amazon_s3, bucket_name, object_name
                        //
                        // PER-INPUT-FIELD sheet_name (Input section - handled separately in fetchSheetNamesForInputField):
                        // - Handled by updateInputField function when file_pattern changes
                        // - Uses sftp from Source Information + source_path + file_pattern from input row
                        //
                        // This watch effect is for the MAIN sheet_name dropdown only
                        const sheetNameAllowedDependencies = [
                            'type',              // Source type (to know if upload/amazon_s3)
                            'amazon_s3',         // S3 connection
                            'bucket_name',       // S3 bucket
                            'object_name',       // S3 object
                            'file_name',         // Upload file name
                            'unique_id',         // Upload unique ID
                            'encrypted_file_key' // Upload encrypted key
                        ];

                        // BLOCKED fields that should NOT trigger MAIN sheet_name API:
                        // These include all input section fields (tdate, tmonth, etc.) AND sftp-related fields
                        // (sftp fields are used by PER-INPUT-FIELD sheet_name, not the main dropdown)
                        const sheetNameBlockedFields = [
                            'mode',
                            // SFTP fields (not used by main sheet_name dropdown)
                            'sftp',
                            'sftp_source_path',
                            'file_pattern',
                            // Input section fields that should NOT trigger
                            'tdate',
                            'tmonth',
                            'folder_path',
                            'move_to_process',
                            'process_path',
                            'local_source_path',
                            'local_file_pattern',
                            'local_tdate',
                            'local_tmonth',
                            'local_folder_path',
                            'local_move_to_process',
                            'local_process_path',
                            'remote_source_path',
                            'remote_file_pattern',
                            'remote_tdate',
                            'remote_tmonth',
                            'remote_folder_path',
                            'remote_move_to_process',
                            'remote_process_path'
                        ];

                        // For sheet_name, ONLY use allowed dependencies (completely ignore template dependencies)
                        const isAllowedDependency = changedFieldName && sheetNameAllowedDependencies.includes(changedFieldName);
                        const isBlockedField = changedFieldName && sheetNameBlockedFields.includes(changedFieldName);
                        const currentType = mergedValues['type'];

                        // Only fetch if it's an allowed dependency AND not a blocked field
                        shouldFetch = isAllowedDependency && !isBlockedField || justBecameVisible;

                        console.log(`\n[Watch Effect - MAIN sheet_name] ========== Decision Start ==========`);
                        console.log(`[Watch Effect - MAIN sheet_name] =================== Decision End ===================\n`);
                    } else {
                        // For all other fields, use template dependencies normally.
                        // Do not treat `query` edits as a trigger — SQL runs when the user clicks Run / preview.
                        // Do not refire excel-actions when only skip_footer / skip_row change (they may appear in params only).
                        const depChanged =
                            dependencies.includes(changedFieldName) &&
                            changedFieldName !== 'query' &&
                            !shouldSkipExcelActionsTriggerForChangedField(
                                dependentField.fetch,
                                changedFieldName,
                                mergedValues
                            );
                        shouldFetch = depChanged || justBecameVisible;
                    }

                    if (shouldFetch) {
                        isUpdatingRef.current = true;

                        form.setValue(dependentField.key, '', { shouldDirty: true });
                        setDynamicOptions(prev => ({ ...prev, [dependentField.key]: [] }));

                        setTimeout(() => {
                            isUpdatingRef.current = false;
                        }, 0);

                        const visibleDependencies = dependencies.filter(dep => {
                            const depField = templateFields.find(f => f.key === dep);
                            return !depField || checkFieldDependencies({
                                ...depField,
                                depends_key: depField.depends_key || depField.depends_on
                            }, mergedValues);
                        });

                        const currentType = mergedValues['type'];
                        const uploadDependencies = ['file_name', 'unique_id', 'encrypted_file_key', 'size'];
                        const sftpDependencies = ['sftp', 'sftp_source_path', 'file_pattern'];
                        const amazonS3Dependencies = ['amazon_s3', 'bucket_name', 'object_name'];

                        const relevantDependencies = visibleDependencies.filter(dep => {
                            if (dep === 'type' || dep === 'file_category') return true;

                            if (currentType === 'upload') {
                                return uploadDependencies.includes(dep);
                            } else if (currentType === 'sftp') {
                                return sftpDependencies.includes(dep);
                            } else if (currentType === 'amazon_s3') {
                                return amazonS3Dependencies.includes(dep);
                            }
                            return true;
                        });

                        const allDependenciesMet = relevantDependencies.every(dep => {
                            const depValue = mergedValues[dep];
                            return Array.isArray(depValue) ? depValue.length > 0 : !!depValue;
                        });

                        // Debug logging for sheet_name

                        if (dependencies.length === 0 || allDependenciesMet) {
                            if (debounceTimers.current[dependentField.key]) {
                                clearTimeout(debounceTimers.current[dependentField.key]);
                            }

                            const shouldDebounce = dependentField.key === 'sheet_name';
                            const debounceDelay = 1200;

                            if (shouldDebounce) {
                                debounceTimers.current[dependentField.key] = setTimeout(() => {
                                    console.log(`[Watch Effect] ⏱️  Debounce timer fired for sheet_name, calling fetchDropdownOptions NOW`);
                                    fetchDropdownOptions(dependentField, mergedValues);
                                }, debounceDelay);
                            } else {
                                fetchDropdownOptions(dependentField, mergedValues);
                            }
                        } else if (dependentField.key === 'sheet_name') {
                            console.log(`[Watch Effect] ❌ NOT calling sheet_name API - dependencies not met`);
                        }
                    }
                }
            });

            previousWatchedValuesRef.current = values;
        });

        return () => {
            subscription.unsubscribe();
            Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
        };
    }, [form, templateFields, uploadedFiles, fetchDropdownOptions]);

    // Initialize refs and mark as ready for watching after component mounts
    useEffect(() => {
        previousWatchedValuesRef.current = form.getValues();
        const timer = setTimeout(() => {
            hasFetchedInitialRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }, [form]);

    // Effect to fetch sheet names for all input fields when type or sftp connection changes
    // This useEffect is triggered when type/sftp changes, NOT when individual input fields change
    useEffect(() => {

        if (!isExcelNode) {
            return;
        }
        if (shouldSkipExcelActionsForSftpWrite(watchedFields)) {
            return;
        }
        if (!watchedFields.type || watchedFields.type === 'upload') {
            return;
        }
        if (!watchedFields.sftp) {
            return;
        }

        // Fetch sheet names for all input fields that have both source_path and file_pattern
        inputFields.forEach(field => {
            console.log(`[useEffect - Type/SFTP Change] Checking field ${field.id}: source_path=${field.source_path}, file_pattern=${field.file_pattern}`);

            if (field.source_path && field.file_pattern) {
                console.log(`[useEffect - Type/SFTP Change] ✅ Field ${field.id} has both source_path and file_pattern`);

                // Clear existing timer for this field
                const timerKey = `input_${field.id}_sheet_type_change`;
                if (debounceTimers.current[timerKey]) {
                    clearTimeout(debounceTimers.current[timerKey]);
                }

                const currentType = watchedFields.type;
                const sftpConnection = watchedFields.sftp;

                // Only fetch for SFTP type (remote) when type is not 'upload'
                if (currentType === 'upload' || currentType !== 'sftp') {
                    console.log(`[useEffect - Type/SFTP Change] ❌ Type is ${currentType} (not sftp) - skipping field ${field.id}`);
                    return;
                }


                // Set debounce timer
                debounceTimers.current[timerKey] = setTimeout(async () => {
                    setLoadingInputFieldSheets(prev => ({ ...prev, [field.id]: true }));

                    try {
                        const payload = {
                            payload: {
                                data: {
                                    sftp: sftpConnection || '',
                                    type: currentType,
                                    amazon_s3: '',
                                    file_name: '',
                                    unique_id: '',
                                    bucket_name: '',
                                    object_name: '',
                                    file_pattern: field.file_pattern,
                                    file_category: 'source_data',
                                    sftp_source_path: field.source_path,
                                    encrypted_file_key: '',
                                    tdate: field.tdate || '',
                                    tmonth: field.tmonth || ''
                                },
                                actions: 'get_sheet_names'
                            }
                        };

                        const response = await performDatabaseAction('files', 'excel-actions', payload);

                        let options = Array.isArray(response) ? response : (response?.data || response);
                        if (!Array.isArray(options)) {
                            options = [];
                        }

                        // Handle empty response
                        if (options.length === 0) {
                            const noSheetsOption = [{ value: '', label: 'No sheets available' }];
                            setInputFieldSheetOptions(prev => ({ ...prev, [field.id]: noSheetsOption }));
                        } else {
                            const formatted = options.map(opt => (typeof opt === 'object' ? opt : { value: opt, label: String(opt) }));
                            setInputFieldSheetOptions(prev => ({ ...prev, [field.id]: formatted }));
                        }
                    } catch (error) {
                        console.error(`[useEffect - Type/SFTP Change] ⚠️  Error for field ${field.id}:`, error);
                        const noSheetsOption = [{ value: '', label: 'No sheets available' }];
                        setInputFieldSheetOptions(prev => ({ ...prev, [field.id]: noSheetsOption }));
                    } finally {
                        setLoadingInputFieldSheets(prev => ({ ...prev, [field.id]: false }));
                    }
                }, 800);
            } else {
                console.log(`[useEffect - Type/SFTP Change] ❌ Field ${field.id} missing source_path or file_pattern - skipping`);
            }
        });

        return () => {
            // Clean up timers on unmount
            inputFields.forEach(field => {
                const timerKey = `input_${field.id}_sheet_type_change`;
                if (debounceTimers.current[timerKey]) {
                    clearTimeout(debounceTimers.current[timerKey]);
                }
            });
        };
    }, [isExcelNode, watchedFields.type, watchedFields.sftp, watchedFields.mode]);

    // Auto-fetch dropdown options on mount for fields with fetch config
    useEffect(() => {
        templateFields.forEach(field => {
            if (!field.fetch) return;
            if (field.type === 'upload') {
                return;
            }

            const fieldForCheck = {
                ...field,
                depends_key: field.depends_key || field.depends_on
            };

            const isVisible = checkFieldDependencies(fieldForCheck, watchedFields);

            if (!isVisible) {
                return;
            }

            const mergedValuesForCheck = { ...watchedFields };
            Object.values(uploadedFiles).forEach((uploadData: any) => {
                if (uploadData) {
                    if (uploadData.encrypted_file_key) mergedValuesForCheck.encrypted_file_key = uploadData.encrypted_file_key;
                    if (uploadData.file_name) mergedValuesForCheck.file_name = uploadData.file_name;
                    if (uploadData.unique_id) mergedValuesForCheck.unique_id = uploadData.unique_id;
                    if (uploadData.size) mergedValuesForCheck.size = uploadData.size;
                }
            });

            const dependenciesToCheck = (JSON.stringify(field.fetch.params || {}).match(/{{(.*?)}}/g) || []).map((p: string) => p.replace(/{{|}}/g, ''));
            const depsNoQuery = dependenciesToCheck.filter((d: string) => d !== 'query');
            const allDepsMet = depsNoQuery.every(dep => mergedValuesForCheck[dep]);
            const shouldFetch = allDepsMet && !dynamicOptions[field.key];

            const depSignature = depsNoQuery.map(dep => `${dep}:${mergedValuesForCheck[dep]}`).join('|');
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

            const sortedFields = [...templateFields].sort((a, b) => {
                const aDeps = (JSON.stringify(a.fetch?.params || {}).match(/{{(.*?)}}/g) || []).length;
                const bDeps = (JSON.stringify(b.fetch?.params || {}).match(/{{(.*?)}}/g) || []).length;
                return aDeps - bDeps;
            });

            sortedFields.forEach((field, index) => {
                if (field.fetch && formValues[field.key] && field.type !== 'upload') {
                    setTimeout(async () => {
                        try { 
                            const options = await fetchDropdownOptions(field, formValues);
                            if (options && options.length > 0) {
                                const currentFormValue = form.getValues(field.key);
                                const initialValue = formValues[field.key];
                                if (initialValue && (!currentFormValue || currentFormValue === '')) {
                                    form.setValue(field.key, initialValue, { shouldValidate: false, shouldDirty: false });
                                }
                            }
                        } catch (error) {
                            console.error(`Error loading options for ${field.key}:`, error);
                        }
                    }, index * 200);
                } else if (field.options && field.options.length > 0) {
                    setDynamicOptions(prev => ({ ...prev, [field.key]: field.options }));
                }
            });
        }
    }, [isEditing, initialData, templateFields, fetchDropdownOptions, form]);

    // When dropdown options load in edit mode, only fill empty select fields — never revert type/source after upload.
    useEffect(() => {
        if (!isEditing || !initialData || Object.keys(dynamicOptions).length === 0) {
            return;
        }

        Object.keys(initialData).forEach(key => {
            if (PRESERVE_ON_DYNAMIC_OPTIONS_SYNC.has(key)) return;
            if (!dynamicOptions[key]) return;

            const initialValue = initialData[key];
            const currentValue = form.getValues(key);
            if (
                initialValue !== undefined &&
                initialValue !== null &&
                initialValue !== '' &&
                (currentValue === undefined || currentValue === null || currentValue === '')
            ) {
                form.setValue(key, initialValue, { shouldValidate: false, shouldDirty: false });
            }
        });

        setTimeout(() => {
            form.trigger();
        }, 100);
    }, [isEditing, initialData, dynamicOptions, form]);

    // Ensure mode has a default value if not set
    useEffect(() => {
        if (!form.getValues('mode')) {
            form.setValue('mode', 'read', { shouldValidate: false, shouldDirty: false });
        }
    }, [form]);

    // Initialize number template fields to 0 if not set
    useEffect(() => {
        if (!nodeDetails || templateFields.length === 0) return;
        const currentValues = form.getValues();
        let updated = false;
        templateFields.forEach(field => {
            if (field.type === 'number') {
                const val = currentValues[field.key];
                if (val === undefined || val === null || val === '') {
                    form.setValue(field.key, 0, { shouldValidate: false, shouldDirty: false });
                    updated = true;
                }
            }
        });
        if (updated) {
            previousWatchedValuesRef.current = form.getValues();
        }
    }, [nodeDetails, templateFields, form]);

    // Render a form field based on its type and configuration
    const renderFormField = (field: any) => {
        const fieldForCheck = {
            ...field,
            depends_key: field.depends_key || field.depends_on
        };

        const isFieldVisible = checkFieldDependencies(fieldForCheck, watchedFields);

        if (!isFieldVisible) {
            return null;
        }

        // For Excel nodes: Hide sheet_name field in Source Information section when type is not 'upload'
        if (isExcelNode && field.key === 'sheet_name' && watchedFields.type && watchedFields.type !== 'upload') {
            return null;
        }

        const currentValue = watchedFields[field.key];
        const options = dynamicOptions[field.key] || field.options || [];
        const isLoading = loadingFields[field.key] || false;

        return (
            <motion.div
                key={field.key}
                variants={fieldAnimationVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
            >
                <FormItem>
                    <FormLabel className="text-xs font-medium">
                        {field.display_name}
                        {field.required && <span className="text-destructive">*</span>}
                    </FormLabel>
                <Controller
                    name={field.key}
                    control={form.control}
                    render={({ field: ctlField }) => (  
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
                            ) : field.type === 'date' ? (  
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outliner"
                                            className={cn(
                                                'w-full h-9 text-xs px-2 justify-start text-left font-normal',
                                                !currentValue && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                            {currentValue ? format(new Date(currentValue), 'PPP') : <span>{field.placeholder || 'Pick a date'}</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={currentValue ? new Date(currentValue) : undefined}
                                            onSelect={(date) => {
                                                const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                                                ctlField.onChange(dateStr);
                                                handleValueChange(field.key, dateStr);
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            ) : field.type === 'number' ? (
                                <Input
                                    type="number"
                                    className="h-[2.5rem] text-xs px-2"
                                    placeholder={field.placeholder}
                                    value={currentValue !== undefined && currentValue !== null ? String(currentValue) : '0'}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? '' : Number(e.target.value);
                                        ctlField.onChange(val);
                                        handleValueChange(field.key, val);
                                    }}
                                />
                            ) : field.type === 'text' ? (  
                                <Input
                                    className="h-[2.5rem] text-xs px-2"
                                    placeholder={field.placeholder}
                                    value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                                    onChange={(e) => {
                                        ctlField.onChange(e.target.value);
                                        handleValueChange(field.key, e.target.value);
                                    }}
                                />
                            ) : field.type === 'dropdown' ? (
                                <AlternativeSelect
                                    options={options.map((opt: any) => ({
                                        value: String(opt.value),
                                        label: opt.label || String(opt.value),
                                        description: opt.description
                                    }))}
                                    value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                                    onChange={(v) => {
                                        ctlField.onChange(v);
                                        handleValueChange(field.key, v);
                                    }}
                                    placeholder={field.placeholder || 'Select an option'}
                                    isLoading={isLoading}
                                    disabled={isLoading}
                                    // Allow custom value for delimiter field
                                    allowCustomValue={field.key === 'delimiter'}
                                    className="h-9 text-xs"
                                />
                            ) : null}
                        </FormControl>
                    )}
                />
                <FormMessage />
                </FormItem>
            </motion.div>
        );
    };

    // Function to fetch sheet names for a specific input field (per-input-field sheet name)
    // This is triggered ONLY when file_pattern changes in an input row //
    const fetchSheetNamesForInputField = useCallback(async (fieldId: string, sourcePath: string, filePattern: string, tdate?: string, tmonth?: string) => {

        if (!isExcelNode) {  
            return;
        }
        if (!sourcePath || !filePattern) {
            return;
        }

        const currentType = watchedFields.type;
        const sftpConnection = watchedFields.sftp;

        // Only fetch for SFTP type (remote) when type is not 'upload'
        if (currentType === 'upload' || currentType !== 'sftp') {  
            return;
        }

        if (shouldSkipExcelActionsForSftpWrite(watchedFields)) {
            return;
        }

        setLoadingInputFieldSheets(prev => ({ ...prev, [fieldId]: true }));

        try {  
            const payload = {  
                payload: { 
                    data: {
                        sftp: sftpConnection || '',
                        type: currentType,
                        amazon_s3: '',
                        file_name: '',
                        unique_id: '',
                        bucket_name: '',
                        object_name: '',
                        file_pattern: filePattern,
                        file_category: 'source_data',
                        sftp_source_path: sourcePath,
                        encrypted_file_key: '',
                        tdate: tdate || '',
                        tmonth: tmonth || ''
                    },
                    actions: 'get_sheet_names'
                }
            };

            const response = await performDatabaseAction('files', 'excel-actions', payload);

            // Handle response format: could be array or object with 'data' property
            let options = Array.isArray(response) ? response : (response?.data || response);
            if (!Array.isArray(options)) {  
                console.warn(`[PER-INPUT sheet_name] ⚠️  Unexpected response format:`, response);
                options = [];
            }
            // If empty or error, show "No sheets available"
            if (options.length === 0) {
                const noSheetsOption = [{ value: '', label: 'No sheets available' }];
                setInputFieldSheetOptions(prev => ({ ...prev, [fieldId]: noSheetsOption }));
            } else {  
                const formatted = options.map(opt => (typeof opt === 'object' ? opt : { value: opt, label: String(opt) }));
                setInputFieldSheetOptions(prev => ({ ...prev, [fieldId]: formatted }));
            }
        } catch (error) {  
            console.error(`[PER-INPUT sheet_name] ⚠️  Error fetching sheets:`, error);
            const noSheetsOption = [{ value: '', label: 'No sheets available' }];
            setInputFieldSheetOptions(prev => ({ ...prev, [fieldId]: noSheetsOption }));
        } finally {  
            setLoadingInputFieldSheets(prev => ({ ...prev, [fieldId]: false }));
            console.log(`[PER-INPUT sheet_name] =================== Fetch End ===================\n`);
        }
    }, [isExcelNode, watchedFields.type, watchedFields.sftp, watchedFields.mode]);

    const addInputField = () => {    
        const newId = Date.now().toString();
        setInputFields([...inputFields, { id: newId, folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }]);
    };

    const removeInputField = (id: string) => { 
        if (inputFields.length > 1) {
            setInputFields(inputFields.filter(field => field.id !== id));
            // Clean up sheet options for removed field
            setInputFieldSheetOptions(prev => {
                const newOptions = { ...prev };
                delete newOptions[id];
                return newOptions;
            });
            setLoadingInputFieldSheets(prev => {
                const newLoading = { ...prev };
                delete newLoading[id];
                return newLoading;
            });
        }
    };

    const updateInputField = (id: string, key: keyof typeof inputFields[0], value: string | boolean | number) => {
        const stringValue = typeof value === 'number' ? String(value) : value;


        setInputFields(inputFields.map(field =>
            field.id === id ? { ...field, [key]: stringValue } : field
        ));

        // ONLY trigger debounced sheet name fetch when file_pattern changes for Excel nodes
        // This prevents unnecessary API calls when other fields (tdate, tmonth, folder_path, etc.) change
        if (isExcelNode && key === 'file_pattern') {
            console.log(`[updateInputField] ✅ file_pattern changed for Excel node - will fetch sheet names`);
            const updatedField = inputFields.find(f => f.id === id);
            if (updatedField) {
                const newFilePattern = stringValue as string;
                const newSourcePath = updatedField.source_path;
                const newTdate = updatedField.tdate;
                const newTmonth = updatedField.tmonth;

                // Clear existing timer for this field
                const timerKey = `input_${id}_sheet`;
                if (debounceTimers.current[timerKey]) {
                    clearTimeout(debounceTimers.current[timerKey]);
                }

                // Set new debounce timer - only if BOTH source_path and file_pattern are present
                debounceTimers.current[timerKey] = setTimeout(() => {
                    if (newSourcePath && newFilePattern) {
                        fetchSheetNamesForInputField(id, newSourcePath, newFilePattern, newTdate, newTmonth);
                    } else {
                    }
                }, 800);
            }
        } else if (isExcelNode && (key === 'tdate' || key === 'tmonth' || key === 'folder_path' || key === 'move_to_process' || key === 'process_path')) {
            console.log(`[updateInputField] ❌ "${key}" changed - NOT triggering sheet_name API (as expected)`);
        }
    };

    // Functions to manage rollback output fields - COMMENTED OUT
    // const addRollbackOutputField = () => {
    //     const newId = Date.now().toString();
    //     setRollbackOutputFields([...rollbackOutputFields, { id: newId, output_bin_path: '', output_bin_file_pattern: '' }]);
    // };

    // const removeRollbackOutputField = (id: string) => {
    //     if (rollbackOutputFields.length > 1) {
    //         setRollbackOutputFields(rollbackOutputFields.filter(field => field.id !== id));
    //     }
    // };

    // const updateRollbackOutputField = (id: string, key: 'output_bin_path' | 'output_bin_file_pattern', value: string) => {
    //     setRollbackOutputFields(rollbackOutputFields.map(field =>
    //         field.id === id ? { ...field, [key]: value } : field
    //     ));
    // };

    // Functions to manage rollback input fields - COMMENTED OUT
    // const addRollbackInputField = () => {
    //     const newId = Date.now().toString();
    //     setRollbackInputFields([...rollbackInputFields, { id: newId, input_bin_path: '', input_bin_file_pattern: '' }]);
    // };

    // const removeRollbackInputField = (id: string) => {
    //     if (rollbackInputFields.length > 1) {
    //         setRollbackInputFields(rollbackInputFields.filter(field => field.id !== id));
    //     }
    // };

    // const updateRollbackInputField = (id: string, key: 'input_bin_path' | 'input_bin_file_pattern', value: string) => {
    //     setRollbackInputFields(rollbackInputFields.map(field =>
    //         field.id === id ? { ...field, [key]: value } : field
    //     ));
    // };

    const handleNext = async () => {
        if (!nodeDetails) return;
        const finalConfig = form.getValues();

        // Ensure all number template fields default to 0 if empty/null/undefined
        templateFields.forEach(field => {
            if (field.type === 'number') {
                const val = finalConfig[field.key];
                if (val === undefined || val === null || val === '') {
                    finalConfig[field.key] = 0;
                }
            }
        });

        if (finalConfig.datasetName) {
            finalConfig.name = finalConfig.datasetName;
        }

        // Ensure output checkboxes are in the config (use watchedFields as source of truth)
        finalConfig.output_local = watchedFields.output_local || false;
        finalConfig.output_remote = watchedFields.output_remote || false;

        // Add output fields as a list of dictionaries with proper prefixes
        // IMPORTANT: Clear the opposite field type to avoid stale data
        if (watchedFields.output_local) {  
            console.log('Adding LOCAL output fields...');
            // Send local fields with local_ prefix
            finalConfig.local_output_fields = outputFields.map(field => ({
                local_folder_path: field.folder_path,
                local_output_path: field.output_path,
                local_output_file_pattern: field.output_file_pattern,
                local_tdate: field.tdate,
                local_tmonth: field.tmonth
            }));
            // Clear remote output fields to avoid stale data
            delete finalConfig.remote_output_fields;
        } else if (watchedFields.output_remote) {  
            console.log('Adding REMOTE output fields...');
            // Send remote fields with remote_ prefix
            finalConfig.remote_output_fields = outputFields.map(field => ({  
                remote_folder_path: field.folder_path,
                remote_output_path: field.output_path,
                remote_output_file_pattern: field.output_file_pattern,
                remote_tdate: field.tdate,
                remote_tmonth: field.tmonth
            }));
            // Clear local output fields to avoid stale data
            delete finalConfig.local_output_fields;
            console.log('remote_output_fields:', finalConfig.remote_output_fields);
        } else {
            console.log('NO output checkbox selected!');
            // Clear both if neither is selected
            delete finalConfig.local_output_fields;
            delete finalConfig.remote_output_fields;
        }

        // Ensure input checkboxes are in the config (use watchedFields as source of truth)
        finalConfig.input_local = watchedFields.input_local || false;
        finalConfig.input_remote = watchedFields.input_remote || false;

        // Add input fields as a list of dictionaries with proper prefixes
        // IMPORTANT: Clear the opposite field type to avoid stale data
        if (watchedFields.input_local) {
            // Send local fields with local_ prefix
            finalConfig.local_input_fields = inputFields.map(field => {
                const fieldData: any = {
                    local_folder_path: field.folder_path,
                    local_source_path: field.source_path,
                    local_file_pattern: field.file_pattern,
                    local_tdate: field.tdate,
                    local_tmonth: field.tmonth,
                    local_move_to_process: field.move_to_process,
                    local_process_path: field.process_path
                };
                // Add sheet_name for Excel nodes only when type is NOT 'upload'
                if (isExcelNode && watchedFields.type && watchedFields.type !== 'upload') {
                    fieldData.local_sheet_name = field.sheet_name || '';
                }
                return fieldData;
            });
            // Clear remote input fields to avoid stale data
            delete finalConfig.remote_input_fields;
        } else if (watchedFields.input_remote) {
            // Send remote fields with remote_ prefix
            finalConfig.remote_input_fields = inputFields.map(field => {
                const fieldData: any = {
                    remote_folder_path: field.folder_path,
                    remote_source_path: field.source_path,
                    remote_file_pattern: field.file_pattern,
                    remote_tdate: field.tdate,
                    remote_tmonth: field.tmonth,
                    remote_move_to_process: field.move_to_process,
                    remote_process_path: field.process_path
                };
                // Add sheet_name for Excel nodes only when type is NOT 'upload'
                if (isExcelNode && watchedFields.type && watchedFields.type !== 'upload') {
                    fieldData.remote_sheet_name = field.sheet_name || '';
                }
                return fieldData;
            });
            // Clear local input fields to avoid stale data
            delete finalConfig.local_input_fields;
        }

        // Add rollback output fields as a list of dictionaries - COMMENTED OUT
        // finalConfig.rollback_output_fields = rollbackOutputFields.map(field => ({
        //     output_bin_path: field.output_bin_path,
        //     output_bin_file_pattern: field.output_bin_file_pattern
        // }));

        // Add rollback input fields as a list of dictionaries - COMMENTED OUT
        // finalConfig.rollback_input_fields = rollbackInputFields.map(field => ({
        //     input_bin_path: field.input_bin_path,
        //     input_bin_file_pattern: field.input_bin_file_pattern
        // }));

        // Validation
        if (!finalConfig.datasetName) {
            toast.error("Please enter a dataset name.");
            return;
        }

        // Validate that at least one input type is selected
        if (!finalConfig.input_local && !finalConfig.input_remote) {
            toast.error("Please select at least one input type (Local or Remote).");
            return;
        }

        // Note: Output fields are optional, no validation required

        // Add node icon data to final config if available
        if (nodeIconData) {
            finalConfig.file_name = nodeIconData.file_name;
            finalConfig.icon_encrypted_file_key = nodeIconData.encrypted_file_key;
            finalConfig.icon_unique_id = nodeIconData.unique_id;
            finalConfig.icon_size = nodeIconData.size;
            finalConfig.file_category = "dataset_icon";
        }

        onConfigurationComplete(nodeDetails, finalConfig);
    };

    if (isLoading || !nodeDetails) {
        return <DatasetStepLoading message="Loading configuration..." className="min-h-[60vh] w-full" />;
    }

    // Functions to add/remove output fields
    const addOutputField = () => {
        const newId = Date.now().toString();
        setOutputFields([...outputFields, { id: newId, folder_path: '', output_path: '', output_file_pattern: '', tdate: '', tmonth: '' }]);
    };

    const removeOutputField = (id: string) => {
        if (outputFields.length > 1) {
            setOutputFields(outputFields.filter(field => field.id !== id));
        }
    };

    const updateOutputField = (id: string, key: keyof typeof outputFields[0], value: string) => {
        setOutputFields(outputFields.map(field =>
            field.id === id ? { ...field, [key]: value } : field
        ));
    };
    
    return ( 
        <div className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          isVirtualDb ? 'h-[55vh]' : 'h-full',
        )}>
            <div className="flex min-h-0 flex-1 overflow-hidden p-4">
                <ScrollArea className="h-full min-h-0 flex-1 pr-4">
                    <Form {...form}>
                        <form className="space-y-2">
                            {/* Dataset Name and Node Icon */}
                            <div className="flex items-start gap-4">
                                <FormItem className="flex-1">
                                    <FormLabel className="text-sm font-semibold">Dataset Name</FormLabel>
                                    <Controller
                                        name="datasetName"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    className="h-9 text-xs px-2"
                                                    placeholder="Enter dataset name"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                />
                                            </FormControl>
                                        )}
                                    />
                                    <FormMessage />
                                </FormItem>

                                {/* Dataset Icon Upload */}
                                <div className="flex flex-col items-start gap-1">
                                    <FormLabel className="text-sm font-semibold">Dataset Icon</FormLabel>
                                    <div className="space-y-1.5">
                                        <InputUpload
                                            name="datasetIcon"
                                            accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                                            onChange={(e) => handleIconChange(e)}
                                            initialFileName={nodeIconData?.file_name}
                                        />
                                        {isUploadingIcon && (
                                            <div className="flex items-center gap-1.5 text-xs text-blue-600">
                                                <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                <span>Uploading...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Source Information Section - Template fields only (excluding source_name, file_name_custom, file_date_pattern) */}
                            <div className="space-y-2 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Source Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AnimatePresence mode="sync">
                                        {/* Template fields in 3-column layout */}
                                        {templateFields.map(field => {
                                        // Render type and connection-related fields here (excluding mode, sftp_source_path, sftp_destination_path, file_pattern)
                                        if (['type', 'upload_file', 'sftp', 'amazon_s3', 'bucket_name', 'object_name', 'destination_path', 'file_category', 'sheet_name', 'delimiter', 'header'].includes(field.key)) {
                                            return renderFormField(field);
                                        }
                                        return null;
                                    })}
                                    {/* Render remaining template fields that haven't been rendered yet and are not in other sections */}
                                    {templateFields.map(field => {  
                                        const alreadyRendered = [
                                            'mode', 'type', 'upload_file', 'sftp', 'amazon_s3',
                                            'bucket_name', 'object_name', 'sftp_source_path',
                                            'destination_path', 'sftp_destination_path',
                                            'file_pattern', 'file_category', 'sheet_name', 'delimiter', 'header',
                                            'name', 'columns', 'dataset', 'query'
                                        ];

                                        // Check if field is in custom sections (Input, Output, Rollback)
                                        const inCustomSection = formConfig.sections.some(section =>
                                            section.fields.some((f: any) => f.key === field.key)
                                        );

                                        if (!alreadyRendered.includes(field.key) && !inCustomSection) {
                                            return renderFormField(field);
                                        }
                                        return null;
                                    })}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Input Section */}
                            <div className="space-y-2 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Input</h3>

                                {/* Local and Remote Checkboxes Side by Side */}
                                <div className="flex items-center gap-8">
                                    <Controller
                                        name="input_local"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                    checked={!!field.value}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        field.onChange(isChecked);
                                                        // If checking local, automatically uncheck remote and clear all input fields
                                                        if (isChecked && watchedFields.input_remote) {
                                                            form.setValue('input_remote', false);
                                                            setInputFields([{ id: '1', folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }]);
                                                        }
                                                    }}
                                                />
                                                <FormLabel className="text-sm font-medium cursor-pointer">Local</FormLabel>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="input_remote"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                    checked={!!field.value}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        field.onChange(isChecked);
                                                        // If checking remote, automatically uncheck local and clear all input fields
                                                        if (isChecked && watchedFields.input_local) {
                                                            form.setValue('input_local', false);
                                                            setInputFields([{ id: '1', folder_path: '', source_path: '', file_pattern: '', tdate: '', tmonth: '', move_to_process: false, process_path: '' }]);
                                                        }
                                                    }}
                                                />
                                                <FormLabel className="text-sm font-medium cursor-pointer">Remote</FormLabel>
                                            </div>
                                        )}
                                    />
                                </div>

                                {/* Dynamic Input Fields (Local or Remote) */}
                                {(watchedFields.input_local === true || watchedFields.input_remote === true) && (
                                    <div className="space-y-3 ml-6">
                                        <AnimatePresence mode="sync">
                                            {inputFields.map((inputField) => {
                                                const isRemote = watchedFields.input_remote;
                                                const sourcePathLabel = isRemote ? 'Remote Source Path' : 'Source Path';
                                                const processPathLabel = isRemote ? 'Remote Process Directory' : 'Process Directory';
                                                const sourcePathPlaceholder = isRemote ? 'Enter remote source path' : 'Enter local source path';
                                                const processPathPlaceholder = isRemote ? 'Enter remote process directory' : 'Enter process directory';
                                                return (
                                                <motion.div
                                                    key={inputField.id}
                                                    variants={fieldAnimationVariants}
                                                    initial="hidden"
                                                    animate="visible"
                                                    exit="exit"
                                                    layout
                                                    className="space-y-3 p-4 border rounded-md"
                                                >
                                                <div className="flex gap-4 items-start">
                                                    <div className="flex-1 space-y-3">
                                                        {/* First row: t+date t+month */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">T+Date</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder="Enter T+Date"
                                                                                value={inputField.tdate}
                                                                                onChange={(e) => updateInputField(inputField.id, 'tdate', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">T+Month</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder="Enter T+Month"
                                                                                value={inputField.tmonth}
                                                                                onChange={(e) => updateInputField(inputField.id, 'tmonth', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                  
                                                        </div>

                                                        {/* Second row: sourcepath filepattern */}
                                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                                                                      <FormItem>
                                                                <FormLabel className="text-xs font-medium">{sourcePathLabel}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        className="h-9 text-xs px-2"
                                                                        placeholder={sourcePathPlaceholder}
                                                                        value={inputField.source_path}
                                                                        onChange={(e) => updateInputField(inputField.id, 'source_path', e.target.value)}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-medium">File Pattern</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        className="h-9 text-xs px-2"
                                                                        placeholder="Enter file pattern"
                                                                        value={inputField.file_pattern}
                                                                        onChange={(e) => updateInputField(inputField.id, 'file_pattern', e.target.value)}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>

                                                        </div>

                                                        {/* third row: For Excel (non-upload) => Sheet Name | folderpath, For others =>  folderpath */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {isExcelNode && watchedFields.type && watchedFields.type !== 'upload' ? (
                                                                <>
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">Sheet Name</FormLabel>
                                                                        <FormControl>
                                                                            <AlternativeSelect
                                                                                options={(inputFieldSheetOptions[inputField.id] || []).map((opt: any) => ({
                                                                                    value: String(opt.value),
                                                                                    label: opt.label || String(opt.value),
                                                                                    description: opt.description
                                                                                }))}
                                                                                value={inputField.sheet_name || ''}
                                                                                onChange={(v) => updateInputField(inputField.id, 'sheet_name', v)}
                                                                                placeholder="Select a sheet"
                                                                                isLoading={loadingInputFieldSheets[inputField.id] || false}
                                                                                disabled={loadingInputFieldSheets[inputField.id] || false}
                                                                                className="h-9 text-xs"
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                                           <FormItem>
                                                                        <FormLabel className="text-xs font-medium">Folder Path</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={isRemote ? 'Enter remote folder path' : 'Enter local folder path'}
                                                                                value={inputField.folder_path}
                                                                                onChange={(e) => updateInputField(inputField.id, 'folder_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                </>
                                                            ) : (  
                                                                <>
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">Folder Path</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={isRemote ? 'Enter remote folder path' : 'Enter local folder path'}
                                                                                value={inputField.folder_path}
                                                                                onChange={(e) => updateInputField(inputField.id, 'folder_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                <div className="flex items-center space-x-2 pt-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                                        checked={inputField.move_to_process}
                                                                        onChange={(e) => updateInputField(inputField.id, 'move_to_process', e.target.checked)}
                                                                    />
                                                                    <FormLabel className="text-xs font-medium cursor-pointer">Move to Process</FormLabel>
                                                                </div>
                                       
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Fourth row: For Excel (non-upload) => Move to Process | Process Path, For others => Process Path (conditional) */}
                                                        {isExcelNode && watchedFields.type && watchedFields.type !== 'upload' ? (  
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                                                <div className="flex items-center space-x-2 pt-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                                        checked={inputField.move_to_process}
                                                                        onChange={(e) => updateInputField(inputField.id, 'move_to_process', e.target.checked)}
                                                                    />
                                                                    <FormLabel className="text-xs font-medium cursor-pointer">Move to Process</FormLabel>
                                                                </div>
                                                                {inputField.move_to_process && (  
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">{processPathLabel}</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={processPathPlaceholder}
                                                                                value={inputField.process_path}
                                                                                onChange={(e) => updateInputField(inputField.id, 'process_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            inputField.move_to_process && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">{processPathLabel}</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={processPathPlaceholder}
                                                                                value={inputField.process_path}
                                                                                onChange={(e) => updateInputField(inputField.id, 'process_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                </div>
                                                            )
                                                        )}

                                                    </div>
                                                    <div className="flex gap-2 pt-6">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={addInputField}
                                                            className="h-9 w-9 p-0"
                                                        >
                                                            +
                                                        </Button>
                                                        {inputFields.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => removeInputField(inputField.id)}
                                                                className="h-9 w-9 p-0"
                                                            >
                                                                -
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                            );
                                        })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Output Section */}
                            <div className="space-y-2 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Output</h3>

                                {/* Local and Remote Checkboxes Side by Side */}
                                <div className="flex items-center gap-8">
                                    <Controller
                                        name="output_local"
                                        control={form.control} 
                                        render={({ field }) => ( 
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                    checked={!!field.value}
                                                    onChange={(e) => {  // Added event parameter //
                                                        const isChecked = e.target.checked;
                                                        field.onChange(isChecked);
                                                        // If checking local, automatically uncheck remote and clear all output fields
                                                        if (isChecked && watchedFields.output_remote) {  
                                                            form.setValue('output_remote', false);
                                                            setOutputFields([{ id: '1', folder_path: '', output_path: '', output_file_pattern: '', tdate: '', tmonth: '' }]);
                                                        }
                                                    }}
                                                />
                                                <FormLabel className="text-sm font-medium cursor-pointer">Local</FormLabel>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="output_remote"
                                        control={form.control}
                                        render={({ field }) => (  
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border border-gray-300 focus:outline-none focus:ring-0"
                                                    checked={!!field.value}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        field.onChange(isChecked);
                                                        // If checking remote, automatically uncheck local and clear all output fields
                                                        if (isChecked && watchedFields.output_local) {  //
                                                            form.setValue('output_local', false);
                                                            setOutputFields([{ id: '1', folder_path: '', output_path: '', output_file_pattern: '', tdate: '', tmonth: '' }]);
                                                        }
                                                    }}
                                                />
                                                <FormLabel className="text-sm font-medium cursor-pointer">Remote</FormLabel>
                                            </div>
                                        )}
                                    />
                                </div>

                                {/* Dynamic Output Fields (Local or Remote) */}
                                {(watchedFields.output_local === true || watchedFields.output_remote === true) && (  
                                    <div className="space-y-3 ml-6">
                                        <AnimatePresence mode="sync">
                                            {outputFields.map((outputField) => {  
                                                const isRemote = watchedFields.output_remote;
                                                const outputPathLabel = isRemote ? 'Remote Output Path' : 'Output Path';
                                                const outputPathPlaceholder = isRemote ? 'Enter remote output path' : 'Enter local output path';
                                                return (   
                                                    <motion.div
                                                        key={outputField.id}
                                                        variants={fieldAnimationVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                        exit="exit"
                                                        layout
                                                        className="space-y-3 p-4 border rounded-md"
                                                    >
                                                        <div className="flex gap-4 items-start">
                                                            <div className="flex-1 space-y-3">
                                                                {/* First row: Output Path and Output File Pattern */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">{outputPathLabel}</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={outputPathPlaceholder}
                                                                                value={outputField.output_path}
                                                                                onChange={(e) => updateOutputField(outputField.id, 'output_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">Output File Pattern</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder="Enter output file pattern"
                                                                                value={outputField.output_file_pattern}
                                                                                onChange={(e) => updateOutputField(outputField.id, 'output_file_pattern', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                </div>

                                                                {/* Second row: T+Date and T+Month */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">T+Date</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder="Enter T+Date"
                                                                                value={outputField.tdate}
                                                                                onChange={(e) => updateOutputField(outputField.id, 'tdate', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">T+Month</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder="Enter T+Month"
                                                                                value={outputField.tmonth}
                                                                                onChange={(e) => updateOutputField(outputField.id, 'tmonth', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                </div>

                                                                {/* Third row: Folder Path (half width) */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-medium">Folder Path</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                className="h-9 text-xs px-2"
                                                                                placeholder={isRemote ? 'Enter remote folder path' : 'Enter local folder path'}
                                                                                value={outputField.folder_path}
                                                                                onChange={(e) => updateOutputField(outputField.id, 'folder_path', e.target.value)}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 pt-6">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={addOutputField}
                                                                    className="h-9 w-9 p-0"
                                                                >
                                                                    +
                                                                </Button>
                                                                {outputFields.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => removeOutputField(outputField.id)}
                                                                        className="h-9 w-9 p-0"
                                                                    >
                                                                        -
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Rollback Section - COMMENTED OUT */}
                            {/* <div className="space-y-2 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Rollback</h3>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-medium text-muted-foreground">Output</h4>
                                    {rollbackOutputFields.map((rollbackField) => (
                                        <div key={rollbackField.id} className="flex gap-4 items-start">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormItem>
                                                    <FormLabel className="text-xs font-medium">Output Bin Path</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            className="h-9 text-xs px-2"
                                                            placeholder="Enter output bin path"
                                                            value={rollbackField.output_bin_path}
                                                            onChange={(e) => updateRollbackOutputField(rollbackField.id, 'output_bin_path', e.target.value)}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                                <FormItem>
                                                    <FormLabel className="text-xs font-medium">Output Bin File Pattern</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            className="h-9 text-xs px-2"
                                                            placeholder="Enter output bin file pattern"
                                                            value={rollbackField.output_bin_file_pattern}
                                                            onChange={(e) => updateRollbackOutputField(rollbackField.id, 'output_bin_file_pattern', e.target.value)}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            </div>
                                            <div className="flex gap-2 pt-6">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addRollbackOutputField}
                                                    className="h-9 w-9 p-0"
                                                >
                                                    +
                                                </Button>
                                                {rollbackOutputFields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeRollbackOutputField(rollbackField.id)}
                                                        className="h-9 w-9 p-0"
                                                    >
                                                        -
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1 pt-1">
                                    <h4 className="text-xs font-medium text-muted-foreground">Input</h4>
                                    {rollbackInputFields.map((rollbackField) => (
                                        <div key={rollbackField.id} className="flex gap-4 items-start">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormItem>
                                                    <FormLabel className="text-xs font-medium">Input Bin Path</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            className="h-9 text-xs px-2"
                                                            placeholder="Enter input bin path"
                                                            value={rollbackField.input_bin_path}
                                                            onChange={(e) => updateRollbackInputField(rollbackField.id, 'input_bin_path', e.target.value)}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                                <FormItem>
                                                    <FormLabel className="text-xs font-medium">Input Bin File Pattern</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            className="h-9 text-xs px-2"
                                                            placeholder="Enter input bin file pattern"
                                                            value={rollbackField.input_bin_file_pattern}
                                                            onChange={(e) => updateRollbackInputField(rollbackField.id, 'input_bin_file_pattern', e.target.value)}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            </div>
                                            <div className="flex gap-2 pt-6">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addRollbackInputField}
                                                    className="h-9 w-9 p-0"
                                                >
                                                    +
                                                </Button>
                                                {rollbackInputFields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeRollbackInputField(rollbackField.id)}
                                                        className="h-9 w-9 p-0"
                                                    >
                                                        -
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div> */}
                        </form>
                    </Form>
                </ScrollArea>
            </div>
            
            <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-2">
                <Button variant="outline" onClick={onBack} size='sm' >
                    Back
                </Button>
                <Button variant="default" onClick={handleNext} size='sm' >
                    Next
                </Button>
            </footer>
            
        </div>
    );
};

export default Step2ConfigurationFiles;


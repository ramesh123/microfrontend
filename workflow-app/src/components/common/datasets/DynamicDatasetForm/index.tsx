// src/components/common/datasets/DynamicDatasetForm/index.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { NodeDetails, TemplateField } from '@/types/dataset';
import { getDatasetById, performDatabaseAction } from '@/controllers/API/datasetApi';
import { shouldSkipCascadeRefetchForChangedKey } from '@/controllers/API/apiService';
import { Combobox } from '@/components/ui/combobox';


interface DynamicDatasetFormProps { 
    nodeDetails: NodeDetails;
    initialData: Record<string, any> | null;
    datasetIdToEdit?: number | null;
    onSuccess: (data: Record<string, any>) => void;
    onCancel: () => void;
    isEditing: boolean;
}

const DynamicDatasetForm = ({ nodeDetails, initialData, datasetIdToEdit, onSuccess, onCancel, isEditing }: DynamicDatasetFormProps) => {  
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});
    const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
    const [isEditingLoading, setIsEditingLoading] = useState(false);
    
    const { formSchema, sortedTemplateFields } = useMemo(() => { 
        const schemaShape: { [key: string]: z.ZodTypeAny } = {
            datasetName: z.string().min(1, 'Dataset name is required'),
        };
        const fields = Object.values(nodeDetails.node.template)
            .filter(field => field.key !== 'name' && field.key !== 'columns')
            .sort((a, b) => a.position - b.position);

        fields.forEach(field => { 
            let fieldSchema: z.ZodTypeAny;
            if (field.type === 'text' || field.type === 'textarea' || field.type === 'dropdown') { 
                fieldSchema = z.string({ required_error: `${field.display_name} is required.` });
            } else if (field.type === 'multi-dropdown') { 
                fieldSchema = z.array(z.any());
            } else { 
                fieldSchema = z.any();
            }
            if (field.required) { 
                if (fieldSchema instanceof z.ZodString) {  
                    fieldSchema = fieldSchema.min(1, { message: `${field.display_name} is required.` });
                } else { 
                     fieldSchema = fieldSchema.refine(val => val !== null && val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0), { 
                        message: `${field.display_name} is required.`,
                    });
                }
            } else {
                fieldSchema = fieldSchema.optional().nullable();
            }
            schemaShape[field.key] = fieldSchema;
        });

        return {
            formSchema: z.object(schemaShape),
            sortedTemplateFields: fields,
        };
    }, [nodeDetails.node.template]);

    const form = useForm({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
        defaultValues: useMemo(() => {
            const defaultVals: Record<string, any> = { datasetName: '' };
            sortedTemplateFields.forEach(field => {
                defaultVals[field.key] = initialData?.[field.key] ?? field.default ?? '';
                if(field.type === 'multi-dropdown' && !defaultVals[field.key]){
                    defaultVals[field.key] = [];
                }
            });
            return defaultVals;
        }, [initialData, sortedTemplateFields])
    });

    const fetchOptions = useCallback(async (field: TemplateField, currentFormValues: Record<string, any>): Promise<any[]> => {
        if (!field.fetch?.params) return field.options || [];
        setLoadingOptions(prev => ({ ...prev, [field.key]: true }));
    
        let paramsString = JSON.stringify(field.fetch.params);
        const placeholders = paramsString.match(/{{(.*?)}}/g) || [];
        for (const placeholder of placeholders) {
            const key = placeholder.replace(/{{|}}/g, '');
            const value = currentFormValues[key];
            if (value === undefined || value === null || value === '') {
                 setLoadingOptions(prev => ({ ...prev, [field.key]: false }));
                 throw new Error(`Missing required parameter for fetch: ${key}`);
            }
            paramsString = paramsString.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), String(value));
        }
        
        const finalParams = JSON.parse(paramsString);
    
        try {
            const { module, klass } = field.fetch;
            const options = await performDatabaseAction(module, klass, finalParams);
            const formattedOptions = options.map(opt => (typeof opt === 'object' && opt.value !== undefined ? opt : { value: opt, label: String(opt) }));
            setDynamicOptions(prev => ({ ...prev, [field.key]: formattedOptions }));
            return formattedOptions;
        } catch (error) {
            console.error(`Failed to fetch options for ${field.key}`, error);
            toast.error(getDisplayErrorMessage(error, `Could not load options for ${field.display_name}.`));
            setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
            throw error;
        } finally {
            setLoadingOptions(prev => ({ ...prev, [field.key]: false }));
        }
    }, []);

    const handleValueChange = useCallback((changedFieldKey: string, value: any) => {
        form.setValue(changedFieldKey, value, { shouldDirty: true, shouldValidate: true });
        const updatedFormValues = { ...form.getValues(), [changedFieldKey]: value };
        if (shouldSkipCascadeRefetchForChangedKey(changedFieldKey, updatedFormValues)) {
            return;
        }
        sortedTemplateFields.forEach(field => {
            const dependsOnChangedKey = field.fetch?.params && JSON.stringify(field.fetch.params).includes(`{{${changedFieldKey}}}`);
            if (dependsOnChangedKey) {
                form.setValue(field.key, field.type === 'multi-dropdown' ? [] : '', { shouldValidate: true });
                setDynamicOptions(prev => ({ ...prev, [field.key]: [] }));
                const newFormValues = { ...updatedFormValues, [field.key]: '' };
                fetchOptions(field, newFormValues).catch(() => {});
            }
        });
    }, [form, sortedTemplateFields, fetchOptions]);
    
    const loadExistingDataset = useCallback(async (datasetId: number) => {
        setIsEditingLoading(true);
        try {
            const dataset = await getDatasetById(datasetId);
            form.reset({ datasetName: dataset.name, ...dataset.payload });
            const initialValues = form.getValues();
            const fetchPromises = sortedTemplateFields
                .filter(field => field.fetch?.params)
                .map(field => fetchOptions(field, initialValues).catch(() => {}));
            await Promise.all(fetchPromises);
        } catch (error) {
            toast.error(getDisplayErrorMessage(error, 'Failed to load dataset for editing.'));
        } finally {
            setIsEditingLoading(false);
        }
    }, [form, sortedTemplateFields, fetchOptions]);

    useEffect(() => {
        if (datasetIdToEdit) {
            loadExistingDataset(datasetIdToEdit);
        } else {
            const initialValues = form.getValues();
            sortedTemplateFields.forEach(field => {
                if (field.fetch && !JSON.stringify(field.fetch.params).includes('{{')) {
                    fetchOptions(field, initialValues).catch(() => {});
                }
            });
        }
    }, [datasetIdToEdit]);

    const handleNext = async () => {
        const isNameValid = await form.trigger("datasetName");
        if (!isNameValid) {
            toast.error("Please provide a name for the dataset.");
            return;
        }

        const data = form.getValues();
        const columnsField = Object.values(nodeDetails.node.template).find(f => f.key === 'columns');
        
        if (!columnsField?.fetch) {
            data.columns = [];
            onSuccess(data);
            return;
        }

        const fetchToast = toast.loading("Attempting to fetch column definitions...");
        try {
            const options = await fetchOptions(columnsField, data);
            
            if (options.length === 0) {
               toast.warning("No columns were found. You can define them manually in the next step.", { id: fetchToast });
            } else {
               toast.success("Columns fetched successfully!", { id: fetchToast });
            }
            data.columns = options?.map((o: { value: any }) => o.value) || [];
            onSuccess(data);

        } catch (err) {
            console.error("Column fetch failed:", err);
            toast.error(
                getDisplayErrorMessage(err, 'Could not fetch columns. Please check data source details (e.g., Connection, Table).'),
                { id: fetchToast },
            );
        }
    };

    const renderField = (field: TemplateField) => {
        const isLoading = loadingOptions[field.key];
        const options = dynamicOptions[field.key] || field.options || [];

        return (
            <FormItem key={field.key} className="w-full">
                <FormLabel>{field.display_name} {field.required && <span className="text-destructive">*</span>}</FormLabel>
                 <Controller
                    name={field.key}
                    control={form.control}
                    render={({ field: controllerField }) => (
                        <>
                            {isLoading ? <Skeleton className="h-10 w-full" /> : (
                                <FormControl>
                                     {field.type === 'dropdown' ? ( 
                                        <Combobox
                                            options={options}
                                            value={String(controllerField.value ?? '')}
                                            onChange={(value) => handleValueChange(field.key, value)}
                                            placeholder={field.placeholder}
                                        />
                                    ) : field.type === 'textarea' ? (
                                        <Textarea placeholder={field.placeholder} {...controllerField} value={controllerField.value ?? ''} />
                                    ) : (
                                        <Input placeholder={field.placeholder} {...controllerField} value={controllerField.value ?? ''} />
                                    )}
                                </FormControl>
                            )}
                            <FormDescription>{field.info}</FormDescription>
                            <FormMessage />
                        </>
                    )}
                />
            </FormItem>
        );
    };
    
    if (isEditingLoading) { 
        return (
             <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-1/2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            </div>
        )
    }

    return (
        <Card className="h-full flex flex-col border-none shadow-none">
            <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()} className="flex-grow flex flex-col overflow-hidden">
                    <CardContent className="flex-grow overflow-y-auto space-y-4 pr-3 pt-6">
                         <FormItem>
                            <FormLabel>Dataset Name <span className="text-destructive">*</span></FormLabel>
                             <Controller
                                name="datasetName"
                                control={form.control}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input placeholder="Enter a unique name for your dataset" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                )}
                            />
                            <FormMessage />
                        </FormItem>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {sortedTemplateFields.map(renderField)}
                        </div>
                    </CardContent>
                    <CardFooter className="flex-shrink-0 justify-end gap-2 pt-4 border-t bg-background">
                        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                        <Button type="button" onClick={handleNext} disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Processing...' : 'Next'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
};

export default DynamicDatasetForm;
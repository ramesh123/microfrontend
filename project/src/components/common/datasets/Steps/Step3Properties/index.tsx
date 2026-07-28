// src/components/common/datasets/Steps/Step3Properties.tsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { NodeDetails } from '@/types/dataset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/controllers/API/api';
import DatasetStepLoading from '@/components/common/datasets/DatasetStepLoading';
import { executeApiRequestSilent, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';

const DATA_TYPE_OPTIONS = [
    { value: 'str', label: 'String (str)' },
    { value: 'int', label: 'Integer (int)' },
    { value: 'float', label: 'Float (float)' },
    { value: 'datetime', label: 'Datetime (datetime)' },
    { value: 'bool', label: 'Boolean (bool)' },
    { value: 'array', label: 'Array (array)' },
    { value: 'object', label: 'Object (object)' },
    { value: 'date', label: 'Date (date)' },
    { value: 'time', label: 'Time (time)' },
    { value: 'timestamp', label: 'Timestamp (timestamp)' },
];

// Map backend dtype names to frontend type values
const mapBackendDtypeToFrontend = (dtype: string): string => {
    const mapping: Record<string, string> = {
        'Int64': 'int',
        'Int32': 'int',
        'Int16': 'int',
        'Int8': 'int',
        'UInt64': 'int',
        'UInt32': 'int',
        'UInt16': 'int',
        'UInt8': 'int',
        'Float64': 'float',
        'Float32': 'float',
        'String': 'str',
        'Object': 'object',
        'Boolean': 'bool',
        'Bool': 'bool',
        'DateTime': 'datetime',
        'Datetime64': 'datetime',
        'Date': 'date',
        'Time': 'time',
        'Timestamp': 'timestamp',
    };

    return mapping[dtype] || dtype.toLowerCase();
};

function normalizeColumnNames(columns: unknown[]): string[] {
    return columns.map((col) => (typeof col === 'object' && col != null && 'name' in col
        ? String((col as { name: string }).name)
        : String(col)));
}

function buildPropertiesFromColumns(
    columns: unknown[],
    columnMapping: Array<{ column_name: string; dtype?: string }>,
    initialData: any[] | null,
): any[] {
    const colNames = normalizeColumnNames(columns);

    if (initialData && initialData.length > 0) {
        return colNames.map((colName, index) => {
            const existingProp = initialData.find((p: any) => p.name === colName);
            const mappingEntry = columnMapping.find((m) => m.column_name === colName);
            const frontendType = mapBackendDtypeToFrontend(mappingEntry?.dtype || 'str');

            if (existingProp) {
                return {
                    id: existingProp.id || `${colName}-${index}`,
                    name: colName,
                    display_name: existingProp.display_name || colName,
                    type: existingProp.type || frontendType,
                    isSelected: existingProp.isSelected !== undefined ? existingProp.isSelected : true,
                };
            }

            return {
                id: `${colName}-${index}`,
                name: colName,
                display_name: colName,
                type: frontendType,
                isSelected: false,
            };
        });
    }

    return colNames.map((colName, index) => {
        const mappingEntry = columnMapping.find((m) => m.column_name === colName);
        const frontendType = mapBackendDtypeToFrontend(mappingEntry?.dtype || 'str');
        const colObj = columns[index];
        const displayName =
            typeof colObj === 'object' && colObj != null && 'display_name' in colObj
                ? String((colObj as { display_name?: string }).display_name)
                : colName;

        return {
            id: `${colName}-${index}`,
            name: colName,
            display_name: displayName || colName,
            type: frontendType,
            isSelected: true,
        };
    });
}

// Sub-component for a single sortable row
const SortablePropertyRow = ({ prop, onPropertyChange, onToggle }: any) => { 
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-2 items-center p-1 rounded-md hover:bg-muted">
            <div className="col-span-1 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-grab" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></Button>
                <Checkbox checked={prop.isSelected} onCheckedChange={(checked) => onToggle(prop.id, checked)} />
            </div>
            <div className="col-span-3">
                <Input
                    value={prop.name}
                    readOnly
                    disabled
                    className="h-8 text-xs bg-muted/50"
                />
            </div>
            <div className="col-span-4">
                <Input
                    value={prop.display_name || ''}
                    onChange={(e) => onPropertyChange(prop.id, 'display_name', e.target.value)}
                    placeholder="Display name"
                    className="h-8 text-xs"
                />
            </div>
            <div className="col-span-4">
                <Select value={prop.type} onValueChange={(value) => onPropertyChange(prop.id, 'type', value)}>
                    <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        {DATA_TYPE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

interface Step3PropertiesProps {
    nodeDetails: NodeDetails;
    configurationData: Record<string, any>;
    initialData: any[] | null;
    onPropertiesComplete: (properties: any[]) => void;
    onBack: () => void;
}

const Step3Properties = ({ nodeDetails, configurationData, onPropertiesComplete, initialData, onBack }: Step3PropertiesProps) => {
    const [properties, setProperties] = useState<any[]>([]);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);
    const location = useLocation();
    const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);

    // Detect if this is a file dataset
    const isFileDataset = useMemo(() => nodeDetails?.group === 'Files', [nodeDetails]);

    // Keys to hide from Configuration Summary
    const keysToHide = [
        'columns',
        'column_mapping',
        'mode',
        'encrypted_file_key',
        'unique_id',
        'upload_file',
        'query',
        'file_name', // Hide technical file name, show in summary instead
        'size',
        // Hide additional dynamic fields from Step2ConfigurationFiles
        'output_fields',
        'local_input_fields',
        'remote_input_fields',
        'rollback_output_fields',
        'rollback_input_fields',
        'input_local',
        'input_remote',
        // Hide output fields
        'output_local',
        'output_remote',
        'local_output_fields',
        'remote_output_fields',
    ];

    useEffect(() => {
        const fetchFileColumns = async () => {
            // For file datasets, call file-actions API to get columns with datatypes
            if (!isFileDataset) return;

            setIsLoadingColumns(true);
            try {
                // Build the payload similar to view-data
                const payload = JSON.parse(JSON.stringify(nodeDetails.node.payload));
                Object.keys(payload).forEach(key => {
                    const placeholder = payload[key];
                    if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {
                        const dataKey = placeholder.replace(/{{|}}/g, '');
                        payload[key] = configurationData[dataKey] ?? '';
                    }
                });

                // Add additional fields from configurationData (input, output, rollback fields)
                // These are created in Step2ConfigurationFiles and need to be included in get_columns call
                const additionalFields = [
                    'output_fields',
                    'local_input_fields',
                    'remote_input_fields',
                    'rollback_output_fields',
                    'rollback_input_fields',
                    'input_local',
                    'input_remote',
                    // Add output fields
                    'output_local',
                    'output_remote',
                    'local_output_fields',
                    'remote_output_fields'
                ];

                additionalFields.forEach(field => {
                    if (configurationData[field] !== undefined) {
                        payload[field] = configurationData[field];
                    }
                });

                console.log('[Step3Properties] Payload with additional fields:', payload);
                console.log('[Step3Properties] Output fields in payload:', {
                    output_local: payload.output_local,
                    output_remote: payload.output_remote,
                    local_output_fields: payload.local_output_fields,
                    remote_output_fields: payload.remote_output_fields
                });

                // Set the action to get_columns
                payload.actions = 'get_columns';
                payload.response_type = 'json';

                // Get the file type from node_id (e.g., 'csv', 'excel')
                const fileType = nodeDetails.node_id;

                console.log('[Step3Properties] Calling file-actions API for:', fileType);
                console.log('[Step3Properties] Payload with additional fields:', payload);

                const data = await executeApiRequestSilent<{
                    data?: string[];
                    column_mapping?: Array<{ column_name: string; dtype?: string }>;
                }>(
                    () => api.post(`/files/${fileType}-actions`, { payload }),
                    'Failed to load file columns',
                );
                console.log('[Step3Properties] file-actions response:', data);

                // Extract columns and column_mapping from the response
                const columns = data.data || [];
                const columnMapping = data.column_mapping || [];

                // If we have initialData (editing mode), merge with API response
                if (initialData && initialData.length > 0) {
                    console.log('[Step3Properties] Edit mode: Merging API columns with existing properties');

                    // Map all columns from API, preserving user modifications where they exist
                    const mergedProperties = columns.map((colName: string, index: number) => {
                        // Find existing property configuration by name
                        const existingProp = initialData.find((p: any) => p.name === colName);

                        // Find the data type from column_mapping (current file dtype)
                        const mappingEntry = columnMapping.find((m: any) => m.column_name === colName);
                        const backendDtype = mappingEntry?.dtype || 'str';
                        const frontendType = mapBackendDtypeToFrontend(backendDtype);

                        if (existingProp) {
                            // Column exists in saved dataset - preserve user modifications
                            return {
                                id: existingProp.id || `${colName}-${index}`,
                                name: colName,
                                display_name: existingProp.display_name || colName,
                                type: existingProp.type || frontendType, // Use saved type if modified
                                isSelected: existingProp.isSelected !== undefined ? existingProp.isSelected : true
                            };
                        } else {
                            // New column not in saved dataset - add as unselected
                            return {
                                id: `${colName}-${index}`,
                                name: colName,
                                display_name: colName,
                                type: frontendType,
                                isSelected: false // New columns are unselected by default
                            };
                        }
                    });

                    setProperties(mergedProperties);
                } else {
                    // New dataset: map columns with datatypes from column_mapping
                    setProperties(columns.map((colName: string, index: number) => {
                        // Find the data type from column_mapping
                        const mappingEntry = columnMapping.find((m: any) => m.column_name === colName);
                        const backendDtype = mappingEntry?.dtype || 'str';

                        // Convert backend dtype to frontend type
                        const frontendType = mapBackendDtypeToFrontend(backendDtype);

                        return {
                            id: `${colName}-${index}`,
                            name: colName,
                            display_name: colName,
                            type: frontendType,
                            isSelected: true
                        };
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch file columns:', error);
                toast.error(getDisplayErrorMessage(error, 'Failed to load file columns'));
            } finally {
                setIsLoadingColumns(false);
            }
        };

        const columnsFromConfig = configurationData.columns || [];
        const columnMapping = configurationData.column_mapping || [];

        if (isFileDataset) {
            fetchFileColumns();
            return;
        }

        // Database: get_columns runs once in Step 2 — reuse columns here (no second postgresql-actions call).
        if (columnsFromConfig.length > 0) {
            setProperties(buildPropertiesFromColumns(columnsFromConfig, columnMapping, initialData));
            return;
        }

        if (initialData && initialData.length > 0) {
            setProperties(
                initialData.map((prop: any, i: number) => ({
                    ...prop,
                    id: prop.id || `${prop.name}-${i}`,
                    isSelected: prop.isSelected !== undefined ? prop.isSelected : true,
                })),
            );
        }
    }, [configurationData, initialData, nodeDetails, isFileDataset]);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) { 
            setProperties((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };
    
    const handlePropertyChange = (id: string, key: string, value: any) => {  
        setProperties(properties.map(prop => prop.id === id ? { ...prop, [key]: value } : prop));
    };

    const handleToggleProperty = (id: string, isChecked: boolean | 'indeterminate') => {
        setProperties(properties.map(prop => prop.id === id ? { ...prop, isSelected: !!isChecked } : prop));
    };

    const selectedCount = properties.filter(p => p.isSelected).length;
    const allSelected = properties.length > 0 && selectedCount === properties.length;
    const someSelected = selectedCount > 0 && !allSelected;

    const handleToggleAll = (checked: boolean | 'indeterminate') => {
        const selectAll = !!checked;
        setProperties(properties.map(prop => ({ ...prop, isSelected: selectAll })));
    };

    const getFieldDisplayName = (key: string): string => { 
        const field = Object.values(nodeDetails.node.template).find(f => f.key === key);
        if (field) return field.display_name;
        switch(key) { case 'datasetName': return 'Dataset Name'; default: return key; }
    }

    return (
        <div className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden p-4',
          isVirtualDb ? 'h-[55vh]' : 'h-full',
        )}>
            <main className="grid min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden">
                <div className="col-span-4 h-full">
                    <Card className="h-full flex flex-col py-2">
                        <CardHeader className="p-0 pl-2">
                            <CardTitle className="!text-[16px] py-1">Configuration Summary</CardTitle>
                        </CardHeader>
                        <CardContent className={`${isVirtualDb ? 'h-[220px] overflow-y-auto' : 'flex-1 overflow-y-auto'} space-y-2 text-xs`}>
                            {Object.entries(configurationData).map(([key, value]) => {
                                if (keysToHide.includes(key) || !value) return null;
                                return (
                                    <div key={key} className="flex justify-between items-center border-t pt-2">
                                        <span className="font-semibold text-muted-foreground">{getFieldDisplayName(key)}:</span>
                                        <span className="truncate text-right pl-4 font-medium">{String(value)}</span>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-8 h-full">
                    <Card className={`h-full flex flex-col gap-2 ${isVirtualDb ? 'py-1 gap-1' : 'py-2'}`}>
                        <CardHeader className="p-0 pl-2 flex-shrink-0">
                            <CardTitle className="!text-[16px] py-1">Schema Properties</CardTitle>
                            <CardDescription className="text-xs">
                                {isLoadingColumns ? 'Loading columns...' : `${selectedCount} of ${properties.length} columns selected`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col overflow-hidden px-1 min-h-0 h-full">
                            {isLoadingColumns ? (
                                <DatasetStepLoading message="Loading columns..." className="h-full w-full min-h-[200px]" size="sm" />
                            ) : (
                                <>
                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-2 border-b flex-shrink-0">
                                        <div className="col-span-1 flex items-center pl-7.5">
                                            <Checkbox
                                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                                onCheckedChange={handleToggleAll}
                                                aria-label="Select all columns"
                                            />
                                        </div>
                                        <div className="col-span-3">Name</div>
                                        <div className="col-span-4">Display Name</div>
                                        <div className="col-span-4">Type</div>
                                    </div>
                                    <div className={`flex-1 overflow-y-auto ${isVirtualDb ? 'min-h-[8rem] max-h-[14rem]' : 'min-h-[20rem] max-h-[28rem]'}`}>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={properties} strategy={verticalListSortingStrategy}>
                                                <div className="space-y-1 p-1">
                                                    {properties.map((prop) => (
                                                        <SortablePropertyRow key={prop.id} prop={prop} onPropertyChange={handlePropertyChange} onToggle={handleToggleProperty} />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
            <footer className="flex shrink-0 justify-end gap-2 border-t bg-background pt-4">
                <Button variant="outline" onClick={onBack} size='sm'>Back</Button>
                <Button
                    onClick={() => onPropertiesComplete(properties)}
                    size='sm'
                    variant='default'
                    disabled={selectedCount === 0}
                >
                    Next ({selectedCount} selected)
                </Button>
            </footer>
        </div>
    );
};

export default Step3Properties;
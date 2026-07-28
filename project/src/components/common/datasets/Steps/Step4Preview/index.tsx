// // src/components/common/datasets/Steps/Step4Preview.tsx
// import { useEffect, useState } from 'react';
// import { NodeDetails } from '@/types/dataset';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { Skeleton } from '@/components/ui/skeleton';
// import { getDataPreview, createDataset } from '@/controllers/API/datasetApi';
// import { toast } from 'sonner';
// import { AgGridReact } from 'ag-grid-react';
// import { ColDef, GridOptions, TextFilterParams, themeQuartz } from 'ag-grid-community';
// import SmartCellRenderer from '@/components/core/cellRenderer';
// import { useTheme } from '@/context/theme';

// interface Step4PreviewProps {
//     nodeDetails: NodeDetails;
//     configurationData: Record<string, any>;
//     propertiesData: any[];
//     onBack: () => void;
//     onSaveSuccess: () => void;
//     onSave?: () => void; // Changed from onSaveSuccess
//     isEditing?: boolean;

// }

// const agTheme = themeQuartz
// .withParams(
//   {
//     backgroundColor: '#FAFAFA',
//     foregroundColor: '#361008CC',
//     browserColorScheme: 'light',
//   },
//   'light-red'
// )
// .withParams(
//   {
//     backgroundColor: '#141516',
//     foregroundColor: '#FFFFFFCC',
//     browserColorScheme: 'dark',
//   },
//   'dark-red'
// );


// const Step4Preview = ({ nodeDetails, configurationData, propertiesData, onBack, onSaveSuccess,onSave, isEditing }: Step4PreviewProps) => {
//     const [isLoading, setIsLoading] = useState(true);
//     const [isSaving, setIsSaving] = useState(false);
//     const [colDefs, setColDefs] = useState<ColDef[]>([]);
//     const [rowData, setRowData] = useState<any[]>([]);
//     const { currentTheme } = useTheme() as any;

//     // This hook connects your application's theme to the AG Grid theme mode.
//     useEffect(() => {
//         const mode = currentTheme === "dark" ? "dark-red" : "light-red";
//         document.body.setAttribute('data-ag-theme-mode', mode);
//         return () => {
//             document.body.removeAttribute('data-ag-theme-mode');
//         }
//     }, [currentTheme]);

//     // The gridOptions object is where we pass our custom theme object.
//     const gridOptions: GridOptions = {
//         theme: agTheme, // CORRECT: Pass the theme object here.
//     };

//     // --- Data Fetching and Saving Logic (Unchanged) ---
//     useEffect(() => {
//         const fetchPreview = async () => { 
//             setIsLoading(true);
//             try { 
//                 const payload = JSON.parse(JSON.stringify(nodeDetails.node.payload));
//                 Object.keys(payload).forEach(key => {  
//                     const placeholder = payload[key];
//                     if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {
//                         const dataKey = placeholder.replace(/{{|}}/g, '');
//                         payload[key] = configurationData[dataKey] ?? '';
//                     }
//                 });
//                 payload.name = configurationData.datasetName;
//                 const hasSelectedProperties = propertiesData.length > 0 && propertiesData.some(p => p.name);
//                 payload.columns = hasSelectedProperties 
//                     ? propertiesData.map(p => p.name).filter(Boolean) 
//                     : (configurationData.columns || []);

//                 if (payload.columns.length === 0) {
//                     toast.info("No columns to preview.");
//                     setColDefs([]);
//                     setRowData([]);
//                     setIsLoading(false);
//                     return;
//                 }

//                 const { module, klass } = nodeDetails.node.get_data;
//                 const data = await getDataPreview(module, klass, payload);
//                 const requestedColumns = payload.columns || [];
//                 const availableColumns = data.columns || [];
//                 const columnsToShow = requestedColumns.length > 0 
//                     ? requestedColumns.filter(col => availableColumns.includes(col))
//                     : availableColumns;

//                 const gridColumns = columnsToShow.map((column: string) => ({
//                         field: column,
//                         headerName: column,
//                         filter: 'agTextColumnFilter',
//                         filterParams: {
//                           closeOnApply: true,
//                         } as TextFilterParams,
//                       }));
//                 setColDefs(gridColumns);
//                 setRowData(data.data || []);
//             } catch (error) {
//                 toast.error("Could not load data preview.");
//                 setColDefs([]);
//                 setRowData([]);
//             } finally {
//                 setIsLoading(false);
//             }
//         };
//         fetchPreview();
//     }, [nodeDetails, configurationData, propertiesData]);

//     const handleSave = async () => {
//         setIsSaving(true);
//         const { datasetName } = configurationData;
//         const submissionPayload = { ...nodeDetails.node.payload };
//         Object.keys(submissionPayload).forEach(key => {
//             const placeholder = submissionPayload[key];
//              if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {
//                 const dataKey = placeholder.replace(/{{|}}/g, '');
//                 submissionPayload[key] = configurationData[dataKey] ?? '';
//             }
//         });
//         submissionPayload.name = datasetName;
//         submissionPayload.columns = propertiesData.map(p => p.name).filter(Boolean);
//         const submissionData = { 
//             name: datasetName, 
//             node_id:nodeDetails.node_id,
//             dataset_type: nodeDetails.name, 
//             dataset_group: nodeDetails.group, 
//             payload: submissionPayload, 
//             template: nodeDetails.node.template, 
//             properties: propertiesData 
//         };
//         try {
//             await createDataset(submissionData);
//             onSaveSuccess();
//             onSave(); 

//         } finally {
//             setIsSaving(false);
//         }
//     };

//     return ( 
//         <div className="h-full p-6 space-y-6">
//           <header>
//             <h1 className="text-xl font-bold">Preview & Save</h1>
//             <p className="text-sm text-muted-foreground">
//               Review a preview of your data. If it looks correct, save the dataset.
//             </p>
//           </header>

//           <Card>
//             <CardHeader>
//               <CardTitle>Data Preview</CardTitle>
//               <CardDescription>
//                 {rowData.length > 0
//                   ? `Showing ${rowData.length} rows`
//                   : 'No data to display'}
//               </CardDescription>
//             </CardHeader>
//             {/* The CardContent has no special classes. It will wrap its child. */}
//             <CardContent className="p-0"> 
//               {isLoading ? ( 
//                 <div className="p-6">
//                   <Skeleton className="w-full h-[500px]" />
//                 </div>
//               ) : colDefs.length === 0 || rowData.length === 0 ? ( 
//                 <div className="flex items-center justify-center h-[500px] text-muted-foreground">
//                   <div className="text-center">
//                     <p className="text-lg font-medium">No data available</p>
//                     <p className="text-sm">Check your configuration and try again</p>
//                   </div>
//                 </div>
//               ) : (
//                 // FIX 1: Set a fixed height directly on the grid container.
//                 // FIX 2: Apply the base theme CLASS (`ag-theme-quartz`). This is required.
//                 <div className="h-[350px]">
//                   <AgGridReact
//                     rowData={rowData}
//                     columnDefs={colDefs}
//                     gridOptions={gridOptions} 
//                     defaultColDef={{ 
//                         editable: false,
//                         cellRenderer: SmartCellRenderer,
//                     }}
//                     pagination={true}
//                     paginationPageSize={100}
//                     paginationPageSizeSelector={[50, 100, 200]}
//                     cellSelection={true}
//                     enableCellTextSelection={true}
//                     ensureDomOrder={true}
//                     // autoSizeStrategy={{
//                     //   type: 'fitGridWidth'
//                     // }}
//                   />
//                 </div>
//               )}
//             </CardContent>
//           </Card>

//           <footer className="flex justify-end pt-4 gap-2 border-t">
//             <Button variant="outline" onClick={onBack} disabled={isSaving}>
//               Back
//             </Button>
//             <Button onClick={handleSave} disabled={isSaving || isLoading}>
//             {isSaving ? 'Saving...' : (isEditing ? 'Update Dataset' : 'Save Dataset')}
//         </Button>
//           </footer>
//         </div>
//     );
// };

// export default Step4Preview;



import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { NodeDetails } from '@/types/dataset';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import DatasetStepLoading from '@/components/common/datasets/DatasetStepLoading';
import { getDataPreview } from '@/controllers/API/datasetApi';
import { toast } from 'sonner';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridOptions, themeQuartz } from 'ag-grid-community';
import SmartCellRenderer from '@/components/core/cellRenderer';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

// FIX: Cleaned up and corrected props interface
interface Step4PreviewProps {
  nodeDetails: NodeDetails;
  configurationData: Record<string, any>;
  propertiesData: any[];
  onBack: () => void;
  enableAnalytical: boolean;
  onEnableAnalyticalChange: (enabled: boolean) => void;
  onContinue: () => void | Promise<void>;
  isSaving?: boolean;
  isEditing?: boolean;
  isVirtualEditMode?: boolean;
}

const agTheme = themeQuartz
  .withParams({ backgroundColor: '#FAFAFA', foregroundColor: '#361008CC', browserColorScheme: 'light' }, 'light-red')
  .withParams({ backgroundColor: '#141516', foregroundColor: '#FFFFFFCC', browserColorScheme: 'dark' }, 'dark-red');

const Step4Preview = ({
  nodeDetails,
  configurationData,
  propertiesData,
  onBack,
  enableAnalytical,
  onEnableAnalyticalChange,
  onContinue,
  isSaving = false,
  isEditing = false,
  isVirtualEditMode = false,
}: Step4PreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [colDefs, setColDefs] = useState<ColDef[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const { theme } = useTheme();
  const location = useLocation();
  const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);

  useEffect(() => {
    const mode = theme === "dark" || theme === "blue-dark-g" ? "dark-red" : "light-red";
    document.body.setAttribute('data-ag-theme-mode', mode);
    return () => { document.body.removeAttribute('data-ag-theme-mode'); }
  }, [theme]);

  const gridOptions: GridOptions = { theme: agTheme };

  // Height calculations (mirrors Analytics dialog logic)
  const ROW_HEIGHT = 30;

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true);
      try {
        const payload = JSON.parse(JSON.stringify(nodeDetails.node.payload));
        Object.keys(payload).forEach(key => {
          const placeholder = payload[key];
          if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {
            const dataKey = placeholder.replace(/{{|}}/g, '');
            payload[key] = configurationData[dataKey] ?? '';
          } else {
            payload[key] = payload[key];
          }
        });
        payload.name = configurationData.datasetName;

        // Add additional fields from configurationData (input, output, rollback fields)
        // These are created in Step2ConfigurationFiles for file datasets
        const additionalFields = [
          'output_fields',
          'local_input_fields',
          'remote_input_fields',
          'rollback_output_fields',
          'rollback_input_fields',
          'input_local',
          'input_remote'
        ];

        additionalFields.forEach(field => {
          if (configurationData[field] !== undefined) {
            payload[field] = configurationData[field];
          }
        });

        // Filter only selected properties
        const selectedProperties = propertiesData.filter(p => p.isSelected !== false);

        // Add the properties array inside the payload object
        if (selectedProperties.length > 0) {
          payload.properties = selectedProperties;
        }

        if (!selectedProperties.length) {
          toast.info("No columns to preview.");
          setColDefs([]); setRowData([]); setIsLoading(false);
          return;
        }

        console.log('[Step4Preview] Preview payload:', { payload });

        const { module, klass } = nodeDetails.node.get_data;
        const data = await getDataPreview(module, klass, payload);
        const gridColumns = (data.columns || []).map((column: string) => ({ field: column, headerName: column, filter: true }));
        setColDefs(gridColumns);
        setRowData(data.data || []);
      } catch (error) {
        toast.error("Could not load data preview.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreview();
  }, [nodeDetails, configurationData, propertiesData]);

  const getContinueLabel = () => {
    if (isSaving) return 'Saving...';
    if (enableAnalytical) return 'Next: Semantic Mapping';
    if (isVirtualDb) return isVirtualEditMode ? 'Update Data' : 'Add to Table';
    return isEditing ? 'Update Dataset' : 'Save Dataset';
  };

  const handleContinue = async () => {
    await onContinue();
  };

  const fitPreviewGridColumns = (api: GridApi<any>) => {
    try {
      if (!api) return;
      const allCols = api.getColumns?.();
      if (!allCols || allCols.length === 0) return;
      api.sizeColumnsToFit();
    } catch (e) {
      // ignore
    }
  };

  // When on virtual DB routes, use a fixed viewport slice; otherwise fill available step height.
  const gridHeightStyle: CSSProperties = isVirtualDb
    ? { height: 'calc(55vh - 120px)', maxHeight: '55vh' }
    : { height: '100%', minHeight: 0 };

  return (
    <div className={cn(
      'flex min-h-0 flex-1 flex-col overflow-hidden p-2 gap-2',
      isVirtualDb ? 'h-[55vh]' : 'h-full',
    )}>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 gap-0">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
          {isLoading ? (
            <DatasetStepLoading message="Loading preview..." className="min-h-0 flex-1 w-full" />
          ) : (
            <div
              className={cn(
                'ag-theme-quartz min-h-0 flex-1 w-full',
                theme === 'dark' || theme === 'blue-dark-g' ? 'ag-theme-quartz-dark' : '',
              )}
              style={gridHeightStyle}
            >
              <AgGridReact
                rowData={rowData}
                rowHeight={ROW_HEIGHT}
                headerHeight={ROW_HEIGHT}
                theme={agTheme}
                columnDefs={colDefs}
                gridOptions={gridOptions}
                defaultColDef={{ cellRenderer: SmartCellRenderer, resizable: true, sortable: true, filter: true,minWidth: 140 }}
                pagination={true}
                paginationPageSize={100}
                paginationPageSizeSelector={[50, 100, 200]}
                onGridReady={(params) => fitPreviewGridColumns(params.api)}
                onFirstDataRendered={(params) => fitPreviewGridColumns(params.api)}
                onGridSizeChanged={(params) => fitPreviewGridColumns(params.api)}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-background pt-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={enableAnalytical}
            onCheckedChange={(checked) => onEnableAnalyticalChange(checked === true)}
            disabled={isLoading || isSaving}
          />
          <span className="text-sm font-medium">Analytical dataset</span>
          <span className="text-xs text-muted-foreground">Configure semantic mapping</span>
        </label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isLoading || isSaving} size="sm">
            Back
          </Button>
          <Button
            variant="default"
            onClick={handleContinue}
            disabled={isLoading || isSaving}
            size="sm"
          >
            {getContinueLabel()}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Step4Preview;
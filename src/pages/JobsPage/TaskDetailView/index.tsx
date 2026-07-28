import React, { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronsRight, FileText, Loader2, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { FlowJob } from '@/types/jobs';
import { TaskCardView } from '../TaskCardView';
import { FlowDetailPanel } from '../FlowDetailPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { useTheme } from '@/context/theme';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ReportingResultsTable from '@/components/common/reporting-results-table';
import BottomSheetSetting from '@/components/common/bottomSheetSetting';
import api from '@/controllers/API/api';
import { downloadStoredDocument } from '@/controllers/API/dataCollectorAPI';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { executeApiRequestSilent, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useNavigate } from 'react-router-dom';


ModuleRegistry.registerModules([AllCommunityModule]);

interface TaskDetailViewProps {
  flow: FlowJob;
  onBack: () => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ flow, onBack }) => {
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportFilePaths, setReportFilePaths] = useState<string[]>([]);
  const [isLoadingReportPaths, setIsLoadingReportPaths] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [taskCreatedAt, setTaskCreatedAt] = useState<string | null>(null);
  const { theme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0); 
  const navigate = useNavigate();

  const agTheme = themeQuartz
    .withParams(
      {
        backgroundColor: '#FAFAFA',
        foregroundColor: '#361008CC',
        browserColorScheme: 'light',
      },
      'light-red'
    )
    .withParams(
      {
        backgroundColor: '#141516',
        foregroundColor: '#FFFFFFCC',
        browserColorScheme: 'dark',
      },
      'dark-red'
    );

  const fetchReportData = async () => {
    setIsLoadingReport(true);
    try {
      const result = await executeApiRequestSilent<{ data?: unknown }>(
        () => api.post('/jobs/get-output', { flow_id: flow.flow_id }),
        'Failed to fetch report data',
      );

      if (result?.data) {
        setReportData(result);
        setIsReportDrawerOpen(true);
        toast.success('Report data loaded successfully');
      } else {
        toast.error('No data available for this flow');
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch report data'));
    } finally {
      setIsLoadingReport(false);
    }
  };
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1); 
  };

  // Fetch task details to get created_at
  const fetchTaskDetails = async () => {
    try {
      const response = await executeApiRequestSilent<{ data?: { created_at?: string }[] }>(
        () =>
          api.get('/task-details', {
            params: {
              q: `flow_run_id='${flow.flow_run_id.replace(/'/g, "''")}'`,
              skip: 0,
              limit: 1,
            },
          }),
        'Failed to fetch task details',
      );

      if (response.data && response.data.length > 0) {
        const firstTask = response.data[0];
        if (firstTask.created_at) {
          setTaskCreatedAt(firstTask.created_at);
          return firstTask.created_at;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching task details:', error);
      return null;
    }
  };

  // Fetch report file paths - same pattern as data collector
  const fetchReportPaths = async () => {
    setIsLoadingReportPaths(true);
    try {
      // First, fetch task details to get created_at if not already fetched
      let createdAt = taskCreatedAt;
      if (!createdAt) {
        createdAt = await fetchTaskDetails();
      }

      const payload: any = {
        flow_id: flow.flow_id
      };

      // Add created_at to payload if available
      if (createdAt) {
        payload.created_at = createdAt;
      }

      const result = await executeApiRequestSilent<{
        status?: boolean;
        data?: { data?: string[] };
      }>(
        () => api.post('/jobs/get-report-paths', payload),
        'Failed to fetch report file paths',
      );

      if (result?.status && result.data?.data && Array.isArray(result.data.data)) {
        const filePaths = result.data.data.filter((path: string) => path && typeof path === 'string');
        if (filePaths.length > 0) {
          setReportFilePaths(filePaths);
          toast.success(`Found ${filePaths.length} report file(s)`);
        } else {
          setReportFilePaths([]);
          toast.info('No report files available');
        }
      } else {
        setReportFilePaths([]);
        toast.info('No report files available');
      }
    } catch (error) {
      console.error('Error fetching report paths:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch report file paths'));
      setReportFilePaths([]);
    } finally {
      setIsLoadingReportPaths(false);
    }
  };

  // Handle file download
  const handleDownloadFile = async (path: string) => {
    const fileName = path.split('/').pop() || path;
    setDownloadingFile(path);
    const toastId = toast.loading(`Downloading ${fileName}...`);

    try {
      await downloadStoredDocument(path);
      toast.success(`Download for ${fileName} started successfully.`, { id: toastId });
    } catch (error) {
      const errorMessage = getDisplayErrorMessage(error, "An unknown error occurred.");
      toast.error(`Failed to download ${fileName}.`, {
        id: toastId,
        description: errorMessage,
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  // Helper function to extract filename from path
  const getFileName = (path: string) => path.split('/').pop() || path;
  const capitalizeFirst = (str?: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full min-w-0 gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Go back to flows">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Flows</span>
              <ChevronsRight className="h-4 w-4 text-muted-foreground" />
              <span className='text-sm'>{flow.flow_run_name}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Flow: {capitalizeFirst(flow.flow_name)}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {/* <Button
          variant="outline"
          size="icon"
          className='flex-shrink-0 !p-2 !h-7'
          onClick={() => navigate(`/jobs/prefectrun/${flow.flow_run_id}`)}
        >
          <span>Prefect Run</span>
        </Button> */}
        <Button
          variant="outline"
          size="icon"
          className='flex-shrink-0 !p-2 !h-7'
          onClick={handleRefresh}
        >
          <RefreshCw />
          <span>Refresh</span>
        </Button>
        {/* <Button 
          variant="outline"
          onClick={fetchReportData} 
          disabled={isLoadingReport}
          className="flex items-center gap-2 !h-7"
        >
          {isLoadingReport ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Report
        </Button> */}
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 flex-1 rounded-lg border bg-card"
      >
        <ResizablePanel defaultSize={70} minSize={35} className="min-w-0">
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-2">
            <TaskCardView
              key={flow.flow_run_id}
              flowRunId={flow.flow_run_id}
              flowName={flow.flow_name}
              deploymentName={flow.deployment_name}
              refreshkey={refreshKey}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={25} className="min-w-0">
          <FlowDetailPanel flow={flow} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Report Drawer */}
      <Sheet  open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen}>
        <SheetContent side="right" className="w-[90vw] sm:w-[85vw] md:w-[80vw] lg:w-[75vw] xl:w-[70vw] max-w-[90vw] rounded-l-3xl gap-0" style={{ width: '90vw', maxWidth: '90vw' }}>
          <SheetHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Flow Report - {flow.flow_run_name}
                </SheetTitle>
                <SheetDescription>
                  Output data for flow: {flow.flow_name}
                </SheetDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReportPaths}
                disabled={isLoadingReportPaths}
                className="flex items-center gap-2"
              >
                {isLoadingReportPaths ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isLoadingReportPaths ? 'Loading...' : 'Download Files'}
              </Button>
            </div>
          </SheetHeader>
          
          <div className="h-[calc(100vh-120px)] gap-2 overflow-auto">
            {/* Report Files Download Section */}
            {reportFilePaths.length > 0 && (
              <Card className="p-0 gap-0">
                <CardHeader className="p-0">
                  <CardTitle className="flex items-center gap-1 p-0 text-base">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Report Files Available
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-1 space-y-2">
                  <div className="p-3 bg-muted rounded-md border space-y-2">
                    <p className="text-sm font-semibold">Generated files are listed below.</p>
                    <ul className="space-y-2">
                      {reportFilePaths.map((path, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-mono truncate" title={path}>{getFileName(path)}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDownloadFile(path)}
                            disabled={downloadingFile === path}
                          >
                            {downloadingFile === path ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            {downloadingFile === path ? 'Downloading...' : 'Download'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoadingReport ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Loading report data...</p>
                </div>
              </div>
            ) : reportData && reportData.data ? (
              (() => {
                const outputData = reportData.data;
                const outputKeys = Object.keys(outputData);
                
                // Helper function to check if data has NWay validation structure
                const hasNWayStructure = (data: any) => {
                  return data?.data && Array.isArray(data.data) &&
                    data.data.some((pair: any) => 
                      pair?.records && Array.isArray(pair.records) &&
                      pair.records.some((record: any) => 
                        Object.keys(record).some(key => key.endsWith('_DATA'))
                      )
                    );
                };
                
                // Helper function to check if data has rule-based structure
                const hasRuleBasedStructure = (data: any) => {
                  return data?.data && Array.isArray(data.data) &&
                    data.data.length > 0 &&
                    Array.isArray(data.data[0]) &&
                    data.data[0].length > 0 &&
                    typeof data.data[0][0] === 'object' &&
                    !Object.keys(data.data[0][0]).some(key => key.endsWith('_DATA'));
                };
                
                if (outputKeys.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <p className="text-lg font-medium">No reporting data available</p>
                        <p className="text-sm mt-2">Execute the reporting node to see results</p>
                      </div>
                    </div>
                  );
                }
                
                // If only one output, show it directly without tabs
                if (outputKeys.length === 1) {
                  const key = outputKeys[0];
                  const data = outputData[key];
                  
                  if (hasNWayStructure(data)) {
                    return <ReportingResultsTable apiResponse={{ 
                      status: true, 
                      message: 'Success', 
                      data: { [key]: data } 
                    }} />;
                  } else if (hasRuleBasedStructure(data)) {
                    // Extract and flatten data from rule-based structure
                    const flattenedData: any[] = [];
                    const columns = new Set<string>();
                    
                    data.data.forEach((recordArray: any[]) => {
                      if (Array.isArray(recordArray) && recordArray.length > 0) {
                        recordArray.forEach((record: any) => {
                          if (typeof record === 'object' && record !== null) {
                            flattenedData.push(record);
                            Object.keys(record).forEach(key => columns.add(key));
                          }
                        });
                      }
                    });
                    
                    const agColDefs = Array.from(columns).map(column => ({
                      field: column,
                      headerName: column,
                      sortable: true,
                      filter: true,
                      resizable: true,
                    }));
                    
                    return (
                      <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full">
                        <AgGridReact
                          theme={agTheme}
                          rowData={flattenedData}
                          columnDefs={agColDefs}
                          pagination={true}
                          paginationPageSize={20}
                        />
                      </div>
                    );
                  } else {
                    // Fallback to default AG Grid for simple data
                    return (
                      <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full">
                        <AgGridReact
                          theme={agTheme}
                          rowData={Array.isArray(data) ? data : [data]}
                          columnDefs={data && typeof data === 'object' ? Object.keys(data).map(key => ({
                            field: key,
                            headerName: key,
                            sortable: true,
                            filter: true,
                            resizable: true,
                          })) : []}
                          pagination={true}
                        />
                      </div>
                    );
                  }
                }
                
                // Multiple outputs - show tabs
                return (
                  <Tabs defaultValue={outputKeys[0]} className="w-full h-full">
                    <div className="flex items-center justify-between">
                      <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground border border-border">
                        {outputKeys.map((key) => (
                          <TabsTrigger 
                            key={key} 
                            value={key} 
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-blue-500"
                          >
                            {key}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      <BottomSheetSetting />
                    </div>

                    {outputKeys.map((key) => {
                      const data = outputData[key];
                      
                      return (
                        <TabsContent key={key} value={key} className="w-full overflow-auto min-h-[100px] p-2">
                          {hasNWayStructure(data) ? (
                            <ReportingResultsTable apiResponse={{ 
                              status: true, 
                              message: 'Success', 
                              data: { [key]: data } 
                            }} />
                          ) : hasRuleBasedStructure(data) ? (
                            // Show AG Grid for rule-based validation data
                            (() => {
                              const flattenedData: any[] = [];
                              const columns = new Set<string>();
                              
                              data.data.forEach((recordArray: any[]) => {
                                if (Array.isArray(recordArray) && recordArray.length > 0) {
                                  recordArray.forEach((record: any) => {
                                    if (typeof record === 'object' && record !== null) {
                                      flattenedData.push(record);
                                      Object.keys(record).forEach(col => columns.add(col));
                                    }
                                  });
                                }
                              });
                              
                              const agColDefs = Array.from(columns).map(column => ({
                                field: column,
                                headerName: column,
                                sortable: true,
                                filter: true,
                                resizable: true,
                              }));
                              
                              return (
                                <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full">
                                  <AgGridReact
                                    theme={agTheme}
                                    rowData={flattenedData}
                                    columnDefs={agColDefs}
                                    pagination={true}
                                    paginationPageSize={20}
                                  />
                                </div>
                              );
                            })()
                          ) : (
                            // Fallback to default AG Grid
                            <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full">
                              <AgGridReact
                                theme={agTheme}
                                rowData={Array.isArray(data) ? data : [data]}
                                columnDefs={data && typeof data === 'object' ? Object.keys(data).map(key => ({
                                  field: key,
                                  headerName: key,
                                  sortable: true,
                                  filter: true,
                                  resizable: true,
                                })) : []}
                                pagination={true}
                              />
                            </div>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                );
              })()
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No report data available</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click the Report button to fetch data for this flow
                  </p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

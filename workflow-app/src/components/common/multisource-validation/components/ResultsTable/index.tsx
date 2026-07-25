import React, { useMemo, useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage, resolveApiErrorMessage } from '@/utils/exceptionHelper';
import axios from 'axios';

interface ValidationResult {
  unique_id: string;
  source: string;
  target: string;
  key: Record<string, any>;
  field: string;
  description: string;
  source_value: number;
  target_value: number;
  match_score: number;
  difference: number;
  reason: string;
  remarks: string;
  [key: string]: any; // Allow for additional dynamic fields
}

interface MultiSourceValidationResponse {
  status?: boolean;
  message?: string;
  results?: ValidationResult[];
  [key: string]: any;
}

interface ResultsTableProps {
  apiResponse?: MultiSourceValidationResponse;
  flowId?: string;
  currentNodeId?: string;
  uniqueId?: string;
}

export function ResultsTable({ apiResponse, flowId, currentNodeId, uniqueId }: ResultsTableProps) {
  // Debug logging to understand the structure
  console.log('🔍 ResultsTable received apiResponse:', {
    hasApiResponse: !!apiResponse,
    hasDataResults: !!apiResponse?.data?.results,
    hasResults: !!apiResponse?.results,
    dataResultsLength: apiResponse?.data?.results?.length,
    resultsLength: apiResponse?.results?.length,
    apiResponseKeys: apiResponse ? Object.keys(apiResponse) : [],
    apiResponseDataKeys: apiResponse?.data ? Object.keys(apiResponse.data) : [],
  });

  // Handle both apiResponse.results and apiResponse.data.results structures
  const results = apiResponse?.data?.results || apiResponse?.results || [];

  console.log('📊 Final results array:', {
    resultsLength: results.length,
    firstResult: results[0],
  });

  const [selectedRecord, setSelectedRecord] = useState<ValidationResult | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [aggregationData, setAggregationData] = useState<any>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Dynamically extract all unique keys from the results, excluding unique_id
  const columns = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    const allKeys = new Set<string>();
    results.forEach(result => {
      Object.keys(result).forEach(key => {
        // Exclude unique_id from columns
        if (key !== 'unique_id') {
          allKeys.add(key);
        }
      });
    });
    
    return Array.from(allKeys);
  }, [results]);

  const handleViewDetails = (record: ValidationResult) => {
    setSelectedRecord(record);
    setActiveSourceIndex(0); // Reset to first source button
  };

  const handleBackToResults = () => {
    setSelectedRecord(null);
    setAggregationData(null);
    setActiveSourceIndex(0);
  };

  // Fetch aggregation data when a record is selected
  useEffect(() => {
    const fetchAggregationData = async () => {
      if (!selectedRecord) return;

      setIsLoadingDetails(true);
      setAggregationData(null);

      try {
        const payload = {
          flow_id: flowId,
          node_id: currentNodeId,
        unique_id:apiResponse.unique_id, 
        };

        const response = await axios.post('/api/transformations/get-msv-agg-data', payload);
        
        if (response.data) {
          setAggregationData(response.data);
        }
      } catch (error) {
        console.error('Error fetching aggregation data:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to fetch aggregation details'));
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchAggregationData();
  }, [selectedRecord, flowId, currentNodeId]);

  // Format cell value based on type
  const formatCellValue = (value: any, columnName: string) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }
    
    if (typeof value === 'object') {
      return (
        <div className="text-xs font-mono bg-muted p-1 rounded">
          {JSON.stringify(value, null, 2)}
        </div>
      );
    }
    
    if (columnName === 'remarks') {
      return (
        <Badge
        className={
          value === "FAIL"
            ? "bg-red-500 text-white"
            : value === "PASS"
            ? "bg-green-500 text-white"
            : "bg-gray-200 text-gray-800"
        }
      >
        {value}
      </Badge>
      
      );
    }
    
    if (columnName === 'match_score') {
      const score = typeof value === 'number' ? value : parseFloat(value);
      const percentage = (score * 100).toFixed(2);
      const color = score >= 1.0 ? 'text-green-600' : score >= 0.5 ? 'text-yellow-600' : 'text-red-600';
      return <span className={`font-semibold ${color}`}>{percentage}%</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="font-mono">{value}</span>;
    }
    
    return String(value);
  };

  // Format column header
  const formatColumnHeader = (column: string) => {
    return column
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Download Excel by calling API and saving binary response
  const handleDownloadExcel = async () => {
    if (!flowId || !currentNodeId) {
      toast.error('Missing flow_id or node_id');
      return;
    }

    setIsDownloading(true);
    try {
      // Collect all unique_ids from results
      const uniqueIds = results.map(result => result.unique_id).filter(Boolean);
      
      // if (uniqueIds.length === 0) {
      //   toast.error('No unique IDs found in results');
      //   setIsDownloading(false);
      //   return;
      // }

      // Prepare payload (API expects identifiers from current run)
      const payload = {
        flow_id: flowId,
        node_id: currentNodeId,
        unique_id: apiResponse?.unique_id ,
      };

      // Request binary (xlsx is a ZIP starting with PK)
      const response = await axios.post(
        '/api/transformations/generate-multisource-report',
        payload,
        { responseType: 'blob' }
      );

      // Determine filename from header if available
      const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
      let suggestedName = 'multisource_validation_report.xlsx';
      if (contentDisposition) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
        const extracted = decodeURIComponent(match?.[1] || match?.[2] || '');
        if (extracted) suggestedName = extracted;
      }

      // Create object URL and trigger download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      try {
        // Attempt to parse potential JSON error from blob
        // @ts-ignore - error typing from axios
        const blob = error?.response?.data as Blob | undefined;
        if (blob && blob.type?.includes('application/json')) {
          const text = await blob.text();
          const json = JSON.parse(text);
          toast.error(resolveApiErrorMessage(json, 'Failed to download report'));
        } else {
          toast.error(getDisplayErrorMessage(error, 'Failed to download report'));
        }
      } catch {
        toast.error(getDisplayErrorMessage(error, 'Failed to download report'));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (!results || results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No validation results available. Execute the node to see results.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show detail view when a record is selected
  if (selectedRecord) {
    return (
      <div className="w-full space-y-4">
        {/* Back Button */}
        <div className="mb-2">
          <Button variant="outline" onClick={handleBackToResults}>
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Button>
        </div>

        {/* Aggregation Data */}
        <Card className='p-2 gap-0'>
            <CardTitle className='p-2'>Aggregation Data</CardTitle>
          <CardContent className='p-2'>
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading aggregation data...</span>
              </div>
            ) : aggregationData?.data && Array.isArray(aggregationData.data) && aggregationData.data.length > 0 ? (
              <div className="w-full">
                {/* Source Selector Buttons */}
                <div className="inline-flex gap-2 mb-4">
                  {aggregationData.data.map((sourceData: any, index: number) => (
                    <Button
                      key={index}
                      variant={activeSourceIndex === index ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveSourceIndex(index)}
                    >
                      {sourceData.source || `Source ${index + 1}`}
                    </Button>
                  ))}
                </div>
                
                {/* Display Active Source Data */}
                {aggregationData.data[activeSourceIndex] && (() => {
                  const sourceData = aggregationData.data[activeSourceIndex];
                  return (
                    <div className="mt-1">
                      {/* Display Aggregation Summary */}
                      {sourceData.agg && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                          <p className="text-sm font-semibold mb-2">Aggregation Summary:</p>
                          <div className="flex gap-4 flex-wrap">
                            {Object.entries(sourceData.agg).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-sm">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display Data Tables */}
                      {sourceData.data && typeof sourceData.data === 'object' && (
                        <div className="space-y-4">
                          {Object.entries(sourceData.data).map(([dataKey, dataRecords]: [string, any]) => {
                            if (!Array.isArray(dataRecords) || dataRecords.length === 0) return null;

                            // Extract column headers dynamically from the first record
                            const columns = Object.keys(dataRecords[0]).filter(col => 
                              col !== 'unique_id' && col !== 'record_status'
                            );

                            return (
                              <div key={dataKey} className="border rounded-md overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b">
                                  <h4 className="text-sm font-semibold">
                                    {dataKey}
                                    <Badge variant="outline" className="ml-2">
                                      {dataRecords.length} {dataRecords.length === 1 ? 'Record' : 'Records'}
                                    </Badge>
                                  </h4>
                                </div>
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                  <Table>
                                    <TableHeader className="sticky top-0 bg-gray-200 dark:bg-gray-700 z-10">
                                      <TableRow>
                                        {columns.map((col) => (
                                          <TableHead key={col} className="whitespace-nowrap font-semibold text-xs">
                                            {col.replace(/_/g, ' ').toUpperCase()}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {dataRecords.map((record: any, recordIndex: number) => (
                                        <TableRow key={recordIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                          {columns.map((col) => (
                                            <TableCell key={col} className="whitespace-nowrap text-xs">
                                              {record[col] === null || record[col] === undefined ? (
                                                <span className="text-muted-foreground italic">null</span>
                                              ) : typeof record[col] === 'boolean' ? (
                                                <Badge variant={record[col] ? 'default' : 'secondary'}>
                                                  {String(record[col])}
                                                </Badge>
                                              ) : typeof record[col] === 'object' ? (
                                                <span className="text-xs font-mono">{JSON.stringify(record[col])}</span>
                                              ) : (
                                                String(record[col])
                                              )}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No aggregation data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results table
  return (
    <Card className="w-full p-2 gap-0">
        <CardTitle className='p-2 flex items-center justify-between'>
          <div className="flex items-center gap-2">
            <span>Validation Results</span>
            <Badge variant="outline">
              {results.length} {results.length === 1 ? 'Result' : 'Results'}
            </Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Excel
              </>
            )}
          </Button>
        </CardTitle>
      <CardContent className='p-1'>
        <div className="rounded-md border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-200 z-10">
              <TableRow>
                <TableHead className="w-16 font-semibold">Actions</TableHead>
                {columns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap font-semibold">
                    {formatColumnHeader(column)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, rowIndex) => (
                <TableRow key={result.unique_id || rowIndex}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleViewDetails(result)}
                    >
                      <Eye size={16} />
                    </Button>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={`${result.unique_id || rowIndex}-${column}`} className="whitespace-nowrap">
                      {formatCellValue(result[column], column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
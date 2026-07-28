import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Eye, ArrowLeft, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Type for child validation record (same as NWay validation)
interface ChildValidationRecord {
  validationNumber?: string;
  cycle: string;
  overallResult: 'Pass' | 'Fail';
  dataset: string;
  table: string;
  tableKey: string;
  results: Array<{
    field: string;
    actualValue: any;
    expectedValue: any;
    result: 'Pass' | 'Fail';
  }>;
}

interface ReportingApiResponse {
  status: boolean;
  message: string;
  data: {
    [nodeName: string]: {
      data: Array<{
        pair1: string;
        records: Array<{
          // [childKey: string]: any;
          [dataKey: string]: {
            validation_result: string;
            matched_columns: string[];
            unmatched_columns: string[];
            remarks: string;
            [key: string]: any;
          };
        }>;
      }>;
    };
  };
}

interface ReportingResultsTableProps {
  apiResponse: ReportingApiResponse;
}

// Result Badge Component (same as NWay validation)
const ResultBadge: React.FC<{ result: 'Pass' | 'Fail' }> = ({ result }) => {
  const isPass = result === 'Pass';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        isPass ? 'text-green-600' : 'text-red-600'
      )}
    >
      {isPass ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>{result}</span>
    </div>
  );
};

// Validation Detail Card Component (same as NWay validation)
const ValidationDetailCard: React.FC<{ report: any }> = ({ report }) => {
  const {
    validationNumber,
    cycle,
    overallResult,
    dataset,
    table,
    tableKey,
    results,
  } = report;

  const passedCount = React.useMemo(() => results.filter((r: any) => r.result === 'Pass').length, [results]);
  const failedCount = React.useMemo(() => results.filter((r: any) => r.result === 'Fail').length, [results]);

  const columns = useMemo(() => {
    if (!results || results.length === 0) return [];
    const allKeys = new Set<string>();
    results.forEach((result: any) => {
      Object.keys(result).forEach((key) => allKeys.add(key));
    });

    const preferredOrder = ['field', 'actualValue', 'expectedValue', 'result'];
    const dynamicColumns = Array.from(allKeys);

    dynamicColumns.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return dynamicColumns;
  }, [results]);

  const formatHeader = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <div className="space-y-4">
      <div className="shadow-sm p-2 border rounded-lg">
        <div className="flex flex-row items-start justify-between p-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Order Validation
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Validation Number: {validationNumber || 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              Cycle: {cycle}
            </Badge>
            <Badge
              className={cn(
                'text-xs px-2 py-0.5 border',
                overallResult === 'Pass'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              )}
            >
              Result: {overallResult}
            </Badge>
          </div>
        </div>
      </div>

      <div className="shadow-sm p-2 border rounded-lg">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-slate-700">
          <div>
            <span className="font-medium text-slate-500">Dataset:</span> {dataset}
          </div>
          <div>
            <span className="font-medium text-slate-500">Table:</span> {table}
          </div>
          <div>
            <span className="font-medium text-slate-500">Table Key:</span> {tableKey}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge className="border-green-500 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold px-2.5 py-1">
          <CheckCircle2 size={14} className="mr-1.5" />
          {passedCount} Passed
        </Badge>
        <Badge className="border-red-500 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold px-2.5 py-1">
          <XCircle size={14} className="mr-1.5" />
          {failedCount} Failed
        </Badge>
      </div>

      <div className="shadow-sm overflow-hidden p-2 border rounded-lg">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="font-semibold text-slate-600">
                  {formatHeader(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item: any, index: number) => (
              <TableRow key={index} className="text-sm">
                {columns.map((columnKey) => (
                  <TableCell
                    key={columnKey}
                    className={cn(columnKey === 'field' && 'font-medium text-slate-800')}
                  >
                    {(() => {
                      const value = item[columnKey];
                      if (columnKey === 'result') {
                        return <ResultBadge result={value as 'Pass' | 'Fail'} />;
                      }
                      return <span className="text-slate-600">{String(value ?? '-')}</span>;
                    })()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};


const ReportingResultsTable: React.FC<ReportingResultsTableProps> = ({ apiResponse }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'PASS' | 'FAIL'>('all');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Process the data similar to NWay validation
  const processedData = useMemo(() => {
    if (!apiResponse?.data) return [];

    const allRecords: any[] = [];
    
    // Use the same logic as NWay validation to process data
    Object.values(apiResponse.data).forEach((nodeData: any) => {
      if (nodeData.data && Array.isArray(nodeData.data)) {
        nodeData.data.forEach((pair: any) => {
          if (pair.records && Array.isArray(pair.records)) {
            pair.records.forEach((record: any) => {
              // Same logic as NWay validation - extract _DATA objects
              Object.keys(record).forEach((key) => {
                if (key.endsWith('_DATA') && typeof record[key] === 'object' && record[key] !== null) {
                  const dataObject = record[key];
                  
                  // Find corresponding _CHILD_VALIDATION data
                  const childValidationKey = key.replace('_DATA', '_CHILD_VALIDATION');
                  const childValidationData = record[childValidationKey];
                  
                  // Store the original record like NWay validation does
                  allRecords.push({
                    ...dataObject,
                    _originalRecord: record, // This is key - store original record for _CHILD_VALIDATION access
                    pairInfo: pair.pair1,
                    recordKey: key
                  });
                }
              });
            });
          }
        });
      }
    });

    return allRecords;
  }, [apiResponse]);

  // Filter records based on status
  const filteredRecords = useMemo(() => {
    if (filterStatus === 'all') return processedData;
    
    return processedData.filter(record => {
      const result = record.validation_result || record.Validation_Result;
      if (filterStatus === 'PASS') {
        return result === 'PASS' || result === 'Pass';
      } else if (filterStatus === 'FAIL') {
        return result === 'FAIL' || result === 'Fail' || result === 'FAILED' || result === 'Failed';
      }
      return true;
    });
  }, [processedData, filterStatus]);

  // Get unique columns dynamically from the first record - maintain backend order
  const availableColumns = useMemo(() => {
    if (processedData.length === 0) return [];
    
    const firstRecord = processedData[0];
    const columns = Object.keys(firstRecord);
    
    // Filter out only system columns, keep matched_columns and unmatched_columns
    const systemColumns = ['pairInfo', 'recordKey'];
    const dataColumns = columns.filter(col => !systemColumns.includes(col));
    
    // Return columns in the exact order they appear in the backend response
    return dataColumns;
  }, [processedData]);

  // Count statistics
  const totalCount = processedData.length;
  const passedCount = processedData.filter(record => {
    const result = record.validation_result || record.Validation_Result;
    return result === 'PASS' || result === 'Pass';
  }).length;
  const failedCount = totalCount - passedCount;

  const handleFilterClick = (status: 'all' | 'PASS' | 'FAIL') => {
    setFilterStatus(status === filterStatus ? 'all' : status);
  };

  const handleViewDetails = (record: any) => {
    setSelectedRecord(record);
  };

  const handleDownload = () => {
    if (!filteredRecords.length) {
      return;
    }

    const headers = availableColumns.map((col) => col.replace(/_/g, ' ').toUpperCase()).join(',');
    const rows = filteredRecords.map((record) => {
      return availableColumns
        .map((col) => {
          const value = record[col];
          if (Array.isArray(value)) {
            return `"${value.join(', ')}"`;
          }
          return `"${value ?? '-'}"`;
        })
        .join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporting_Results_${filterStatus}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const truncateText = (text: string, maxLength: number = 6) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderColumnValue = (value: any) => {
    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-12 overflow-hidden cursor-help">
                <span className="truncate block">
                  {value.length > 0 ? truncateText(String(value[0])) : 'N/A'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="z-50 max-w-sm p-3 bg-white border border-gray-300 shadow-xl"
              sideOffset={5}
            >
              <div className="text-sm">
                {value.join(', ')}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Handle objects
    if (value && typeof value === 'object') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-12 overflow-hidden cursor-help">
                <span className="truncate block">
                  [Object]
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="z-50 max-w-sm p-3 bg-white border border-gray-300 shadow-xl"
              sideOffset={5}
            >
              <div className="text-sm">
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Handle strings
    if (typeof value === 'string' && value.length > 10) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-12 overflow-hidden cursor-help">
                <span className="truncate block">
                  {truncateText(value)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="z-50 max-w-sm p-3 bg-white border border-gray-300 shadow-xl"
              sideOffset={5}
            >
              <div className="text-sm">
                {value}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Handle other types (numbers, booleans, null, undefined)
    return <span>{String(value || '-')}</span>;
  };

  if (!apiResponse || processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No validation data available</p>
          <p className="text-sm mt-2">Connect NWay validation nodes to see reporting results</p>
        </div>
      </div>
    );
  }

  // Show detail view if a record is selected (same logic as NWay validation)
  if (selectedRecord) {
    const originalRecord = selectedRecord._originalRecord;
    const validationEntries = Object.entries(originalRecord).filter(
      ([key, value]) => key.endsWith('_CHILD_VALIDATION') && Array.isArray(value)
    );

    return (
      <div className="w-full space-y-4 p-2">
        <div className="mb-4">
          <Button
            onClick={() => setSelectedRecord(null)}
            variant="default"
            className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm rounded-lg !h-8 px-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Table
          </Button>
        </div>
        <div className="space-y-6">
          {validationEntries.length > 0 ? (
            validationEntries.flatMap(([key, reports]) =>
              (reports as ChildValidationRecord[]).map((report, index) => (
                <ValidationDetailCard key={`${key}-${index}`} report={report} />
              ))
            )
          ) : (
            <div className="w-full p-0 border rounded-lg">
              <div className="p-6 text-center text-gray-500">
                No validation details found for this record.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Statistics and Filters */}
      <div className="flex flex-col gap-4">
        {/* Pair Name */}
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800">
            {processedData.length > 0 && processedData[0].pairInfo ? processedData[0].pairInfo : 'Reporting Results'}
          </h3>
        </div>
        
        {/* Centered Badges with Download */}
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge 
              variant="outline" 
              className={`cursor-pointer ${filterStatus === 'all' ? 'bg-blue-100 border-blue-300' : ''}`}
              onClick={() => handleFilterClick('all')}
            >
              Total Records: {totalCount}
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer bg-green-100 text-green-800 border-green-300 ${filterStatus === 'PASS' ? 'bg-green-200' : ''}`}
              onClick={() => handleFilterClick('PASS')}
            >
              Passed: {passedCount}
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer bg-red-100 text-red-800 border-red-300 ${filterStatus === 'FAIL' ? 'bg-red-200' : ''}`}
              onClick={() => handleFilterClick('FAIL')}
            >
              Failed: {failedCount}
            </Badge>
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="rounded-full bg-green-700 text-white border border-green-900 hover:bg-green-700 hover:text-white hover:border hover:border-green-900 px-3 py-1 text-sm flex items-center gap-1 !h-7"
            >
              <Download className="mr-2 h-4 w-4 text-white" />
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 border-b">
              <TableRow className="border-b">
                <TableHead className="w-20 font-semibold">Actions</TableHead>
                {availableColumns.map((column) => (
                  <TableHead 
                    key={column} 
                    className={`font-semibold ${
                      (column === 'matched_columns' || column === 'unmatched_columns') ? "w-12" : "min-w-[120px]"
                    }`}
                  >
                    {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record, index) => {
                const validationResult = record.validation_result || record.Validation_Result;
                const isPassed = validationResult === 'PASS' || validationResult === 'Pass';
                
                return (
                  <TableRow 
                    key={index}
                    className={`${!isPassed ? 'bg-red-50' : ''}`}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleViewDetails(record)}
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                    {availableColumns.map((column) => (
                      <TableCell key={column} className="text-sm">
                        {column === 'validation_result' || column === 'Validation_Result' ? (
                          <div className="flex items-center gap-2">
                            {isPassed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <Badge 
                              variant={isPassed ? "default" : "destructive"}
                              className={isPassed ? "bg-green-100 text-green-800" : ""}
                            >
                              {validationResult || 'N/A'}
                            </Badge>
                          </div>
                        ) : column === 'matched_columns' || column === 'unmatched_columns' ? (
                          <div className="w-40 overflow-hidden">
                            {Array.isArray(record[column]) && record[column].length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help whitespace-nowrap overflow-hidden">
                                      {record[column].length > 1 
                                        ? `${record[column][0].substring(0, 20)}...` 
                                        : record[column][0]?.substring(0,20) || ''
                                      }
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-5xl bg-white border border-gray-200 shadow-lg">
                                    <div className="text-sm">
                                      <div className="font-bold mb-2 text-gray-800">
                                        {column === 'matched_columns' ? 'Matched Columns:' : 'Unmatched Columns:'}
                                      </div>
                                      <div className="text-gray-700 leading-relaxed">
                                        {record[column].join(', ')}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        ) : column === 'remarks' || column === 'Remarks' ? (
                          <div className="w-40 overflow-hidden">
                            {record[column] && String(record[column]).length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help whitespace-nowrap overflow-hidden">
                                      {String(record[column]).substring(0, 20)}...
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-5xl bg-white border border-gray-200 shadow-lg">
                                    <div className="text-sm">
                                      <div className="font-bold mb-2 text-gray-800">Remarks:</div>
                                      <div className="text-gray-700 leading-relaxed">
                                        {String(record[column])}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        ) : (
                          renderColumnValue(record[column])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ReportingResultsTable;

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NWayValidationResponse, PairwiseRecord, ChildValidationRecord } from './types';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isPass = status === 'PASS' || status === 'Pass';
  return (
    <Badge
      variant={isPass ? 'secondary' : 'destructive'}
      className={cn(
        'flex items-center gap-1',
        isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      )}
    >
      {isPass ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {status}
    </Badge>
  );
};

const MatchStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isMatched = status === 'MATCHED';
  return (
    <Badge
      variant={isMatched ? 'default' : 'destructive'}
      className={cn(
        isMatched
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800'
          : 'bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800'
      )}
    >
      {status}
    </Badge>
  );
};

interface ProcessedRecord {
  id: number;
  [key: string]: any;
  _originalRecord: PairwiseRecord;
}

interface PairDataGridProps {
  pairValue: string;
  records: ProcessedRecord[];
  columns: string[];
  onViewDetails: (record: ProcessedRecord) => void;
}

const PairDataGrid: React.FC<PairDataGridProps> = ({
  pairValue,
  records,
  columns,
  onViewDetails,
}) => {
  const passedCount = records.filter((r) => 
    r.validation_result === 'PASS' || r.validation_result === 'Pass'
  ).length;
  const failedCount = records.length - passedCount;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl font-bold">{pairValue}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Total: {records.length}
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Passed: {passedCount}
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700">
              Failed: {failedCount}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Actions</TableHead>
                {columns.map((column) => (
                  <TableHead 
                    key={column} 
                    className={cn(
                      "font-semibold",
                      (column === 'matched_columns' || column === 'unmatched_columns') && "w-12"
                    )}
                  >
                    {column.replace(/_/g, ' ').toUpperCase()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow
                  key={index}
                  className={cn(
                    'hover:bg-gray-50',
                    (record.validation_result === 'FAIL' || record.validation_result === 'Fail' || 
                     record.validation_result === 'FAILED' || record.validation_result === 'Failed') ? 'bg-red-50' : ''
                  )}
                >
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => onViewDetails(record)}
                    >
                      <Eye size={16} />
                    </Button>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className="text-sm">
                      {column === 'validation_result' ? (
                        <StatusBadge status={String(record[column])} />
                      ) : column === 'MATCHING_STATUS' ? (
                        <MatchStatusBadge status={String(record[column] || 'N/A')} />
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
                      ) : (
                        <span className="font-mono">{String(record[column] ?? '-')}</span>
                      )}
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
};

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

const ValidationDetailCard: React.FC<{ report: ChildValidationRecord }> = ({ report }) => {
  const {
    validationNumber,
    cycle,
    overallResult,
    dataset,
    table,
    tableKey,
    results,
  } = report;

  const passedCount = React.useMemo(() => results.filter((r) => r.result === 'Pass').length, [results]);
  const failedCount = React.useMemo(() => results.filter((r) => r.result === 'Fail').length, [results]);

  const columns = useMemo(() => {
    if (!results || results.length === 0) return [];
    const allKeys = new Set<string>();
    results.forEach((result) => {
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
      <Card className="shadow-sm p-2">
        <CardHeader className="flex flex-row items-start justify-between p-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">
              Order Validation
            </CardTitle>
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
        </CardHeader>
      </Card>

      <Card className="shadow-sm p-2">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-slate-700">
          <div>
            <span className="font-medium text-slate-500">Dataset:</span> {dataset}
          </div>
          <div>
            <span className="font-medium text-slate-500">Table:</span> {table}
          </div>
          <div>
            <span className="font-medium text-slate-500">Table Key:</span> {tableKey}
          </div>
        </CardContent>
      </Card>

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

      <Card className="shadow-sm overflow-hidden p-2">
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
            {results.map((item, index) => (
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
      </Card>
    </div>
  );
};

interface NWayValidationTableProps {
  apiResponse?: NWayValidationResponse;
}

const NWayValidationTable: React.FC<NWayValidationTableProps> = ({ apiResponse }) => {
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'PASS' | 'FAIL' | 'TOTAL'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ProcessedRecord | null>(null);

  const pairwiseResults = apiResponse?.pairwise_results || apiResponse?.data?.pairwise_results;

  const currentPairResult = useMemo(() => {
    if (!pairwiseResults || pairwiseResults.length === 0) return null;
    return pairwiseResults[currentPairIndex];
  }, [pairwiseResults, currentPairIndex]);

  const {
    processedRecords,
    columns,
    pairValue,
    totalRecordsInCurrentPair,
    passedInCurrentPair,
    failedInCurrentPair,
  } = useMemo(() => {
    if (!currentPairResult) {
      return {
        processedRecords: [],
        columns: [],
        pairValue: 'Unknown',
        totalRecordsInCurrentPair: 0,
        passedInCurrentPair: 0,
        failedInCurrentPair: 0,
      };
    }

    const pairKey = Object.keys(currentPairResult).find((key) => key.startsWith('pair'));
    const pairValue = pairKey ? currentPairResult[pairKey] || 'Unknown' : 'Unknown';

    const records: ProcessedRecord[] = currentPairResult.records.map((record: any, index: number) => {
      const mainData: any = { id: index };

      Object.entries(record).forEach(([key, value]) => {
        if (key.endsWith('_DATA') && typeof value === 'object' && value !== null) {
          Object.assign(mainData, value);
        } else if (!key.includes('_CHILD')) {
            mainData[key] = value;
        }
      });

      return { ...mainData, _originalRecord: record };
    });

    // Extract columns dynamically from the _DATA object
    let cols: string[] = [];
    
    if (records.length > 0) {
      // Get the first record to determine column order
      const firstRecord = records[0];
      
      // Find the _DATA key from the original record
      const dataKey = Object.keys(currentPairResult.records[0]).find(key => key.endsWith('_DATA'));
      
      if (dataKey && currentPairResult.records[0][dataKey]) {
        // Get columns in the same order as they appear in the _DATA object
        const dataObject = currentPairResult.records[0][dataKey];
        cols = Object.keys(dataObject);
        
        // Add validation_result and remarks at the beginning if they exist
        const priorityColumns = ['Validation_Result', 'Remarks'];
        const otherColumns = cols.filter(col => !priorityColumns.includes(col));
        cols = [...priorityColumns.filter(col => dataObject.hasOwnProperty(col)), ...otherColumns];
      } else {
        // Fallback: get all keys from processed records
        const allKeys = new Set<string>();
        records.forEach((record) => {
          Object.keys(record).forEach((key) => {
            if (key !== 'id' && key !== '_originalRecord' && !key.includes('_CHILD')) {
              allKeys.add(key);
            }
          });
        });
        cols = Array.from(allKeys);
      }
    }

    const total = records.length;
    const passed = records.filter((r) => 
      r.validation_result === 'PASS' || r.validation_result === 'Pass'
    ).length;

    return {
      processedRecords: records,
      columns: cols,
      pairValue,
      totalRecordsInCurrentPair: total,
      passedInCurrentPair: passed,
      failedInCurrentPair: total - passed,
    };
  }, [currentPairResult]);

  const filteredRecords = useMemo(() => {
    if (filterStatus === 'all' || filterStatus === 'TOTAL') return processedRecords;
    
    if (filterStatus === 'PASS') {
      return processedRecords.filter((record) => 
        record.validation_result === 'PASS' || record.validation_result === 'Pass'
      );
    }
    
    if (filterStatus === 'FAIL') {
      return processedRecords.filter((record) => 
        record.validation_result === 'FAIL' || record.validation_result === 'Fail' || 
        record.validation_result === 'FAILED' || record.validation_result === 'Failed'
      );
    }
    
    return processedRecords;
  }, [processedRecords, filterStatus]);

  const handlePrevious = () => {
    setFilterStatus('all');
    setSelectedRecord(null);
    setCurrentPairIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setFilterStatus('all');
    setSelectedRecord(null);
    setCurrentPairIndex((prev) => Math.min(pairwiseResults?.length - 1 || 0, prev + 1));
  };

  const handleFilterClick = (status: 'PASS' | 'FAIL' | 'TOTAL') => {
    setFilterStatus((prev) => (prev === status ? 'all' : status));
  };

  const handleDownload = () => {
    if (!filteredRecords.length) {
      return;
    }

    const headers = columns.map((col) => col.replace(/_/g, ' ').toUpperCase()).join(',');
    const rows = filteredRecords.map((record) => {
      return columns
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
    link.download = `Validation_Results_${pairValue.replace(/ /g, '_')}_${filterStatus}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

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
            <Card className="w-full p-0 ">
              <CardContent className="p-6 text-center text-gray-500">
                No validation details found for this record.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (!pairwiseResults || pairwiseResults.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="w-full max-w-md p-0">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-gray-500 text-lg mb-2">No validation data available</div>
            <div className="text-gray-400 text-sm">Execute the node to see results</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-2">
      <div className="sticky top-0 z-10 bg-background pb-2 pt-2">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex-1 flex justify-start">
            {/* Spacer */}
          </div>

          <div className="flex flex-wrap gap-3 justify-center items-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 px-3 py-1 border-blue-200">
              Pair {currentPairIndex + 1} of {pairwiseResults.length}
            </Badge>
            <Badge
              variant="outline"
              onClick={() => handleFilterClick('TOTAL')}
              className={cn(
                'bg-blue-50 text-blue-700 px-3 py-1 cursor-pointer transition-all hover:bg-blue-100 border-blue-200',
                filterStatus === 'TOTAL' && 'ring-2 ring-blue-400'
              )}
            >
              Total Records: {totalRecordsInCurrentPair}
            </Badge>
            <Badge
              variant="outline"
              onClick={() => handleFilterClick('PASS')}
              className={cn(
                'bg-green-50 text-green-700 px-3 py-1 cursor-pointer transition-all hover:bg-green-100 border-green-200',
                filterStatus === 'PASS' && 'ring-2 ring-green-400'
              )}
            >
              Passed: {passedInCurrentPair}
            </Badge>
            <Badge
              variant="outline"
              onClick={() => handleFilterClick('FAIL')}
              className={cn(
                'bg-red-50 text-red-700 px-3 py-1 cursor-pointer transition-all hover:bg-red-100 border-red-200',
                filterStatus === 'FAIL' && 'ring-2 ring-red-400'
              )}
            >
              Failed: {failedInCurrentPair}
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

          <div className="flex-1 flex justify-end items-center gap-2">
            {currentPairIndex > 0 && (
              <Button
                onClick={handlePrevious}
                className="rounded-full bg-black text-white px-3 text-sm flex items-center gap-1 !h-8 shadow-sm"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            )}
            {currentPairIndex < pairwiseResults.length - 1 && (
              <Button
                onClick={handleNext}
                className="rounded-full bg-black text-white px-3 text-sm flex items-center gap-1 !h-8 shadow-sm"
              >
                Next
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {filteredRecords && (
        <PairDataGrid
          records={filteredRecords}
          columns={columns}
          pairValue={pairValue}
          onViewDetails={setSelectedRecord}
        />
      )}
    </div>
  );
};

export default NWayValidationTable;

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, ChevronRight, ChevronLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ValidationSummary {
  VALIDATION_COLS: string | null;
  Matched: number;
  UnMatched: number;
  "Missing Records": number;
}

interface ValidationData {
  [key: string]: any;
}

interface ValidationResultsDisplayProps {
  validationResponse: {
    status: boolean;
    message: string;
    data: {
      [validationKey: string]: {
        data: ValidationData[];
        summary: ValidationSummary[];
      };
    };
    unique_id: string;
  };
}

const ValidationResultsDisplay: React.FC<ValidationResultsDisplayProps> = ({ validationResponse }) => {
  // Get all validation keys
  const validationKeys = Object.keys(validationResponse.data);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  
  // Get current validation set
  const currentValidationKey = validationKeys[currentSetIndex];
  const validationData = validationResponse.data[currentValidationKey];
  
  const summaryData = validationData?.summary || [];
  const tableData = validationData?.data || [];
  
  // Navigation functions
  const goToNext = () => {
    if (currentSetIndex < validationKeys.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    }
  };
  
  const goToPrevious = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1);
    }
  };
  
  // Check if navigation is available
  const canGoNext = currentSetIndex < validationKeys.length - 1;
  const canGoPrevious = currentSetIndex > 0;

  // Generate dynamic columns from all data rows, excluding unique_id
  const columns = React.useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    
    const allKeys = new Set<string>();
    tableData.forEach(result => {
      Object.keys(result).forEach(key => {
        // Exclude unique_id from columns
        if (key !== 'unique_id') {
          allKeys.add(key);
        }
      });
    });
    
    return Array.from(allKeys);
  }, [tableData]);

  // Format cell value based on type (same as ResultsTable)
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

  // Format column header (same as ResultsTable)
  const formatColumnHeader = (column: string) => {
    return column
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Download table as Excel (same as ResultsTable)
  const handleDownloadExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = tableData.map(result => {
        const row: any = {};
        columns.forEach(column => {
          const value = result[column];
          // Handle different value types for Excel
          if (value === null || value === undefined) {
            row[formatColumnHeader(column)] = '';
          } else if (typeof value === 'object') {
            row[formatColumnHeader(column)] = JSON.stringify(value);
          } else {
            row[formatColumnHeader(column)] = value;
          }
        });
        return row;
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Validation Results');
      
      // Generate file name with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `validation_results_${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, fileName);
      
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{currentValidationKey}</h3>
            {/* <p className="text-sm text-slate- 600">Set: {currentValidationKey}</p> */}
          </div>
          {validationKeys.length > 1 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {currentSetIndex + 1} of {validationKeys.length}
            </Badge>
          )}
        </div>
        {validationKeys.length > 1 && (
          <div className="flex items-center gap-2">
            {canGoPrevious && (
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                className="!h-8 gap-2 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
            )}
            {canGoNext && (
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                className="!h-8 gap-2 hover:bg-slate-100"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {summaryData.map((summary, index) => (
          <Card key={index} className="border border-slate-200 p-1 gap-0">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2 p-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                {summary.VALIDATION_COLS || "Missing"}
              </CardTitle>
            <CardContent className="p-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Matched:</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    {summary.Matched}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Unmatched:</span>
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    {summary.UnMatched}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Missing Records:</span>
                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                    {summary["Missing Records"]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dynamic Data Table - Same design as ResultsTable */}
      {tableData.length > 0 ? (
        <Card className="w-full p-2 gap-0">
          <CardTitle className='p-0 flex items-center justify-between'>
            <div className="flex items-center gap-2">
              <h4>Validation Results</h4>
              <Badge variant="outline">
                {tableData.length} {tableData.length === 1 ? 'Result' : 'Results'}
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {currentValidationKey}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
           
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadExcel}
                className="gap-2 !h-8"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </Button>
            </div>
          </CardTitle>
          <CardContent className='p-1'>
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-200 z-10">
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column} className="whitespace-nowrap font-semibold">
                        {formatColumnHeader(column)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((result, rowIndex) => (
                    <TableRow key={result.unique_id || rowIndex}>
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
      ) : (
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
      )}
    </div>
  );
};

export default ValidationResultsDisplay;

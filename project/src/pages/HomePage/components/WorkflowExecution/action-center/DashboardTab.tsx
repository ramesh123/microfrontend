"use client";
import { useState, useRef, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useTheme } from '@/context/theme';
import { ColDef } from 'ag-grid-community';
import * as XLSX from 'xlsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import SvarDataGridWithCheckboxes from '@/components/common/SvarDataGridWithCheckboxes';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DashboardTabProps {
  workflowId?: string;
  selectedWorkflow?: any;
}

// CSV Parser function - optimized for large files (handles quoted values with commas)
const parseCSV = (csvText: string): { data: any[]; columns: string[] } => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { data: [], columns: [] };

  // Parse CSV line with proper handling of quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    // Add last value
    values.push(currentValue.trim());
    return values;
  };

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  
  // Parse data rows
  const data: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return { data, columns: headers };
};

// Excel Parser function - handles .xlsx and .xls files
const parseExcel = async (file: File): Promise<{ data: any[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        if (!fileData) {
          reject(new Error('Failed to read file'));
          return;
        }

        // Read workbook
        const workbook = XLSX.read(fileData, { type: 'binary' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '' // Default value for empty cells
        });
        
        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        // First row is headers
        const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim()).filter(h => h);
        
        if (headers.length === 0) {
          reject(new Error('No headers found in Excel file'));
          return;
        }

        // Convert rows to objects
        const parsedData: any[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          const rowObj: any = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] !== undefined && row[index] !== null ? String(row[index]) : '';
          });
          parsedData.push(rowObj);
        }

        resolve({ data: parsedData, columns: headers });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
};

export default function DashboardTab({ workflowId, selectedWorkflow }: DashboardTabProps) {
  const [gridData, setGridData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [svarColumns, setSvarColumns] = useState<any[]>([]);
  const [selectedGridType, setSelectedGridType] = useState<'ag-grid' | 'svar-grid'>('ag-grid');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const { theme } = useTheme();

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

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 100,
  }), []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isCSV = fileExtension === 'csv';
    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';

    if (!isCSV && !isExcel) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      let data: any[] = [];
      let columns: string[] = [];

      // Show progress for large files
      if (file.size > 5 * 1024 * 1024) { // > 5MB
        toast.info(`Parsing large ${isCSV ? 'CSV' : 'Excel'} file, please wait...`);
      }

      if (isCSV) {
        // Parse CSV
        const text = await file.text();
        const result = parseCSV(text);
        data = result.data;
        columns = result.columns;
      } else {
        // Parse Excel
        const result = await parseExcel(file);
        data = result.data;
        columns = result.columns;
      }

      if (data.length === 0) {
        toast.error(`${isCSV ? 'CSV' : 'Excel'} file is empty or invalid`);
        setIsLoading(false);
        return;
      }

      // Generate AG Grid column definitions
      const colDefs: ColDef[] = columns.map((col) => ({
        field: col,
        headerName: col,
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        minWidth: 150,
      }));

      // Generate SVAR Grid column definitions with sorting
      const svarCols = columns.map((col) => ({
        id: col,
        header: col,
        width: 150,
        filter: true,
        resizable: true,
        sort: true, // Enable sorting
      }));

      // Ensure each row has an id for SVAR Grid
      const dataWithIds = data.map((row, index) => {
        const rowId = row.id || row.SYSTEM_REF_ID || row.system_ref_id || row.PK || `row-${index}`;
        return {
          ...row,
          id: String(rowId),
        };
      });

      setColumnDefs(colDefs);
      setSvarColumns(svarCols);
      setGridData(dataWithIds);
      setCurrentPage(1);
      setSelectedRows([]);
      
      toast.success(`Successfully loaded ${data.length.toLocaleString()} records from ${file.name}`);
    } catch (error) {
      console.error(`Error parsing ${isCSV ? 'CSV' : 'Excel'}:`, error);
      toast.error(
        getDisplayErrorMessage(
          error,
          `Failed to parse ${isCSV ? 'CSV' : 'Excel'} file. Please check the file format.`,
        ),
      );
      setGridData([]);
      setColumnDefs([]);
      setFileName(null);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearData = () => {
    setGridData([]);
    setColumnDefs([]);
    setSvarColumns([]);
    setFileName(null);
    setCurrentPage(1);
    setSelectedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Data cleared');
  };

  const handleSelectionChange = (selected: any[]) => {
    setSelectedRows(selected);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b bg-gray-50 dark:bg-gray-800">
        <div className="flex-1 text-center font-semibold text-base">
          Dashboard Data
        </div>
        <div className="flex items-center gap-2">
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <span className="text-xs">({gridData.length.toLocaleString()} records)</span>
            </div>
          )}
          {gridData.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearData}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-4">
        {gridData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV or Excel File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a CSV or Excel file (.csv, .xlsx, .xls) with up to 2 lakh (200,000) records to display in the grid
            </p>
            
            {/* Grid Type Selection */}
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Select Grid Type:</Label>
              <RadioGroup
                value={selectedGridType}
                onValueChange={(value) => setSelectedGridType(value as 'ag-grid' | 'svar-grid')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ag-grid" id="ag-grid" />
                  <Label htmlFor="ag-grid" className="cursor-pointer">AG Grid</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="svar-grid" id="svar-grid" />
                  <Label htmlFor="svar-grid" className="cursor-pointer">SVAR Grid</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose File
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex flex-col h-full border border-gray-300 rounded overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload New File
                </Button>
                <span className="text-sm text-muted-foreground">
                  Total Records: {gridData.length.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Grid Type:</Label>
                <RadioGroup
                  value={selectedGridType}
                  onValueChange={(value) => setSelectedGridType(value as 'ag-grid' | 'svar-grid')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ag-grid" id="ag-grid-active" />
                    <Label htmlFor="ag-grid-active" className="cursor-pointer text-sm">AG Grid</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="svar-grid" id="svar-grid-active" />
                    <Label htmlFor="svar-grid-active" className="cursor-pointer text-sm">SVAR Grid</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedGridType === 'ag-grid' ? (
                <div className={`${agTheme} h-full w-full`}>
                  <AgGridReact
                    rowData={gridData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    animateRows={true}
                    pagination={true}
                    paginationPageSize={50}
                    paginationPageSizeSelector={[25, 50, 100, 200]}
                    enableRangeSelection={true}
                    rowSelection="multiple"
                    suppressRowClickSelection={true}
                    enableCellTextSelection={true}
                    headerHeight={40}
                    rowHeight={35}
                    domLayout="normal"
                    suppressScrollOnNewData={true}
                    cacheBlockSize={100}
                    maxBlocksInCache={10}
                  />
                </div>
              ) : (
                <div className="flex flex-col h-full p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading...</span>
                    </div>
                  ) : gridData.length > 0 && svarColumns.length > 0 ? (
                    <div className="flex flex-col h-full">
                      <SvarDataGridWithCheckboxes
                        data={gridData || []}
                        columns={svarColumns || []}
                        onSelectionChange={handleSelectionChange}
                        isLoading={isLoading}
                        pageSize={pageSize}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(size) => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data to display
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}


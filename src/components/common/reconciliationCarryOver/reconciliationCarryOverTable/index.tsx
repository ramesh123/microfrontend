import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { useAgGridTheme } from '@/hooks/useAgGridTheme';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ReconciliationCarryOverRecord {
  [key: string]: any;
}

interface ReconciliationCarryOverResponse {
  status: boolean;
  message: string;
  data: ReconciliationCarryOverRecord[] | { data: ReconciliationCarryOverRecord[] };
}

interface ReconciliationCarryOverTableProps {
  response: ReconciliationCarryOverResponse;
}

const ReconciliationCarryOverTable: React.FC<ReconciliationCarryOverTableProps> = ({ response }) => {
  const { agTheme } = useAgGridTheme();
  const gridRef = useRef<AgGridReact>(null);
  const [rowData, setRowData] = useState<ReconciliationCarryOverRecord[]>([]);
  const [colDefs, setColDefs] = useState<any[]>([]);

  const displayData = React.useMemo(() => {
    if (response && response.data) {
      return Array.isArray(response.data)
        ? response.data
        : typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)
        ? response.data.data
        : [];
    }
    return [];
  }, [response]);

  useEffect(() => {
    setRowData(displayData);

    if (displayData.length > 0) {
      const firstRecord = displayData[0];
      if (firstRecord && typeof firstRecord === 'object') {
        const columns = Object.keys(firstRecord).map(key => ({
          field: key,
          headerName: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          filter: true,
          // ✅ Removed floatingFilter
          sortable: true,
          resizable: true,
        }));
        setColDefs(columns);
      }
    } else {
      setColDefs([]);
    }
  }, [displayData]);

  if (!displayData || displayData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 border rounded-lg bg-muted/10">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Upstream Data Available</h3>
          <p className="text-sm text-muted-foreground">Please ensure the upstream node has been executed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
          <AgGridReact
            ref={gridRef}
            theme={agTheme}
            rowData={rowData || []}
            columnDefs={colDefs}
            pagination={true}
            paginationPageSize={20}
            enableCellTextSelection={true}
            suppressCellFocus={true}
            defaultColDef={{
              flex: 1,
              minWidth: 150,
            }}
          />
    </div>
  );
};

export default ReconciliationCarryOverTable;
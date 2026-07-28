import React, { useState, useEffect, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { viewMasterDataFileData } from "@/controllers/API/filesApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { toast } from "sonner";
import type { FileType } from "../types";
import { ModuleRegistry, AllCommunityModule, type ColDef } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

type ViewDataSheetContentProps = {
  file: FileType | null;
};

const ViewDataSheetContent: React.FC<ViewDataSheetContentProps> = ({ file }) => {
  const [rowData, setRowData] = useState<Record<string, unknown>[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setRowData([]);
      setColumnDefs([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fileName = file.file_name ?? file.display_name ?? "";
        const response = await viewMasterDataFileData({
          unique_id: file.unique_id.toString(),
          file_type: file.file_type ?? "",
          file_name: fileName,
          encrypted_file_key: file.encrypted_file_key ?? "",
          delimiter: file.delimiter ?? "",
          sheet_name: file.sheet_name,
        });

        if (response?.status && response.data && response.columns) {
          const { data, columns } = response;
          const newColumnDefs = columns.map((colName: string) => ({
            headerName: colName,
            field: colName,
            filter: 'agTextColumnFilter',
            sortable: true,
            resizable: true,
          }));
          setColumnDefs(newColumnDefs);
          setRowData(data as Record<string, unknown>[]);
        } else {
          throw new Error(response?.message || "Failed to fetch data");
        }
      } catch (err) {
        const errorMessage = getDisplayErrorMessage(err, "An unknown error occurred.");
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [file]);

  const defaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 150,
      resizable: true,
      sortable: true,
    }),
    [],
  );

  if (!file) {
    return <p className="text-muted-foreground p-4">No file selected.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="ag-theme-quartz flex-1 min-h-0 w-full px-4 pb-4" style={{ height: '100%', width: '100%' }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        pagination={true}
        paginationPageSizeSelector={[20, 100, 200, 500, 1000]}
        rowHeight={35}
        headerHeight={35}
        paginationPageSize={20}
      />
    </div>
  );
};

export default ViewDataSheetContent;

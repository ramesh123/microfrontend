import { useEffect, useMemo, useState } from "react";
import CustomTableData from "@/components/ui/CustomTableData";
import {
  buildWizardPreviewRows,
  buildWizardPreviewTableColumns,
  type WizardPreviewGridInput,
} from "./buildWizardPreviewGridData";

interface WizardChartPreviewGridProps extends WizardPreviewGridInput {}

export default function WizardChartPreviewGrid({
  chartData,
  rawResponse,
}: WizardChartPreviewGridProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(
    () => buildWizardPreviewRows({ chartData, rawResponse }),
    [chartData, rawResponse],
  );

  const columns = useMemo(
    () => buildWizardPreviewTableColumns(rows, rawResponse),
    [rawResponse, rows],
  );

  const tableRows = useMemo(
    () => rows.map((row, index) => ({ ...row, _wizardPreviewRowId: index })),
    [rows],
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [tableRows]);

  const slicedRows = useMemo(() => {
    const startIndex = currentPage * pageSize;
    return tableRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, tableRows]);

  const paginationConfig = useMemo(
    () => ({
      steps: [10, 20, 50, 100],
      currentPage,
      pageSize,
      totalRows: tableRows.length,
      onChange: ({ currentPage: nextPage, limit }: { currentPage: number; limit: number }) => {
        setCurrentPage(nextPage);
        setPageSize(limit);
      },
    }),
    [currentPage, pageSize, tableRows.length],
  );

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        No data available for this chart
      </div>
    );
  }

  return (
    <div className="wizard-chart-preview-table flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <style>{`
        .wizard-chart-preview-table .custom-table-data-scroll > table {
          width: auto;
          max-width: 100%;
        }
        .wizard-chart-preview-table .custom-table-data-scroll > table th,
        .wizard-chart-preview-table .custom-table-data-scroll > table td {
          text-align: left !important;
          padding-left: 0.5rem;
          padding-right: 0.75rem;
        }
        .wizard-chart-preview-table .custom-table-data-scroll > table th button {
          justify-content: flex-start;
        }
      `}</style>
      <CustomTableData
        data={slicedRows}
        columns={columns}
        rowKey="_wizardPreviewRowId"
        scrollAreaFillsParent
        HorizontalScroll
        wrapLongCells
        bodyCellClassName="min-h-7 py-1 text-xs"
        lastColumnHeaderPadding={false}
        emptyState={
          <div className="p-4 text-center text-xs text-muted-foreground">
            No data available for this chart
          </div>
        }
        pagination={paginationConfig}
      />
    </div>
  );
}

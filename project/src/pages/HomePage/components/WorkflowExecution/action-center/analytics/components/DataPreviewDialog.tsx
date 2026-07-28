import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { Download } from 'lucide-react';
import type { AnalyticsViewProps } from '../viewTypes';

ModuleRegistry.registerModules([AllCommunityModule]);

export function DataPreviewDialog({
  isDataPreviewOpen,
  handlePreviewOpenChange,
  dataPreviewDialogWidth,
  dataPreviewDialogHeight,
  previewChartInfo,
  previewColumnDefsState,
  previewColumnDefs,
  previewGridRowsState,
  previewGridRows,
  handleDownloadDataPreview,
  fitPreviewGridColumns,
}: AnalyticsViewProps) {
  return (
    <Sheet open={isDataPreviewOpen} onOpenChange={handlePreviewOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col px-4 py-3"
        style={{
          width: `min(98vw, ${dataPreviewDialogWidth}px)`,
          minWidth: '800px',
          maxWidth: '98vw',
        }}
      >
        <SheetHeader className="flex flex-row items-center gap-2 space-y-0 pr-7 p-0">
          <SheetTitle className="min-w-0 flex-1 truncate text-bold pr-2">
            Data Preview
            {previewChartInfo?.chart?.chart_name ? ` — ${previewChartInfo.chart.chart_name}` : ''}
          </SheetTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 shrink-0 gap-1.5 text-xs"
            disabled={
              (previewColumnDefsState?.length ?? previewColumnDefs.length) === 0 &&
              (previewGridRowsState ?? previewGridRows).length === 0
            }
            onClick={handleDownloadDataPreview}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </SheetHeader>
        <div className="flex-1 min-h-0 w-full">
          {(previewColumnDefsState && previewColumnDefsState.length === 0) ||
            (previewColumnDefs.length === 0 && previewGridRows.length === 0) ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
              No data available for this chart
            </div>
          ) : (
            <div className="h-full w-full dashboard-grid-container ag-theme-quartz bg-background text-foreground">
              <AgGridReact
                theme={themeQuartz}
                rowHeight={30}
                headerHeight={30}
                rowData={previewGridRowsState ?? previewGridRows}
                columnDefs={previewColumnDefsState ?? previewColumnDefs}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                onGridReady={(params) => fitPreviewGridColumns(params.api)}
                onFirstDataRendered={(params) => fitPreviewGridColumns(params.api)}
                onGridSizeChanged={(params) => fitPreviewGridColumns(params.api)}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

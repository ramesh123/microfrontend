import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { Download, Loader2 } from 'lucide-react';
import type { AnalyticsViewProps } from '../viewTypes';

export function DrillThroughDialog({
  isDrillThroughDialogOpen,
  setIsDrillThroughDialogOpen,
  setDrillThroughContext,
  drillThroughGridRows,
  setDrillThroughGridRows,
  drillThroughColumnDefs,
  setDrillThroughColumnDefs,
  drillThroughDialogWidth,
  drillThroughDialogHeight,
  drillThroughContext,
  isDrillThroughLoading,
  handleDownloadDrillThrough,
  fitDrillThroughGridColumns,
}: AnalyticsViewProps) {
  return (
    <Sheet
      open={isDrillThroughDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsDrillThroughDialogOpen(false);
          setDrillThroughContext(null);
          setDrillThroughGridRows([]);
          setDrillThroughColumnDefs([]);
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col p-6"
        style={{
          width: `min(98vw, ${drillThroughDialogWidth}px)`,
          minWidth: '720px',
          maxWidth: '98vw',
        }}
      >
        <SheetHeader className="flex flex-row items-center gap-2 space-y-0 pr-7 p-0">
          <SheetTitle className="min-w-0 flex-1 truncate font-bold pr-2">
            Drill Through
            {drillThroughContext ? ` — ${drillThroughContext.field}: ${String(drillThroughContext.value)}` : ''}
          </SheetTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 shrink-0 gap-1.5 text-xs"
            disabled={isDrillThroughLoading || drillThroughGridRows.length === 0}
            onClick={handleDownloadDrillThrough}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </SheetHeader>
        <div className="flex-1 min-h-0 w-full">
          {isDrillThroughLoading ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading...
            </div>
          ) : drillThroughColumnDefs.length === 0 && drillThroughGridRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No data returned for this slice
            </div>
          ) : (
            <div className="h-full w-full dashboard-grid-container ag-theme-quartz bg-background text-foreground">
              <AgGridReact
                theme={themeQuartz}
                rowHeight={30}
                headerHeight={30}
                rowData={drillThroughGridRows}
                columnDefs={drillThroughColumnDefs}
                defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 140 }}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                onGridReady={(params) => fitDrillThroughGridColumns(params.api)}
                onFirstDataRendered={(params) => fitDrillThroughGridColumns(params.api)}
                onGridSizeChanged={(params) => fitDrillThroughGridColumns(params.api)}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { Maximize2, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EvidenceBySource } from '@/controllers/API/runAssistantApi';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

ModuleRegistry.registerModules([AllCommunityModule]);

function statusTypeVariant(statusType?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const v = (statusType || '').toLowerCase();
  if (v === 'matched') return 'default';
  if (v === 'unmatched') return 'destructive';
  if (v === 'partial') return 'secondary';
  return 'outline';
}

function buildColumnDefs(rows: Array<Record<string, unknown>>): ColDef[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => ({
    field: key,
    headerName: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 140,
    width: 160,
  }));
}

type EvidenceSourceTableProps = {
  source: EvidenceBySource;
  compact?: boolean;
};

export function EvidenceSourceTable({ source, compact = false }: EvidenceSourceTableProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const agTheme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'ag-theme-quartz-dark'
      : 'ag-theme-quartz';

  const columnDefs = useMemo(() => buildColumnDefs(source.sample_rows ?? []), [source.sample_rows]);
  const gridHeight = compact ? 240 : 280;
  const dialogGridHeight = 500;

  return (
    <div className="rounded-lg border bg-background overflow-hidden w-full">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Table2 className="size-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold capitalize">{(source.source_name || '').replace(/_/g, ' ')}</span>
        <Badge variant={statusTypeVariant(source.status_type)} className="text-[10px] h-5 capitalize">
          {source.status_type || 'unknown'}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono truncate max-w-[35%]">
          {source.table_name || 'unknown'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setIsDialogOpen(true)}
          title="Maximize Table"
        >
          <Maximize2 className="!h-3.5 !w-3.5" />
        </Button>
      </div>

      <div className="px-3 py-1.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground border-b">
        <span>
          <strong className="text-foreground">{(source.total_rows ?? 0).toLocaleString()}</strong> total
        </span>
        <span>
          <strong className="text-foreground">{source.sample_row_count ?? 0}</strong> sample rows
        </span>
      </div>

      {source.sample_rows?.length ? (
        <div className="overflow-auto" style={{ maxHeight: gridHeight }}>
          <div className={cn('w-full min-w-[480px] text-foreground', agTheme)} style={{ height: gridHeight }}>
            <AgGridReact
              rowData={source.sample_rows}
              columnDefs={columnDefs}
              rowHeight={32}
              headerHeight={34}
              domLayout="normal"
              alwaysShowHorizontalScroll
              suppressHorizontalScroll={false}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true,
                minWidth: 120,
              }}
              suppressCellFocus
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground p-3">No sample rows available.</p>
      )}

      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="right" className="w-[95vw] max-w-[95vw] md:w-[90vw] md:max-w-[90vw] flex flex-col py-0 px-2 bg-background border">
          <SheetHeader className="pb-2 border-b shrink-0">
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <Table2 className="size-4 text-primary shrink-0" />
              <span className="capitalize">{(source.source_name || '').replace(/_/g, ' ')} ({source.status_type || 'unknown'})</span>
              <span className="text-xs font-mono text-muted-foreground font-normal font-sans">({source.table_name || 'unknown'})</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Showing {source.sample_row_count ?? 0} sample rows of {(source.total_rows ?? 0).toLocaleString()} total rows.
            </SheetDescription>
          </SheetHeader>

          {source.sample_rows?.length ? (
            <div className="flex-grow min-h-0 mt-3">
              <div className={cn('w-full text-foreground', agTheme)} style={{ height: 'calc(100vh - 160px)' }}>
                <AgGridReact
                  rowData={source.sample_rows}
                  columnDefs={columnDefs}
                  rowHeight={32}
                  headerHeight={34}
                  domLayout="normal"
                  alwaysShowHorizontalScroll
                  suppressHorizontalScroll={false}
                  defaultColDef={{
                    resizable: true,
                    sortable: true,
                    filter: true,
                    minWidth: 120,
                  }}
                  suppressCellFocus
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground p-3">No sample rows available.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AnswerEvidenceTables({
  sources,
}: {
  sources: EvidenceBySource[];
}) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-3 w-full">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Evidence by source
      </p>
      <div className="space-y-3 w-full overflow-x-auto">
        {sources.map((source) => (
          <EvidenceSourceTable
            key={`${source.source_name}-${source.status_type}-${source.table_name}`}
            source={source}
            compact
          />
        ))}
      </div>
    </div>
  );
}

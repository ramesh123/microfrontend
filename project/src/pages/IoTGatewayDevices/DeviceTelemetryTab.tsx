import { Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";

import { type AttributeRow, DEVICE_DETAIL_DANGER_ICON_BTN, DEVICE_DETAIL_TOOLBAR_ICON_BTN, TablePager } from "./DeviceDetailTabShared";

type DeviceTelemetryTabProps = {
  searchOpen: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleSearch: () => void;
  rows: AttributeRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  emptyState: string;
  onOpenDialog: () => void;
  onRemoveKey?: (key: string) => void;
};

function formatTelemetryLastUpdate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export function DeviceTelemetryTab({
  searchOpen,
  search,
  onSearchChange,
  onToggleSearch,
  rows,
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyState,
  onOpenDialog,
  onRemoveKey,
}: DeviceTelemetryTabProps) {
  return (
    <TabsContent value="telemetry" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <CardTitle className="text-sm font-semibold">Latest telemetry</CardTitle>
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onOpenDialog}
                title="Add telemetry"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onToggleSearch}
                title="Search telemetry"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          {searchOpen ? (
            <div className="border-t border-border/60 px-3 py-1.5">
              <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search telemetry" className="h-9" />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={false} onCheckedChange={() => undefined} aria-label="Select all telemetry rows" />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Last update time</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  {onRemoveKey ? <TableHead className="w-12 text-right"></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={onRemoveKey ? 5 : 4} className="h-40 text-center text-sm text-muted-foreground">
                      {emptyState}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.key}-${row.lastUpdate}`}>
                      <TableCell>
                        <Checkbox checked={false} onCheckedChange={() => undefined} aria-label={`Select ${row.key}`} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTelemetryLastUpdate(row.lastUpdate)}
                      </TableCell>
                      <TableCell className="font-medium">{row.key}</TableCell>
                      <TableCell className="max-w-[34rem] break-all">{row.value}</TableCell>
                      {onRemoveKey ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={DEVICE_DETAIL_DANGER_ICON_BTN}
                            onClick={() => onRemoveKey(row.key)}
                            title={`Remove ${row.key}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePager
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

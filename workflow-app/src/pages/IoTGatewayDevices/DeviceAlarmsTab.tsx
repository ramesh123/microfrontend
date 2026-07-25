import { Loader2, MoreHorizontal, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TablePager, DEVICE_DETAIL_TOOLBAR_ICON_BTN, DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM } from "./DeviceDetailTabShared";

type AlarmRowView = {
  id: string;
  createdAt: string;
  originator: string;
  type: string;
  severity: string;
  assignee: string;
  status: string;
  raw: unknown;
};

type DeviceAlarmsTabProps = {
  loading: boolean;
  rows: AlarmRowView[];
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onOpenDetails: (row: unknown) => void;
};

export function DeviceAlarmsTab({
  loading,
  rows,
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onOpenDetails,
}: DeviceAlarmsTabProps) {
  return (
    <TabsContent value="alarms" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="border-border/70 gap-0 p-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <CardTitle className="text-sm font-semibold">Alarms</CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
              onClick={onRefresh}
              disabled={loading}
              title="Refresh alarms"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
            <Table className="[&_th]:h-auto [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:leading-tight [&_td]:px-2 [&_td]:py-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead>Created time</TableHead>
                  <TableHead>Originator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[4rem] text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-sm text-muted-foreground">
                      Loading alarms...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-sm text-muted-foreground">
                      No alarms found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.createdAt}</TableCell>
                      <TableCell className="max-w-[18rem]">
                        <span className="line-clamp-2 text-sm text-primary">{row.originator}</span>
                      </TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "font-medium",
                            row.severity.toLowerCase() === "critical" && "text-destructive",
                            row.severity.toLowerCase() === "major" && "text-orange-600",
                            row.severity.toLowerCase() === "minor" && "text-amber-600",
                            row.severity.toLowerCase() === "warning" && "text-yellow-600",
                          )}
                        >
                          {row.severity}
                        </span>
                      </TableCell>
                      <TableCell>{row.assignee}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                          onClick={() => onOpenDetails(row.raw)}
                          title="Alarm details"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
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

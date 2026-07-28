import { Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";

import { TablePager, DEVICE_DETAIL_TOOLBAR_ICON_BTN } from "./DeviceDetailTabShared";

type AlarmRuleRowView = {
  id: string;
  createdAt: string;
  alarmType: string;
  severity: string;
  thresholds: string;
};

type DeviceAlarmRulesTabProps = {
  searchOpen: boolean;
  search: string;
  rows: AlarmRuleRowView[];
  totalItems: number;
  page: number;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onToggleSearch: () => void;
  onOpenDialog: () => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function DeviceAlarmRulesTab({
  searchOpen,
  search,
  rows,
  totalItems,
  page,
  pageSize,
  onSearchChange,
  onToggleSearch,
  onOpenDialog,
  onRefresh,
  onPageChange,
  onPageSizeChange,
}: DeviceAlarmRulesTabProps) {
  return (
    <TabsContent value="alarm-rules" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <CardTitle className="text-sm font-semibold">Alarm rules</CardTitle>
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onOpenDialog}
                title="Add alarm rule"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onRefresh}
                title="Refresh alarm rules"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onToggleSearch}
                title="Search alarm rules"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          {searchOpen ? (
            <div className="border-t border-border/60 px-3 py-1.5">
              <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search alarm rules" className="h-9" />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={false} onCheckedChange={() => undefined} aria-label="Select all alarm rules" />
                  </TableHead>
                  <TableHead>Created time</TableHead>
                  <TableHead>Alarm type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Thresholds</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                      No alarm rules found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox checked={false} onCheckedChange={() => undefined} aria-label={`Select ${row.alarmType}`} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.createdAt}</TableCell>
                      <TableCell className="font-medium">{row.alarmType}</TableCell>
                      <TableCell>{row.severity}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{row.thresholds}</TableCell>
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

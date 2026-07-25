import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { TablePager, DEVICE_DETAIL_TOOLBAR_ICON_BTN } from "./DeviceDetailTabShared";

type AuditRow = {
  id: string;
  createdAt: string;
  user: string;
  action: string;
  entity: string;
  status: string;
  details: string;
};

type DeviceAuditLogsTabProps = {
  loading: boolean;
  rows: AuditRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  /** Shown next to the title (e.g. DEVICE, DEVICE_PROFILE). */
  entityBadgeLabel?: string;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function DeviceAuditLogsTab({
  loading,
  rows,
  totalItems,
  page,
  pageSize,
  entityBadgeLabel = "DEVICE",
  onRefresh,
  onPageChange,
  onPageSizeChange,
}: DeviceAuditLogsTabProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) return true;
      return (
        row.user.toLowerCase().includes(query) ||
        row.action.toLowerCase().includes(query) ||
        row.entity.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        row.details.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  return (
    <TabsContent value="audit" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-semibold">Audit logs</CardTitle>
            <Button type="button" variant="outline" size="xs" className="h-7 px-2.5 text-xs">
              {entityBadgeLabel}
            </Button>
            <Button type="button" variant="outline" size="xs" className="h-7 px-2.5 text-xs">
              Last 1 day
            </Button>
          </div>

          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={() => {
                  setSearch("");
                  onRefresh();
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_TOOLBAR_ICON_BTN} onClick={() => setSearchOpen((open) => !open)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          {searchOpen ? (
            <div className="border-t border-border/60 px-3 py-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit logs" className="h-9" />
            </div>
          ) : null}

          <div className={cn("min-h-0 flex-1 overflow-auto", !searchOpen && "border-t border-border/60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Created time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                      {loading ? "Loading audit logs..." : "No audit logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.createdAt}</TableCell>
                      <TableCell className="min-w-[12rem]">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">{row.action}</div>
                          <div className="text-xs text-muted-foreground">{row.entity}</div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[12rem] text-sm">{row.user}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            row.status.toLowerCase().includes("success") && "text-emerald-600",
                            (row.status.toLowerCase().includes("fail") || row.status.toLowerCase().includes("error")) && "text-destructive",
                          )}
                        >
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[18rem] max-w-[28rem]">
                        <div className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{row.details}</div>
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

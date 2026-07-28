import { Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { type DeviceAttributeScope } from "@/controllers/API/devicesApi";

import { type AttributeRow, DEVICE_DETAIL_TOOLBAR_ICON_BTN, TablePager } from "./DeviceDetailTabShared";

type DeviceAttributesTabProps = {
  scopeLabel: string;
  attrScope: DeviceAttributeScope;
  onScopeChange: (value: DeviceAttributeScope) => void;
  attrLoading: boolean;
  attrSearchOpen: boolean;
  attrSearch: string;
  onAttrSearchChange: (value: string) => void;
  onToggleAttrSearch: () => void;
  rows: AttributeRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenAttributeDialog: (row?: AttributeRow) => void;
  onRefresh: () => void;
};

export function DeviceAttributesTab({
  scopeLabel,
  attrScope,
  onScopeChange,
  attrLoading,
  attrSearchOpen,
  attrSearch,
  onAttrSearchChange,
  onToggleAttrSearch,
  rows,
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenAttributeDialog,
  onRefresh,
}: DeviceAttributesTabProps) {
  return (
    <TabsContent value="attributes" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="overflow-hidden border-border/70 p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{scopeLabel}</CardTitle>
            <div className="flex flex-wrap items-end justify-end gap-2 md:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">Entity attributes scope</Label>
                <Select value={attrScope} onValueChange={(value) => onScopeChange(value as DeviceAttributeScope)}>
                  <SelectTrigger className="h-9 min-w-[12rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVER_SCOPE">Server attributes</SelectItem>
                    <SelectItem value="CLIENT_SCOPE">Client attributes</SelectItem>
                    <SelectItem value="SHARED_SCOPE">Shared attributes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                  onClick={() => onOpenAttributeDialog()}
                  title="Add attribute"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                  onClick={onRefresh}
                  disabled={attrLoading}
                  title="Refresh attributes"
                >
                  {attrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                  onClick={onToggleAttrSearch}
                  title="Search attributes"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          {attrSearchOpen ? (
            <div className="border-t border-border/60 px-3 py-2">
              <Input value={attrSearch} onChange={(e) => onAttrSearchChange(e.target.value)} placeholder="Search attributes" className="h-9" />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={false} onCheckedChange={() => undefined} aria-label="Select all attributes" />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Last update time</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-12 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                      {attrLoading ? "Loading attributes..." : "No attributes found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.key}-${row.lastUpdate}`}>
                      <TableCell>
                        <Checkbox checked={false} onCheckedChange={() => undefined} aria-label={`Select ${row.key}`} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {row.lastUpdate ? new Date(row.lastUpdate).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{row.key}</TableCell>
                      <TableCell className="max-w-[34rem] break-all">{row.value}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                          onClick={() => onOpenAttributeDialog(row)}
                          title={`Edit ${row.key}`}
                        >
                          <Pencil className="h-4 w-4" />
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

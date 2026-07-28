import { useMemo, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";

import {
  IOT_DEVICE_DIALOG_CLOSE,
  IOT_DEVICE_DIALOG_HEADER,
  TablePager,
  DEVICE_DETAIL_TOOLBAR_ICON_BTN,
} from "./DeviceDetailTabShared";

type RelationRow = {
  id: string;
  type: string;
  toEntityType: string;
  toEntityName: string;
  additionalInfo: string;
};

export function DeviceRelationsTab() {
  const [direction, setDirection] = useState("From");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [relationType, setRelationType] = useState("Contains");
  const [toEntityType, setToEntityType] = useState("Type*");
  const [additionalInfo, setAdditionalInfo] = useState("{\n\n}");
  const [rows, setRows] = useState<RelationRow[]>([]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) return true;
      return (
        row.type.toLowerCase().includes(query) ||
        row.toEntityType.toLowerCase().includes(query) ||
        row.toEntityName.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize],
  );

  const addRelation = () => {
    if (!relationType.trim() || !toEntityType.trim() || toEntityType === "Type*") return;
    setRows((current) => [
      {
        id: String(Date.now()),
        type: relationType,
        toEntityType,
        toEntityName: `Entity ${current.length + 1}`,
        additionalInfo,
      },
      ...current,
    ]);
    setDialogOpen(false);
  };

  return (
    <>
      <TabsContent value="relations" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
        <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
          <CardHeader className="gap-2 px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <CardTitle className="text-sm font-semibold">
                {direction === "From" ? "Outbound relations" : "Inbound relations"}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-xs text-muted-foreground">Direction</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger className="h-9 min-w-[7rem] rounded-none border-0 border-b border-input px-0 shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="From">From</SelectItem>
                    <SelectItem value="To">To</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CardAction>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_TOOLBAR_ICON_BTN} onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                  onClick={() => {
                    setSearch("");
                    setPage(0);
                  }}
                  title="Refresh list"
                >
                  <RefreshCw className="h-4 w-4" />
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
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search relations" className="h-9" />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox checked={false} onCheckedChange={() => undefined} aria-label="Select all relations" />
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>To entity type</TableHead>
                    <TableHead>To entity name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-sm text-muted-foreground">
                        No relations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Checkbox checked={false} onCheckedChange={() => undefined} aria-label={`Select ${row.type}`} />
                        </TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.toEntityType}</TableCell>
                        <TableCell>{row.toEntityName}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <TablePager
              page={page}
              pageSize={pageSize}
              totalItems={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90vh] gap-0 overflow-auto p-0 sm:max-w-md"
          closeButtonClassName={IOT_DEVICE_DIALOG_CLOSE}
        >
          <DialogHeader className={IOT_DEVICE_DIALOG_HEADER}>
            <DialogTitle className="text-base font-semibold leading-snug text-foreground">Add relation</DialogTitle>
            <DialogDescription className="text-sm leading-snug text-muted-foreground">
              Configure a new relation between this device and another entity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 bg-background p-3">
            <div className="space-y-1">
              <Label>Relation type</Label>
              <Input value={relationType} onChange={(e) => setRelationType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To entity</Label>
              <Select value={toEntityType} onValueChange={setToEntityType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Type*">Type*</SelectItem>
                  <SelectItem value="DEVICE">Device</SelectItem>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Additional info (JSON)</Label>
              <Textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className="min-h-[7rem] font-mono text-xs" />
            </div>
          </div>
          <DialogFooter className="border-t border-border bg-background px-3 py-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={addRelation}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

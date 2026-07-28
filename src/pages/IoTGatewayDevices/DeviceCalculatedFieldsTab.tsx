import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";

import { JsonBlock, ReadOnlyDetailsField, DEVICE_DETAIL_DANGER_ICON_BTN, DEVICE_DETAIL_TOOLBAR_ICON_BTN } from "./DeviceDetailTabShared";

type CalculatedFieldRowView = {
  id: string;
  name: string;
  type: string;
  outputKey: string;
  createdAt: string;
};

type CalculatedFieldDetailsView = {
  name: string;
  type: string;
  outputKey: string;
  arguments: string[];
  expression: string;
  payload: unknown;
} | null;

type DeviceCalculatedFieldsTabProps = {
  loading: boolean;
  rows: CalculatedFieldRowView[];
  selectedId: string;
  details: CalculatedFieldDetailsView;
  tenantId: string;
  busy: boolean;
  onTenantChange: (value: string) => void;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onReloadDefinition: () => void;
  onLoadDebugEvents: () => void;
  onClearDebugEvents: () => void;
};

export function DeviceCalculatedFieldsTab({
  loading,
  rows,
  selectedId,
  details,
  tenantId,
  busy,
  onTenantChange,
  onRefresh,
  onOpenCreate,
  onView,
  onDelete,
  onReloadDefinition,
  onLoadDebugEvents,
  onClearDebugEvents,
}: DeviceCalculatedFieldsTabProps) {
  return (
    <TabsContent value="calculated" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <CardTitle className="text-sm font-semibold">Calculated fields</CardTitle>
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onOpenCreate}
                title="Add calculated field"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={DEVICE_DETAIL_TOOLBAR_ICON_BTN}
                onClick={onRefresh}
                disabled={loading}
                title="Refresh calculated fields"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 grid gap-0 p-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="min-h-0 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Output key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[8rem] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                      Loading calculated fields...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                      No calculated fields found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className={row.id === selectedId ? "bg-muted/30" : undefined}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">{row.outputKey}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onView(row.id)}>
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={DEVICE_DETAIL_DANGER_ICON_BTN}
                            onClick={() => onDelete(row.id)}
                            disabled={busy}
                            title="Delete calculated field"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="min-h-0 space-y-1.5 overflow-y-auto border-l border-border/70 bg-muted/10 px-2.5 py-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold leading-tight">{details ? details.name : "Field details"}</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {details ? "Review the selected field configuration or inspect its debug event payload." : "Select a calculated field to inspect its configuration and debug events."}
              </p>
            </div>

            {details ? (
              <>
                <div className="grid gap-1.5 md:grid-cols-2">
                  <ReadOnlyDetailsField label="Type" value={details.type} className="min-w-0" />
                  <ReadOnlyDetailsField label="Output key" value={details.outputKey} className="min-w-0" />
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Arguments</Label>
                  <div className="flex flex-wrap gap-1 rounded-md border border-border/70 bg-background px-2 py-1.5 shadow-sm">
                    {details.arguments.length > 0 ? (
                      details.arguments.map((argument) => (
                        <Badge key={argument} variant="secondary" className="font-mono text-[11px]">
                          {argument}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No argument metadata returned by the API for this field.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Expression</Label>
                  <div className="rounded-md border border-border/70 bg-background px-2 py-1.5 font-mono text-xs shadow-sm">{details.expression}</div>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] text-muted-foreground">Tenant id</Label>
                  <Input value={tenantId} onChange={(e) => onTenantChange(e.target.value)} className="h-8 font-mono text-xs" />
                </div>

                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="outline" onClick={onReloadDefinition} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reload definition
                  </Button>
                  <Button type="button" variant="outline" onClick={onLoadDebugEvents} disabled={busy}>
                    Load debug events
                  </Button>
                  <Button type="button" variant="outline" onClick={onClearDebugEvents} disabled={busy}>
                    Clear debug events
                  </Button>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] text-muted-foreground">Selected field payload</Label>
                  <JsonBlock value={details.payload} />
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

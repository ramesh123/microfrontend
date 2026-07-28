import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Download, Flag, IdCard, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

import TableWithPagination from "@/common/tableWithPagination";
import {
  deleteDeviceProfileById,
  entityIdFromTb,
  getDeviceProfileById,
  getDeviceProfiles,
  setDefaultDeviceProfile,
  type DeviceProfileRecord,
} from "@/controllers/API/devicesApi";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";

type DeviceProfileTableRow = {
  id: string;
  raw: DeviceProfileRecord;
  name: string;
  type: string;
  transportType: string;
  description: string;
  entityType: string;
  defaultRuleChain: string;
  isTenantDefault: boolean;
};

const PAGINATION_STEPS = [10, 20, 50, 100];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function displayValue(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return "—";
}

function profileId(row: DeviceProfileRecord): string {
  return (
    entityIdFromTb(row.id) ||
    entityIdFromTb(row.deviceProfileId) ||
    entityIdFromTb(row.device_profile_id)
  );
}

function profileName(row: DeviceProfileRecord): string {
  return displayValue(row.name, row.title, row.profileName, row.profile_name, row.displayName, row.label);
}

function profileType(row: DeviceProfileRecord): string {
  return displayValue(row.type, row.profileType, row.profile_type, row.deviceType, row.device_type);
}

function profileTransportType(row: DeviceProfileRecord): string {
  const profile = objectValue(row.deviceProfile ?? row.device_profile);
  return displayValue(
    row.transportType,
    row.transport_type,
    row.transportTypeLabel,
    profile.transportType,
    profile.transport_type,
  );
}

function profileDescription(row: DeviceProfileRecord): string {
  const additionalInfo = objectValue(row.additionalInfo ?? row.additional_info);
  return stringValue(row.description ?? additionalInfo.description).trim();
}

function profileEntityType(row: DeviceProfileRecord): string {
  return displayValue(row.entityType, row.entity_type, "RULE_CHAIN");
}

function profileDefaultRuleChainId(row: DeviceProfileRecord): string {
  return (
    entityIdFromTb(row.defaultRuleChainId) ||
    entityIdFromTb(row.default_rule_chain_id) ||
    entityIdFromTb(row.defaultRuleChain)
  );
}

function profileDefaultRuleChainName(row: DeviceProfileRecord): string {
  const ruleChain = objectValue(row.defaultRuleChain ?? row.default_rule_chain);
  return displayValue(
    row.defaultRuleChainName,
    row.default_rule_chain_name,
    ruleChain.name,
    profileDefaultRuleChainId(row),
  );
}

function profileIsTenantDefault(row: DeviceProfileRecord): boolean {
  const v =
    row.default ??
    row.defaultDeviceProfile ??
    row.default_device_profile ??
    row.tenantDefaultDeviceProfile ??
    row.tenant_default_device_profile ??
    row.isDefault ??
    row.defaultProfile;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return false;
}

function safeFileSegment(name: string): string {
  const cleaned = name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned.slice(0, 48) || "device-profile";
}

function toTableRow(row: DeviceProfileRecord): DeviceProfileTableRow | null {
  const id = profileId(row);
  if (!id) return null;
  return {
    id,
    raw: row,
    name: profileName(row),
    type: profileType(row),
    transportType: profileTransportType(row),
    description: profileDescription(row) || "—",
    entityType: profileEntityType(row),
    defaultRuleChain: profileDefaultRuleChainName(row),
    isTenantDefault: profileIsTenantDefault(row),
  };
}

export default function DeviceProfilesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DeviceProfileRecord[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [textSearch, setTextSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<DeviceProfileTableRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTextSearch(searchTerm.trim());
      setCurrentPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const loadProfiles = useCallback(
    async (nextPage = currentPage, nextPageSize = pageSize) => {
      setLoading(true);
      try {
        const page = await getDeviceProfiles({
          page_size: nextPageSize,
          page: nextPage,
          sort_property: "name",
          sort_order: "ASC",
          text_search: textSearch,
        });
        setRows(page.data ?? []);
        setTotalRows(page.totalElements ?? 0);
      } catch (e) {
        toast.error(getDisplayErrorMessage(e, "Failed to load device profiles."));
        setRows([]);
        setTotalRows(0);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pageSize, textSearch],
  );

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const exportProfile = async (row: DeviceProfileTableRow) => {
    setExportingId(row.id);
    try {
      const raw = await getDeviceProfileById(row.id);
      const text = JSON.stringify(raw, null, 2);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileSegment(row.name)}-${row.id.slice(0, 8)}.json`;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Device profile exported.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to export device profile."));
    } finally {
      setExportingId(null);
    }
  };

  const makeDefaultProfile = async (row: DeviceProfileTableRow) => {
    if (row.isTenantDefault) {
      toast.info("This profile is already the tenant default.");
      return;
    }
    setDefaultingId(row.id);
    try {
      await setDefaultDeviceProfile(row.id);
      toast.success("Default device profile updated.");
      await loadProfiles();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to set default device profile."));
    } finally {
      setDefaultingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await deleteDeviceProfileById(deleteTarget.id);
      toast.success("Device profile deleted.");
      setDeleteTarget(null);
      const nextPage =
        rows.length === 1 && currentPage > 0
          ? currentPage - 1
          : currentPage;
      setCurrentPage(nextPage);
      await loadProfiles(nextPage, pageSize);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete device profile."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const tableRows = useMemo(
    () => rows.map(toTableRow).filter((row): row is DeviceProfileTableRow => row != null),
    [rows],
  );

  const columns = useMemo<ColumnDef<DeviceProfileTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: 220,
        cell: ({ row }) => <span className="text-xs font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 140,
        cell: ({ row }) => <span className="text-xs">{row.original.type}</span>,
      },
      {
        accessorKey: "transportType",
        header: "Transport type",
        size: 160,
        cell: ({ row }) => <span className="text-xs">{row.original.transportType}</span>,
      },
      {
        accessorKey: "entityType",
        header: "Entity type",
        size: 140,
        cell: ({ row }) => <span className="text-xs">{row.original.entityType}</span>,
      },
      {
        accessorKey: "defaultRuleChain",
        header: "Default rule chain",
        size: 220,
        cell: ({ row }) => <span className="line-clamp-2 text-xs">{row.original.defaultRuleChain}</span>,
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 320,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.description}</span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="text-xs">Actions</span>
          </div>
        ),
        size: 152,
        cell: ({ row }) => {
          const r = row.original;
          const busyExport = exportingId === r.id;
          const busyDefault = defaultingId === r.id;
          return (
            <div className="flex w-full justify-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Export device profile"
                disabled={busyExport}
                onClick={() => void exportProfile(r)}
              >
                {busyExport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  r.isTenantDefault ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                title={r.isTenantDefault ? "Tenant default profile" : "Make tenant default profile"}
                disabled={busyDefault || r.isTenantDefault}
                onClick={() => void makeDefaultProfile(r)}
              >
                {busyDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className={cn("h-4 w-4", r.isTenantDefault && "fill-current")} />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Delete profile"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [defaultingId, exportingId, loadProfiles],
  );

  return (
    <>
      <div className="p-0 md:p-0">
        <Card className={LIST_PAGE_CARD_CLASS}>
          <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
            <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <IdCard className="h-4 w-4 shrink-0 text-primary" />
                <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>Device profiles</h3>
              </div>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
                <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search device profiles"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 rounded-sm bg-background pl-8 pr-8 text-sm"
                  />
                  {searchTerm ? <SearchClearButton onClick={() => setSearchTerm("")} /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="h-8 w-8 shrink-0 !px-2"
                    onClick={() => navigate("/iot-gateway/device-profiles/new")}
                    title="Add device profile"
                  >
                    <Plus className="!h-5 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="h-8 w-8 shrink-0 !px-2"
                    onClick={() => {
                      setSearchTerm("");
                      setTextSearch("");
                      setCurrentPage(0);
                      setPageSize(10);
                      void loadProfiles(0, 10);
                    }}
                    disabled={loading}
                    title="Refresh device profiles"
                  >
                    <RefreshCw className={cn("!h-5 w-4", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
            <TableWithPagination
              key={`${textSearch}|${pageSize}`}
              data={tableRows}
              columns={columns}
              totalRows={totalRows}
              loading={loading}
              pagination={{ steps: PAGINATION_STEPS, currentPage, pageSize }}
              paginationSummary="range"
              onRowClick={(row) => navigate(`/iot-gateway/device-profiles/${encodeURIComponent(row.id)}`)}
              onChangePagination={({ currentPage: nextPage, limit }) => {
                setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
                setPageSize((prev) => (prev === limit ? prev : limit));
              }}
            />
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete device profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{deleteTarget?.name ?? "this device profile"}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleteSubmitting}>
              {deleteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

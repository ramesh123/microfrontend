import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircuitBoard,
  Filter,
  Globe,
  Import,
  KeyRound,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation, useNavigate } from "react-router";

import TableWithPagination from "@/common/tableWithPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  assignDeviceToCustomer,
  deleteDevice,
  entityIdFromTb,
  getAvailableCustomers,
  getDeviceCredentials,
  listDeviceProfileInfos,
  listDevices,
  makeDevicePublic,
  saveDevice,
  unassignDeviceFromCustomer,
  deviceRowId,
  type DeviceInfoRecord,
  type DeviceProfileOption,
} from "@/controllers/API/devicesApi";
import { cn } from "@/lib/utils";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";
import { DEVICE_DETAIL_DANGER_ICON_BTN_SM, DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM } from "@/pages/IoTGatewayDevices/DeviceDetailTabShared";
import { DeviceCatalogGridView } from "@/pages/IoTGatewayDevices/DeviceCatalogGridView";
import {
  DEVICE_CATALOG_ENTRIES,
  normalizeDeviceLookupKey,
  resolveDeviceProfileIdForCatalog,
  type DeviceCatalogEntry,
} from "@/pages/IoTGatewayDevices/deviceCatalogEntries";
import {
  DEVICES_PAGINATION_STEPS,
  toDeviceTableRow,
  type DeviceTableRow,
} from "@/pages/IoTGatewayDevices/devicesTableModel";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  readDevicesViewMode,
  writeDevicesViewMode,
  type DevicesViewMode,
} from "@/pages/IoTGatewayDevices/devicesViewMode";

export type { DeviceTableRow } from "@/pages/IoTGatewayDevices/devicesTableModel";

function customersToOptions(raw: unknown): { id: string; title: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = (Array.isArray(o.data) ? o.data : Array.isArray(o.content) ? o.content : []) as Record<string, unknown>[];
  return arr
    .map((r) => {
      const id = entityIdFromTb(r.id);
      const title =
        typeof r.title === "string" ? r.title : typeof r.name === "string" ? r.name : id;
      return id ? { id, title: title || id } : null;
    })
    .filter((x): x is { id: string; title: string } => x != null);
}

const PAGINATION_STEPS = DEVICES_PAGINATION_STEPS;

type ConnectionFilter = "all" | "active" | "inactive";

function findTenantDeviceId(
  entry: DeviceCatalogEntry,
  tenantByName: Record<string, string>,
): string | undefined {
  const key = normalizeDeviceLookupKey(entry.name);
  if (tenantByName[key]) return tenantByName[key];
  const firstToken = key.split(" ")[0];
  if (firstToken.length >= 3) {
    for (const [nameKey, id] of Object.entries(tenantByName)) {
      if (nameKey.includes(firstToken) || firstToken.includes(nameKey.split(" ")[0] ?? "")) {
        return id;
      }
    }
  }
  return undefined;
}

export default function DevicesListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<DevicesViewMode>(readDevicesViewMode);

  const setViewModePersist = useCallback((mode: DevicesViewMode) => {
    writeDevicesViewMode(mode);
    setViewMode(mode);
  }, []);

  useEffect(() => {
    const state = location.state as { viewMode?: DevicesViewMode } | null;
    if (state?.viewMode === "grid" || state?.viewMode === "list") {
      setViewModePersist(state.viewMode);
    }
  }, [location.state, setViewModePersist]);
  const [rows, setRows] = useState<DeviceInfoRecord[]>([]);
  const [tenantByName, setTenantByName] = useState<Record<string, string>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("");
  const [connectionActive, setConnectionActive] = useState<ConnectionFilter>("all");
  const [sortProperty, setSortProperty] = useState("createdTime");
  const [sortOrder, setSortOrder] = useState("Desc");
  const [profiles, setProfiles] = useState<DeviceProfileOption[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftConnection, setDraftConnection] = useState<ConnectionFilter>("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLabel, setCreateLabel] = useState("");
  const [createProfileId, setCreateProfileId] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createGateway, setCreateGateway] = useState(false);
  const [createCustomerId, setCreateCustomerId] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeviceTableRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [assignTarget, setAssignTarget] = useState<DeviceTableRow | null>(null);
  const [customers, setCustomers] = useState<{ id: string; title: string }[]>([]);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const [credsDeviceId, setCredsDeviceId] = useState<string | null>(null);
  const [credsText, setCredsText] = useState("");
  const [credsLoading, setCredsLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTextSearch(searchTerm.trim());
      setCurrentPage(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const loadProfiles = useCallback(async () => {
    try {
      const list = await listDeviceProfileInfos({ page_size: 100, page: 0 });
      setProfiles(list);
    } catch (e) {
      console.error(e);
      toast.error(getDisplayErrorMessage(e, "Failed to load device profiles."));
    }
  }, []);

  const loadDevices = useCallback(async (
    nextPage = currentPage,
    nextPageSize = pageSize,
    nextTextSearch = textSearch,
    nextSortProperty = sortProperty,
    nextSortOrder = sortOrder,
  ) => {
    setLoading(true);
    try {
      const res = await listDevices({
        page: nextPage,
        page_size: nextPageSize,
        text_search: nextTextSearch,
        sort_property: nextSortProperty,
        sort_order: nextSortOrder,
        device_profile_id: profileFilter,
        type: deviceTypeFilter,
        connection_active: connectionActive,
      });
      const data = res.data ?? [];
      setRows(data);
      setTotalRows(typeof res.totalElements === "number" ? res.totalElements : data.length);
    } catch (e) {
      console.error(e);
      toast.error(getDisplayErrorMessage(e, "Failed to load devices."));
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, textSearch, sortProperty, sortOrder, profileFilter, deviceTypeFilter, connectionActive]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (viewMode === "list") {
      void loadDevices();
    }
  }, [loadDevices, viewMode]);

  const loadTenantNameMap = useCallback(async () => {
    try {
      const res = await listDevices({ page: 0, page_size: 500, text_search: "" });
      const map: Record<string, string> = {};
      for (const raw of res.data ?? []) {
        const id = deviceRowId(raw);
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (id && name) {
          map[normalizeDeviceLookupKey(name)] = id;
        }
      }
      setTenantByName(map);
    } catch {
      setTenantByName({});
    }
  }, []);

  useEffect(() => {
    if (viewMode === "grid") {
      void loadTenantNameMap();
    }
  }, [viewMode, loadTenantNameMap]);

  const tableRows = useMemo(() => {
    const out: DeviceTableRow[] = [];
    for (const r of rows) {
      const row = toDeviceTableRow(r);
      if (row) out.push(row);
    }
    return out;
  }, [rows]);

  const openFilter = () => {
    setDraftProfile(profileFilter || "__all__");
    setDraftType(deviceTypeFilter);
    setDraftConnection(connectionActive);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setProfileFilter(draftProfile === "__all__" ? "" : draftProfile);
    setDeviceTypeFilter(draftType.trim());
    setConnectionActive(draftConnection);
    setCurrentPage(0);
    setFilterOpen(false);
  };

  const handlePaginationChange = useCallback(
    ({
      currentPage: page,
      limit,
    }: {
      currentPage: number;
      limit: number;
      sortedColumns?: Record<string, "asc" | "desc">;
    }) => {
      setCurrentPage(page);
      setPageSize(limit);
    },
    [],
  );

  const handleRowOpen = useCallback(
    (row: DeviceTableRow) => {
      navigate(`/iot-gateway/devices/${encodeURIComponent(row.id)}`);
    },
    [navigate],
  );

  const handleRefresh = useCallback(() => {
    setSearchTerm("");
    setTextSearch("");
    setCurrentPage(0);
    setPageSize(10);
    setSortProperty("createdTime");
    setSortOrder("Desc");
    if (viewMode === "grid") {
      void loadTenantNameMap();
    } else {
      void loadDevices(0, 10, "", "createdTime", "Desc");
    }
    toast.success("Refreshed");
  }, [loadDevices, loadTenantNameMap, viewMode]);

  const filteredCatalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return DEVICE_CATALOG_ENTRIES;
    return DEVICE_CATALOG_ENTRIES.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [searchTerm]);

  const matchedCatalogIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of DEVICE_CATALOG_ENTRIES) {
      if (findTenantDeviceId(entry, tenantByName)) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [tenantByName]);

  const handleCatalogSelect = useCallback(
    (entry: DeviceCatalogEntry) => {
      const deviceProfileId = resolveDeviceProfileIdForCatalog(entry, profiles);
      writeDevicesViewMode("grid");
      navigate(`/iot-gateway/devices/by-type/${encodeURIComponent(entry.id)}`, {
        state: { viewMode: "grid" as const, deviceProfileId },
      });
    },
    [navigate, profiles],
  );

  const copyDeviceLink = useCallback(async (id: string) => {
    const url = `${window.location.origin}/iot-gateway/devices/${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Device link copied.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }, []);

  const openAssign = useCallback(async (row: DeviceTableRow) => {
    setAssignTarget(row);
    setAssignCustomerId("");
    setAssignLoading(true);
    try {
      const raw = await getAvailableCustomers({ page_size: 100, page: 0 });
      setCustomers(customersToOptions(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load customers."));
      setCustomers([]);
    } finally {
      setAssignLoading(false);
    }
  }, []);

  const submitAssign = async () => {
    if (!assignTarget || !assignCustomerId) {
      toast.error("Select a customer.");
      return;
    }
    setAssignLoading(true);
    try {
      await assignDeviceToCustomer(assignCustomerId, assignTarget.id);
      toast.success("Device assigned to customer.");
      setAssignTarget(null);
      void loadDevices();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Assign failed."));
    } finally {
      setAssignLoading(false);
    }
  };

  const openCredentials = useCallback(async (deviceId: string) => {
    setCredsDeviceId(deviceId);
    setCredsText("");
    setCredsLoading(true);
    try {
      const data = await getDeviceCredentials(deviceId);
      setCredsText(JSON.stringify(data, null, 2));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load credentials."));
      setCredsText("");
    } finally {
      setCredsLoading(false);
    }
  }, []);

  const openCreate = () => {
    setCreateName("");
    setCreateLabel("");
    setCreateDescription("");
    setCreateGateway(false);
    setCreateProfileId(profiles[0]?.id ?? "");
    setCreateCustomerId("");
    setCreateOpen(true);
    void (async () => {
      try {
        const raw = await getAvailableCustomers({ page_size: 100, page: 0 });
        setCustomers(customersToOptions(raw));
      } catch {
        setCustomers([]);
      }
    })();
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("Device name is required.");
      return;
    }
    if (!createProfileId) {
      toast.error("Select a device profile.");
      return;
    }
    setCreateSubmitting(true);
    try {
      const created = await saveDevice({
        payload: {
          name,
          label: createLabel.trim() || undefined,
          deviceProfileId: { entityType: "DEVICE_PROFILE", id: createProfileId },
          additionalInfo: {
            gateway: createGateway,
            overwriteActivityTime: false,
            description: createDescription.trim() || "",
          },
          customerId: createCustomerId ? { entityType: "CUSTOMER", id: createCustomerId } : null,
        },
      });
      toast.success("Device created.");
      setCreateOpen(false);
      setCurrentPage(0);
      const createdId = created && typeof created === "object" ? deviceRowId(created as DeviceInfoRecord) : "";
      if (createdId) {
        navigate(`/iot-gateway/devices/${encodeURIComponent(createdId)}?connectivity=1`);
        return;
      }
      void loadDevices();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Save failed."));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDevice(deleteTarget.id);
      toast.success("Device deleted.");
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(deleteTarget.id);
        return n;
      });
      void loadDevices();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Delete failed."));
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteDevice(id)));
      toast.success(`Deleted ${ids.length} device(s).`);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      void loadDevices();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Bulk delete failed."));
    } finally {
      setBulkDeleting(false);
    }
  };

  const displayRows = tableRows;
  const allPageSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));
  const somePageSelected = displayRows.some((r) => selectedIds.has(r.id));

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const allSel = displayRows.length > 0 && displayRows.every((r) => prev.has(r.id));
      const next = new Set(prev);
      if (allSel) displayRows.forEach((r) => next.delete(r.id));
      else displayRows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [displayRows]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const paginationProps = useMemo(
    () => ({
      steps: PAGINATION_STEPS,
      currentPage,
      pageSize,
    }),
    [currentPage, pageSize],
  );
  const activeFilterCount = useMemo(
    () =>
      Number(Boolean(profileFilter)) +
      Number(Boolean(deviceTypeFilter)) +
      Number(connectionActive !== "all") +
      Number(Boolean(textSearch)),
    [connectionActive, deviceTypeFilter, profileFilter, textSearch],
  );

  const columns = useMemo<ColumnDef<DeviceTableRow>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex justify-center px-1">
            <Checkbox
              checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
              onCheckedChange={() => toggleSelectAllPage()}
              aria-label="Select all on page"
              className={cn(
                (allPageSelected || somePageSelected) &&
                  "border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-white data-[state=indeterminate]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
              )}
            />
          </div>
        ),
        cell: ({ row }) => {
          const sel = selectedIds.has(row.original.id);
          return (
            <div className="flex justify-center px-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={sel}
                onCheckedChange={() => toggleRow(row.original.id)}
                aria-label={`Select ${row.original.name}`}
                className={cn(
                  sel &&
                    "border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
                )}
              />
            </div>
          );
        },
        size: 44,
        enableSorting: false,
      },
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 230,
        cell: ({ row }) => <span className="line-clamp-2 text-xs font-medium text-foreground">{row.original.name}</span>,
        enableSorting: false,
      },
      {
        id: "profile",
        header: "Device profile",
        accessorKey: "profile",
        size: 120,
        cell: ({ row }) => <span className="line-clamp-2 text-xs text-foreground">{row.original.profile}</span>,
        enableSorting: false,
      },
      {
        id: "label",
        header: "Label",
        accessorKey: "label",
        size: 220,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.label}</span>
        ),
        enableSorting: false,
      },
      {
        id: "state",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>State</span>
          </div>
        ),
        accessorKey: "active",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => {
          const on = row.original.active;
          return (
            <div className="flex justify-center py-0.5">
              {on ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/50 bg-emerald-500/10 px-2 py-0 text-[11px] font-medium text-emerald-800 dark:text-emerald-300"
                >
                  Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 px-2 py-0 text-[11px] font-medium text-destructive"
                >
                  Inactive
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "customer",
        header: "Customer",
        accessorKey: "customer",
        size: 90,
        cell: ({ row }) => (
          <span className="line-clamp-1 text-xs text-foreground">{row.original.customer}</span>
        ),
        enableSorting: false,
      },
      {
        id: "public",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>Public</span>
          </div>
        ),
        accessorKey: "isPublic",
        size: 64,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center py-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={row.original.isPublic} disabled className="h-[18px] w-[18px] shrink-0" />
          </div>
        ),
      },
      {
        id: "gateway",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="whitespace-nowrap">Is gateway</span>
          </div>
        ),
        accessorKey: "isGateway",
        size: 96,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center py-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={row.original.isGateway} disabled className="h-[18px] w-[18px] shrink-0" />
          </div>
        ),
      },
      {
        id: "createdTime",
        header: "Created time",
        accessorFn: (row) => row.createdSortKey,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-primary">
            {row.original.createdDisplay}
          </span>
        ),
        size: 160,
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="whitespace-nowrap">Actions</span>
          </div>
        ),
        size: 232,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div
              className="flex flex-nowrap items-center justify-center gap-0.5 whitespace-nowrap px-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={() => handleRowOpen(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit device</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={() => void copyDeviceLink(r.id)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy device link</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={() => void openAssign(r)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assign to customer</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={async () => {
                      try {
                        await makeDevicePublic(r.id);
                        toast.success("Device is now public.");
                        void loadDevices();
                      } catch (e) {
                        toast.error(getDisplayErrorMessage(e, "Failed."));
                      }
                    }}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Make public</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={async () => {
                      try {
                        await unassignDeviceFromCustomer(r.id);
                        toast.success("Unassigned from customer.");
                        void loadDevices();
                      } catch (e) {
                        toast.error(getDisplayErrorMessage(e, "Failed."));
                      }
                    }}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unassign / private</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                    onClick={() => void openCredentials(r.id)}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Device credentials</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={DEVICE_DETAIL_DANGER_ICON_BTN_SM}
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [
      allPageSelected,
      somePageSelected,
      selectedIds,
      toggleSelectAllPage,
      toggleRow,
      copyDeviceLink,
      openAssign,
      openCredentials,
      handleRowOpen,
      loadDevices,
    ],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full overflow-hidden p-0">
        <Card className={cn(LIST_PAGE_CARD_CLASS, "overflow-hidden")}>
          <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
            <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <CircuitBoard className="h-4 w-4 shrink-0 text-primary" />
                <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>Devices</h3>
              </div>
              {selectedIds.size > 0 ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
                  <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={viewMode === "grid" ? "Search device types" : "Search devices"}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 rounded-sm bg-background pl-8 pr-8 text-sm"
                    />
                    {searchTerm ? <SearchClearButton onClick={() => setSearchTerm("")} /> : null}
                  </div>
                  <div className="flex h-8 shrink-0 items-center rounded-md bg-muted p-0.5">
                    <ToggleGroup
                      type="single"
                      value={viewMode}
                      onValueChange={(value) => {
                        if (value === "list" || value === "grid") {
                          setViewModePersist(value);
                          setCurrentPage(0);
                          if (value === "list") {
                            setSortProperty("createdTime");
                            setSortOrder("Desc");
                          }
                        }
                      }}
                      className="h-full gap-0.5"
                    >
                      <ToggleGroupItem
                        value="list"
                        className="h-7 w-7 p-0 data-[state=on]:bg-background"
                        title="List view"
                      >
                        <List className="h-3.5 w-3.5" />
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="grid"
                        className="h-7 w-7 p-0 data-[state=on]:bg-background"
                        title="Grid view"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="primary"
                            size="icon"
                            className="h-8 w-8 shrink-0 !px-2"
                            title="Add device"
                          >
                            <Plus className="!h-5 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Add new device
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/iot-gateway/device-import" className="cursor-pointer">
                              <Import className="h-4 w-4" />
                              Import device
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        variant="primary"
                        size="icon"
                        className="h-8 w-8 shrink-0 !px-2"
                        title="Refresh"
                        onClick={handleRefresh}
                        disabled={loading}
                      >
                        <RefreshCw className={cn("!h-5 w-4", loading && "animate-spin")} />
                      </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {viewMode === "list" ? (
              <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
                <TableWithPagination
                  key={`${textSearch}|${sortProperty}|${sortOrder}|${profileFilter}|${deviceTypeFilter}|${connectionActive}`}
                  data={displayRows}
                  columns={columns}
                  totalRows={totalRows}
                  pagination={paginationProps}
                  loading={loading}
                  onChangePagination={handlePaginationChange}
                  onRowClick={handleRowOpen}
                  paginationSummary="range"
                />
              </div>
            ) : (
              <DeviceCatalogGridView
                entries={filteredCatalog}
                tenantDeviceIds={matchedCatalogIds}
                onSelectEntry={handleCatalogSelect}
              />
            )}
          </CardContent>
        </Card>

        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Device filter</DialogTitle>
              <DialogDescription>Filter the tenant device list (ThingsBoard-style).</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Device profile</Label>
                <Select value={draftProfile || "__all__"} onValueChange={setDraftProfile}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All profiles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All profiles</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="flt-type">Device type</Label>
                <Input
                  id="flt-type"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value)}
                  placeholder="Type filter (optional)"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Connection state</Label>
                <Select
                  value={draftConnection}
                  onValueChange={(v) => setDraftConnection(v as ConnectionFilter)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active (connected)</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setFilterOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={applyFilter}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignTarget != null} onOpenChange={(o) => !o && setAssignTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign to customer</DialogTitle>
              <DialogDescription>Device: {assignTarget?.name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Customer</Label>
                <Select value={assignCustomerId || "__none__"} onValueChange={(v) => setAssignCustomerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9" disabled={assignLoading}>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select…</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignTarget(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={assignLoading} onClick={() => void submitAssign()}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={credsDeviceId != null} onOpenChange={(o) => !o && setCredsDeviceId(null)}>
          <DialogContent className="max-h-[85vh] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Device credentials</DialogTitle>
              <DialogDescription className="font-mono text-xs">{credsDeviceId}</DialogDescription>
            </DialogHeader>
            {credsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Textarea readOnly value={credsText} className="min-h-[240px] font-mono text-xs" />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!credsText) return;
                  try {
                    await navigator.clipboard.writeText(credsText);
                    toast.success("Copied.");
                  } catch {
                    toast.error("Copy failed.");
                  }
                }}
              >
                Copy JSON
              </Button>
              <Button type="button" onClick={() => setCredsDeviceId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add new device</DialogTitle>
              <DialogDescription>
                Create a device on the tenant. After add, the connectivity dialog opens like ThingsBoard.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="dev-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input id="dev-name" value={createName} onChange={(e) => setCreateName(e.target.value)} className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dev-label">Label</Label>
                <Input id="dev-label" value={createLabel} onChange={(e) => setCreateLabel(e.target.value)} className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label>Device profile</Label>
                <Select value={createProfileId} onValueChange={setCreateProfileId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dev-gw" checked={createGateway} onCheckedChange={(v) => setCreateGateway(v === true)} />
                <Label htmlFor="dev-gw" className="cursor-pointer font-normal">
                  Is gateway
                </Label>
              </div>
              <div className="grid gap-1.5">
                <Label>Assign to customer</Label>
                <Select value={createCustomerId || "__none__"} onValueChange={(v) => setCreateCustomerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Optional</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dev-desc">Description</Label>
                <Textarea
                  id="dev-desc"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Optional"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitCreate()} disabled={createSubmitting}>
                {createSubmitting ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete device?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &quot;{deleteTarget?.name ?? ""}&quot; from the tenant. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} devices?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" disabled={bulkDeleting} onClick={() => void confirmBulkDelete()}>
                {bulkDeleting ? "Deleting…" : "Delete all"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

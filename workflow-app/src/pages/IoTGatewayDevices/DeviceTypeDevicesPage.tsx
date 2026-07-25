import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, CircuitBoard, Pencil, RefreshCw, Search } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import TableWithPagination from "@/common/tableWithPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  listDeviceProfileInfos,
  listDevices,
  type DeviceInfoRecord,
  type DeviceProfileOption,
} from "@/controllers/API/devicesApi";
import { cn } from "@/lib/utils";
import { DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM } from "@/pages/IoTGatewayDevices/DeviceDetailTabShared";
import {
  getDeviceCatalogApiTextSearch,
  getDeviceCatalogEntry,
  resolveDeviceProfileIdForCatalog,
  type DeviceTypeDevicesLocationState,
} from "@/pages/IoTGatewayDevices/deviceCatalogEntries";
import { writeDevicesViewMode } from "@/pages/IoTGatewayDevices/devicesViewMode";

function navigateToDeviceTypes(navigate: ReturnType<typeof useNavigate>) {
  writeDevicesViewMode("grid");
  navigate("/iot-gateway/devices", { state: { viewMode: "grid" as const } });
}
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  DEVICES_PAGINATION_STEPS,
  toDeviceTableRow,
  type DeviceTableRow,
} from "@/pages/IoTGatewayDevices/devicesTableModel";

export default function DeviceTypeDevicesPage() {
  const { typeId = "" } = useParams<{ typeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? null) as DeviceTypeDevicesLocationState | null;
  const catalogEntry = useMemo(() => getDeviceCatalogEntry(typeId), [typeId]);
  const [iconFailed, setIconFailed] = useState(false);

  const [rows, setRows] = useState<DeviceInfoRecord[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [profilesReady, setProfilesReady] = useState(false);
  const profileResolveWarnedRef = useRef(false);

  const typeApiSearch = useMemo(
    () => (catalogEntry ? getDeviceCatalogApiTextSearch(catalogEntry) : ""),
    [catalogEntry],
  );

  const deviceProfileIdFromRoute = routeState?.deviceProfileId?.trim() ?? "";

  const [profiles, setProfiles] = useState<DeviceProfileOption[]>([]);

  const deviceProfileId = useMemo(() => {
    if (deviceProfileIdFromRoute) return deviceProfileIdFromRoute;
    if (!catalogEntry) return "";
    return resolveDeviceProfileIdForCatalog(catalogEntry, profiles) ?? "";
  }, [deviceProfileIdFromRoute, catalogEntry, profiles]);

  useEffect(() => {
    let cancelled = false;
    setProfilesReady(false);
    void listDeviceProfileInfos({ page_size: 200, page: 0 })
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setProfilesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [typeId]);

  useEffect(() => {
    const t = window.setTimeout(() => setTextSearch(searchTerm.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const loadDevices = useCallback(async () => {
    if (!catalogEntry) return;
    setLoading(true);
    try {
      if (!deviceProfileId && profilesReady && !profileResolveWarnedRef.current) {
        profileResolveWarnedRef.current = true;
        toast.message(`No device profile matched for "${catalogEntry.name}". Showing name search instead.`);
      }

      const text_search = deviceProfileId
        ? textSearch
        : [typeApiSearch, textSearch].filter(Boolean).join(" ").trim() || typeApiSearch;

      const res = await listDevices({
        page: currentPage,
        page_size: pageSize,
        text_search,
        sort_property: "createdTime",
        sort_order: "DESC",
        device_profile_id: deviceProfileId,
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
  }, [
    catalogEntry,
    currentPage,
    pageSize,
    textSearch,
    typeApiSearch,
    deviceProfileId,
    profilesReady,
  ]);

  useEffect(() => {
    if (catalogEntry && profilesReady) {
      void loadDevices();
    }
  }, [catalogEntry, profilesReady, loadDevices]);

  const tableRows = useMemo(() => {
    const out: DeviceTableRow[] = [];
    for (const r of rows) {
      const row = toDeviceTableRow(r);
      if (row) out.push(row);
    }
    return out;
  }, [rows]);

  const handlePaginationChange = useCallback(
    ({ currentPage: page, limit }: { currentPage: number; limit: number }) => {
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

  const columns = useMemo<ColumnDef<DeviceTableRow>[]>(
    () => [

      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 220,
        cell: ({ row }) => <span className="line-clamp-2 text-sm font-medium">{row.original.name}</span>,
        enableSorting: false,
      },
      {
        id: "profile",
        header: "Device profile",
        accessorKey: "profile",
        size: 140,
        enableSorting: false,
      },
      {
        id: "label",
        header: "Label",
        accessorKey: "label",
        size: 180,
        cell: ({ row }) => <span className="line-clamp-2 text-sm text-muted-foreground">{row.original.label}</span>,
        enableSorting: false,
      },
      {
        id: "state",
        header: () => <div className="flex w-full justify-center">State</div>,
        accessorKey: "active",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            {row.original.active ? (
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                Inactive
              </Badge>
            )}
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
        header: () => <div className="flex w-full justify-center">Actions</div>,
        size: 72,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
                  onClick={() => handleRowOpen(row.original)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open device</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ],
    [handleRowOpen],
  );

  if (!catalogEntry) {
    return (
      <div className="p-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigateToDeviceTypes(navigate)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to device types
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">Device type not found.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full overflow-hidden p-0">
        <Card className="gap-0 overflow-hidden rounded-md border border-border/70 bg-card py-0 shadow-sm">
          <CardHeader className="border-b border-border/70 px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-9 shrink-0"
                  onClick={() => navigateToDeviceTypes(navigate)}
                  title="Back to device types"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                  {!iconFailed ? (
                    <img
                      src={catalogEntry.iconUrl}
                      alt=""
                      className="h-8 w-8 object-contain dark:invert-[0.88]"
                      onError={() => setIconFailed(true)}
                    />
                  ) : (
                    <CircuitBoard className="h-7 w-7 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight text-foreground">{catalogEntry.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{catalogEntry.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {catalogEntry.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative w-full min-w-[10rem] sm:w-52">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search devices"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(0);
                    }}
                    className="h-9 bg-background pl-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 bg-muted"
                  title="Refresh"
                  onClick={() => void loadDevices()}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TableWithPagination
              key={`${typeId}|${deviceProfileId}|${textSearch}|${pageSize}`}
              data={tableRows}
              columns={columns}
              totalRows={totalRows}
              pagination={{ steps: DEVICES_PAGINATION_STEPS, currentPage, pageSize }}
              loading={loading}
              onChangePagination={handlePaginationChange}
              onRowClick={handleRowOpen}
              paginationSummary="range"
            />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

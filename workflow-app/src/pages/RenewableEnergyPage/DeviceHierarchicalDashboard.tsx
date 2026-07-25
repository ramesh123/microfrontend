import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, type PaginationState } from '@tanstack/react-table';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronRight,
  ChevronsRight,
  ChevronLeft,
  ChevronsLeft,
  Cpu,
  Download,
  Eye,
  FileDown,
  FolderPlus,
  Info,
  Layers,
  Loader2,
  MapPin,
  Network,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  getAllLocationSetups,
  downloadLocationSetup,
  deleteLocationSetup,
  normalizeLocationSetupDetails,
  resolveLocationSetupUpdateId,
  resolveLocationSetupIdFromApiResponse,
  type EnergySetup,
  getDomainsByLocation,
  getSubDomainOptions,
  getAssetsByLocationDomainSubdomain,
  resolveSetupAssetScope,
  getLocationSetup,
  getDeviceInventory,
  type DeviceInventoryRecord,
} from '@/controllers/API/energySectorApi';
import { createLocation, generateNextLocationId, getLocationsList, type CreateLocationPayload, type LocationRecord } from '@/controllers/API/locationsApi';
import { EnergySectorEditor } from './EnergySectorEditor';
import { HierarchyVisualizer } from './HierarchyVisualizer';
import { DeviceInventoryOnboardView } from './DeviceInventoryOnboardView';
import { getDeviceCountConfig, getEnergyNodeConfig } from './energyNodeConfig';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function formatHierarchyDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDomainAccent(domain: string) {
  const value = domain.toLowerCase();

  if (value.includes('solar') || value.includes('pv')) {
    return {
      stripe: 'bg-orange-500',
      iconBg: 'bg-orange-100 dark:bg-orange-950/50',
      iconColor: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800',
      badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    };
  }
  if (value.includes('wind')) {
    return {
      stripe: 'bg-sky-500',
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
      iconColor: 'text-sky-600 dark:text-sky-400',
      border: 'border-sky-200 dark:border-sky-800',
      badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    };
  }
  if (value.includes('battery') || value.includes('storage')) {
    return {
      stripe: 'bg-emerald-500',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (value.includes('hydro')) {
    return {
      stripe: 'bg-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    };
  }

  return {
    stripe: 'bg-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    border: 'border-primary/20',
    badge: 'bg-primary/10 text-primary',
  };
}

const PAGINATION_STEPS = [10, 20, 50, 100];
type DashboardView =
  | 'locations'
  | 'hierarchies'
  | 'locationForm'
  | 'locationActions'
  | 'hierarchyWizard'
  | 'hierarchyExport'
  | 'devicesView'
  | 'deviceInventoryOnboard'
  | 'hierarchyEditor';
type HierarchiesViewMode = 'view' | 'update';

type DeviceInventoryCard = {
  id: string;
  recordId: string;
  locationId: string;
  nodeName: string;
  displayName: string;
  nodePath: string;
  parentPath: string;
  nodeType: string;
  instance: number;
  counts: Record<string, number>;
  updatedAt: string;
  createdAt: string;
};

const DEVICE_COUNT_LABELS: Record<string, string> = {
  smbCount: 'SMB',
  ups: 'UPS',
  transformer: 'Transformer',
};

function formatDeviceCountLabel(key: string) {
  if (DEVICE_COUNT_LABELS[key]) return DEVICE_COUNT_LABELS[key];
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function formatInventoryTimestamp(value?: string) {
  if (!value?.trim()) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type LocationReadiness = 'Healthy' | 'Attention' | 'Draft';

type HierarchyWizardStep = 1 | 2 | 3;

type DashboardLocationRecord = LocationRecord & {
  domain: string;
  subDomain: string;
  hierarchyDepth: number;
  assetCount: number;
  onlineAssets: number;
  status: LocationReadiness;
  lastSync: string;
  createdAt: string;
};

const EMPTY_LOCATION_FORM: CreateLocationPayload = {
  name: '',
  description: '',
  location_id: '',
  business_unit: '',
};

type LocationFormMode = 'create' | 'edit' | 'view';
type LocationIdMode = 'auto' | 'manual';

const LOCATION_ACTIONS = [
  {
    title: 'View Location Details',
    description: 'Full site profile and stats',
    icon: Info,
  },
  {
    title: 'Create New Device Hierarchy',
    description: 'Guided 3-step builder',
    icon: FolderPlus,
  },
  {
    title: 'Edit Location Details',
    description: 'Update name, code, type and metadata',
    icon: Pencil,
  },
  {
    title: 'View Existing Hierarchies',
    description: 'Browse hierarchies as cards',
    icon: Eye,
  },
  {
    title: 'View Onboarded Devices',
    description: 'All devices connected to this site',
    icon: Cpu,
  },
  {
    title: 'Onboard Device Inventory',
    description: 'Register PCSS, inverters, and PESS counts',
    icon: PackagePlus,
  },
  {
    title: 'Update Existing Hierarchy',
    description: 'Modify levels and relationships',
    icon: RefreshCw,
  },
];

function rawString(raw: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function rawNumber(raw: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

function formatCreatedAt(value: string) {
  if (!value || value === '—') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function enrichLocationForDashboard(location: LocationRecord): DashboardLocationRecord {
  const raw = location.raw ?? {};
  const hierarchyDepth = rawNumber(raw, ['hierarchy_depth', 'hierarchyDepth', 'levels', 'level_count']);
  const assetCount = rawNumber(raw, ['asset_count', 'assetCount', 'total_assets', 'totalAssets']);
  const onlineAssets = rawNumber(raw, ['online_assets', 'onlineAssets', 'onboarded_devices', 'onboardedDevices']);
  const rawStatus = rawString(raw, ['status', 'readiness', 'hierarchy_status', 'hierarchyStatus'], '').toLowerCase();
  const status: LocationReadiness =
    rawStatus.includes('attention') || rawStatus.includes('warning')
      ? 'Attention'
      : rawStatus.includes('active') || rawStatus.includes('healthy') || hierarchyDepth > 0
        ? 'Healthy'
        : 'Draft';

  return {
    ...location,
    domain: rawString(raw, ['domain', 'device_domain', 'deviceDomain'], 'Unassigned'),
    subDomain: rawString(raw, ['sub_domain', 'subDomain', 'device_sub_domain', 'deviceSubDomain'], 'Hierarchy pending'),
    hierarchyDepth,
    assetCount,
    onlineAssets,
    status,
    lastSync: rawString(raw, ['last_sync', 'lastSync', 'updated_at', 'updatedAt'], 'Not synced'),
    createdAt: rawString(raw, ['created_at', 'createdAt'], '—'),
  };
}

type DeviceHierarchicalDashboardProps = {
  onBack: () => void;
};

export function DeviceHierarchicalDashboard({ onBack }: DeviceHierarchicalDashboardProps) {
  const [rows, setRows] = useState<LocationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<DashboardView>('locations');
  const [hierarchiesViewMode, setHierarchiesViewMode] = useState<HierarchiesViewMode>('view');
  const [energySetups, setEnergySetups] = useState<EnergySetup[]>([]);
  const [setupsLoading, setSetupsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [locationFormMode, setLocationFormMode] = useState<LocationFormMode>('create');
  const [locationIdMode, setLocationIdMode] = useState<LocationIdMode>('auto');
  const [locationForm, setLocationForm] = useState<CreateLocationPayload>(EMPTY_LOCATION_FORM);
  const [selectedLocation, setSelectedLocation] = useState<DashboardLocationRecord | null>(null);
  const [wizardStep, setWizardStep] = useState<HierarchyWizardStep>(1);
  const [wizardDomain, setWizardDomain] = useState('');
  const [wizardSubDomain, setWizardSubDomain] = useState('');
  const [wizardSetup, setWizardSetup] = useState<EnergySetup | null>(null);
  /** Setup id returned by create-location-hierarchy (e.g. `28`) — used for download. */
  const [createdHierarchySetupId, setCreatedHierarchySetupId] = useState<string | null>(null);
  const [editingHierarchy, setEditingHierarchy] = useState<EnergySetup | null>(null);
  const [domainOptions, setDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [subDomainOptions, setSubDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isLoadingSubDomains, setIsLoadingSubDomains] = useState(false);
  const [isLoadingWizard, setIsLoadingWizard] = useState(false);
  const [setupDetails, setSetupDetails] = useState<unknown>(null);
  const [loadingSetupAction, setLoadingSetupAction] = useState<{ id: number; action: 'view' | 'edit' } | null>(null);
  const [downloadingSetupFormat, setDownloadingSetupFormat] = useState<'json' | 'csv' | null>(null);
  const [isSetupDetailsOpen, setIsSetupDetailsOpen] = useState(false);
  const [deviceInventory, setDeviceInventory] = useState<DeviceInventoryCard[]>([]);
  const [deviceInventorySummary, setDeviceInventorySummary] = useState<Record<string, number>>({});
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [knownLocationIds, setKnownLocationIds] = useState<string[]>([]);
  const loadSeqRef = useRef(0);
  const setupLoadSeqRef = useRef(0);
  const deviceLoadSeqRef = useRef(0);
  const paginationSyncedRef = useRef(false);
  const dashboardLocations = useMemo(() => rows.map(enrichLocationForDashboard), [rows]);

  const hierarchyEditorLocationContext = useMemo(
    () =>
      selectedLocation
        ? {
            location_id: selectedLocation.location_id,
            location_name: selectedLocation.name,
            domain:
              selectedLocation.domain !== 'Unassigned' ? selectedLocation.domain : undefined,
            sub_domain:
              selectedLocation.subDomain !== 'Hierarchy pending'
                ? selectedLocation.subDomain
                : undefined,
          }
        : undefined,
    [
      selectedLocation?.location_id,
      selectedLocation?.name,
      selectedLocation?.domain,
      selectedLocation?.subDomain,
    ],
  );

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const out = await getLocationsList({ skip: nextPage * nextPageSize, limit: nextPageSize });
      if (seq !== loadSeqRef.current) return;
      setRows(out.rows);
      setTotal(out.total);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load locations.');
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSetups = useCallback(async (locationId?: string) => {
    const resolvedLocationId = locationId ?? selectedLocation?.location_id;
    if (!resolvedLocationId) {
      toast.error('Missing location information.');
      setEnergySetups([]);
      return;
    }

    const seq = ++setupLoadSeqRef.current;
    setSetupsLoading(true);
    try {
      const response = await getAllLocationSetups(resolvedLocationId);
      if (seq !== setupLoadSeqRef.current) return;
      setEnergySetups(response.data || []);
    } catch (e) {
      if (seq !== setupLoadSeqRef.current) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load hierarchies.');
      setEnergySetups([]);
    } finally {
      if (seq === setupLoadSeqRef.current) setSetupsLoading(false);
    }
  }, [selectedLocation?.location_id]);

  const mapDeviceInventoryToCards = useCallback((items: DeviceInventoryRecord[]): DeviceInventoryCard[] => {
    const mapped = items.map((item, index) => {
      const instance = Number(item.instance ?? 0);
      const nodeName = String(item.node_name ?? item.name ?? item.device_name ?? `Node ${index + 1}`).trim();
      const displayName = instance > 0 ? `${nodeName} #${instance}` : nodeName;
      const nodeType = String(item.node_type ?? item.device_type ?? item.type ?? 'device').trim().toLowerCase();
      const nodePath = String(item.node_path ?? '').trim();
      const parentPath = String(item.parent_path ?? '').trim();
      const counts: Record<string, number> = {};
      if (item.counts && typeof item.counts === 'object') {
        Object.entries(item.counts).forEach(([key, value]) => {
          const n = Number(value);
          if (Number.isFinite(n) && n > 0) counts[key] = n;
        });
      }

      return {
        id: String(item.id ?? `${nodePath || displayName}-${index}`),
        recordId: String(item.id ?? index),
        locationId: String(item.location_id ?? '').trim(),
        nodeName,
        displayName,
        nodePath,
        parentPath,
        nodeType,
        instance,
        counts,
        updatedAt: String(item.updated_at ?? '').trim(),
        createdAt: String(item.created_at ?? '').trim(),
      };
    });

    return mapped.sort((a, b) => a.nodePath.localeCompare(b.nodePath));
  }, []);

  const loadDeviceInventory = useCallback(
    async (locationName?: string) => {
      const resolvedLocationName = locationName ?? selectedLocation?.name ?? '';

      if (!resolvedLocationName || resolvedLocationName === '—') {
        toast.error('Missing location name.');
        setDeviceInventory([]);
        return;
      }

      const seq = ++deviceLoadSeqRef.current;
      setDevicesLoading(true);
      try {
        const response = await getDeviceInventory(resolvedLocationName);
        if (seq !== deviceLoadSeqRef.current) return;
        setDeviceInventory(mapDeviceInventoryToCards(response.device_inventory));
        setDeviceInventorySummary(response.summary ?? {});
      } catch (e) {
        if (seq !== deviceLoadSeqRef.current) return;
        toast.error(e instanceof Error ? e.message : 'Failed to load device inventory.');
        setDeviceInventory([]);
        setDeviceInventorySummary({});
      } finally {
        if (seq === deviceLoadSeqRef.current) setDevicesLoading(false);
      }
    },
    [mapDeviceInventoryToCards, selectedLocation?.name],
  );

  const handlePaginationChange = useCallback(
    ({ currentPage, limit }: { currentPage: number; limit: number }) => {
      if (!paginationSyncedRef.current) {
        paginationSyncedRef.current = true;
        if (currentPage === page && limit === pageSize) return;
      }
      setPage((prev) => (prev === currentPage ? prev : currentPage));
      setPageSize((prev) => (prev === limit ? prev : limit));
    },
    [page, pageSize],
  );

  const handleRefresh = useCallback(() => {
    if (view === 'devicesView') {
      void loadDeviceInventory();
      return;
    }
    if (view === 'hierarchies') {
      void loadSetups();
      return;
    }
    paginationSyncedRef.current = false;
    setPage(0);
    setPageSize(10);
    void load(0, 10);
  }, [load, loadDeviceInventory, loadSetups, view]);

  const loadKnownLocationIds = useCallback(async () => {
    try {
      const out = await getLocationsList({ skip: 0, limit: 5000 });
      setKnownLocationIds(
        out.rows.map((row) => row.location_id).filter((id) => id && id !== '—'),
      );
    } catch {
      setKnownLocationIds(
        rows.map((row) => row.location_id).filter((id) => id && id !== '—'),
      );
    }
  }, [rows]);

  useEffect(() => {
    if (locationFormMode !== 'create' || locationIdMode !== 'auto') return;

    const nextLocationId = generateNextLocationId(locationForm.name, knownLocationIds);
    setLocationForm((prev) =>
      prev.location_id === nextLocationId ? prev : { ...prev, location_id: nextLocationId },
    );
  }, [knownLocationIds, locationForm.name, locationFormMode, locationIdMode]);

  const openCreateLocationDialog = useCallback(() => {
    setLocationFormMode('create');
    setLocationIdMode('auto');
    setLocationForm(EMPTY_LOCATION_FORM);
    setSelectedLocation(null);
    setView('locationForm');
    void loadKnownLocationIds();
  }, [loadKnownLocationIds]);

  const openEditLocationDialog = useCallback((location: DashboardLocationRecord) => {
    setLocationFormMode('edit');
    setLocationForm({
      name: location.name === '—' ? '' : location.name,
      description: location.description,
      location_id: location.location_id,
      business_unit: location.business_unit,
    });
    setSelectedLocation(location);
    setView('locationForm');
  }, []);

  const openViewLocationDialog = useCallback((location: DashboardLocationRecord) => {
    setLocationFormMode('view');
    setLocationForm({
      name: location.name === '—' ? '' : location.name,
      description: location.description,
      location_id: location.location_id,
      business_unit: location.business_unit,
    });
    setSelectedLocation(location);
    setView('locationForm');
  }, []);

  const closeLocationForm = useCallback(() => {
    if ((locationFormMode === 'view' || locationFormMode === 'edit') && selectedLocation) {
      setView('locationActions');
    } else {
      setView('locations');
      setSelectedLocation(null);
    }
    setLocationFormMode('create');
    setLocationIdMode('auto');
    setLocationForm(EMPTY_LOCATION_FORM);
    setCreateSubmitting(false);
  }, [locationFormMode, selectedLocation]);

  const handleCreateLocation = useCallback(async () => {
    if (!locationForm.name.trim() || !locationForm.location_id.trim()) return;

    setCreateSubmitting(true);
    try {
      await createLocation(locationForm);
      toast.success('Location created.');
      setPage(0);
      await load(0, pageSize);
      closeLocationForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create location.');
    } finally {
      setCreateSubmitting(false);
    }
  }, [closeLocationForm, load, locationForm, pageSize]);

  const handleLocationAction = (title: string, location: DashboardLocationRecord) => {
    if (title === 'Edit Location Details') {
      openEditLocationDialog(location);
      return;
    }
    if (title === 'Create New Device Hierarchy') {
      setSelectedLocation(location);
      setWizardStep(1);
      setWizardDomain('');
      setWizardSubDomain('');
      setWizardSetup(null);
      setCreatedHierarchySetupId(null);
      setView('hierarchyWizard');
      void fetchDomainOptions(location.name);
      return;
    }
    if (title === 'View Existing Hierarchies') {
      setSelectedLocation(location);
      setHierarchiesViewMode('view');
      setView('hierarchies');
      void loadSetups(location.location_id);
      return;
    }
    if (title === 'Update Existing Hierarchy') {
      setSelectedLocation(location);
      setHierarchiesViewMode('update');
      setView('hierarchies');
      void loadSetups(location.location_id);
      return;
    }
    if (title === 'View Location Details') {
      openViewLocationDialog(location);
      return;
    }
    if (title === 'View Onboarded Devices') {
      setSelectedLocation(location);
      setView('devicesView');
      void loadDeviceInventory(location.name);
      return;
    }
    if (title === 'Onboard Device Inventory') {
      setSelectedLocation(location);
      setView('deviceInventoryOnboard');
      return;
    }
    toast.info(`${title} is ready to connect.`);
  };

  const fetchDomainOptions = useCallback(async (location: string) => {
    setIsLoadingDomains(true);
    setSubDomainOptions([]);
    setWizardSubDomain('');
    try {
      const response = await getDomainsByLocation(location);
      setDomainOptions(response.data || []);
    } catch (error) {
      console.error('Error fetching domain options:', error);
      toast.error('Failed to load domains');
      setDomainOptions([]);
    } finally {
      setIsLoadingDomains(false);
    }
  }, []);

  const fetchSubDomainOptions = useCallback(async (location: string, domain: string) => {
    setIsLoadingSubDomains(true);
    setWizardSubDomain('');
    try {
      const response = await getSubDomainOptions(location, domain);
      setSubDomainOptions(response.data || []);
    } catch (error) {
      console.error('Error fetching sub domain options:', error);
      toast.error('Failed to load sub domains');
      setSubDomainOptions([]);
    } finally {
      setIsLoadingSubDomains(false);
    }
  }, []);

  const handleWizardStep1Next = useCallback(async () => {
    if (!selectedLocation) {
      toast.error('No location selected');
      return;
    }

    setIsLoadingWizard(true);
    try {
      const assetsData = await getAssetsByLocationDomainSubdomain(
        selectedLocation.name,
        wizardDomain,
        wizardSubDomain,
        false
      );

      const newId = Date.now();
      const blankSetup: EnergySetup = {
        id: newId,
        domain: wizardDomain,
        sub_domain: wizardSubDomain,
        location: selectedLocation.name,
        created_by: '',
        updated_by: '',
        created_at: '',
        updated_at: '',
        entity_id: null,
        location_id: selectedLocation.location_id,
        business_unit: selectedLocation.business_unit,
        selectedLocationData: selectedLocation,
        assets: assetsData,
      };
      setWizardSetup(blankSetup);
      setWizardStep(2);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets for this selection');
    } finally {
      setIsLoadingWizard(false);
    }
  }, [selectedLocation, wizardDomain, wizardSubDomain]);

  const handleWizardStep2Save = useCallback((savedResult?: unknown) => {
    const savedSetupId = resolveLocationSetupIdFromApiResponse(savedResult);
    if (savedSetupId) {
      setCreatedHierarchySetupId(savedSetupId);
    }

    if (savedResult && typeof savedResult === 'object') {
      const savedRecord = savedResult as Record<string, unknown>;
      const locationSetup =
        savedRecord.location_setup && typeof savedRecord.location_setup === 'object'
          ? (savedRecord.location_setup as Record<string, unknown>)
          : null;

      setWizardSetup((prev) =>
        prev
          ? {
              ...prev,
              ...(savedSetupId
                ? {
                    id: Number(savedSetupId) || prev.id,
                    update_id: savedSetupId,
                  }
                : {}),
              ...(typeof savedRecord.location_id === 'string'
                ? { location_id: savedRecord.location_id }
                : locationSetup && typeof locationSetup.location_id === 'string'
                  ? { location_id: locationSetup.location_id }
                  : {}),
            }
          : prev,
      );
    }
    setWizardStep(3);
  }, []);

  const handleDownloadLocationSetup = useCallback(
    async (file_format: 'json' | 'csv') => {
      const setupId =
        createdHierarchySetupId ??
        resolveLocationSetupIdFromApiResponse(wizardSetup) ??
        resolveLocationSetupUpdateId(wizardSetup);
      if (!setupId) {
        toast.error('Missing setup id for download. Save the hierarchy first.');
        return;
      }

      setDownloadingSetupFormat(file_format);
      try {
        await downloadLocationSetup({ id: setupId, file_format });
        toast.success(`${file_format.toUpperCase()} download started.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to download location setup.');
      } finally {
        setDownloadingSetupFormat(null);
      }
    },
    [createdHierarchySetupId, wizardSetup],
  );

  const handleEditHierarchy = useCallback(async (setup: EnergySetup) => {
    setLoadingSetupAction({ id: setup.id, action: 'edit' });
    try {
      const locationContext = {
        location_id: selectedLocation?.location_id,
        location_name: selectedLocation?.name,
        domain:
          selectedLocation && selectedLocation.domain !== 'Unassigned'
            ? selectedLocation.domain
            : undefined,
        sub_domain:
          selectedLocation && selectedLocation.subDomain !== 'Hierarchy pending'
            ? selectedLocation.subDomain
            : undefined,
      };
      const fetchId = resolveLocationSetupUpdateId(setup) ?? setup.id;
      const details = await getLocationSetup(fetchId);
      const normalized = normalizeLocationSetupDetails(details, setup, locationContext);
      const scope = resolveSetupAssetScope(normalized, locationContext);

      setEditingHierarchy({
        ...normalized,
        domain: scope.domain || normalized.domain,
        sub_domain: scope.sub_domain || normalized.sub_domain,
      });
      setView('hierarchyEditor');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load setup details for editing.');
    } finally {
      setLoadingSetupAction(null);
    }
  }, [selectedLocation?.domain, selectedLocation?.location_id, selectedLocation?.name, selectedLocation?.subDomain]);

  const handleCloseHierarchyEditor = useCallback(() => {
    setEditingHierarchy(null);
    setView('hierarchies');
  }, []);

  const handleWizardClose = useCallback(() => {
    setView('locationActions');
    setWizardStep(1);
    setWizardDomain('');
    setWizardSubDomain('');
    setWizardSetup(null);
    setCreatedHierarchySetupId(null);
    void load();
  }, [load]);

  const handleSaveLocationDetails = useCallback(() => {
    toast.info('Update location API is not available yet.');
  }, []);

  const handleDeleteHierarchy = useCallback(
    async (setup: EnergySetup) => {
      const updateId = resolveLocationSetupUpdateId(setup);
      if (!updateId) {
        toast.error('Missing update id for hierarchy delete.');
        return;
      }

      if (!confirm('Are you sure you want to delete this hierarchy?')) return;

      try {
        await deleteLocationSetup(updateId);
        toast.success('Hierarchy deleted successfully.');
        setIsSetupDetailsOpen(false);
        void loadSetups(selectedLocation?.location_id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to delete hierarchy.');
      }
    },
    [loadSetups, selectedLocation?.location_id],
  );

  const renderLocationForm = () => {
    const readOnly = locationFormMode === 'view';
    const isCreateMode = locationFormMode === 'create';
    const locationIdReadOnly = readOnly || (isCreateMode && locationIdMode === 'auto');
    const title =
      locationFormMode === 'create'
        ? 'Add location'
        : locationFormMode === 'edit'
          ? 'Edit location details'
          : 'View location details';
    const description =
      locationFormMode === 'create'
        ? 'Register a location and keep it ready for hierarchy setup, device onboarding, and asset mapping.'
        : locationFormMode === 'edit'
          ? 'Review and update the selected location details.'
          : 'Read-only location information from the selected row.';

    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/30">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-background px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-tight text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="h-8 px-3 text-xs"
            onClick={closeLocationForm} 
            disabled={createSubmitting}
          >
            {locationFormMode === 'create' ? (
              'Cancel'
            ) : (
              <>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </>
            )}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Location Information</h4>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-location-name" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="dashboard-location-name"
                        value={locationForm.name}
                        onChange={(e) => setLocationForm((form) => ({ ...form, name: e.target.value }))}
                        placeholder="Enter location name"
                        readOnly={readOnly}
                        className="h-9 pl-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dashboard-location-id" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Location ID <span className="text-destructive">*</span>
                    </Label>

                    {isCreateMode ? (
                      <RadioGroup
                        value={locationIdMode}
                        onValueChange={(value) => {
                          const mode = value as LocationIdMode;
                          setLocationIdMode(mode);
                          if (mode === 'auto') {
                            const nextLocationId = generateNextLocationId(locationForm.name, knownLocationIds);
                            setLocationForm((form) => ({ ...form, location_id: nextLocationId }));
                          }
                        }}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="auto" id="location-id-auto" />
                          <Label htmlFor="location-id-auto" className="cursor-pointer text-xs font-normal text-foreground">
                            Auto generate
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="manual" id="location-id-manual" />
                          <Label htmlFor="location-id-manual" className="cursor-pointer text-xs font-normal text-foreground">
                            Enter manually
                          </Label>
                        </div>
                      </RadioGroup>
                    ) : null}

                    <div className="relative">
                      <Input
                        id="dashboard-location-id"
                        value={locationForm.location_id}
                        onChange={(e) => setLocationForm((form) => ({ ...form, location_id: e.target.value }))}
                        placeholder={
                          isCreateMode && locationIdMode === 'auto'
                            ? 'Auto-generated from name'
                            : 'e.g. THE-001'
                        }
                        readOnly={locationIdReadOnly}
                        className={cn(
                          'h-9 pl-3 font-mono text-sm',
                          locationIdReadOnly && 'bg-muted/50',
                        )}
                      />
                    </div>
                    {isCreateMode ? (
                      <p className="text-[11px] text-muted-foreground">
                        {locationIdMode === 'auto'
                          ? 'Generated from the first 3 letters of the name (e.g. THERKUPATTI → THE-001).'
                          : 'Enter a unique location ID for this site (e.g. THE-001, LOC-002).'}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dashboard-business-unit" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Business Unit
                  </Label>
                  <div className="relative">
                    <Input
                      id="dashboard-business-unit"
                      value={locationForm.business_unit}
                      onChange={(e) => setLocationForm((form) => ({ ...form, business_unit: e.target.value }))}
                      placeholder="Enter business unit"
                      readOnly={readOnly}
                      className="h-9 pl-3 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dashboard-location-description" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Description
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="dashboard-location-description"
                      value={locationForm.description}
                      onChange={(e) => setLocationForm((form) => ({ ...form, description: e.target.value }))}
                      placeholder="Enter optional description"
                      rows={2}
                      readOnly={readOnly}
                      className="resize-none text-sm"
                    />
                  </div>
                </div>

                {!readOnly && (
                  <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-9 px-4 text-sm"
                      onClick={closeLocationForm} 
                      disabled={createSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="h-9 px-4 text-sm"
                      disabled={createSubmitting || !locationForm.name.trim() || !locationForm.location_id.trim()}
                      onClick={() => {
                        if (locationFormMode === 'create') {
                          void handleCreateLocation();
                          return;
                        }
                        handleSaveLocationDetails();
                      }}
                    >
                      {createSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          {locationFormMode === 'create' ? (
                            <Plus className="mr-2 h-4 w-4" />
                          ) : (
                            <Pencil className="mr-2 h-4 w-4" />
                          )}
                          {locationFormMode === 'create' ? 'Create Location' : 'Save Changes'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleViewSetupDetails = useCallback(
    async (setup: EnergySetup) => {
      setLoadingSetupAction({ id: setup.id, action: 'view' });
      try {
        const details = await getLocationSetup(setup.id);
        setSetupDetails(
          normalizeLocationSetupDetails(details, setup, {
            location_id: selectedLocation?.location_id,
            location_name: selectedLocation?.name,
          }),
        );
        setIsSetupDetailsOpen(true);
        toast.success('Setup details loaded successfully.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load setup details.');
      } finally {
        setLoadingSetupAction(null);
      }
    },
    [selectedLocation?.location_id, selectedLocation?.name],
  );

  const renderHierarchyCards = () => {
    if (setupsLoading) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background/80 text-muted-foreground">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Loading hierarchies</p>
            <p className="mt-1 text-xs">Fetching saved setups for this location...</p>
          </div>
        </div>
      );
    }

    if (!energySetups.length) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background/80 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Network className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">No hierarchies found</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {selectedLocation
                ? `No saved hierarchies are linked to ${selectedLocation.name} yet.`
                : 'Create a device hierarchy to see it listed here.'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {energySetups.map((setup) => {
          const accent = getDomainAccent(setup.domain || '');
          const isActive = Boolean((setup as { is_active?: boolean }).is_active ?? true);
          const isViewLoading = loadingSetupAction?.id === setup.id && loadingSetupAction.action === 'view';
          const isEditLoading = loadingSetupAction?.id === setup.id && loadingSetupAction.action === 'edit';
          const isCardBusy = loadingSetupAction?.id === setup.id;

          return (
            <Card
              key={setup.id}
              className={cn(
                'group relative overflow-hidden border bg-background py-0 shadow-sm transition-colors duration-200',
                'hover:border-primary/30 hover:shadow-sm',
              )}
            >
              <div className={cn('absolute inset-x-0 top-0 h-0.5', accent.stripe)} />

              <CardContent className="flex flex-col gap-2.5 p-3 pt-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                        accent.iconBg,
                        accent.border,
                      )}
                    >
                      <Zap className={cn('h-4 w-4', accent.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {setup.domain || 'Energy Setup'}
                      </h3>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {setup.sub_domain || 'No sub domain'}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 border-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{setup.location || 'Unknown location'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {formatHierarchyDate(setup.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {formatHierarchyDate(setup.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5 pt-0.5">
                  {hierarchiesViewMode === 'update' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 flex-1 px-2 text-[11px]"
                        onClick={() => void handleViewSetupDetails(setup)}
                        disabled={isCardBusy}
                      >
                        {isViewLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'View'
                        )}
                      </Button>
                      <Button
                        type="button"
                        className="h-7 flex-1 px-2 text-[11px]"
                        onClick={() => handleEditHierarchy(setup)}
                        disabled={isCardBusy}
                      >
                        {isEditLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="h-7 w-full px-2 text-[11px]"
                      onClick={() => void handleViewSetupDetails(setup)}
                      disabled={isCardBusy}
                    >
                      {isViewLoading ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="mr-1 h-3 w-3" />
                      )}
                      View Setup
                      {!isViewLoading && <ChevronRight className="ml-0.5 h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderHierarchiesPage = () => {
    const isUpdateMode = hierarchiesViewMode === 'update';
    const pageTitle = isUpdateMode ? 'Update Existing Hierarchies' : 'View Existing Hierarchies';
    const pageDescription = isUpdateMode
      ? 'Select a hierarchy to modify levels and relationships.'
      : 'Browse saved renewable energy hierarchies and inspect their configuration.';
    const HeaderIcon = isUpdateMode ? RefreshCw : Eye;

    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/30">
        <div className="border-b bg-background">
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <HeaderIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{pageTitle}</h3>
                  <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    {pageDescription}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-7 px-2.5 text-[11px] font-semibold">
                  {energySetups.length} hierarch{energySetups.length === 1 ? 'y' : 'ies'}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => void loadSetups()}
                  disabled={setupsLoading}
                >
                  <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', setupsLoading && 'animate-spin')} />
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setView('locationActions')}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>
              </div>
            </div>
          </div>

          {selectedLocation ? (
            <div className="border-t bg-muted/20 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">Location</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 font-medium text-foreground">
                  <MapPin className="h-3 w-3 text-primary" />
                  {selectedLocation.name}
                </span>
                {selectedLocation.business_unit ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
                    {selectedLocation.business_unit}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">{renderHierarchyCards()}</div>
      </div>
    );
  };

  const columns = useMemo<ColumnDef<DashboardLocationRecord>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        size: 260,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{row.original.name || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'location_id',
        header: 'Location id',
        accessorKey: 'location_id',
        size: 180,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-muted-foreground">{row.original.location_id || '—'}</span>
        ),
      },
      {
        id: 'business_unit',
        header: 'Business unit',
        accessorKey: 'business_unit',
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{row.original.business_unit || '—'}</span>
          </div>
        ),
      },
      {
        id: 'created_at',
        header: 'Created at',
        accessorKey: 'createdAt',
        size: 220,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatCreatedAt(row.original.createdAt)}</span>
          </div>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        accessorKey: 'description',
        size: 420,
        enableSorting: false,
        cell: ({ row }) => <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{row.original.description || '—'}</span>,
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md border border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLocation(row.original);
                setView('locationActions');
              }}
            >
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: page,
    pageSize: pageSize,
  });

  const table = useReactTable({
    data: dashboardLocations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
    state: {
      pagination: paginationState,
    },
    onPaginationChange: setPaginationState,
  });

  useEffect(() => {
    setPaginationState({ pageIndex: page, pageSize });
  }, [page, pageSize]);

  useEffect(() => {
    handlePaginationChange({
      currentPage: paginationState.pageIndex,
      limit: paginationState.pageSize,
    });
  }, [handlePaginationChange, paginationState.pageIndex, paginationState.pageSize]);

  const renderTableHeader = () => {
    return table.getHeaderGroups().map((headerGroup) => (
      <tr key={headerGroup.id} className="border-b border-border">
        {headerGroup.headers.map((header, index) => {
          const isLastHeader = index === headerGroup.headers.length - 1;
          return (
            <th
              key={header.id}
              className={`h-10 px-4 py-2 text-left align-middle font-semibold ${isLastHeader ? 'sticky right-0 bg-muted/70 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]' : ''}`}
              style={{ width: header.column.columnDef.size }}
            >
              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          );
        })}
      </tr>
    ));
  };

  const renderTableRow = (location: DashboardLocationRecord) => {
    const row = table.getRowModel().rows.find((r) => r.original.location_id === location.location_id);
    
    if (!row) return null;

    return (
      <tr key={location.location_id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
        {row.getVisibleCells().map((cell, index) => {
          const isLastCell = index === row.getVisibleCells().length - 1;
          return (
            <td 
              key={cell.id} 
              className={`px-4 py-3 align-middle ${isLastCell ? 'sticky right-0 bg-background shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]' : ''}`}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderLoadingRows = () => {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-border/50">
        {columns.map((_, j) => {
          const isLastCell = j === columns.length - 1;
          return (
            <td key={j} className={`px-4 py-3 align-middle ${isLastCell ? 'sticky right-0 bg-background' : ''}`}>
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </td>
          );
        })}
      </tr>
    ));
  };

  const renderPagination = () => {
    const totalPages = table.getPageCount();
    const currentPage = paginationState.pageIndex + 1;

    return (
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">{total} Rows</div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Page</span>
          <strong>
            {currentPage} of {totalPages}
          </strong>

          <span className="mx-2 hidden sm:inline">| Go to Page:</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            className="h-7 w-16 border border-border px-2 sm:w-20"
            defaultValue={currentPage}
            onBlur={(e) => {
              const pageNum = Number(e.target.value);
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                table.setPageIndex(pageNum - 1);
              }
            }}
          />

          <Select
            value={String(paginationState.pageSize)}
            onValueChange={(val) => table.setPageSize(Number(val))}
          >
            <SelectTrigger className="h-7 w-[80px] sm:w-[100px]">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              {PAGINATION_STEPS.map((step) => (
                <SelectItem key={step} value={String(step)}>
                  {step}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderLocationActionsView = () => {
    if (!selectedLocation) return null;

    return (
      <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
        <SheetHeader className="shrink-0 border-b bg-background px-4 py-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{selectedLocation.name}</SheetTitle>
              <SheetDescription className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                  {selectedLocation.location_id}
                </span>
                {selectedLocation.business_unit && (
                  <>
                    <span>·</span>
                    <span className="truncate font-medium">{selectedLocation.business_unit}</span>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground">Manage location</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose an action for this site.</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {LOCATION_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/60"
                  onClick={() => handleLocationAction(action.title, selectedLocation)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h5 className="text-sm font-semibold leading-tight text-foreground">
                      {action.title}
                    </h5>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {action.description}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDevicesView = () => {
    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/30">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-background px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">Devices</h3>
              <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                {deviceInventory.length > 0
                  ? `${deviceInventory.length} inventory node${deviceInventory.length === 1 ? '' : 's'} for ${selectedLocation?.name ?? 'this location'}`
                  : `Onboarded devices for ${selectedLocation?.name ?? 'this location'}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => void loadDeviceInventory()}
              disabled={devicesLoading}
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', devicesLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setView('locationActions')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {Object.keys(deviceInventorySummary).length > 0 ? (
          <div className="border-b bg-muted/20 px-4 py-2.5">
            <div className="flex flex-wrap gap-2">
              {Object.entries(deviceInventorySummary).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {key}: <span className="ml-1 font-semibold text-primary">{value}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {devicesLoading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading device inventory...</span>
            </div>
          ) : deviceInventory.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background/80 text-center">
              <Cpu className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">No devices found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No onboarded devices are available for this location.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {deviceInventory.map((device) => {
                const isSiteNode = device.nodeType === 'location';
                const config = getEnergyNodeConfig(isSiteNode ? 'site' : device.nodeName);
                const Icon = config.icon;
                const typeLabel = isSiteNode
                  ? 'Site'
                  : device.nodeType.charAt(0).toUpperCase() + device.nodeType.slice(1);
                const countEntries = Object.entries(device.counts);

                return (
                  <Card
                    key={device.id}
                    className={cn(
                      'group relative overflow-hidden border bg-background py-0 shadow-sm transition-all duration-200',
                      'hover:border-primary/35 hover:shadow-md',
                    )}
                  >
                    <div className={cn('absolute inset-x-0 top-0 h-1', config.badgeColor)} />

                    <CardContent className="flex flex-col gap-3 p-3.5 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                              config.iconBg,
                              config.borderColor,
                            )}
                          >
                            <Icon className={cn('h-4 w-4', config.iconColor)} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-foreground">
                              {device.displayName}
                            </h4>
                            <p className="truncate text-[11px] text-muted-foreground">{device.nodeName}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {typeLabel}
                        </Badge>
                      </div>

                      <div className="space-y-2 rounded-lg border bg-muted/25 px-2.5 py-2">
                        <div className="flex items-start gap-2 text-[11px]">
                          <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">
                            Path
                          </span>
                          <span className="min-w-0 break-all font-mono font-medium text-foreground">
                            {device.nodePath || '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-[11px]">
                          <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">
                            Parent
                          </span>
                          <span className="min-w-0 break-all font-mono text-muted-foreground">
                            {device.parentPath || '—'}
                          </span>
                        </div>
                        {device.instance > 0 ? (
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                              Instance
                            </span>
                            <span className="font-mono font-medium text-foreground">#{device.instance}</span>
                          </div>
                        ) : null}
                      </div>

                      {countEntries.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {countEntries.map(([key, value]) => {
                            const countConfig = getDeviceCountConfig(key);
                            const CountIcon = countConfig.icon;

                            return (
                              <div
                                key={`${device.id}-${key}`}
                                className="flex flex-col items-center rounded-lg border bg-background px-2 py-2 shadow-sm"
                              >
                                <div
                                  className={cn(
                                    'mb-1 flex h-7 w-7 items-center justify-center rounded-md border',
                                    countConfig.iconBg,
                                    countConfig.borderColor,
                                  )}
                                >
                                  <CountIcon className={cn('h-3.5 w-3.5', countConfig.iconColor)} />
                                </div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {formatDeviceCountLabel(key)}
                                </p>
                                <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">{value}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed bg-muted/20 px-2.5 py-2 text-center text-[11px] text-muted-foreground">
                          No device counts for this node
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[10px] text-muted-foreground">
                        <span className="font-mono">
                          ID {device.recordId}
                          {device.locationId ? (
                            <>
                              <span className="mx-1 text-border">·</span>
                              {device.locationId}
                            </>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          {formatInventoryTimestamp(device.updatedAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHierarchyWizard = () => {
    if (wizardStep === 1) {
      return renderWizardStep1();
    }
    if (wizardStep === 2) {
      return renderWizardStep2();
    }
    if (wizardStep === 3) {
      return renderWizardStep3();
    }
    return null;
  };

  const renderStepIndicator = (currentStep: HierarchyWizardStep) => {
    const steps = [
      { number: 1, label: 'Scope', completed: currentStep > 1 },
      { number: 2, label: 'Build', completed: currentStep > 2 },
      { number: 3, label: 'Finish', completed: false },
    ];

    return (
      <div className="inline-flex items-center rounded-lg border bg-background p-1 shadow-sm">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = step.completed;

          return (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${isActive ? 'bg-primary/10' : ''}`}>
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className={`mx-0.5 h-3.5 w-3.5 ${isCompleted ? 'text-primary' : 'text-muted-foreground/40'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWizardStep1 = () => {
    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/30">
        <div className="border-b bg-background">
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">Create New Device Hierarchy</h3>
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    Define the device scope before opening the visual builder.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {renderStepIndicator(1)}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-3 text-xs"
                  onClick={() => {
                    setView('locationActions');
                    setWizardStep(1);
                  }}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Configure hierarchy scope</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">Choose where the hierarchy belongs and which devices it should include.</p>
                  </div>
                  <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Step 1 of 3
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Selected location</p>
                    <p className="truncate text-sm font-semibold text-foreground">{selectedLocation?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px] font-medium text-foreground">{selectedLocation?.location_id}</p>
                    {selectedLocation?.business_unit && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{selectedLocation.business_unit}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">
                          Domain <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-[11px] text-muted-foreground">Primary device category</p>
                      </div>
                    </div>
                    <Combobox
                      value={wizardDomain}
                      onChange={(val) => {
                        setWizardDomain(String(val));
                        setWizardSubDomain('');
                        setSubDomainOptions([]);
                        if (val && selectedLocation) {
                          void fetchSubDomainOptions(selectedLocation.name, String(val));
                        }
                      }}
                      options={domainOptions}
                      placeholder="Select a domain"
                      searchPlaceholder="Search domains..."
                      isLoading={isLoadingDomains}
                      disabled={false}
                      emptyText="No domains found."
                    />
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">
                          Subdomain <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-[11px] text-muted-foreground">Detailed device grouping</p>
                      </div>
                    </div>
                    <Combobox
                      value={wizardSubDomain}
                      onChange={(val) => setWizardSubDomain(String(val))}
                      options={subDomainOptions}
                      placeholder={wizardDomain ? 'Select a subdomain' : 'Select a domain first'}
                      searchPlaceholder="Search subdomains..."
                      disabled={!wizardDomain}
                      isLoading={isLoadingSubDomains}
                      emptyText="No subdomains found."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="max-w-md text-xs text-muted-foreground">
                    Available assets are loaded after the scope is confirmed.
                  </p>
                  <Button
                    className="h-9 px-4 text-sm font-semibold"
                    disabled={!wizardDomain || !wizardSubDomain || isLoadingWizard}
                    onClick={handleWizardStep1Next}
                  >
                    {isLoadingWizard ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Loading Assets...
                      </>
                    ) : (
                      <>
                        Continue to Builder
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border bg-background p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-foreground">How it works</h4>
                <div className="mt-3 space-y-3">
                  {[
                    ['1', 'Set scope', 'Choose the domain and subdomain.'],
                    ['2', 'Build structure', 'Arrange assets in the visual editor.'],
                    ['3', 'Export', 'Review and download the hierarchy.'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{number}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-foreground">Tip</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Pick the narrowest subdomain that matches the devices you want to organize.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  };

  const renderWizardStep2 = () => {
    if (!wizardSetup) return null;

    return (
      <div className="flex h-full min-h-0 flex-col">
        <EnergySectorEditor
          key={wizardSetup.id}
          initialSetup={wizardSetup}
          onClose={handleWizardStep2Save}
          isCreating={true}
          isWizardMode={true}
          onBack={() => setWizardStep(1)}
        />
      </div>
    );
  };

  const renderWizardStep3 = () => {
    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/30">
        <div className="border-b bg-background">
          <div className="px-4 py-3">
            <div className="flex items-center justify-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">Hierarchy Created Successfully</h3>
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    Export and download your configuration
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-center">
              {renderStepIndicator(3)}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">Device Hierarchy Saved!</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">Your configuration has been successfully created and is ready to export.</p>
                </div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Export Options</h4>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleDownloadLocationSetup('json')}
                  disabled={downloadingSetupFormat !== null}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {downloadingSetupFormat === 'json' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Download JSON</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Export hierarchy as JSON format</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>

                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleDownloadLocationSetup('csv')}
                  disabled={downloadingSetupFormat !== null}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {downloadingSetupFormat === 'csv' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Download CSV</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Export hierarchy as CSV format</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-4 text-sm"
                onClick={handleWizardClose}
              >
                Close & Return
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isLocationDrawerOpen =
    view === 'locationActions' || (view === 'locationForm' && locationFormMode !== 'create');
  const isLocationTableVisible = view === 'locations' || isLocationDrawerOpen;

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
      {isLocationTableVisible && (
        <CardHeader className="border-b border-border/60 px-4 py-3 [.border-b]:pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Network className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Device Hierarchical Dashboard</CardTitle>
                  <CardDescription className="text-xs">
                    Location hierarchy, asset coverage, and operational readiness.
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Refresh</span>
              </Button>
              <Button type="button" size="sm" className="h-8 px-3" onClick={openCreateLocationDialog}>
                <Plus className="h-4 w-4" />
                <span className="ml-1">Add location</span>
              </Button>
              {/* <Button variant="outline" onClick={onBack} className="h-8 px-3">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to renewable energy setup</span>
              </Button> */}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-grow flex-col p-0">
        <div className={`min-h-0 flex-1 overflow-hidden bg-background ${isLocationTableVisible ? 'm-3 rounded-md border' : ''}`}>
          {isLocationTableVisible ? (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1360px] border-collapse text-sm">
                  <thead className="bg-muted/70 sticky top-0 z-20">
                    {renderTableHeader()}
                  </thead>
                  <tbody>
                    {loading ? (
                      renderLoadingRows()
                    ) : dashboardLocations.length > 0 ? (
                      dashboardLocations.map((location) => renderTableRow(location))
                    ) : (
                      <tr>
                        <td colSpan={columns.length} className="py-6 text-center text-muted-foreground">
                          No locations found. Please adjust the filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </div>
          ) : view === 'devicesView' ? (
            renderDevicesView()
          ) : view === 'deviceInventoryOnboard' && selectedLocation ? (
            <DeviceInventoryOnboardView
              location={{
                name: selectedLocation.name,
                location_id: selectedLocation.location_id,
                business_unit: selectedLocation.business_unit,
              }}
              onBack={() => setView('locationActions')}
            />
          ) : view === 'hierarchyWizard' ? (
            renderHierarchyWizard()
          ) : view === 'hierarchies' ? (
            renderHierarchiesPage()
          ) : view === 'hierarchyEditor' && editingHierarchy ? (
            <EnergySectorEditor
              key={editingHierarchy.id}
              initialSetup={editingHierarchy}
              onClose={handleCloseHierarchyEditor}
              isCreating={false}
              isWizardMode={false}
              locationContext={hierarchyEditorLocationContext}
            />
          ) : (
            renderLocationForm()
          )}
        </div>
      </CardContent>
      <Sheet
        open={isLocationDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setView('locations');
            setSelectedLocation(null);
            setLocationFormMode('create');
            setLocationIdMode('auto');
            setLocationForm(EMPTY_LOCATION_FORM);
            setCreateSubmitting(false);
          }
        }}
      >
        <SheetContent side="right" className="w-[min(94vw,520px)] gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          {view === 'locationForm' ? renderLocationForm() : renderLocationActionsView()}
        </SheetContent>
      </Sheet>
      <HierarchyVisualizer
        isOpen={isSetupDetailsOpen}
        onOpenChange={setIsSetupDetailsOpen}
        data={setupDetails}
        onEdit={
          hierarchiesViewMode === 'update'
            ? () => {
                if (setupDetails) {
                  handleEditHierarchy(setupDetails as EnergySetup);
                  setIsSetupDetailsOpen(false);
                }
              }
            : undefined
        }
        onDelete={
          hierarchiesViewMode === 'update'
            ? () => {
                if (setupDetails) {
                  void handleDeleteHierarchy(setupDetails as EnergySetup);
                }
              }
            : undefined
        }
      />
    </Card>
  );
}

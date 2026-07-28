import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import InputMultiDropdown from '@/components/core/inputMultiDropdown';
import { getAllRolesApi } from '@/controllers/API';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useApiCrud } from '@/hooks/useOrganizationSetup';
import { Organization } from '@/types/orchestration';
import { getAllOrganizationsApi } from '@/controllers/API/orchestrationApi';
import { useRbacStore } from '@/stores/useRBACStore';
import {
  buildLocationIdDeviceQuery,
  deviceRowId,
  queryDevices,
  type DeviceInfoRecord,
} from '@/controllers/API/devicesApi';
import { getLocationsList, type LocationRecord } from '@/controllers/API/locationsApi';
import {
  fetchAllAclEntries,
  mergeAclEntriesByType,
  saveUserAclForType,
  type UserAclEntry,
} from '@/controllers/API/userAclApi';
import {
  UserPermissionsPanel,
  buildSensorPermissionsFromAcl,
  deviceMatchesResourceId,
  type DeviceListItem,
  getCheckedLocationIdsFromAcl,
  mapDevicesForPermissions,
  parseSensorsFromDevice,
  resolveDeviceIdHintFromSensorAcl,
  resolveLocationToOpenFromAcl,
  type DevicePermissionState,
  sensorPermissionKey,
  type SensorPermissionState,
  type SensorRow,
} from './UserPermissionsPanel';
import { cn } from '@/lib/utils';
import {
  Loader2,
  PanelLeftOpen,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { getOrganizationPerspectiveIds, getPerspectiveOrganizationIds } from '@/controllers/API/apiService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  application_id: string[];
  algo_role: string[];
  is_ad_user: boolean;
  status: boolean;
  manual_user: boolean;
  created_at: string;
  updated_at: string;
  org_id?: string[];
  perspective_id?: string[];
  perspective_ids?: string[];
  perspective_names?: string[];
}

interface UserFormData {
  username: string;
  first_name: string;
  last_name: string;
  application_id: string[];
  employee_id: string;
  email: string;
  password: string;
  algo_role: string[];
  status: boolean;
  is_ad_user: boolean;
  manual_user: boolean;
  org_id: string[];
  perspective_id: string[];
  perspective_name: string[];
}
// add alongside PerspectiveOption
interface PerspectiveApiItem {
  id: number;
  name: string;
  org_id: string;
  perspective_ids: string; // this is what gets saved as perspective_id
  description?: string;
  icon?: string;
  platform?: string;
  org_name?: string;
  updated_at?: string;
  created_at?: string;
  entity_id?: string | null;
}
export type UserFormSubmitPayload = Omit<UserFormData, 'perspective_id' | 'perspective_name'> & {
  perspective_ids: string[];
  perspective_names: string[];
};

type DevicePermission = 'access' | 'no_access';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const serializeUserFormSnapshot = (data: UserFormData): string => {
  const snapshot: Record<string, unknown> = {
    username: data.username,
    first_name: data.first_name,
    last_name: data.last_name,
    employee_id: data.employee_id,
    email: data.email,
    application_id: [...data.application_id].map(String).sort(),
    algo_role: [...data.algo_role].map(String).sort(),
    status: data.status,
    is_ad_user: data.is_ad_user,
    manual_user: data.manual_user,
    org_id: [...data.org_id].map(String).sort(),
    perspective_id: [...data.perspective_id].map(String).sort(),
    perspective_name: [...data.perspective_name].map(String).sort(),
  };
  if (data.password.trim()) snapshot.password = data.password;
  return JSON.stringify(snapshot);
};

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const getDeviceLabel = (row: DeviceInfoRecord): string =>
  asString(row.device_name) || asString(row.deviceName) || asString(row.name) ||
  asString(row.label) || deviceRowId(row) || 'Unnamed device';

const getDeviceDescription = (row: DeviceInfoRecord): string | undefined => {
  const type = asString(row.device_type) || asString(row.type);
  const location = asString(row.location_name);
  if (type && location) return `${type} · ${location}`;
  return type || location || asString(row.deviceProfileName) || undefined;
};

// ─── Perspective option type ──────────────────────────────────────────────────

interface PerspectiveOption {
  value: string;
  label: string;
  name: string;
}

// ─── Main UserForm ─────────────────────────────────────────────────────────────

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormSubmitPayload) => void;
  mode: 'create' | 'edit';
  initialData?: User | null;
}

export const UserForm: React.FC<UserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialData,
}) => {
  const [formData, setFormData] = useState<UserFormData>({
    username: '', first_name: '', last_name: '', application_id: [],
    employee_id: '', email: '', password: '', algo_role: [],
    status: false, is_ad_user: false, manual_user: false,
    org_id: [], perspective_id: [], perspective_name: [],
  });
  const runOnce = useRef(false);
  const { currentUser } = useRbacStore();
  const userOrgIds = currentUser?.organizationIds || [];

  const organizationsApi = useApiCrud<Organization>({
    getAll: () => getAllOrganizationsApi(userOrgIds, currentUser?.role),
  });

  const [errors, setErrors] = useState<Partial<UserFormData>>({});
  const [roles, setRoles] = useState([]);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [formPanelCollapsed, setFormPanelCollapsed] = useState(true);

  // ── Perspective state ────────────────────────────────────────────────────────
  const [perspectiveOptions, setPerspectiveOptions] = useState<PerspectiveOption[]>([]);
  const [perspectiveLoading, setPerspectiveLoading] = useState(false);

  const [locationDevices, setLocationDevices] = useState<DeviceListItem[]>([]);
  const [locationDevicesLoading, setLocationDevicesLoading] = useState(false);
  const [aclEntries, setAclEntries] = useState<UserAclEntry[]>([]);
  const aclEntriesRef = useRef<UserAclEntry[]>([]);
  const aclPersistInFlightRef = useRef(false);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [checkedLocationIds, setCheckedLocationIds] = useState<Set<string>>(new Set());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sensorRows, setSensorRows] = useState<SensorRow[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);

  const [devicePermissions, setDevicePermissions] = useState<DevicePermissionState>({});
  const [sensorPermissions, setSensorPermissions] = useState<SensorPermissionState>({});

  const getRoles = async () => {
    try {
      const role = await getAllRolesApi();
      setRoles(role.data);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load roles'));
    }
  };

  const loadOrganizationsRef = useRef(organizationsApi.loadAll);
  loadOrganizationsRef.current = organizationsApi.loadAll;

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;
    void loadOrganizationsRef.current();
  }, []);

  const roleOptions = useMemo(() => {
    const base = [{ value: 'Admin', label: 'Admin' }];
    if (Array.isArray(roles)) {
      return base.concat(
        roles.filter((el) => el.name && el.name !== 'Admin').map((el) => ({ value: el.name, label: el.name }))
      );
    }
    return base;
  }, [roles]);

  const { availableOrganizations } = useRbacStore();
  const allOrganizations = useMemo(() => {
    // Combine both sources for safety: availableOrganizations and organizationsApi.data
    const orgSet = new Map<string, { value: string; label: string }>();
    // Add from availableOrganizations first (useRbacStore)
    (availableOrganizations || []).forEach((org: any) => {
      const id = String(org.org_id || org.organization_id);
      const name = org.org_name || org.organization_name || org.organisationName;
      if (id && name) {
        orgSet.set(id, { value: id, label: name });
      }
    });
    // Add from organizationsApi.data
    (organizationsApi.data || []).forEach((el: any) => {
      const id = String(el.org_id || el.organization_id || el.orgId);
      const name = el.org_name || el.organization_name || el.organisationName;
      if (id && name) {
        orgSet.set(id, { value: id, label: name });
      }
    });
    return Array.from(orgSet.values());
  }, [availableOrganizations, organizationsApi.data]);

  const allOrgIds = useMemo(() => allOrganizations.map((o) => o.value), [allOrganizations]);

  const aclUserId = useMemo(
    () => (initialData?.id != null ? String(initialData.id) : ''),
    [initialData?.id],
  );

  const isFormSufficientForPermissions = useMemo(() => {
    const hasUsername = formData.username.trim().length > 0;
    const hasFirstName = formData.first_name.trim().length > 0;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const hasPassword = mode === 'edit' || formData.password.trim().length > 0;
    return hasUsername && hasFirstName && hasEmail && hasPassword;
  }, [formData.username, formData.first_name, formData.email, formData.password, mode]);

  const canAddPermissions = Boolean(aclUserId.trim()) && isFormSufficientForPermissions;

  // ── Fetch perspective options when username changes ───────────────────────────
useEffect(() => {
  const orgIds = formData.org_id;
  if (!orgIds || orgIds.length === 0) {
    setPerspectiveOptions([]);
    setFormData((prev) => ({ ...prev, perspective_id: [], perspective_name: [] }));
    return;
  }

  let cancelled = false;
  const fetchPerspectives = async () => {
    setPerspectiveLoading(true);
    try {
      // Call once per selected org and merge results
      const allItems: PerspectiveApiItem[] = [];

      await Promise.all(
        orgIds.map(async (orgId) => {
          const result = await getPerspectiveOrganizationIds({ org_id: orgId });
          const items: PerspectiveApiItem[] = result?.data?.data ?? [];
          allItems.push(...items);
        }),
      );

      if (cancelled) return;

      // Deduplicate by perspective_ids, since that's the value actually persisted
      const seen = new Set<string>();
      const opts: PerspectiveOption[] = allItems
        .filter((p) => p.name && p.perspective_ids)
        .reduce<PerspectiveOption[]>((acc, p) => {
          const val = String(p.perspective_ids);
          if (!seen.has(val)) {
            seen.add(val);
            acc.push({ value: val, label: p.name, name: p.name });
          }
          return acc;
        }, []);

      setPerspectiveOptions(opts);

      // Re-validate current perspective selections against new options
      setFormData((prev) => {
        const validIds = new Set(opts.map((o) => o.value));
        const filteredIds = prev.perspective_id.filter((id) => validIds.has(id));
        const filteredNames = filteredIds
          .map((id) => opts.find((o) => o.value === id)?.name ?? '')
          .filter(Boolean);
        return {
          ...prev,
          perspective_id: filteredIds,
          perspective_name: filteredNames,
        };
      });
    } catch {
      if (!cancelled) setPerspectiveOptions([]);
    } finally {
      if (!cancelled) setPerspectiveLoading(false);
    }
  };

  void fetchPerspectives();
  return () => {
    cancelled = true;
  };
}, [formData.org_id]);
  // Auto-fill org_id for Admin
  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    if (formData.algo_role?.includes('Admin') && allOrgIds.length > 0 && formData.org_id.length === 0) {
      setFormData((prev) => ({ ...prev, org_id: allOrgIds }));
    }
  }, [isOpen, mode, formData.algo_role, allOrgIds, formData.org_id.length]);

  useEffect(() => {
    if (isOpen) {
      setPermissionsOpen(false);
      setFormPanelCollapsed(false);
      setAclEntries([]);
      setDevicePermissions({});
      setLocations([]);
      setSelectedLocationId(null);
      setCheckedLocationIds(new Set());
      setLocationDevices([]);
      setSelectedDeviceId(null);
      setSensorRows([]);
      setPerspectiveOptions([]);

      if (mode === 'edit' && initialData) {
        const editFormData: UserFormData = {
          username: initialData.username,
          first_name: initialData.first_name,
          last_name: initialData.last_name,
          application_id: initialData.application_id ?? [],
          employee_id: initialData.employee_id,
          email: initialData.email,
          password: '',
          algo_role: initialData.algo_role ?? [],
          status: initialData.status,
          is_ad_user: initialData.is_ad_user,
          manual_user: initialData.manual_user,
          org_id: initialData.org_id ?? [],
          perspective_id:
            initialData.perspective_id?.length
              ? initialData.perspective_id
              : (initialData.perspective_ids ?? []).map(String),
          perspective_name: (initialData.perspective_names ?? []).map(String),
        };
        setFormData(editFormData);
        setInitialFormSnapshot(serializeUserFormSnapshot(editFormData));
      } else {
        setFormData({
          username: '', first_name: '', last_name: '', application_id: [],
          employee_id: '', email: '', password: '', algo_role: [],
          status: false, is_ad_user: false, manual_user: false,
          org_id: [], perspective_id: [], perspective_name: [],
        });
        setInitialFormSnapshot(null);
      }
      setErrors({});
    }
    getRoles();
  }, [isOpen, mode, initialData]);

  useEffect(() => {
    aclEntriesRef.current = aclEntries;
  }, [aclEntries]);

  const applyAclEntriesToUi = useCallback(
    (
      entries: UserAclEntry[],
      locationRows: LocationRecord[],
      opts?: {
        devices?: DeviceListItem[];
        selectedDeviceId?: string | null;
        sensorRows?: SensorRow[];
      },
    ) => {
      const orgAcl = entries.find((e) => e.resource_type === 'Location');
      const deviceAcl = entries.find((e) => e.resource_type === 'Device');
      const sensorAcl =
        entries.find((e) => e.resource_type === 'Sensor') ??
        entries.find((e) => e.resource_type === 'Tag');

      if (orgAcl) {
        if (orgAcl.resource_id.length > 0) {
          setCheckedLocationIds(getCheckedLocationIdsFromAcl(entries, locationRows));
        } else {
          setCheckedLocationIds(new Set());
        }
      }

      if (deviceAcl) {
        setDevicePermissions((prev) => {
          const next = { ...prev };
          const deviceList = opts?.devices ?? [];
          if (deviceAcl.resource_id.length === 0) {
            deviceList.forEach((d) => {
              next[d.id] = 'no_access';
            });
            return next;
          }
          deviceAcl.resource_id.forEach((rid) => {
            const r = rid.trim();
            if (r) next[r] = 'access';
          });
          deviceList.forEach((d) => {
            next[d.id] = deviceAcl.resource_id.some((rid) => deviceMatchesResourceId(d, rid))
              ? 'access'
              : 'no_access';
          });
          deviceAcl.resource_id.forEach((rid) => {
            const match = deviceList.find((d) => deviceMatchesResourceId(d, rid));
            if (match) next[match.id] = 'access';
          });
          return next;
        });
      }

      if (sensorAcl && opts?.selectedDeviceId && opts.sensorRows?.length) {
        const sensorState = buildSensorPermissionsFromAcl(
          sensorAcl.resource_id,
          opts.selectedDeviceId,
          opts.sensorRows,
        );
        setSensorPermissions((prev) => {
          const next = { ...prev };
          opts.sensorRows?.forEach((sensor) => {
            const key = sensorPermissionKey(opts.selectedDeviceId!, sensor.key);
            next[key] = sensorState[key] ?? 'no_access';
          });
          Object.entries(sensorState).forEach(([key, perm]) => {
            if (perm === 'access') next[key] = 'access';
          });
          return next;
        });
      } else if (sensorAcl && sensorAcl.resource_id.length > 0) {
        setSensorPermissions((prev) => {
          const next = { ...prev };
          sensorAcl.resource_id.forEach((id) => {
            const raw = id.trim();
            if (!raw) return;
            if (raw.includes('::')) next[raw] = 'access';
          });
          return next;
        });
      }
    },
    [],
  );

  const fetchDevicesForLocation = useCallback(
    async (location: LocationRecord): Promise<DeviceListItem[]> => {
      const locationId = location.location_id.trim();
      if (!locationId) return [];

      const result = await queryDevices({
        q: buildLocationIdDeviceQuery(locationId),
        skip: 0,
        limit: 100,
      });
      return mapDevicesForPermissions(
        result.data ?? [],
        getDeviceLabel,
        getDeviceDescription,
      );
    },
    [],
  );

  const hydratePermissionsFromAcl = useCallback(
    async (entries: UserAclEntry[], locationRows: LocationRecord[]) => {
      const deviceAcl = entries.find((e) => e.resource_type === 'Device');
      const sensorAcl =
        entries.find((e) => e.resource_type === 'Sensor') ??
        entries.find((e) => e.resource_type === 'Tag');
      const deviceIdHint = resolveDeviceIdHintFromSensorAcl(entries);

      let locationToOpen = resolveLocationToOpenFromAcl(entries, locationRows);

      if (!locationToOpen && (deviceAcl?.resource_id.length || deviceIdHint)) {
        const maxScan = Math.min(locationRows.length, 12);
        for (let i = 0; i < maxScan; i += 1) {
          const loc = locationRows[i];
          if (!loc?.location_id.trim()) continue;
          try {
            const list = await fetchDevicesForLocation(loc);
            const hasMatch =
              list.some((d) =>
                deviceAcl?.resource_id.some((rid) => deviceMatchesResourceId(d, rid)),
              ) ||
              (deviceIdHint && list.some((d) => d.id === deviceIdHint));
            if (hasMatch) {
              locationToOpen = loc;
              break;
            }
          } catch {
            // try next location
          }
        }
      }

      if (!locationToOpen?.location_id.trim()) return;

      setSelectedLocationId(locationToOpen.id);
      setSelectedDeviceId(null);
      setSensorRows([]);

      setLocationDevicesLoading(true);
      try {
        const list = await fetchDevicesForLocation(locationToOpen);
        setLocationDevices(list);
        applyAclEntriesToUi(entries, locationRows, { devices: list });

        const deviceWithAccess =
          (deviceIdHint && list.find((d) => d.id === deviceIdHint)) ??
          list.find((d) =>
            deviceAcl?.resource_id.some((rid) => deviceMatchesResourceId(d, rid)),
          );

        if (!deviceWithAccess) return;

        setSelectedDeviceId(deviceWithAccess.id);
        const rows = parseSensorsFromDevice(deviceWithAccess.raw);
        setSensorRows(rows);
        applyAclEntriesToUi(entries, locationRows, {
          devices: list,
          selectedDeviceId: deviceWithAccess.id,
          sensorRows: rows,
        });

        if (sensorAcl?.resource_id.length) {
          const sensorState = buildSensorPermissionsFromAcl(
            sensorAcl.resource_id,
            deviceWithAccess.id,
            rows,
          );
          setSensorPermissions((prev) => ({ ...prev, ...sensorState }));
        }
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, 'Failed to load devices for saved permissions'));
        setLocationDevices([]);
      } finally {
        setLocationDevicesLoading(false);
      }
    },
    [applyAclEntriesToUi, fetchDevicesForLocation],
  );

  const loadPermissionData = async () => {
    setPermissionsLoading(true);
    try {
      const locationsResult = await getLocationsList({ skip: 0, limit: 500 });
      setLocations(locationsResult.rows);
      setLocationDevices([]);
      setSelectedLocationId(null);
      setSelectedDeviceId(null);
      setSensorRows([]);

      if (aclUserId) {
        const merged = mergeAclEntriesByType(await fetchAllAclEntries(aclUserId));
        setAclEntries(merged);
        aclEntriesRef.current = merged;
        applyAclEntriesToUi(merged, locationsResult.rows);
        await hydratePermissionsFromAcl(merged, locationsResult.rows);
      } else {
        setAclEntries([]);
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load permissions'));
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !permissionsOpen) return;
    void loadPermissionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, permissionsOpen, aclUserId]);

  const loadDevicesForLocation = async (
    location: LocationRecord,
    options?: { autoSelectAclDevice?: boolean },
  ) => {
    const autoSelectAclDevice = options?.autoSelectAclDevice ?? true;
    const locationId = location.location_id.trim();
    if (!locationId) {
      setLocationDevices([]);
      toast.info('This location has no location ID to load devices.');
      return;
    }

    setLocationDevicesLoading(true);
    try {
      const list = await fetchDevicesForLocation(location);
      setLocationDevices(list);
      applyAclEntriesToUi(aclEntriesRef.current, locations, { devices: list });

      const entries = aclEntriesRef.current;
      const deviceAcl = entries.find((e) => e.resource_type === 'Device');
      const deviceIdHint = resolveDeviceIdHintFromSensorAcl(entries);
      const deviceWithAccess =
        (deviceIdHint && list.find((d) => d.id === deviceIdHint)) ??
        list.find((d) =>
          deviceAcl?.resource_id.some((rid) => deviceMatchesResourceId(d, rid)),
        );

      if (autoSelectAclDevice && deviceWithAccess) {
        setSelectedDeviceId(deviceWithAccess.id);
        const rows = parseSensorsFromDevice(deviceWithAccess.raw);
        setSensorRows(rows);
        applyAclEntriesToUi(entries, locations, {
          devices: list,
          selectedDeviceId: deviceWithAccess.id,
          sensorRows: rows,
        });
        const sensorAcl =
          entries.find((e) => e.resource_type === 'Sensor') ??
          entries.find((e) => e.resource_type === 'Tag');
        if (sensorAcl?.resource_id.length) {
          const sensorState = buildSensorPermissionsFromAcl(
            sensorAcl.resource_id,
            deviceWithAccess.id,
            rows,
          );
          setSensorPermissions((prev) => ({ ...prev, ...sensorState }));
        }
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load devices for location'));
      setLocationDevices([]);
    } finally {
      setLocationDevicesLoading(false);
    }
  };

  const handleSelectLocation = (location: LocationRecord) => {
    setSelectedLocationId(location.id);
    setSelectedDeviceId(null);
    setSensorRows([]);
    void loadDevicesForLocation(location);
  };

  const getCheckedLocationResourceIds = useCallback(() => {
    return locations
      .filter((loc) => checkedLocationIds.has(loc.id))
      .map((loc) => loc.location_id.trim())
      .filter(Boolean);
  }, [locations, checkedLocationIds]);

  const persistUserAcls = useCallback(async () => {
    if (!aclUserId) {
      toast.info('Save the user first, then configure permissions.');
      return;
    }
    if (aclPersistInFlightRef.current) return;

    aclPersistInFlightRef.current = true;
    setPermissionsSaving(true);
    try {
      const locationResourceIds = getCheckedLocationResourceIds();
      const deviceIds = Object.entries(devicePermissions)
        .filter(([, perm]) => perm === 'access')
        .map(([id]) => id);
      const sensorIds = [
        ...new Set(
          Object.entries(sensorPermissions)
            .filter(([, perm]) => perm === 'access')
            .map(([key]) => {
              const sep = key.indexOf('::');
              return sep >= 0 ? key.slice(sep + 2) : key;
            })
            .filter(Boolean),
        ),
      ];

      const orgEntry = aclEntries.find((e) => e.resource_type === 'Location');
      const deviceEntry = aclEntries.find((e) => e.resource_type === 'Device');
      const sensorEntry =
        aclEntries.find((e) => e.resource_type === 'Sensor') ??
        aclEntries.find((e) => e.resource_type === 'Tag');
      const sensorResourceType = sensorEntry?.resource_type ?? 'Sensor';

      const nextEntries: UserAclEntry[] = [];
      const savedOrg = await saveUserAclForType(
        aclUserId,
        orgEntry,
        'Location',
        locationResourceIds,
      );
      if (savedOrg) nextEntries.push(savedOrg);

      const savedDevice = await saveUserAclForType(
        aclUserId,
        deviceEntry,
        'Device',
        deviceIds,
      );
      if (savedDevice) nextEntries.push(savedDevice);

      const savedSensor = await saveUserAclForType(
        aclUserId,
        sensorEntry,
        sensorResourceType,
        sensorIds,
      );
      if (savedSensor) nextEntries.push(savedSensor);

      const refreshedAll = await fetchAllAclEntries(aclUserId);
      const refreshed = mergeAclEntriesByType(
        refreshedAll.length > 0 ? refreshedAll : nextEntries,
      );
      setAclEntries(refreshed);
      applyAclEntriesToUi(refreshed, locations, {
        devices: locationDevices,
        selectedDeviceId,
        sensorRows,
      });
      toast.success('Permissions saved');
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to save permissions'));
    } finally {
      aclPersistInFlightRef.current = false;
      setPermissionsSaving(false);
    }
  }, [
    aclUserId,
    aclEntries,
    devicePermissions,
    sensorPermissions,
    getCheckedLocationResourceIds,
    locations,
    locationDevices,
    selectedDeviceId,
    sensorRows,
    applyAclEntriesToUi,
  ]);

  const handleToggleLocationCheck = (locationId: string, checked: boolean) => {
    setCheckedLocationIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(locationId);
      else next.delete(locationId);
      return next;
    });
  };

  const handleDevicePermissionChange = (deviceId: string, perm: DevicePermission) => {
    setDevicePermissions((prev) => ({ ...prev, [deviceId]: perm }));
  };

  const handleSensorPermissionChange = (
    deviceId: string,
    sensorKey: string,
    perm: DevicePermission,
  ) => {
    const key = sensorPermissionKey(deviceId, sensorKey);
    setSensorPermissions((prev) => ({ ...prev, [key]: perm }));
  };

  const handleTogglePermissionsOpen = () => {
    if (!aclUserId.trim()) {
      toast.info('Create the user first, then add permissions.');
      return;
    }
    setPermissionsOpen((prev) => {
      const next = !prev;
      if (next) {
        setFormPanelCollapsed(true);
      } else {
        setFormPanelCollapsed(false);
      }
      return next;
    });
  };

  const handleSavePermissions = () => {
    // Do nothing: APIs are not integrated yet
    toast.info('Permissions needs to be implemented');
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    const device = locationDevices.find((d) => d.id === deviceId);
    const rows = device ? parseSensorsFromDevice(device.raw) : [];
    setSensorRows(rows);
    setSensorsLoading(false);
    applyAclEntriesToUi(aclEntriesRef.current, locations, {
      devices: locationDevices,
      selectedDeviceId: deviceId,
      sensorRows: rows,
    });
  };

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof UserFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<UserFormData> = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (mode === 'create' && !formData.password.trim()) newErrors.password = 'Password is required for new users';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const { perspective_id, perspective_name, ...rest } = formData;
      onSubmit({
        ...rest,
        org_id: (formData.org_id || []).map(String),
        perspective_ids: (perspective_id || []).map(String),
        perspective_names: (perspective_name || []).map(String),
        algo_role: (formData.algo_role || []).map(String),
        application_id: (formData.application_id || []).map(String),
      });
    }
  };

  const handleMultiSelectChange = (field: 'algo_role' | 'org_id', value: any[]) => {
    const sanitized: string[] = (value || []).map((v: any) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && 'value' in v) return String(v.value);
      return String(v);
    });
    setFormData((prev) => ({ ...prev, [field]: sanitized }));
    if (field === 'algo_role' && mode === 'create') {
      const hasAdmin = sanitized.includes('Admin');
      if (hasAdmin && allOrgIds.length > 0) {
        setTimeout(() => {
          setFormData((prev) => {
            if (prev.org_id?.length > 0) return prev;
            return { ...prev, org_id: allOrgIds };
          });
        }, 0);
      }
    }
  };

  const handlePerspectiveChange = (value: any[]) => {
    const sanitized = (value || []).map((v: any) =>
      typeof v === 'string' ? v : String(v?.value ?? v)
    );
    const names = sanitized
      .map((id) => perspectiveOptions.find((o) => o.value === id)?.name ?? '')
      .filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      perspective_id: sanitized,
      perspective_name: names,
    }));
  };

  const currentFormSnapshot = useMemo(() => serializeUserFormSnapshot(formData), [formData]);
  const hasFormChanges = mode !== 'edit' || initialFormSnapshot === null || currentFormSnapshot !== initialFormSnapshot;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`${permissionsOpen ? 'max-w-[98vw] min-w-[72rem]' : 'max-w-4xl min-w-[55rem]'} max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <DialogTitle className="truncate">
                {mode === 'create' ? 'Add New User' : 'Edit User'}
              </DialogTitle>
              {permissionsOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0 p-0 text-xs"
                  onClick={() => setFormPanelCollapsed((prev) => !prev)}
                  title={formPanelCollapsed ? 'Show user details' : 'Hide user details'}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              {permissionsOpen && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 h-8 px-3 text-xs"
                  disabled={permissionsLoading || permissionsSaving || !aclUserId}
                  onClick={() => void handleSavePermissions()}
                  title={!aclUserId ? 'Create the user before saving permissions' : undefined}
                >
                  {permissionsSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              )}
              <Button
                type="button"
                variant={permissionsOpen ? 'default' : 'outline'}
                size="sm"
                className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canAddPermissions}
                onClick={handleTogglePermissionsOpen}
                title={
                  !aclUserId.trim()
                    ? 'Create the user first to add permissions'
                    : !isFormSufficientForPermissions
                      ? 'Please fill in Username, First Name, Email and Password first'
                      : undefined
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {permissionsOpen ? 'Hide Permissions' : 'Add Permissions'}
              </Button>
              {!canAddPermissions && (
                <p className="absolute right-0 top-full mt-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap z-10 shadow-sm">
                  {!aclUserId.trim()
                    ? 'Create user first to enable permissions'
                    : 'Fill required fields to enable'}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div
            className={
              permissionsOpen
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'min-h-0 flex-1 overflow-y-auto'
            }
          >
            <div
              className={
                permissionsOpen
                  ? `relative grid h-full min-h-0 flex-1 gap-2 overflow-hidden transition-[grid-template-columns] duration-200 ${
                      formPanelCollapsed
                        ? 'lg:grid-cols-[1fr]'
                        : 'lg:grid-cols-[minmax(280px,2.1fr)_minmax(0,1.9fr)]'
                    }`
                  : ''
              }
            >
              {/* ── Left: User form fields ── */}
              {(!permissionsOpen || !formPanelCollapsed) && (
                <div className="space-y-6 overflow-y-auto py-2 pr-2 scrollbar-thin min-h-0">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        placeholder="Enter username"
                        className={`w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.username && <p className="text-sm text-red-500">{errors.username}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange('first_name', e.target.value)}
                        placeholder="Enter first name"
                        className={`w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors ${errors.first_name ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.first_name && <p className="text-sm text-red-500">{errors.first_name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange('last_name', e.target.value)}
                        placeholder="Enter last name"
                        className="w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors border-gray-300"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employee_id">Employee ID</Label>
                      <Input
                        id="employee_id"
                        value={formData.employee_id}
                        onChange={(e) => handleInputChange('employee_id', e.target.value)}
                        placeholder="Enter employee ID"
                        className="w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors border-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="Enter email address"
                        className={`w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password {mode === 'create' && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Enter Password"
                        className={`w-full p-3 border text-sm rounded-lg focus:ring-2 transition-colors ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                    </div>
                  </div>

                  {/* Row 3: Role + Organization + Perspective IDs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputMultiDropdown
                      name="algo_role"
                      displayName="Role"
                      placeholder="Select roles"
                      options={roleOptions}
                      value={formData.algo_role}
                      onChange={(value) => handleMultiSelectChange('algo_role', value)}
                    />
                    <InputMultiDropdown
                      name="org_id"
                      displayName="Organization ID"
                      placeholder="Select organizations"
                      options={allOrganizations}
                      value={formData.org_id}
                      onChange={(value) => handleMultiSelectChange('org_id', value)}
                    />
                    <div className="relative">
                      <InputMultiDropdown
                        name="perspective_id"
                        displayName="Perspective IDs"
                        placeholder={
                          perspectiveLoading
                            ? 'Loading…'
                            : perspectiveOptions.length === 0
                              ? 'Enter username to load'
                              : 'Select perspectives'
                        }
                        options={perspectiveOptions}
                        value={formData.perspective_id}
                        onChange={handlePerspectiveChange}
                      />
                      {perspectiveLoading && (
                        <Loader2 className="absolute right-8 top-9 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />
                      )}
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="status" checked={formData.status} onCheckedChange={(c) => handleInputChange('status', c === true)} />
                      <Label htmlFor="status">Active Status</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="is_ad_user" checked={formData.is_ad_user} onCheckedChange={(c) => handleInputChange('is_ad_user', c === true)} />
                      <Label htmlFor="is_ad_user">Is AD User</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="manual_user" checked={formData.manual_user} onCheckedChange={(c) => handleInputChange('manual_user', c === true)} />
                      <Label htmlFor="manual_user">Manual User</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Right: Locations → Devices → Sensors ── */}
              {permissionsOpen && (
                <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                  <button
                    type="button"
                    aria-label={formPanelCollapsed ? 'Show user details' : 'Hide user details'}
                    title={formPanelCollapsed ? 'Show user details' : 'Hide user details'}
                    onClick={() => setFormPanelCollapsed((prev) => !prev)}
                    className={cn(
                      'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear sm:flex',
                      'after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-border',
                      formPanelCollapsed ? 'left-0 cursor-e-resize' : 'left-0 cursor-w-resize',
                    )}
                  />
                  <UserPermissionsPanel
                    locations={locations}
                    devices={locationDevices}
                    devicePermissions={devicePermissions}
                    onPermissionChange={handleDevicePermissionChange}
                    checkedLocationIds={checkedLocationIds}
                    onToggleLocationCheck={handleToggleLocationCheck}
                    selectedLocationId={selectedLocationId}
                    onSelectLocation={handleSelectLocation}
                    selectedDeviceId={selectedDeviceId}
                    onSelectDevice={handleSelectDevice}
                    sensors={sensorRows}
                    sensorPermissions={sensorPermissions}
                    onSensorPermissionChange={handleSensorPermissionChange}
                    sensorsLoading={sensorsLoading}
                    locationDevicesLoading={locationDevicesLoading}
                    loading={permissionsLoading}
                    aclUserId={aclUserId}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 sm:justify-end pt-4 flex-shrink-0 border-t border-border/60 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="default"
              disabled={mode === 'edit' && !hasFormChanges}
              className="disabled:cursor-not-allowed"
            >
              {mode === 'create' ? 'Create User' : 'Update User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
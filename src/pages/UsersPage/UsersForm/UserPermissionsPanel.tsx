import React, { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { LocationRecord } from '@/controllers/API/locationsApi';
import type { UserAclEntry } from '@/controllers/API/userAclApi';
import type { DeviceInfoRecord } from '@/controllers/API/devicesApi';
import { deviceRowId } from '@/controllers/API/devicesApi';
import {
  Activity,
  ChevronRight,
  Cpu,
  Info,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DevicePermission = 'access' | 'no_access';

export type DevicePermissionState = Record<string, DevicePermission>;
export type SensorPermissionState = Record<string, DevicePermission>;

export function sensorPermissionKey(deviceId: string, sensorKey: string): string {
  return `${deviceId}::${sensorKey}`;
}

export function locationMatchesAclResource(loc: LocationRecord, resourceId: string): boolean {
  const rid = resourceId.trim().toLowerCase();
  if (!rid) return false;
  const candidates = [
    loc.id,
    loc.location_id,
    loc.sap_id,
    loc.name,
    loc.business_unit,
  ]
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);
  return candidates.includes(rid);
}

export function getCheckedLocationIdsFromAcl(
  entries: UserAclEntry[],
  locationRows: LocationRecord[],
): Set<string> {
  const orgAcl = entries.find((e) => e.resource_type === 'Location');
  if (!orgAcl?.resource_id.length) return new Set();

  const checked = new Set<string>();
  locationRows.forEach((loc) => {
    const matched = orgAcl.resource_id.some((rid) => locationMatchesAclResource(loc, rid));
    if (matched) checked.add(loc.id);
  });
  return checked;
}

/** First location row to open for devices (checked ACL location, or inferred from ACL). */
export function resolveLocationToOpenFromAcl(
  entries: UserAclEntry[],
  locationRows: LocationRecord[],
): LocationRecord | null {
  const checked = getCheckedLocationIdsFromAcl(entries, locationRows);
  const fromChecked = locationRows.find((l) => checked.has(l.id));
  if (fromChecked) return fromChecked;

  const deviceAcl = entries.find((e) => e.resource_type === 'Device');
  if (deviceAcl?.resource_id.length) {
    for (const loc of locationRows) {
      if (deviceAcl.resource_id.some((rid) => locationMatchesAclResource(loc, rid))) {
        return loc;
      }
    }
  }

  return locationRows.find((l) => l.location_id.trim()) ?? null;
}

export function resolveDeviceIdHintFromSensorAcl(entries: UserAclEntry[]): string | null {
  const sensorAcl =
    entries.find((e) => e.resource_type === 'Sensor') ??
    entries.find((e) => e.resource_type === 'Tag');
  if (!sensorAcl) return null;
  for (const id of sensorAcl.resource_id) {
    const raw = id.trim();
    if (!raw.includes('::')) continue;
    const deviceId = raw.split('::')[0]?.trim();
    if (deviceId) return deviceId;
  }
  return null;
}

export function deviceMatchesResourceId(
  device: { id: string; raw: DeviceInfoRecord },
  resourceId: string,
): boolean {
  const rid = resourceId.trim().toLowerCase();
  if (!rid) return false;
  const candidates = [
    device.id,
    deviceRowId(device.raw),
    asString(device.raw.device_id),
    asString(device.raw.device_key),
    asString(device.raw.id),
  ]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return candidates.includes(rid);
}

export function buildSensorPermissionsFromAcl(
  resourceIds: string[],
  deviceId: string,
  sensors: SensorRow[],
): SensorPermissionState {
  const allowed = new Set(resourceIds.map((id) => id.trim().toLowerCase()).filter(Boolean));
  const next: SensorPermissionState = {};

  sensors.forEach((sensor) => {
    const key = sensorPermissionKey(deviceId, sensor.key);
    const tag = sensor.sensor_tag.trim().toLowerCase();
    const composite = key.toLowerCase();
    const matched =
      allowed.has(tag) ||
      allowed.has(composite) ||
      allowed.has(sensor.key.trim().toLowerCase()) ||
      [...allowed].some(
        (a) => a === composite || a.endsWith(`::${tag}`) || composite.endsWith(`::${a}`),
      );
    if (matched) next[key] = 'access';
  });

  resourceIds.forEach((id) => {
    const raw = id.trim();
    if (!raw) return;
    if (raw.includes('::')) {
      next[raw] = 'access';
      return;
    }
    if (deviceId) next[sensorPermissionKey(deviceId, raw)] = 'access';
  });

  return next;
}

export type SensorRow = {
  /** Permission key — `sensor_tag`. */
  key: string;
  sensor_name: string;
  sensor_type: string;
  sensor_tag: string;
};

export type DeviceListItem = {
  id: string;
  label: string;
  description?: string;
  raw: DeviceInfoRecord;
};

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

function getDeviceLocationTokens(device: DeviceInfoRecord): string[] {
  const tokens = new Set<string>();
  const add = (v: unknown) => {
    const s = asString(v).trim().toLowerCase();
    if (s) tokens.add(s);
  };

  add(device.location_id);
  add(device.locationId);
  add(device.location_name);
  add(device.locationName);
  add(device.name);
  add(device.device_name);
  add(device.deviceName);
  add(device.label);

  const info = device.additionalInfo;
  if (info && typeof info === 'object' && !Array.isArray(info)) {
    const nested = info as Record<string, unknown>;
    add(nested.location_id);
    add(nested.locationId);
    add(nested.location_name);
    add(nested.locationName);
  }

  return Array.from(tokens);
}

export function deviceMatchesLocation(device: DeviceInfoRecord, location: LocationRecord): boolean {
  const deviceTokens = getDeviceLocationTokens(device);
  const locationKeys = [
    location.id.trim().toLowerCase(),
    location.location_id.trim().toLowerCase(),
    location.name.trim().toLowerCase(),
    location.business_unit.trim().toLowerCase(),
  ].filter(Boolean);

  if (locationKeys.some((key) => deviceTokens.includes(key))) {
    return true;
  }

  const haystack = JSON.stringify(device).toLowerCase();
  return locationKeys.some((key) => key.length > 1 && haystack.includes(key));
}

export function filterDevicesForLocation(
  allDevices: DeviceListItem[],
  location: LocationRecord,
): DeviceListItem[] {
  const matched = allDevices.filter((d) => deviceMatchesLocation(d.raw, location));
  if (matched.length > 0) return matched;

  const needle = (location.location_id || location.name || location.id).trim().toLowerCase();
  if (!needle) return [];

  return allDevices.filter((d) => {
    const label = d.label.toLowerCase();
    const desc = (d.description ?? '').toLowerCase();
    return label.includes(needle) || desc.includes(needle);
  });
}

function PanelSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border/60 last:border-r-0', className)}>
      <div className="flex-shrink-0 border-b border-border/60 px-3 py-2.5 bg-muted/5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
}

function ListEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

type UserPermissionsPanelProps = {
  locations: LocationRecord[];
  devices: DeviceListItem[];
  devicePermissions: DevicePermissionState;
  onPermissionChange: (deviceId: string, permission: DevicePermission) => void;
  checkedLocationIds: Set<string>;
  onToggleLocationCheck: (locationId: string, checked: boolean) => void;
  selectedLocationId: string | null;
  onSelectLocation: (location: LocationRecord) => void;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  sensors: SensorRow[];
  sensorPermissions: SensorPermissionState;
  onSensorPermissionChange: (deviceId: string, sensorKey: string, permission: DevicePermission) => void;
  sensorsLoading: boolean;
  locationDevicesLoading: boolean;
  loading: boolean;
  aclUserId: string;
};

export function UserPermissionsPanel({
  locations,
  devices,
  devicePermissions,
  onPermissionChange,
  checkedLocationIds,
  onToggleLocationCheck,
  selectedLocationId,
  onSelectLocation,
  selectedDeviceId,
  onSelectDevice,
  sensors,
  sensorPermissions,
  onSensorPermissionChange,
  sensorsLoading,
  locationDevicesLoading,
  loading,
  aclUserId,
}: UserPermissionsPanelProps) {
  const [locationSearch, setLocationSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [sensorSearch, setSensorSearch] = useState('');

  const filteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.location_id.toLowerCase().includes(q) ||
        loc.business_unit.toLowerCase().includes(q),
    );
  }, [locations, locationSearch]);

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false),
    );
  }, [devices, deviceSearch]);

  const filteredSensors = useMemo(() => {
    const q = sensorSearch.trim().toLowerCase();
    if (!q) return sensors;
    return sensors.filter(
      (s) =>
        s.sensor_name.toLowerCase().includes(q) ||
        s.sensor_type.toLowerCase().includes(q) ||
        s.sensor_tag.toLowerCase().includes(q),
    );
  }, [sensors, sensorSearch]);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="z-10 shrink-0 border-b border-border/60 bg-card px-4 py-3">
        <p className="text-sm font-bold text-foreground">Location & Device Permissions</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Check locations, devices, and sensors to grant access. Click Save Changes to persist ACLs for this user.
        </p>
      </div>

      {!aclUserId && (
        <div className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
          <Info className="h-3.5 w-3.5 text-amber-500" />
          Create the user first to enable permission management.
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PanelSection title="Locations" icon={MapPin}>
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search locations..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading locations...</span>
            </div>
          ) : filteredLocations.length === 0 ? (
            <ListEmpty message="No locations found." />
          ) : (
            <div className="space-y-1 p-2">
              {filteredLocations.map((loc) => {
                const isActive = selectedLocationId === loc.id;
                const isChecked = checkedLocationIds.has(loc.id);
                return (
                  <div
                    key={loc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLocation(loc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectLocation(loc);
                      }
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                      isActive
                        ? 'bg-blue-50/30 border-blue-200'
                        : 'border-border/50 hover:border-blue-200 hover:bg-muted/5',
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(c) => onToggleLocationCheck(loc.id, c === true)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0"
                    />
                    <MapPin className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-blue-600' : 'text-muted-foreground')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] truncate', isActive ? 'font-bold text-blue-900' : 'font-medium text-foreground')}>
                        {loc.name}
                      </p>
                      {loc.location_id ? (
                        <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{loc.location_id}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Devices" icon={Cpu}>
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder="Search devices..."
                disabled={!selectedLocationId}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              />
            </div>
          </div>
          {!selectedLocationId ? (
            <ListEmpty message="Select a location to view devices." />
          ) : loading || locationDevicesLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading devices...</span>
            </div>
          ) : filteredDevices.length === 0 ? (
            <ListEmpty message="No devices for this location." />
          ) : (
            <div className="space-y-1 p-2">
              {filteredDevices.map((device) => {
                const isActive = selectedDeviceId === device.id;
                const hasAccess = devicePermissions[device.id] === 'access';
                return (
                  <div
                    key={device.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors cursor-pointer',
                      isActive
                        ? 'bg-blue-50/30 border-blue-200'
                        : 'border-border/50 hover:border-blue-200 hover:bg-muted/5',
                    )}
                    onClick={() => onSelectDevice(device.id)}
                  >
                    <Checkbox
                      checked={hasAccess}
                      onCheckedChange={(c) =>
                        onPermissionChange(device.id, c ? 'access' : 'no_access')
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] truncate', isActive ? 'font-bold text-blue-900' : 'font-medium text-foreground')}>
                        {device.label}
                      </p>
                      {device.description ? (
                        <p className="text-[10px] text-muted-foreground truncate">{device.description}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Sensors" icon={Activity} className="min-w-[200px]">
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={sensorSearch}
                onChange={(e) => setSensorSearch(e.target.value)}
                placeholder="Search sensors..."
                disabled={!selectedDeviceId}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              />
            </div>
          </div>
          {!selectedDeviceId ? (
            <ListEmpty message="Select a device to view sensors." />
          ) : sensorsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading sensors...</span>
            </div>
          ) : filteredSensors.length === 0 ? (
            <ListEmpty message="No sensors found for this device." />
          ) : (
            <div className="space-y-1 p-2">
              {filteredSensors.map((sensor) => {
                if (!selectedDeviceId) return null;
                const permKey = sensorPermissionKey(selectedDeviceId, sensor.key);
                const hasAccess = sensorPermissions[permKey] === 'access';
                return (
                  <div
                    key={sensor.key}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2"
                  >
                    <Checkbox
                      checked={hasAccess}
                      onCheckedChange={(c) =>
                        onSensorPermissionChange(
                          selectedDeviceId,
                          sensor.key,
                          c ? 'access' : 'no_access',
                        )
                      }
                      className="h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{sensor.sensor_name}</p>
                      <p className="text-[10px] text-muted-foreground/80 truncate font-mono mt-0.5">
                        {sensor.sensor_tag}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>
      </div>

      {(selectedLocation || selectedDevice) && (
        <div className="flex-shrink-0 border-t border-border/60 bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {selectedLocation ? (
            <span>
              <span className="font-semibold text-foreground">Location:</span> {selectedLocation.name}
            </span>
          ) : null}
          {selectedDevice ? (
            <span>
              <span className="font-semibold text-foreground">Device:</span> {selectedDevice.label}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function mapDevicesForPermissions(
  rows: DeviceInfoRecord[],
  getLabel: (row: DeviceInfoRecord) => string,
  getDescription: (row: DeviceInfoRecord) => string | undefined,
): DeviceListItem[] {
  return rows.flatMap((raw) => {
    const id = deviceRowId(raw);
    if (!id) return [];

    const item: DeviceListItem = {
      id,
      label: getLabel(raw),
      raw,
    };
    const description = getDescription(raw);
    if (description !== undefined && description !== '') {
      item.description = description;
    }
    return [item];
  });
}

/** Sensors from device API `sensor_map.sensors` on each device row. */
export function parseSensorsFromDevice(raw: DeviceInfoRecord): SensorRow[] {
  const sensorMap = raw.sensor_map;
  if (!sensorMap || typeof sensorMap !== 'object' || Array.isArray(sensorMap)) return [];
  const sensors = (sensorMap as Record<string, unknown>).sensors;
  if (!Array.isArray(sensors)) return [];

  const seen = new Set<string>();
  const rows: SensorRow[] = [];
  sensors.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const sensor_tag = asString(row.sensor_tag) || `sensor-${index + 1}`;
    if (seen.has(sensor_tag)) return;
    seen.add(sensor_tag);
    rows.push({
      key: sensor_tag,
      sensor_tag,
      sensor_name: asString(row.sensor_name) || sensor_tag,
      sensor_type: asString(row.sensor_type) || '—',
    });
  });
  return rows;
}

export function parseTelemetrySensors(raw: unknown): SensorRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const root = raw as Record<string, unknown>;
  const payload =
    (root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? root.data
      : null) ??
    (root.payload && typeof root.payload === 'object' && !Array.isArray(root.payload)
      ? root.payload
      : null) ??
    raw;

  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const tag = asString(row.key) || `sensor-${index + 1}`;
      return {
        key: tag,
        sensor_tag: tag,
        sensor_name: tag,
        sensor_type: '—',
      };
    });
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload as Record<string, unknown>).map(([key]) => ({
      key,
      sensor_tag: key,
      sensor_name: key,
      sensor_type: '—',
    }));
  }

  return [];
}

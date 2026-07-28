import axios, { type AxiosInstance, isAxiosError } from "axios";

import { API_BASE_URL } from "./api";
import { generateNextLocationId } from "./locationsApi";
import { assertBlobNotApiError, rethrowApiError } from "@/utils/exceptionHelper";

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.set("authentication", token);
  }
  return config;
});

function toErr(e: unknown): string {
  if (isAxiosError(e)) {
    const d = e.response?.data;
    if (d && typeof d === "object" && "detail" in d) {
      return String((d as { detail: unknown }).detail);
    }
    if (typeof d === "string" && d.trim()) return d;
    return e.message;
  }
  return e instanceof Error ? e.message : "Request failed";
}

export type LocationOption = {
  id: string;
  name: string;
  business_unit?: string;
  value?: string;
  label?: string;
  [key: string]: unknown;
};

function normalizeLocationOption(raw: Record<string, unknown>): LocationOption {
  const value = String(raw.value ?? raw.id ?? raw._id ?? raw.uuid ?? "").trim();
  const label = String(raw.label ?? raw.name ?? raw.locationName ?? "").trim();
  const id = value || "—";
  const name = label || "—";
  const business_unit = String(raw.business_unit ?? raw.businessUnit ?? "").trim();
  
  return {
    id,
    name,
    business_unit,
    value,
    label,
    ...raw,
  };
}

function extractLocationOptionsArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const inner = root.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[];
    if (Array.isArray(inner.locations)) return inner.locations as Record<string, unknown>[];
    if (Array.isArray(inner.options)) return inner.options as Record<string, unknown>[];
  }
  if (Array.isArray(root.locations)) return root.locations as Record<string, unknown>[];
  if (Array.isArray(root.options)) return root.options as Record<string, unknown>[];
  return [];
}

export type EnergySetup = {
  id: number;
  domain: string;
  sub_domain: string;
  location: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
  [key: string]: unknown;
};

export async function getLocationOptions(): Promise<LocationOption[]> {
  try {
    const { data } = await client.post<unknown>("/energy-sector/get-location-options", {});
    const arr = extractLocationOptionsArray(data);
    const locations = arr.map((item) => normalizeLocationOption(item));
    return locations;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function getAllEnergySetups(): Promise<{ data: EnergySetup[] }> {
  try {
    const { data } = await client.post<unknown>("/energy-sector/get-all-energy-sector", {});
    const arr = Array.isArray(data) ? data : (data as any)?.data || [];
    return { data: arr as EnergySetup[] };
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function getAllLocationSetups(location_id: string): Promise<{ data: EnergySetup[] }> {
  try {
    const { data } = await client.post<unknown>('/location-setup/get-all-location-setup', {
      location_id,
    });
    const arr = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
    return { data: arr as EnergySetup[] };
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function createEnergySetup(payload: any): Promise<EnergySetup> {
  try {
    const { data } = await client.post<unknown>("/energy-sector/create-setup", payload);
    return data as EnergySetup;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function updateEnergySetup(id: string, payload: any): Promise<EnergySetup> {
  try {
    const { data } = await client.put<unknown>(`/energy-sector/setup/${id}`, payload);
    return data as EnergySetup;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function deleteEnergySetup(id: string): Promise<unknown> {
  try {
    const { data } = await client.delete<unknown>(`/energy-sector/setup/${id}`);
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export type AssetMasterLocationOption = {
  value?: string;
  label?: string;
  id?: string;
  name?: string;
  [key: string]: unknown;
};

export type DomainOption = {
  value?: string;
  label?: string;
  domain?: string;
  sub_domain?: string;
  [key: string]: unknown;
};

export async function getAssetMasterLocationOptions(): Promise<AssetMasterLocationOption[]> {
  try {
    const { data } = await client.post<unknown>("/energy-sector/get-asset-master-location-options", {});
    const arr = extractLocationOptionsArray(data);
    return arr as AssetMasterLocationOption[];
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export type DeviceTypeData = {
  id: number;
  domain: string;
  sub_domain: string;
  device_type: string;
  device_icon?: string;
  device_code: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
  location: string;
};

export type DeviceTypesResponse = {
  status: boolean;
  location: string;
  domain: string;
  sub_domain: string;
  data: DeviceTypeData[];
};

export async function getAssetsByLocationDomainSubdomain(
  location: string,
  domain: string,
  sub_domain: string,
  active_only: boolean = false
): Promise<DeviceTypesResponse> {
  try {
    const { data } = await client.post<DeviceTypesResponse>("/energy-sector/get-assets-by-location-domain-subdomain", {
      location,
      domain,
      sub_domain,
      active_only,
    });
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export const DEFAULT_ENERGY_DEVICE_TYPES = [
  'Table/Sting',
  'Inverter',
  'PCSS',
  'SMB',
  'UPS',
  'PES',
] as const;

export function resolveSetupAssetScope(
  setup: EnergySetup | null | undefined,
  context?: LocationSetupContext,
): { location: string; domain: string; sub_domain: string } {
  const record = (setup ?? {}) as Record<string, unknown>;
  const { location_name } = resolveLocationSetupFields(setup, context);

  const domain =
    pickScopedString(record, SETUP_DOMAIN_KEYS) ||
    String(context?.domain ?? '').trim() ||
    extractDomainFromHierarchy(setup);

  const sub_domain =
    pickScopedString(record, SETUP_SUB_DOMAIN_KEYS) || String(context?.sub_domain ?? '').trim();

  return {
    location: String(record.location ?? location_name ?? context?.location_name ?? '').trim(),
    domain,
    sub_domain,
  };
}

const setupDeviceTypesResultCache = new Map<string, DeviceTypeData[]>();
const setupDeviceTypesRequestCache = new Map<string, Promise<DeviceTypeData[]>>();
const domainsByLocationResultCache = new Map<string, DomainOptionResponse>();
const domainsByLocationRequestCache = new Map<string, Promise<DomainOptionResponse>>();
const subDomainOptionsResultCache = new Map<string, SubDomainOptionResponse>();
const subDomainOptionsRequestCache = new Map<string, Promise<SubDomainOptionResponse>>();

function buildSetupDeviceTypesRequestKey(
  setup: EnergySetup | null | undefined,
  context?: LocationSetupContext,
): string {
  const scope = resolveSetupAssetScope(setup, context);
  return [
    setup?.id ?? 'new',
    scope.location || context?.location_name || '',
    scope.domain || context?.domain || '',
    scope.sub_domain || context?.sub_domain || '',
  ].join('|');
}

async function loadSetupDeviceTypes(
  setup: EnergySetup | null | undefined,
  context?: LocationSetupContext,
): Promise<DeviceTypeData[]> {
  const scope = resolveSetupAssetScope(setup, context);
  const location = scope.location || context?.location_name || '';
  let domain = scope.domain;
  let sub_domain = scope.sub_domain;

  if (!location) {
    return [];
  }

  if (!domain) {
    try {
      const domainResponse = await getDomainsByLocation(location);
      const firstDomain = domainResponse.data?.[0];
      domain = String(firstDomain?.value ?? firstDomain?.label ?? '').trim();
    } catch {
      return [];
    }
  }

  if (!domain) {
    return [];
  }

  if (!sub_domain) {
    try {
      const subResponse = await getSubDomainOptions(location, domain);
      const firstOption = subResponse.data?.[0];
      sub_domain = String(firstOption?.value ?? firstOption?.label ?? '').trim();
    } catch {
      return [];
    }
  }

  if (!sub_domain) return [];

  const response = await getAssetsByLocationDomainSubdomain(location, domain, sub_domain, false);
  return response.data ?? [];
}

export async function fetchSetupDeviceTypes(
  setup: EnergySetup | null | undefined,
  context?: LocationSetupContext,
): Promise<DeviceTypeData[]> {
  const requestKey = buildSetupDeviceTypesRequestKey(setup, context);

  const cached = setupDeviceTypesResultCache.get(requestKey);
  if (cached) return cached;

  let pending = setupDeviceTypesRequestCache.get(requestKey);
  if (!pending) {
    pending = loadSetupDeviceTypes(setup, context)
      .then((data) => {
        setupDeviceTypesResultCache.set(requestKey, data);
        return data;
      })
      .finally(() => {
        setupDeviceTypesRequestCache.delete(requestKey);
      });
    setupDeviceTypesRequestCache.set(requestKey, pending);
  }

  return pending;
}

export function buildDefaultDeviceTypes(scope: {
  location: string;
  domain: string;
  sub_domain: string;
}): DeviceTypeData[] {
  return DEFAULT_ENERGY_DEVICE_TYPES.map((device_type, index) => ({
    id: index + 1,
    domain: scope.domain,
    sub_domain: scope.sub_domain,
    device_type,
    device_code: device_type.replace(/\//g, '-'),
    description: '',
    display_order: index + 1,
    is_active: true,
    created_by: '',
    updated_by: '',
    created_at: '',
    updated_at: '',
    entity_id: null,
    location: scope.location,
  }));
}

export function extractDeviceTypesFromSetupAssets(assets: unknown): DeviceTypeData[] {
  if (!assets) return [];
  if (Array.isArray(assets)) return assets as DeviceTypeData[];
  if (typeof assets === 'object' && Array.isArray((assets as DeviceTypesResponse).data)) {
    return (assets as DeviceTypesResponse).data;
  }
  return [];
}

export type DomainOptionResponse = {
  status: boolean;
  location: string;
  data: { value: string; label: string }[];
};

export type SubDomainOptionResponse = {
  status: boolean;
  location: string;
  domain: string;
  data: { value: string; label: string }[];
};

export async function getDomainsByLocation(location: string): Promise<DomainOptionResponse> {
  const cacheKey = location.trim();
  const cached = domainsByLocationResultCache.get(cacheKey);
  if (cached) return cached;

  let pending = domainsByLocationRequestCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const { data } = await client.post<DomainOptionResponse>('/energy-sector/get-domains-by-location', {
          location,
        });
        domainsByLocationResultCache.set(cacheKey, data);
        return data;
      } catch (e) {
        throw new Error(toErr(e));
      } finally {
        domainsByLocationRequestCache.delete(cacheKey);
      }
    })();
    domainsByLocationRequestCache.set(cacheKey, pending);
  }

  return pending;
}

export async function getSubDomainOptions(location: string, domain: string): Promise<SubDomainOptionResponse> {
  const cacheKey = `${location.trim()}|${domain.trim()}`;
  const cached = subDomainOptionsResultCache.get(cacheKey);
  if (cached) return cached;

  let pending = subDomainOptionsRequestCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const { data } = await client.post<SubDomainOptionResponse>('/energy-sector/get-sub-domain-options', {
          location,
          domain,
        });
        subDomainOptionsResultCache.set(cacheKey, data);
        return data;
      } catch (e) {
        throw new Error(toErr(e));
      } finally {
        subDomainOptionsRequestCache.delete(cacheKey);
      }
    })();
    subDomainOptionsRequestCache.set(cacheKey, pending);
  }

  return pending;
}

export async function getLocationSetup(id: number | string): Promise<unknown> {
  try {
    const { data } = await client.get<unknown>(`/location-setup/${id}`);
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export type HierarchyNode = {
  unique_id: string;
  name: string;
  type: string;
  child_id?: string;
  position: {
    x: number;
    y: number;
  };
  children?: HierarchyNode[];
  [key: string]: unknown;
};

export type LocationHierarchyPayload = {
  location_id: string;
  location_name: string;
  hierarchy_id: string;
  hierarchy_name: string;
  logo: string;
  description: string;
  hierarchy: HierarchyNode;
  unconnected_nodes: unknown[];
  domain?: string;
  sub_domain?: string;
};

export async function createLocationHierarchy(payload: LocationHierarchyPayload): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>('/location-setup/create-location-hierarchy', payload);
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export type UpdateLocationHierarchyPayload = {
  update_id: string;
  location_id: string;
  location_name: string;
  hierarchy_id: string;
  hierarchy_name: string;
  logo: string;
  description: string;
  hierarchy: HierarchyNode;
  unconnected_nodes: unknown[];
};

export type LocationSetupContext = {
  location_id?: string;
  location_name?: string;
  domain?: string;
  sub_domain?: string;
};

const SETUP_SCOPE_CONTAINER_KEYS = ['scope', 'setup', 'metadata', 'config', 'data', 'details'] as const;

const SETUP_DOMAIN_KEYS = [
  'domain',
  'Domain',
  'device_domain',
  'deviceDomain',
  'energy_domain',
  'energyDomain',
] as const;

const SETUP_SUB_DOMAIN_KEYS = [
  'sub_domain',
  'subDomain',
  'SubDomain',
  'device_sub_domain',
  'deviceSubDomain',
  'subdomain',
  'energy_sub_domain',
  'energySubDomain',
] as const;

function pickScopedString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  for (const containerKey of SETUP_SCOPE_CONTAINER_KEYS) {
    const nested = record[containerKey];
    if (!nested || typeof nested !== 'object') continue;
    for (const key of keys) {
      const value = (nested as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }

  return '';
}

function extractDomainFromHierarchy(setup: EnergySetup | null | undefined): string {
  const hierarchy = (setup as Record<string, unknown> | null | undefined)?.hierarchy;
  if (!hierarchy || typeof hierarchy !== 'object') return '';

  const rootType = String((hierarchy as Record<string, unknown>).type ?? '').trim();
  if (!rootType || rootType.toLowerCase() === 'location') return '';
  return rootType;
}

/** Resolves setup id from create/save API response (e.g. `{ id: 28 }` or `{ location_setup: { id: 28 } }`). */
export function resolveLocationSetupIdFromApiResponse(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const direct =
    record.id ??
    record.update_id ??
    record.updateId ??
    record.setup_id ??
    record.location_setup_id ??
    record._id;

  if (direct != null && String(direct).trim() !== '') return String(direct);

  for (const key of ['location_setup', 'data', 'result', 'setup']) {
    const nested = record[key];
    const resolved = resolveLocationSetupIdFromApiResponse(nested);
    if (resolved) return resolved;
  }

  return null;
}

export function resolveLocationSetupUpdateId(setup: EnergySetup | null | undefined): string | null {
  if (!setup) return null;

  const record = setup as Record<string, unknown>;
  const updateId =
    record.update_id ??
    record.updateId ??
    record.id ??
    record.setup_id ??
    record.location_setup_id ??
    record._id;

  if (updateId == null || String(updateId).trim() === '') return null;
  return String(updateId);
}

export function resolveLocationSetupFields(
  setup: EnergySetup | null | undefined,
  context?: LocationSetupContext,
) {
  const record = (setup ?? {}) as Record<string, unknown>;

  const location_id = String(
    record.location_id ?? record.locationId ?? context?.location_id ?? '',
  ).trim();

  const location_name = String(
    record.location_name ??
      record.location ??
      record.locationName ??
      context?.location_name ??
      '',
  ).trim();

  return { location_id, location_name };
}

export function extractHierarchyIdsFromSetups(setups: EnergySetup[]): string[] {
  const ids = new Set<string>();

  for (const setup of setups) {
    const value = pickHierarchyMetaString(setup as Record<string, unknown>, HIERARCHY_ID_KEYS);
    if (value) ids.add(value);
  }

  return [...ids];
}

export function extractHierarchyNamesFromSetups(setups: EnergySetup[]): string[] {
  const names = new Set<string>();

  for (const setup of setups) {
    const value = pickHierarchyMetaString(setup as Record<string, unknown>, HIERARCHY_NAME_KEYS);
    if (value) names.add(value);
  }

  return [...names];
}

const HIERARCHY_ID_KEYS = ['hierarchy_id', 'hierarchyId', 'hierarchyID'] as const;
const HIERARCHY_NAME_KEYS = ['hierarchy_name', 'hierarchyName'] as const;
const HIERARCHY_META_CONTAINERS = [
  'data',
  'setup',
  'metadata',
  'location_setup',
  'hierarchy_meta',
  'details',
  'result',
] as const;

function pickHierarchyMetaString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  for (const containerKey of HIERARCHY_META_CONTAINERS) {
    const nested = record[containerKey];
    if (!nested || typeof nested !== 'object') continue;

    for (const key of keys) {
      const value = (nested as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }

  return '';
}

function sanitizeHierarchySegment(value: string): string {
  return value.replace(/[/\\]+/g, '').trim();
}

export function buildHierarchyNameBase(locationName: string, nodeNames: string[]): string {
  const locationSegment = sanitizeHierarchySegment(locationName);
  return [locationSegment, ...nodeNames.map(sanitizeHierarchySegment)].filter(Boolean).join('/');
}

export function generateNextHierarchyName(basePath: string, existingNames: string[]): string {
  if (!basePath.trim()) return '';

  const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-(\\d{3})$`, 'i');
  let maxSequence = 0;

  for (const rawName of existingNames) {
    const trimmed = rawName.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase() === basePath.toLowerCase()) {
      maxSequence = Math.max(maxSequence, 1);
    }

    const match = trimmed.match(pattern);
    if (match) {
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1], 10));
    }
  }

  return `${basePath}-${String(maxSequence + 1).padStart(3, '0')}`;
}

/** Next hierarchy id from location id, e.g. THE-001 → THE-001-001, THE-001-002. */
export function generateNextHierarchyId(locationId: string, existingHierarchyIds: string[]): string {
  const prefix = locationId.trim();
  if (!prefix) return '';

  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-(\\d{3})$`, 'i');
  let maxSequence = 0;

  for (const rawId of existingHierarchyIds) {
    const id = rawId.trim();
    if (!id) continue;
    const match = id.match(pattern);
    if (match) {
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1], 10));
    }
  }

  return `${prefix}-${String(maxSequence + 1).padStart(3, '0')}`;
}

/** Builds hierarchy_name (location/node/path-001) and hierarchy_id (e.g. THE-001-001). */
export function resolveHierarchyMeta(
  setup: EnergySetup | null | undefined,
  options?: {
    existingHierarchyIds?: string[];
    existingHierarchyNames?: string[];
    keepExistingId?: boolean;
    locationId?: string;
    locationName?: string;
    nodeNamePath?: string[];
  },
): { hierarchy_id: string; hierarchy_name: string } {
  const record = (setup ?? {}) as Record<string, unknown>;
  const domain = String(record.domain ?? '').trim();
  const subDomain = String(record.sub_domain ?? record.subDomain ?? '').trim();
  const existingId = pickHierarchyMetaString(record, HIERARCHY_ID_KEYS);
  const existingName = pickHierarchyMetaString(record, HIERARCHY_NAME_KEYS);

  const locationName = String(options?.locationName ?? record.location ?? record.location_name ?? '').trim();
  const nodeNamePath = options?.nodeNamePath ?? [];
  const nameBase = buildHierarchyNameBase(locationName, nodeNamePath);

  if (options?.keepExistingId && existingId) {
    return {
      hierarchy_id: existingId,
      hierarchy_name: existingName || (nameBase ? `${nameBase}-001` : subDomain || domain || 'Hierarchy'),
    };
  }

  const existingIds = [...new Set(options?.existingHierarchyIds ?? [])];
  const existingNames = [...new Set(options?.existingHierarchyNames ?? [])];

  if (existingId) existingIds.push(existingId);
  if (existingName) existingNames.push(existingName);

  const hierarchy_name = nameBase
    ? generateNextHierarchyName(nameBase, existingNames)
    : subDomain
      ? `${domain} - ${subDomain}`.trim()
      : domain || 'Hierarchy';

  const locationId = String(
    options?.locationId ?? record.location_id ?? record.locationId ?? '',
  ).trim();

  const hierarchy_id = locationId
    ? generateNextHierarchyId(locationId, existingIds)
    : generateNextLocationId(subDomain || domain || hierarchy_name, existingIds);

  return { hierarchy_id, hierarchy_name };
}

export async function updateLocationHierarchy(payload: UpdateLocationHierarchyPayload): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>('/location-setup/update-location-hierarchy', payload);
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function deleteLocationSetup(update_id: string): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>('/location-setup/delete-location-setup', { update_id });
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export type DeviceInventoryRecord = {
  id?: string | number;
  location_id?: string;
  node_path?: string;
  node_name?: string;
  parent_path?: string;
  hierarchy_node_id?: string;
  client_node_id?: string;
  instance?: number;
  node_type?: string;
  counts?: Record<string, number>;
  created_at?: string;
  updated_at?: string;
  entity_id?: string | null;
  name?: string;
  device_name?: string;
  device_type?: string;
  type?: string;
  description?: string;
  status?: string;
  device_status?: string;
  tags?: string[];
  domain?: string;
  sub_domain?: string;
  [key: string]: unknown;
};

export type DeviceInventoryResponse = {
  status?: boolean;
  location_setup?: unknown;
  device_inventory: DeviceInventoryRecord[];
  count: number;
  summary: Record<string, number>;
};

function parseDeviceInventoryResponse(raw: unknown): DeviceInventoryResponse {
  if (Array.isArray(raw)) {
    return {
      device_inventory: raw as DeviceInventoryRecord[],
      count: raw.length,
      summary: {},
    };
  }

  if (!raw || typeof raw !== 'object') {
    return { device_inventory: [], count: 0, summary: {} };
  }

  const root = raw as Record<string, unknown>;
  const device_inventory = Array.isArray(root.device_inventory)
    ? (root.device_inventory as DeviceInventoryRecord[])
    : Array.isArray(root.data)
      ? (root.data as DeviceInventoryRecord[])
      : [];

  const summary =
    root.summary && typeof root.summary === 'object' && !Array.isArray(root.summary)
      ? (root.summary as Record<string, number>)
      : {};

  return {
    status: typeof root.status === 'boolean' ? root.status : undefined,
    location_setup: root.location_setup,
    device_inventory,
    count: typeof root.count === 'number' ? root.count : device_inventory.length,
    summary,
  };
}

export type OnboardDeviceInventoryInverter = { smbCount: number };

export type OnboardDeviceInventoryPcss = {
  inverters: OnboardDeviceInventoryInverter[];
  transformer: number;
  ups: number;
};

export type OnboardDeviceInventoryPayload = {
  domain: string;
  locationId: string;
  subDomain: string;
  validateAgainstHierarchy: boolean;
  pcssCount: number;
  pess: { transformer: number; ups: number };
  [key: string]: OnboardDeviceInventoryPcss | string | number | boolean | { transformer: number; ups: number };
};

/** Builds onboard payload: domain, locationId, pcss1…n, pcssCount, pess, subDomain, validateAgainstHierarchy. */
export function buildOnboardDeviceInventoryPayload(input: {
  domain: string;
  locationId: string;
  subDomain: string;
  validateAgainstHierarchy: boolean;
  pcssCount: number;
  pcssUnits: OnboardDeviceInventoryPcss[];
  pess: { transformer: number; ups: number };
}): OnboardDeviceInventoryPayload {
  const payload: Record<string, unknown> = {
    domain: input.domain.trim(),
    locationId: input.locationId.trim(),
  };

  input.pcssUnits.slice(0, input.pcssCount).forEach((unit, index) => {
    payload[`pcss${index + 1}`] = {
      inverters: unit.inverters.map((inv) => ({
        smbCount: Number(inv.smbCount) || 0,
      })),
      transformer: Number(unit.transformer) || 0,
      ups: Number(unit.ups) || 0,
    };
  });

  payload.pcssCount = input.pcssCount;
  payload.pess = {
    transformer: Number(input.pess.transformer) || 0,
    ups: Number(input.pess.ups) || 0,
  };
  payload.subDomain = input.subDomain.trim();
  payload.validateAgainstHierarchy = input.validateAgainstHierarchy;

  return payload as OnboardDeviceInventoryPayload;
}

export async function onboardDeviceInventory(
  payload: OnboardDeviceInventoryPayload,
): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>('/location-setup/onboard-device-inventory', payload);
    return data;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

/** `location_id` in the request body is the location display name (not the site code). */
export async function getDeviceInventory(locationName: string): Promise<DeviceInventoryResponse> {
  try {
    const { data } = await client.post<unknown>('/location-setup/get-device-inventory', {
      location_id: locationName,
    });
    return parseDeviceInventoryResponse(data);
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export function normalizeLocationSetupDetails(
  details: unknown,
  fallbackSetup: EnergySetup,
  context?: LocationSetupContext,
): EnergySetup {
  const root =
    details && typeof details === 'object'
      ? ((details as Record<string, unknown>).data ?? details)
      : {};

  const record = root as Record<string, unknown>;
  const resolvedId =
    record.update_id ??
    record.updateId ??
    record.id ??
    record.setup_id ??
    record.location_setup_id ??
    record._id ??
    (fallbackSetup as Record<string, unknown>).update_id ??
    fallbackSetup.id;

  const { location_id: resolvedLocationId, location_name: resolvedLocationName } =
    resolveLocationSetupFields(
      {
        ...fallbackSetup,
        ...(record as EnergySetup),
        location_id: String(record.location_id ?? fallbackSetup.location_id ?? context?.location_id ?? ''),
        location: String(record.location_name ?? record.location ?? fallbackSetup.location ?? context?.location_name ?? ''),
      },
      context,
    );

  return {
    ...fallbackSetup,
    ...(record as EnergySetup),
    id: Number(resolvedId),
    update_id: String(resolvedId ?? ''),
    location_id: resolvedLocationId,
    location: resolvedLocationName || String(fallbackSetup.location ?? ''),
    logo: String(record.logo ?? (fallbackSetup as { logo?: string }).logo ?? ''),
    description: String(record.description ?? (fallbackSetup as { description?: string }).description ?? ''),
    domain:
      pickScopedString(record, SETUP_DOMAIN_KEYS) ||
      pickScopedString(fallbackSetup as Record<string, unknown>, SETUP_DOMAIN_KEYS) ||
      extractDomainFromHierarchy(fallbackSetup),
    sub_domain:
      pickScopedString(record, SETUP_SUB_DOMAIN_KEYS) ||
      pickScopedString(fallbackSetup as Record<string, unknown>, SETUP_SUB_DOMAIN_KEYS),
    hierarchy_id:
      pickHierarchyMetaString(record, HIERARCHY_ID_KEYS) ||
      pickHierarchyMetaString(fallbackSetup as Record<string, unknown>, HIERARCHY_ID_KEYS),
    hierarchy_name:
      pickHierarchyMetaString(record, HIERARCHY_NAME_KEYS) ||
      pickHierarchyMetaString(fallbackSetup as Record<string, unknown>, HIERARCHY_NAME_KEYS),
    hierarchy: (record.hierarchy ?? (fallbackSetup as { hierarchy?: unknown }).hierarchy) as EnergySetup['hierarchy'],
    unconnected_nodes:
      record.unconnected_nodes ?? (fallbackSetup as { unconnected_nodes?: unknown[] }).unconnected_nodes,
  } as EnergySetup;
}

export type DownloadLocationSetupPayload = {
  id: string;
  file_format: 'json' | 'csv' | string;
};

function filenameFromContentDisposition(cd: string | undefined): string | undefined {
  if (!cd || typeof cd !== 'string') return undefined;
  const match = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(cd);
  const rawName = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!rawName) return undefined;
  try {
    return decodeURIComponent(rawName.replace(/["']/g, '').trim());
  } catch {
    return rawName.replace(/["']/g, '').trim();
  }
}

export async function downloadLocationSetup(payload: DownloadLocationSetupPayload): Promise<void> {
  const fallbackMessage = 'Failed to download location setup';
  const file_format = payload.file_format || 'json';

  try {
    const res = await client.post<Blob>(
      '/location-setup/download-location-setup',
      { id: payload.id, file_format },
      { responseType: 'blob' },
    );
    await assertBlobNotApiError(res.data, fallbackMessage);

    const contentDisposition = res.headers['content-disposition'];
    const contentDispositionValue = Array.isArray(contentDisposition)
      ? contentDisposition[0]
      : contentDisposition;
    const defaultFilename = `location-setup-${payload.id}.${file_format}`;
    const filename = filenameFromContentDisposition(contentDispositionValue) ?? defaultFilename;

    const url = window.URL.createObjectURL(res.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    await rethrowApiError(error, fallbackMessage);
  }
}

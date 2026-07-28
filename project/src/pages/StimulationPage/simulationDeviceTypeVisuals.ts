import {
  DEVICE_CATALOG_ENTRIES,
  normalizeDeviceLookupKey,
  type DeviceCatalogEntry,
} from '@/pages/IoTGatewayDevices/deviceCatalogEntries';

const DEFAULT_TANK_ENTRY = DEVICE_CATALOG_ENTRIES.find((e) => e.id === 'tank');

/** Accent colors aligned with product-style device cards (blue, teal, orange, green, …). */
const ACCENT_PALETTE = [
  '#1d4ed8',
  '#0f766e',
  '#c2410c',
  '#15803d',
  '#7c3aed',
  '#b45309',
  '#0369a1',
  '#be123c',
  '#4d7c0f',
] as const;

export type SimulationDeviceTypeVisual = {
  iconUrl: string;
  accentColor: string;
  catalogEntry?: DeviceCatalogEntry;
};

function hashAccentIndex(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % ACCENT_PALETTE.length;
}

function matchesDeviceType(entry: DeviceCatalogEntry, lookupKey: string): boolean {
  const nameKey = normalizeDeviceLookupKey(entry.name);
  const idKey = normalizeDeviceLookupKey(entry.id.replace(/-/g, ' '));
  const firstToken = lookupKey.split(' ')[0] ?? '';

  if (nameKey === lookupKey || idKey === lookupKey) return true;
  if (lookupKey.includes(nameKey) || nameKey.includes(lookupKey)) return true;
  if (firstToken.length >= 2 && (nameKey.startsWith(firstToken) || nameKey.includes(firstToken))) {
    return true;
  }
  if (firstToken.length >= 2 && idKey.includes(firstToken)) return true;
  return false;
}

/** Map simulation `device_type` labels to IoT gateway catalog icons. */
export function resolveSimulationDeviceTypeVisual(deviceType: string): SimulationDeviceTypeVisual {
  const lookupKey = normalizeDeviceLookupKey(deviceType);
  const catalogEntry = DEVICE_CATALOG_ENTRIES.find((entry) => matchesDeviceType(entry, lookupKey));

  return {
    iconUrl: catalogEntry?.iconUrl ?? DEFAULT_TANK_ENTRY?.iconUrl ?? '',
    accentColor: ACCENT_PALETTE[hashAccentIndex(deviceType)],
    catalogEntry,
  };
}

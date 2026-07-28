import type { DeviceTypeData } from '@/controllers/API/energySectorApi';

export type EnergyNodeDeviceDetails = {
  domain?: string;
  sub_domain?: string;
  device_icon?: string;
  device_code?: string;
  description?: string;
  location?: string;
  is_active?: boolean;
  device_id?: number;
};

export function deviceTypeToNodeDetails(device: DeviceTypeData): EnergyNodeDeviceDetails {
  return {
    domain: device.domain?.trim() || undefined,
    sub_domain: device.sub_domain?.trim() || undefined,
    device_icon: device.device_icon?.trim() || undefined,
    device_code: device.device_code?.trim() || undefined,
    description: device.description?.trim() || undefined,
    location: device.location?.trim() || undefined,
    is_active: device.is_active,
    device_id: device.id,
  };
}

export function hierarchyItemToNodeDetails(item: Record<string, unknown>): EnergyNodeDeviceDetails | undefined {
  const domain = String(item.domain ?? '').trim();
  const sub_domain = String(item.sub_domain ?? item.subDomain ?? '').trim();
  const device_icon = String(item.device_icon ?? item.deviceIcon ?? '').trim();
  const device_code = String(item.device_code ?? item.deviceCode ?? '').trim();
  const description = String(item.description ?? '').trim();
  const location = String(item.location ?? '').trim();
  const is_active = typeof item.is_active === 'boolean' ? item.is_active : undefined;
  const device_id = typeof item.device_id === 'number' ? item.device_id : undefined;

  if (
    !domain &&
    !sub_domain &&
    !device_icon &&
    !device_code &&
    !description &&
    !location &&
    is_active === undefined &&
    !device_id
  ) {
    return undefined;
  }

  return {
    domain: domain || undefined,
    sub_domain: sub_domain || undefined,
    device_icon: device_icon || undefined,
    device_code: device_code || undefined,
    description: description || undefined,
    location: location || undefined,
    is_active,
    device_id,
  };
}

export function nodeDetailsToHierarchyFields(details?: EnergyNodeDeviceDetails): Record<string, unknown> {
  if (!details) return {};

  return {
    ...(details.domain ? { domain: details.domain } : {}),
    ...(details.sub_domain ? { sub_domain: details.sub_domain } : {}),
    ...(details.device_icon ? { device_icon: details.device_icon } : {}),
    ...(details.device_code ? { device_code: details.device_code } : {}),
    ...(details.description ? { description: details.description } : {}),
    ...(details.location ? { location: details.location } : {}),
    ...(details.is_active !== undefined ? { is_active: details.is_active } : {}),
    ...(details.device_id ? { device_id: details.device_id } : {}),
  };
}

export function resolveNodeDeviceDetails(
  item: Record<string, unknown>,
  deviceTypes: DeviceTypeData[],
): EnergyNodeDeviceDetails | undefined {
  const fromItem = hierarchyItemToNodeDetails(item);
  if (fromItem) return fromItem;

  const type = String(item.type ?? item.name ?? '').trim();
  const device = deviceTypes.find((entry) => entry.device_type === type);
  return device ? deviceTypeToNodeDetails(device) : undefined;
}

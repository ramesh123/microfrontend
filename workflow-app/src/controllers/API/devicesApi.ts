import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./api";
import {
  assertBlobNotApiError,
  executeApiRequestSilent,
  rethrowApiError,
} from "@/utils/exceptionHelper";
import { iotSilentBlob } from "./iotGatewayApiHelper";

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


function gwPost<T>(url: string, body?: unknown, fallback = "Request failed"): Promise<T> {
  return executeApiRequestSilent(() => client.post<T>(url, body), fallback);
}
function gwGet<T>(url: string, config?: AxiosRequestConfig, fallback = "Request failed"): Promise<T> {
  return executeApiRequestSilent(() => client.get<T>(url, config), fallback);
}
async function gwDelete(url: string, fallback = "Request failed"): Promise<void> {
  await executeApiRequestSilent(() => client.delete(url), fallback);
}

/** Coalesce identical in-flight reads (React 18 StrictMode remount / duplicate effects). Do not use for mutations. */
const devicesReadInflight = new Map<string, Promise<unknown>>();

function dedupeRead<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = devicesReadInflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      return await run();
    } finally {
      devicesReadInflight.delete(key);
    }
  })();
  devicesReadInflight.set(key, p);
  return p;
}

export type TbPageData<T> = {
  data?: T[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

export type DeviceProfileRecord = Record<string, unknown>;

function normalizePage<T>(raw: unknown): TbPageData<T> {
  if (!raw || typeof raw !== "object") return { data: [], totalElements: 0 };
  const root = raw as Record<string, unknown>;

  /** Gateway style: `{ success, data: { data: rows[], totalElements, totalPages } }` (ThingsBoard page inside `data`). */
  let envelope: Record<string, unknown> = root;
  const rootData = root.data;
  if (Array.isArray(rootData)) {
    const data = rootData as T[];
    const totalElements =
      typeof root.totalElements === "number"
        ? root.totalElements
        : typeof root.total_elements === "number"
          ? root.total_elements
          : typeof root.total === "number"
            ? root.total
            : data.length;
    return { data, totalElements, totalPages: undefined, hasNext: undefined };
  }
  if (rootData && typeof rootData === "object" && !Array.isArray(rootData)) {
    const nested = rootData as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      envelope = nested;
    }
  }

  const data = (Array.isArray(envelope.data) ? envelope.data : Array.isArray(envelope.content) ? envelope.content : []) as T[];
  const totalElements =
    typeof envelope.totalElements === "number"
      ? envelope.totalElements
      : typeof envelope.total_elements === "number"
        ? envelope.total_elements
        : typeof envelope.total === "number"
          ? envelope.total
          : typeof root.totalElements === "number"
            ? root.totalElements
            : typeof root.total_elements === "number"
              ? root.total_elements
              : data.length;

  const totalPages =
    typeof envelope.totalPages === "number"
      ? envelope.totalPages
      : typeof envelope.total_pages === "number"
        ? envelope.total_pages
        : typeof root.totalPages === "number"
          ? root.totalPages
          : undefined;

  const hasNext =
    typeof envelope.hasNext === "boolean"
      ? envelope.hasNext
      : typeof envelope.has_next === "boolean"
        ? envelope.has_next
        : undefined;

  return { data, totalElements, totalPages, hasNext };
}

function dvObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isTbPagedShape(obj: Record<string, unknown>): boolean {
  if (!Array.isArray(obj.data)) return false;
  return (
    typeof obj.totalElements === "number" ||
    typeof obj.total_elements === "number" ||
    typeof obj.totalPages === "number" ||
    typeof obj.total_pages === "number" ||
    typeof obj.hasNext === "boolean" ||
    typeof obj.has_next === "boolean"
  );
}

/**
 * Unwrap `{ success, data }` / nested `data.data` envelopes and merge nested
 * `deviceProfile` / `device_profile` plus optional `profileData` JSON so `name`, `type`, etc. resolve like ThingsBoard.
 */
export function normalizeDeviceProfileRecord(raw: unknown): DeviceProfileRecord {
  const root = dvObject(raw);
  let layer: Record<string, unknown> = root;

  const rootData = dvObject(root.data);
  if (Object.keys(rootData).length > 0) {
    layer = rootData;
  }

  if (layer.data != null && typeof layer.data === "object" && !Array.isArray(layer.data)) {
    const inner = dvObject(layer.data);
    if (Object.keys(inner).length > 0 && !isTbPagedShape(inner)) {
      layer = inner;
    }
  }

  const payload = dvObject(root.payload);
  let base: Record<string, unknown> =
    Object.keys(dvObject(layer)).length > 0 ? { ...layer } : Object.keys(payload).length > 0 ? { ...payload } : { ...root };

  const nested = dvObject(base.deviceProfile ?? base.device_profile);
  if (Object.keys(nested).length > 0) {
    base = { ...base, ...nested };
  }

  const pd = base.profileData ?? base.profile_data;
  if (typeof pd === "string" && pd.trim().startsWith("{")) {
    try {
      const parsed = dvObject(JSON.parse(pd));
      base = { ...parsed, ...base };
    } catch {
      /* ignore */
    }
  } else if (pd && typeof pd === "object" && !Array.isArray(pd)) {
    base = { ...(pd as Record<string, unknown>), ...base };
  }

  return base as DeviceProfileRecord;
}

/** ThingsBoard device info / gateway projection (fields optional). */
export type DeviceInfoRecord = Record<string, unknown>;

export function entityIdFromTb(ref: unknown): string {
  if (ref == null) return "";
  if (typeof ref === "string") return ref.trim();
  if (typeof ref === "object" && "id" in ref) {
    const id = (ref as { id?: unknown }).id;
    return typeof id === "string" ? id : id != null ? String(id) : "";
  }
  return "";
}

function deviceIdString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function deviceRowId(row: DeviceInfoRecord): string {
  return (
    deviceIdString(row.device_id) ||
    deviceIdString(row.deviceId) ||
    deviceIdString(row.device_key) ||
    entityIdFromTb(row.id ?? row.deviceId)
  );
}

export type ListDevicesParams = {
  page: number;
  page_size: number;
  text_search?: string;
  sort_property?: string;
  sort_order?: string;
  type?: string;
  device_profile_id?: string;
  /** ThingsBoard-style connectivity filter on `active`. `all` sends `active: false` (tenant default list). */
  connection_active?: "all" | "active" | "inactive";
};

export type QueryDevicesParams = {
  /** GET filter string, e.g. `location_id = '189'`. */
  q?: string;
  skip?: number;
  limit?: number;
};

/** Escape single quotes in string literals for `q` filter values. */
function escapeQueryStringLiteral(value: string): string {
  return String(value).replace(/'/g, "''");
}

/** Build `q` for GET `/device` — `location_id = '<selected location id>'`. */
export function buildLocationIdDeviceQuery(locationId: string): string {
  const id = escapeQueryStringLiteral(locationId.trim());
  return `location_id = '${id}'`;
}

/** Alias for `buildLocationIdDeviceQuery`. */
export const buildLocationDeviceQuery = buildLocationIdDeviceQuery;

/** GET `/api/device?q=location_id%20%3D%20'189'&skip=...&limit=...`. */
export async function queryDevices(params: QueryDevicesParams): Promise<TbPageData<DeviceInfoRecord>> {
  const skip = params.skip ?? 0;
  const limit = params.limit ?? 100;
  const q = params.q?.trim() ?? "";
  const key = `queryDevices|${q}|${skip}|${limit}`;
  return dedupeRead(key, async () => {
    const queryParams: Record<string, string | number> = { skip, limit };
    if (q) queryParams.q = q;
    const data = await gwGet<unknown>(
      "/device",
      { params: queryParams },
      "Failed to load devices",
    );
    return normalizePage<DeviceInfoRecord>(data);
  });
}

export async function listDevices(params: ListDevicesParams): Promise<TbPageData<DeviceInfoRecord>> {
  const key = `listDevices|${params.page}|${params.page_size}|${params.text_search ?? ""}|${params.sort_property ?? "createdTime"}|${params.sort_order ?? "Desc"}|${params.type ?? ""}|${params.device_profile_id ?? ""}|${params.connection_active ?? "all"}`;
  return dedupeRead(key, async () => {
      const body: Record<string, unknown> = {
        page: params.page,
        page_size: params.page_size,
        text_search: params.text_search ?? "",
        sort_property: params.sort_property ?? "createdTime",
        sort_order: params.sort_order ?? "Desc",
        type: params.type ?? "",
        device_profile_id: params.device_profile_id ?? "",
      };
      if (params.connection_active === "active") {
        body.active = true;
      } else if (params.connection_active === "inactive") {
        body.active = false;
      } else {
        body.active = false;
      }
      const data = await gwPost<unknown>("/device/list-devices", body);
      return normalizePage<DeviceInfoRecord>(data);

  });
}

export type DeviceProfileOption = { id: string; name: string; raw?: DeviceInfoRecord };

export async function listDeviceProfileInfos(params?: {
  page_size?: number;
  page?: number;
  text_search?: string;
}): Promise<DeviceProfileOption[]> {
  const page_size = params?.page_size ?? 50;
  const page = params?.page ?? 0;
  const text_search = params?.text_search ?? "";
  const key = `listDeviceProfileInfos|${page_size}|${page}|${text_search}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-profile-types", {
        page_size,
        page,
        sort_property: "name",
        sort_order: "ASC",
        text_search,
        transport_type: "",
        active: false,
      });
      const pageData = normalizePage<DeviceInfoRecord>(data);
      const rows = pageData.data ?? [];
      return rows
        .map((r) => {
          const id = entityIdFromTb(r.id) || entityIdFromTb((r as { deviceProfileId?: unknown }).deviceProfileId);
          const name =
            typeof r.name === "string"
              ? r.name
              : typeof (r as { type?: unknown }).type === "string"
                ? String((r as { type: string }).type)
                : id || "Profile";
          const opt: DeviceProfileOption = { id, name, raw: r };
          return id ? opt : null;
        })
        .filter((x): x is DeviceProfileOption => x != null);

  });
}

export async function getDeviceProfiles(payload?: {
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
  text_search?: string;
}): Promise<TbPageData<DeviceProfileRecord>> {
  const page_size = payload?.page_size ?? 10;
  const page = payload?.page ?? 0;
  const sort_property = payload?.sort_property ?? "name";
  const sort_order = payload?.sort_order ?? "ASC";
  const text_search = payload?.text_search?.trim() ?? "";
  const key = `getDeviceProfiles|${page_size}|${page}|${sort_property}|${sort_order}|${text_search}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device-profile/get-device-profiles", {
        page_size,
        page,
        sort_property,
        sort_order,
        text_search,
      });
      const profilePage = normalizePage<DeviceProfileRecord>(data);
      return {
        ...profilePage,
        data: (profilePage.data ?? []).map((row) => normalizeDeviceProfileRecord(row)),
      };

  });
}

export async function getDeviceProfileById(device_profile_id: string): Promise<DeviceProfileRecord> {
  const key = `getDeviceProfileById|${device_profile_id}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device-profile/get-device-profile-by-id", {
        device_profile_id,
      });
      return normalizeDeviceProfileRecord(data);

  });
}

export async function createDeviceProfile(payload: {
  name: string;
  type: string;
  transport_type: string;
  description?: string;
  entity_type?: string;
  default_rule_chain_id?: string;
}): Promise<unknown> {
  const data = await gwPost<unknown>("/device-profile/create-device-profile", {
      name: payload.name,
      type: payload.type,
      transport_type: payload.transport_type,
      description: payload.description ?? "",
      entity_type: payload.entity_type ?? "RULE_CHAIN",
      default_rule_chain_id: payload.default_rule_chain_id ?? "",
    });
    return data;

}

export async function updateDeviceProfile(payload: {
  device_profile_id: string;
  name: string;
  type: string;
  transport_type: string;
  description?: string;
  entity_type?: string;
  default_rule_chain_id?: string;
}): Promise<unknown> {
  const data = await gwPost<unknown>("/device-profile/update-device-profile", {
      device_profile_id: payload.device_profile_id,
      name: payload.name,
      type: payload.type,
      transport_type: payload.transport_type,
      description: payload.description ?? "",
      entity_type: payload.entity_type ?? "RULE_CHAIN",
      default_rule_chain_id: payload.default_rule_chain_id ?? "",
    });
    return data;

}

export async function deleteDeviceProfileById(device_profile_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device-profile/delete-device-profile-by-id", {
      device_profile_id,
    });
    return data;

}

/** Marks the device profile as the tenant default. */
export async function setDefaultDeviceProfile(device_profile_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device-profile/make-default-device-profile", {
      device_profile_id,
    });
    return data;

}

export async function searchDeviceProfileRuleChains(payload?: {
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
  type?: string;
  text_search?: string;
}): Promise<TbPageData<DeviceInfoRecord>> {
  const page_size = payload?.page_size ?? 50;
  const page = payload?.page ?? 0;
  const sort_property = payload?.sort_property ?? "name";
  const sort_order = payload?.sort_order ?? "ASC";
  const type = payload?.type ?? "";
  const text_search = payload?.text_search ?? "";
  const key = `searchDeviceProfileRuleChains|${page_size}|${page}|${sort_property}|${sort_order}|${type}|${text_search}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device-profile/search-rule-chain", {
        page_size,
        page,
        sort_property,
        sort_order,
        type,
        text_search,
      });
      return normalizePage<DeviceInfoRecord>(data);

  });
}

export async function deleteDevice(device_id: string): Promise<void> {
  await gwPost("/device/delete-device", { device_id }, "Failed to delete device");
}

export type SaveDevicePayload = {
  name: string;
  label?: string;
  deviceProfileId: { entityType: "DEVICE_PROFILE"; id: string };
  additionalInfo?: Record<string, unknown>;
  customerId?: null | { entityType?: string; id: string };
  id?: { entityType: "DEVICE"; id: string };
  type?: string;
};

export async function saveDevice(body: {
  payload: SaveDevicePayload;
  access_token?: string;
}): Promise<unknown> {
  const data = await gwPost<unknown>("/device/save-device", {
      payload: body.payload,
      access_token: body.access_token ?? "",
    });
    return data;

}

export async function saveDeviceWithCredentials(body: {
  device: Record<string, unknown>;
  credentials: Record<string, unknown>;
}): Promise<unknown> {
  const data = await gwPost<unknown>("/device/save-device-with-credentials", body);
    return data;

}

export async function makeDevicePublic(device_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device/make-device-public", { device_id });
    return data;

}

export async function unassignDeviceFromCustomer(device_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device/unassign-device-from-customer", { device_id });
    return data;

}

export async function getAvailableCustomers(payload: {
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
  text_search?: string;
}): Promise<unknown> {
  const page_size = payload.page_size ?? 50;
  const page = payload.page ?? 0;
  const sort_property = payload.sort_property ?? "title";
  const sort_order = payload.sort_order ?? "ASC";
  const text_search = payload.text_search ?? "";
  const key = `getAvailableCustomers|${page_size}|${page}|${sort_property}|${sort_order}|${text_search}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-available-customers", {
        page_size,
        page,
        sort_property,
        sort_order,
        text_search,
      });
      return data;

  });
}

export async function assignDeviceToCustomer(customer_id: string, device_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device/assign-device-to-customer", {
      customer_id,
      device_id,
    });
    return data;

}

export async function getDeviceCredentials(device_id: string): Promise<unknown> {
  const key = `getDeviceCredentials|${device_id}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-credentials", { device_id });
      return data;

  });
}

export async function updateDeviceCredentials(payload: Record<string, unknown>): Promise<unknown> {
  const data = await gwPost<unknown>("/device/update-device-credentials", { payload });
    return data;

}

export async function getDeviceInfo(device_id: string): Promise<unknown> {
  const key = `getDeviceInfo|${device_id}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-info", { device_id });
      return data;

  });
}

export async function getDeviceProfileInfo(device_profile_id: string): Promise<unknown> {
  const key = `getDeviceProfileInfo|${device_profile_id}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-profile-info", { device_profile_id });
      return data;

  });
}

export type DeviceAttributeScope = "CLIENT_SCOPE" | "SERVER_SCOPE" | "SHARED_SCOPE";
type DeviceAttributeScopeInput = DeviceAttributeScope | `Scope.${DeviceAttributeScope}`;

function normalizeAttributeScope(scope: DeviceAttributeScopeInput): DeviceAttributeScope {
  const normalized = scope.replace(/^Scope\./, "") as DeviceAttributeScope;
  return normalized;
}

export async function getDeviceAttributes(
  device_id: string,
  scope: DeviceAttributeScopeInput,
  keys = "",
): Promise<unknown> {
  const norm = normalizeAttributeScope(scope);
  const key = `getDeviceAttributes|${device_id}|${norm}|${keys}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-attributes", {
        device_id,
        scope: norm,
        keys,
      });
      return data;

  });
}

export async function saveDeviceAttributes(
  device_id: string,
  scope: DeviceAttributeScopeInput,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const data = await gwPost<unknown>("/device/save-device-attributes", {
      device_id,
      scope: normalizeAttributeScope(scope),
      payload,
    });
    return data;

}

export async function deleteDeviceAttributes(
  device_id: string,
  scope: DeviceAttributeScopeInput,
  keys: string,
): Promise<unknown> {
  const data = await gwPost<unknown>("/device/delete-device-attributes", {
      device_id,
      scope: normalizeAttributeScope(scope),
      keys,
    });
    return data;

}

export async function saveDeviceTelemetry(
  device_id: string,
  scope: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const data = await gwPost<unknown>("/device/save-device-telemetry", {
      device_id,
      scope,
      payload,
    });
    return data;

}

/** Remove latest timeseries keys for the device (comma-separated `keys` supported). */
export async function deleteDeviceTelemetry(device_id: string, scope: string, keys: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device/delete-device-timeseries", {
      device_id,
      scope,
      keys,
    });
    return data;

}

export async function getDeviceLatestTimeseries(payload: {
  device_id: string;
  use_strict_data_types?: boolean;
}): Promise<unknown> {
  const use_strict = payload.use_strict_data_types ?? false;
  const key = `getDeviceLatestTimeseries|${payload.device_id}|${use_strict}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-latest-timeseries", {
        device_id: payload.device_id,
        use_strict_data_types: use_strict,
      });
      return data;

  });
}

export async function getDeviceCalculatedFields(payload: {
  device_id: string;
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
}): Promise<unknown> {
  const page_size = payload.page_size ?? 10;
  const page = payload.page ?? 0;
  const sort_property = payload.sort_property ?? "createdTime";
  const sort_order = payload.sort_order ?? "DESC";
  const key = `getDeviceCalculatedFields|${payload.device_id}|${page_size}|${page}|${sort_property}|${sort_order}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-calculated-fields", {
        device_id: payload.device_id,
        page_size,
        page,
        sort_property,
        sort_order,
      });
      return data;

  });
}

export async function createDeviceCalculatedField(payload: Record<string, unknown>): Promise<unknown> {
  const data = await gwPost<unknown>("/device/create-device-calculated-field", { payload });
    return data;

}

export async function getDeviceCalculatedEvents(payload: Record<string, unknown>): Promise<unknown> {
  const key = `getDeviceCalculatedEvents|${JSON.stringify(payload)}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-calculated-events", payload);
      return data;

  });
}

export async function clearDeviceCalculatedEvents(payload: Record<string, unknown>): Promise<unknown> {
  const data = await gwPost<unknown>("/device/clear-device-calculated-events", payload);
    return data;

}

export async function deleteCalculatedField(calculated_field_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/device/delete-calculated-field", { calculated_field_id });
    return data;

}

export async function getDeviceCalculatedFieldById(calculated_field_id: string): Promise<unknown> {
  const key = `getDeviceCalculatedFieldById|${calculated_field_id}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-calculated-field-by-id", {
        calculated_field_id,
      });
      return data;

  });
}

export async function getDeviceAlarms(payload: {
  device_id: string;
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
  status_list?: string;
}): Promise<unknown> {
  const page_size = payload.page_size ?? 10;
  const page = payload.page ?? 0;
  const sort_property = payload.sort_property ?? "createdTime";
  const sort_order = payload.sort_order ?? "DESC";
  const status_list = payload.status_list ?? "ACTIVE";
  const key = `getDeviceAlarms|${payload.device_id}|${page_size}|${page}|${sort_property}|${sort_order}|${status_list}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-alarms", {
        device_id: payload.device_id,
        page_size,
        page,
        sort_property,
        sort_order,
        status_list,
      });
      return data;

  });
}

export async function getIotGatewayAlarms(payload: {
  page_size?: number;
  page?: number;
  sort_property?: string;
  sort_order?: string;
  status_list?: string;
  start_time: string;
  end_time: string;
  text_search?: string;
}): Promise<unknown> {
  const page_size = payload.page_size ?? 10;
  const page = payload.page ?? 0;
  const sort_property = payload.sort_property ?? "createdTime";
  const sort_order = payload.sort_order ?? "DESC";
  const status_list = payload.status_list ?? "ACTIVE";
  const text_search = payload.text_search?.trim() ?? "";
  const key = `getIotGatewayAlarms|${page_size}|${page}|${sort_property}|${sort_order}|${status_list}|${payload.start_time}|${payload.end_time}|${text_search}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/iot-alarm/get-alarms", {
        page_size,
        page,
        sort_property,
        sort_order,
        status_list,
        start_time: payload.start_time,
        end_time: payload.end_time,
        text_search,
      });
      return data;

  });
}

export async function clearIotGatewayAlarm(alarm_id: string): Promise<unknown> {
  const data = await gwPost<unknown>("/iot-alarm/clear-alarm", { alarm_id });
    return data;

}

export async function getDeviceEvents(payload: Record<string, unknown>): Promise<unknown> {
  const key = `getDeviceEvents|${JSON.stringify(payload)}`;
  return dedupeRead(key, async () => {
      const data = await gwPost<unknown>("/device/get-device-events", payload);
      return data;

  });
}

export async function getDeviceAuditLogs(payload: {
  device_id: string;
  pageSize?: number;
  page?: number;
  sortProperty?: string;
  sortOrder?: string;
  startTime?: number;
  endTime?: number;
}): Promise<unknown> {
  const pageSize = payload.pageSize ?? 10;
  const page = payload.page ?? 0;
  const sortProperty = payload.sortProperty ?? "createdTime";
  const sortOrder = payload.sortOrder ?? "DESC";
  const key = `getDeviceAuditLogs|${payload.device_id}|${pageSize}|${page}|${sortProperty}|${sortOrder}|${payload.startTime ?? ""}|${payload.endTime ?? ""}`;
  return dedupeRead(key, async () => {
      const data = await gwGet<unknown>(
        `/audit/logs/entity/DEVICE/${payload.device_id}`,
        {
          params: {
            pageSize,
            page,
            sortProperty,
            sortOrder,
            startTime: payload.startTime,
            endTime: payload.endTime,
          },
        },
        "Failed to load device audit logs",
      );
      return data;

  });
}

/** Audit log entries for any entity type (e.g. DEVICE_PROFILE). */
export async function getEntityAuditLogs(payload: {
  entityType: string;
  entityId: string;
  pageSize?: number;
  page?: number;
  sortProperty?: string;
  sortOrder?: string;
  startTime?: number;
  endTime?: number;
}): Promise<unknown> {
  const entityType = encodeURIComponent(payload.entityType.trim());
  const entityId = encodeURIComponent(payload.entityId.trim());
  const pageSize = payload.pageSize ?? 10;
  const page = payload.page ?? 0;
  const sortProperty = payload.sortProperty ?? "createdTime";
  const sortOrder = payload.sortOrder ?? "DESC";
  const key = `getEntityAuditLogs|${entityType}|${entityId}|${pageSize}|${page}|${sortProperty}|${sortOrder}|${payload.startTime ?? ""}|${payload.endTime ?? ""}`;
  return dedupeRead(key, async () => {
      const data = await gwGet<unknown>(
        `/audit/logs/entity/${entityType}/${entityId}`,
        {
          params: {
            pageSize,
            page,
            sortProperty,
            sortOrder,
            startTime: payload.startTime,
            endTime: payload.endTime,
          },
        },
        "Failed to load audit logs",
      );
      return data;

  });
}

/** Pull tenant id from ThingsBoard-style device info for events APIs. */
export function tenantIdFromDeviceInfo(info: unknown): string {
  if (!info || typeof info !== "object") return "";
  const o = info as Record<string, unknown>;
  return entityIdFromTb(o.tenantId ?? o.tenant_id);
}

function filenameFromContentDisposition(cd: string | undefined): string | undefined {
  if (!cd || typeof cd !== "string") return undefined;
  const m = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(cd);
  const rawName = m?.[1] ?? m?.[2] ?? m?.[3];
  if (!rawName) return undefined;
  try {
    return decodeURIComponent(rawName.replace(/["']/g, "").trim());
  } catch {
    return rawName.replace(/["']/g, "").trim();
  }
}

/** POST `/api/device/download-create-devices-template` — triggers browser download of the bulk-create template file. */
export async function downloadCreateDevicesTemplate(): Promise<void> {
  const fallback = "Failed to download devices template";
  let blob: Blob;
  let cdStr: string | undefined;
  try {
    const res = await client.post<Blob>("/device/download-create-devices-template", {}, {
      responseType: "blob",
    });
    await assertBlobNotApiError(res.data, fallback);
    blob = res.data;
    const cd = res.headers["content-disposition"];
    cdStr = Array.isArray(cd) ? cd[0] : cd;
  } catch (error) {
    await rethrowApiError(error, fallback);
  }
  const filename = filenameFromContentDisposition(cdStr) ?? "create-devices-template.xlsx";
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

}

type CreateDevicesFromTemplateBase = {
  business_unit: string;
  location_id: string;
  location_name: string;
  file_name: string;
  encrypted_file_key: string;
};

export type CreateDevicesFromTemplatePreviewPayload = CreateDevicesFromTemplateBase & {
  preview: true;
};

export type CreateDevicesFromTemplateSubmitPayload = CreateDevicesFromTemplateBase & {
  preview: false;
  unique_id: string;
};

export type CreateDevicesFromTemplatePayload =
  | CreateDevicesFromTemplatePreviewPayload
  | CreateDevicesFromTemplateSubmitPayload;

/** POST `/api/device/create-devices-from-template` — bulk create devices from uploaded template metadata. */
export async function createDevicesFromTemplate(
  payload: CreateDevicesFromTemplatePayload,
): Promise<unknown> {
  return gwPost("/device/create-devices-from-template", payload, "Failed to create devices from template");
}

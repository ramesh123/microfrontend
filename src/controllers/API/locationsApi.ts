import axios, { type AxiosInstance } from "axios";

import { API_BASE_URL } from "./api";
import { iotDelete, iotGet, iotPost, iotPut } from "./iotGatewayApiHelper";

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

/** Coalesce identical in-flight reads (React StrictMode / duplicate effects). */
const locationsReadInflight = new Map<string, Promise<unknown>>();

function dedupeRead<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = locationsReadInflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      return await run();
    } finally {
      locationsReadInflight.delete(key);
    }
  })();
  locationsReadInflight.set(key, p);
  return p;
}

export type LocationRecord = {
  /** Server id for GET `/locations/{id}`. */
  id: string;
  name: string;
  description: string;
  location_id: string;
  /** Optional SAP plant id from API (device queries use `location_id`). */
  sap_id: string;
  business_unit: string;
  raw: Record<string, unknown>;
};

export type CreateLocationPayload = {
  name: string;
  description: string;
  location_id: string;
  business_unit: string;
};

/** First 3 letters from the location name (letters only, uppercased). */
export function buildLocationIdPrefix(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!letters) return '';
  return letters.slice(0, 3);
}

/** Next sequential id for a prefix, e.g. THE-001 → THE-002 when THE-001 exists. */
export function generateNextLocationId(name: string, existingLocationIds: string[]): string {
  const prefix = buildLocationIdPrefix(name);
  if (!prefix) return '';

  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})$`, 'i');
  let maxSequence = 0;

  for (const rawId of existingLocationIds) {
    const id = rawId.trim();
    if (!id) continue;
    const match = id.match(pattern);
    if (match) {
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1], 10));
    }
  }

  return `${prefix}-${String(maxSequence + 1).padStart(3, '0')}`;
}

function stringVal(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function normalizeLocationItem(raw: Record<string, unknown>): LocationRecord {
  const location_id = stringVal(raw.location_id ?? raw.locationId).trim();
  const id =
    stringVal(raw.id ?? raw._id ?? raw.uuid).trim() ||
    location_id ||
    "—";
  const sap_id = stringVal(raw.sap_id ?? raw.sapId).trim() || location_id;
  return {
    id,
    name: stringVal(raw.name).trim() || "—",
    description: stringVal(raw.description).trim(),
    location_id,
    sap_id,
    business_unit: stringVal(raw.business_unit ?? raw.businessUnit).trim(),
    raw,
  };
}

/** Unwrap `{ status, data }` envelopes from gateway APIs. */
function unwrapLocationsPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const root = raw as Record<string, unknown>;
  if (root.data != null && (root.status === true || root.status === "success")) {
    return root.data;
  }
  return raw;
}

/** Supports `{ data: Location[], count, total }` and common variants. */
function extractLocationArray(raw: unknown): Record<string, unknown>[] {
  const payload = unwrapLocationsPayload(raw);
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const inner = root.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[];
    if (Array.isArray(inner.items)) return inner.items as Record<string, unknown>[];
    if (Array.isArray(inner.content)) return inner.content as Record<string, unknown>[];
  }
  if (Array.isArray(root.items)) return root.items as Record<string, unknown>[];
  if (Array.isArray(root.content)) return root.content as Record<string, unknown>[];
  if (Array.isArray(root.results)) return root.results as Record<string, unknown>[];
  return [];
}

export type LocationSelectOption = { value: string; label: string };

/** Select: show `name`, submit `location_id` in create/update payloads. */
export function toLocationSelectOptions(
  rows: LocationRecord[],
): LocationSelectOption[] {
  return rows
    .filter((loc) => loc.location_id.trim().length > 0)
    .map((loc) => {
      const value = loc.location_id.trim();
      const label =
        loc.name.trim() && loc.name !== "—" ? loc.name.trim() : value;
      return { value, label };
    });
}

function extractTotal(raw: unknown, rowCount: number): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return rowCount;
  const root = raw as Record<string, unknown>;
  const candidates = [
    root.total,
    root.totalElements,
    root.total_elements,
    root.count,
    root.totalCount,
    root.total_count,
  ];
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const inner = root.data as Record<string, unknown>;
    candidates.push(inner.total, inner.totalElements, inner.total_elements, inner.count);
  }
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) return c;
  }
  return rowCount;
}

export async function getLocationsList(payload: {
  skip: number;
  limit: number;
}): Promise<{ rows: LocationRecord[]; total: number }> {
  const key = `list|${payload.skip}|${payload.limit}`;
  return dedupeRead(key, async () => {
    const data = await iotGet<unknown>(
      client,
      "/locations",
      { params: { skip: payload.skip, limit: payload.limit } },
      "Failed to load locations",
    );
    let arr = extractLocationArray(data);
    if (
      arr.length === 0 &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Array.isArray((data as Record<string, unknown>).data)
    ) {
      arr = (data as Record<string, unknown>).data as Record<string, unknown>[];
    }
    const rows = arr.map((item) => normalizeLocationItem(item));
    const total = extractTotal(data, rows.length);
    return { rows, total: Math.max(total, rows.length) };
  });
}

export async function getLocationById(id: string): Promise<LocationRecord> {
  const key = id.trim();
  if (!key) throw new Error("Location id is required.");
  return dedupeRead(`byId|${key}`, async () => {
    const data = await iotGet<unknown>(
      client,
      `/locations/${encodeURIComponent(key)}`,
      undefined,
      "Failed to load location",
    );
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const root = data as Record<string, unknown>;
      const inner =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      return normalizeLocationItem(inner);
    }
    throw new Error("Invalid location response.");
  });
}

function toLocationRequestBody(payload: CreateLocationPayload): CreateLocationPayload {
  return {
    name: payload.name.trim(),
    description: payload.description.trim(),
    location_id: payload.location_id.trim(),
    business_unit: payload.business_unit.trim(),
  };
}

export async function createLocation(payload: CreateLocationPayload): Promise<unknown> {
  return iotPost<unknown>(
    client,
    "/locations/create-location",
    toLocationRequestBody(payload),
    undefined,
    "Failed to create location",
  );
}

/** Update location via PUT /locations (gateway). */
export async function updateLocation(
  id: string,
  payload: CreateLocationPayload,
): Promise<unknown> {
  const key = id.trim();
  if (!key) throw new Error("Location id is required.");
  return iotPut<unknown>(
    client,
    "/locations",
    {
      id: key,
      ...toLocationRequestBody(payload),
    },
    undefined,
    "Failed to update location",
  );
}

export async function deleteLocation(id: string): Promise<void> {
  const key = id.trim();
  if (!key) throw new Error("Location id is required.");
  await iotDelete(
    client,
    `/locations/${encodeURIComponent(key)}`,
    undefined,
    "Failed to delete location",
  );
}

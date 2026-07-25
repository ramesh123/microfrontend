import axios, { type AxiosInstance, isAxiosError } from "axios";

import { API_BASE_URL } from "@/controllers/API/api";
import {
  ApiErrorResponse,
  getDisplayErrorMessage,
  rethrowApiError,
  throwIfApiErrorResponse,
} from "@/utils/exceptionHelper";

export type TbEntityRef = {
  entityType?: string;
  id?: string;
};

export type DashboardAssignment = {
  customerId?: TbEntityRef | null;
  title?: string | null;
  public?: boolean | null;
};

export type DashboardSummary = {
  id?: TbEntityRef | null;
  createdTime?: number | null;
  title?: string | null;
  name?: string | null;
  assignedCustomers?: DashboardAssignment[] | null;
  public?: boolean | null;
  /** Present when the list/detail API returns them; used for the details panel until dedicated edit APIs exist. */
  description?: string | null;
  mobileHide?: boolean | null;
  mobileOrder?: number | string | null;
  image?: string | null;
};

export type DashboardPage = {
  data?: DashboardSummary[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

export type DashboardListParams = {
  page: number;
  page_size: number;
  text_search?: string;
  sort_property?: "title" | "createdTime";
  sort_order?: "ASC" | "DESC";
};

export type CustomerOption = {
  id: string;
  title: string;
  isPublic: boolean;
};

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

function toErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data;
    if (detail && typeof detail === "object" && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  return getDisplayErrorMessage(error, "Request failed");
}

function filenameFromDisposition(contentDisposition: unknown, fallback: string): string {
  if (typeof contentDisposition !== "string" || !contentDisposition.trim()) return fallback;
  const match = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(contentDisposition);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw.replace(/["']/g, "").trim()) || fallback;
  } catch {
    return raw.replace(/["']/g, "").trim() || fallback;
  }
}

export function entityIdFromTb(ref: unknown): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref.trim();
  if (typeof ref === "object" && "id" in ref) {
    const id = (ref as { id?: unknown }).id;
    return typeof id === "string" ? id : "";
  }
  return "";
}

/** Resolves dashboard id from create/get API bodies (TB entity ref, string id, or snake/camel keys). */
export function resolveDashboardIdFromPayload(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const fromEntity = entityIdFromTb(record.id);
  if (fromEntity) return fromEntity;
  for (const key of ["dashboard_id", "dashboardId"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const nested = record.payload ?? record.data ?? record.dashboard;
  if (nested && nested !== raw) {
    return resolveDashboardIdFromPayload(nested);
  }
  return "";
}

function normalizeDashboardPage(raw: unknown): DashboardPage {
  if (!raw || typeof raw !== "object") {
    return { data: [], totalElements: 0, totalPages: 0, hasNext: false };
  }
  const page = raw as Record<string, unknown>;
  const data = (Array.isArray(page.data) ? page.data : []) as DashboardSummary[];
  return {
    data,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : 0,
    totalElements: typeof page.totalElements === "number" ? page.totalElements : data.length,
    hasNext: Boolean(page.hasNext),
  };
}

function normalizeCustomers(raw: unknown): CustomerOption[] {
  if (!raw || typeof raw !== "object") return [];
  const page = raw as Record<string, unknown>;
  const data = (Array.isArray(page.data) ? page.data : Array.isArray(page.content) ? page.content : []) as Record<
    string,
    unknown
  >[];

  return data
    .map((customer) => {
      const id = entityIdFromTb(customer.id);
      const title =
        typeof customer.title === "string"
          ? customer.title
          : typeof customer.name === "string"
            ? customer.name
            : id;
      const additionalInfo =
        customer.additionalInfo && typeof customer.additionalInfo === "object"
          ? (customer.additionalInfo as Record<string, unknown>)
          : null;
      return id
        ? {
            id,
            title,
            isPublic: additionalInfo?.isPublic === true,
          }
        : null;
    })
    .filter((customer): customer is CustomerOption => customer !== null);
}

export async function listDashboards(params: DashboardListParams): Promise<DashboardPage> {
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/list-dashboards", {
      page_size: params.page_size,
      page: params.page,
      text_search: params.text_search ?? "",
      sort_property: params.sort_property ?? "title",
      sort_order: params.sort_order ?? "ASC",
    });
    return normalizeDashboardPage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function listAvailableCustomers(): Promise<CustomerOption[]> {
  try {
    const { data } = await client.post<unknown>("/device/get-available-customers", {
      page_size: 100,
      page: 0,
      sort_property: "title",
      sort_order: "ASC",
      text_search: "",
    });
    return normalizeCustomers(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function listDashboardCustomers(textSearch = ""): Promise<CustomerOption[]> {
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/get-customers", {
      page_size: 50,
      page: 0,
      sort_property: "title",
      sort_order: "ASC",
      text_search: textSearch,
    });
    return normalizeCustomers(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  try {
    await client.post("/iot-dashboard/delete-dashboard", { dashboard_id: dashboardId });
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function getDashboard(dashboardId: string): Promise<Record<string, unknown>> {
  try {
    const { data } = await client.post<Record<string, unknown>>("/iot-dashboard/get-dashboard", {
      dashboard_id: dashboardId,
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** POST `/api/iot-dashboard/save-dashboard` — body matches `{ payload: { ... } }`. */
export type SaveDashboardRequest = {
  payload: Record<string, unknown>;
};

export async function saveDashboard(body: SaveDashboardRequest): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/save-dashboard", body);
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function updateDashboardPublicStatus(dashboardId: string, isPublic: boolean): Promise<void> {
  try {
    await client.post("/iot-dashboard/update-dashboard-public-status", {
      dashboard_id: dashboardId,
      is_public: isPublic,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export type CreateDashboardPayload = {
  title: string;
  image: string;
  mobile_hide: boolean;
  mobile_order: number;
  configuration: Record<string, unknown>;
};

export async function createDashboard(payload: CreateDashboardPayload): Promise<unknown> {
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/create-dashboard", payload);
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export type DashboardGalleryImage = {
  id?: TbEntityRef | null;
  createdTime?: number | null;
  title?: string | null;
  fileName?: string | null;
  publicLink?: string | null;
  link?: string | null;
  /** Optional server hint; gallery thumbnails use `get-image-preview` + `link` + `/preview`. */
  previewUrl?: string | null;
  descriptor?: {
    width?: number;
    height?: number;
    size?: number;
    previewDescriptor?: { width?: number; height?: number; size?: number };
  } | null;
};

export type DashboardGalleryImagePage = {
  data: DashboardGalleryImage[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

export type ListDashboardImagesBody = {
  page_size: number;
  page: number;
  sort_property: string;
  sort_order: "ASC" | "DESC";
  image_sub_type: string;
  include_system_images: boolean;
};

function normalizeGalleryImagePage(raw: unknown): DashboardGalleryImagePage {
  if (!raw || typeof raw !== "object") {
    return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
  }
  const page = raw as Record<string, unknown>;
  const data = (Array.isArray(page.data) ? page.data : []) as DashboardGalleryImage[];
  return {
    data,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : 0,
    totalElements: typeof page.totalElements === "number" ? page.totalElements : data.length,
    hasNext: Boolean(page.hasNext),
  };
}

export async function listDashboardImages(
  params: Partial<ListDashboardImagesBody> = {},
): Promise<DashboardGalleryImagePage> {
  const body: ListDashboardImagesBody = {
    page_size: params.page_size ?? 20,
    page: params.page ?? 0,
    sort_property: params.sort_property ?? "createdTime",
    sort_order: params.sort_order ?? "DESC",
    image_sub_type: params.image_sub_type ?? "IMAGE",
    include_system_images: params.include_system_images ?? false,
  };
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/list-images", body);
    return normalizeGalleryImagePage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** POST body `image_url`: encoded path ending in `/preview`, e.g. `api/images/tenant/file.png/preview`. */
export async function getDashboardImagePreview(imageUrl: string): Promise<Blob> {
  try {
    const { data } = await client.post<Blob>(
      "/iot-dashboard/get-image-preview",
      { image_url: imageUrl },
      { responseType: "blob" },
    );
    if (data instanceof Blob && data.type.includes("application/json")) {
      const text = await data.text();
      let message = text || "Image preview failed";
      try {
        const parsed = JSON.parse(text) as { detail?: unknown };
        if (parsed?.detail != null) message = String(parsed.detail);
      } catch {
        /* use raw */
      }
      throw new Error(message.length > 500 ? `${message.slice(0, 500)}…` : message);
    }
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export type DashboardAuditLog = {
  id?: TbEntityRef | null;
  createdTime?: number | null;
  userName?: string | null;
  actionType?: string | null;
  actionData?: Record<string, unknown> | null;
  actionStatus?: string | null;
  actionFailureDetails?: string | null;
  entityName?: string | null;
};

export type DashboardAuditLogPage = {
  data: DashboardAuditLog[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

export type GetDashboardAuditLogsBody = {
  dashboard_id: string;
  page_size: number;
  page: number;
  sort_property: string;
  sort_order: "ASC" | "DESC";
  start_time: number;
  end_time: number;
};

function normalizeDashboardAuditPage(raw: unknown): DashboardAuditLogPage {
  if (!raw || typeof raw !== "object") {
    return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
  }
  const page = raw as Record<string, unknown>;
  const data = (Array.isArray(page.data) ? page.data : []) as DashboardAuditLog[];
  return {
    data,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : 0,
    totalElements: typeof page.totalElements === "number" ? page.totalElements : data.length,
    hasNext: Boolean(page.hasNext),
  };
}

export async function getDashboardAuditLogs(
  params: Partial<GetDashboardAuditLogsBody> & { dashboard_id: string },
): Promise<DashboardAuditLogPage> {
  const body: GetDashboardAuditLogsBody = {
    dashboard_id: params.dashboard_id,
    page_size: params.page_size ?? 10,
    page: params.page ?? 0,
    sort_property: params.sort_property ?? "createdTime",
    sort_order: params.sort_order ?? "DESC",
    start_time: typeof params.start_time === "number" ? params.start_time : 0,
    end_time: typeof params.end_time === "number" ? params.end_time : 0,
  };
  try {
    const { data } = await client.post<unknown>("/iot-dashboard/get-dashboard-audit-logs", body);
    return normalizeDashboardAuditPage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** ThingsBoard system tenant id — matches `tenantId.id` on system widget bundles. */
export const TB_SYSTEM_TENANT_ID = "13814000-1dd2-11b2-8080-808080808080";

export type WidgetsBundleSummary = {
  id: TbEntityRef | null;
  tenantId?: TbEntityRef | null;
  alias: string;
  title: string;
  name: string;
  description: string;
  image: string | null;
  scada?: boolean;
  order?: number;
};

export type WidgetsBundleListParams = {
  page?: number;
  page_size?: number;
  sort_property?: string;
  sort_order?: "ASC" | "DESC";
  tenant_only?: boolean;
  full_search?: boolean;
  scada_first?: boolean;
};

export type WidgetsBundlePage = {
  data: WidgetsBundleSummary[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

function normalizeWidgetsBundlePage(raw: unknown): WidgetsBundlePage {
  if (!raw || typeof raw !== "object") {
    return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
  }
  const page = raw as Record<string, unknown>;
  const rawData = Array.isArray(page.data) ? page.data : [];
  const data: WidgetsBundleSummary[] = rawData.map((item) => {
    const row = item as Record<string, unknown>;
    const image = typeof row.image === "string" ? row.image : null;
    return {
      id: (row.id as TbEntityRef) ?? null,
      tenantId: (row.tenantId as TbEntityRef) ?? null,
      alias: typeof row.alias === "string" ? row.alias : "",
      title:
        typeof row.title === "string"
          ? row.title
          : typeof row.name === "string"
            ? row.name
            : "Untitled",
      name: typeof row.name === "string" ? row.name : typeof row.title === "string" ? row.title : "",
      description: typeof row.description === "string" ? row.description : "",
      image,
      scada: row.scada === true,
      order: typeof row.order === "number" ? row.order : undefined,
    };
  });
  return {
    data,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : 0,
    totalElements: typeof page.totalElements === "number" ? page.totalElements : data.length,
    hasNext: Boolean(page.hasNext),
  };
}

export async function listWidgetBundles(params: Partial<WidgetsBundleListParams> = {}): Promise<WidgetsBundlePage> {
  const body = {
    page: params.page ?? 0,
    page_size: params.page_size ?? 50,
    sort_property: params.sort_property ?? "title",
    sort_order: params.sort_order ?? "ASC",
    tenant_only: params.tenant_only ?? false,
    full_search: params.full_search ?? false,
    scada_first: params.scada_first ?? false,
  };
  try {
    const { data } = await client.post<unknown>("/iot-widgets/list-widgets-bundles", body);
    return normalizeWidgetsBundlePage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/**
 * Path segment before the file extension — used to pick system vs tenant preview endpoint.
 * e.g. `tb-image;/api/images/system/foo.png` → system (`get-image`)
 *      `tb-image;/api/images/tenant/foo.png` → tenant (`get-image-tenet`)
 */
export function resolveTbWidgetImageEndpoint(
  imageRefOrUrl: string,
): "/iot-widgets/get-image" | "/iot-widgets/get-image-tenet" {
  const raw = imageRefOrUrl.trim();
  const semi = raw.indexOf(";");
  const path = (semi >= 0 ? raw.slice(semi + 1) : raw).trim().toLowerCase();
  const beforeExt = path.replace(/\.(svg|png|jpe?g|gif|webp)(\?.*)?$/i, "");

  if (
    /(?:^|\/)(api\/)?images\/tenant(?:\/|$)/i.test(beforeExt) ||
    /\/tenant\//i.test(beforeExt) ||
    /(?:^|\/)tenant(?:\/|$)/i.test(beforeExt)
  ) {
    return "/iot-widgets/get-image-tenet";
  }

  return "/iot-widgets/get-image";
}

/**
 * Builds ordered `image_url` candidates for `POST /iot-widgets/get-image`.
 * Tries **basename** first (legacy contract), then **relative path** after `tb-image;` (e.g. `api/images/tenant/…`).
 */
export function buildGetImageUrlCandidates(image: string | null | undefined): string[] {
  if (!image || typeof image !== "string") return [];
  const trimmed = image.trim();
  const semi = trimmed.indexOf(";");
  let path = (semi >= 0 ? trimmed.slice(semi + 1) : trimmed).trim();
  if (!path) return [];

  const pushUnique = (list: string[], value: string | null | undefined) => {
    const v = value?.trim();
    if (!v || list.includes(v)) return;
    list.push(v);
  };

  const out: string[] = [];

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const { pathname } = new URL(path);
      const segs = pathname.split("/").filter(Boolean);
      pushUnique(out, segs.length > 0 ? segs[segs.length - 1]! : null);
      pushUnique(out, pathname.replace(/^\/+/, ""));
    } catch {
      const segs = path.split("/").filter(Boolean);
      pushUnique(out, segs.length > 0 ? segs[segs.length - 1]! : null);
    }
    return out.filter(isPlausibleGetImagePayload);
  }

  const rel = path.replace(/^\/+/, "");
  const segments = rel.split("/").filter(Boolean);
  const basename = segments.length > 0 ? segments[segments.length - 1]! : null;
  pushUnique(out, basename);
  if (rel && rel !== basename) pushUnique(out, rel);

  return out.filter(isPlausibleGetImagePayload);
}

function isPlausibleGetImagePayload(s: string): boolean {
  if (!s || s.length > 900 || /[\r\n]/.test(s)) return false;
  if (s.includes("..")) return false;
  const last = s.split("/").pop() ?? s;
  const hasImageExt = /\.(svg|png|jpe?g|gif|webp)(\?[^/]*)?$/i.test(last);
  if (s.includes("/")) {
    return (
      /(?:^|\/)(api\/)?images\//i.test(s) ||
      hasImageExt ||
      /^[\w./()\- %]+\.(svg|png|jpe?g|gif|webp)$/i.test(s)
    );
  }
  return hasImageExt;
}

/**
 * Primary payload (first candidate), e.g. basename `air_quality_widgets_bundle.svg`.
 * @deprecated Prefer {@link buildGetImageUrlCandidates} when multiple strategies are needed.
 */
export function widgetBundleImageRefToImageUrl(image: string | null | undefined): string | null {
  const c = buildGetImageUrlCandidates(image);
  return c[0] ?? null;
}

/**
 * True when we should attempt widget preview fetch for this ref.
 * System paths use `/iot-widgets/get-image`; tenant paths use `/iot-widgets/get-image-tenet`.
 */
export function isRenderableTbWidgetImageRef(image: string | null | undefined): boolean {
  if (!image || typeof image !== "string") return false;
  const t = image.trim();
  if (!t || t.length > 4096 || /[\r\n]/.test(t)) return false;
  if (t.length > 800 && !t.includes("tb-image;") && !/(?:^|\/)(api\/)?images\//i.test(t) && !/\.(svg|png|jpe?g|gif|webp)/i.test(t)) {
    return false;
  }
  return buildGetImageUrlCandidates(t).length > 0;
}

/** Matches `deprecated_filter` on `POST /iot-widgets/list-widget-types`. */
export type WidgetDeprecatedFilter = "ALL" | "ACTUAL" | "DEPRECATED";

export type WidgetTypeListParams = {
  page?: number;
  page_size?: number;
  sort_property?: string;
  sort_order?: "ASC" | "DESC";
  tenant_only?: boolean;
  full_search?: boolean;
  scada_first?: boolean;
  deprecated_filter?: WidgetDeprecatedFilter;
  /** When set, scopes types to one widgets bundle (ThingsBoard `widgetsBundleId`). */
  widgets_bundle_id?: string;
};

export type WidgetTypeBundleLite = {
  id?: TbEntityRef | null;
  name?: string | null;
};

export type WidgetTypeSummary = {
  /** Stable row id when API returns `id` (entity ref). */
  typeId?: string;
  /** May be dotted (`system.charts.foo`) or a short alias (`4way_nozzle2`). */
  fqn: string;
  name: string;
  description: string;
  deprecated: boolean;
  image: string | null;
  /** Widget bundles this type belongs to (from `list-widget-types`). */
  bundles?: WidgetTypeBundleLite[];
};

export type WidgetTypePage = {
  data: WidgetTypeSummary[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

function normalizeWidgetTypeRow(row: Record<string, unknown>): WidgetTypeSummary | null {
  const fqnRaw =
    (typeof row.fullFqn === "string" && row.fullFqn.trim()) ||
    (typeof row.fqn === "string" && row.fqn.trim()) ||
    "";
  if (!fqnRaw) return null;

  const typeId = entityIdFromTb(row.id);

  const name =
    (typeof row.name === "string" && row.name.trim()) ||
    (typeof row.title === "string" && row.title.trim()) ||
    fqnRaw.split(".").pop() ||
    "Widget";
  const description = typeof row.description === "string" ? row.description : "";
  const deprecated =
    row.deprecated === true || row.deprecated === "true" || row.deprecated === 1 || row.deprecated === "1";

  const bundlesRaw = Array.isArray(row.bundles) ? row.bundles : [];
  const bundles: WidgetTypeBundleLite[] = bundlesRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const b = item as Record<string, unknown>;
      const entry: WidgetTypeBundleLite = {
        id: (b.id as TbEntityRef) ?? null,
        name: typeof b.name === "string" ? b.name : null,
      };
      return entry;
    })
    .filter((b): b is WidgetTypeBundleLite => b !== null);

  const image: string | null = typeof row.image === "string" ? row.image.trim() : null;

  return {
    typeId: typeId || undefined,
    fqn: fqnRaw,
    name,
    description,
    deprecated,
    image,
    bundles: bundles.length > 0 ? bundles : undefined,
  };
}

function normalizeWidgetTypesPage(raw: unknown): WidgetTypePage {
  if (!raw || typeof raw !== "object") {
    return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
  }
  const page = raw as Record<string, unknown>;
  const rawData = Array.isArray(page.data) ? page.data : [];
  const data: WidgetTypeSummary[] = [];
  for (const item of rawData) {
    if (!item || typeof item !== "object") continue;
    const normalized = normalizeWidgetTypeRow(item as Record<string, unknown>);
    if (normalized) data.push(normalized);
  }
  return {
    data,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : undefined,
    totalElements: typeof page.totalElements === "number" ? page.totalElements : undefined,
    hasNext: typeof page.hasNext === "boolean" ? page.hasNext : undefined,
  };
}

export type WidgetTypeInfosListParams = {
  page?: number;
  page_size?: number;
  /** ThingsBoard widgets bundle id (required). */
  widgets_bundle_id: string;
  full_search?: boolean;
  deprecated_filter?: WidgetDeprecatedFilter;
};

/** POST `/iot-widgets/list-widget-types-infos` — bundle-scoped widget type rows (same shape as `list-widget-types` pages). */
export async function listWidgetTypesInfos(params: WidgetTypeInfosListParams): Promise<WidgetTypePage> {
  const id = params.widgets_bundle_id?.trim();
  if (!id) {
    return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
  }
  const body: Record<string, unknown> = {
    page: params.page ?? 0,
    page_size: params.page_size ?? 20,
    widgets_bundle_id: id,
    full_search: params.full_search ?? false,
    deprecated_filter: params.deprecated_filter ?? "ALL",
  };
  try {
    const { data } = await client.post<unknown>("/iot-widgets/list-widget-types-infos", body);
    return normalizeWidgetTypesPage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** POST `/iot-widgets/get-widget-type` — body `{ widget_id }`. */
export async function getWidgetType(widgetId: string): Promise<Record<string, unknown>> {
  try {
    const { data } = await client.post<Record<string, unknown>>("/iot-widgets/get-widget-type", {
      widget_id: widgetId,
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function listWidgetTypes(params: Partial<WidgetTypeListParams> = {}): Promise<WidgetTypePage> {
  const body: Record<string, unknown> = {
    page: params.page ?? 0,
    page_size: params.page_size ?? 50,
    sort_property: params.sort_property ?? "name",
    sort_order: params.sort_order ?? "ASC",
    tenant_only: params.tenant_only ?? false,
    full_search: params.full_search ?? false,
    scada_first: params.scada_first ?? false,
    deprecated_filter: params.deprecated_filter ?? "ALL",
  };
  if (params.widgets_bundle_id?.trim()) {
    body.widgets_bundle_id = params.widgets_bundle_id.trim();
  }
  try {
    const { data } = await client.post<unknown>("/iot-widgets/list-widget-types", body);
    return normalizeWidgetTypesPage(data);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** POST `/iot-widgets/get-image` or `/iot-widgets/get-image-tenet` — body `{ image_url }`; returns image bytes. */
async function postIotWidgetsImage(endpoint: "/iot-widgets/get-image" | "/iot-widgets/get-image-tenet", imageUrl: string): Promise<Blob> {
  try {
    const { data } = await client.post<Blob>(endpoint, { image_url: imageUrl }, { responseType: "blob" });
    if (data instanceof Blob && data.type.includes("application/json")) {
      const text = await data.text();
      let message = text || "Widget image failed";
      try {
        const parsed = JSON.parse(text) as { detail?: unknown };
        if (parsed?.detail != null) message = String(parsed.detail);
      } catch {
        /* use raw */
      }
      throw new Error(message.length > 500 ? `${message.slice(0, 500)}…` : message);
    }
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

/** System-scoped widget artwork (`/api/images/system/…`). */
export async function getIotWidgetsImage(imageUrl: string): Promise<Blob> {
  return postIotWidgetsImage("/iot-widgets/get-image", imageUrl);
}

/** Tenant-scoped widget artwork (`/api/images/tenant/…`). */
export async function getIotWidgetsImageTenant(imageUrl: string): Promise<Blob> {
  return postIotWidgetsImage("/iot-widgets/get-image-tenet", imageUrl);
}

const iotWidgetImageBlobCache = new Map<string, Promise<Blob | null>>();

/** Loads artwork; routes to `get-image` (system) or `get-image-tenet` (tenant) from the ref path. */
export async function getIotWidgetsImageFromBundleRef(imageRef: string | null | undefined): Promise<Blob | null> {
  if (!isRenderableTbWidgetImageRef(imageRef)) return null;
  const key = imageRef!.trim();
  const hit = iotWidgetImageBlobCache.get(key);
  if (hit) return hit;

  const pending = (async (): Promise<Blob | null> => {
    const endpoint = resolveTbWidgetImageEndpoint(key);
    const candidates = buildGetImageUrlCandidates(imageRef!);
    for (const image_url of candidates) {
      try {
        return await postIotWidgetsImage(endpoint, image_url);
      } catch {
        /* try next candidate */
      }
    }
    iotWidgetImageBlobCache.delete(key);
    return null;
  })();

  iotWidgetImageBlobCache.set(key, pending);
  return pending;
}

export async function importDashboard(file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await client.post<unknown>("/iot-dashboard/import-dashboard", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    if (response.status === 204) return null;

    const data = response.data;
    throwIfApiErrorResponse(data as ApiErrorResponse, "Failed to import dashboard");
    return data;
  } catch (error) {
    await rethrowApiError(error, "Failed to import dashboard");
  }
}

export async function exportDashboardFile(
  dashboardId: string,
  includeResources: boolean,
): Promise<{ blob: Blob; filename: string }> {
  try {
    const response = await client.post<Blob>(
      "/iot-dashboard/export-dashboard",
      {
        dashboard_id: dashboardId,
        include_resources: includeResources,
      },
      {
        responseType: "blob",
      },
    );

    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers?.["content-disposition"],
        `dashboard-${dashboardId}.json`,
      ),
    };
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

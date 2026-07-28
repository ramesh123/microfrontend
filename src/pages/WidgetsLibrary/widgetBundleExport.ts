import axios, { isAxiosError } from "axios";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { API_BASE_URL } from "@/controllers/API/api";
import {
  bundleTitleFromDetail,
  type WidgetBundleTableRow,
  widgetsBundleIdFromRecord,
  widgetsFromBundleDetail,
} from "./tableModels";

type WidgetBundleDetail = Record<string, unknown>;

type WidgetTypesPage = {
  data: Record<string, unknown>[];
};

const widgetsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

widgetsClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.set("authentication", token);
  }
  return config;
});

export function widgetBundleExportErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data;
    if (detail && typeof detail === "object" && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  return getDisplayErrorMessage(error, "Request failed");
}

export function resolveWidgetsBundleId(bundle: WidgetBundleTableRow): string {
  return widgetsBundleIdFromRecord(bundle.raw) || bundle.id.trim();
}

export function downloadJsonFile(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchWidgetBundleDetail(bundleId: string): Promise<WidgetBundleDetail> {
  const id = bundleId.trim();
  if (!id) throw new Error("Widget bundle id is required.");

  const { data } = await widgetsClient.post<unknown>("/iot-widgets/get-widget-bundle", {
    widget_bundle_id: id,
    widgets_bundle_id: id,
  });
  return (data ?? {}) as WidgetBundleDetail;
}

async function fetchWidgetTypesForBundle(bundleId: string): Promise<WidgetTypesPage> {
  const id = bundleId.trim();
  if (!id) return { data: [] };

  const { data } = await widgetsClient.post<unknown>("/iot-widgets/list-widget-types-infos", {
    page: 0,
    page_size: 100,
    widgets_bundle_id: id,
    full_search: false,
    deprecated_filter: "ALL",
  });

  if (!data || typeof data !== "object") return { data: [] };

  const page = data as Record<string, unknown>;
  const rows = Array.isArray(page.data) ? page.data : [];
  return {
    data: rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object"),
  };
}

export type WidgetBundleExportOptions = {
  includeWidgets?: boolean;
  fallbackTitle?: string;
};

export async function buildWidgetBundleExportPayload(
  bundle: WidgetBundleTableRow,
  options: WidgetBundleExportOptions = {},
): Promise<{ payload: Record<string, unknown>; filename: string; title: string }> {
  const bundleId = resolveWidgetsBundleId(bundle);
  if (!bundleId) throw new Error("Widget bundle id is missing.");

  const includeWidgets = options.includeWidgets ?? true;
  const fallbackTitle = options.fallbackTitle ?? bundle.title;

  const detail = await fetchWidgetBundleDetail(bundleId);
  const title = bundleTitleFromDetail(detail, fallbackTitle);

  let widgetsInBundle: Record<string, unknown>[] | undefined;
  if (includeWidgets) {
    const typesPage = await fetchWidgetTypesForBundle(bundleId);
    widgetsInBundle =
      typesPage.data.length > 0
        ? typesPage.data
        : widgetsFromBundleDetail(detail).map((widget) => widget.raw);
  }

  const payload: Record<string, unknown> = {
    ...detail,
    widgets_bundle_id: bundleId,
    exportedAt: new Date().toISOString(),
  };
  if (widgetsInBundle !== undefined) {
    payload.widgets = widgetsInBundle;
  }

  const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_bundle.json`;
  return { payload, filename, title };
}

export async function exportWidgetBundle(
  bundle: WidgetBundleTableRow,
  options: WidgetBundleExportOptions = {},
): Promise<string> {
  const { payload, filename, title } = await buildWidgetBundleExportPayload(bundle, options);
  downloadJsonFile(payload, filename);
  return title;
}

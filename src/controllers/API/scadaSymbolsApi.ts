import axios, { type AxiosInstance } from "axios";

import { API_BASE_URL } from "./api";
import {
  ApiRequestError,
  assertBlobNotApiError,
  executeApiRequestSilent,
  rethrowApiError,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";

const base = `${API_BASE_URL.replace(/\/$/, "")}/iot-scada-symbols`;

const client: AxiosInstance = axios.create({
  baseURL: base,
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
const scadaSymbolsReadInflight = new Map<string, Promise<unknown>>();

function dedupeRead<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = scadaSymbolsReadInflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      return await run();
    } finally {
      scadaSymbolsReadInflight.delete(key);
    }
  })();
  scadaSymbolsReadInflight.set(key, p);
  return p;
}

/** JSON export responses are real JSON; only treat API error shapes as failures. */
function blobFromJsonExportResponse(body: string): Blob {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return new Blob([body], { type: "application/json;charset=utf-8" });
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      if ("detail" in o || "error" in o || o.status === false || o.exception_code) {
        const message = resolveApiErrorMessage(o, "Export failed");
        throw new ApiRequestError(message, o);
      }
    }
  }
  return new Blob([body], { type: "application/json;charset=utf-8" });
}

export type ScadaSymbolListItem = {
  resourceKey: string;
  title: string;
  createdTime?: number;
  imageSubType?: string;
  raw: Record<string, unknown>;
};

function stringVal(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function normalizeListPayload(raw: unknown): { rows: ScadaSymbolListItem[]; totalElements: number; totalPages: number } {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const inner =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const arr = (Array.isArray(inner.data) ? inner.data : Array.isArray(root.data) ? root.data : []) as Record<string, unknown>[];
  const rows: ScadaSymbolListItem[] = arr.map((item) => {
    const resourceKey = stringVal(item.resourceKey ?? item.resource_key ?? item.name ?? item.fileName).trim() || "—";
    const title = stringVal(item.title ?? item.name ?? resourceKey).trim() || resourceKey;
    const createdTime =
      typeof item.createdTime === "number"
        ? item.createdTime
        : typeof item.created_time === "number"
          ? item.created_time
          : undefined;
    return {
      resourceKey,
      title,
      createdTime,
      imageSubType: stringVal(item.imageSubType ?? item.image_sub_type) || undefined,
      raw: item,
    };
  });
  const totalElements =
    typeof inner.totalElements === "number"
      ? inner.totalElements
      : typeof inner.total_elements === "number"
        ? inner.total_elements
        : typeof root.totalElements === "number"
          ? root.totalElements
          : rows.length;
  const totalPages =
    typeof inner.totalPages === "number"
      ? inner.totalPages
      : typeof inner.total_pages === "number"
        ? inner.total_pages
        : Math.max(1, Math.ceil(totalElements / 20));
  return { rows, totalElements, totalPages };
}

export async function getScadaSymbolsList(payload: {
  page_size: number;
  page: number;
  sort_property?: string;
  sort_order?: "ASC" | "DESC";
  image_sub_type?: string;
  include_system_images?: boolean;
  text_search?: string;
}): Promise<{ rows: ScadaSymbolListItem[]; totalElements: number; totalPages: number }> {
  const body = {
    page_size: payload.page_size,
    page: payload.page,
    sort_property: payload.sort_property ?? "createdTime",
    sort_order: payload.sort_order ?? "DESC",
    image_sub_type: payload.image_sub_type ?? "SCADA_SYMBOL",
    include_system_images: payload.include_system_images ?? false,
    text_search: payload.text_search?.trim() ?? "",
  };
  const key = [
    "list",
    body.page,
    body.page_size,
    body.sort_property,
    body.sort_order,
    body.image_sub_type,
    body.include_system_images,
    body.text_search,
  ].join("|");
  return dedupeRead(key, async () => {
    const data = await executeApiRequestSilent(
      () => client.post<unknown>("/get-scada-symbols", body),
      "Failed to fetch SCADA symbols",
    );
    return normalizeListPayload(data);
  });
}

/** Binary SVG for `<img src={blobUrl} />`. */
export async function getScadaImageBlob(imageName: string): Promise<Blob> {
  const name = imageName.trim();
  if (!name) throw new Error("image_name is required.");

  const fallbackMessage = "Failed to load SCADA image";
  try {
    const { data, headers } = await client.post<Blob>(
      "/get-scada-images",
      { image_name: name },
      { responseType: "blob" },
    );
    await assertBlobNotApiError(data, fallbackMessage);
    const ct = headers["content-type"] ?? data.type;
    if (ct && !String(ct).includes("svg") && !String(ct).includes("octet-stream")) {
      await assertBlobNotApiError(data, fallbackMessage);
    }
    return data;
  } catch (error) {
    await rethrowApiError(error, fallbackMessage);
  }
}

export async function getSpecificScadaSymbolSvgText(name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error("name is required.");

  const data = await executeApiRequestSilent(
    () => client.post<string>("/get-specific-scada-symbol", { name: n }, { responseType: "text" }),
    "Failed to load SCADA symbol",
  );
  return typeof data === "string" ? data : String(data);
}

export async function getSpecificScadaSymbolInfo(name: string): Promise<Record<string, unknown>> {
  const n = name.trim();
  if (!n) throw new Error("name is required.");

  const data = await executeApiRequestSilent(
    () => client.post<unknown>("/get-specific-scada-symbol-info", { name: n }),
    "Failed to load SCADA symbol info",
  );
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

export async function modifySpecificScadaSymbol(fileName: string, svgContent: string): Promise<unknown> {
  return executeApiRequestSilent(
    () =>
      client.post<unknown>("/modify-specific-scada-symbol", {
        file_name: fileName.trim(),
        svg_content: svgContent,
      }),
    "Failed to modify SCADA symbol",
  );
}

async function postMultipart(path: string, fieldName: string, file: File): Promise<unknown> {
  const form = new FormData();
  form.append(fieldName, file);
  return executeApiRequestSilent(
    () =>
      client.post<unknown>(path, form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    "Failed to upload file",
  );
}

export async function uploadScadaSymbolSvg(file: File): Promise<unknown> {
  return postMultipart("/upload-scada-symbol-svg", "svg_file", file);
}

export async function importScadaSymbolFromJson(file: File): Promise<unknown> {
  return postMultipart("/import-scada-symbol-from-json", "json_file", file);
}

export async function exportScadaSymbolAsJsonBlob(fileName: string): Promise<Blob> {
  const n = fileName.trim();
  if (!n) throw new Error("file_name is required.");

  const fallbackMessage = "Failed to export SCADA symbol";
  try {
    const { data } = await client.post<Blob>("/export-scada-symbol-as-json", { file_name: n }, { responseType: "blob" });
    const text = await data.text();
    return blobFromJsonExportResponse(text);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    await rethrowApiError(error, fallbackMessage);
  }
}

export async function downloadScadaSymbolSvgBlob(fileName: string): Promise<Blob> {
  const n = fileName.trim();
  if (!n) throw new Error("file_name is required.");

  const fallbackMessage = "Failed to download SCADA symbol";
  try {
    const { data } = await client.post<Blob>("/download-scada-symbol-svg", { file_name: n }, { responseType: "blob" });
    await assertBlobNotApiError(data, fallbackMessage);
    return data;
  } catch (error) {
    await rethrowApiError(error, fallbackMessage);
  }
}

export async function deleteScadaSymbol(fileName: string): Promise<unknown> {
  const n = fileName.trim();
  if (!n) throw new Error("file_name is required.");

  return executeApiRequestSilent(
    () => client.post<unknown>("/delete-scada-symbol", { file_name: n }),
    "Failed to delete SCADA symbol",
  );
}

import axios, { type AxiosInstance, isAxiosError } from "axios";
import { API_BASE_URL } from "./api";

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
    return e.message;
  }
  return e instanceof Error ? e.message : "Request failed";
}

export type TbPageData<T> = {
  data?: T[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

function normalizePage<T>(raw: unknown): TbPageData<T> {
  if (!raw || typeof raw !== "object") return { data: [], totalElements: 0 };
  const o = raw as Record<string, unknown>;
  const data = (Array.isArray(o.data) ? o.data : Array.isArray(o.content) ? o.content : []) as T[];
  const totalElements =
    typeof o.totalElements === "number"
      ? o.totalElements
      : typeof o.total_elements === "number"
        ? o.total_elements
        : typeof o.total === "number"
          ? o.total
          : data.length;

  return {
    data,
    totalElements,
    totalPages:
      typeof o.totalPages === "number"
        ? o.totalPages
        : typeof o.total_pages === "number"
          ? o.total_pages
          : undefined,
    hasNext: typeof o.hasNext === "boolean" ? o.hasNext : undefined,
  };
}

export type WidgetTypeRecord = Record<string, unknown>;
export type WidgetBundleRecord = Record<string, unknown>;

export type ListWidgetTypesParams = {
  page?: number;
  page_size?: number;
  sort_property?: string;
  sort_order?: string;
  tenant_only?: boolean;
  full_search?: boolean;
  scada_first?: boolean;
  deprecated_filter?: string;
  text_search?: string;
};

const listWidgetTypesInflight = new Map<string, Promise<TbPageData<WidgetTypeRecord>>>();

export async function listWidgetTypes(
  params: ListWidgetTypesParams = {},
): Promise<TbPageData<WidgetTypeRecord>> {
  const body = {
    page: params.page ?? 0,
    page_size: params.page_size ?? 50,
    sort_property: params.sort_property ?? "name",
    sort_order: params.sort_order ?? "ASC",
    tenant_only: params.tenant_only ?? false,
    full_search: params.full_search ?? false,
    scada_first: params.scada_first ?? false,
    deprecated_filter: params.deprecated_filter ?? "ALL",
    text_search: params.text_search ?? "",
  };

  const key = JSON.stringify(body);
  const hit = listWidgetTypesInflight.get(key);
  if (hit) return hit;

  const request = (async () => {
    try {
      const { data } = await client.post<unknown>("/iot-widgets/list-widget-types", body);
      return normalizePage<WidgetTypeRecord>(data);
    } catch (e) {
      throw new Error(toErr(e));
    } finally {
      listWidgetTypesInflight.delete(key);
    }
  })();

  listWidgetTypesInflight.set(key, request);
  return request;
}

export type ListWidgetBundlesParams = {
  page?: number;
  page_size?: number;
  sort_property?: string;
  sort_order?: string;
  tenant_only?: boolean;
  full_search?: boolean;
  scada_first?: boolean;
};

const listWidgetBundlesInflight = new Map<string, Promise<TbPageData<WidgetBundleRecord>>>();

export async function listWidgetBundles(
  params: ListWidgetBundlesParams = {},
): Promise<TbPageData<WidgetBundleRecord>> {
  const body = {
    page: params.page ?? 0,
    page_size: params.page_size ?? 50,
    sort_property: params.sort_property ?? "title",
    sort_order: params.sort_order ?? "ASC",
    tenant_only: params.tenant_only ?? false,
    full_search: params.full_search ?? false,
    scada_first: params.scada_first ?? false,
  };

  const key = JSON.stringify(body);
  const hit = listWidgetBundlesInflight.get(key);
  if (hit) return hit;

  const request = (async () => {
    try {
      const { data } = await client.post<unknown>("/iot-widgets/list-widgets-bundles", body);
      return normalizePage<WidgetBundleRecord>(data);
    } catch (e) {
      throw new Error(toErr(e));
    } finally {
      listWidgetBundlesInflight.delete(key);
    }
  })();

  listWidgetBundlesInflight.set(key, request);
  return request;
}

export async function deleteWidget(widgetId: string): Promise<void> {
  try {
    await client.post("/iot-widgets/delete-widget", {
      widget_id: widgetId,
    });
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function getWidgetType(widgetId: string): Promise<WidgetTypeRecord> {
  try {
    const { data } = await client.post<unknown>("/iot-widgets/get-widget-type", {
      widget_id: widgetId,
    });
    return (data ?? {}) as WidgetTypeRecord;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function getWidgetImage(imageUrl: string): Promise<string> {
  try {
    console.log('Fetching image with URL:', imageUrl);
    
    // First, try to get the response as blob for binary images
    const { data, headers } = await client.post<any>("/iot-widgets/get-image", {
      image_url: imageUrl,
    }, {
      responseType: 'blob',
    });
    
    console.log('Image API response type:', typeof data);
    console.log('Image API content-type:', headers?.['content-type']);
    
    // If we got a Blob response (binary data like PNG, JPG, etc.)
    if (data instanceof Blob) {
      const contentType = data.type || headers?.['content-type'] || '';
      console.log('Blob content type:', contentType);
      
      // If it's an image type (png, jpg, jpeg, gif, webp, etc.)
      if (contentType.startsWith('image/')) {
        console.log('Converting image blob to URL');
        const blobUrl = URL.createObjectURL(data);
        console.log('Created blob URL:', blobUrl);
        return blobUrl;
      }
      
      // If it's text (could be SVG or other text response), convert to text first
      const text = await data.text();
      console.log('Blob text content (first 100 chars):', text.substring(0, 100));
      
      // Check if it's SVG
      if (text.trim().startsWith('<svg')) {
        console.log('Converting SVG text to blob URL');
        const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        console.log('Created SVG blob URL:', svgUrl);
        return svgUrl;
      }
      
      // Check if it's a base64 data URL
      if (text.startsWith('data:image')) {
        console.log('Image is base64 data URL');
        return text;
      }
      
      // Check if it's a plain base64 string (without data URL prefix)
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(text.substring(0, 100))) {
        console.log('Converting base64 string to data URL');
        // Determine image type from filename if possible
        const ext = imageUrl.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                        ext === 'svg' ? 'image/svg+xml' : 
                        `image/${ext}`;
        return `data:${mimeType};base64,${text}`;
      }
      
      // Try to parse as JSON (in case the API returned JSON in blob format)
      try {
        const jsonData = JSON.parse(text);
        if (jsonData.image || jsonData.data || jsonData.url) {
          const actualData = jsonData.image || jsonData.data || jsonData.url;
          console.log('Extracted image from JSON:', actualData);
          
          if (typeof actualData === 'string' && actualData.trim().startsWith('<svg')) {
            const svgBlob = new Blob([actualData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            return svgUrl;
          }
          
          if (typeof actualData === 'string' && actualData.startsWith('data:image')) {
            return actualData;
          }
          
          return actualData;
        }
      } catch {
        // Not JSON, continue
      }
      
      console.log('Returning text as-is');
      return text;
    }
    
    console.log('Unexpected response format');
    return '';
  } catch (e) {
    console.error('Error in getWidgetImage:', e);
    throw new Error(toErr(e));
  }
}

export async function getWidgetImageInfo(imageUrl: string): Promise<Record<string, unknown>> {
  try {
    console.log('Fetching image info with URL:', imageUrl);
    
    const { data } = await client.post<unknown>("/iot-widgets/get-image-info", {
      image_url: imageUrl,
    });
    
    console.log('Image info API response:', data);
    return (data ?? {}) as Record<string, unknown>;
  } catch (e) {
    console.error('Error in getWidgetImageInfo:', e);
    throw new Error(toErr(e));
  }
}

export type CreateWidgetParams = {
  name: string;
  type: string;
  description?: string;
  templateHtml?: string;
  templateCss?: string;
  controllerScript?: string;
  resources?: unknown[];
};

export async function createWidget(params: CreateWidgetParams): Promise<WidgetTypeRecord> {
  try {
    const { data } = await client.post<unknown>("/iot-widgets/create-widget", {
      name: params.name,
      type: params.type,
      description: params.description || "",
      template_html: params.templateHtml || "",
      template_css: params.templateCss || "",
      controller_script: params.controllerScript || "",
      resources: params.resources || [],
    });
    return (data ?? {}) as WidgetTypeRecord;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function createWidgetType(params: Record<string, unknown>): Promise<WidgetTypeRecord> {
  try {
    const { data } = await client.post<unknown>("/iot-widgets/create-widget-type", params);
    return (data ?? {}) as WidgetTypeRecord;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

export async function saveWidgetType(params: Record<string, unknown>): Promise<WidgetTypeRecord> {
  try {
    const { widgetsBundleId, ...rest } = params;
    const payload = {
      ...rest,
      ...(widgetsBundleId !== undefined ? { widgets_bundle_id: widgetsBundleId } : {}),
    };
    const { data } = await client.post<unknown>("/iot-widgets/save-widget-type", payload);
    return (data ?? {}) as WidgetTypeRecord;
  } catch (e) {
    throw new Error(toErr(e));
  }
}

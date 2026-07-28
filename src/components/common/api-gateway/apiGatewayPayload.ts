import type { ApiConnectorKeyValueRow } from "@/utils/apiConnectorPayload";
import {
  apiConnectorMapToKeyValueRows,
  apiConnectorKeyValueRowsToMap,
} from "@/utils/apiConnectorPayload";
import type { DropdownOption, FieldTemplate } from "@/types/form";

export type HttpMethod = string;
export type AuthType = string;

export type ApiGatewayFormState = {
  base_url: string;
  path: string;
  http_method: HttpMethod;
  path_params: Record<string, string>;
  query_params: ApiConnectorKeyValueRow[];
  auth_type: AuthType;
  auth_credentials: Record<string, string>;
  headers: ApiConnectorKeyValueRow[];
  route_name: string;
  collection_name: string;
};

export type ApiGatewayAuthOption = {
  id: string;
  title: string;
  description: string;
};

export type ApiGatewayFieldMeta = {
  key: string;
  display_name: string;
  placeholder: string;
  info: string;
  options: DropdownOption[];
};

export type ApiGatewayUiMeta = {
  baseUrl: ApiGatewayFieldMeta | null;
  path: ApiGatewayFieldMeta | null;
  httpMethod: ApiGatewayFieldMeta | null;
  pathParams: ApiGatewayFieldMeta | null;
  queryParams: ApiGatewayFieldMeta | null;
  authType: ApiGatewayFieldMeta | null;
  headers: ApiGatewayFieldMeta | null;
  routeName: ApiGatewayFieldMeta | null;
  collectionName: ApiGatewayFieldMeta | null;
  httpMethods: string[];
  authOptions: ApiGatewayAuthOption[];
  /** Optional section copy from template `info` / display names */
  sections: {
    endpoint: { title: string; description: string };
    method: { title: string; description: string };
    parameters: { title: string; description: string };
    authentication: { title: string; description: string };
    export: { title: string; description: string };
    summary: { title: string; liveLabel: string };
  };
};

type TemplateMap = Record<string, FieldTemplate | { value?: unknown }>;

const PLACEHOLDER_RE = /^{{[\s\S]+}}$/;

const FIELD_ALIASES: Record<keyof Omit<ApiGatewayUiMeta, "httpMethods" | "authOptions" | "sections">, string[]> = {
  baseUrl: ["base_url", "url", "host", "baseUrl"],
  path: ["path", "route_path", "url_path"],
  httpMethod: ["http_method", "method"],
  pathParams: ["path_params"],
  queryParams: ["params", "query_params"],
  authType: ["auth_type", "authentication", "auth"],
  headers: ["headers"],
  routeName: ["route_name", "name"],
  collectionName: ["collection_name", "postman_collection_name"],
};

function stripPlaceholder(val: unknown): string {
  if (val == null) return "";
  const s = String(val).trim();
  if (PLACEHOLDER_RE.test(s)) return "";
  return s;
}

function isFieldTemplate(v: unknown): v is FieldTemplate {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as FieldTemplate).key === "string" &&
    typeof (v as FieldTemplate).type === "string"
  );
}

function findTemplateField(
  template: TemplateMap | null | undefined,
  aliases: string[],
): FieldTemplate | null {
  if (!template || typeof template !== "object") return null;
  for (const alias of aliases) {
    const entry = template[alias];
    if (isFieldTemplate(entry)) return entry;
    // Some backends key the map by field key while the object also has `.key`
    if (entry && typeof entry === "object" && "display_name" in entry) {
      return entry as FieldTemplate;
    }
  }
  for (const entry of Object.values(template)) {
    if (!isFieldTemplate(entry)) continue;
    if (aliases.includes(entry.key) || aliases.includes(entry.originalKey ?? "")) {
      return entry;
    }
  }
  return null;
}

function fieldMetaFromTemplate(field: FieldTemplate | null, fallbackKey: string): ApiGatewayFieldMeta | null {
  if (!field) return null;
  return {
    key: field.key || fallbackKey,
    display_name: field.display_name || fallbackKey,
    placeholder: field.placeholder ?? "",
    info: field.info ?? "",
    options: Array.isArray(field.options) ? field.options : [],
  };
}

function normalizeOptions(options: unknown): DropdownOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (typeof o === "string" || typeof o === "number") {
        const value = String(o).trim();
        return { value, label: value };
      }
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        const value = String(rec.value ?? rec.id ?? rec.key ?? "").trim();
        const label = String(rec.label ?? rec.name ?? rec.display_name ?? value).trim();
        return { value, label };
      }
      return { value: "", label: "" };
    })
    .filter((o) => o.value !== "");
}

function pickString(payload: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const v = stripPlaceholder(payload[key]);
    if (v) return v;
  }
  return fallback;
}

function mergeTemplatePayload(
  payload: Record<string, unknown> | null | undefined,
  template?: TemplateMap | null,
): Record<string, unknown> {
  const fromTemplate: Record<string, unknown> = {};
  if (template && typeof template === "object") {
    for (const [k, v] of Object.entries(template)) {
      if (v == null || typeof v !== "object") continue;
      if (isFieldTemplate(v)) {
        fromTemplate[v.key || k] = v.value ?? "";
      } else if ("value" in v) {
        fromTemplate[k] = (v as { value?: unknown }).value ?? "";
      }
    }
  }
  return { ...fromTemplate, ...(payload ?? {}) };
}

export function extractPathPlaceholders(path: string): string[] {
  const names: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) != null) {
    const name = m[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function sectionFromFields(
  titleFallback: string,
  fields: Array<ApiGatewayFieldMeta | null>,
): { title: string; description: string } {
  const first = fields.find(Boolean) ?? null;
  // Prefer a dedicated section-like display_name only when it looks like a section title;
  // otherwise use the first field's display_name group via info.
  const description = fields.map((f) => f?.info).find((s) => s && s.trim()) ?? "";
  return {
    title: titleFallback,
    description,
  };
}

/**
 * Resolve labels, placeholders, HTTP methods, and auth options from backend template JSON.
 */
export function resolveApiGatewayUiMeta(
  template?: TemplateMap | null,
  nodeDisplayName?: string,
): ApiGatewayUiMeta {
  const baseUrl = fieldMetaFromTemplate(findTemplateField(template, FIELD_ALIASES.baseUrl), "base_url");
  const path = fieldMetaFromTemplate(findTemplateField(template, FIELD_ALIASES.path), "path");
  const httpMethod = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.httpMethod),
    "http_method",
  );
  const pathParams = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.pathParams),
    "path_params",
  );
  const queryParams = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.queryParams),
    "params",
  );
  const authType = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.authType),
    "auth_type",
  );
  const headers = fieldMetaFromTemplate(findTemplateField(template, FIELD_ALIASES.headers), "headers");
  const routeName = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.routeName),
    "route_name",
  );
  const collectionName = fieldMetaFromTemplate(
    findTemplateField(template, FIELD_ALIASES.collectionName),
    "collection_name",
  );

  const methodOptions = normalizeOptions(httpMethod?.options);
  const httpMethods = methodOptions.map((o) => o.value.toUpperCase());

  const authOptionEntries = normalizeOptions(authType?.options);
  const authOptions: ApiGatewayAuthOption[] = authOptionEntries.map((o) => ({
    id: o.value,
    title: o.label || o.value,
    description: "",
  }));

  // Optional richer auth descriptions if backend sends `info` on auth field with JSON map
  if (authType?.info) {
    try {
      const parsed = JSON.parse(authType.info) as Record<string, string>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const opt of authOptions) {
          if (parsed[opt.id]) opt.description = String(parsed[opt.id]);
        }
      }
    } catch {
      // plain info string used as section description instead
    }
  }

  const exportField =
    findTemplateField(template, ["postman_export", "export_postman", "export"]) ?? null;
  const exportMeta = fieldMetaFromTemplate(exportField, "export");

  const summaryTitle =
    stripPlaceholder(nodeDisplayName) ||
    routeName?.display_name ||
    "Route summary";

  return {
    baseUrl,
    path,
    httpMethod,
    pathParams,
    queryParams,
    authType,
    headers,
    routeName,
    collectionName,
    httpMethods,
    authOptions,
    sections: {
      endpoint: {
        title: "Endpoint",
        description:
          [baseUrl?.info, path?.info].find((s) => s && s.trim()) ||
          sectionFromFields("Endpoint", [baseUrl, path]).description,
      },
      method: {
        title: httpMethod?.display_name || "Method",
        description: httpMethod?.info || "",
      },
      parameters: {
        title: queryParams?.display_name || pathParams?.display_name || "Parameters",
        description:
          [queryParams?.info, pathParams?.info].find((s) => s && s.trim()) || "",
      },
      authentication: {
        title: authType?.display_name || "Authentication",
        description:
          authType?.info && !authType.info.trim().startsWith("{")
            ? authType.info
            : "",
      },
      export: {
        title: exportMeta?.display_name || collectionName?.display_name || "Export to Postman",
        description: exportMeta?.info || collectionName?.info || "",
      },
      summary: {
        title: summaryTitle,
        liveLabel: "live",
      },
    },
  };
}

export function hydrateApiGatewayFormState(
  payload: Record<string, unknown> | null | undefined,
  template?: TemplateMap | null,
  uiMeta?: ApiGatewayUiMeta,
): ApiGatewayFormState {
  const merged = mergeTemplatePayload(payload, template);
  const meta = uiMeta ?? resolveApiGatewayUiMeta(template);

  const path = pickString(merged, FIELD_ALIASES.path, "");
  const placeholders = extractPathPlaceholders(path);
  const existingPathParams =
    merged.path_params && typeof merged.path_params === "object" && !Array.isArray(merged.path_params)
      ? (merged.path_params as Record<string, string>)
      : {};

  const path_params: Record<string, string> = {};
  for (const name of placeholders) {
    path_params[name] = stripPlaceholder(existingPathParams[name]) || "";
  }

  let query_params = apiConnectorMapToKeyValueRows(merged.params ?? merged.query_params);
  if (query_params.length === 0) {
    query_params = [{ key: "", value: "" }];
  }

  const headers = apiConnectorMapToKeyValueRows(merged.headers);

  const auth_credentials =
    merged.auth_credentials &&
    typeof merged.auth_credentials === "object" &&
    !Array.isArray(merged.auth_credentials)
      ? Object.fromEntries(
          Object.entries(merged.auth_credentials as Record<string, unknown>).map(([k, v]) => [
            k,
            stripPlaceholder(v),
          ]),
        )
      : {};

  const methods = meta.httpMethods;
  const rawMethod = pickString(merged, FIELD_ALIASES.httpMethod, "").toUpperCase();
  const http_method =
    (methods.includes(rawMethod) ? rawMethod : methods[0]) || rawMethod || "";

  const authIds = meta.authOptions.map((o) => o.id);
  const rawAuth = pickString(merged, FIELD_ALIASES.authType, "").toLowerCase();
  const auth_type =
    (authIds.includes(rawAuth) ? rawAuth : authIds[0]) || rawAuth || "";

  return {
    base_url: pickString(merged, FIELD_ALIASES.baseUrl, ""),
    path,
    http_method,
    path_params,
    query_params,
    auth_type,
    auth_credentials,
    headers,
    route_name: pickString(merged, FIELD_ALIASES.routeName, ""),
    collection_name: pickString(merged, FIELD_ALIASES.collectionName, ""),
  };
}

/** Serialize using actual template field keys when present. */
export function serializeApiGatewayPayload(
  state: ApiGatewayFormState,
  template?: TemplateMap | null,
): Record<string, unknown> {
  const meta = resolveApiGatewayUiMeta(template);
  const params = apiConnectorKeyValueRowsToMap(
    state.query_params.filter((r) => r.key.trim() !== ""),
  );
  const headers =
    state.headers.length > 0
      ? apiConnectorKeyValueRowsToMap(state.headers.filter((r) => r.key.trim() !== ""))
      : {};

  const out: Record<string, unknown> = {
    key: "on-submit",
  };

  const setKey = (metaField: ApiGatewayFieldMeta | null, fallback: string, value: unknown) => {
    out[metaField?.key || fallback] = value;
  };

  setKey(meta.baseUrl, "base_url", state.base_url.trim());
  setKey(meta.path, "path", state.path.trim());
  setKey(meta.httpMethod, "http_method", state.http_method);
  setKey(meta.pathParams, "path_params", state.path_params);
  setKey(meta.queryParams, "params", params);
  setKey(meta.authType, "auth_type", state.auth_type);
  out.auth_credentials = state.auth_credentials;
  setKey(meta.headers, "headers", headers);

  if (state.route_name.trim()) {
    setKey(meta.routeName, "route_name", state.route_name.trim());
  }
  if (state.collection_name.trim()) {
    setKey(meta.collectionName, "collection_name", state.collection_name.trim());
  }

  return out;
}

export function buildRouteUrl(state: ApiGatewayFormState): string {
  let resolvedPath = state.path.trim() || "/";
  for (const [name, value] of Object.entries(state.path_params)) {
    const replacement = value.trim() || `{${name}}`;
    resolvedPath = resolvedPath.split(`{${name}}`).join(replacement);
  }

  const base = state.base_url.trim().replace(/\/$/, "");
  const path = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
  const query = state.query_params
    .filter((r) => r.key.trim() !== "")
    .map((r) => `${encodeURIComponent(r.key.trim())}=${encodeURIComponent(r.value)}`)
    .join("&");

  if (!base && path === "/") return query ? `?${query}` : "";
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}

export function authSummaryLabel(authType: AuthType, options: ApiGatewayAuthOption[]): string {
  const opt = options.find((o) => o.id === authType);
  return opt?.title ?? authType ?? "—";
}

/** Project theme tokens — no hardcoded brand colors. */
export function methodBadgeClass(method: HttpMethod): string {
  const m = method.toUpperCase();
  if (m === "DELETE") {
    return "bg-destructive/10 text-destructive border-destructive/30";
  }
  if (m === "POST") {
    return "bg-primary/15 text-primary border-primary/30";
  }
  if (m === "PUT" || m === "PATCH") {
    return "bg-secondary text-secondary-foreground border-border";
  }
  return "bg-muted text-foreground border-border";
}

export function methodButtonClass(method: HttpMethod, selected: boolean): string {
  if (!selected) return "border-border bg-background text-foreground hover:bg-muted/60";
  const m = method.toUpperCase();
  if (m === "DELETE") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  return "border-primary bg-primary/10 text-primary";
}

function parseUrlParts(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.hostname.split("."),
      port: u.port || undefined,
      path: u.pathname.split("/").filter(Boolean),
      query: Array.from(u.searchParams.entries()).map(([key, value]) => ({ key, value })),
    };
  } catch {
    const pathOnly = rawUrl.split("?")[0] || "";
    const path = pathOnly.replace(/^\//, "").split("/").filter(Boolean);
    return {
      protocol: "",
      host: [] as string[],
      path,
      query: [] as { key: string; value: string }[],
    };
  }
}

export function buildPostmanCollection(state: ApiGatewayFormState) {
  const raw = buildRouteUrl(state);
  const url = parseUrlParts(raw);
  const headerRows = state.headers.filter((h) => h.key.trim() !== "");
  const collectionName = state.collection_name.trim() || state.route_name.trim() || "API Gateway";
  const itemName = state.route_name.trim() || state.path.trim() || "route";

  const urlBlock: Record<string, unknown> = {
    raw,
    path: url.path,
    query: url.query,
  };
  if (url.protocol) urlBlock.protocol = url.protocol;
  if (url.host.length > 0) urlBlock.host = url.host;
  if (url.port) urlBlock.port = url.port;

  return {
    info: {
      name: collectionName,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: itemName,
        request: {
          method: state.http_method,
          header: headerRows.map((h) => ({ key: h.key, value: h.value, type: "text" })),
          url: urlBlock,
        },
      },
    ],
  };
}

export function generateAuthCredentials(authType: AuthType): Record<string, string> {
  const rand = () => Math.random().toString(36).slice(2, 10);
  const id = authType.toLowerCase();
  if (id === "api_key" || id === "apikey") {
    return { api_key: `gw_${rand()}${rand()}` };
  }
  if (id === "basic_auth" || id === "basic") {
    return { username: `user_${rand()}`, password: `pass_${rand()}${rand()}` };
  }
  if (id === "bearer_token" || id === "bearer") {
    return { token: `bearer_${rand()}${rand()}${rand()}` };
  }
  if (id === "oauth2" || id === "oauth_2") {
    return { client_id: `client_${rand()}`, client_secret: `secret_${rand()}${rand()}` };
  }
  return {};
}

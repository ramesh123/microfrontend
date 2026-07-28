/**
 * API Connector wire format: key-value UI fields as flat maps
 * `{ "name": "value" }` instead of `[{ key, value }, ...]`.
 */

export type ApiConnectorKeyValueRow = { key: string; value: string };

/** Payload keys stored as `[{ key, value }]` in the form and sent as objects to the API. */
export const API_CONNECTOR_KEY_VALUE_MAP_FIELDS = [
  "params",
  "headers",
  "form_data",
  "urlencoded_data",
] as const;

export type ApiConnectorKeyValueMapField =
  (typeof API_CONNECTOR_KEY_VALUE_MAP_FIELDS)[number];

function isKeyValueRowArray(val: unknown): val is ApiConnectorKeyValueRow[] {
  if (!Array.isArray(val)) return false;
  if (val.length === 0) return true;
  return val.every(
    (row) =>
      row != null &&
      typeof row === "object" &&
      "key" in row &&
      "value" in row
  );
}

/** Flat map for API transport (skips empty keys; later rows override duplicates). */
export function apiConnectorKeyValueRowsToMap(
  rows: unknown
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isKeyValueRowArray(rows)) return out;
  for (const row of rows) {
    const k = String(row.key ?? "").trim();
    if (k === "") continue;
    out[k] = String(row.value ?? "");
  }
  return out;
}

/** Form UI shape for key-value fields. */
export function apiConnectorMapToKeyValueRows(obj: unknown): ApiConnectorKeyValueRow[] {
  if (obj == null) return [];
  if (typeof obj === "string" && obj.trim()) {
    try {
      return apiConnectorMapToKeyValueRows(JSON.parse(obj));
    } catch {
      return [];
    }
  }
  if (isKeyValueRowArray(obj)) {
    return obj.map((r) => ({
      key: String(r.key ?? ""),
      value: String(r.value ?? ""),
    }));
  }
  if (typeof obj === "object" && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: value == null ? "" : String(value),
    }));
  }
  return [];
}

/**
 * Mutates `payload`: converts API Connector key-value row arrays to string maps
 * for transport (`params`, `headers`, `form_data`, `urlencoded_data`).
 */
export function serializeApiConnectorKeyValueMapsForApi(
  payload: Record<string, unknown>
): void {
  for (const field of API_CONNECTOR_KEY_VALUE_MAP_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const v = payload[field];
    if (isKeyValueRowArray(v)) {
      payload[field] = apiConnectorKeyValueRowsToMap(v);
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      payload[field] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [
          k,
          val == null ? "" : String(val),
        ])
      );
    }
  }
}

/** HTTP methods where we do not send a request body (UI + payload stay aligned). */
export const API_CONNECTOR_METHODS_WITHOUT_BODY = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "TRACE",
]);

const emptyKeyValueWire = (): Record<string, string> => ({});

/** True if this execution/config payload is for the API Connector node. */
export function isApiConnectorLikePayload(
  payload: Record<string, unknown> | null | undefined
): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (payload.actions === "execute_api_request") return true;
  return (
    Object.prototype.hasOwnProperty.call(payload, "http_method") &&
    Object.prototype.hasOwnProperty.call(payload, "form_data") &&
    Object.prototype.hasOwnProperty.call(payload, "urlencoded_data")
  );
}

/**
 * Clears body-related payload keys that do not apply to the current
 * `http_method` + Body type (`body`), so stale form-data is not sent with urlencoded, etc.
 * Call before {@link serializeApiConnectorKeyValueMapsForApi}.
 */
export function sanitizeApiConnectorPayloadForWire(
  payload: Record<string, unknown>
): void {
  const method = String(payload.http_method ?? "").toUpperCase();
  const bodyType = String(payload.body ?? "").trim().toLowerCase();

  if (API_CONNECTOR_METHODS_WITHOUT_BODY.has(method)) {
    payload.body = "none";
    payload.form_data = emptyKeyValueWire();
    payload.urlencoded_data = emptyKeyValueWire();
    payload.raw_body = "";
    payload.raw_format = "";
    payload.binary_file = "";
    payload.graphql_query = "";
    payload.graphql_variables = "";
    return;
  }

  switch (bodyType) {
    case "form-data":
      payload.urlencoded_data = emptyKeyValueWire();
      payload.raw_body = "";
      payload.raw_format = "";
      payload.binary_file = "";
      payload.graphql_query = "";
      payload.graphql_variables = "";
      break;
    case "x-www-form-urlencoded":
      payload.form_data = emptyKeyValueWire();
      payload.raw_body = "";
      payload.raw_format = "";
      payload.binary_file = "";
      payload.graphql_query = "";
      payload.graphql_variables = "";
      break;
    case "raw":
      payload.form_data = emptyKeyValueWire();
      payload.urlencoded_data = emptyKeyValueWire();
      payload.binary_file = "";
      payload.graphql_query = "";
      payload.graphql_variables = "";
      break;
    case "binary":
      payload.form_data = emptyKeyValueWire();
      payload.urlencoded_data = emptyKeyValueWire();
      payload.raw_body = "";
      payload.raw_format = "";
      payload.graphql_query = "";
      payload.graphql_variables = "";
      break;
    case "graphql":
      payload.form_data = emptyKeyValueWire();
      payload.urlencoded_data = emptyKeyValueWire();
      payload.raw_body = "";
      payload.raw_format = "";
      payload.binary_file = "";
      break;
    case "none":
    case "":
      payload.form_data = emptyKeyValueWire();
      payload.urlencoded_data = emptyKeyValueWire();
      payload.raw_body = "";
      payload.raw_format = "";
      payload.binary_file = "";
      payload.graphql_query = "";
      payload.graphql_variables = "";
      break;
    default:
      break;
  }
}

const emptyKeyValueFormRow = (): ApiConnectorKeyValueRow[] => [
  { key: "", value: "" },
];

/**
 * Keeps API connector form state consistent when Body type or HTTP method changes
 * (clears inactive body sections so hidden fields are not re-sent on save).
 */
export function applyApiConnectorFormStateAfterFieldChange<
  T extends Record<string, unknown>
>(prev: T, changedKey: string, nextVal: unknown): T {
  const next = { ...prev, [changedKey]: nextVal } as T;
  const rec = next as Record<string, unknown>;

  if (changedKey === "http_method") {
    const method = String(nextVal ?? "").toUpperCase();
    if (API_CONNECTOR_METHODS_WITHOUT_BODY.has(method)) {
      rec.body = "none";
      rec.form_data = emptyKeyValueFormRow();
      rec.urlencoded_data = emptyKeyValueFormRow();
      rec.raw_body = "";
      rec.raw_format = "";
      rec.binary_file = "";
      rec.graphql_query = "";
      rec.graphql_variables = "";
    }
    return next;
  }

  if (changedKey === "body") {
    const bodyType = String(nextVal ?? "").trim().toLowerCase();
    switch (bodyType) {
      case "form-data":
        rec.urlencoded_data = emptyKeyValueFormRow();
        rec.raw_body = "";
        rec.raw_format = "";
        rec.binary_file = "";
        rec.graphql_query = "";
        rec.graphql_variables = "";
        break;
      case "x-www-form-urlencoded":
        rec.form_data = emptyKeyValueFormRow();
        rec.raw_body = "";
        rec.raw_format = "";
        rec.binary_file = "";
        rec.graphql_query = "";
        rec.graphql_variables = "";
        break;
      case "raw":
        rec.form_data = emptyKeyValueFormRow();
        rec.urlencoded_data = emptyKeyValueFormRow();
        rec.binary_file = "";
        rec.graphql_query = "";
        rec.graphql_variables = "";
        break;
      case "binary":
        rec.form_data = emptyKeyValueFormRow();
        rec.urlencoded_data = emptyKeyValueFormRow();
        rec.raw_body = "";
        rec.raw_format = "";
        rec.graphql_query = "";
        rec.graphql_variables = "";
        break;
      case "graphql":
        rec.form_data = emptyKeyValueFormRow();
        rec.urlencoded_data = emptyKeyValueFormRow();
        rec.raw_body = "";
        rec.raw_format = "";
        rec.binary_file = "";
        break;
      case "none":
      case "":
        rec.form_data = emptyKeyValueFormRow();
        rec.urlencoded_data = emptyKeyValueFormRow();
        rec.raw_body = "";
        rec.raw_format = "";
        rec.binary_file = "";
        rec.graphql_query = "";
        rec.graphql_variables = "";
        break;
      default:
        break;
    }
  }

  return next;
}

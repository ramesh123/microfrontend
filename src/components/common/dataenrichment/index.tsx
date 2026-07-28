import { useMemo } from "react";
import cloneDeep from "lodash/cloneDeep";
import NodeForm from "@/components/common/node-form";
import type { FieldTemplate } from "@/types/form";

function httpMethodIsUnset(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  return false;
}

function isFieldTemplateEntry(v: unknown): v is FieldTemplate {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as FieldTemplate).key === "string" &&
    typeof (v as FieldTemplate).type === "string"
  );
}

/**
 * Dense 1..n positions and logical grouping for the config grid (avoids sparse API positions
 * that only affect sort order but confuse layout when combined with hidden dependents).
 */
const DATA_ENRICHMENT_DISPLAY_ORDER: string[] = [
  "name",
  "connection",
  "source_column",
  "fill_policy",
  "target_column",
  "output_column",
  "skip_when_lookup_empty",
  "http_method",
  "params",
  "headers",
  "body",
  "form_data",
  "urlencoded_data",
  "raw_format",
  "raw_body",
  "graphql_query",
  "graphql_variables",
  "accept_language",
];

function compactDataEnrichmentFieldPositions(tmpl: Record<string, unknown>) {
  const keys = Object.keys(tmpl).filter((k) => isFieldTemplateEntry(tmpl[k]));
  let pos = 1;
  for (const key of DATA_ENRICHMENT_DISPLAY_ORDER) {
    if (!keys.includes(key)) continue;
    const f = tmpl[key] as FieldTemplate;
    tmpl[key] = { ...f, position: pos++ };
  }
  const remaining = keys
    .filter((k) => !DATA_ENRICHMENT_DISPLAY_ORDER.includes(k))
    .sort((a, b) => {
      const fa = tmpl[a] as FieldTemplate;
      const fb = tmpl[b] as FieldTemplate;
      return (fa.position ?? 0) - (fb.position ?? 0);
    });
  for (const key of remaining) {
    const f = tmpl[key] as FieldTemplate;
    tmpl[key] = { ...f, position: pos++ };
  }
}

/** Template + payload tweaks so dependent HTTP fields render. JSON path is set via Data Preview only (`data_preview.preview_to_main_field_map.target_form_key`). */
function applyDataEnrichmentNodeFormPatches(
  layer: Record<string, unknown>,
  tmpl: Record<string, unknown>
) {
  const node = layer.node as Record<string, unknown> | undefined;
  if (!node) return;

  const prevPayload = node.payload;
  const payload =
    prevPayload && typeof prevPayload === "object"
      ? { ...(prevPayload as Record<string, unknown>) }
      : {};

  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    payload.data = {
      is_pandas: false,
      is_polars: false,
      response_type: "json",
      rules: [],
    };
  } else {
    payload.data = { ...(payload.data as Record<string, unknown>) };
  }
  const dataBlock = payload.data as Record<string, unknown>;
  if (dataBlock.is_pandas === undefined) dataBlock.is_pandas = false;
  if (dataBlock.is_polars === undefined) dataBlock.is_polars = false;
  if (dataBlock.response_type === undefined) dataBlock.response_type = "json";
  if (!Array.isArray(dataBlock.rules)) {
    dataBlock.rules = [];
  }
  const rulesArr = dataBlock.rules as unknown[];
  if (rulesArr.length > 0) {
    const first = rulesArr[0];
    if (first && typeof first === "object" && httpMethodIsUnset((first as Record<string, unknown>).http_method)) {
      dataBlock.rules = [
        { ...(first as Record<string, unknown>), http_method: "GET" },
        ...rulesArr.slice(1),
      ];
    }
  }

  node.payload = payload;

  const httpTmpl = tmpl.http_method as FieldTemplate | undefined;
  if (httpTmpl && httpMethodIsUnset(httpTmpl.value)) {
    tmpl.http_method = { ...httpTmpl, value: "GET" };
  }

  compactDataEnrichmentFieldPositions(tmpl);
}

export interface DataEnrichmentProps {
  nodeDetailsData: any;
  onClose: () => void;
  mode?: "view" | "edit";
}

/**
 * Data Enrichment: template-driven form with compact field order for the grid; upstream
 * column selects for `source_column` / `target_column` render in DynamicFieldRenderer.
 */
export default function DataEnrichment({
  nodeDetailsData,
  onClose,
  mode = "edit",
}: DataEnrichmentProps) {
  const nodeFormData = useMemo(() => {
    const d = cloneDeep(nodeDetailsData);
    if (!d?.data?.node?.template) return d;
    if (d.data.is_multiple_form == null) {
      d.data.is_multiple_form = true;
    }
    const tmpl = { ...d.data.node.template } as Record<string, unknown>;
    applyDataEnrichmentNodeFormPatches(d.data as Record<string, unknown>, tmpl);
    d.data.node.template = tmpl as typeof d.data.node.template;
    return d;
  }, [nodeDetailsData]);

  const disabled = mode === "view";

  return (
    <div className="flex flex-col gap-4 bg-background pt-0">
      <NodeForm
        template={nodeFormData?.data?.node?.template}
        onClose={onClose}
        nodeData={nodeFormData}
        saveApiEndpoint={nodeDetailsData?.data?.node?.save_node}
        disabled={disabled}
      />
    </div>
  );
}

import type { FieldTemplate, FormValue } from "@/types/form";

export const MASKING_RESERVED_TEMPLATE_KEYS = new Set([
  "filters",
  "masking_rules",
  "data_fields",
  "save_node",
]);

export type MaskingRule = Record<string, FormValue>;

function isFieldTemplateEntry(v: unknown): v is FieldTemplate {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as FieldTemplate).key === "string" &&
    typeof (v as FieldTemplate).type === "string"
  );
}

export function stripTemplatePlaceholder(val: unknown): unknown {
  if (typeof val === "string") {
    const t = val.trim();
    if (/^{{[\s\S]+}}$/.test(t)) return "";
    return val;
  }
  return val;
}

export function isTemplatePlaceholder(val: unknown): boolean {
  return typeof val === "string" && /^{{[\s\S]+}}$/.test(val.trim());
}

export function isMaskingTopLevelField(field: FieldTemplate): boolean {
  if (MASKING_RESERVED_TEMPLATE_KEYS.has(field.key)) return true;
  if (field.key === "dataframe") return true;
  // API templates use `node-input`; not listed on FormFieldConfig union.
  return String(field.type) === "node-input";
}

function fieldsFromNestedRow(row: Record<string, unknown> | null | undefined): FieldTemplate[] {
  if (!row) return [];
  return Object.values(row).filter(isFieldTemplateEntry);
}

/** Per-rule field definitions from API template. */
export function getMaskingRuleFieldTemplates(
  template: Record<string, unknown> | null | undefined
): FieldTemplate[] {
  if (!template || typeof template !== "object") return [];

  if (Array.isArray(template.masking_rules) && template.masking_rules.length > 0) {
    const nested = fieldsFromNestedRow(
      template.masking_rules[0] as Record<string, unknown>
    );
    if (nested.length > 0) return nested.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  if (Array.isArray(template.filters) && template.filters.length > 0) {
    const nested = fieldsFromNestedRow(template.filters[0] as Record<string, unknown>);
    if (nested.length > 0) return nested.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  return Object.values(template)
    .filter(isFieldTemplateEntry)
    .filter((f) => !isMaskingTopLevelField(f))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function getMaskingTopLevelFieldTemplates(
  template: Record<string, unknown> | null | undefined
): FieldTemplate[] {
  if (!template || typeof template !== "object") return [];
  return Object.values(template)
    .filter(isFieldTemplateEntry)
    .filter(isMaskingTopLevelField)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function isPlaceholderRule(rule: MaskingRule): boolean {
  const values = Object.values(rule);
  if (values.length === 0) return true;
  return values.every((v) => v === "" || v == null || isTemplatePlaceholder(v));
}

export function normalizeMaskingRulesFromPayload(
  payload: Record<string, unknown> | null | undefined,
  template: Record<string, unknown> | null | undefined
): MaskingRule[] {
  if (!payload) return [];

  const raw = payload.masking_rules;
  if (Array.isArray(raw) && raw.length > 0) {
    const rules = raw
      .filter((r) => r && typeof r === "object")
      .map((r) => {
        const row: MaskingRule = {};
        for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
          row[k] = stripTemplatePlaceholder(v) as FormValue;
        }
        return row;
      })
      .filter((r) => !isPlaceholderRule(r));
    if (rules.length > 0) return rules;
  }

  const ruleFields = getMaskingRuleFieldTemplates(template);
  const migrated: MaskingRule = {};
  let hasValue = false;
  for (const f of ruleFields) {
    if (Object.prototype.hasOwnProperty.call(payload, f.key)) {
      const v = stripTemplatePlaceholder(payload[f.key]);
      if (v !== "" && v != null && !isTemplatePlaceholder(v)) {
        migrated[f.key] = v as FormValue;
        hasValue = true;
      }
    }
  }
  return hasValue ? [migrated] : [];
}

export function readMaskingTopLevelFromPayload(
  payload: Record<string, unknown> | null | undefined,
  template: Record<string, unknown> | null | undefined
): Record<string, FormValue> {
  const top: Record<string, FormValue> = {};
  const fields = getMaskingTopLevelFieldTemplates(template);
  for (const f of fields) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, f.key)) {
      top[f.key] = stripTemplatePlaceholder(payload[f.key]) as FormValue;
    } else if (f.value !== undefined) {
      top[f.key] = stripTemplatePlaceholder(f.value) as FormValue;
    } else {
      top[f.key] = "";
    }
  }
  return top;
}

export function buildMaskingRowTemplate(
  template: Record<string, unknown> | null | undefined
): Record<string, FormValue> {
  const row: Record<string, FormValue> = {};
  for (const f of getMaskingRuleFieldTemplates(template)) {
    const v = stripTemplatePlaceholder(f.value);
    row[f.key] = (v === undefined || v === null ? "" : v) as FormValue;
  }
  return row;
}

export function formatRuleCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatAlgorithmLabel(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "—";
  const s = String(raw).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

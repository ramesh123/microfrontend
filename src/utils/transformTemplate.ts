import { FieldTemplate, FormField, FormSchema, FormSubmissionData } from "@/types/form";
import { checkFieldDependencies } from "@/utils/formDependencyUtils";

/** Workflow node ids that share the file-source Type/Mode template patch (CSV, Excel, JSON, Parquet, …). */
export const FILE_SOURCE_TEMPLATE_PATCH_NODE_IDS = new Set([
  "csv",
  "excel",
  "json",
  "parquet",
]);

function buildFileDependencyProbeValues(
  templateKeys: string[],
  mode: "read" | "write",
  typeValue: string
): FormSubmissionData {
  const out: FormSubmissionData = {};
  for (const key of templateKeys) {
    out[key] = "";
  }
  out.mode = mode;
  out.type = typeValue;
  return out;
}

/**
 * A type value is offered for read/write only if the template defines at least one field
 * that depends on both `type` and `mode` and would be visible for that pair (e.g. read path
 * vs write path). Fields that only depend on `type` or only on `mode` (like delimiter or
 * skip_row) do not count, so options such as Upload can be hidden for Write when there is
 * no upload+write destination field in the API template.
 */
function fileTypeOptionHasModeAndTypeScopedField(
  template: Record<string, FieldTemplate>,
  typeOptionValue: string,
  mode: "read" | "write"
): boolean {
  const keys = Object.keys(template).filter((k) => k !== "save_node");
  const synthetic = buildFileDependencyProbeValues(keys, mode, typeOptionValue);

  for (const [entryKey, def] of Object.entries(template)) {
    if (entryKey === "name" || entryKey === "mode" || entryKey === "type") continue;
    if (!def || typeof def !== "object") continue;
    const dk = def.depends_key;
    if (!Array.isArray(dk) || !dk.includes("type") || !dk.includes("mode")) continue;
    if (!def.depends_value) continue;
    if (checkFieldDependencies(def, synthetic)) {
      return true;
    }
  }
  return false;
}

/**
 * File-source nodes (CSV, Excel, Parquet, …): make "Type" depend on "Mode" and filter type
 * options by which path fields exist in the API template.
 *
 * - Types with no type+mode-scoped field for either mode appear under both Read and Write.
 * - Types with read-only scoped fields (e.g. Amazon S3) also appear under Write, except
 *   `upload`, which stays off Write when there is no upload+write path in the template.
 */
export function applyFileSourceTemplatePatch(
  template: Record<string, FieldTemplate> | null | undefined
): Record<string, FieldTemplate> | null | undefined {
  if (!template?.type?.options?.length) return template;
  const typeField = template.type;
  const typeOptions = typeField.options!.map((o) => ({ ...o }));

  const readOptions = typeOptions.filter((o) => {
    const v = String(o.value);
    const hasRead = fileTypeOptionHasModeAndTypeScopedField(template, v, "read");
    const hasWrite = fileTypeOptionHasModeAndTypeScopedField(template, v, "write");
    // No path for either mode → still offer the type under Read and Write.
    if (!hasRead && !hasWrite) return true;
    return hasRead;
  });

  const writeOptions = typeOptions.filter((o) => {
    const v = String(o.value);
    const hasRead = fileTypeOptionHasModeAndTypeScopedField(template, v, "read");
    const hasWrite = fileTypeOptionHasModeAndTypeScopedField(template, v, "write");
    if (!hasRead && !hasWrite) return true;
    if (hasWrite) return true;
    // Read-only path in template (e.g. Amazon S3): show under Write as well, except Upload
    // which must stay hidden for Write when there is no upload+write destination field.
    if (hasRead && !hasWrite && v !== "upload") return true;
    return false;
  });

  return {
    ...template,
    type: {
      ...typeField,
      depends_key: ["mode"],
      depends_value: ["read", "write"],
      options_by_dependency: {
        dependency_key: "mode",
        value_map: {
          read: readOptions,
          write: writeOptions,
        },
      },
    },
  };
}

/** @deprecated Use {@link applyFileSourceTemplatePatch} */
export const applyCsvFileSourceTemplatePatch = applyFileSourceTemplatePatch;

/**
 * Display name used when wiring upstream outputs into payloads (e.g. Excel write multi-input dataframe keys).
 * Matches reporting / sheet naming: node display_name, then fallbacks, then `Node <id>`.
 */
export function getUpstreamDisplayNameForPayload(
  node: { id?: string; data?: Record<string, unknown> } | null | undefined
): string {
  if (!node) return "Unknown";
  const d = node.data as Record<string, unknown> | undefined;
  const inner = d?.node as Record<string, unknown> | undefined;
  const name =
    (inner?.display_name as string | undefined) ??
    (d?.display_name as string | undefined) ??
    (inner?.name as string | undefined) ??
    (d?.label as string | undefined) ??
    (d?.name as string | undefined);
  const s = name != null && String(name).trim() !== "" ? String(name).trim() : "";
  return s || `Node ${node.id ?? ""}`;
}

/** Excel write with at least one upstream: dataframe is keyed by upstream display names (same shape for one or many inputs). */
export function shouldBuildKeyedDataframeForExcelWrite(
  nodeId: string | null | undefined,
  mode: unknown,
  directUpstreamCount: number
): boolean {
  if (String(nodeId ?? "").toLowerCase() !== "excel") return false;
  if (String(mode ?? "").toLowerCase() !== "write") return false;
  return directUpstreamCount > 0;
}

export function transformRawSchema(rawSchema: any, title: string, description: string): FormSchema {
    if (rawSchema == null || typeof rawSchema !== "object") {
        return {
            title,
            description,
            fields: [],
            submitButtonText: "Save Node",
        };
    }

    const fields: FormField[] = Object.values(rawSchema).map((field: any): FormField => {
        let fieldType: FormField['type'] = field.type;
        if (field.type === 'dropdown') {
            fieldType = 'combobox';
        } else if (field.type === 'multi-dropdown') {
            fieldType = 'multi-select-combobox';
        }

        const transformedField: FormField = {
            key: field.key,
            display_name: field.display_name,
            type: fieldType,
            position: field.position,
            required: !!field.required,
            placeholder: field.placeholder,
            info: field.info,
            fetch: field.fetch,
            options: field.options,
            value: field.value,
            gridColumn: 'span-6',
            add_source_connection: field.add_source_connection,
            source_form_name: field.source_form_name,
            source_form_id: field.source_form_id,
            depends_key: field.depends_key,
            depends_value: field.depends_value,
            options_by_dependency: field.options_by_dependency,
        };

        return transformedField;
    });

    const sortedFields = fields.sort((a, b) => a.position - b.position);
    if (sortedFields.length > 0) {
        sortedFields[0].gridColumn = 'span-12';
        if (sortedFields.length > 1) {
            sortedFields[sortedFields.length - 1].gridColumn = 'span-12';
        }
    }

    return {
        title,
        description,
        fields: sortedFields,
        saveNode: rawSchema.save_node,
        submitPayload: rawSchema.payload,
        submitButtonText: 'Save Node'
    };
}
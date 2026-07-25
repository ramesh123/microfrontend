import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getLocationsList,
  toLocationSelectOptions,
  type LocationSelectOption,
} from "@/controllers/API/locationsApi";
import AgentSetupWizard from "../AgentSetupWizard";
import {
  buildDefaultAgentWizardSteps,
  mergeAgentFieldsIntoConnectionPayload,
  parseAgentConfigObject,
  type AgentWizardPersistedState,
} from "../agentApi";
import { ConnectorIcon } from "../ConnectorIcon";

function isSelectLikeFieldType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return (
    t === "select" ||
    t === "dropdown" ||
    t === "combobox" ||
    t === "single_select" ||
    t === "enum" ||
    t === "choice" ||
    t === "picker" ||
    t.includes("select")
  );
}

/** Payload key for the selected plant/location id on save. */
const LOCATION_ID_FIELD_NAME = "location_id";

/** Agent wizard fields hydrated from edit data / wizard (not all sent on every save). */
const AGENT_WIZARD_FIELD_NAMES = [
  "agent_platform",
  "agent_config",
  "agent_config_filename",
  "config_generated",
] as const;

const FORM_FIELD_WRAPPER_CLASS = "flex min-w-0 flex-col gap-1";
const FORM_FIELD_LABEL_CLASS =
  "flex h-[1.125rem] shrink-0 items-center truncate text-xs font-medium leading-none text-foreground";
const FORM_FIELD_CONTROL_CLASS = "flex h-8 min-h-8 items-center";
const FORM_FIELD_INPUT_CLASS = "h-8 min-h-8 w-full rounded-md px-2.5 text-sm";

function FormFieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
}) {
  const text = `${label}${required ? " *" : ""}`;
  return (
    <Label htmlFor={htmlFor} className={FORM_FIELD_LABEL_CLASS} title={text}>
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
  );
}

function coerceFieldsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.values(raw as Record<string, unknown>);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return coerceFieldsArray(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  return [];
}

function extractSchemaFields(schema: FormSchema): unknown[] {
  const root = schema as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    schema.fields,
    root.form_fields,
    root.formFields,
    root.field_list,
    root.schema,
    root.config,
  ];
  const nestedSchema = root.form_schema ?? root.formSchema;
  if (nestedSchema && typeof nestedSchema === "object") {
    candidates.push((nestedSchema as Record<string, unknown>).fields);
  }
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const data = nested as Record<string, unknown>;
    candidates.push(data.fields, data.form_fields);
  }
  const formDef = root.form_definition ?? root.formDefinition;
  if (formDef && typeof formDef === "object") {
    candidates.push((formDef as Record<string, unknown>).fields);
  }
  for (const candidate of candidates) {
    const arr = coerceFieldsArray(candidate);
    if (arr.length > 0) return arr;
  }
  return [];
}

function isLocationSelectLabel(label: string): boolean {
  const l = label.trim().toLowerCase();
  return l === "select location" || l.includes("select location");
}

function isLocationIdField(field: Pick<FormField, "name" | "label">): boolean {
  const name = (field.name || "").trim().toLowerCase();
  if (
    name === LOCATION_ID_FIELD_NAME ||
    name === "location" ||
    name === "select_location"
  ) {
    return true;
  }
  return isLocationSelectLabel(field.label || "");
}

function normalizeFormField(raw: Record<string, unknown>, index: number): FormField {
  const name = String(
    raw.name ?? raw.field_name ?? raw.key ?? `field_${index}`,
  );
  let type = String(raw.type ?? raw.field_type ?? "text").toLowerCase();
  const label = String(
    raw.label ?? raw.display_label ?? raw.display_name ?? raw.title ?? name,
  );
  const placeholder =
    raw.placeholder != null ? String(raw.placeholder) : undefined;
  const required =
    raw.required === true ||
    raw.required === "true" ||
    raw.is_required === true ||
    raw.is_required === "true";

  let options = raw.options as FormField["options"];
  if ((!options || options.length === 0) && Array.isArray(raw.choices)) {
    options = (raw.choices as unknown[]).map((choice, choiceIndex) => {
      const row =
        choice && typeof choice === "object"
          ? (choice as Record<string, unknown>)
          : {};
      const value = String(row.value ?? row.id ?? row.key ?? choiceIndex);
      const optionLabel = String(row.label ?? row.name ?? row.title ?? value);
      return { value, label: optionLabel };
    });
  }

  const field: FormField = {
    ...(raw as unknown as FormField),
    name,
    type,
    label,
    placeholder,
    options,
    required: required || Boolean((raw as unknown as FormField).required),
  };

  if (isLocationIdField(field)) {
    field.name = LOCATION_ID_FIELD_NAME;
    field.type = isSelectLikeFieldType(type) ? type : "select";
    field.options = [];
  }

  return field;
}

function resolveWizardConnectionId(
  savedConnectionId?: string | number | null,
  initialData: Record<string, unknown> = {},
): string | null {
  if (savedConnectionId != null && String(savedConnectionId).trim()) {
    return String(savedConnectionId);
  }
  const fromInitial = initialData.id ?? initialData.connection_id;
  if (fromInitial != null && String(fromInitial).trim()) {
    return String(fromInitial);
  }
  return null;
}

interface FormField {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  depends_on?: string[];
  depends_value?: any | any[]; // Can be single value or array
  visible?: boolean;
  show_after_save?: boolean;
  readOnly?: boolean;
  accept?: string;
  multiple?: boolean;
  // New API format fields
  fetch?: {
    klass: string;
    method: string;
    module: string;
    params: Record<string, any>;
  };
  klass?: string;
  module?: string;
  // Processed fields properties
  uniqueName?: string;
  originalName?: string;
}

type KeyValueRow = { key: string; value: string };

function normalizeKeyValueRows(raw: unknown): KeyValueRow[] {
  if (raw == null || raw === "") {
    return [{ key: "", value: "" }];
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return [{ key: "", value: "" }];
    }
    return raw.map((item) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return {
          key: String(o.key ?? ""),
          value: String(o.value ?? ""),
        };
      }
      return { key: "", value: "" };
    });
  }
  if (typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length === 0) {
      return [{ key: "", value: "" }];
    }
    return entries.map(([k, v]) => ({
      key: k,
      value: v == null ? "" : String(v),
    }));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [{ key: "", value: "" }];
    }
    try {
      return normalizeKeyValueRows(JSON.parse(trimmed));
    } catch {
      return [{ key: "", value: "" }];
    }
  }
  return [{ key: "", value: "" }];
}

/** Map API / stored values to a select option value so Radix can show the label. */
function resolveSelectOptionValue(
  rawValue: unknown,
  options?: Array<{ value: string; label: string }>,
): string {
  if (rawValue == null || rawValue === "") return "";
  const raw = String(rawValue).trim();
  if (!options?.length) return raw;

  const exact = options.find((o) => o.value === raw);
  if (exact) return exact.value;

  const rawLower = raw.toLowerCase();
  const byValueCi = options.find((o) => o.value.toLowerCase() === rawLower);
  if (byValueCi) return byValueCi.value;

  const byLabelCi = options.find((o) => o.label.toLowerCase() === rawLower);
  if (byLabelCi) return byLabelCi.value;

  const postgresAliases = new Set(["postgresql", "postgres", "pgsql"]);
  if (postgresAliases.has(rawLower)) {
    const pg = options.find(
      (o) =>
        postgresAliases.has(o.value.toLowerCase()) ||
        o.label.toLowerCase().includes("postgres"),
    );
    if (pg) return pg.value;
  }

  return raw;
}

function getSelectOptionLabel(
  value: string,
  options?: Array<{ value: string; label: string }>,
): string | undefined {
  if (!value || !options?.length) return undefined;
  const resolved = resolveSelectOptionValue(value, options);
  return options.find((o) => o.value === resolved)?.label;
}

/** Single object: header name → value (matches backend expectation for auth_headers). */
function serializeKeyValueForApi(raw: unknown): Record<string, string> {
  const rows = normalizeKeyValueRows(raw);
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value;
  }
  return out;
}

interface FormSchema {
  name: string;
  display_name: string;
  form_id?: string;
  group?: string;
  icon?: string;
  description: string;
  enabled?: boolean;
  fields: FormField[];
  save_connection?: {
    name: string;
    klass: string;
    module: string;
    params: Record<string, any>;
  };
}

interface DynamicFormProps {
  formSchema: FormSchema;
  onSubmit: (formData: Record<string, any>) => void;
  onCancel: () => void;
  title?: string;
  initialData?: Record<string, any>;
  layout?: 1 | 2 | 3;
  submitButtonText?: string;
  // New generic props for handling custom button actions
  onCustomAction?: (
    actionField: FormField,
    formData: Record<string, any>,
  ) => void;
  isActionLoading?: Record<string, boolean>;
  // Test connection props
  testConnectionSuccess?: boolean;
  onTestConnectionSuccess?: (success: boolean) => void;
  savedConnectionId?: string | number | null;
  connectionType?: string;
  connectionTypeLabel?: string;
  isEditMode?: boolean;
  isSubmitting?: boolean;
}

const CredDynamicForm: React.FC<DynamicFormProps> = ({
  formSchema,
  onSubmit,
  onCancel,
  title,
  initialData = {},
  layout = 3,
  submitButtonText = "Submit",
  // Destructure new props with defaults
  onCustomAction,
  isActionLoading = {},
  // Test connection props
  testConnectionSuccess = false,
  onTestConnectionSuccess,
  savedConnectionId = null,
  connectionType = "",
  connectionTypeLabel = "",
  isEditMode = false,
  isSubmitting = false,
}) => {
  const normalizedFields = useMemo(
    () =>
      extractSchemaFields(formSchema).map((field, index) =>
        normalizeFormField(field as Record<string, unknown>, index),
      ),
    [formSchema],
  );

  const getInitialFormData = () => {
    const initialFormData: Record<string, any> = {};
    normalizedFields.forEach((field) => {
      if (initialData[field.name] !== undefined) {
        if (field.type === "key-value") {
          initialFormData[field.name] = normalizeKeyValueRows(
            initialData[field.name],
          );
        } else if (isSelectLikeFieldType(field.type)) {
          initialFormData[field.name] = resolveSelectOptionValue(
            initialData[field.name],
            field.options,
          );
        } else {
          initialFormData[field.name] = initialData[field.name];
        }
      } else if (field.default !== undefined) {
        initialFormData[field.name] = field.default;
      } else {
        switch (field.type) {
          case "checkbox":
            initialFormData[field.name] = false;
            break;
          case "multiDropdown": // Assuming you might have this type
            initialFormData[field.name] = [];
            break;
          case "number":
            initialFormData[field.name] = ""; // Or 0 if appropriate
            break;
          case "key-value":
            initialFormData[field.name] = normalizeKeyValueRows(
              initialData[field.name],
            );
            break;
          default:
            initialFormData[field.name] = "";
        }
      }
    });

    for (const key of AGENT_WIZARD_FIELD_NAMES) {
      if (initialData[key] === undefined || initialData[key] === null) continue;
      if (key === "agent_config") {
        const parsed = parseAgentConfigObject(initialData[key]);
        if (parsed) initialFormData[key] = parsed;
      } else {
        initialFormData[key] = initialData[key];
      }
    }

    return initialFormData;
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [locationSelectOptionsList, setLocationSelectOptionsList] = useState<
    LocationSelectOption[]
  >([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<string | null>(
    () => {
      if (!isEditMode) return null;
      try {
        return JSON.stringify(getInitialFormData());
      } catch {
        return null;
      }
    },
  );

  const hasLocationIdField = useMemo(() => {
    if (normalizedFields.some((field) => isLocationIdField(field))) {
      return true;
    }
    return extractSchemaFields(formSchema).some((raw) => {
      if (!raw || typeof raw !== "object") return false;
      const row = raw as Record<string, unknown>;
      return isLocationIdField({
        name: String(row.name ?? row.field_name ?? row.key ?? ""),
        label: String(
          row.label ?? row.display_label ?? row.display_name ?? row.title ?? "",
        ),
      });
    });
  }, [normalizedFields, formSchema]);

  /** Cache so StrictMode remount restores options without a second API call. */
  const locationsCacheRef = useRef<{
    formKey: string;
    options: LocationSelectOption[];
  } | null>(null);

  // Fetch locations once per connector form (not on dropdown open).
  useEffect(() => {
    if (!hasLocationIdField) return;

    const formKey = String(formSchema.form_id ?? formSchema.name ?? "default");
    const cached = locationsCacheRef.current;
    if (cached?.formKey === formKey) {
      setLocationSelectOptionsList(cached.options);
      return;
    }

    let cancelled = false;
    setLocationsLoading(true);
    void getLocationsList({ skip: 0, limit: 500 })
      .then(({ rows }) => {
        if (cancelled) return;
        const options = toLocationSelectOptions(rows);
        locationsCacheRef.current = { formKey, options };
        setLocationSelectOptionsList(options);
        if (options.length === 0) {
          toast.info("No locations available.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to load locations");
          setLocationSelectOptionsList([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasLocationIdField, formSchema.form_id]);

  useEffect(() => {
    const formKey = String(formSchema.form_id ?? formSchema.name ?? "default");
    if (
      locationsCacheRef.current &&
      locationsCacheRef.current.formKey !== formKey
    ) {
      locationsCacheRef.current = null;
      setLocationSelectOptionsList([]);
    }
  }, [formSchema.form_id]);

  useEffect(() => {
    if (!locationSelectOptionsList.length) return;
    setFormData((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const field of normalizedFields) {
        if (!isLocationIdField(field)) continue;
        const current = prev[field.name];
        if (current == null || current === "") continue;
        const resolved = resolveSelectOptionValue(
          current,
          locationSelectOptionsList,
        );
        if (resolved && resolved !== current) {
          next[field.name] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [locationSelectOptionsList, normalizedFields]);

  useEffect(() => {
    const newData = getInitialFormData();
    setFormData((prev) => {
      // Only update if data has actually changed to prevent unnecessary re-renders
      try {
        if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
      } catch {
        // If stringify fails (circular refs, etc.), update anyway
      }
      return newData;
    });
    if (isEditMode) {
      try {
        setInitialEditSnapshot(JSON.stringify(newData));
      } catch {
        setInitialEditSnapshot(null);
      }
    } else {
      setInitialEditSnapshot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, normalizedFields, isEditMode]); // Dependencies for re-initializing form data

  const hasFormChanges = useMemo(() => {
    if (!isEditMode || initialEditSnapshot === null) return false;
    try {
      return JSON.stringify(formData) !== initialEditSnapshot;
    } catch {
      return false;
    }
  }, [formData, isEditMode, initialEditSnapshot]);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => {
      if (prev[name] === value) return prev;
      return { ...prev, [name]: value };
    });
    onTestConnectionSuccess?.(false);
  };

  const handleAgentPlatformChange = useCallback(
    (platform: string) => {
      setFormData((prev) => {
        if (prev.agent_platform === platform) return prev;
        return { ...prev, agent_platform: platform };
      });
      onTestConnectionSuccess?.(false);
    },
    [onTestConnectionSuccess],
  );

  const handleAgentStateChange = useCallback(
    (state: AgentWizardPersistedState) => {
      setFormData((prev) => {
        const next = { ...prev };
        let changed = false;

        if (
          state.agent_platform !== undefined &&
          prev.agent_platform !== state.agent_platform
        ) {
          next.agent_platform = state.agent_platform;
          changed = true;
        }
        if (state.agent_config !== undefined) {
          const prevJson = JSON.stringify(prev.agent_config ?? null);
          const nextJson = JSON.stringify(state.agent_config);
          if (prevJson !== nextJson) {
            next.agent_config = state.agent_config;
            changed = true;
          }
        }
        if (
          state.agent_config_filename !== undefined &&
          prev.agent_config_filename !== state.agent_config_filename
        ) {
          next.agent_config_filename = state.agent_config_filename;
          changed = true;
        }
        if (
          state.config_generated !== undefined &&
          prev.config_generated !== state.config_generated
        ) {
          next.config_generated = state.config_generated;
          changed = true;
        }

        return changed ? next : prev;
      });
    },
    [],
  );

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPassword((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  // Helper function to transform form data from unique names back to original names
  const transformFormData = (
    data: Record<string, any>,
  ): Record<string, any> => {
    const transformedData: Record<string, any> = {};

    // Create a mapping from unique names to original names
    const fieldMapping = new Map<string, string>();
    processedFields.forEach((field) => {
      if (field.uniqueName) {
        fieldMapping.set(field.uniqueName, field.originalName || field.name);
      }
    });

    // Transform the form data
    Object.keys(data).forEach((key) => {
      const originalName = fieldMapping.get(key) || key;
      const fieldDef = processedFields.find(
        (f) => (f.uniqueName || f.name) === key,
      );
      let value = data[key];
      if (fieldDef?.type === "key-value") {
        value = serializeKeyValueForApi(data[key]);
      }

      // For duplicate fields, we need to decide which one to use
      // We'll use the last one that has a value (non-empty)
      if (value !== undefined && value !== null && value !== "") {
        transformedData[originalName] = value;
      } else if (!(originalName in transformedData)) {
        // If no value exists yet for this original name, set it even if empty
        transformedData[originalName] = value;
      }
    });

    return transformedData;
  };

  const resolvedConnectionId = useMemo(
    () => resolveWizardConnectionId(savedConnectionId, initialData),
    [savedConnectionId, initialData],
  );

  const isAgentMode =
    String(formData.connection_mode ?? "").toLowerCase() === "agent";

  const resolvedConnectionType =
    connectionType || formSchema.form_id || formSchema.name || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (isEditMode && !hasFormChanges) return;
    const payload = transformFormData(formData);
    if (hasLocationIdField) {
      const locationField = normalizedFields.find((f) => isLocationIdField(f));
      const locationKey = locationField?.name ?? LOCATION_ID_FIELD_NAME;
      const selected = formData[locationKey];
      if (selected != null && String(selected).trim() !== "") {
        payload[LOCATION_ID_FIELD_NAME] = String(selected).trim();
      }
    }
    onSubmit(
      mergeAgentFieldsIntoConnectionPayload(
        formData as Record<string, unknown>,
        payload as Record<string, unknown>,
      ),
    );
  };

  // const handleTestClick = () => {
  //   if (onTestConnection) {
  //     onTestConnection(formData);
  //   }
  // };

  const isFieldVisible = (field: FormField) => {
    if (field.visible === false) return false;
    if (field.type === "step-wizard") return false;
    if (field.show_after_save && !resolvedConnectionId) return false;
    if (!field.depends_on || field.depends_on.length === 0) {
      return true;
    }

    // Handle multiple dependencies with array of expected values
    if (field.depends_on.length > 1 && Array.isArray(field.depends_value)) {
      // Special case for username/password fields with protocol_type and auth_type dependencies
      if (
        field.depends_on.includes("protocol_type") &&
        field.depends_on.includes("auth_type") &&
        (field.name === "user_name" || field.name === "password")
      ) {
        const protocolType = formData["protocol_type"];
        const authType = formData["auth_type"];

        // Show if protocol_type is DB or RFC (regardless of auth_type)
        if (protocolType === "DB" || protocolType === "RFC") return true;

        // Show if protocol_type is ODATA AND auth_type is Basic
        if (protocolType === "ODATA" && authType === "Basic") return true;

        return false;
      }

      // Default behavior for other multiple dependency cases: check if ANY combination matches
      let hasMatch = false;

      // Check each dependency against the depends_value array
      for (const dependency of field.depends_on) {
        const dependencyValue = formData[dependency];

        // If this dependency value matches any of the expected values
        if (
          field.depends_value.some(
            (expectedValue) =>
              String(dependencyValue) === String(expectedValue),
          )
        ) {
          hasMatch = true;
          break; // Found a match, no need to check other dependencies
        }
      }

      return hasMatch;
    }

    // Default behavior: ALL dependencies must match (AND logic)
    return field.depends_on.every((dependency) => {
      // For dependency checking, we need to look at all fields with the original name
      // since the dependency refers to the original field name, not the unique name
      const dependencyValue = formData[dependency];

      // Handle new API format where depends_value can be an array
      if (Array.isArray(field.depends_value)) {
        return field.depends_value.some(
          (expectedValue) => String(dependencyValue) === String(expectedValue),
        );
      } else {
        // Backward compatibility for single value
        return String(dependencyValue) === String(field.depends_value);
      }
    });
  };

  const groupFields = (fields: FormField[], fieldsPerRow: number) => {
    const visibleFields = fields.filter(isFieldVisible);

    // Separate button fields from other fields
    const buttonFields = visibleFields.filter(
      (field) => field.type === "button",
    );
    const nonButtonFields = visibleFields.filter(
      (field) => field.type !== "button",
    );

    const rows: (FormField | null)[][] = [];
    let currentRow: (FormField | null)[] = [];

    // First, process all non-button fields
    nonButtonFields.forEach((field) => {
      if (field.type === "textArea" || field.type === "key-value") {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
          currentRow = [];
        }
        rows.push([field]);
      } else {
        currentRow.push(field);
        if (currentRow.length === fieldsPerRow) {
          rows.push([...currentRow]);
          currentRow = [];
        }
      }
    });

    // Add button fields to ensure they're always in the corner (rightmost position)
    if (buttonFields.length > 0) {
      // Always ensure buttons appear in the corner by filling the last row to the required position
      if (currentRow.length === 0) {
        // If no current row, create a new row with empty slots and button at the end
        const emptySlots = fieldsPerRow - buttonFields.length;
        const fillerFields: (FormField | null)[] = new Array(emptySlots).fill(
          null,
        );
        currentRow = [...fillerFields, ...buttonFields];
      } else {
        // Calculate how many empty slots we need to push button to the corner
        const totalSlotsNeeded = fieldsPerRow;
        const currentFieldCount = currentRow.length;
        const buttonCount = buttonFields.length;

        if (currentFieldCount + buttonCount <= totalSlotsNeeded) {
          // Fill remaining slots with empty placeholders, then add buttons at the end
          const emptySlots = totalSlotsNeeded - currentFieldCount - buttonCount;
          const fillerFields: (FormField | null)[] = new Array(emptySlots).fill(
            null,
          );
          currentRow = [
            ...currentRow,
            ...fillerFields,
            ...buttonFields,
          ] as FormField[];
        } else {
          // Current row is too full, create new row with button in corner
          rows.push([...currentRow]);
          const emptySlots = totalSlotsNeeded - buttonCount;
          const fillerFields: (FormField | null)[] = new Array(emptySlots).fill(
            null,
          );
          currentRow = [...fillerFields, ...buttonFields];
        }
      }
    }

    if (currentRow.length > 0) {
      rows.push([...currentRow]);
    }

    return rows;
  };

  const renderFormField = (field: FormField, index: number) => {
    const { name, type, label, placeholder, required, info, uniqueName } =
      field;
    const fieldName = uniqueName || name; // Use unique name for form control, fallback to original name
    const fieldId = `field-${fieldName}-${index}`; // Ensure unique ID for label association
    const effectiveType =
      isSelectLikeFieldType(type) || isLocationIdField(field)
        ? "select"
        : type === "integer" || type === "int"
          ? "number"
          : type;

    switch (effectiveType) {
      case "text":
        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <FormFieldLabel htmlFor={fieldId} label={label} required={required} />
            <Input
              id={fieldId}
              name={fieldName}
              placeholder={placeholder}
              value={(formData[fieldName] as string) || ""}
              onChange={(e) => handleInputChange(fieldName, e.target.value)}
              required={required}
              className={FORM_FIELD_INPUT_CLASS}
            />
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );

      case "password":
        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <FormFieldLabel htmlFor={fieldId} label={label} required={required} />
            <div className={`relative ${FORM_FIELD_CONTROL_CLASS}`}>
              <Input
                id={fieldId}
                name={fieldName}
                type={showPassword[fieldName] ? "text" : "password"}
                placeholder={placeholder}
                value={(formData[fieldName] as string) || ""}
                onChange={(e) => handleInputChange(fieldName, e.target.value)}
                required={required}
                className={`${FORM_FIELD_INPUT_CLASS} pr-9`}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility(fieldName)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword[fieldName] ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );

      case "select": {
        const isLocationDropdown =
          isLocationIdField(field) || isLocationSelectLabel(label);
        const selectOptions: LocationSelectOption[] = isLocationDropdown
          ? locationSelectOptionsList
          : (field.options ?? []);
        const storageKey = isLocationDropdown
          ? LOCATION_ID_FIELD_NAME
          : fieldName;
        const rawSelectValue = String(formData[storageKey] ?? "").trim();
        const selectValue = resolveSelectOptionValue(
          rawSelectValue,
          selectOptions,
        );
        const selectPlaceholder =
          isLocationDropdown && locationsLoading
            ? "Loading locations..."
            : isLocationDropdown && selectOptions.length === 0
              ? "No locations found"
              : placeholder || "Select an option";

        if (isLocationDropdown) {
          return (
            <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
              <FormFieldLabel htmlFor={fieldId} label={label} required={required} />
              <Combobox
                options={selectOptions}
                value={selectValue || undefined}
                onChange={(value) =>
                  handleInputChange(LOCATION_ID_FIELD_NAME, String(value))
                }
                placeholder={selectPlaceholder}
                searchPlaceholder="Search locations..."
                emptyText="No locations found."
                isLoading={locationsLoading}
                disabled={locationsLoading}
                className={`${FORM_FIELD_INPUT_CLASS} font-normal shadow-xs`}
              />
              {info && (
                <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                  {info}
                </p>
              )}
            </div>
          );
        }

        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <FormFieldLabel htmlFor={fieldId} label={label} required={required} />
            <Select
              value={selectValue || undefined}
              onValueChange={(value) => handleInputChange(fieldName, value)}
              required={required}
            >
              <SelectTrigger
                id={fieldId}
                size="sm"
                className={FORM_FIELD_INPUT_CLASS}
              >
                <SelectValue placeholder={selectPlaceholder} />
              </SelectTrigger>
              <SelectContent
                position="item-aligned"
                className="max-h-60 z-[200]"
              >
                {selectOptions.map((option, optionIndex) => (
                  <SelectItem
                    key={`${option.value}-${optionIndex}`}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );
      }

      case "textArea":
        return (
          <div key={fieldId} className="space-y-1 col-span-full">
            <Label
              htmlFor={fieldId}
              className="text-xs font-medium text-foreground leading-tight"
            >
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={fieldId}
              name={fieldName}
              placeholder={placeholder}
              value={(formData[fieldName] as string) || ""}
              onChange={(e) => handleInputChange(fieldName, e.target.value)}
              required={required}
              className="min-h-[4.5rem] w-full resize-none rounded-md px-2.5 py-1.5 text-sm"
              rows={3}
            />
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );

      case "checkbox":
        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <span className={FORM_FIELD_LABEL_CLASS} aria-hidden />
            <div className={`${FORM_FIELD_CONTROL_CLASS} gap-2`}>
              <Checkbox
                id={fieldId}
                checked={!!formData[fieldName]}
                onCheckedChange={(checked) =>
                  handleInputChange(fieldName, checked)
                }
              />
              <div className="grid min-w-0 gap-0.5 leading-tight">
                <Label
                  htmlFor={fieldId}
                  className="cursor-pointer text-xs font-medium text-foreground"
                >
                  {label}
                </Label>
                {info && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {info}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "number":
        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <FormFieldLabel htmlFor={fieldId} label={label} required={required} />
            <Input
              id={fieldId}
              name={fieldName}
              type="number"
              placeholder={placeholder}
              value={(formData[fieldName] as number | string) || ""}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(e) =>
                handleInputChange(
                  fieldName,
                  e.target.value === "" ? "" : parseFloat(e.target.value),
                )
              }
              required={required}
              className={FORM_FIELD_INPUT_CLASS}
            />
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );

      case "upload":
        return (
          <div key={fieldId} className="space-y-1">
            <Label
              htmlFor={fieldId}
              className="text-xs font-medium text-foreground leading-tight"
            >
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={fieldId}
                name={fieldName}
                type="file"
                accept={field.accept}
                multiple={field.multiple}
                onChange={(e) => {
                  const files = e.target.files;
                  if (field.multiple) {
                    handleInputChange(
                      fieldName,
                      files ? Array.from(files) : [],
                    );
                  } else {
                    handleInputChange(fieldName, files ? files[0] : null);
                  }
                }}
                required={required}
                className="h-8 min-h-8 w-full rounded-md px-2 text-sm file:mr-2 file:h-6 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent"
              />
            </div>
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );

      case "key-value": {
        const rows = normalizeKeyValueRows(formData[fieldName]);
        const updatePair = (index: number, patch: Partial<KeyValueRow>) => {
          const next = rows.map((r, i) =>
            i === index ? { ...r, ...patch } : r,
          );
          handleInputChange(fieldName, next);
        };
        const addPair = () => {
          handleInputChange(fieldName, [...rows, { key: "", value: "" }]);
        };
        const removePair = (index: number) => {
          if (rows.length <= 1) {
            handleInputChange(fieldName, [{ key: "", value: "" }]);
            return;
          }
          handleInputChange(
            fieldName,
            rows.filter((_, i) => i !== index),
          );
        };
        return (
          <div key={fieldId} className="space-y-1 col-span-full">
            <Label className="text-xs font-medium text-foreground leading-tight">
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <div className="space-y-1.5">
              {rows.map((row, rowIndex) => (
                <div
                  key={`${fieldId}-pair-${rowIndex}`}
                  className="flex flex-col gap-1.5 sm:flex-row sm:items-end"
                >
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor={`${fieldId}-key-${rowIndex}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Key
                    </Label>
                    <Input
                      id={`${fieldId}-key-${rowIndex}`}
                      placeholder="Header name"
                      value={row.key}
                      onChange={(e) =>
                        updatePair(rowIndex, { key: e.target.value })
                      }
                      className="h-8 min-h-8 w-full rounded-md px-2.5 text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor={`${fieldId}-value-${rowIndex}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Value
                    </Label>
                    <Input
                      id={`${fieldId}-value-${rowIndex}`}
                      placeholder={placeholder || "Value"}
                      value={row.value}
                      onChange={(e) =>
                        updatePair(rowIndex, { value: e.target.value })
                      }
                      className="h-8 min-h-8 w-full rounded-md px-2.5 text-sm"
                    />
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-end self-end sm:self-end">
                    {rows.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-border text-muted-foreground"
                        onClick={() => removePair(rowIndex)}
                        aria-label="Remove header"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="md"
                className="h-8 gap-1 border-border px-2.5 text-xs"
                onClick={addPair}
              >
                <Plus className="h-3.5 w-3.5" />
                Add header
              </Button>
            </div>
            {info && (
              <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                {info}
              </p>
            )}
          </div>
        );
      }

      case "button":
        return (
          <div key={fieldId} className={FORM_FIELD_WRAPPER_CLASS}>
            <span className={FORM_FIELD_LABEL_CLASS} aria-hidden />
            <Button
              id={fieldId}
              type="button"
              size="md"
              onClick={() => {
                if (onCustomAction) {
                  onCustomAction(field, transformFormData(formData));
                }
              }}
              disabled={isActionLoading[name]}
              className="h-8 min-h-8 w-full max-w-[10rem] justify-center gap-1.5 rounded-md px-3 text-sm sm:w-[10rem]"
            >
              {isActionLoading[name] ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-primary-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Testing...
                </>
              ) : (
                label
              )}
            </Button>
          </div>
        );

      default:
        return <div key={fieldId} className="text-muted-foreground">Unsupported field type: {type}</div>;
    }
  };

  const getGridClass = (isFullWidthRow: boolean) => {
    if (isFullWidthRow) return "grid grid-cols-1 items-start gap-x-4 gap-y-3";
    switch (layout) {
      case 1:
        return "grid grid-cols-1 items-start gap-x-4 gap-y-3";
      case 2:
        return "grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-2";
      case 3:
      default:
        return "grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3";
    }
  };

  // Process fields to handle duplicates and create unique identifiers
  const processedFields = useMemo(
    () =>
      normalizedFields.map((field, index) => {
        const duplicateCount = normalizedFields
          .slice(0, index)
          .filter((f) => f.name === field.name).length;
        const uniqueName =
          duplicateCount > 0 ? `${field.name}_${duplicateCount + 1}` : field.name;
        const options = isLocationIdField(field)
          ? locationSelectOptionsList.length > 0
            ? locationSelectOptionsList
            : field.options
          : field.options;

        return {
          ...field,
          options,
          uniqueName,
          originalName: field.name,
        };
      }),
    [normalizedFields, locationSelectOptionsList],
  );

  const fieldRows = groupFields(processedFields, layout);

  // Check if form has a test connection button
  const hasTestConnectionButton = normalizedFields.some(
    (field) =>
      field.type === "button" && field.name.toLowerCase().includes("test"),
  );

  const isSubmitDisabled =
    isSubmitting ||
    (isEditMode
      ? !hasFormChanges
      : hasTestConnectionButton && !testConnectionSuccess);

  const effectiveSubmitText =
    isAgentMode && !resolvedConnectionId && !isEditMode
      ? "Save Connection"
      : submitButtonText;

  const agentWizardFormValues = useMemo(
    () => ({
      ...transformFormData(formData),
      id: resolvedConnectionId,
      connection_id: resolvedConnectionId,
      agent_platform: formData.agent_platform,
      agent_config: formData.agent_config,
      agent_config_filename: formData.agent_config_filename,
      config_generated: formData.config_generated,
    }),
    [formData, resolvedConnectionId, processedFields],
  );

  const formIcon = formSchema.icon?.trim();

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {formIcon && !isEditMode ? (
            <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
              <ConnectorIcon icon={formIcon} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {connectionTypeLabel || formSchema.display_name}
                </p>
                {formSchema.description ? (
                  <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {formSchema.description}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {fieldRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={getGridClass(
                row.length === 1 &&
                  row[0] &&
                  (row[0].type === "textArea" ||
                    row[0].type === "key-value"),
              )}
            >
              {row.map((field, fieldIndex) => {
                // Handle null placeholder fields for button positioning
                if (!field) {
                  return (
                    <div key={`empty-${fieldIndex}`} className="min-w-0"></div>
                  );
                }

                // For textAreas, they will be the only item in 'row' and take col-span-full
                // For other fields, they fit into the grid layout.
                return (
                  <div
                    key={`${field.name}-${fieldIndex}`}
                    className={`min-w-0 ${field.type === "textArea" || field.type === "key-value" ? "col-span-full" : ""}`}
                  >
                    {renderFormField(field, fieldIndex)}
                  </div>
                );
              })}
            </div>
          ))}

          {isAgentMode && !resolvedConnectionId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Save credentials to continue agent setup
              </p>
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                Fill in the connection details above and click{" "}
                <span className="font-semibold">Save Connection</span>. A{" "}
                <span className="font-mono">connection_id</span> will be returned
                and used in Step 2 to generate the agent configuration.
              </p>
            </div>
          ) : null}

          {isAgentMode && resolvedConnectionId ? (
            <AgentSetupWizard
              connectionId={resolvedConnectionId}
              connectionType={resolvedConnectionType}
              connectionTypeLabel={
                connectionTypeLabel || formSchema.display_name
              }
              agentPlatform={String(formData.agent_platform ?? "")}
              onPlatformChange={handleAgentPlatformChange}
              onAgentStateChange={handleAgentStateChange}
              steps={buildDefaultAgentWizardSteps(resolvedConnectionType)}
              saveConnectionModule={
                formSchema.save_connection?.module ?? "ingestion"
              }
              formValues={agentWizardFormValues}
            />
          ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            className="h-8 min-h-8 px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="md"
            disabled={isSubmitDisabled}
            className="h-8 min-h-8 px-4 text-primary-foreground disabled:!cursor-not-allowed disabled:opacity-50"
            aria-disabled={isSubmitDisabled}
          >
            {isSubmitting ? "Saving…" : effectiveSubmitText}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default CredDynamicForm;

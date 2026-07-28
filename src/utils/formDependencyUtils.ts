/**
 * Form Field Dependency Utilities
 *
 * Handles conditional field visibility based on other field values
 */

import { FormSubmissionData } from '@/types/form';

interface FieldWithDependencies {
  key?: string;
  depends_key?: string[];
  depends_value?: string | string[];
}

const dependencyValuesMatch = (actual: unknown, expected: unknown): boolean =>
  String(actual).toLowerCase() === String(expected).toLowerCase();

/**
 * Check if a field should be visible based on its dependencies
 *
 * Rules:
 * 1. No dependencies = always visible
 * 2. Single key + multiple values = OR logic (automatic)
 * 3. Multiple keys + multiple values = AND logic (by index)
 * 4. Pipe separator also works for OR: "DB|RFC"
 *
 * @example
 * // Single dependency
 * depends_key: ["type"], depends_value: ["upload"]
 * Shows when: type === "upload"
 *
 * @example
 * // OR condition (single key, multiple values)
 * depends_key: ["protocol_type"], depends_value: ["DB", "RFC"]
 * Shows when: protocol_type === "DB" OR protocol_type === "RFC"
 *
 * @example
 * // OR condition (pipe separator also works)
 * depends_key: ["protocol_type"], depends_value: ["DB|RFC"]
 * Shows when: protocol_type === "DB" OR protocol_type === "RFC"
 *
 * @example
 * // Multiple dependencies (AND)
 * depends_key: ["type", "mode"], depends_value: ["sftp", "write"]
 * Shows when: type === "sftp" AND mode === "write"
 */
export function checkFieldDependencies(
  field: FieldWithDependencies,
  formValues: FormSubmissionData
): boolean {
  // No dependencies = always show
  if (!field.depends_key || !field.depends_value) {
    return true;
  }

  // Normalize depends_value to array if it's a string
  const dependsValueArray = Array.isArray(field.depends_value)
    ? field.depends_value
    : [field.depends_value];

  // Validate depends_key is array
  if (!Array.isArray(field.depends_key)) {
    console.warn('[Dependency] depends_key must be an array:', field.key);
    return true;
  }

  // Special case: Single key with multiple values = OR logic
  if (field.depends_key.length === 1 && dependsValueArray.length > 1) {
    const dependencyKey = field.depends_key[0];
    const actualValue = formValues[dependencyKey];

    // Empty dependency value = hide field
    if (
      actualValue === undefined ||
      actualValue === null ||
      actualValue === '' ||
      (Array.isArray(actualValue) && actualValue.length === 0)
    ) {
      return false;
    }

    // Check if actual value matches ANY of the expected values (OR logic)
    return dependsValueArray.some((expectedValue) =>
      dependencyValuesMatch(actualValue, expectedValue),
    );
  }

  // Check array lengths match (for AND conditions)
  if (field.depends_key.length !== dependsValueArray.length) {
    console.warn('[Dependency] Array length mismatch:', field.key);
    return true;
  }

  // Check each dependency (AND logic between different keys)
  for (let i = 0; i < field.depends_key.length; i++) {
    const dependencyKey = field.depends_key[i];
    const expectedValue = dependsValueArray[i];
    const actualValue = formValues[dependencyKey];

    // Empty dependency value = hide field
    if (
      actualValue === undefined ||
      actualValue === null ||
      actualValue === '' ||
      (Array.isArray(actualValue) && actualValue.length === 0)
    ) {
      return false;
    }

    // Check for pipe separator (OR logic within a single value)
    if (typeof expectedValue === 'string' && expectedValue.includes('|')) {
      const allowedValues = expectedValue.split('|').map((v) => v.trim().toLowerCase());
      if (!allowedValues.includes(String(actualValue).toLowerCase())) {
        return false;
      }
    } else if (!dependencyValuesMatch(actualValue, expectedValue)) {
      return false;
    }
  }

  return true;
}

/**
 * API Connector: fields that only `depends_key: ["body"]` must not show for GET/HEAD/etc.,
 * because `body` can stay set while the Body Type control is hidden (depends on http_method).
 */
export function checkFieldDependenciesForApiConnector(
  field: FieldWithDependencies,
  formValues: FormSubmissionData
): boolean {
  const allowsRequestBody = ["POST", "PUT", "DELETE", "PATCH"].includes(
    String(formValues.http_method ?? "").toUpperCase()
  );

  const deps = field.depends_key;
  if (
    Array.isArray(deps) &&
    deps.length === 1 &&
    deps[0] === "body" &&
    field.key !== "body"
  ) {
    if (!allowsRequestBody) return false;
  }

  return checkFieldDependencies(field, formValues);
}

/**
 * Get only visible fields based on dependencies
 */

export function getVisibleFields<T extends FieldWithDependencies>(
  fields: T[],
  formValues: FormSubmissionData
): T[] { 
  return fields.filter(field => checkFieldDependencies(field, formValues));
}

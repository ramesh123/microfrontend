/** Form keys used for database table selection / new table name entry. */
export const TABLE_NAME_FIELD_KEYS = new Set(['table', 'write_table']);

export function isTableNameFieldKey(key: string): boolean {
  return TABLE_NAME_FIELD_KEYS.has(key);
}

/** Inline "Create table" text box in table dropdown (write path). */
export function fieldSupportsInlineCreateTable(fieldKey: string, mode: unknown): boolean {
  if (fieldKey === 'write_table') return true;
  if (fieldKey === 'table' && String(mode ?? '').toLowerCase() === 'write') return true;
  return false;
}

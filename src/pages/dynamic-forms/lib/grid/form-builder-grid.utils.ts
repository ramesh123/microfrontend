import type { FormBuilderField, FormBuilderFieldLayout, FormFieldWidth } from '../../types';

export const FIELD_GRID_COLS = 12;

export const FIELD_GRID_DEFAULTS = {
  cols: FIELD_GRID_COLS,
  defaultW: 6,
  defaultH: 3,
  minW: 3,
  minH: 2,
  rowHeight: 28,
  margin: [10,4] as [number, number],
};

const FORM_BUTTON_TYPES = new Set(['submit_button', 'cancel_button']);

const TALL_FIELD_TYPES = new Set([
  'textarea',
  'checkbox_group',
  'radio',
  'signature_pad',
  'google_maps_location',
  'multiple_file_upload',
  'data_table',
]);

const HALF_COLUMN_W = 6;

export function widthToGridUnits(width?: FormFieldWidth): number {
  return width === 'full' ? FIELD_GRID_COLS : 6;
}

export function gridUnitsToWidth(w: number): FormFieldWidth {
  return w >= FIELD_GRID_COLS ? 'full' : 'half';
}

export function getMinGridWidth(type: FormBuilderField['type']): number {
  if (FORM_BUTTON_TYPES.has(type) || type === 'big_number') return 2;
  return FIELD_GRID_DEFAULTS.minW;
}

export function getMinGridHeight(type: FormBuilderField['type']): number {
  if (type === 'signature_pad') return 8;
  if (type === 'google_maps_location') return 10;
  if (type === 'big_number') return 2;
  return FIELD_GRID_DEFAULTS.minH;
}

export function getDefaultGridWidth(type: FormBuilderField['type']): number {
  if (type === 'section_divider' || type === 'data_table') return FIELD_GRID_COLS;
  /** Compact KPI card — ~1/3 of the 12-col row (half-width fields use 6). */
  if (type === 'big_number') return 4;
  if (FORM_BUTTON_TYPES.has(type)) return 3;
  return FIELD_GRID_DEFAULTS.defaultW;
}

export function getDefaultFieldHeight(type: FormBuilderField['type']): number {
  if (type === 'section_divider') return 2;
  if (type === 'data_table') return 6;
  /** Compact by default; user resize controls the actual card height. */
  if (type === 'big_number') return 2;
  if (FORM_BUTTON_TYPES.has(type)) return 2;
  if (type === 'signature_pad') return 8;
  if (type === 'google_maps_location') return 10;
  return TALL_FIELD_TYPES.has(type) ? 5 : 3;
}

export function getDefaultFieldWidth(type: FormBuilderField['type']): FormFieldWidth {
  if (type === 'section_divider' || type === 'data_table') return 'full';
  if (FORM_BUTTON_TYPES.has(type)) return 'half';
  return 'half';
}

function layoutOverlapsColumn(
  layout: FormBuilderFieldLayout,
  columnX: number,
  columnW = HALF_COLUMN_W,
): boolean {
  return layout.x < columnX + columnW && layout.x + layout.w > columnX;
}

function getGlobalBottom(layouts: FormBuilderFieldLayout[]): number {
  return layouts.reduce((max, layout) => Math.max(max, layout.y + layout.h), 0);
}

function resolveLayouts(
  visible: FormBuilderField[],
): FormBuilderFieldLayout[] {
  return visible.map((field, fieldIndex) => ensureFieldLayout(field, fieldIndex, visible));
}

function getLayoutsOnRow(layouts: FormBuilderFieldLayout[], rowY: number): FormBuilderFieldLayout[] {
  return layouts.filter((layout) => layout.y === rowY);
}

function rowHasFullWidthField(rowLayouts: FormBuilderFieldLayout[]): boolean {
  return rowLayouts.some((layout) => layout.w >= FIELD_GRID_COLS);
}

function isColumnOccupiedOnRow(rowLayouts: FormBuilderFieldLayout[], columnX: number): boolean {
  return rowLayouts.some((layout) => layoutOverlapsColumn(layout, columnX));
}

/** Place fields in add order: left / right columns, buttons flow beside each other on the same row. */
export function getNextFieldLayout(
  existing: FormBuilderField[],
  fieldType?: FormBuilderField['type'],
): FormBuilderFieldLayout {
  const type = fieldType ?? 'text';
  const w = getDefaultGridWidth(type);
  const h = getDefaultFieldHeight(type);
  const layouts = resolveLayouts(existing);

  if (type === 'section_divider' || type === 'data_table') {
    return { x: 0, y: getGlobalBottom(layouts), w, h };
  }

  if (FORM_BUTTON_TYPES.has(type) || type === 'big_number') {
    const lastField = existing[existing.length - 1];
    const lastLayout = layouts[layouts.length - 1];
    const canPackBesideLast =
      lastField &&
      lastLayout &&
      (FORM_BUTTON_TYPES.has(lastField.type) || lastField.type === 'big_number') &&
      lastLayout.x + lastLayout.w + w <= FIELD_GRID_COLS;

    if (canPackBesideLast && lastLayout) {
      return { x: lastLayout.x + lastLayout.w, y: lastLayout.y, w, h };
    }

    // Pack into the first row that has a free horizontal slot.
    const rowYs = [...new Set(layouts.map((layout) => layout.y))].sort((a, b) => a - b);
    for (const rowY of rowYs) {
      const rowLayouts = getLayoutsOnRow(layouts, rowY);
      if (rowHasFullWidthField(rowLayouts)) continue;

      const sorted = [...rowLayouts].sort((a, b) => a.x - b.x);
      let cursor = 0;
      for (const item of sorted) {
        if (cursor + w <= item.x) {
          return { x: cursor, y: rowY, w, h };
        }
        cursor = Math.max(cursor, item.x + item.w);
      }
      if (cursor + w <= FIELD_GRID_COLS) {
        return { x: cursor, y: rowY, w, h };
      }
    }

    return { x: 0, y: getGlobalBottom(layouts), w, h };
  }

  const fieldW = Math.min(w, HALF_COLUMN_W);

  if (w >= FIELD_GRID_COLS) {
    return { x: 0, y: getGlobalBottom(layouts), w, h };
  }

  const rowYs = [...new Set(layouts.map((layout) => layout.y))].sort((a, b) => a - b);

  for (const rowY of rowYs) {
    const rowLayouts = getLayoutsOnRow(layouts, rowY);
    if (rowHasFullWidthField(rowLayouts)) continue;

    if (!isColumnOccupiedOnRow(rowLayouts, 0)) {
      return { x: 0, y: rowY, w: fieldW, h };
    }

    if (!isColumnOccupiedOnRow(rowLayouts, HALF_COLUMN_W)) {
      return { x: HALF_COLUMN_W, y: rowY, w: fieldW, h };
    }
  }

  return { x: 0, y: getGlobalBottom(layouts), w: fieldW, h };
}

export function ensureFieldLayout(
  field: FormBuilderField,
  index: number,
  visibleFields?: FormBuilderField[],
): FormBuilderFieldLayout {
  const minH = getMinGridHeight(field.type);

  if (field.layout) {
    return field.layout.h < minH ? { ...field.layout, h: minH } : field.layout;
  }

  const visible = visibleFields ?? [];
  const prior = visible.slice(0, index);
  return getNextFieldLayout(prior, field.type);
}

export function layoutWithWidth(
  layout: FormBuilderFieldLayout | undefined,
  width: FormFieldWidth,
  fieldType: FormBuilderField['type'],
): FormBuilderFieldLayout {
  const base = layout ?? { x: 0, y: 0, w: 6, h: getDefaultFieldHeight(fieldType) };
  return { ...base, w: widthToGridUnits(width) };
}

export function groupFieldsByLayoutRow(fields: FormBuilderField[]) {
  const visible = fields.filter((field) => field.visible);
  const items = visible
    .map((field, index) => ({ field, layout: ensureFieldLayout(field, index, visible) }))
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);

  const rowMap = new Map<number, typeof items>();
  for (const item of items) {
    const existing = rowMap.get(item.layout.y) ?? [];
    existing.push(item);
    rowMap.set(item.layout.y, existing);
  }

  return Array.from(rowMap.entries())
    .sort(([yA], [yB]) => yA - yB)
    .map(([, rowItems]) => rowItems.sort((a, b) => a.layout.x - b.layout.x));
}

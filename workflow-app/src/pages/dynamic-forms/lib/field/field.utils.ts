import { ALL_FIELD_TYPES } from '../../constants';
import { DEFAULT_DATE_PRESETS, isFormDateValueEmpty } from '../date/form-date.utils';
import { DEFAULT_TABLE_COLUMNS } from '../table/form-table.utils';
import { parseLocationValue } from '../location/location.utils';
import {
  FIELD_GRID_COLS,
  getDefaultFieldHeight,
  getDefaultFieldWidth,
  getDefaultGridWidth,
  getMinGridWidth,
} from '../grid/form-builder-grid.utils';
import type { FormBuilderField, FormBuilderFieldOption, FormBuilderFieldType, FormFieldValue } from '../../types';

const OPTION_FIELD_TYPES: FormBuilderFieldType[] = [
  'select',
  'multi_select',
  'radio',
  'checkbox_group',
  'segmented',
];

const NO_PLACEHOLDER_TYPES: FormBuilderFieldType[] = [
  'section_divider',
  'submit_button',
  'cancel_button',
  'data_table',
  'big_number',
  'date',
  'radio',
  'segmented',
  'checkbox',
  'switch',
  'checkbox_group',
  'file_upload',
  'image_upload',
  'multiple_file_upload',
  'signature_pad',
  'google_maps_location',
];

const DEFAULT_OPTIONS = [
  { value: 'option_1', label: 'Option 1' },
  { value: 'option_2', label: 'Option 2' },
  { value: 'option_3', label: 'Option 3' },
];

const LOCATION_OPTIONS: Record<'country' | 'state' | 'city', FormBuilderField['options']> = {
  country: [
    { value: 'us', label: 'United States' },
    { value: 'in', label: 'India' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
  ],
  state: [
    { value: 'ca', label: 'California' },
    { value: 'ny', label: 'New York' },
    { value: 'tx', label: 'Texas' },
    { value: 'ka', label: 'Karnataka' },
  ],
  city: [
    { value: 'sf', label: 'San Francisco' },
    { value: 'nyc', label: 'New York City' },
    { value: 'blr', label: 'Bengaluru' },
    { value: 'lon', label: 'London' },
  ],
};

export function isFormButtonType(type: FormBuilderFieldType): boolean {
  return type === 'submit_button' || type === 'cancel_button';
}

export function isDisplayFieldType(type: FormBuilderFieldType): boolean {
  return type === 'data_table' || type === 'big_number';
}

export function isInputFieldType(type: FormBuilderFieldType): boolean {
  return type !== 'section_divider' && !isFormButtonType(type) && !isDisplayFieldType(type);
}

export function isMappableFieldType(type: FormBuilderFieldType): boolean {
  return type !== 'section_divider' && !isFormButtonType(type);
}

export function fieldUsesOptions(type: FormBuilderFieldType): boolean {
  return OPTION_FIELD_TYPES.includes(type);
}

/** Fields whose choices can be loaded from an API (includes location selects). */
export function fieldHasOptionList(type: FormBuilderFieldType): boolean {
  return fieldUsesOptions(type) || type === 'country' || type === 'state' || type === 'city';
}

/** Fields that can be configured with static vs API data source in the inspector. */
export function fieldSupportsDataSource(type: FormBuilderFieldType): boolean {
  return isMappableFieldType(type);
}

/** Hardcoded choices kept when API options are merged or replaced. */
export function getFieldStaticOptions(field: FormBuilderField): FormBuilderFieldOption[] {
  return field.staticOptions ?? field.options ?? [];
}

export function fieldUsesDatePresets(type: FormBuilderFieldType): boolean {
  return type === 'date';
}

export function fieldUsesTableConfig(type: FormBuilderFieldType): boolean {
  return type === 'data_table';
}

export function fieldUsesBigNumberConfig(type: FormBuilderFieldType): boolean {
  return type === 'big_number';
}

export function isUploadFieldType(type: FormBuilderFieldType): boolean {
  return type === 'file_upload' || type === 'image_upload' || type === 'multiple_file_upload';
}

/** Fields that need live pointer input on the design canvas (not just preview). */
export function fieldSupportsCanvasInteraction(type: FormBuilderFieldType): boolean {
  return (
    isUploadFieldType(type) ||
    type === 'signature_pad' ||
    type === 'google_maps_location' ||
    type === 'date'
  );
}

export function fieldSupportsPlaceholder(type: FormBuilderFieldType): boolean {
  return !NO_PLACEHOLDER_TYPES.includes(type);
}

export function getDefaultFieldValue(field: FormBuilderField): FormFieldValue {
  if (field.defaultValue !== undefined && field.defaultValue !== '') {
    if (field.type === 'checkbox' || field.type === 'switch') {
      return field.defaultValue === 'true';
    }
    if (field.type === 'multi_select' || field.type === 'checkbox_group' || field.type === 'multiple_file_upload') {
      return field.defaultValue.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return field.defaultValue;
  }

  if (field.type === 'checkbox' || field.type === 'switch') return false;
  if (field.type === 'multi_select' || field.type === 'checkbox_group' || field.type === 'multiple_file_upload') {
    return [];
  }
  if (field.type === 'big_number') return field.bigNumberValue ?? '';
  if (field.type === 'data_table') return '';
  return '';
}

export function isFieldValueEmpty(field: FormBuilderField, value: FormFieldValue): boolean {
  if (field.type === 'section_divider' || isFormButtonType(field.type) || isDisplayFieldType(field.type)) {
    return false;
  }
  if (field.type === 'checkbox' || field.type === 'switch') {
    return field.required ? value !== true : false;
  }
  if (field.type === 'google_maps_location') {
    return !parseLocationValue(typeof value === 'string' ? value : '');
  }
  if (field.type === 'date') {
    return isFormDateValueEmpty(typeof value === 'string' ? value : '');
  }
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === undefined || value === null;
}

export function getFieldTypeLabel(type: FormBuilderFieldType, catalog: { type: FormBuilderFieldType; label: string }[]): string {
  return catalog.find((item) => item.type === type)?.label ?? 'Field';
}

/** Rebuild field config for a new type while keeping id, canvas position, and visibility. */
export function migrateFieldType(
  field: FormBuilderField,
  newType: FormBuilderFieldType,
  catalog: { type: FormBuilderFieldType; label: string }[] = ALL_FIELD_TYPES,
): FormBuilderField {
  if (field.type === newType) return field;

  const template = createDefaultField(newType, field.position, catalog);
  const isLayoutSpecial = newType === 'section_divider' || isFormButtonType(newType) || isDisplayFieldType(newType);

  const migrated: FormBuilderField = {
    ...template,
    id: field.id,
    position: field.position,
    visible: field.visible,
    width: getDefaultFieldWidth(newType),
    required: isLayoutSpecial ? undefined : (field.required ?? false),
  };

  if (isFormButtonType(newType)) {
    migrated.name = `${newType === 'submit_button' ? 'submit' : 'cancel'}_${field.id.slice(0, 8)}`;
  }

  if (field.layout) {
    const w = getDefaultGridWidth(newType);
    const h = getDefaultFieldHeight(newType);
    const minW = getMinGridWidth(newType);

    migrated.layout = {
      x: newType === 'section_divider' || newType === 'data_table' ? 0 : field.layout.x,
      y: field.layout.y,
      w: newType === 'section_divider' || newType === 'data_table' ? FIELD_GRID_COLS : Math.max(minW, Math.min(field.layout.w, w)),
      h,
    };
  }

  return migrated;
}

export function createDefaultField(
  type: FormBuilderFieldType,
  position: number,
  catalog: { type: FormBuilderFieldType; label: string }[],
  displayNameOverride?: string,
): FormBuilderField {
  const id = crypto.randomUUID();
  const displayName = displayNameOverride ?? getFieldTypeLabel(type, catalog);
  const nameSlug =
    displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${id.slice(0, 8)}`;
  const base: FormBuilderField = {
    id,
    name: nameSlug,
    displayName,
    type,
    required: false,
    visible: true,
    position,
    width: 'half',
  };

  if (type === 'section_divider') {
    return {
      ...base,
      displayName: displayNameOverride ?? 'Section Title',
    };
  }

  if (type === 'submit_button') {
    return {
      ...base,
      displayName: displayNameOverride ?? 'Submit',
      name: `submit_${id.slice(0, 8)}`,
      width: 'half',
    };
  }

  if (type === 'cancel_button') {
    return {
      ...base,
      displayName: displayNameOverride ?? 'Cancel',
      name: `cancel_${id.slice(0, 8)}`,
      width: 'half',
    };
  }

  if (fieldUsesOptions(type)) {
    const placeholder =
      type === 'select'
        ? 'Select an option'
        : type === 'multi_select'
          ? 'Select options'
          : undefined;

    return {
      ...base,
      placeholder,
      options: [...DEFAULT_OPTIONS],
      staticOptions: [...DEFAULT_OPTIONS],
      dataSource: 'static',
    };
  }

  if (type === 'country' || type === 'state' || type === 'city') {
    return {
      ...base,
      placeholder: `Select ${type}`,
      options: [...(LOCATION_OPTIONS[type] ?? DEFAULT_OPTIONS)],
      staticOptions: [...(LOCATION_OPTIONS[type] ?? DEFAULT_OPTIONS)],
      dataSource: 'static',
    };
  }

  if (type === 'address') {
    return { ...base, placeholder: 'Enter full address' };
  }

  if (type === 'date') {
    return {
      ...base,
      datePresets: DEFAULT_DATE_PRESETS.map((preset) => ({ ...preset })),
      allowCustomRange: true,
      datePickerColor: '#3B82F6',
    };
  }

  if (type === 'google_maps_location') {
    return { ...base, placeholder: 'Search location or enter coordinates' };
  }

  if (type === 'file_upload') {
    return { ...base, placeholder: 'Choose a file' };
  }

  if (type === 'image_upload') {
    return { ...base, placeholder: 'Choose an image' };
  }

  if (type === 'multiple_file_upload') {
    return { ...base, placeholder: 'Choose files' };
  }

  if (type === 'signature_pad') {
    return { ...base, placeholder: 'Sign here' };
  }

  if (type === 'big_number') {
    return {
      ...base,
      displayName: displayNameOverride ?? 'Total Revenue',
      bigNumberValue: '12,450',
      bigNumberPrefix: '$',
      bigNumberSubLabel: 'vs last month',
      bigNumberColor: '#3B82F6',
      width: getDefaultFieldWidth(type),
      dataSource: 'static',
    };
  }

  if (type === 'data_table') {
    const tableColumns = DEFAULT_TABLE_COLUMNS.map((column) => ({ ...column }));
    return {
      ...base,
      displayName: displayNameOverride ?? 'Data Table',
      tableColumns,
      tableInitialRowCount: 10,
      tableUi: {
        showSearch: true,
        showRefresh: true,
        showAddButton: true,
        addButtonLabel: 'Add',
        showRowActions: true,
        showColumnSort: true,
        showColumnFilter: true,
        searchUsesApi: false,
        searchQueryParam: 'search',
        customActions: [
          {
            id: 'act_edit',
            label: 'Edit',
            kind: 'screen',
            screenPresentation: 'dialog',
            screenSize: 'xl',
            screenColumns: 3,
            screenTitle: 'Edit',
            submitLabel: 'Update',
          },
          {
            id: 'act_delete',
            label: 'Delete',
            kind: 'api',
            variant: 'destructive',
            confirmMessage: 'Delete this row?',
          },
        ],
      },
      width: 'full',
      dataSource: 'static',
    };
  }

  if (displayNameOverride === 'Email') {
    return { ...base, placeholder: 'you@example.com' };
  }

  if (displayNameOverride === 'Phone Number') {
    return { ...base, placeholder: '+91 0000000000' };
  }

  return {
    ...base,
    placeholder: type === 'checkbox' ? undefined : 'Enter value',
    dataSource: 'static',
  };
}

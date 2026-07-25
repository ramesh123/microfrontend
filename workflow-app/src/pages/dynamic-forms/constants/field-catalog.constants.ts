import type { FieldTypeCategory } from '../types';

export const FIELD_CATEGORIES: FieldTypeCategory[] = [
  {
    id: 'basic',
    label: 'Basic Fields',
    fields: [
      { type: 'text', label: 'Text Input', description: 'Single-line text field' },
      { type: 'number', label: 'Number', description: 'Numeric input' },
      { type: 'password', label: 'Password', description: 'Masked password field' },
      { type: 'textarea', label: 'Text Area', description: 'Multi-line text field' },
      { type: 'date', label: 'Date Picker', description: 'Date selection field' },
      { type: 'text', label: 'Email', description: 'Email address field' },
      { type: 'text', label: 'Phone Number', description: 'Phone number field' },
    ],
  },
  {
    id: 'selection',
    label: 'Choice Fields',
    fields: [
      { type: 'select', label: 'Dropdown', description: 'Choose one option from a list' },
      { type: 'multi_select', label: 'Multi Select', description: 'Choose multiple options' },
      { type: 'radio', label: 'Radio Buttons', description: 'Single choice with radio buttons' },
      { type: 'checkbox', label: 'Checkbox', description: 'Single true / false toggle' },
      { type: 'switch', label: 'Toggle Switch', description: 'On / off switch control' },
      { type: 'checkbox_group', label: 'Checkbox Group', description: 'Select multiple checkboxes' },
      { type: 'segmented', label: 'Segmented Control', description: 'Choose one segment option' },
    ],
  },
  {
    id: 'upload',
    label: 'Advanced Fields',
    fields: [
      { type: 'file_upload', label: 'File Upload', description: 'Upload a single file' },
      { type: 'image_upload', label: 'Image Upload', description: 'Upload a single image' },
      { type: 'multiple_file_upload', label: 'Multiple File Upload', description: 'Upload multiple files' },
      { type: 'signature_pad', label: 'Signature', description: 'Draw a signature' },
      { type: 'address', label: 'Address', description: 'Full address text field' },
      { type: 'country', label: 'Country', description: 'Select a country' },
      { type: 'state', label: 'State', description: 'Select a state / region' },
      { type: 'city', label: 'City', description: 'Select a city' },
      { type: 'google_maps_location', label: 'Google Maps Location', description: 'Pick location on map' },
    ],
  },
  {
    id: 'display',
    label: 'Display',
    fields: [
      { type: 'big_number', label: 'Big Number', description: 'KPI card with a large metric value' },
      { type: 'data_table', label: 'Data Table', description: 'Tabular data with configurable columns and rows' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    fields: [
      { type: 'section_divider', label: 'Section Divider', description: 'Group fields under a section heading' },
      { type: 'cancel_button', label: 'Cancel', description: 'Cancel or close the form' },
      { type: 'submit_button', label: 'Submit', description: 'Submit the form' },
    ],
  },
  {
    id: 'location',
    label: 'Location Fields',
    fields: [],
  },
];

export const ALL_FIELD_TYPES = FIELD_CATEGORIES.flatMap((category) => category.fields);

/** One option per `type` for property panels (avoids duplicate select values). */
export const UNIQUE_FIELD_TYPE_OPTIONS = FIELD_CATEGORIES.flatMap((category) => category.fields).filter(
  (item, index, list) => list.findIndex((entry) => entry.type === item.type) === index,
);

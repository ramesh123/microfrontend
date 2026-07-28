import type { FormBuilderFieldType } from '../../types';

const FIELD_TYPE_BADGES: Partial<Record<FormBuilderFieldType, string>> = {
  section_divider: 'DIV',
  text: 'TXT',
  number: 'NUM',
  password: 'PWD',
  textarea: 'TXA',
  date: 'DATE',
  select: 'SEL',
  multi_select: 'MSEL',
  radio: 'RBTN',
  checkbox: 'CHK',
  checkbox_group: 'CHKG',
  switch: 'SW',
  segmented: 'SEG',
  file_upload: 'FILE',
  image_upload: 'IMG',
  multiple_file_upload: 'MFILE',
  signature_pad: 'SIG',
  country: 'SEL',
  state: 'SEL',
  city: 'SEL',
  address: 'TXT',
  google_maps_location: 'MAP',
  submit_button: 'SUB',
  cancel_button: 'CAN',
  big_number: 'KPI',
  data_table: 'TBL',
};

export function getFieldTypeBadge(type: FormBuilderFieldType): string {
  return FIELD_TYPE_BADGES[type] ?? type.slice(0, 4).toUpperCase();
}

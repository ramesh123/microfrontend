export type FormBuilderFieldType =
  | 'section_divider'
  | 'text'
  | 'number'
  | 'password'
  | 'textarea'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'checkbox_group'
  | 'switch'
  | 'segmented'
  | 'file_upload'
  | 'image_upload'
  | 'multiple_file_upload'
  | 'signature_pad'
  | 'country'
  | 'state'
  | 'city'
  | 'address'
  | 'google_maps_location'
  | 'submit_button'
  | 'cancel_button'
  | 'data_table'
  | 'big_number';

export type FormFieldCategoryId = 'layout' | 'basic' | 'selection' | 'upload' | 'location' | 'display';

/** How a table cell is rendered. */
export type FormBuilderTableColumnDisplay = 'text' | 'badge';

export interface FormBuilderTableColumn {
  id: string;
  /** Header shown in the table. */
  label: string;
  /** Dot-path into each row object (e.g. type, node.payload.name). Falls back to label when empty. */
  responseKey?: string;
  /** Cell display style. Default: text. */
  display?: FormBuilderTableColumnDisplay;
}

/** Custom row action the user configures for a Data Table. */
export type FormBuilderTableCustomActionKind = 'message' | 'api' | 'navigate' | 'screen';

/** Shared size presets for action screens (dialog + sheet use the same options). */
export type FormBuilderTableScreenSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** How the Open screen is shown: modal, side panel, or full page (with Back). */
export type FormBuilderTableScreenPresentation = 'dialog' | 'sheet' | 'page';

/** Field types users can place on an Open Screen. */
export type FormBuilderTableScreenFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'password';

/** User-built field on an Open Screen (dialog / sheet). */
export interface FormBuilderTableScreenField {
  id: string;
  /** Internal form key (also default submit key). */
  name: string;
  label: string;
  type: FormBuilderTableScreenFieldType;
  placeholder?: string;
  required?: boolean;
  /** Optional: seed value from a table column before Load API. */
  bindColumnId?: string;
  /** Load API: JSON path / key used to fill this field (supports nested paths). */
  responseKey?: string;
  /** Submit API: key written into the request body (defaults to name). */
  submitKey?: string;
  /** When false, field is shown/edited but omitted from submit payload. */
  includeInSubmit?: boolean;
  /** Display-only; user cannot change the value. */
  readOnly?: boolean;
  /** Span full width in the screen grid. */
  fullWidth?: boolean;
  /** Options for select fields. */
  options?: { value: string; label: string }[];
}

export interface FormBuilderTableCustomAction {
  id: string;
  label: string;
  kind: FormBuilderTableCustomActionKind;
  /** navigate: path or URL (supports {field} tokens from the row). */
  href?: string;
  /** api: logic step id to run when clicked. */
  stepId?: string;
  /** Optional confirm dialog text. */
  confirmMessage?: string;
  variant?: 'default' | 'destructive';
  /** screen: dialog or side sheet. */
  screenPresentation?: FormBuilderTableScreenPresentation;
  /** screen: shared width/height preset for dialog and sheet. */
  screenSize?: FormBuilderTableScreenSize;
  /** screen: title shown in the panel header. */
  screenTitle?: string;
  /** screen: form grid columns (like Edit User: 3). */
  screenColumns?: 1 | 2 | 3;
  /** screen: primary button label (e.g. Update User). */
  submitLabel?: string;
  /** screen: optional API step to load detail when the screen opens. */
  loadStepId?: string;
  /** screen: root path into load response before reading field keys (e.g. data). */
  loadResponsePath?: string;
  /** screen: optional API step to run on Save. */
  submitStepId?: string;
  /**
   * Full nested form builder definition for this screen (Design + Logic + Integration).
   * Prefer this over screenFields for an exact mirror of the base form builder.
   */
  screenDefinition?: FormBuilderDefinition;
  /** @deprecated Prefer screenDefinition — kept for older edit screens. */
  screenFields?: FormBuilderTableScreenField[];
}

/** Toolbar / row-action options for Data Table (Users-table style). */
export interface FormBuilderTableUiConfig {
  showSearch?: boolean;
  showRefresh?: boolean;
  showAddButton?: boolean;
  addButtonLabel?: string;
  showRowActions?: boolean;
  /** @deprecated Prefer customActions */
  showEditAction?: boolean;
  /** @deprecated Prefer customActions */
  showDeleteAction?: boolean;
  /** User-defined actions shown in the row ⋮ menu. */
  customActions?: FormBuilderTableCustomAction[];
  /** Show sort icons on column headers. Default true. */
  showColumnSort?: boolean;
  /** Show filter icons on column headers. Default true. */
  showColumnFilter?: boolean;
  /** When true, toolbar search calls the API step instead of filtering locally. */
  searchUsesApi?: boolean;
  /** Query param name sent with API search (e.g. search, q). */
  searchQueryParam?: string;
  /** API logic step id used for search / refresh. */
  searchStepId?: string;
}

export interface FormBuilderTableRow {
  id: string;
  cells: Record<string, string>;
}

export interface FormBuilderFieldOption {
  value: string;
  label: string;
}

/** Whether a field uses hardcoded values/options, API-only, or both combined. */
export type FormFieldDataSource = 'static' | 'api' | 'static_and_api';

/** How Set options merges API results with hardcoded choices. */
export type FormOptionMergeMode = 'replace' | 'append' | 'static_only';

export interface FormFieldApiSourceConfig {
  /** API logic step id to read from when applying logic. */
  stepId?: string;
  /** Dot-path into the API response (e.g. data.items). */
  responseKey?: string;
  /** Option list: property used as the stored value (default: value). */
  optionValueKey?: string;
  /** Option list: property used as the display label (default: label). */
  optionLabelKey?: string;
}

export type FormDatePresetRange =
  | 'today'
  | 'yesterday'
  | 'last_days'
  | 'last_weeks'
  | 'last_months';

export type FormDatePresetColorId =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'teal'
  | 'pink'
  | 'gray';

export interface FormDatePresetOption {
  id: string;
  label: string;
  range: FormDatePresetRange;
  /** Used for last_days / last_weeks / last_months (e.g. 7 → last 7 days). */
  amount?: number;
}

export type FormFieldWidth = 'full' | 'half';

export interface FormBuilderFieldLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormBuilderField {
  id: string;
  name: string;
  displayName: string;
  type: FormBuilderFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  width?: FormFieldWidth;
  layout?: FormBuilderFieldLayout;
  visible: boolean;
  position: number;
  options?: FormBuilderFieldOption[];
  /** Hardcoded choices preserved when API options are applied. */
  staticOptions?: FormBuilderFieldOption[];
  /** Static hardcoded config vs API-driven values/options. Default: static. */
  dataSource?: FormFieldDataSource;
  /** API mapping config when dataSource is api. */
  apiSource?: FormFieldApiSourceConfig;
  /** Date picker quick-select buttons (label + range). */
  datePresets?: FormDatePresetOption[];
  /** Show calendar icon for custom from/to range. Default true. */
  allowCustomRange?: boolean;
  /** Overall accent color for the date picker (hex). Defaults to blue. */
  datePickerColor?: string;
  /** Data table column definitions. */
  tableColumns?: FormBuilderTableColumn[];
  /** API-synced rows (populated automatically from Logic tab). */
  tableRows?: FormBuilderTableRow[];
  /** How many rows to show initially — controls preview/runtime table height. */
  tableInitialRowCount?: number;
  /** Toolbar, search, and row actions for data tables. */
  tableUi?: FormBuilderTableUiConfig;
  /** KPI value shown in big number field. */
  bigNumberValue?: string;
  /** Prefix before the value (e.g. $). */
  bigNumberPrefix?: string;
  /** Suffix after the value (e.g. %, K). */
  bigNumberSuffix?: string;
  /** Secondary label under the main value. */
  bigNumberSubLabel?: string;
  /** Accent color for big number card (hex). */
  bigNumberColor?: string;
}

export interface FormBuilderDefinition {
  id: string;
  title: string;
  description?: string;
  fields: FormBuilderField[];
  apiLogic?: FormApiLogicConfig;
}

export type FormApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface FormApiHeader {
  key: string;
  value: string;
}

/** Query string param for GET requests. */
export interface FormApiQueryParam {
  key: string;
  value: string;
}

/** Preset GET request styles (legacy — use payloadFormat instead). */
export type FormApiGetRequestType = 'get_all' | 'get_by_id' | 'get_with_params';

/** How the request payload is sent for any HTTP method. */
export type FormApiPayloadFormat =
  | 'none'
  | 'query_params'
  | 'json'
  | 'form_urlencoded'
  | 'form_data'
  | 'text'
  | 'xml';

export type FormApiMappingAction = 'set_value' | 'set_options' | 'show_field' | 'hide_field';

export interface FormApiResponseMapping {
  id: string;
  responseKey: string;
  fieldId: string;
  action: FormApiMappingAction;
  /** For set_options: object property used as option value (e.g. deployment_name, id). */
  optionValueKey?: string;
  /** For set_options: object property used as option label (e.g. name). */
  optionLabelKey?: string;
  /** For set_options: replace API options, merge with hardcoded, or skip API. */
  optionMergeMode?: FormOptionMergeMode;
}

export interface FormApiLogicStep {
  id: string;
  name: string;
  method: FormApiHttpMethod;
  url: string;
  headers: FormApiHeader[];
  /** @deprecated Use payloadFormat instead */
  getRequestType?: FormApiGetRequestType;
  /** Key/value fields for query params or form payloads. */
  queryParams?: FormApiQueryParam[];
  /** Raw body for json / text / xml payload formats. */
  requestBody?: string;
  /** How the request payload is sent. */
  payloadFormat?: FormApiPayloadFormat;
  mappings: FormApiResponseMapping[];
  sampleResponse: string;
}

export interface FormApiLogicConfig {
  steps: FormApiLogicStep[];
}

export interface AppliedFormLogicState {
  values: Record<string, FormFieldValue>;
  visibilityOverrides: Record<string, boolean>;
  appliedAt: number;
  summary: AppliedLogicMappingSummary[];
}

export interface AppliedLogicMappingSummary {
  fieldLabel: string;
  fieldName: string;
  responseKey: string;
  action: string;
  value: string;
}

export interface FieldTypeCatalogItem {
  type: FormBuilderFieldType;
  label: string;
  description: string;
}

export interface FieldTypeCategory {
  id: FormFieldCategoryId;
  label: string;
  fields: FieldTypeCatalogItem[];
}

export type FormFieldValue = string | boolean | string[];

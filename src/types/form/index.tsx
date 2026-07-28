// src/types/form/index.tsx
export interface FormFieldBase {
  name: string;
  displayName: string;
  required?: boolean;
  info?: string;
}

export interface TextFieldConfig extends FormFieldBase {
  type: 'text';
  placeholder?: string;
}

export interface PasswordFieldConfig extends FormFieldBase {
  type: 'password';
  placeholder?: string;
}

export interface NumberFieldConfig extends FormFieldBase {
  type: 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownFieldConfig extends FormFieldBase {
  type: 'dropdown';
  placeholder?: string;
  options: DropdownOption[];
}

export interface MultiDropdownFieldConfig extends FormFieldBase {
  type: 'multi-dropdown';
  placeholder?: string;
  options: DropdownOption[];
}

export interface TextAreaFieldConfig extends FormFieldBase {
  type: 'textarea';
  placeholder?: string;
}

export interface CheckboxFieldConfig extends FormFieldBase {
  type: 'checkbox';
}

export interface FilterTextFieldConfig extends FormFieldBase {
  type: 'filter-text';
  placeholder?: string;
}

export interface FilterRow {
  id: string;
  value: string;
  index: number;
}
export interface UploadFieldConfig {
  type:'upload';
}

/** Dynamic list of string key / value pairs (e.g. API Connector query params, headers). */
export interface KeyValueFieldConfig {
  type: "key-value";
  name?: string;
  displayName?: string;
  required?: boolean;
  info?: string;
  placeholder?: string;
}

export type FormFieldConfig =
  | TextFieldConfig
  | PasswordFieldConfig
  | NumberFieldConfig
  | DropdownFieldConfig
  | MultiDropdownFieldConfig
  | TextAreaFieldConfig
  | CheckboxFieldConfig
  | FilterTextFieldConfig
  | UploadFieldConfig
  | KeyValueFieldConfig

export type FormConfig = FormFieldConfig[];
export type FormValue = string | FilterRow[] | File | null | string[] | any;

export interface FieldTemplate {  
  key: string;
  /** When `key` is suffixed for multi-row UI (e.g. `name_row_0`), stable template key for lookups. */
  originalKey?: string;
  info?: string;
  depends_key?: string[];
  depends_value?: string[];
  type: FormFieldConfig['type'];
  value: FormValue;
  options?: DropdownOption[];
  fetch?: FetchAPIParams;
  required?: boolean;
  placeholder?: string;
  display_name: string;
  position?: number;
  actions_buttons?: {
    add: boolean;
    delete: boolean;
  };
  request?: any;
  name?: string;
  api?: any;
  enabled?: any;
  add_connection_enabled?: boolean;
  source_form_id?: string;
  add_source_connection?: boolean;
  source_form_name?:string;
  options_by_dependency?: {
    dependency_key: string;
    value_map: Record<string, DropdownOption[]>;
  };
}

export interface DynamicFieldRendererProps { 
  field: FieldTemplate;
  value: FormValue;
  onChange: (key: string, value: FormValue) => void;
  allFormValues?: FormSubmissionData; // Add optional prop for conditional field rendering
  /** Tighter vertical spacing (e.g. API Connector grid) */
  compact?: boolean;
}

export interface FetchAPIParams {
  module: string;
  klass: string;
  method?: string;
  params?: FetchAPIPayload;
}

export interface FetchAPIPayload {
  payload: Record<string, any>;
}

export type Option = {
  value: string;
  label: string;
}
  
export interface InputDropdownProps { 
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  options?: Option[];
  value?: any;
  position?: number;
  fetch?: FetchAPIParams;
  id?: string;
  className?: string;
  onChange: (value: string) => void;
  onFocus?: (key: string, fetchApi: FetchAPIParams) => void;
  formValues?: Record<string, FormValue>;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
}

export interface InputMultiDropdownProps { 
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  options?: Option[];
  value?: any;
  position?: number;
  onChange: (value: string[]) => void;
  fetch?: FetchAPIParams;
  formValues?: Record<string, FormValue>; 
}

export interface DropdownAPIPayload { 
  connection_id: string;
  group_type: string;
  connection_type: string;
}

export interface InputFilterFormProps { 
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: FilterRow[];
  position?: number;
  onChange: (filters: FilterRow[]) => void;
  className?: string;
}


// New interface for form field
export interface FormFieldOption {
  description?: any;
  label: any;
  value: any;
}

export interface FormFieldOption1{
  isVerification: any;
  isKey: any;
  label: any;
  value: any;

}

export interface FetchParams {
  payload: {
    actions: string;
    [key: string]: any;
  };
  // Adding flexibility for the new schema
  fields?: string;
  connection_type?: string;
}

export interface FetchConfig {
  klass: string;
  method: 'post' | 'get';
  module: string;
  params: FetchParams;
}

export interface FormField {
  key: string;
  display_name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'dropdown' | 'checkbox' | 'radio' | 'combobox' | 'multi-select-combobox' | 'upload' | 'switch' | 'time' | 'date' | 'multi-date' | 'multi-input';
  position: number;
  required: boolean;
  placeholder?: string;
  info?: string;
  fetch?: FetchConfig;
  options?: FormFieldOption[];
  value?: any; // This is the default value
  gridColumn?: 'span-1' | 'span-2' | 'span-3' | 'span-4' | 'span-6' | 'span-12';
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  add_source_connection?: boolean;
  source_form_id?: string;
  source_form_name?: string;
  // Add dependency properties
  depends_key?: string[];
  depends_value?: string[];
  /** Dropdown options keyed by another field (e.g. CSV: mode → type labels/options). */
  options_by_dependency?: {
    dependency_key: string;
    value_map: Record<string, FormFieldOption[]>;
  };
}

export interface SaveNodeConfig {
  klass: string;
  method: 'post' | 'get';
  module: string;
  enabled: boolean;
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
  submitButtonText?: string;
  /** When true, DynamicForm will not show its built-in success toast (parent handles feedback). */
  suppressSuccessToast?: boolean;
  saveNode?: SaveNodeConfig;
  submitPayload?: Record<string, any>;
}

export interface FormSubmissionData {
  [key: string]: any;
}

export type InputPayload = {
  id: string;
  name: string;
  manualValue: string;
  filters: {
    id: string;
    useManualField?: boolean;
    field?: string;
    condition: string;
    useManualValue: boolean;
    value: string;
  }[];
};

export type OutputPayload = {
  new_custom_column: string;
  custom_filter_list: {
    operation: string;
    text_sf_box?: boolean;
    text_slf_box: boolean;
    selected_field?: string;
    selected_last_field: string;
  }[];
}[];
  
  export interface FlowNode {
    id: string;
    data: {
      display_name?: string;
      flow_id?: string;
      node?: {
        title?: string;
        payload?: {
          [key: string]: any;
          table?: string;
          tag?: string;
          datasets?: any;
        };
        output?: {
          columns?: string[];
          data?: any[];
        };
        save_node?: FetchAPIParams;
      };
    };
    position?: { x: number; y: number };
    type?: string;
  }
export interface FetchProjectsParams {
    q?: string;
    search_text?: string;
    skip?: number;
    limit?: number;
    sort?: string;
    fields?: string[];
    org_id?: string[] | string; // Array of org IDs or single org ID string
    perspective_ids?: string[] | number[]; // Array of perspective IDs for filtering

}

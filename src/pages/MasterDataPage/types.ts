
export type ViewMode = "list" | "grid";

export type FileAction = "view" | "download" | "delete" | "edit"; 

export interface FileType {
  id: number; 
  unique_id: string; 
  file_name: string;
  display_name: string;
  encrypted_file_key: string;
  size: string;
  sheet_name?: string;
  delimiter?: string;
  file_type: string; 
  file_category: string;
  created_by: string;
  updated_by: string; 
  created_at: string; 
  updated_at: string;
  entity_id?: string; 
}

export interface ApiFormFieldOption {
  label: string;
  value: string | number;
}

export interface ApiFormField {
  info: string;
  name: string;
  show: boolean;
  type: string; 
  klass: string;
  params: Record<string, any>;
  options: ApiFormFieldOption[];
  required: boolean;
  depend_keys: string[];
  placeholder: string;
  display_name: string;
  depends_values: (string | number)[];
}

export interface FormFieldConfig {
  name: string;
  type: "text" | "dropdown" | "textArea";
  displayName: string;
  placeholder?: string;
  required?: boolean;
  options?: ApiFormFieldOption[];
  depends_key?: string;
  depends_value?: (string | number)[];
  info?: string;
  show?: boolean;
  klass?: string;
  params?: Record<string, any>;
}

export interface FileUploadApiResponse {
  message: string;
  encrypted_file_key: string;
  file_name: string;
  unique_id: string;
  size: string;
}

export interface SheetNameApiContext {
  unique_id: string;
  encrypted_file_key: string;
  file_name: string;
  // file_category will be sourced from the form data itself
}


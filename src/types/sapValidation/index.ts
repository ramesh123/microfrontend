export type OperationCategory = 'string' | 'logical' | 'aggregation';

export interface AppliedOperation {
  id: string;
  operation_name: string;
  parameters: Record<string, any>;
  output_target: {
    mode: 'inplace' | 'new_column';
    new_column_name?: string;
  };
}

export interface RuleSideConfig {
  operationCategory?: OperationCategory;
  operations: AppliedOperation[];
}

export interface FieldValidationConfig {
  id: string;
  sourceType: ExpectedValueType;
  isConfigured?: boolean;
  fieldRuleConfigs?: Record<string, Partial<FieldValidationConfig>>;
  key1Config?: RuleSideConfig;
  key2Config?: RuleSideConfig;
}

export interface Validation {
  id: string;
  validation_id: number;
  object: string;
  object_type: string;
  validation_description: string;
  updated_at: string;
  application_id?: string;
  application_label?: string;
  module?: string;
  sub_module?: string;
  tcode?: string;
  database_connection?: string;
  primaryTable?: string;
  primaryKeyFields?: string[];
  primaryKeyValue?: string;
  selectedSecondaryTables?: string[];
  field_rules?: FieldRule[];
}

export interface FieldData {
  field_name: string;
  Description: string;
  KeyField: string;
  VerificationField: string;
  TableId: string;
  FieldId: string;
  dataType: string;
  sampleValue?: any;
}

export interface TableData {
  table_name: string;
  Fields: FieldData[];
}

export interface ValidationRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  type: 'validation' | 'display';
}

export type ExpectedValueType = 'constant_value' | 'table_field' | 'global_key' | 'combination_key' | 'fixed_value' | 'validation_key';

export interface FieldRule {
  unique_id: string;
  table_name: string;
  field_name: string;
  Description: string;
  isKey: boolean;
  isValidation: boolean;
  displayValue: string;
  isComparative: boolean;
  leftField: string;
  operator: string;
  rightField: string;
  expectedValueType: ExpectedValueType;
  expectedValue: string;
  KeyField: string;
  VerificationField: string;
  TableId: string;
  FieldId: string;
  isDisplay: boolean;
  primaryKeyValue: string;
  relationKeys: string[];
  dataType: string;
  sampleValue?: any;
  config?: Partial<FieldValidationConfig>;
}

export interface FormFieldOption {
  value: string | number;
  label: string;
}

import { FieldRule, Validation } from '@/types/sapValidation';
import { create } from 'zustand';

interface TableMapping {
  primary_table: string;
  primary_table_field: string;
  foriegn_table: string;
  foriegn_table_field: string;
  cardinality: string;
}

interface OperationResult {
  category: string;
  operation: string;
  targetFields: { source: boolean; target: boolean };
  input: { source: any; target: any };
  config: any;
  results: { source?: any; target?: any };
}

interface ValidationStatus {
  isValid: boolean;
  sourceValue: any;
  targetValue: any;
  comparison: string;
  sourceCurrentValue?: any;
  targetCurrentValue?: any;
}

interface RuleOperation {
  connectionId: string;
  sourceTable: string;
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  sourceValue: any;
  targetValue: any;
  operations: {
    source: {
      category?: string;
      type?: string;
      config?: any;
      result?: any;
      applied: boolean;
      originalValue?: any;
    };
    target: {
      category?: string;
      type?: string;
      config?: any;
      result?: any;
      applied: boolean;
      originalValue?: any;
    };
  };
  validation?: ValidationStatus;
  timestamp: string;
}

interface ValidationState {
  primary_table: string;
  primary_key_fields: string;
  primary_key_value: string;
  selected_secondary_tables: string;
  field_rules: FieldRule[];
  table_mappings: TableMapping[];
  leftRowData: any | null;
  rightRowData: any | null;
  isAggregateMode: boolean;
  aggregateFieldId: string | null;
  leftAggregateData: any[] | null;
  rightAggregateData: any[] | null;
  // New fields for connection-based row data
  selectedRowData: {
    sourceRow: any;
    targetRow: any;
    mapping: any;
  } | null;
  connectionsWithSelectedData: any[];
  // Operation-related fields
  currentOperationResult: OperationResult | null;
  currentValidationStatus: ValidationStatus | null;
  ruleOperations: RuleOperation[];
  currentConnection: any | null;
  columnFiltersBySource: Record<string, any>;
  validationRulesMap: Record<string, any>;
  submitRules: any; // Store submitted rules (field_rules and rule_configuration)
  setColumnFiltersBySource: (filters: Record<string, any>) => void;
  setValidationRulesMap: (rules: Record<string, any>) => void;
  upsertValidationRule: (ruleName: string, ruleData: Record<string, any>) => void;
  removeValidationRule: (ruleName: string) => void;
  setSubmitRules: (rules: any) => void;
  setPrimaryTable: (table: string) => void;
  setPrimaryKeyFields: (fields: string) => void;
  setPrimaryKeyValue: (value: string) => void;
  setSelectedSecondaryTables: (tables: string) => void;
  setFieldRules: (rules: FieldRule[]) => void;
  setTableMappings: (mappings: TableMapping[]) => void;
  setLeftRowData: (data: any | null) => void;
  setRightRowData: (data: any | null) => void;
  setAggregateMode: (fieldId: string | null) => void;
  setLeftAggregateData: (data: any[] | null) => void;
  setRightAggregateData: (data: any[] | null) => void;
  setSelectedRowData: (data: { sourceRow: any; targetRow: any; mapping: any } | null) => void;
  setConnectionsWithSelectedData: (connections: any[]) => void;
  // Operation-related setters
  setCurrentOperationResult: (result: OperationResult | null) => void;
  setCurrentValidationStatus: (status: ValidationStatus | null) => void;
  setRuleOperations: (operations: RuleOperation[]) => void;
  addRuleOperation: (operation: RuleOperation) => void;
  setCurrentConnection: (connection: any | null) => void;
  setInitialState: (data: Validation) => void;
  reset: () => void;
}

const initialState = {
  primary_table: '',
  primary_key_fields: '',
  primary_key_value: '',
  selected_secondary_tables: '',
  field_rules: [],
  table_mappings: [],
  leftRowData: null,
  rightRowData: null,
  isAggregateMode: false,
  aggregateFieldId: null,
  leftAggregateData: null,
  rightAggregateData: null,
  selectedRowData: null,
  connectionsWithSelectedData: [],
  // Operation-related initial state
  currentOperationResult: null,
  currentValidationStatus: null,
  ruleOperations: [],
  currentConnection: null,
  columnFiltersBySource: {},
  validationRulesMap: {},
  submitRules: null,
};

export const useValidationStore = create<ValidationState>((set) => ({
  ...initialState,
  setPrimaryTable: (table) => set({ 
    primary_table: table, 
    primary_key_fields: '', 
    primary_key_value: '', 
    selected_secondary_tables: '',
    table_mappings: [] // Reset mappings when primary table changes
  }),
  setPrimaryKeyFields: (fields) => set({ primary_key_fields: fields }),
  setPrimaryKeyValue: (value) => set({ primary_key_value: value }),
  setSelectedSecondaryTables: (tables) => set({ selected_secondary_tables: tables }),
  setFieldRules: (rules) => set({ field_rules: rules }),
  setTableMappings: (mappings) => set({ table_mappings: mappings }),
  setLeftRowData: (data) => set({ leftRowData: data }),
  setRightRowData: (data) => set({ rightRowData: data }),
  setAggregateMode: (fieldId) => set({ isAggregateMode: !!fieldId, aggregateFieldId: fieldId }),
  setLeftAggregateData: (data) => set({ leftAggregateData: data }),
  setRightAggregateData: (data) => set({ rightAggregateData: data }),
  setSelectedRowData: (data) => set({ selectedRowData: data }),
  setConnectionsWithSelectedData: (connections) => set({ connectionsWithSelectedData: connections }),
  // Operation-related implementations
  setCurrentOperationResult: (result) => set({ currentOperationResult: result }),
  setCurrentValidationStatus: (status) => set({ currentValidationStatus: status }),
  setRuleOperations: (operations) => set({ ruleOperations: operations }),
  addRuleOperation: (operation) => set((state) => {
    // Find if rule with same connectionId already exists
    const existingIndex = state.ruleOperations.findIndex(
      (rule) => rule.connectionId === operation.connectionId
    );
    
    if (existingIndex !== -1) {
      // Update existing rule
      const updatedOperations = [...state.ruleOperations];
      updatedOperations[existingIndex] = operation;
      console.log(`🔄 Updated existing rule at index ${existingIndex}:`, operation.connectionId);
      return { ruleOperations: updatedOperations };
    } else {
      // Add new rule
      console.log(`✅ Added new rule:`, operation.connectionId);
      return { ruleOperations: [...state.ruleOperations, operation] };
    }
  }),
  setCurrentConnection: (connection) => set({ currentConnection: connection }),
  setColumnFiltersBySource: (filters) => set({ columnFiltersBySource: filters || {} }),
  setValidationRulesMap: (rules) => set({ validationRulesMap: rules || {} }),
  upsertValidationRule: (ruleName, ruleData) => set((state) => {
    if (!ruleName) {
      return {};
    }

    const nextRules = { ...state.validationRulesMap };
    nextRules[ruleName] = {
      ...(state.validationRulesMap?.[ruleName] || {}),
      ...(ruleData || {}),
    };

    return { validationRulesMap: nextRules };
  }),
  removeValidationRule: (ruleName) => set((state) => {
    if (!ruleName) {
      return {};
    }

    const nextRules = { ...state.validationRulesMap };
    delete nextRules[ruleName];
    return { validationRulesMap: nextRules };
  }),
  setSubmitRules: (rules) => set({ submitRules: rules }),
  setInitialState: (data) => set({
    primary_table: data.primaryTable || '',
    primary_key_fields: data.primaryKeyFields?.join(',') || '',
    primary_key_value: data.primaryKeyValue || '',
    selected_secondary_tables: data.selectedSecondaryTables?.join(',') || '',
    field_rules: data.field_rules || [],
    table_mappings: [],
  }),
  reset: () => set(initialState),
}));

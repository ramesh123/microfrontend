/**
 * FilterOperations Types
 *
 * Type definitions for the Filter Operations feature that combines
 * derived columns and data filters into a unified operation flow.
 */

export type OperationType = 'derive_column' | 'data_filter' | null;

export interface Operation {
  id: string;
  type: 'derive_column' | 'data_filter';
  operation_name: string;
  parameters: Record<string, any>;
  output_target?: {
    mode: 'inplace' | 'new-column' | 'filter';
    new_column_name?: string;
  };
}

export interface FilterOperationsConfig {
  id?: string;
  name: string;
  operationType: OperationType;
  operations: Operation[];
  aiGeneratedPredicate?: string;
}

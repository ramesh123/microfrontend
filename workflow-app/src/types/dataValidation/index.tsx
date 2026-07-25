import { FlowNode } from '@/types/form';
export interface Column {
  id: string;
  name: string;
  type: string;
}

export interface ColumnMapping {
  id: string;
  sourceColumn: Column;
  targetColumn: Column;
  colorIndex: number;
}

export interface KeyValidationPair {
  id: string;
  keyColumn: Column;
  validationColumn: Column;
  colorIndex?: number;
}

export interface InputConnection {
  id: string;
  name: string;
  columns: Column[];
}

export interface ApiPayload {
  key: string;
  actions: string;
  is_pandas: boolean;
  is_polars: boolean;
  source_key: string;
  target_key: string;
  source_data: string;
  target_data: string;
  actions_write: string;
  response_type: string;
  validation_type: string;
  source_validation_column: string;
  target_validation_column: string;
}

export interface SaveNodeConfig {
  klass: string;
  method: string;
  module: string;
  enabled: boolean;
}

export interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  name: string;
  data: {
    icon: string;
    name: string;
    node: {
      payload: Partial<ApiPayload>;
      get_data: any;
      template: any;
      save_node: SaveNodeConfig;
    };
    type: string;
    node_id: string;
    show_node: boolean;
    description: string;
    display_name: string;
    id: string;
    columns?: string[];
    output?: { columns: string[] };
  };
  selected: boolean;
  measured: { width: number; height: number };
}

export interface ValidationHelper {
  buildSavePayload: (nodeData: FlowNode) => unknown
}
